# -*- coding: utf-8 -*-
"""
MetroFlow AI: Passenger Demand Forecasting & Spatial Crowd Density
Custom STGCN-BiLSTM + XGBoost pipeline for Kaggle / local environments.

Data source
-----------
This script trains exclusively on the locally supplied
`AI_Metro_Crowd_Management_Dataset.csv`. That file already contains
per-station-per-15-minute records with ridership counters (entry/exit,
occupancy), station/network metadata (lat/lon, line, interchange flag),
and merged exogenous telemetry (temperature, rainfall, AQI, weather
condition, holidays/festivals/events). No external Kaggle dataset
download or merge step is required or attempted; if the file is ever
missing a column this pipeline expects, `load_dataset()` raises a
explicit error naming the missing column instead of silently
substituting another data source.

Loading the saved model at inference time (FastAPI lifespan)
--------------------------------------------------------------
```python
import tensorflow as tf
from metroflow_train import (
    GraphConvLayer, TemporalAttention, MergeBatchNodeAxis, SplitBatchNodeAxis,
)

dl_model = tf.keras.models.load_model(
    "metroflow_stgcn_bilstm.h5",
    custom_objects={
        "GraphConvLayer": GraphConvLayer,
        "TemporalAttention": TemporalAttention,
        "MergeBatchNodeAxis": MergeBatchNodeAxis,
        "SplitBatchNodeAxis": SplitBatchNodeAxis,
    },
    compile=False,  # inference only — optimizer state isn't needed to serve
)
```
`compile=False` sidesteps a legacy-HDF5 loss/metric deserialization quirk
in current tf.keras; re-`compile()` only if you intend to keep training
from the checkpoint.
"""

# ================================
# INSTALL (Kaggle-safe) & IMPORTS
# ================================
import subprocess
import sys


def _ensure_packages():
    """Best-effort install for Kaggle kernels. No-op if already satisfied."""
    try:
        subprocess.run(
            [sys.executable, "-m", "pip", "install", "-q",
             "tensorflow", "xgboost", "scikit-learn", "pandas", "numpy",
             "mlflow", "statsmodels"],
            check=True,
        )
    except Exception as exc:  # pragma: no cover - environment dependent
        print(f"[WARN] Package auto-install skipped/failed: {exc}")


if __name__ == "__main__" and "--skip-install" not in sys.argv:
    _ensure_packages()

import os
import math
import pickle
import warnings

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import xgboost as xgb
import tensorflow as tf
from tensorflow.keras import layers, models, optimizers, callbacks
from sklearn.preprocessing import StandardScaler
from sklearn.multioutput import MultiOutputRegressor
from sklearn.metrics import mean_squared_error, mean_absolute_error
from statsmodels.tsa.seasonal import STL
import mlflow

warnings.filterwarnings("ignore", category=FutureWarning)

# ================================
# CONSTANTS & HYPERPARAMETERS
# ================================
# Paths. On Kaggle, point DATA_PATH at the uploaded custom dataset; locally
# it defaults to the CSV sitting next to this script. Both are overridable
# via environment variables so the exact same script runs in either place.
DATA_PATH = "AI_Metro_Crowd_Management_Dataset_Fixed.csv"
OUTPUT_DIR = os.environ.get(
    "METROFLOW_OUTPUT_DIR",
    "/kaggle/working/models" if os.path.isdir("/kaggle/working") else "./models",
)

# Temporal windowing. The dataset is natively sampled every 15 minutes
# (verified: time_slot steps 06:00, 06:15, 06:30 ... with a single overnight
# gap between the last slot of one day and 06:00 the next day). A 60-minute
# lookback is therefore 4 consecutive 15-minute readings, and forecasts are
# generated 1, 2 and 3 steps ahead (15 / 30 / 45 minutes).
HIST_WINDOW = 4                 # 60 minutes historical data (4 x 15-min steps)
PRED_HORIZONS = [1, 2, 3]       # 15-min, 30-min, 45-min ahead
DAILY_PERIOD = 72               # 15-min slots between 06:00-23:45 -> STL seasonal period

# Model Hyperparameters (fixed per spec — do not tune without re-validating)
BATCH_SIZE = 100
LEARNING_RATE = 0.01
EPOCHS = int(os.environ.get("METROFLOW_EPOCHS", 100))
GCN_UNITS = 16
LSTM_UNITS = 256
VALIDATION_SPLIT = 0.2
EARLY_STOPPING_PATIENCE = 40

RANDOM_SEED = 42
np.random.seed(RANDOM_SEED)
tf.random.set_seed(RANDOM_SEED)

# ================================
# FEATURE SCHEMA
# ================================
# "Feature-rich" numeric operational + exogenous signals, present natively
# in the CSV (ridership, infra load, ticketing, historical baselines,
# weather/AQI, service health).
NUMERIC_FEATURES = [
    "entry_count", "exit_count", "net_flow", "current_occupancy",
    "occupancy_percentage", "transfer_count", "avg_dwell_time",
    "queue_length_at_gate", "avg_wait_time_platform", "train_arrivals_in_slot",
    "train_headway_minutes", "train_load_factor", "afc_smart_card_taps",
    "qr_ticket_taps", "token_sales_count", "historical_avg_footfall",
    "historical_peak_footfall", "historical_std_dev", "temperature",
    "rainfall_mm", "aqi_index", "current_train_frequency",
    "scheduled_train_frequency", "frequency_deviation",
]

BINARY_FLAGS = [
    "is_weekend", "is_holiday", "is_festival", "school_college_session_flag",
    "office_hours_flag", "special_event_flag", "strike_or_disruption_flag",
    "service_alert_active",
]

CROWD_DENSITY_MAP = {"Low": 0, "Moderate": 1, "High": 2}

ENGINEERED_FEATURES = [
    "crowd_density_ord", "hour_sin", "hour_cos", "dow_sin", "dow_cos",
    "occ_trend", "occ_seasonal", "occ_resid",
]

ALL_FEATURES = NUMERIC_FEATURES + BINARY_FLAGS + ENGINEERED_FEATURES

# Columns whose values are forecast (raw / pre-scaling units).
TARGET_BASE_COLS = ["entry_count", "occupancy_percentage"]
TARGET_NAMES = [
    f"{col}_t+{h * 15}min" for col in TARGET_BASE_COLS for h in PRED_HORIZONS
]  # 6 targets, ordered [entry+15,entry+30,entry+45,occ+15,occ+30,occ+45]

REQUIRED_COLUMNS = set(
    ["station_id", "station_name", "city", "metro_line_id", "latitude",
     "longitude", "interchange_flag", "timestamp"]
    + NUMERIC_FEATURES + BINARY_FLAGS + ["crowd_density_level", "day_of_week"]
)


# ================================
# UTILS & PREPROCESSING
# ================================
def load_dataset(path=DATA_PATH):
    """
    Loads the locally supplied MetroFlow CSV (already merges ridership,
    infrastructure, ticketing, historical baselines, and exogenous weather
    /AQI telemetry per station per 15-minute slot — no separate weather
    dataset merge is required). Validates schema and dtypes.
    """
    if not os.path.exists(path):
        raise FileNotFoundError(
            f"[MetroFlow] Expected local dataset at '{path}'. This pipeline "
            f"is configured to train only on the supplied "
            f"AI_Metro_Crowd_Management_Dataset.csv; no external Kaggle "
            f"dataset is downloaded automatically."
        )

    df = pd.read_csv(path)

    missing = REQUIRED_COLUMNS - set(df.columns)
    if missing:
        raise ValueError(
            f"[MetroFlow] Dataset at '{path}' is missing required columns: "
            f"{sorted(missing)}. Refusing to substitute an external source."
        )

    df["timestamp"] = pd.to_datetime(df["timestamp"])
    df = df.sort_values(["station_id", "timestamp"]).reset_index(drop=True)
    return df


def _assign_continuity_blocks(timestamps, station_ids, expected_step="15min"):
    """
    Marks a monotonically increasing block id that increments whenever the
    time gap to the previous row (within the same station) is not the
    expected sampling step. Used so lag/lead features and sliding windows
    never silently bridge the overnight service gap (23:45 -> next 06:00).
    """
    step = pd.Timedelta(expected_step)
    block_id = np.zeros(len(timestamps), dtype=np.int64)
    current_block = 0
    prev_ts = None
    prev_station = None
    for i, (ts, sid) in enumerate(zip(timestamps, station_ids)):
        if prev_station is not None and sid == prev_station and (ts - prev_ts) != step:
            current_block += 1
        elif prev_station is not None and sid != prev_station:
            current_block += 1
        block_id[i] = current_block
        prev_ts, prev_station = ts, sid
    return block_id


def apply_stl_decomposition(time_series, period=DAILY_PERIOD, robust=True):
    """
    Applies Seasonal-Trend decomposition based on Loess (STL) to a single
    station's ordered operational series (business-hours slots only, so the
    seasonal period is expressed in *operational* 15-min steps-per-day
    rather than calendar time).
    Returns (trend, seasonal, resid) as numpy arrays the same length as the
    input.
    """
    series = pd.Series(time_series).astype(float)
    series = series.interpolate(method="linear", limit_direction="both")
    if len(series) < 2 * period:
        # Too short a run for a reliable seasonal fit (e.g. partial final
        # day) — fall back to trend-only via rolling mean, zero seasonal.
        trend = series.rolling(window=min(period, len(series)), min_periods=1,
                                center=True).mean().to_numpy()
        seasonal = np.zeros(len(series))
        resid = series.to_numpy() - trend
        return trend, seasonal, resid

    stl_result = STL(series, period=period, robust=robust).fit()
    return (
        stl_result.trend.to_numpy(),
        stl_result.seasonal.to_numpy(),
        stl_result.resid.to_numpy(),
    )


def preprocess_pipeline(df):
    """
    1. Linear interpolation for missing numeric telemetry (per station,
       gap-aware).
    2. Cyclic encoding for time-of-day / day-of-week.
    3. STL decomposition of occupancy per station (trend/seasonal/resid
       engineered features).
    4. Ordinal-encodes crowd_density_level.
    Returns the enriched dataframe plus the continuity block id array.
    """
    df = df.copy()
    block_id = _assign_continuity_blocks(df["timestamp"].to_numpy(),
                                          df["station_id"].to_numpy())
    df["block_id"] = block_id

    # 1. Gap-aware linear interpolation of numeric telemetry.
    df[NUMERIC_FEATURES] = (
        df.groupby(["station_id", "block_id"])[NUMERIC_FEATURES]
        .transform(lambda s: s.interpolate(method="linear", limit_direction="both"))
    )
    # Any still-missing values (e.g. a feature entirely absent in a short
    # block) fall back to the global median for that column.
    df[NUMERIC_FEATURES] = df[NUMERIC_FEATURES].fillna(df[NUMERIC_FEATURES].median())

    # 2. Cyclic encoding of time-of-day and day-of-week.
    minutes_of_day = df["timestamp"].dt.hour * 60 + df["timestamp"].dt.minute
    df["hour_sin"] = np.sin(2 * np.pi * minutes_of_day / (24 * 60))
    df["hour_cos"] = np.cos(2 * np.pi * minutes_of_day / (24 * 60))
    dow = df["timestamp"].dt.dayofweek
    df["dow_sin"] = np.sin(2 * np.pi * dow / 7)
    df["dow_cos"] = np.cos(2 * np.pi * dow / 7)

    # 3. Ordinal crowd density.
    df["crowd_density_ord"] = df["crowd_density_level"].map(CROWD_DENSITY_MAP).fillna(0)

    # 4. STL decomposition of occupancy_percentage, per station.
    df["occ_trend"] = 0.0
    df["occ_seasonal"] = 0.0
    df["occ_resid"] = 0.0
    for station, sub_idx in df.groupby("station_id").groups.items():
        sub_idx = df.loc[sub_idx].sort_values("timestamp").index
        trend, seasonal, resid = apply_stl_decomposition(
            df.loc[sub_idx, "occupancy_percentage"].to_numpy()
        )
        df.loc[sub_idx, "occ_trend"] = trend
        df.loc[sub_idx, "occ_seasonal"] = seasonal
        df.loc[sub_idx, "occ_resid"] = resid

    return df


def build_laplacian_matrix(station_meta, distance_sigma_km=3.0):
    """
    Constructs the weighted adjacency matrix (A) for the metro network
    topology from two signals present in the data:
      (a) shared line segments — two stations sharing any colour token in
          their `metro_line_id` (e.g. 'L_YEL_BLU' & 'L_YEL_MAG' both serve
          the Yellow line) are directly rail-connected, weight 1.0;
      (b) physical proximity — a Gaussian kernel over haversine distance
          (Yu, Yin & Zhu, 2018, STGCN) as a soft prior for stations that are
          geographically close but not confirmed same-line, weight in (0,1).
    The two signals are combined with max(), then row-normalised via the
    Kipf & Welling (2017) renormalisation trick: A_hat = A + I,
    A_norm = D_hat^-1/2 A_hat D_hat^-1/2.

    Returns: (A_norm [N,N] float32, station_order [list of station_id])
    """
    station_meta = station_meta.drop_duplicates("station_id").reset_index(drop=True)
    station_order = station_meta["station_id"].tolist()
    n = len(station_order)

    lat = station_meta["latitude"].to_numpy()
    lon = station_meta["longitude"].to_numpy()
    line_tokens = station_meta["metro_line_id"].apply(
        lambda s: set(str(s).split("_")[1:])  # drop leading 'L' token
    ).tolist()

    def haversine_km(lat1, lon1, lat2, lon2):
        r = 6371.0
        p1, p2 = math.radians(lat1), math.radians(lat2)
        dphi = math.radians(lat2 - lat1)
        dlambda = math.radians(lon2 - lon1)
        a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlambda / 2) ** 2
        return 2 * r * math.asin(math.sqrt(a))

    A = np.zeros((n, n), dtype=np.float64)
    for i in range(n):
        for j in range(n):
            if i == j:
                continue
            dist_km = haversine_km(lat[i], lon[i], lat[j], lon[j])
            proximity_weight = math.exp(-(dist_km ** 2) / (2 * distance_sigma_km ** 2))
            shares_line = len(line_tokens[i] & line_tokens[j]) > 0
            line_weight = 1.0 if shares_line else 0.0
            A[i, j] = max(proximity_weight, line_weight)

    # Renormalisation trick (Kipf & Welling, 2017).
    A_hat = A + np.eye(n)
    D_hat = np.sum(A_hat, axis=1)
    D_inv_sqrt = np.diag(1.0 / np.sqrt(D_hat))
    A_norm = D_inv_sqrt @ A_hat @ D_inv_sqrt

    return A_norm.astype(np.float32), station_order


def _fit_scaler_on_train_slice(df, feature_cols, train_frac=0.8):
    """Fits a StandardScaler using only the chronologically-first
    `train_frac` of unique timestamps, so no test-period statistics leak
    into the scaler."""
    unique_ts = np.sort(df["timestamp"].unique())
    cutoff_ts = unique_ts[int(len(unique_ts) * train_frac)]
    train_mask = df["timestamp"] < cutoff_ts
    scaler = StandardScaler()
    scaler.fit(df.loc[train_mask, feature_cols].to_numpy())
    return scaler, cutoff_ts


def generate_sequences(df, station_order, feature_scaler, target_scaler,
                        hist_window=HIST_WINDOW, horizons=PRED_HORIZONS):
    """
    Converts the long-format (station, timestamp) tabular data into 3D/4D
    tensors for the STGCN-BiLSTM:
      X: [samples, hist_window, num_nodes, num_features]
      y: [samples, num_nodes, num_targets]  (scaled, per TARGET_NAMES order)
    A window is only emitted when all of its history steps AND all
    requested horizon steps fall inside the same continuity block for
    every node (i.e. never bridges the overnight service gap or dataset
    edges) — this is the "valid future labels" requirement.
    Also returns `sample_timestamps` (the timestamp of the last history
    step) for chronological splitting downstream.
    """
    n_nodes = len(station_order)
    max_h = max(horizons)

    # Pivot into (T, N) grids, aligned on the shared timestamp axis (the
    # dataset was verified to give every station the identical 1006-slot
    # timeline with no gaps in the panel).
    pivot_ts = np.sort(df["timestamp"].unique())
    t_index = {ts: i for i, ts in enumerate(pivot_ts)}
    T = len(pivot_ts)

    feat_grid = np.zeros((T, n_nodes, len(ALL_FEATURES)), dtype=np.float32)
    entry_grid = np.zeros((T, n_nodes), dtype=np.float32)
    occ_grid = np.zeros((T, n_nodes), dtype=np.float32)
    block_grid = np.full((T, n_nodes), -1, dtype=np.int64)

    scaled_features = feature_scaler.transform(df[ALL_FEATURES].to_numpy())
    df = df.assign(**{f"_scaled_{i}": scaled_features[:, i] for i in range(len(ALL_FEATURES))})

    for n_idx, station in enumerate(station_order):
        sub = df[df["station_id"] == station].sort_values("timestamp")
        rows = sub["timestamp"].map(t_index).to_numpy()
        feat_grid[rows, n_idx, :] = sub[[f"_scaled_{i}" for i in range(len(ALL_FEATURES))]].to_numpy()
        entry_grid[rows, n_idx] = sub["entry_count"].to_numpy()
        occ_grid[rows, n_idx] = sub["occupancy_percentage"].to_numpy()
        block_grid[rows, n_idx] = sub["block_id"].to_numpy()

    X_samples, y_samples, sample_ts = [], [], []
    for t in range(hist_window - 1, T - max_h):
        window_slice = block_grid[t - hist_window + 1: t + max_h + 1, :]
        # valid only if every node's block id is constant across the whole
        # history+horizon span at this t
        if not np.all(window_slice == window_slice[0:1, :]):
            continue

        X_win = feat_grid[t - hist_window + 1: t + 1, :, :]  # (hist,N,F)
        targets = []
        for base_grid in (entry_grid, occ_grid):
            for h in horizons:
                targets.append(base_grid[t + h, :])  # (N,)
        y_win = np.stack(targets, axis=1)  # (N, num_targets)

        X_samples.append(X_win)
        y_samples.append(y_win)
        sample_ts.append(pivot_ts[t])

    X = np.stack(X_samples, axis=0)
    y_raw = np.stack(y_samples, axis=0)

    # Scale targets with the same per-metric StandardScaler used at
    # inference time, applied independently per horizon column so training
    # loss operates on comparable magnitudes.
    n_metrics = len(TARGET_BASE_COLS)
    y_scaled = np.zeros_like(y_raw)
    for m in range(n_metrics):
        cols = list(range(m * len(horizons), (m + 1) * len(horizons)))
        flat = y_raw[:, :, cols].reshape(-1, 1)
        flat_scaled = target_scaler[m].transform(flat)
        y_scaled[:, :, cols] = flat_scaled.reshape(y_raw.shape[0], y_raw.shape[1], len(cols))

    return X, y_scaled, y_raw, np.array(sample_ts)


def build_tabular_dataset(df, lags=(1, 2, 3)):
    """
    Builds the flat (station, timestamp) row-level dataset used by the
    XGBoost baseline: current ALL_FEATURES plus lag1/2/3 of entry_count and
    occupancy_percentage (gap-aware — never bridges the overnight block
    boundary), predicting the same 6 forward targets as the graph model.
    """
    df = df.sort_values(["station_id", "timestamp"]).copy()
    lag_cols = []
    for col in ("entry_count", "occupancy_percentage"):
        for lag in lags:
            new_col = f"{col}_lag{lag}"
            df[new_col] = df.groupby(["station_id", "block_id"])[col].shift(lag)
            lag_cols.append(new_col)

    for col in TARGET_BASE_COLS:
        for h in PRED_HORIZONS:
            df[f"target_{col}_t+{h}"] = df.groupby(["station_id", "block_id"])[col].shift(-h)

    target_cols = [f"target_{col}_t+{h}" for col in TARGET_BASE_COLS for h in PRED_HORIZONS]
    feature_cols = ALL_FEATURES + lag_cols

    valid = df.dropna(subset=feature_cols + target_cols).reset_index(drop=True)
    X = valid[feature_cols].to_numpy()
    y = valid[target_cols].to_numpy()
    return X, y, feature_cols, valid["timestamp"].to_numpy()


# ================================
# ALGORITHM 1: XGBOOST BASELINE
# ================================
class MetroXGBoostBaseline:
    """
    Tabular, feature-rich station-level baseline. One-shot fast inference
    path for the FastAPI backend, and a source of interpretable feature
    importance (e.g. quantifying weather / AQI impact on demand) that the
    graph-deep-learning model does not directly expose.
    """

    def __init__(self):
        base_estimator = xgb.XGBRegressor(
            objective="reg:squarederror",
            n_estimators=200,
            learning_rate=0.05,
            max_depth=6,
            subsample=0.9,
            colsample_bytree=0.9,
            random_state=RANDOM_SEED,
            n_jobs=-1,
        )
        self.model = MultiOutputRegressor(base_estimator)
        self.feature_names_ = None
        self.target_names_ = None

    def train(self, X_train, y_train, feature_names, target_names=TARGET_NAMES):
        """Trains one XGBRegressor per target and stores feature/target
        names so feature importance can be extracted per-target later."""
        self.feature_names_ = list(feature_names)
        self.target_names_ = list(target_names)
        self.model.fit(X_train, y_train)
        return self

    def predict(self, X):
        return self.model.predict(X)

    def feature_importance(self, target_index=0, top_n=15):
        """Returns the top-N most important features (e.g. weather, AQI,
        historical footfall) for one of the fitted per-target estimators."""
        estimator = self.model.estimators_[target_index]
        importances = pd.Series(
            estimator.feature_importances_, index=self.feature_names_
        ).sort_values(ascending=False)
        return importances.head(top_n)

    def save_model(self, path):
        """Serializes via pickle for FastAPI lifespan-event loading."""
        with open(path, "wb") as f:
            pickle.dump(
                {
                    "model": self.model,
                    "feature_names": self.feature_names_,
                    "target_names": self.target_names_,
                },
                f,
            )

    @staticmethod
    def load_model(path):
        with open(path, "rb") as f:
            payload = pickle.load(f)
        obj = MetroXGBoostBaseline()
        obj.model = payload["model"]
        obj.feature_names_ = payload["feature_names"]
        obj.target_names_ = payload["target_names"]
        return obj


# ================================
# ALGORITHM 2: STGCN-BiLSTM
# ================================
@tf.keras.utils.register_keras_serializable(package="MetroFlow")
class GraphConvLayer(layers.Layer):
    """
    First-order Graph Convolution layer (Kipf & Welling, 2017 renormalised
    propagation rule), applied independently at every timestep to learn the
    spatial (station-topology) representation:
        H' = activation( A_norm @ H @ W + b )
    Input  : (batch, T, N, F_in)
    Output : (batch, T, N, units)
    The adjacency matrix is a fixed (non-trainable) constant produced by
    `build_laplacian_matrix`.
    """

    def __init__(self, units, adjacency_matrix, activation="relu", **kwargs):
        super().__init__(**kwargs)
        self.units = units
        self.activation_name = activation
        self.activation = tf.keras.activations.get(activation)
        self._adjacency_matrix_np = np.array(adjacency_matrix, dtype=np.float32)
        self.adj = tf.constant(self._adjacency_matrix_np, dtype=tf.float32)

    def build(self, input_shape):
        f_in = int(input_shape[-1])
        self.kernel = self.add_weight(
            name="gcn_kernel", shape=(f_in, self.units),
            initializer="glorot_uniform", trainable=True,
        )
        self.bias = self.add_weight(
            name="gcn_bias", shape=(self.units,),
            initializer="zeros", trainable=True,
        )
        super().build(input_shape)

    def call(self, inputs):
        support = tf.einsum("btnf,fu->btnu", inputs, self.kernel)
        out = tf.einsum("nm,btmu->btnu", self.adj, support)
        out = out + self.bias
        return self.activation(out)

    def get_config(self):
        config = super().get_config()
        config.update({
            "units": self.units,
            "adjacency_matrix": self._adjacency_matrix_np.tolist(),
            "activation": self.activation_name,
        })
        return config


@tf.keras.utils.register_keras_serializable(package="MetroFlow")
class MergeBatchNodeAxis(layers.Layer):
    """Reshapes (B, N, T, U) -> (B*N, T, U) so a single shared-weight BiLSTM
    can process every station's temporal sequence in one batched call.
    Implemented as a real Layer (not a raw python Lambda) so the model
    reloads under Keras's default safe-mode deserialization."""

    def __init__(self, timesteps, units, **kwargs):
        super().__init__(**kwargs)
        self.timesteps = timesteps
        self.units = units

    def call(self, inputs):
        return tf.reshape(inputs, (-1, self.timesteps, self.units))

    def get_config(self):
        config = super().get_config()
        config.update({"timesteps": self.timesteps, "units": self.units})
        return config


@tf.keras.utils.register_keras_serializable(package="MetroFlow")
class SplitBatchNodeAxis(layers.Layer):
    """Inverse of MergeBatchNodeAxis: (B*N, F) -> (B, N, F)."""

    def __init__(self, num_nodes, units, **kwargs):
        super().__init__(**kwargs)
        self.num_nodes = num_nodes
        self.units = units

    def call(self, inputs):
        return tf.reshape(inputs, (-1, self.num_nodes, self.units))

    def get_config(self):
        config = super().get_config()
        config.update({"num_nodes": self.num_nodes, "units": self.units})
        return config


@tf.keras.utils.register_keras_serializable(package="MetroFlow")
class TemporalAttention(layers.Layer):
    """Additive attention over the temporal axis, collapsing
    (batch, T, F) -> (batch, F) with learned per-step importance weights."""

    def __init__(self, units=128, **kwargs):
        super().__init__(**kwargs)
        self.units = units
        self.score_dense1 = layers.Dense(units, activation="tanh")
        self.score_dense2 = layers.Dense(1)

    def call(self, inputs):
        scores = self.score_dense2(self.score_dense1(inputs))       # (B,T,1)
        weights = tf.nn.softmax(scores, axis=1)                     # (B,T,1)
        context = tf.reduce_sum(weights * inputs, axis=1)           # (B,F)
        return context

    def get_config(self):
        config = super().get_config()
        config.update({"units": self.units})
        return config


def build_stgcn_bilstm(hist_window, num_nodes, num_features, adjacency_matrix,
                        num_targets):
    """
    Builds the deep learning computational graph:
        Input -> GCN x2 (Spatial) -> BiLSTM (Temporal) -> Attention -> Dense Output
    Output shape: (batch, num_nodes, num_targets), one forecast vector
    per station (ordered per TARGET_NAMES: entry+15/30/45, occ+15/30/45).
    """
    inputs = layers.Input(shape=(hist_window, num_nodes, num_features),
                           name="node_sequence_input")

    x = GraphConvLayer(GCN_UNITS, adjacency_matrix, activation="relu", name="gcn_1")(inputs)
    x = GraphConvLayer(GCN_UNITS, adjacency_matrix, activation="relu", name="gcn_2")(x)

    # (B,T,N,GCN_UNITS) -> (B,N,T,GCN_UNITS): temporal modelling runs
    # per-node with shared BiLSTM weights across all stations.
    x = layers.Permute((2, 1, 3))(x)
    x = MergeBatchNodeAxis(hist_window, GCN_UNITS, name="merge_batch_node")(x)

    x = layers.Bidirectional(
        layers.LSTM(LSTM_UNITS, return_sequences=True), name="bilstm"
    )(x)
    x = TemporalAttention(units=128, name="temporal_attention")(x)

    x = SplitBatchNodeAxis(num_nodes, 2 * LSTM_UNITS, name="split_batch_node")(x)

    x = layers.Dense(64, activation="relu")(x)
    x = layers.Dropout(0.2)(x)
    outputs = layers.TimeDistributed(
        layers.Dense(num_targets, activation="linear"), name="forecast_head"
    )(x)

    model = models.Model(inputs=inputs, outputs=outputs, name="STGCN_BiLSTM")
    model.compile(
        optimizer=optimizers.Adam(learning_rate=LEARNING_RATE),
        loss="mse",
        metrics=["mae"],
    )
    return model


# ================================
# EVALUATION HELPERS
# ================================
def inverse_transform_targets(y_scaled, target_scaler, horizons=PRED_HORIZONS):
    """Inverse-transforms a (samples, nodes, num_targets) or
    (samples, num_targets) array back to raw units, per-metric."""
    y = np.array(y_scaled, dtype=np.float64)
    n_metrics = len(TARGET_BASE_COLS)
    out = np.zeros_like(y)
    if y.ndim == 3:
        for m in range(n_metrics):
            cols = list(range(m * len(horizons), (m + 1) * len(horizons)))
            flat = y[:, :, cols].reshape(-1, 1)
            out[:, :, cols] = target_scaler[m].inverse_transform(flat).reshape(
                y.shape[0], y.shape[1], len(cols)
            )
    else:
        for m in range(n_metrics):
            cols = list(range(m * len(horizons), (m + 1) * len(horizons)))
            flat = y[:, cols].reshape(-1, 1)
            out[:, cols] = target_scaler[m].inverse_transform(flat).reshape(y.shape[0], len(cols))
    return out


def _mlflow_safe_name(name):
    """MLflow metric keys only allow alphanumerics/_/-/./ /:. Strip the '+'
    used in target names like 'entry_count_t+15min'."""
    return name.replace("+", "")


def report_metrics(y_true_raw, y_pred_raw, target_names, label):
    print(f"\n[METRICS] {label}")
    y_true_flat = y_true_raw.reshape(-1, y_true_raw.shape[-1])
    y_pred_flat = y_pred_raw.reshape(-1, y_pred_raw.shape[-1])
    metrics = {}
    for i, name in enumerate(target_names):
        rmse = math.sqrt(mean_squared_error(y_true_flat[:, i], y_pred_flat[:, i]))
        mae = mean_absolute_error(y_true_flat[:, i], y_pred_flat[:, i])
        metrics[name] = {"rmse": rmse, "mae": mae}
        print(f"  {name:>28s}  RMSE={rmse:8.3f}  MAE={mae:8.3f}")
    return metrics

# ================================
# VISUAL EVALUATION
# ================================

def create_evaluation_plots(
    y_true_raw,
    y_pred_raw,
    xgb_true,
    xgb_pred,
    xgb_metrics,
    dl_metrics,
    top_features,
    output_dir,
    target_names=TARGET_NAMES,
):
    """
    Creates evaluation plots for the MetroFlow AI models.

    Generates:
    1. STGCN-BiLSTM actual vs predicted
    2. XGBoost vs STGCN-BiLSTM RMSE comparison
    3. XGBoost vs STGCN-BiLSTM MAE comparison
    4. XGBoost feature importance
    """

    os.makedirs(output_dir, exist_ok=True)

    # ------------------------------------------------
    # 1. ACTUAL VS PREDICTED - STGCN-BiLSTM
    # ------------------------------------------------

    # Average over stations so that we get one value
    # per time sample.
    dl_actual = np.mean(y_true_raw, axis=1)
    dl_predicted = np.mean(y_pred_raw, axis=1)

    # Plot entry-count forecasts
    plt.figure(figsize=(12, 6))

    for i, horizon in enumerate(["15 min", "30 min", "45 min"]):
        plt.plot(
            dl_actual[:, i],
            label=f"Actual Entry +{horizon}"
        )
        plt.plot(
            dl_predicted[:, i],
            linestyle="--",
            label=f"Predicted Entry +{horizon}"
        )

    plt.title("STGCN-BiLSTM: Actual vs Predicted Entry Demand")
    plt.xlabel("Holdout Samples")
    plt.ylabel("Entry Count")
    plt.legend()
    plt.tight_layout()

    path = os.path.join(
        output_dir,
        "stgcn_bilstm_actual_vs_predicted_entry.png"
    )

    plt.savefig(path, dpi=300)
    plt.close()

    # ------------------------------------------------
    # 2. ACTUAL VS PREDICTED - OCCUPANCY
    # ------------------------------------------------

    plt.figure(figsize=(12, 6))

    for i, horizon in enumerate(["15 min", "30 min", "45 min"]):
        col = i + 3

        plt.plot(
            dl_actual[:, col],
            label=f"Actual Occupancy +{horizon}"
        )
        plt.plot(
            dl_predicted[:, col],
            linestyle="--",
            label=f"Predicted Occupancy +{horizon}"
        )

    plt.title("STGCN-BiLSTM: Actual vs Predicted Occupancy")
    plt.xlabel("Holdout Samples")
    plt.ylabel("Occupancy Percentage")
    plt.legend()
    plt.tight_layout()

    path = os.path.join(
        output_dir,
        "stgcn_bilstm_actual_vs_predicted_occupancy.png"
    )

    plt.savefig(path, dpi=300)
    plt.close()

    # ------------------------------------------------
    # 3. RMSE COMPARISON - ENTRY DEMAND
    # ------------------------------------------------

    entry_labels = [
        "Entry +15",
        "Entry +30",
        "Entry +45"
    ]

    entry_xgb_rmse = [
        xgb_metrics["entry_count_t+15min"]["rmse"],
        xgb_metrics["entry_count_t+30min"]["rmse"],
        xgb_metrics["entry_count_t+45min"]["rmse"]
    ]

    entry_dl_rmse = [
        dl_metrics["entry_count_t+15min"]["rmse"],
        dl_metrics["entry_count_t+30min"]["rmse"],
        dl_metrics["entry_count_t+45min"]["rmse"]
    ]

    entry_x = np.arange(3)
    width = 0.35

    plt.figure(figsize=(10, 6))

    plt.bar(
        entry_x - width / 2,
        entry_xgb_rmse,
        width,
        label="XGBoost"
    )

    plt.bar(
        entry_x + width / 2,
        entry_dl_rmse,
        width,
        label="STGCN-BiLSTM"
    )

    plt.xticks(entry_x, entry_labels)
    plt.ylabel("RMSE")
    plt.xlabel("Forecast Horizon")
    plt.title("Entry Demand Forecasting - RMSE")
    plt.legend()
    plt.tight_layout()

    path = os.path.join(
        output_dir,
        "entry_demand_rmse_comparison.png"
    )

    plt.savefig(path, dpi=300)
    plt.close()


    # ------------------------------------------------
    # 4. RMSE COMPARISON - OCCUPANCY
    # ------------------------------------------------

    occupancy_labels = [
        "Occupancy +15",
        "Occupancy +30",
        "Occupancy +45"
    ]

    occupancy_xgb_rmse = [
        xgb_metrics["occupancy_percentage_t+15min"]["rmse"],
        xgb_metrics["occupancy_percentage_t+30min"]["rmse"],
        xgb_metrics["occupancy_percentage_t+45min"]["rmse"]
    ]

    occupancy_dl_rmse = [
        dl_metrics["occupancy_percentage_t+15min"]["rmse"],
        dl_metrics["occupancy_percentage_t+30min"]["rmse"],
        dl_metrics["occupancy_percentage_t+45min"]["rmse"]
    ]

    occupancy_x = np.arange(3)

    plt.figure(figsize=(10, 6))

    plt.bar(
        occupancy_x - width / 2,
        occupancy_xgb_rmse,
        width,
        label="XGBoost"
    )

    plt.bar(
        occupancy_x + width / 2,
        occupancy_dl_rmse,
        width,
        label="STGCN-BiLSTM"
    )

    plt.xticks(occupancy_x, occupancy_labels)
    plt.ylabel("RMSE")
    plt.xlabel("Forecast Horizon")
    plt.title("Occupancy Forecasting - RMSE")
    plt.legend()
    plt.tight_layout()

    path = os.path.join(
        output_dir,
        "occupancy_rmse_comparison.png"
    )

    plt.savefig(path, dpi=300)
    plt.close()


    # ------------------------------------------------
    # 5. MAE COMPARISON
    # ------------------------------------------------

    mae_xgb = [
    xgb_metrics[name]["mae"]
    for name in target_names
    ]

    mae_dl = [
    dl_metrics[name]["mae"]
    for name in target_names
    ]

    labels = [
    "Entry +15",
    "Entry +30",
    "Entry +45",
    "Occupancy +15",
    "Occupancy +30",
    "Occupancy +45",
    ]

    # IMPORTANT: recreate x for all 6 MAE values
    x = np.arange(len(labels))

    width = 0.35

    plt.figure(figsize=(12, 6))

    plt.bar(
    x - width / 2,
    mae_xgb,
    width,
    label="XGBoost"
    )

    plt.bar(
    x + width / 2,
    mae_dl,
    width,
    label="STGCN-BiLSTM"
    )

    plt.xticks(x, labels, rotation=30)
    plt.ylabel("MAE")
    plt.title("MetroFlow Model Comparison - MAE")
    plt.legend()
    plt.tight_layout()

    path = os.path.join(
    output_dir,
    "model_comparison_mae.png"
    )

    plt.savefig(path, dpi=300)
    plt.close()

    # ------------------------------------------------
    # 5. FEATURE IMPORTANCE
    # ------------------------------------------------

    plt.figure(figsize=(10, 6))

    features = top_features.index[::-1]
    importance = top_features.values[::-1]

    plt.barh(
        features,
        importance
    )

    plt.xlabel("Feature Importance")
    plt.ylabel("Feature")
    plt.title(
        "Top Features Driving Next-15-Minute Entry Demand"
    )

    plt.tight_layout()

    path = os.path.join(
        output_dir,
        "xgboost_feature_importance.png"
    )

    plt.savefig(path, dpi=300)
    plt.close()

    print("\n[INFO] Evaluation graphs created:")
    print(f"       {output_dir}")


# ================================
# MAIN TRAINING LOOP
# ================================
if __name__ == "__main__":
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    mlflow.set_experiment("metroflow-demand-forecasting")

    with mlflow.start_run(run_name="stgcn_bilstm_xgboost"):
        mlflow.log_params({
            "hist_window": HIST_WINDOW,
            "pred_horizons_min": [h * 15 for h in PRED_HORIZONS],
            "batch_size": BATCH_SIZE,
            "learning_rate": LEARNING_RATE,
            "epochs": EPOCHS,
            "gcn_units": GCN_UNITS,
            "lstm_units": LSTM_UNITS,
            "validation_split": VALIDATION_SPLIT,
        })

        # 1. Load Data
        print("[INFO] Loading local MetroFlow dataset...")
        df_raw = load_dataset()
        station_meta = df_raw.drop_duplicates("station_id")
        print(f"[INFO] {df_raw['station_id'].nunique()} stations, "
              f"{df_raw['timestamp'].nunique()} timestamps, {len(df_raw)} rows.")

        # 2. Preprocess: interpolation, cyclic encoding, STL decomposition
        print("[INFO] Interpolating telemetry, cyclic-encoding time, "
              "running per-station STL decomposition...")
        df = preprocess_pipeline(df_raw)

        # 3. Fit scalers on the chronologically-first 80% only (no leakage)
        feature_scaler, cutoff_ts = _fit_scaler_on_train_slice(df, ALL_FEATURES, train_frac=0.8)
        target_scaler = []
        train_mask = df["timestamp"] < cutoff_ts
        for col in TARGET_BASE_COLS:
            sc = StandardScaler().fit(df.loc[train_mask, [col]].to_numpy())
            target_scaler.append(sc)
        print(f"[INFO] Scalers fit on data before {cutoff_ts} "
              f"({train_mask.mean():.0%} of rows).")

        # 4. Build Graph Topology
        print("[INFO] Building station adjacency (line-sharing + haversine "
              "Gaussian kernel) and Kipf-Welling normalised Laplacian...")
        A_norm, station_order = build_laplacian_matrix(station_meta)
        print(f"[INFO] {len(station_order)} nodes: {station_order}")

        # 5. Sequence generation for the graph model
        print("[INFO] Generating gap-aware sliding-window sequences "
              f"(hist={HIST_WINDOW} steps, horizons={PRED_HORIZONS})...")
        X, y_scaled, y_raw, sample_ts = generate_sequences(
            df, station_order, feature_scaler, target_scaler
        )
        print(f"[INFO] Sequence tensor X: {X.shape}, y: {y_scaled.shape}")

        # Chronological split matching VALIDATION_SPLIT (last 20% by time)
        split_idx = int(len(X) * (1 - VALIDATION_SPLIT))
        X_train, X_val = X[:split_idx], X[split_idx:]
        y_train, y_val = y_scaled[:split_idx], y_scaled[split_idx:]
        y_val_raw = y_raw[split_idx:]

        # 6. Tabular dataset + XGBoost baseline
        print("[INFO] Building tabular (lagged) dataset for XGBoost baseline...")
        X_tab, y_tab, tab_feature_names, tab_ts = build_tabular_dataset(df)
        # Split on the SAME chronological cutoff used for the scalers/graph
        # sequences (not a positional slice — build_tabular_dataset is
        # sorted station-then-time, so a positional cut would mix train and
        # test periods across stations and leak future information).
        tab_train_mask = tab_ts < np.datetime64(cutoff_ts)
        X_tab_train, X_tab_val = X_tab[tab_train_mask], X_tab[~tab_train_mask]
        y_tab_train, y_tab_val = y_tab[tab_train_mask], y_tab[~tab_train_mask]

        print("[INFO] Training XGBoost baseline...")
        xgb_model = MetroXGBoostBaseline()
        xgb_model.train(X_tab_train, y_tab_train, tab_feature_names)
        xgb_pred_val = xgb_model.predict(X_tab_val)
        xgb_metrics = report_metrics(y_tab_val, xgb_pred_val, TARGET_NAMES,
                                      "XGBoost baseline (holdout)")
        mlflow.log_metrics({f"xgb_rmse_{_mlflow_safe_name(k)}": v["rmse"] for k, v in xgb_metrics.items()})
        top_features = xgb_model.feature_importance(target_index=0, top_n=10)
        print("\n[INFO] Top-10 features driving next-15-min entry demand "
              "(includes weather/AQI impact):")
        print(top_features.to_string())

        # 7. Train STGCN-BiLSTM with MLflow tracking
        print(f"\n[INFO] Compiling STGCN-BiLSTM "
              f"(GCN_UNITS={GCN_UNITS}, LSTM_UNITS={LSTM_UNITS}) "
              f"with Adam(lr={LEARNING_RATE})...")
        dl_model = build_stgcn_bilstm(
            hist_window=HIST_WINDOW,
            num_nodes=len(station_order),
            num_features=len(ALL_FEATURES),
            adjacency_matrix=A_norm,
            num_targets=len(TARGET_NAMES),
        )
        dl_model.summary()

        early_stop = callbacks.EarlyStopping(
            monitor="val_loss", patience=EARLY_STOPPING_PATIENCE,
            restore_best_weights=True,
        )

        history = dl_model.fit(
            X_train, y_train,
            validation_data=(X_val, y_val),
            batch_size=min(BATCH_SIZE, max(1, len(X_train))),
            epochs=EPOCHS,
            callbacks=[early_stop],
            verbose=2,
        )
        mlflow.log_metric("final_val_loss", float(history.history["val_loss"][-1]))
        mlflow.log_metric("epochs_run", len(history.history["loss"]))

        # 8. Evaluate & Serialize
        print("[INFO] Evaluating STGCN-BiLSTM on holdout (raw units)...")
        y_pred_scaled = dl_model.predict(X_val, verbose=0)
        y_pred_raw = inverse_transform_targets(y_pred_scaled, target_scaler)
        dl_metrics = report_metrics(y_val_raw, y_pred_raw, TARGET_NAMES,
                                     "STGCN-BiLSTM (holdout, raw units)")
        mlflow.log_metrics({f"dl_rmse_{_mlflow_safe_name(k)}": v["rmse"] for k, v in dl_metrics.items()})

                # 9. Create evaluation graphs
        create_evaluation_plots(
            y_true_raw=y_val_raw,
            y_pred_raw=y_pred_raw,
            xgb_true=y_tab_val,
            xgb_pred=xgb_pred_val,
            xgb_metrics=xgb_metrics,
            dl_metrics=dl_metrics,
            top_features=top_features,
            output_dir=OUTPUT_DIR,
        )

        print("[INFO] Exporting models (.pkl and .h5) and preprocessing "
              "artifacts for FastAPI lifespan loading...")
        xgb_model.save_model(os.path.join(OUTPUT_DIR, "metroflow_xgboost_baseline.pkl"))
        dl_model.save(os.path.join(OUTPUT_DIR, "metroflow_stgcn_bilstm.h5"))

        with open(os.path.join(OUTPUT_DIR, "metroflow_preprocessing.pkl"), "wb") as f:
            pickle.dump({
                "feature_scaler": feature_scaler,
                "target_scaler": target_scaler,
                "all_features": ALL_FEATURES,
                "target_names": TARGET_NAMES,
                "station_order": station_order,
                "adjacency_matrix": A_norm,
                "hist_window": HIST_WINDOW,
                "pred_horizons": PRED_HORIZONS,
            }, f)

        mlflow.log_artifact(os.path.join(OUTPUT_DIR, "metroflow_xgboost_baseline.pkl"))
        mlflow.log_artifact(os.path.join(OUTPUT_DIR, "metroflow_stgcn_bilstm.h5"))
        mlflow.log_artifact(os.path.join(OUTPUT_DIR, "metroflow_preprocessing.pkl"))

        print(f"\n[DONE] Artifacts written to: {OUTPUT_DIR}")

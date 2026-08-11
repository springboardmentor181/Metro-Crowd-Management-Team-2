
import os
import pickle
import warnings

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import RandomizedSearchCV, TimeSeriesSplit
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.multioutput import MultiOutputRegressor

from xgboost import XGBRegressor

warnings.filterwarnings("ignore")

SEED = 42

DATA_PATH = "AI_Metro_Crowd_Management_Dataset_Fixed.csv"
OUTPUT_DIR = "rf_xgb_results"

TEST_SIZE = 0.20

# 15-minute data:
# 1 = +15 min, 2 = +30 min, 3 = +45 min
HORIZONS = [1, 2, 3]



#FEATURE ENGINEERING

BASE_FEATURES = [
    "entry_count",
    "exit_count",
    "net_flow",
    "current_occupancy",
    "occupancy_percentage",
    "transfer_count",
    "avg_dwell_time",
    "queue_length_at_gate",
    "avg_wait_time_platform",
    "train_arrivals_in_slot",
    "train_headway_minutes",
    "train_capacity",
    "train_load_factor",
    "afc_smart_card_taps",
    "qr_ticket_taps",
    "token_sales_count",
    "historical_avg_footfall",
    "historical_peak_footfall",
    "historical_std_dev",
    "is_weekend",
    "is_holiday",
    "is_festival",
    "school_college_session_flag",
    "office_hours_flag",
    "special_event_flag",
    "strike_or_disruption_flag",
    "service_alert_active",
    "temperature",
    "rainfall_mm",
    "aqi_index",
    "current_train_frequency",
    "scheduled_train_frequency",
    "frequency_deviation",
    "interchange_flag",
    "num_platforms",
    "num_entry_exit_gates",
    "num_escalators",
    "num_lifts",
    "num_ticket_counters",
    "num_afc_gates",
    "platform_capacity",
    "concourse_area_sqm",
    "max_safe_occupancy",
    "nearby_poi_count",
    "latitude",
    "longitude",
]


TARGET_COLUMNS = [
    "entry_count_t+1",
    "entry_count_t+2",
    "entry_count_t+3",
    "occupancy_percentage_t+1",
    "occupancy_percentage_t+2",
    "occupancy_percentage_t+3",
]

TARGET_NAMES = [
    "Entry +15 min",
    "Entry +30 min",
    "Entry +45 min",
    "Occupancy +15 min",
    "Occupancy +30 min",
    "Occupancy +45 min",
]


def add_features(df):
    """Create simple, explainable time and historical features."""
    df = df.copy()

    # -------------------------------
    # Cyclic time features
    # -------------------------------
    minutes = (
        df["timestamp"].dt.hour * 60
        + df["timestamp"].dt.minute
    )

    df["hour_sin"] = np.sin(
        2 * np.pi * minutes / 1440
    )
    df["hour_cos"] = np.cos(
        2 * np.pi * minutes / 1440
    )

    day_of_week = df["timestamp"].dt.dayofweek

    df["dow_sin"] = np.sin(
        2 * np.pi * day_of_week / 7
    )
    df["dow_cos"] = np.cos(
        2 * np.pi * day_of_week / 7
    )

    # Crowd density

    density_map = {
        "Low": 0,
        "Moderate": 1,
        "High": 2,
    }

    df["crowd_density_ord"] = (
        df["crowd_density_level"]
        .map(density_map)
        .fillna(0)
    )

    # Past-only lag features

    grouped = df.groupby(
        ["station_id", "block_id"]
    )

    for column in [
        "entry_count",
        "exit_count",
        "net_flow",
        "current_occupancy",
        "occupancy_percentage",
    ]:
        for lag in [1, 2, 3, 4]:
            df[f"{column}_lag_{lag}"] = (
                grouped[column]
                .shift(lag)
            )


    # Past-only rolling features

    df["entry_rolling_mean_4"] = (
        grouped["entry_count"]
        .shift(1)
        .groupby(
            [df["station_id"], df["block_id"]]
        )
        .rolling(4, min_periods=1)
        .mean()
        .reset_index(level=[0, 1], drop=True)
    )

    df["occupancy_rolling_mean_4"] = (
        grouped["occupancy_percentage"]
        .shift(1)
        .groupby(
            [df["station_id"], df["block_id"]]
        )
        .rolling(4, min_periods=1)
        .mean()
        .reset_index(level=[0, 1], drop=True)
    )

    return df


def create_targets(df):
    """Create future targets without crossing continuity blocks."""
    df = df.copy()

    grouped = df.groupby(
        ["station_id", "block_id"]
    )

    for column in [
        "entry_count",
        "occupancy_percentage",
    ]:
        for horizon in HORIZONS:
            df[
                f"{column}_t+{horizon}"
            ] = grouped[column].shift(-horizon)

    return df


# ============================================================
# 2. LOAD DATA
# ============================================================

def load_data():
    print("Loading dataset...")

    df = pd.read_csv(DATA_PATH)

    df["timestamp"] = pd.to_datetime(
        df["timestamp"]
    )

    df = df.sort_values(
        ["station_id", "timestamp"]
    ).reset_index(drop=True)

    # A new block starts whenever the interval is not 15 minutes.
    # This prevents overnight gaps from becoming fake 15-minute steps.
    df["block_id"] = (
        df.groupby("station_id")["timestamp"]
        .diff()
        .ne(pd.Timedelta("15min"))
        .groupby(df["station_id"])
        .cumsum()
    )

    df = add_features(df)
    df = create_targets(df)

    # Station identity.
    station_dummies = pd.get_dummies(
        df["station_id"],
        prefix="station",
        dtype=float,
    )

    df = pd.concat(
        [df, station_dummies],
        axis=1,
    )

    feature_columns = (
        BASE_FEATURES
        + [
            "hour_sin",
            "hour_cos",
            "dow_sin",
            "dow_cos",
            "crowd_density_ord",
        ]
        + [
            column
            for column in df.columns
            if "_lag_" in column
        ]
        + [
            "entry_rolling_mean_4",
            "occupancy_rolling_mean_4",
        ]
        + station_dummies.columns.tolist()
    )

    # Remove duplicate feature names while preserving order.
    feature_columns = list(
        dict.fromkeys(feature_columns)
    )

    # Keep only columns that actually exist.
    feature_columns = [
        column
        for column in feature_columns
        if column in df.columns
    ]

    # Replace infinite values.
    df[feature_columns] = (
        df[feature_columns]
        .replace(
            [np.inf, -np.inf],
            np.nan,
        )
    )

    # Fill feature missing values with training-independent medians.
    # The final chronological split is still preserved.
    for column in feature_columns:
        df[column] = df[column].fillna(
            df[column].median()
        )

    # Future targets must exist.
    df = df.dropna(
        subset=TARGET_COLUMNS
    ).reset_index(drop=True)

    print(
        f"Rows after preprocessing: {len(df):,}"
    )
    print(
        f"Stations: {df['station_id'].nunique()}"
    )
    print(
        f"Features: {len(feature_columns)}"
    )

    return (
        df,
        feature_columns,
        TARGET_COLUMNS,
    )


# ============================================================
# 3. RANDOM FOREST
# ============================================================

def tune_random_forest(
    X_train,
    y_train,
):
    print("\nTuning Random Forest...")

    model = RandomForestRegressor(
        random_state=SEED,
        n_jobs=-1,
    )

    parameters = {
        "n_estimators": [
            100,
            200,
            300,
        ],
        "max_depth": [
            None,
            10,
            20,
            30,
        ],
        "min_samples_split": [
            2,
            5,
            10,
        ],
        "min_samples_leaf": [
            1,
            2,
            4,
        ],
        "max_features": [
            "sqrt",
            0.7,
            1.0,
        ],
    }

    search = RandomizedSearchCV(
        estimator=model,
        param_distributions=parameters,
        n_iter=12,
        cv=TimeSeriesSplit(
            n_splits=3
        ),
        scoring="neg_root_mean_squared_error",
        random_state=SEED,
        n_jobs=-1,
        verbose=1,
    )

    search.fit(
        X_train,
        y_train,
    )

    print(
        "Best Random Forest parameters:"
    )
    print(search.best_params_)

    return (
        search.best_estimator_,
        search,
    )


# ============================================================
# 4. XGBOOST
# ============================================================

def tune_xgboost(
    X_train,
    y_train,
):
    print("\nTuning XGBoost...")

    base_model = MultiOutputRegressor(
        XGBRegressor(
            objective="reg:squarederror",
            random_state=SEED,
            n_jobs=1,
        )
    )

    parameters = {
        "estimator__n_estimators": [
            100,
            200,
            300,
        ],
        "estimator__max_depth": [
            3,
            5,
            7,
            10,
        ],
        "estimator__learning_rate": [
            0.01,
            0.03,
            0.05,
            0.1,
        ],
        "estimator__subsample": [
            0.7,
            0.8,
            1.0,
        ],
        "estimator__colsample_bytree": [
            0.7,
            0.8,
            1.0,
        ],
        "estimator__min_child_weight": [
            1,
            3,
            5,
        ],
    }

    search = RandomizedSearchCV(
        estimator=base_model,
        param_distributions=parameters,
        n_iter=12,
        cv=TimeSeriesSplit(
            n_splits=3
        ),
        scoring="neg_root_mean_squared_error",
        random_state=SEED,
        n_jobs=-1,
        verbose=1,
    )

    search.fit(
        X_train,
        y_train,
    )

    print(
        "Best XGBoost parameters:"
    )
    print(search.best_params_)

    return (
        search.best_estimator_,
        search,
    )


# ============================================================
# 5. ENSEMBLE
# ============================================================

def make_weighted_ensemble(
    rf_prediction,
    xgb_prediction,
    rf_weight=0.5,
):
    """
    Simple weighted ensemble.

    prediction =
        RF weight * RF prediction
        +
        XGBoost weight * XGBoost prediction
    """
    xgb_weight = 1.0 - rf_weight

    return (
        rf_weight * rf_prediction
        + xgb_weight * xgb_prediction
    )


def find_best_ensemble_weight(
    y_validation,
    rf_prediction,
    xgb_prediction,
):
    """
    Find the RF/XGBoost mixing weight on a validation period.

    We test:
        0.0 -> 100% XGBoost
        0.1 -> 10% RF + 90% XGBoost
        ...
        1.0 -> 100% RF
    """

    best_weight = 0.5
    best_rmse = float("inf")

    for rf_weight in np.arange(
        0.0,
        1.01,
        0.1,
    ):
        prediction = make_weighted_ensemble(
            rf_prediction,
            xgb_prediction,
            rf_weight,
        )

        rmse = np.sqrt(
            mean_squared_error(
                y_validation,
                prediction,
            )
        )

        if rmse < best_rmse:
            best_rmse = rmse
            best_weight = rf_weight

    print(
        f"Best ensemble weight: "
        f"RF={best_weight:.1f}, "
        f"XGBoost={1-best_weight:.1f}"
    )

    return best_weight


# ============================================================
# 6. METRICS
# ============================================================

def smape(y_true, y_pred):
    denominator = np.abs(y_true) + np.abs(y_pred)
    mask = denominator != 0

    if not np.any(mask):
        return 0.0

    return np.mean(
        2 * np.abs(y_pred[mask] - y_true[mask])
        / denominator[mask]
    ) * 100


def calculate_metrics(y_true, y_prediction):
    """Calculate meaningful regression metrics for every target."""
    rows = []

    for index, target_name in enumerate(TARGET_NAMES):
        actual = y_true[:, index]
        predicted = y_prediction[:, index]

        rmse = np.sqrt(
            mean_squared_error(actual, predicted)
        )
        mae = mean_absolute_error(actual, predicted)
        r2 = r2_score(actual, predicted)

        mean_actual = np.mean(np.abs(actual))
        nrmse = (
            rmse / mean_actual * 100
            if mean_actual != 0
            else np.nan
        )

        rows.append({
            "Target": target_name,
            "MAE": mae,
            "RMSE": rmse,
            "R2": r2,
            "NRMSE_%": nrmse,
            "sMAPE_%": smape(actual, predicted),
        })

    return pd.DataFrame(rows)


def calculate_baseline_metrics(df_test, y_test):
    """
    Naive persistence baseline:
    assume the current entry/occupancy stays unchanged
    at +15, +30 and +45 minutes.
    """
    current_values = df_test[
        ["entry_count", "occupancy_percentage"]
    ].to_numpy(dtype=np.float32)

    baseline_prediction = np.column_stack([
        current_values[:, 0],
        current_values[:, 0],
        current_values[:, 0],
        current_values[:, 1],
        current_values[:, 1],
        current_values[:, 1],
    ])

    return (
        baseline_prediction,
        calculate_metrics(y_test, baseline_prediction),
    )


def calculate_skill_score(baseline_rmse, model_rmse):
    """Positive percentage means improvement over the naive baseline."""
    if baseline_rmse == 0:
        return np.nan

    return (
        1 - model_rmse / baseline_rmse
    ) * 100


# ============================================================
# 7. PLOTS
# ============================================================

def plot_model_comparison(
    all_metrics,
    output_dir,
):
    """
    Create separate RMSE and MAE comparison plots.
    """

    models = list(
        all_metrics.keys()
    )

    horizons = [
        "+15 min",
        "+30 min",
        "+45 min",
    ]

    # -------------------------------
    # Entry RMSE
    # -------------------------------
    plot_metric(
        all_metrics,
        models,
        [0, 1, 2],
        horizons,
        "RMSE",
        "Entry Demand RMSE",
        "RMSE (passengers)",
        "entry_rmse_comparison.png",
        output_dir,
    )

    # -------------------------------
    # Entry MAE
    # -------------------------------
    plot_metric(
        all_metrics,
        models,
        [0, 1, 2],
        horizons,
        "MAE",
        "Entry Demand MAE",
        "MAE (passengers)",
        "entry_mae_comparison.png",
        output_dir,
    )

    # -------------------------------
    # Occupancy RMSE
    # -------------------------------
    plot_metric(
        all_metrics,
        models,
        [3, 4, 5],
        horizons,
        "RMSE",
        "Occupancy RMSE",
        "RMSE (percentage points)",
        "occupancy_rmse_comparison.png",
        output_dir,
    )

    # -------------------------------
    # Occupancy MAE
    # -------------------------------
    plot_metric(
        all_metrics,
        models,
        [3, 4, 5],
        horizons,
        "MAE",
        "Occupancy MAE",
        "MAE (percentage points)",
        "occupancy_mae_comparison.png",
        output_dir,
    )


def plot_metric(
    all_metrics,
    models,
    target_indices,
    horizon_labels,
    metric,
    title,
    ylabel,
    filename,
    output_dir,
):
    x = np.arange(
        len(horizon_labels)
    )

    width = 0.8 / len(models)

    plt.figure(
        figsize=(11, 6)
    )

    for model_index, model_name in enumerate(
        models
    ):
        values = [
            all_metrics[model_name][
                metric
            ].iloc[target_index]
            for target_index in target_indices
        ]

        offset = (
            model_index
            - (len(models) - 1) / 2
        ) * width

        plt.bar(
            x + offset,
            values,
            width,
            label=model_name,
        )

    plt.xticks(
        x,
        horizon_labels,
    )

    plt.xlabel(
        "Forecast horizon"
    )

    plt.ylabel(ylabel)

    plt.title(title)

    plt.legend()

    plt.grid(
        axis="y",
        alpha=0.25,
    )

    plt.tight_layout()

    plt.savefig(
        os.path.join(
            output_dir,
            filename,
        ),
        dpi=200,
    )

    plt.close()


def plot_actual_vs_predicted(
    y_true,
    predictions,
    output_dir,
):
    """
    Plot actual vs predicted values for every model.
    """

    # Average over stations is not required here because the
    # models already produce row-level predictions.
    for model_name, prediction in predictions.items():

        # Entry +15
        plt.figure(
            figsize=(12, 5)
        )

        n = min(
            300,
            len(y_true),
        )

        plt.plot(
            y_true[:n, 0],
            label="Actual",
        )

        plt.plot(
            prediction[:n, 0],
            label="Predicted",
            linestyle="--",
        )

        plt.title(
            f"{model_name}: Entry Demand +15 min"
        )

        plt.xlabel(
            "Test samples"
        )

        plt.ylabel(
            "Entry count"
        )

        plt.legend()

        plt.tight_layout()

        plt.savefig(
            os.path.join(
                output_dir,
                f"{model_name.lower().replace(' ', '_')}_entry_actual_vs_predicted.png",
            ),
            dpi=200,
        )

        plt.close()


def plot_tuning_results(
    search,
    title,
    filename,
    output_dir,
):
    results = pd.DataFrame(
        search.cv_results_
    )

    results = results.sort_values(
        "mean_test_score",
        ascending=False,
    ).head(10)

    scores = (
        -results["mean_test_score"]
        .to_numpy()
    )

    plt.figure(
        figsize=(10, 5)
    )

    plt.bar(
        range(len(scores)),
        scores,
    )

    plt.xlabel(
        "Trial rank"
    )

    plt.ylabel(
        "Cross-validated RMSE"
    )

    plt.title(title)

    plt.tight_layout()

    plt.savefig(
        os.path.join(
            output_dir,
            filename,
        ),
        dpi=200,
    )

    plt.close()


def plot_feature_importance(
    model,
    feature_names,
    output_dir,
    model_name,
    top_n=20,
):
    """
    Plot feature importance.

    For XGBoost, average feature importance across
    the six target estimators.
    """

    if isinstance(
        model,
        MultiOutputRegressor,
    ):
        importance = np.mean(
            [
                estimator.feature_importances_
                for estimator in model.estimators_
            ],
            axis=0,
        )
    else:
        importance = (
            model.feature_importances_
        )

    importance_df = pd.DataFrame(
        {
            "Feature": feature_names,
            "Importance": importance,
        }
    ).sort_values(
        "Importance",
        ascending=False,
    ).head(top_n)

    plt.figure(
        figsize=(10, 7)
    )

    plt.barh(
        importance_df["Feature"][::-1],
        importance_df["Importance"][::-1],
    )

    plt.xlabel(
        "Feature importance"
    )

    plt.title(
        f"{model_name}: Top {top_n} Features"
    )

    plt.tight_layout()

    plt.savefig(
        os.path.join(
            output_dir,
            f"{model_name.lower().replace(' ', '_')}_feature_importance.png",
        ),
        dpi=200,
    )

    plt.close()


# ============================================================
# 8. MAIN TRAINING PIPELINE
# ============================================================

def main():

    os.makedirs(
        OUTPUT_DIR,
        exist_ok=True,
    )

    # --------------------------------------------------------
    # Load and prepare data
    # --------------------------------------------------------

    (
        df,
        feature_columns,
        target_columns,
    ) = load_data()

    # Sort globally by time before splitting.
    df = df.sort_values(
        "timestamp"
    ).reset_index(drop=True)

    unique_times = np.sort(
        df["timestamp"]
        .unique()
    )

    cutoff_index = int(
        len(unique_times)
        * (1 - TEST_SIZE)
    )

    cutoff_time = unique_times[
        cutoff_index
    ]

    train_mask = (
        df["timestamp"]
        < cutoff_time
    )

    test_mask = ~train_mask

    X_train = df.loc[
        train_mask,
        feature_columns,
    ].to_numpy(
        dtype=np.float32
    )

    X_test = df.loc[
        test_mask,
        feature_columns,
    ].to_numpy(
        dtype=np.float32
    )

    y_train = df.loc[
        train_mask,
        target_columns,
    ].to_numpy(
        dtype=np.float32
    )

    y_test = df.loc[
        test_mask,
        target_columns,
    ].to_numpy(
        dtype=np.float32
    )

    print(
        f"\nTraining rows: {len(X_train):,}"
    )

    print(
        f"Test rows: {len(X_test):,}"
    )

    print(
        f"Test starts: {cutoff_time}"
    )

    # --------------------------------------------------------
    # Random Forest
    # --------------------------------------------------------

    rf_model, rf_search = (
        tune_random_forest(
            X_train,
            y_train,
        )
    )

    rf_prediction = rf_model.predict(
        X_test
    )

    # --------------------------------------------------------
    # XGBoost
    # --------------------------------------------------------

    xgb_model, xgb_search = (
        tune_xgboost(
            X_train,
            y_train,
        )
    )

    xgb_prediction = xgb_model.predict(
        X_test
    )

    # --------------------------------------------------------
    # Ensemble validation split
    # --------------------------------------------------------
    #
    # We don't choose the ensemble weight using the final test
    # set. We reserve the last 20% of the training period for
    # selecting the RF/XGBoost weight.

    train_times = np.sort(
        df.loc[
            train_mask,
            "timestamp",
        ].unique()
    )

    validation_cutoff = train_times[
        int(len(train_times) * 0.80)
    ]

    internal_train_mask = (
        train_mask
        & (
            df["timestamp"]
            < validation_cutoff
        )
    )

    internal_validation_mask = (
        train_mask
        & (
            df["timestamp"]
            >= validation_cutoff
        )
    )

    X_internal_train = df.loc[
        internal_train_mask,
        feature_columns,
    ].to_numpy(
        dtype=np.float32
    )

    y_internal_train = df.loc[
        internal_train_mask,
        target_columns,
    ].to_numpy(
        dtype=np.float32
    )

    X_internal_val = df.loc[
        internal_validation_mask,
        feature_columns,
    ].to_numpy(
        dtype=np.float32
    )

    y_internal_val = df.loc[
        internal_validation_mask,
        target_columns,
    ].to_numpy(
        dtype=np.float32
    )

    # Use the already tuned model configurations and train
    # temporary models on the internal training period.
    rf_validation_model = (
        RandomForestRegressor(
            **rf_search.best_params_,
            random_state=SEED,
            n_jobs=-1,
        )
    )

    rf_validation_model.fit(
        X_internal_train,
        y_internal_train,
    )

    xgb_params = {
        key.replace(
            "estimator__",
            "",
        ): value
        for key, value in (
            xgb_search.best_params_
            .items()
        )
    }

    xgb_validation_model = (
        MultiOutputRegressor(
            XGBRegressor(
                objective="reg:squarederror",
                random_state=SEED,
                n_jobs=1,
                **xgb_params,
            )
        )
    )

    xgb_validation_model.fit(
        X_internal_train,
        y_internal_train,
    )

    rf_val_prediction = (
        rf_validation_model.predict(
            X_internal_val
        )
    )

    xgb_val_prediction = (
        xgb_validation_model.predict(
            X_internal_val
        )
    )

    best_rf_weight = (
        find_best_ensemble_weight(
            y_internal_val,
            rf_val_prediction,
            xgb_val_prediction,
        )
    )

    # Final ensemble on the untouched test set.
    ensemble_prediction = (
        make_weighted_ensemble(
            rf_prediction,
            xgb_prediction,
            best_rf_weight,
        )
    )

    # --------------------------------------------------------
    # Metrics
    # --------------------------------------------------------

    predictions = {
        "Random Forest": rf_prediction,
        "XGBoost": xgb_prediction,
        "RF + XGBoost Ensemble": (
            ensemble_prediction
        ),
    }

    # --------------------------------------------------------
    # Naive persistence baseline
    # --------------------------------------------------------
    test_df = df.loc[test_mask].copy()

    baseline_prediction, baseline_metrics = (
        calculate_baseline_metrics(
            test_df,
            y_test,
        )
    )

    all_metrics = {}

    print("\n" + "=" * 70)
    print("NAIVE PERSISTENCE BASELINE")
    print("=" * 70)
    print(
        baseline_metrics.to_string(index=False)
    )

    print("\n" + "=" * 70)
    print("FINAL TEST RESULTS")
    print("=" * 70)

    for model_name, prediction in (
        predictions.items()
    ):
        metrics = calculate_metrics(
            y_test,
            prediction,
        )

        all_metrics[
            model_name
        ] = metrics

        print(
            f"\n{model_name}"
        )

        print(
            metrics.to_string(
                index=False
            )
        )

    # --------------------------------------------------------
    # Skill relative to naive baseline
    # --------------------------------------------------------

    skill_rows = []

    for model_name, metrics in all_metrics.items():
        for index, target_name in enumerate(TARGET_NAMES):
            baseline_rmse = baseline_metrics["RMSE"].iloc[index]
            model_rmse = metrics["RMSE"].iloc[index]

            skill_rows.append({
                "Model": model_name,
                "Target": target_name,
                "Baseline_RMSE": baseline_rmse,
                "Model_RMSE": model_rmse,
                "RMSE_Skill_%": calculate_skill_score(
                    baseline_rmse,
                    model_rmse,
                ),
            })

    skill_df = pd.DataFrame(skill_rows)

    skill_df.to_csv(
        os.path.join(
            OUTPUT_DIR,
            "baseline_skill.csv",
        ),
        index=False,
    )

    # --------------------------------------------------------
    # Save metrics
    # --------------------------------------------------------

    metric_frames = []

    baseline_for_save = baseline_metrics.copy()
    baseline_for_save.insert(
        0,
        "Model",
        "Naive Persistence",
    )
    metric_frames.append(
        baseline_for_save
    )

    for model_name, metrics in all_metrics.items():
        temp = metrics.copy()

        temp.insert(
            0,
            "Model",
            model_name,
        )

        metric_frames.append(temp)

    all_metrics_df = pd.concat(
        metric_frames,
        ignore_index=True,
    )

    all_metrics_df.to_csv(
        os.path.join(
            OUTPUT_DIR,
            "evaluation_metrics.csv",
        ),
        index=False,
    )

    # --------------------------------------------------------
    # Plots
    # --------------------------------------------------------

    plot_model_comparison(
        all_metrics,
        OUTPUT_DIR,
    )

    ensemble_skill = skill_df[
        skill_df["Model"] == "RF + XGBoost Ensemble"
    ]

    plt.figure(figsize=(10, 5))
    plt.bar(
        ensemble_skill["Target"],
        ensemble_skill["RMSE_Skill_%"],
    )
    plt.axhline(0, linewidth=1)

    plt.ylabel(
        "RMSE improvement over naive baseline (%)"
    )
    plt.title(
        "RF + XGBoost Ensemble Skill vs Naive Baseline"
    )
    plt.xticks(rotation=25, ha="right")
    plt.tight_layout()

    plt.savefig(
        os.path.join(
            OUTPUT_DIR,
            "ensemble_skill_vs_baseline.png",
        ),
        dpi=200,
    )
    plt.close()

    plot_actual_vs_predicted(
        y_test,
        predictions,
        OUTPUT_DIR,
    )

    # --------------------------------------------------------
    # Residual analysis for the final ensemble
    # --------------------------------------------------------

    ensemble_residuals = y_test - ensemble_prediction

    for index, target_name in enumerate(TARGET_NAMES):
        plt.figure(figsize=(8, 5))

        plt.hist(
            ensemble_residuals[:, index],
            bins=40,
        )
        plt.axvline(0, linewidth=1)

        plt.xlabel("Actual - Predicted")
        plt.ylabel("Number of samples")
        plt.title(
            f"Ensemble Residuals: {target_name}"
        )

        plt.tight_layout()
        plt.savefig(
            os.path.join(
                OUTPUT_DIR,
                f"residuals_{index + 1}.png",
            ),
            dpi=200,
        )
        plt.close()

    plot_tuning_results(
        rf_search,
        "Random Forest Hyperparameter Search",
        "random_forest_tuning.png",
        OUTPUT_DIR,
    )

    plot_tuning_results(
        xgb_search,
        "XGBoost Hyperparameter Search",
        "xgboost_tuning.png",
        OUTPUT_DIR,
    )

    plot_feature_importance(
        rf_model,
        feature_columns,
        OUTPUT_DIR,
        "Random Forest",
    )

    plot_feature_importance(
        xgb_model,
        feature_columns,
        OUTPUT_DIR,
        "XGBoost",
    )

    # --------------------------------------------------------
    # Save models
    # --------------------------------------------------------

    with open(
        os.path.join(
            OUTPUT_DIR,
            "random_forest_model.pkl",
        ),
        "wb",
    ) as file:
        pickle.dump(
            {
                "model": rf_model,
                "features": feature_columns,
                "targets": target_columns,
            },
            file,
        )

    with open(
        os.path.join(
            OUTPUT_DIR,
            "xgboost_model.pkl",
        ),
        "wb",
    ) as file:
        pickle.dump(
            {
                "model": xgb_model,
                "features": feature_columns,
                "targets": target_columns,
            },
            file,
        )

    with open(
        os.path.join(
            OUTPUT_DIR,
            "ensemble_config.pkl",
        ),
        "wb",
    ) as file:
        pickle.dump(
            {
                "rf_weight": best_rf_weight,
                "xgb_weight": 1.0 - best_rf_weight,
                "features": feature_columns,
                "targets": target_columns,
            },
            file,
        )

    print(
        f"\nAll results saved to: {OUTPUT_DIR}"
    )


if __name__ == "__main__":
    main()

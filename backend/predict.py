# =========================================================
# predict.py
# MetroFlow AI Inference + Intelligent Scheduling
# =========================================================

# Loads the trained XGBoost model and predicts:
# Entry count: +15, +30, +45 minutes
# Occupancy:   +15, +30, +45 minutes
#
# Also provides:
# 1. Current crowd risk
# 2. Future crowd risk
# 3. Intelligent train scheduling recommendation
# 4. What-if train interval simulation
# 5. AI operational recommendation


import os
import pickle
import numpy as np
import pandas as pd
from datetime import datetime


# Import SAME preprocessing function used during training
from metroflow_train import preprocess_pipeline


# =========================================================
# PATHS
# =========================================================

BASE_DIR = os.path.dirname(
    os.path.abspath(__file__)
)

DATA_PATH = os.path.join(
    BASE_DIR,
    "AI_Metro_Crowd_Management_Dataset_Fixed.csv"
)

MODEL_PATH = os.path.join(
    BASE_DIR,
    "models",
    "metroflow_xgboost_baseline.pkl"
)

PREPROCESSING_PATH = os.path.join(
    BASE_DIR,
    "models",
    "metroflow_preprocessing.pkl"
)


# =========================================================
# STATION SAFE CAPACITY CONFIGURATION
# =========================================================
#
# These values can be changed whenever required.
#
# STN001 = 10 is intentionally kept for TESTING
# overcrowding and AI recommendation behaviour.
#
# Restore the appropriate project capacity after testing.

STATION_CAPACITY = {
    "STN001": 10,
    "STN002": 6000,
    "STN003": 4000,
    "STN004": 3000,
    "STN005": 1800
}


# =========================================================
# TRAIN SCHEDULING CONFIGURATION
# =========================================================

# Current train interval at each station
# in minutes.

TRAIN_INTERVAL = {
    "STN001": 10,
    "STN002": 10,
    "STN003": 10,
    "STN004": 10,
    "STN005": 10
}


# Candidate train intervals that MetroFlow
# will evaluate.

CANDIDATE_INTERVALS = [
    10,
    8,
    6,
    5,
    4
]


# Target maximum occupancy level.

TARGET_OCCUPANCY = 70.0


# =========================================================
# 1. LOAD TRAINED MODEL
# =========================================================

print("[INFO] Loading trained XGBoost model...")

with open(MODEL_PATH, "rb") as f:

    model_payload = pickle.load(f)


xgb_model = model_payload["model"]

model_feature_names = (
    model_payload["feature_names"]
)

target_names = (
    model_payload["target_names"]
)


print("[INFO] Model loaded successfully.")


# =========================================================
# 2. LOAD PREPROCESSING ARTIFACT
# =========================================================

print("[INFO] Loading preprocessing artifact...")

with open(PREPROCESSING_PATH, "rb") as f:

    preprocessing = pickle.load(f)


all_features = (
    preprocessing["all_features"]
)


print("[INFO] Preprocessing artifact loaded.")


# =========================================================
# 3. LOAD DATASET
# =========================================================

print("[INFO] Loading MetroFlow dataset...")

df = pd.read_csv(DATA_PATH)


if "timestamp" not in df.columns:

    raise ValueError(
        "Dataset does not contain 'timestamp' column."
    )


df["timestamp"] = pd.to_datetime(
    df["timestamp"]
)


df = df.sort_values(
    [
        "station_id",
        "timestamp"
    ]
).reset_index(drop=True)


# =========================================================
# 4. APPLY SAME FEATURE ENGINEERING
# =========================================================

print(
    "[INFO] Applying MetroFlow preprocessing..."
)


df = preprocess_pipeline(df)


# =========================================================
# 5. CREATE LAG FEATURES
# =========================================================

for col in (
    "entry_count",
    "occupancy_percentage"
):

    for lag in (1, 2, 3):

        lag_name = (
            f"{col}_lag{lag}"
        )

        df[lag_name] = (
            df.groupby(
                [
                    "station_id",
                    "block_id"
                ]
            )[col]
            .shift(lag)
        )


# =========================================================
# 6. CHECK REQUIRED FEATURES
# =========================================================

required_prediction_features = list(
    model_feature_names
)


missing_features = [
    col
    for col in required_prediction_features
    if col not in df.columns
]


if missing_features:

    raise ValueError(
        "The following model features are missing "
        "from the input data:\n"
        + "\n".join(missing_features)
    )


# =========================================================
# 7. CHOOSE STATION
# =========================================================

print("\nAvailable stations:")


stations = sorted(
    df["station_id"]
    .dropna()
    .astype(str)
    .unique()
)


for i, station in enumerate(
    stations,
    start=1
):

    print(
        f"{i}. {station}"
    )


station_id = input(
    "\nEnter station_id to predict: "
).strip()


if station_id not in stations:

    raise ValueError(
        f"Station '{station_id}' was not found "
        "in the dataset."
    )


# =========================================================
# 8. GET LATEST VALID ROW
# =========================================================

station_df = df[
    df["station_id"].astype(str)
    == station_id
].copy()


station_df = station_df.sort_values(
    "timestamp"
)


valid_station_df = (
    station_df.dropna(
        subset=required_prediction_features
    )
)


if valid_station_df.empty:

    raise ValueError(
        f"No valid prediction row is available "
        f"for station {station_id}. "
        "At least 3 previous 15-minute records "
        "are required."
    )


latest_row = (
    valid_station_df.iloc[-1]
)


# =========================================================
# 9. CURRENT TIME
# =========================================================

prediction_time = datetime.now()


# =========================================================
# 10. STATION CAPACITY
# =========================================================

current_occupancy = float(
    latest_row["current_occupancy"]
)


if station_id not in STATION_CAPACITY:

    raise ValueError(
        f"No safe capacity configured for "
        f"station {station_id}."
    )


max_safe_occupancy = (
    STATION_CAPACITY[station_id]
)


# Keep the configured capacity above for current-risk testing.
# Use the dataset's original capacity for converting the ML
# occupancy forecast into predicted people.

if "max_safe_occupancy" not in latest_row.index:

    raise ValueError(
        "Dataset does not contain 'max_safe_occupancy'."
    )


dataset_capacity = float(
    latest_row["max_safe_occupancy"]
)


if dataset_capacity <= 0:

    raise ValueError(
        "Invalid dataset max_safe_occupancy."
    )


if max_safe_occupancy <= 0:

    raise ValueError(
        "Invalid max_safe_occupancy."
    )


# Current station utilization

current_utilization = (
    current_occupancy
    / max_safe_occupancy
) * 100


# =========================================================
# 11. PREPARE MODEL INPUT
# =========================================================

X_input = pd.DataFrame(
    [
        latest_row[
            required_prediction_features
        ].to_dict()
    ],
    columns=required_prediction_features
)


# XGBoost was trained using numerical features

X_input = X_input.astype(float)


# =========================================================
# 12. MAKE XGBOOST PREDICTION
# =========================================================

print(
    "\n[INFO] Generating prediction..."
)


prediction = xgb_model.predict(
    X_input
)


prediction = np.asarray(
    prediction
).reshape(-1)


if len(prediction) != len(target_names):

    raise ValueError(
        f"Expected {len(target_names)} "
        f"predictions, but model returned "
        f"{len(prediction)}."
    )


# =========================================================
# 13. CREATE RESULT DICTIONARY
# =========================================================

result = dict(
    zip(
        target_names,
        prediction
    )
)


# =========================================================
# 14. EXTRACT OCCUPANCY FORECAST
# =========================================================

predicted_occupancy_15 = result[
    "occupancy_percentage_t+15min"
]


predicted_occupancy_30 = result[
    "occupancy_percentage_t+30min"
]


predicted_occupancy_45 = result[
    "occupancy_percentage_t+45min"
]


# Convert model occupancy ratio
# into percentage

occupancy_15 = (
    predicted_occupancy_15 * 100
)


occupancy_30 = (
    predicted_occupancy_30 * 100
)


occupancy_45 = (
    predicted_occupancy_45 * 100
)


# =========================================================
# 15. PREDICTED PEOPLE
# =========================================================

predicted_people_15 = round(
    predicted_occupancy_15
    * dataset_capacity
)


predicted_people_30 = round(
    predicted_occupancy_30
    * dataset_capacity
)


predicted_people_45 = round(
    predicted_occupancy_45
    * dataset_capacity
)


# =========================================================
# 16. CROWD RISK FUNCTION
# =========================================================

def get_crowd_risk(
    occupancy_ratio
):

    percentage = (
        occupancy_ratio * 100
    )


    if percentage < 50:

        return "LOW"


    elif percentage < 70:

        return "MODERATE"


    elif percentage < 85:

        return "HIGH"


    else:

        return "CRITICAL"


# Future risks

risk_15 = get_crowd_risk(
    predicted_occupancy_15
)


risk_30 = get_crowd_risk(
    predicted_occupancy_30
)


risk_45 = get_crowd_risk(
    predicted_occupancy_45
)


# =========================================================
# 17. CURRENT CROWD RISK
# =========================================================

if current_utilization >= 100:

    current_risk = "CRITICAL"


elif current_utilization >= 85:

    current_risk = "HIGH"


elif current_utilization >= 70:

    current_risk = "MODERATE"


else:

    current_risk = "LOW"


# =========================================================
# 18. INTELLIGENT SCHEDULING FUNCTION
# =========================================================

def recommend_train_schedule(
    predicted_occupancies,
    current_interval,
    current_risk,
    current_utilization
):

    forecast_peak = max(predicted_occupancies)

    # If the station is already critical, recommend the
    # strongest available frequency. Do NOT invent an exact
    # post-schedule occupancy because the trained model has
    # not learned the causal effect of train frequency.

    if current_risk == "CRITICAL":

        emergency_interval = min(
            CANDIDATE_INTERVALS
        )

        return {
            "recommended_interval":
                emergency_interval,

            "action":
                "EMERGENCY_INCREASE",

            "peak_occupancy":
                round(
                    max(
                        current_utilization,
                        forecast_peak
                    ),
                    2
                ),

            "forecast_peak_occupancy":
                round(
                    forecast_peak,
                    2
                ),

            "estimated_occupancy_after_change":
                None,

            "reason":
                (
                    f"Current utilization is "
                    f"{current_utilization:.2f}%, which is "
                    f"CRITICAL. Reduce the train interval from "
                    f"{current_interval} to "
                    f"{emergency_interval} minutes and activate "
                    f"crowd-control measures. The exact "
                    f"post-change occupancy cannot be estimated "
                    f"reliably without historical train-frequency "
                    f"response data."
                )
        }

    if forecast_peak < 50:

        return {
            "recommended_interval":
                current_interval,

            "action":
                "MAINTAIN",

            "peak_occupancy":
                round(
                    forecast_peak,
                    2
                ),

            "forecast_peak_occupancy":
                round(
                    forecast_peak,
                    2
                ),

            "estimated_occupancy_after_change":
                None,

            "reason":
                (
                    "Forecasted crowd is low. "
                    "Current train frequency is sufficient."
                )
        }

    if forecast_peak < TARGET_OCCUPANCY:

        return {
            "recommended_interval":
                current_interval,

            "action":
                "MONITOR",

            "peak_occupancy":
                round(
                    forecast_peak,
                    2
                ),

            "forecast_peak_occupancy":
                round(
                    forecast_peak,
                    2
                ),

            "estimated_occupancy_after_change":
                None,

            "reason":
                (
                    "Forecasted crowd is moderate. "
                    "Continue monitoring passenger flow."
                )
        }

    recommended_interval = min(
        CANDIDATE_INTERVALS
    )

    if forecast_peak < 85:

        action = "INCREASE_FREQUENCY"

        reason = (
            f"Forecasted peak occupancy is "
            f"{forecast_peak:.2f}%. Increase train "
            f"frequency by reducing the interval from "
            f"{current_interval} to "
            f"{recommended_interval} minutes."
        )

    else:

        action = "EMERGENCY_INCREASE"

        reason = (
            f"Forecasted peak occupancy is "
            f"{forecast_peak:.2f}%. Use the highest "
            f"available train frequency with a "
            f"{recommended_interval}-minute interval "
            f"and activate crowd-control measures."
        )

    return {
        "recommended_interval":
            recommended_interval,

        "action":
            action,

        "peak_occupancy":
            round(
                forecast_peak,
                2
            ),

        "forecast_peak_occupancy":
            round(
                forecast_peak,
                2
            ),

        "estimated_occupancy_after_change":
            None,

        "reason":
            reason
    }


# =========================================================
# 19. CURRENT TRAIN INTERVAL
# =========================================================

current_train_interval = (
    TRAIN_INTERVAL.get(
        station_id,
        10
    )
)


# =========================================================
# 20. RUN SCHEDULING OPTIMIZER
# =========================================================

scheduling_result = (
    recommend_train_schedule(
        [
            occupancy_15,
            occupancy_30,
            occupancy_45
        ],
        current_train_interval,
        current_risk,
        current_utilization
    )
)


# =========================================================
# 21. AI RECOMMENDATION
# =========================================================

risk_levels = {

    "LOW": 0,

    "MODERATE": 1,

    "HIGH": 2,

    "CRITICAL": 3
}


highest_risk = max(

    [
        current_risk,
        risk_15,
        risk_30,
        risk_45
    ],

    key=lambda x:
        risk_levels[x]
)


# ---------------------------------------------------------
# Base recommendation
# ---------------------------------------------------------

if highest_risk == "LOW":

    recommendation = (
        "Normal operation. "
        "No immediate intervention required."
    )


elif highest_risk == "MODERATE":

    recommendation = (
        "Moderate crowding detected. "
        "Monitor passenger flow and prepare "
        "for increasing demand."
    )


elif highest_risk == "HIGH":

    recommendation = (
        "High crowding detected. "
        "Increase monitoring and consider "
        "increasing train frequency."
    )


else:

    recommendation = (
        "CRITICAL overcrowding detected. "
        "Immediate crowd-control action required."
    )


# ---------------------------------------------------------
# Add scheduling recommendation
# ---------------------------------------------------------

if scheduling_result["action"] in [

    "INCREASE_FREQUENCY",

    "EMERGENCY_INCREASE"

]:

    recommendation += (

        " Recommended train interval: "

        + str(
            scheduling_result[
                "recommended_interval"
            ]
        )

        + " minutes."

    )


elif scheduling_result["action"] == "MONITOR":

    recommendation += (
        " Continue monitoring the station."
    )


# =========================================================
# 22. DISPLAY RESULTS
# =========================================================

print("\n" + "=" * 60)

print(
    "                 METROFLOW PREDICTION"
)

print("=" * 60)


print(
    f"Station       : {station_id}"
)


print(
    f"Input time    : {prediction_time}"
)


print("-" * 60)


# ---------------------------------------------------------
# Entry forecast
# ---------------------------------------------------------

print(
    f"Entry +15 min : "
    f"{round(result['entry_count_t+15min'])}"
)


print(
    f"Entry +30 min : "
    f"{round(result['entry_count_t+30min'])}"
)


print(
    f"Entry +45 min : "
    f"{round(result['entry_count_t+45min'])}"
)


print("-" * 60)


# ---------------------------------------------------------
# Occupancy forecast
# ---------------------------------------------------------

print(
    f"Occupancy +15 : "
    f"{occupancy_15:.2f}%"
)


print(
    f"Occupancy +30 : "
    f"{occupancy_30:.2f}%"
)


print(
    f"Occupancy +45 : "
    f"{occupancy_45:.2f}%"
)


print("-" * 60)


# ---------------------------------------------------------
# Current station information
# ---------------------------------------------------------

print(
    f"Current occupancy : "
    f"{round(current_occupancy)} people"
)


print(
    f"Safe capacity     : "
    f"{max_safe_occupancy} people"
)


print(
    f"Model base capacity: "
    f"{round(dataset_capacity)} people"
)


print(
    f"Current utilization: "
    f"{current_utilization:.2f}%"
)


print(
    f"Current risk       : "
    f"{current_risk}"
)


print("-" * 60)


# ---------------------------------------------------------
# Predicted people
# ---------------------------------------------------------

print(
    f"Predicted people +15 : "
    f"{predicted_people_15}"
)


print(
    f"Predicted people +30 : "
    f"{predicted_people_30}"
)


print(
    f"Predicted people +45 : "
    f"{predicted_people_45}"
)


print("-" * 60)


# ---------------------------------------------------------
# Future crowd risk
# ---------------------------------------------------------

print(
    f"Crowd risk +15 : "
    f"{risk_15}"
)


print(
    f"Crowd risk +30 : "
    f"{risk_30}"
)


print(
    f"Crowd risk +45 : "
    f"{risk_45}"
)


print("-" * 60)


# ---------------------------------------------------------
# Intelligent scheduling
# ---------------------------------------------------------

print(
    "INTELLIGENT SCHEDULING"
)


print(
    f"Current train interval : "
    f"{current_train_interval} minutes"
)


print(
    f"Recommended interval   : "
    f"{scheduling_result['recommended_interval']} minutes"
)


print(
    f"Scheduling action      : "
    f"{scheduling_result['action']}"
)


print(
    f"Peak occupancy         : "
    f"{scheduling_result['peak_occupancy']:.2f}%"
)


print(
    f"Reason                 : "
    f"{scheduling_result['reason']}"
)


print("-" * 60)


# ---------------------------------------------------------
# AI recommendation
# ---------------------------------------------------------

print(
    "AI Recommendation:"
)


print(
    recommendation
)


print("=" * 60)


# =========================================================
# 23. SAVE COMPLETE RESULT
# =========================================================

output = pd.DataFrame(
    [
        {

            # -------------------------------------------------
            # Station
            # -------------------------------------------------

            "station_id":
                station_id,

            "input_timestamp":
                prediction_time,


            # -------------------------------------------------
            # Entry forecast
            # -------------------------------------------------

            "entry_count_t+15min":
                round(
                    result[
                        "entry_count_t+15min"
                    ]
                ),

            "entry_count_t+30min":
                round(
                    result[
                        "entry_count_t+30min"
                    ]
                ),

            "entry_count_t+45min":
                round(
                    result[
                        "entry_count_t+45min"
                    ]
                ),


            # -------------------------------------------------
            # Occupancy forecast
            # -------------------------------------------------

            "occupancy_percentage_t+15min":
                round(
                    occupancy_15,
                    2
                ),

            "occupancy_percentage_t+30min":
                round(
                    occupancy_30,
                    2
                ),

            "occupancy_percentage_t+45min":
                round(
                    occupancy_45,
                    2
                ),


            # -------------------------------------------------
            # Current station status
            # -------------------------------------------------

            "current_occupancy":
                round(
                    current_occupancy
                ),

            "max_safe_occupancy":
                max_safe_occupancy,

            "dataset_max_safe_occupancy":
                dataset_capacity,

            "current_utilization_percentage":
                round(
                    current_utilization,
                    2
                ),

            "current_risk":
                current_risk,


            # -------------------------------------------------
            # Predicted people
            # -------------------------------------------------

            "predicted_people_t+15min":
                predicted_people_15,

            "predicted_people_t+30min":
                predicted_people_30,

            "predicted_people_t+45min":
                predicted_people_45,


            # -------------------------------------------------
            # Future risk
            # -------------------------------------------------

            "crowd_risk_t+15min":
                risk_15,

            "crowd_risk_t+30min":
                risk_30,

            "crowd_risk_t+45min":
                risk_45,


            # -------------------------------------------------
            # Scheduling
            # -------------------------------------------------

            "current_train_interval_minutes":
                current_train_interval,

            "recommended_train_interval_minutes":
                scheduling_result[
                    "recommended_interval"
                ],

            "scheduling_action":
                scheduling_result[
                    "action"
                ],

            "scheduling_peak_occupancy":
                scheduling_result[
                    "peak_occupancy"
                ],

            "forecast_peak_occupancy":
                scheduling_result[
                    "forecast_peak_occupancy"
                ],

            "scheduling_reason":
                scheduling_result[
                    "reason"
                ],


            # -------------------------------------------------
            # AI recommendation
            # -------------------------------------------------

            "ai_recommendation":
                recommendation
        }
    ]
)


# =========================================================
# 24. SAVE CSV
# =========================================================

output_path = os.path.join(
    BASE_DIR,
    "prediction_result.csv"
)


output.to_csv(
    output_path,
    index=False
)


print(
    "\n[INFO] Prediction saved to:"
)


print(
    output_path
)
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import subprocess
import os
import sys
import pandas as pd


# =========================================================
# 1. FASTAPI APPLICATION
# =========================================================

app = FastAPI(
    title="MetroFlow AI Prediction API",
    description="AI-powered metro crowd prediction and intelligent train scheduling API",
    version="1.0"
)


# =========================================================
# 2. CORS CONFIGURATION
# =========================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================================
# 3. REQUEST MODEL
# =========================================================

class PredictionRequest(BaseModel):
    station_id: str


# =========================================================
# 4. HOME ENDPOINT
# =========================================================

@app.get("/")
def home():
    return {
        "message": "MetroFlow AI Prediction API is running"
    }


# =========================================================
# 5. STATIONS ENDPOINT
#    Reads REAL Kaggle dataset
# =========================================================

@app.get("/stations")
def get_stations():

    base_dir = os.path.dirname(
        os.path.abspath(__file__)
    )

    dataset_path = os.path.join(
        base_dir,
        "AI_Metro_Crowd_Management_Dataset_Fixed.csv"
    )

    try:

        # -------------------------------------------------
        # Load Kaggle dataset
        # -------------------------------------------------

        df = pd.read_csv(dataset_path)

        # -------------------------------------------------
        # Check required columns
        # -------------------------------------------------

        required_columns = [
            "station_id",
            "station_name",
            "timestamp",
            "entry_count",
            "occupancy_percentage"
        ]

        missing_columns = [
            column
            for column in required_columns
            if column not in df.columns
        ]

        if missing_columns:

            raise HTTPException(
                status_code=500,
                detail=(
                    "Missing required columns in dataset: "
                    + ", ".join(missing_columns)
                )
            )

        # -------------------------------------------------
        # Convert timestamp
        # -------------------------------------------------

        df["timestamp"] = pd.to_datetime(
            df["timestamp"],
            errors="coerce"
        )

        # -------------------------------------------------
        # Remove rows without valid station IDs
        # -------------------------------------------------

        df = df.dropna(
            subset=["station_id"]
        )

        # -------------------------------------------------
        # Sort by timestamp
        # -------------------------------------------------

        df = df.sort_values(
            "timestamp"
        )

        # -------------------------------------------------
        # Get latest record for every station
        # -------------------------------------------------

        latest = (
            df.drop_duplicates(
                subset=["station_id"],
                keep="last"
            )
        )

        stations = []

        # -------------------------------------------------
        # Convert every station to frontend format
        # -------------------------------------------------

        for _, row in latest.iterrows():

            station_id = str(
                row["station_id"]
            )

            station_name = str(
                row["station_name"]
            )

            # ---------------------------------------------
            # Occupancy
            # ---------------------------------------------

            occupancy = float(
                row.get(
                    "occupancy_percentage",
                    0
                )
            )

            # Keep occupancy between 0 and 100

            occupancy = max(
                0,
                min(
                    100,
                    occupancy
                )
            )

            # ---------------------------------------------
            # Crowd status
            # ---------------------------------------------

            if occupancy >= 85:

                status = "critical"
                status_label = "Critical"

            elif occupancy >= 70:

                status = "high"
                status_label = "High"

            elif occupancy >= 50:

                status = "moderate"
                status_label = "Moderate"

            else:

                status = "smooth"
                status_label = "Smooth"

            # ---------------------------------------------
            # Current crowd
            # ---------------------------------------------

            current_crowd = int(
                round(
                    float(
                        row.get(
                            "entry_count",
                            0
                        )
                    )
                )
            )

            # ---------------------------------------------
            # Waiting time
            # ---------------------------------------------

            waiting_time = float(
                row.get(
                    "avg_wait_time_platform",
                    0
                )
            )

            # ---------------------------------------------
            # Safe occupancy
            # ---------------------------------------------

            max_safe_occupancy = float(
                row.get(
                    "max_safe_occupancy",
                    0
                )
            )

            # ---------------------------------------------
            # Train frequency
            # ---------------------------------------------

            current_train_frequency = float(
                row.get(
                    "current_train_frequency",
                    0
                )
            )

            # ---------------------------------------------
            # Create station object
            # ---------------------------------------------

            stations.append({

                "id": station_id,

                "name": station_name,

                "city": str(
                    row.get(
                        "city",
                        ""
                    )
                ),

                "line": str(
                    row.get(
                        "line_name",
                        ""
                    )
                ),

                "metroLineId": str(
                    row.get(
                        "metro_line_id",
                        ""
                    )
                ),

                "occupancy": round(
                    occupancy,
                    2
                ),

                "currentCrowd": current_crowd,

                "waitingTime": round(
                    waiting_time,
                    1
                ),

                "status": status,

                "statusLabel": status_label,

                "timestamp": str(
                    row["timestamp"]
                ),

                "maxSafeOccupancy": max_safe_occupancy,

                "crowdDensityLevel": str(
                    row.get(
                        "crowd_density_level",
                        ""
                    )
                ),

                "currentTrainFrequency":
                    current_train_frequency
            })

        # -------------------------------------------------
        # Return data to React
        # -------------------------------------------------

        return {
            "stations": stations,
            "total_stations": len(stations)
        }

    except FileNotFoundError:

        raise HTTPException(
            status_code=500,
            detail=(
                "Kaggle dataset file not found: "
                "AI_Metro_Crowd_Management_Dataset_Fixed.csv"
            )
        )

    except HTTPException:

        raise

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


# =========================================================
# 6. INTELLIGENT TRAIN SCHEDULING
# =========================================================

def intelligent_train_scheduling(
    current_utilization,
    occupancy_15,
    occupancy_30,
    occupancy_45,
    current_train_interval=10
):
    """
    Intelligent train scheduling based on:

    1. Current station utilization
    2. Forecasted occupancy
    3. Peak predicted occupancy

    Occupancy values are percentages.
    """

    # -----------------------------------------------------
    # Find highest predicted occupancy
    # -----------------------------------------------------

    peak_occupancy = max(
        occupancy_15,
        occupancy_30,
        occupancy_45
    )

    # -----------------------------------------------------
    # CRITICAL CURRENT CROWD
    # -----------------------------------------------------

    if current_utilization >= 100:

        recommended_interval = 4

        scheduling_action = "EMERGENCY_INCREASE"

        reason = (
            f"Current station utilization is "
            f"{current_utilization:.2f}%, which exceeds "
            f"the safe capacity. Immediate increase in "
            f"train frequency is required."
        )

    # -----------------------------------------------------
    # VERY HIGH FORECAST
    # -----------------------------------------------------

    elif peak_occupancy >= 85:

        recommended_interval = 4

        scheduling_action = "EMERGENCY_INCREASE"

        reason = (
            f"Predicted peak occupancy is "
            f"{peak_occupancy:.2f}%. Very high crowd "
            f"levels are expected. Increase train frequency "
            f"to every {recommended_interval} minutes."
        )

    # -----------------------------------------------------
    # HIGH FORECAST
    # -----------------------------------------------------

    elif peak_occupancy >= 70:

        recommended_interval = 6

        scheduling_action = "INCREASE_FREQUENCY"

        reason = (
            f"Predicted peak occupancy is "
            f"{peak_occupancy:.2f}%. High crowd levels "
            f"are expected. Reduce train interval to "
            f"{recommended_interval} minutes."
        )

    # -----------------------------------------------------
    # MODERATE FORECAST
    # -----------------------------------------------------

    elif peak_occupancy >= 50:

        recommended_interval = 8

        scheduling_action = "MODERATE_INCREASE"

        reason = (
            f"Predicted peak occupancy is "
            f"{peak_occupancy:.2f}%. Moderate crowd "
            f"levels are expected. Increase train "
            f"frequency moderately to every "
            f"{recommended_interval} minutes."
        )

    # -----------------------------------------------------
    # LOW CROWD
    # -----------------------------------------------------

    else:

        recommended_interval = current_train_interval

        scheduling_action = "MAINTAIN"

        reason = (
            f"Predicted peak occupancy is "
            f"{peak_occupancy:.2f}%. Crowd levels "
            f"are manageable. Maintain the current "
            f"train interval of "
            f"{current_train_interval} minutes."
        )

    # -----------------------------------------------------
    # Return scheduling decision
    # -----------------------------------------------------

    return {

        "current_train_interval": int(
            current_train_interval
        ),

        "recommended_train_interval": int(
            recommended_interval
        ),

        "scheduling_action":
            scheduling_action,

        "peak_predicted_occupancy":
            round(
                peak_occupancy,
                2
            ),

        "reason":
            reason
    }


# =========================================================
# 7. CROWD RISK FUNCTION
# =========================================================

def calculate_crowd_risk(
    predicted_occupancy,
    current_utilization
):
    """
    Calculate crowd risk using predicted occupancy
    and current station utilization.
    """

    # Current station already exceeds capacity

    if current_utilization >= 100:

        return "CRITICAL"

    # Very high predicted occupancy

    if predicted_occupancy >= 85:

        return "CRITICAL"

    # High predicted occupancy

    if predicted_occupancy >= 70:

        return "HIGH"

    # Moderate predicted occupancy

    if predicted_occupancy >= 50:

        return "MODERATE"

    # Otherwise

    return "LOW"


# =========================================================
# 8. AI RECOMMENDATION FUNCTION
# =========================================================

def generate_ai_recommendation(
    current_utilization,
    peak_occupancy,
    scheduling_action,
    recommended_interval
):

    # -----------------------------------------------------
    # CRITICAL
    # -----------------------------------------------------

    if current_utilization >= 100:

        return (
            "CRITICAL overcrowding detected. "
            "Immediate crowd-control action is required. "
            f"Recommended train interval: "
            f"{recommended_interval} minutes."
        )

    # -----------------------------------------------------
    # VERY HIGH
    # -----------------------------------------------------

    if peak_occupancy >= 85:

        return (
            "Very high crowd level predicted. "
            "Increase train frequency and activate "
            "crowd-management measures. "
            f"Recommended train interval: "
            f"{recommended_interval} minutes."
        )

    # -----------------------------------------------------
    # HIGH
    # -----------------------------------------------------

    if peak_occupancy >= 70:

        return (
            "High crowd level predicted. "
            "Increase train frequency to reduce "
            "expected platform congestion. "
            f"Recommended train interval: "
            f"{recommended_interval} minutes."
        )

    # -----------------------------------------------------
    # MODERATE
    # -----------------------------------------------------

    if peak_occupancy >= 50:

        return (
            "Moderate crowd level predicted. "
            "A moderate increase in train frequency "
            f"is recommended. Recommended interval: "
            f"{recommended_interval} minutes."
        )

    # -----------------------------------------------------
    # LOW
    # -----------------------------------------------------

    return (
        "Normal operation. "
        "No immediate intervention required."
    )


# =========================================================
# 9. PREDICTION ENDPOINT
# =========================================================

@app.post("/predict")
def predict(request: PredictionRequest):

    station_id = request.station_id.strip()

    if not station_id:

        raise HTTPException(
            status_code=400,
            detail="station_id is required"
        )

    # -----------------------------------------------------
    # Project directory
    # -----------------------------------------------------

    base_dir = os.path.dirname(
        os.path.abspath(__file__)
    )

    prediction_file = os.path.join(
        base_dir,
        "prediction_result.csv"
    )

    try:

        # =================================================
        # RUN ML PREDICTION PIPELINE
        # =================================================

        result = subprocess.run(
            [
                sys.executable,
                "predict.py"
            ],
            input=station_id + "\n",
            text=True,
            capture_output=True,
            cwd=base_dir,
            timeout=120
        )

        # -------------------------------------------------
        # Check prediction process
        # -------------------------------------------------

        if result.returncode != 0:

            raise HTTPException(
                status_code=500,
                detail=result.stderr
            )

        # -------------------------------------------------
        # Check prediction file
        # -------------------------------------------------

        if not os.path.exists(
            prediction_file
        ):

            raise HTTPException(
                status_code=500,
                detail=(
                    "Prediction result file "
                    "was not created."
                )
            )

        # =================================================
        # READ PREDICTION
        # =================================================

        df = pd.read_csv(
            prediction_file
        )

        if df.empty:

            raise HTTPException(
                status_code=500,
                detail="Prediction result is empty."
            )

        row = df.iloc[0]

        # =================================================
        # BASIC VALUES
        # =================================================

        station = str(
            row["station_id"]
        )

        timestamp = str(
            row["input_timestamp"]
        )

        # =================================================
        # ENTRY FORECAST
        # INTEGER
        # =================================================

        entry_15 = int(
            round(
                float(
                    row[
                        "entry_count_t+15min"
                    ]
                )
            )
        )

        entry_30 = int(
            round(
                float(
                    row[
                        "entry_count_t+30min"
                    ]
                )
            )
        )

        entry_45 = int(
            round(
                float(
                    row[
                        "entry_count_t+45min"
                    ]
                )
            )
        )

        # =================================================
        # OCCUPANCY FORECAST
        #
        # predict.py already produces occupancy
        # in percentage form.
        #
        # DO NOT multiply by 100 here.
        # =================================================

        occupancy_15 = round(
            float(
                row[
                    "occupancy_percentage_t+15min"
                ]
            ),
            2
        )

        occupancy_30 = round(
            float(
                row[
                    "occupancy_percentage_t+30min"
                ]
            ),
            2
        )

        occupancy_45 = round(
            float(
                row[
                    "occupancy_percentage_t+45min"
                ]
            ),
            2
        )

        # =================================================
        # CURRENT STATUS
        # =================================================

        current_occupancy = int(
            round(
                float(
                    row[
                        "current_occupancy"
                    ]
                )
            )
        )

        max_safe_occupancy = int(
            round(
                float(
                    row[
                        "max_safe_occupancy"
                    ]
                )
            )
        )

        current_utilization = round(
            float(
                row[
                    "current_utilization_percentage"
                ]
            ),
            2
        )

        # =================================================
        # PREDICTED PEOPLE
        # INTEGER
        # =================================================

        predicted_people_15 = int(
            round(
                float(
                    row[
                        "predicted_people_t+15min"
                    ]
                )
            )
        )

        predicted_people_30 = int(
            round(
                float(
                    row[
                        "predicted_people_t+30min"
                    ]
                )
            )
        )

        predicted_people_45 = int(
            round(
                float(
                    row[
                        "predicted_people_t+45min"
                    ]
                )
            )
        )

        # =================================================
        # PEAK FORECAST
        # =================================================

        peak_occupancy = max(
            occupancy_15,
            occupancy_30,
            occupancy_45
        )

        # =================================================
        # CURRENT RISK
        # =================================================

        current_risk = calculate_crowd_risk(
            peak_occupancy,
            current_utilization
        )

        # =================================================
        # FORECAST RISKS
        # =================================================

        risk_15 = calculate_crowd_risk(
            occupancy_15,
            current_utilization
        )

        risk_30 = calculate_crowd_risk(
            occupancy_30,
            current_utilization
        )

        risk_45 = calculate_crowd_risk(
            occupancy_45,
            current_utilization
        )

        # =================================================
        # CURRENT TRAIN INTERVAL
        # =================================================

        current_train_interval = 10

        # =================================================
        # INTELLIGENT TRAIN SCHEDULING
        # =================================================

        scheduling = intelligent_train_scheduling(

            current_utilization,

            occupancy_15,

            occupancy_30,

            occupancy_45,

            current_train_interval
        )

        recommended_interval = (
            scheduling[
                "recommended_train_interval"
            ]
        )

        # =================================================
        # AI RECOMMENDATION
        # =================================================

        ai_recommendation = (
            generate_ai_recommendation(

                current_utilization,

                peak_occupancy,

                scheduling[
                    "scheduling_action"
                ],

                recommended_interval
            )
        )

        # =================================================
        # RETURN JSON
        # =================================================

        return {

            # ---------------------------------------------
            # Station
            # ---------------------------------------------

            "station_id":
                station,

            "input_timestamp":
                timestamp,

            # ---------------------------------------------
            # Entry Forecast
            # ---------------------------------------------

            "entry_forecast": {

                "15_min":
                    entry_15,

                "30_min":
                    entry_30,

                "45_min":
                    entry_45
            },

            # ---------------------------------------------
            # Occupancy Forecast
            # Percentage
            # ---------------------------------------------

            "occupancy_forecast": {

                "15_min":
                    occupancy_15,

                "30_min":
                    occupancy_30,

                "45_min":
                    occupancy_45
            },

            # ---------------------------------------------
            # Current Status
            # ---------------------------------------------

            "current_status": {

                "current_occupancy":
                    current_occupancy,

                "max_safe_occupancy":
                    max_safe_occupancy,

                "current_utilization_percentage":
                    current_utilization,

                "current_risk":
                    current_risk
            },

            # ---------------------------------------------
            # Predicted People
            # ---------------------------------------------

            "predicted_people": {

                "15_min":
                    predicted_people_15,

                "30_min":
                    predicted_people_30,

                "45_min":
                    predicted_people_45
            },

            # ---------------------------------------------
            # Crowd Risk
            # ---------------------------------------------

            "crowd_risk": {

                "15_min":
                    risk_15,

                "30_min":
                    risk_30,

                "45_min":
                    risk_45
            },

            # ---------------------------------------------
            # Intelligent Scheduling
            # ---------------------------------------------

            "intelligent_scheduling": {

                "current_train_interval_minutes":
                    scheduling[
                        "current_train_interval"
                    ],

                "recommended_train_interval_minutes":
                    scheduling[
                        "recommended_train_interval"
                    ],

                "scheduling_action":
                    scheduling[
                        "scheduling_action"
                    ],

                "peak_predicted_occupancy_percentage":
                    scheduling[
                        "peak_predicted_occupancy"
                    ],

                "reason":
                    scheduling[
                        "reason"
                    ]
            },

            # ---------------------------------------------
            # AI Recommendation
            # ---------------------------------------------

            "ai_recommendation":
                ai_recommendation
        }

    # =====================================================
    # ERROR HANDLING
    # =====================================================

    except subprocess.TimeoutExpired:

        raise HTTPException(
            status_code=504,
            detail="Prediction timed out."
        )

    except HTTPException:

        raise

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database.database import get_db
from app.models import AiPrediction, Station

router = APIRouter(prefix="/ai", tags=["AI Predictive Analytics"])

@router.get("/predictions/{city_id}")
def get_ai_predictions(city_id: str, db: Session = Depends(get_db)):
    pred = db.query(AiPrediction).filter(AiPrediction.city_id == city_id).first()
    if not pred:
        # Fallback to computing from station occupancy
        top_st = db.query(Station).filter(Station.city_id == city_id).order_by(Station.occupancy.desc()).first()
        peak_name = top_st.name if top_st else "Central Station"
        return {
            "peakStation": peak_name,
            "futureCrowd": [],
            "suggestedFrequency": "4 min",
            "confidence": 88,
            "congestionTrend": "stable"
        }
    return {
        "peakStation": pred.peak_station,
        "futureCrowd": pred.future_crowd,
        "suggestedFrequency": pred.suggested_frequency,
        "confidence": pred.confidence,
        "congestionTrend": pred.congestion_trend
    }

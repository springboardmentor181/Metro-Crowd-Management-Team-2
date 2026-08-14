from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database.database import get_db
from app.models import AnalyticsData, User, Station, Train

router = APIRouter(prefix="/admin", tags=["Admin Management & Analytics"])

@router.get("/analytics/{city_id}")
def get_analytics(city_id: str, db: Session = Depends(get_db)):
    data = db.query(AnalyticsData).filter(AnalyticsData.city_id == city_id).first()
    if not data:
        raise HTTPException(status_code=404, detail="Analytics data not found.")
    return {
        "hourlyFlow": data.hourly_flow,
        "weekly": data.weekly,
        "monthly": data.monthly
    }

@router.get("/users")
def get_users(db: Session = Depends(get_db)):
    users = db.query(User).all()
    return [
        {
            "id": u.id,
            "name": u.name,
            "role": u.role,
            "email": u.email,
            "phone": u.phone or "",
            "status": u.status,
            "dateJoined": u.date_joined.isoformat() if u.date_joined else None
        } for u in users
    ]

@router.put("/users/{user_id}/status")
def update_user_status(user_id: str, status: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    user.status = status
    db.commit()
    return {"message": f"User status updated to {status}."}

@router.get("/reports/{city_id}")
def get_reports_summary(city_id: str, db: Session = Depends(get_db)):
    total_stations = db.query(Station).filter(Station.city_id == city_id).count()
    crowded_stations = db.query(Station).filter(Station.city_id == city_id, Station.occupancy >= 65).count()
    total_trains = db.query(Train).filter(Train.city_id == city_id).count()
    active_trains = db.query(Train).filter(Train.city_id == city_id, Train.status == "Running").count()

    return {
        "cityId": city_id,
        "totalStations": total_stations,
        "crowdedStations": crowded_stations,
        "totalTrains": total_trains,
        "activeTrains": active_trains,
        "efficiencyScore": "94%",
        "peakCongestionWindow": "08:15 AM - 09:45 AM"
    }

import random
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database.database import get_db
from app.models import Station
from app.schemas.schemas import JourneyPlanRequest

router = APIRouter(prefix="/journey", tags=["Journey Planner"])

@router.post("/plan")
def plan_journey(payload: JourneyPlanRequest, db: Session = Depends(get_db)):
    origin = db.query(Station).filter(Station.id == payload.originStationId).first()
    dest = db.query(Station).filter(Station.id == payload.destinationStationId).first()

    if not origin or not dest:
        raise HTTPException(status_code=400, detail="Invalid origin or destination station.")

    # Calculate distance and estimated travel time
    stations_in_city = db.query(Station).filter(Station.city_id == payload.cityId).all()

    pos1 = origin.position_in_line
    pos2 = dest.position_in_line
    stops_count = max(1, abs(pos1 - pos2) + 2)

    distance = round(stops_count * 2.4, 1)
    estimated_mins = stops_count * 3 + 4
    total_fare = min(60, max(10, stops_count * 8))

    # Route steps
    steps = [
        {
            "stationName": origin.name,
            "line": origin.line,
            "lineColor": origin.line_color,
            "crowdStatus": origin.status_label,
            "interchange": False
        }
    ]

    # Add intermediate stations
    middle_stations = [s for s in stations_in_city if s.id not in (origin.id, dest.id)]
    random.seed(f"{origin.id}-{dest.id}")
    sample_mids = random.sample(middle_stations, min(len(middle_stations), stops_count - 1))

    for idx, mid in enumerate(sample_mids):
        is_interchange = (idx == len(sample_mids) // 2) if len(sample_mids) > 2 else False
        steps.append({
            "stationName": mid.name,
            "line": mid.line,
            "lineColor": mid.line_color,
            "crowdStatus": mid.status_label,
            "interchange": is_interchange
        })

    steps.append({
        "stationName": dest.name,
        "line": dest.line,
        "lineColor": dest.line_color,
        "crowdStatus": dest.status_label,
        "interchange": False
    })

    crowd_level = dest.status_label
    optimal_time = "Post-Peak (After 10:30 AM)" if dest.occupancy > 70 else "Optimal Now"

    return {
        "origin": origin.name,
        "destination": dest.name,
        "distanceKm": distance,
        "estimatedMins": estimated_mins,
        "totalFare": total_fare,
        "crowdLevel": crowd_level,
        "optimalTime": optimal_time,
        "steps": steps
    }

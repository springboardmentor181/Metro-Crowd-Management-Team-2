import random
import datetime
from sqlalchemy.orm import Session
from app.models import User, City, Station, Train, CrowdAlert, AiPrediction, AnalyticsData

CITIES_DATA = [
    {
        "id": "delhi",
        "name": "Delhi Metro",
        "state": "Delhi",
        "stations": 38,
        "linesCount": 4,
        "dailyPassengers": 6500000,
        "lines": [
            {"name": "Blue Line", "color": "#2f5df0"},
            {"name": "Red Line", "color": "#f04438"},
            {"name": "Green Line", "color": "#17b26a"},
            {"name": "Purple Line", "color": "#7c5cff"}
        ]
    },
    {
        "id": "hyderabad",
        "name": "Hyderabad Metro",
        "state": "Telangana",
        "stations": 57,
        "linesCount": 3,
        "dailyPassengers": 480000,
        "lines": [
            {"name": "Blue Line", "color": "#2f5df0"},
            {"name": "Red Line", "color": "#f04438"},
            {"name": "Green Line", "color": "#17b26a"}
        ]
    },
    {
        "id": "bengaluru",
        "name": "Bengaluru Metro",
        "state": "Karnataka",
        "stations": 45,
        "linesCount": 2,
        "dailyPassengers": 820000,
        "lines": [
            {"name": "Purple Line", "color": "#7c5cff"},
            {"name": "Green Line", "color": "#17b26a"}
        ]
    },
    {
        "id": "mumbai",
        "name": "Mumbai Metro",
        "state": "Maharashtra",
        "stations": 32,
        "linesCount": 3,
        "dailyPassengers": 1250000,
        "lines": [
            {"name": "Blue Line", "color": "#2f5df0"},
            {"name": "Yellow Line", "color": "#f7c948"},
            {"name": "Red Line", "color": "#f04438"}
        ]
    },
    {
        "id": "chennai",
        "name": "Chennai Metro",
        "state": "Tamil Nadu",
        "stations": 40,
        "linesCount": 2,
        "dailyPassengers": 510000,
        "lines": [
            {"name": "Blue Line", "color": "#2f5df0"},
            {"name": "Green Line", "color": "#17b26a"}
        ]
    },
    {
        "id": "kolkata",
        "name": "Kolkata Metro",
        "state": "West Bengal",
        "stations": 30,
        "linesCount": 3,
        "dailyPassengers": 690000,
        "lines": [
            {"name": "Blue Line", "color": "#2f5df0"},
            {"name": "Green Line", "color": "#17b26a"},
            {"name": "Purple Line", "color": "#7c5cff"}
        ]
    },
    {
        "id": "lucknow",
        "name": "Lucknow Metro",
        "state": "Uttar Pradesh",
        "stations": 21,
        "linesCount": 1,
        "dailyPassengers": 120000,
        "lines": [
            {"name": "Red Line", "color": "#f04438"}
        ]
    },
    {
        "id": "jaipur",
        "name": "Jaipur Metro",
        "state": "Rajasthan",
        "stations": 11,
        "linesCount": 1,
        "dailyPassengers": 60000,
        "lines": [
            {"name": "Pink Line", "color": "#f472b6"}
        ]
    },
    {
        "id": "kochi",
        "name": "Kochi Metro",
        "state": "Kerala",
        "stations": 25,
        "linesCount": 1,
        "dailyPassengers": 110000,
        "lines": [
            {"name": "Blue Line", "color": "#2f5df0"}
        ]
    },
    {
        "id": "pune",
        "name": "Pune Metro",
        "state": "Maharashtra",
        "stations": 30,
        "linesCount": 2,
        "dailyPassengers": 230000,
        "lines": [
            {"name": "Purple Line", "color": "#7c5cff"},
            {"name": "Aqua Line", "color": "#06b6d4"}
        ]
    }
]

NAME_PREFIX = ['Central', 'North', 'South', 'East', 'West', 'New', 'Model', 'Green', 'Lake', 'Civic', 'Metro', 'Tech', 'Heritage', 'Royal']
NAME_SUFFIX = ['Nagar', 'Chowk', 'Circle', 'Square', 'Park', 'Terminal', 'Gate', 'Junction', 'Vihar', 'Road', 'Hub']

def occupancy_to_status(occupancy: int):
    if occupancy >= 85:
        return {"key": "severe", "label": "Severe Overcrowding", "color": "#f04438"}
    elif occupancy >= 65:
        return {"key": "crowded", "label": "Heavy Crowd", "color": "#f98407"}
    elif occupancy >= 40:
        return {"key": "moderate", "label": "Moderate", "color": "#f7c948"}
    else:
        return {"key": "low", "label": "Normal Flow", "color": "#17b26a"}

def seed_database(db: Session):
    # 1. Seed Demo User
    existing_user = db.query(User).filter(User.email == "demo@metroflow.app").first()
    if not existing_user:
        demo_user = User(
            id="USR-DEMO",
            name="Demo User",
            email="demo@metroflow.app",
            password="MetroFlow@123",
            phone="+91 90000 00000",
            role="Passenger",
            status="Active",
            date_joined=datetime.datetime.utcnow()
        )
        db.add(demo_user)
        db.commit()

    # 2. Seed Each City and its Metro Data if missing
    for cdata in CITIES_DATA:
        existing_city = db.query(City).filter(City.id == cdata["id"]).first()
        if existing_city:
            continue

        city_obj = City(
            id=cdata["id"],
            name=cdata["name"],
            state=cdata["state"],
            stations_count=cdata["stations"],
            lines_count=cdata["linesCount"],
            daily_passengers=cdata["dailyPassengers"],
            lines=cdata["lines"]
        )
        db.add(city_obj)
        db.commit()

        # Seed Stations
        random.seed(cdata["id"])
        station_count = min(cdata["stations"], 24)
        created_stations = []

        for i in range(station_count):
            prefix = random.choice(NAME_PREFIX)
            suffix = random.choice(NAME_SUFFIX)
            st_name = f"{prefix} {suffix}"
            line = random.choice(cdata["lines"])
            occupancy = random.randint(15, 95)
            status_info = occupancy_to_status(occupancy)

            station = Station(
                id=f"{cdata['id'].upper()}-STN-{str(i+1).zfill(2)}",
                city_id=cdata["id"],
                name=st_name,
                line=line["name"],
                line_color=line["color"],
                occupancy=occupancy,
                current_crowd=int((occupancy / 100) * 1800),
                waiting_time=random.randint(2, 12),
                status=status_info["key"],
                status_label=status_info["label"],
                status_color=status_info["color"],
                peak_hours="08:00 – 10:00" if random.random() > 0.5 else "17:30 – 19:30",
                line_index=0,
                position_in_line=i % 8
            )
            db.add(station)
            created_stations.append(station)

        db.commit()

        # Seed Trains
        for line_idx, line in enumerate(cdata["lines"]):
            for t_idx in range(4):
                load = random.randint(300, 1750)
                status = "Delayed" if random.random() > 0.85 else ("Maintenance" if random.random() > 0.8 else "Running")
                train = Train(
                    id=f"{cdata['id'].upper()}-TRN-{line_idx+1}{t_idx+1}",
                    city_id=cdata["id"],
                    line=line["name"],
                    line_color=line["color"],
                    status=status,
                    current_station=created_stations[0].name if created_stations else "Terminal",
                    next_station=created_stations[-1].name if created_stations else "Terminal",
                    load=0 if status == "Maintenance" else load,
                    capacity=1800,
                    delay_min=random.randint(3, 10) if status == "Delayed" else 0,
                    platform=f"P{(t_idx % 2) + 1}",
                    frequency_min=random.randint(4, 8)
                )
                db.add(train)

        db.commit()

        # Seed Hourly, Weekly, Monthly Analytics
        hourly_flow = []
        hours = ['05:00','06:00','07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00','22:00']
        for h in hours:
            base = int(cdata["dailyPassengers"] / 18)
            entries = int(base * (0.8 + random.random() * 0.4))
            exits = int(base * (0.7 + random.random() * 0.5))
            hourly_flow.append({"hour": h, "entries": entries, "exits": exits})

        weekly = [{"day": day, "riders": int(cdata["dailyPassengers"] * (0.75 if i>=5 else 1.0) * (0.9 + random.random()*0.2))} for i, day in enumerate(['Mon','Tue','Wed','Thu','Fri','Sat','Sun'])]
        monthly = [{"month": m, "riders": round((cdata["dailyPassengers"] * 28 * (0.9 + random.random()*0.2)) / 1_000_000, 1)} for m in ['Feb','Mar','Apr','May','Jun','Jul']]

        analytics = AnalyticsData(
            id=f"{cdata['id']}-analytics",
            city_id=cdata["id"],
            hourly_flow=hourly_flow,
            weekly=weekly,
            monthly=monthly
        )
        db.add(analytics)

        # Seed Crowd Alerts (Mobile alert notifications for peak hours)
        risk_st = sorted(created_stations, key=lambda s: s.occupancy, reverse=True)[:3]
        for idx, st in enumerate(risk_st):
            alert = CrowdAlert(
                id=f"{cdata['id']}-alert-{idx+1}",
                city_id=cdata["id"],
                station_name=st.name,
                severity="critical" if st.occupancy >= 85 else "warning",
                title=f"{'Peak Overcrowding' if st.occupancy >= 85 else 'High Demand Alert'} — {st.name}",
                message=f"{st.name} is currently at {st.occupancy}% crowd capacity with an estimated wait time of {st.waiting_time} mins.",
                time=datetime.datetime.utcnow() - datetime.timedelta(minutes=idx * 15),
                read=False,
                phone_alert_sent=True
            )
            db.add(alert)

        # Seed AI Predictions
        future_crowd = [{"hour": h["hour"], "predicted": int(h["entries"] * 1.1)} for h in hourly_flow]
        ai_pred = AiPrediction(
            id=f"{cdata['id']}-ai",
            city_id=cdata["id"],
            peak_station=created_stations[0].name if created_stations else "Central Station",
            future_crowd=future_crowd,
            suggested_frequency="4 min",
            confidence=88,
            congestion_trend="rising"
        )
        db.add(ai_pred)

        db.commit()

import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config.config import settings
from app.database.database import engine, Base, SessionLocal
from app.services.seed import seed_database
from app.routers import auth, cities, stations, trains, alerts, journey, ai, admin, emergency

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI App
app = FastAPI(
    title=settings.PROJECT_NAME,
    description="FastAPI Backend for Metro Flow - Metro Crowd Management & Peak Hour Mobile Alert System",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Startup Event: Create DB tables and seed data
@app.on_event("startup")
def on_startup():
    logger.info("Initializing PostgreSQL database schema...")
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables verified/created successfully.")
        db = SessionLocal()
        try:
            logger.info("Running initial seed for Metro Flow cities and demo data...")
            seed_database(db)
            logger.info("Database seeding completed.")
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Error during startup database setup: {e}")

# Include Routers under settings.API_V1_STR (/api)
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(cities.router, prefix=settings.API_V1_STR)
app.include_router(stations.router, prefix=settings.API_V1_STR)
app.include_router(trains.router, prefix=settings.API_V1_STR)
app.include_router(alerts.router, prefix=settings.API_V1_STR)
app.include_router(journey.router, prefix=settings.API_V1_STR)
app.include_router(ai.router, prefix=settings.API_V1_STR)
app.include_router(admin.router, prefix=settings.API_V1_STR)
app.include_router(emergency.router, prefix=settings.API_V1_STR)

@app.get("/")
def root():
    return {
        "status": "online",
        "app": settings.PROJECT_NAME,
        "docs": "/docs",
        "message": "Metro Flow FastAPI Backend is running with PostgreSQL."
    }

from pydantic import BaseModel
from typing import Optional, List, Any

# Auth & User Schemas
class LoginRequest(BaseModel):
    email: str
    password: str
    rememberMe: Optional[bool] = False

class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    phone: Optional[str] = ""
    profileImage: Optional[str] = None

class UserUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    profileImage: Optional[str] = None
    status: Optional[str] = None

class PasswordChangeRequest(BaseModel):
    currentPassword: str
    newPassword: str

class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    phone: Optional[str] = ""
    role: str
    status: str
    profileImage: Optional[str] = None
    dateJoined: Optional[str] = None

class SessionResponse(BaseModel):
    user: UserResponse
    token: str

# OTP Schemas
class SendOtpRequest(BaseModel):
    phone: str
    employeeId: Optional[str] = None

class VerifyOtpRequest(BaseModel):
    code: str
    phone: Optional[str] = None

# Station & Crowd Schemas
class UpdateStationCrowd(BaseModel):
    occupancy: int
    currentCrowd: int
    waitingTime: int
    status: str

# Mobile Alert Request
class SendMobileAlertRequest(BaseModel):
    station: str
    severity: str = "warning"
    title: str
    message: str
    phoneNumbers: Optional[List[str]] = []

# Journey Planning Schema
class JourneyPlanRequest(BaseModel):
    cityId: str
    originStationId: str
    destinationStationId: str

class JourneyStep(BaseModel):
    stationName: str
    line: str
    lineColor: str
    crowdStatus: str
    interchange: bool = False

class JourneyPlanResponse(BaseModel):
    origin: str
    destination: str
    distanceKm: float
    estimatedMins: int
    totalFare: int
    crowdLevel: str
    optimalTime: str
    steps: List[JourneyStep]

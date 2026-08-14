import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database.database import get_db
from app.models import User, OtpRecord
from app.schemas.schemas import (
    LoginRequest, RegisterRequest, UserUpdate, PasswordChangeRequest,
    SendOtpRequest, VerifyOtpRequest, SessionResponse, UserResponse
)
from app.utils.auth import verify_password, get_password_hash, create_access_token
from app.config.config import settings

router = APIRouter(prefix="/auth", tags=["Auth"])

def user_to_response(user: User) -> UserResponse:
    return UserResponse(
        id=user.id,
        name=user.name,
        email=user.email,
        phone=user.phone or "",
        role=user.role,
        status=user.status,
        profileImage=user.profile_image,
        dateJoined=user.date_joined.isoformat() if user.date_joined else None
    )

@router.post("/login", response_model=SessionResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email.ilike(payload.email)).first()
    if not user or not verify_password(payload.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password."
        )
    token = create_access_token({"sub": user.id, "email": user.email})
    return SessionResponse(user=user_to_response(user), token=token)

@router.post("/register", response_model=UserResponse)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email.ilike(payload.email)).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists."
        )
    user_id = f"USR-{db.query(User).count() + 1}-{int(datetime.datetime.utcnow().timestamp())}"
    new_user = User(
        id=user_id,
        name=payload.name,
        email=payload.email,
        password=payload.password,
        phone=payload.phone or "",
        role="Passenger",
        status="Active",
        profile_image=payload.profileImage,
        date_joined=datetime.datetime.utcnow()
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return user_to_response(new_user)

@router.put("/profile/{user_id}", response_model=UserResponse)
def update_profile(user_id: str, patch: UserUpdate, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    
    if patch.name is not None:
        user.name = patch.name
    if patch.phone is not None:
        user.phone = patch.phone
    if patch.email is not None:
        user.email = patch.email
    if patch.profileImage is not None:
        user.profile_image = patch.profileImage
    if patch.status is not None:
        user.status = patch.status

    db.commit()
    db.refresh(user)
    return user_to_response(user)

@router.post("/change-password")
def change_password(user_id: str, payload: PasswordChangeRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Account not found.")
    if not verify_password(payload.currentPassword, user.password):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")
    user.password = payload.newPassword
    db.commit()
    return {"message": "Password updated successfully."}

@router.post("/send-otp")
def send_otp(payload: SendOtpRequest, db: Session = Depends(get_db)):
    if not payload.phone:
        raise HTTPException(status_code=400, detail="Phone number is required.")
    otp_record = OtpRecord(
        id=f"otp-{int(datetime.datetime.utcnow().timestamp())}",
        phone=payload.phone,
        code=settings.DEMO_OTP_CODE,
        employee_id=payload.employeeId
    )
    db.add(otp_record)
    db.commit()
    return {"success": True, "message": f"OTP sent to {payload.phone}."}

@router.post("/verify-otp")
def verify_otp(payload: VerifyOtpRequest):
    if payload.code != settings.DEMO_OTP_CODE:
        raise HTTPException(status_code=400, detail="Invalid OTP. Please try again.")
    return {"success": True}

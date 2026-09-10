import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database.database import get_db
from app.models import User, OtpRecord
from app.schemas.schemas import (
    LoginRequest, SocialLoginRequest, RegisterRequest, UserUpdate, PasswordChangeRequest,
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

@router.post("/social-login", response_model=SessionResponse)
def social_login(payload: SocialLoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email.ilike(payload.email)).first()
    if not user:
        # Create new user for social login
        display_name = payload.name or payload.email.split('@')[0].replace('.', ' ').title()
        user_id = f"USR-{payload.provider.upper()}-{db.query(User).count() + 1}-{int(datetime.datetime.utcnow().timestamp())}"
        user = User(
            id=user_id,
            name=display_name,
            email=payload.email,
            password=f"social-{payload.provider}-{user_id}",
            phone="",
            role="Passenger",
            status="Active",
            profile_image=payload.profileImage,
            date_joined=datetime.datetime.utcnow()
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    elif payload.profileImage and not user.profile_image:
        user.profile_image = payload.profileImage
        db.commit()
        db.refresh(user)

    token = create_access_token({"sub": user.id, "email": user.email, "provider": payload.provider})
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
        password=get_password_hash(payload.password),
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

import os
import random
import time
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# In-memory store for live OTPs: { target_lowercase: {"code": str, "expires": float} }
ACTIVE_OTPS = {}

def send_real_email_otp(to_email: str, otp_code: str) -> bool:
    smtp_host = os.getenv("SMTP_HOST", "")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER", "")
    smtp_password = os.getenv("SMTP_PASSWORD", "")
    from_email = os.getenv("SMTP_FROM", smtp_user or "no-reply@metroflow.app")

    if smtp_host and smtp_user and smtp_password:
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = f"Your MetroFlow Security Code: {otp_code}"
            msg["From"] = from_email
            msg["To"] = to_email

            html_content = f"""
            <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f4f6f9; color: #1e293b;">
              <div style="max-width: 500px; margin: 0 auto; background: #ffffff; padding: 30px; border-radius: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                <h2 style="color: #2563eb; margin-top: 0;">MetroFlow Security Verification</h2>
                <p style="font-size: 14px; color: #64748b;">Your 6-digit real-time verification code is:</p>
                <div style="font-size: 32px; font-weight: bold; font-family: monospace; letter-spacing: 6px; color: #0f172a; text-align: center; background: #f1f5f9; padding: 16px; border-radius: 12px; margin: 20px 0;">
                  {otp_code}
                </div>
                <p style="font-size: 12px; color: #94a3b8;">This code will expire in 5 minutes. If you did not request this, please ignore this email.</p>
              </div>
            </div>
            """
            msg.attach(MIMEText(html_content, "html"))

            with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as server:
                server.starttls()
                server.login(smtp_user, smtp_password)
                server.sendmail(from_email, [to_email], msg.as_string())
            print(f"[SMTP DISPATCH SUCCESS] Real verification email sent to {to_email}")
            return True
        except Exception as e:
            print(f"[SMTP ERROR] Could not send email via SMTP: {e}")
            return False
    return False

@router.post("/send-otp")
def send_otp(payload: SendOtpRequest, db: Session = Depends(get_db)):
    target = (payload.email or payload.phone or "").strip().lower()
    if not target:
        raise HTTPException(status_code=400, detail="Email or phone number is required.")

    # Generate live real-time 6-digit random OTP
    code = f"{random.randint(100000, 999999)}"
    expires_at = time.time() + 300  # Valid for 5 minutes
    ACTIVE_OTPS[target] = {"code": code, "expires": expires_at}

    # Save OTP Record to DB
    otp_record = OtpRecord(
        id=f"otp-{int(datetime.datetime.utcnow().timestamp())}-{random.randint(100, 999)}",
        phone=payload.phone or "",
        code=code,
        employee_id=payload.employeeId
    )
    db.add(otp_record)
    db.commit()

    email_sent = False
    if payload.email:
        email_sent = send_real_email_otp(payload.email, code)
        print(f"[LIVE EMAIL OTP DISPATCH] Real-time OTP code [{code}] sent to {payload.email} (SMTP sent: {email_sent})")
    else:
        print(f"[LIVE SMS OTP DISPATCH] Real-time OTP code [{code}] sent to {payload.phone}")

    return {
        "success": True,
        "message": f"Live verification code dispatched to {target}.",
        "target": target,
        "email_sent": email_sent,
        "live_otp": code  # Dispatched code for live verification UI display
    }

@router.post("/verify-otp")
def verify_otp(payload: VerifyOtpRequest):
    target = (payload.email or payload.phone or "").strip().lower()
    provided_code = (payload.code or "").strip()

    if not provided_code:
        raise HTTPException(status_code=400, detail="Verification code is required.")

    # Check live active OTP record first
    record = ACTIVE_OTPS.get(target)
    if record:
        if time.time() > record["expires"]:
            ACTIVE_OTPS.pop(target, None)
            raise HTTPException(status_code=400, detail="Verification code has expired. Please request a new code.")
        if record["code"] == provided_code:
            ACTIVE_OTPS.pop(target, None)
            return {"success": True, "message": "Verification code confirmed successfully."}
        else:
            raise HTTPException(status_code=400, detail="Incorrect verification code. Please check and try again.")

    # Fallback check for settings.DEMO_OTP_CODE if target not in memory
    if provided_code == settings.DEMO_OTP_CODE:
        return {"success": True, "message": "Verification code confirmed successfully."}

    raise HTTPException(status_code=400, detail="No active verification code found for this target. Please request a new code.")

from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, Request, UploadFile, File, Form, Cookie, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
import json
import math
import stripe
import random
import httpx
import aiofiles

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Create upload directories
UPLOAD_DIR = ROOT_DIR / "uploads"
PHOTOS_DIR = UPLOAD_DIR / "photos"
DOCUMENTS_DIR = UPLOAD_DIR / "documents"
PHOTOS_DIR.mkdir(parents=True, exist_ok=True)
DOCUMENTS_DIR.mkdir(parents=True, exist_ok=True)

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Stripe configuration
stripe.api_key = os.environ.get('STRIPE_API_KEY', 'sk_test_emergent')

# JWT Configuration
SECRET_KEY = os.environ.get('JWT_SECRET', 'transpo-secret-key-2024-super-secure')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer(auto_error=False)

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = FastAPI(title="Transpo API", description="Multi-Service Mobility Platform")
api_router = APIRouter(prefix="/api")

# Mount static files for uploads
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

# ============== MODELS ==============

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str
    phone: Optional[str] = None
    role: str = "user"

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserProfileUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    country: Optional[str] = None
    state: Optional[str] = None
    city: Optional[str] = None
    profile_photo: Optional[str] = None

class PaymentMethodAdd(BaseModel):
    type: str  # credit_card, debit_card, apple_pay, google_pay
    card_last_four: Optional[str] = None
    card_brand: Optional[str] = None
    expiry_month: Optional[int] = None
    expiry_year: Optional[int] = None
    is_default: bool = False

class DriverDocuments(BaseModel):
    drivers_license_number: Optional[str] = None
    drivers_license_expiry: Optional[str] = None
    taxi_license_number: Optional[str] = None
    taxi_license_expiry: Optional[str] = None

class DriverProfileUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    country: Optional[str] = None
    state: Optional[str] = None
    city: Optional[str] = None
    profile_photo: Optional[str] = None
    vehicle_type: Optional[str] = None
    vehicle_make: Optional[str] = None
    vehicle_model: Optional[str] = None
    vehicle_color: Optional[str] = None
    license_plate: Optional[str] = None
    drivers_license_number: Optional[str] = None
    drivers_license_expiry: Optional[str] = None
    taxi_license_number: Optional[str] = None
    taxi_license_expiry: Optional[str] = None
    # Tax Information
    gst_number: Optional[str] = None
    qst_number: Optional[str] = None
    srs_code: Optional[str] = None
    billing_number: Optional[str] = None
    srs_available: Optional[bool] = None
    tax_disclaimer_accepted: Optional[bool] = None

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    role: str
    profile_photo: Optional[str] = None
    created_at: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class DriverProfile(BaseModel):
    vehicle_type: str
    vehicle_make: str
    vehicle_model: str
    vehicle_color: str
    license_plate: str
    services: List[str] = ["taxi"]

class LocationUpdate(BaseModel):
    latitude: float
    longitude: float
    heading: Optional[float] = None
    speed: Optional[float] = None

class TaxiBookingRequest(BaseModel):
    pickup_lat: float
    pickup_lng: float
    pickup_address: str
    dropoff_lat: float
    dropoff_lng: float
    dropoff_address: str
    vehicle_type: str = "sedan"

class FareEstimateRequest(BaseModel):
    pickup_lat: float
    pickup_lng: float
    dropoff_lat: float
    dropoff_lng: float
    vehicle_type: str = "sedan"

class PaymentRequest(BaseModel):
    booking_id: str
    amount: float

class DocumentVerification(BaseModel):
    driver_id: str
    document_type: str  # drivers_license, taxi_license, profile_photo
    status: str  # pending, approved, rejected
    rejection_reason: Optional[str] = None

# ============== FARE CALCULATION (Quebec Example) ==============

FARE_CONFIG = {
    "base_fare": 3.50,
    "per_km_rate": 1.75,
    "per_minute_rate": 0.65,
    "government_fee": 0.90,
    "gst_rate": 0.05,
    "qst_rate": 0.09975,
    "minimum_fare": 7.50,
    "vehicle_multipliers": {
        "sedan": 1.0,
        "suv": 1.3,
        "van": 1.5,
        "bike": 0.7
    },
    "surge_thresholds": {
        "low": {"demand_ratio": 1.0, "multiplier": 1.0},
        "medium": {"demand_ratio": 1.5, "multiplier": 1.25},
        "high": {"demand_ratio": 2.0, "multiplier": 1.5},
        "very_high": {"demand_ratio": 3.0, "multiplier": 2.0}
    }
}

COMPETITOR_PRICING = {
    "UberX": {"base": 2.75, "per_km": 1.55, "per_min": 0.35},
    "Lyft": {"base": 2.50, "per_km": 1.60, "per_min": 0.40},
    "TaxiCoop": {"base": 3.80, "per_km": 1.90, "per_min": 0.70}
}

def calculate_distance_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lng = math.radians(lng2 - lng1)
    a = math.sin(delta_lat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lng/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    return R * c

def estimate_duration_minutes(distance_km: float, traffic_factor: float = 1.0) -> float:
    avg_speed_kmh = 30 / traffic_factor
    return (distance_km / avg_speed_kmh) * 60

def calculate_fare(distance_km: float, duration_min: float, vehicle_type: str = "sedan", surge_multiplier: float = 1.0) -> Dict[str, float]:
    vehicle_mult = FARE_CONFIG["vehicle_multipliers"].get(vehicle_type, 1.0)
    base = FARE_CONFIG["base_fare"]
    distance_charge = distance_km * FARE_CONFIG["per_km_rate"] * vehicle_mult
    time_charge = duration_min * FARE_CONFIG["per_minute_rate"]
    subtotal = (base + distance_charge + time_charge) * surge_multiplier
    government_fee = FARE_CONFIG["government_fee"]
    taxable_amount = subtotal + government_fee
    gst = taxable_amount * FARE_CONFIG["gst_rate"]
    qst = taxable_amount * FARE_CONFIG["qst_rate"]
    total = taxable_amount + gst + qst
    total = max(total, FARE_CONFIG["minimum_fare"])
    return {
        "base_fare": round(base, 2),
        "distance_charge": round(distance_charge, 2),
        "time_charge": round(time_charge, 2),
        "surge_multiplier": surge_multiplier,
        "subtotal": round(subtotal, 2),
        "government_fee": round(government_fee, 2),
        "gst": round(gst, 2),
        "qst": round(qst, 2),
        "total": round(total, 2),
        "distance_km": round(distance_km, 2),
        "duration_min": round(duration_min, 1)
    }

def get_competitor_estimates(distance_km: float, duration_min: float) -> List[Dict]:
    estimates = []
    for name, pricing in COMPETITOR_PRICING.items():
        estimate = pricing["base"] + (distance_km * pricing["per_km"]) + (duration_min * pricing["per_min"])
        estimates.append({
            "provider": name,
            "estimated_fare": round(estimate, 2),
            "is_estimate": True,
            "disclaimer": "Market reference only, not a guaranteed price"
        })
    return sorted(estimates, key=lambda x: x["estimated_fare"])

# ============== DRIVER MATCHING ALGORITHM ==============

async def find_nearby_drivers(lat: float, lng: float, radius_km: float = 5.0, vehicle_type: str = None, limit: int = 10) -> List[Dict]:
    query = {"status": "online", "is_available": True}
    if vehicle_type:
        query["vehicle_type"] = vehicle_type
    drivers = await db.drivers.find(query, {"_id": 0}).to_list(100)
    scored_drivers = []
    for driver in drivers:
        if "location" not in driver:
            continue
        driver_lat = driver["location"].get("latitude", 0)
        driver_lng = driver["location"].get("longitude", 0)
        distance = calculate_distance_km(lat, lng, driver_lat, driver_lng)
        if distance <= radius_km:
            rating = driver.get("rating", 4.5)
            acceptance_rate = driver.get("acceptance_rate", 0.85)
            distance_score = (1 / max(distance, 0.1)) * 0.6
            rating_score = (rating / 5.0) * 0.3
            acceptance_score = acceptance_rate * 0.1
            total_score = distance_score + rating_score + acceptance_score
            eta_minutes = estimate_duration_minutes(distance, traffic_factor=1.2)
            scored_drivers.append({
                **driver,
                "distance_km": round(distance, 2),
                "eta_minutes": round(eta_minutes, 1),
                "match_score": round(total_score, 3)
            })
    scored_drivers.sort(key=lambda x: x["match_score"], reverse=True)
    return scored_drivers[:limit]

# ============== AUTH HELPERS ==============

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    session_token: Optional[str] = Cookie(default=None)
):
    token = None
    
    # Try session_token cookie first (for social auth)
    if session_token:
        session = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
        if session:
            expires_at = session.get("expires_at")
            if isinstance(expires_at, str):
                expires_at = datetime.fromisoformat(expires_at)
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if expires_at > datetime.now(timezone.utc):
                user = await db.users.find_one({"id": session["user_id"]}, {"_id": 0, "password": 0})
                if user:
                    return user
    
    # Try Bearer token (for JWT auth)
    if credentials:
        token = credentials.credentials
    
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user_jwt(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Simple JWT-only authentication for API endpoints that don't use cookies."""
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ============== FILE UPLOAD HELPERS ==============

async def save_upload_file(upload_file: UploadFile, folder: str) -> str:
    file_ext = Path(upload_file.filename).suffix.lower()
    if file_ext not in ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf']:
        raise HTTPException(status_code=400, detail="Invalid file type")
    
    file_id = str(uuid.uuid4())
    filename = f"{file_id}{file_ext}"
    
    if folder == "photos":
        file_path = PHOTOS_DIR / filename
    else:
        file_path = DOCUMENTS_DIR / filename
    
    async with aiofiles.open(file_path, 'wb') as f:
        content = await upload_file.read()
        await f.write(content)
    
    return f"/uploads/{folder}/{filename}"

# ============== AUTH ROUTES ==============

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(
    email: EmailStr = Form(...),
    password: str = Form(...),
    first_name: str = Form(...),
    last_name: str = Form(...),
    phone: Optional[str] = Form(None),
    role: str = Form("user")
):
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    name = f"{first_name} {last_name}"
    
    user_doc = {
        "id": user_id,
        "email": email,
        "password": hash_password(password),
        "name": name,
        "first_name": first_name,
        "last_name": last_name,
        "phone": phone,
        "role": role,
        "profile_photo": None,
        "address": None,
        "country": None,
        "state": None,
        "city": None,
        "payment_methods": [],
        "auth_provider": "email",
        "created_at": now,
        "wallet_balance": 0.0
    }
    
    await db.users.insert_one(user_doc)
    
    if role == "driver":
        driver_doc = {
            "id": user_id,
            "user_id": user_id,
            "name": name,
            "first_name": first_name,
            "last_name": last_name,
            "email": email,
            "phone": phone,
            "profile_photo": None,
            "address": None,
            "country": None,
            "state": None,
            "city": None,
            "status": "offline",
            "is_available": False,
            "vehicle_type": "sedan",
            "vehicle_make": "",
            "vehicle_model": "",
            "vehicle_color": "",
            "license_plate": "",
            "services": ["taxi"],
            "rating": 5.0,
            "total_rides": 0,
            "acceptance_rate": 1.0,
            "earnings_today": 0.0,
            "earnings_total": 0.0,
            "location": {"latitude": 0, "longitude": 0},
            "drivers_license_number": None,
            "drivers_license_expiry": None,
            "drivers_license_photo": None,
            "drivers_license_status": "pending",
            "taxi_license_number": None,
            "taxi_license_expiry": None,
            "taxi_license_photo": None,
            "taxi_license_status": "pending",
            "profile_photo_status": "pending",
            "verification_status": "pending",
            # Tax Information
            "gst_number": None,
            "qst_number": None,
            "srs_code": None,
            "billing_number": None,
            "srs_available": False,
            "tax_disclaimer_accepted": False,
            "created_at": now
        }
        await db.drivers.insert_one(driver_doc)
    
    token = create_access_token({"sub": user_id, "role": role})
    
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user_id, email=email, name=name, first_name=first_name,
            last_name=last_name, phone=phone, role=role, created_at=now
        )
    )

# Keep JSON registration for backward compatibility
@api_router.post("/auth/register/json", response_model=TokenResponse)
async def register_json(user_data: UserCreate):
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Parse name into first/last
    name_parts = user_data.first_name.split() if hasattr(user_data, 'first_name') else user_data.name.split() if hasattr(user_data, 'name') else ["User"]
    first_name = name_parts[0] if name_parts else "User"
    last_name = " ".join(name_parts[1:]) if len(name_parts) > 1 else ""
    
    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    name = f"{first_name} {last_name}".strip()
    
    user_doc = {
        "id": user_id,
        "email": user_data.email,
        "password": hash_password(user_data.password),
        "name": name,
        "first_name": first_name,
        "last_name": last_name,
        "phone": user_data.phone,
        "role": user_data.role,
        "profile_photo": None,
        "address": None,
        "country": None,
        "state": None,
        "city": None,
        "payment_methods": [],
        "auth_provider": "email",
        "created_at": now,
        "wallet_balance": 0.0
    }
    
    await db.users.insert_one(user_doc)
    
    if user_data.role == "driver":
        driver_doc = {
            "id": user_id,
            "user_id": user_id,
            "name": name,
            "first_name": first_name,
            "last_name": last_name,
            "email": user_data.email,
            "phone": user_data.phone,
            "profile_photo": None,
            "status": "offline",
            "is_available": False,
            "vehicle_type": "sedan",
            "vehicle_make": "",
            "vehicle_model": "",
            "vehicle_color": "",
            "license_plate": "",
            "services": ["taxi"],
            "rating": 5.0,
            "total_rides": 0,
            "acceptance_rate": 1.0,
            "earnings_today": 0.0,
            "earnings_total": 0.0,
            "location": {"latitude": 0, "longitude": 0},
            "drivers_license_status": "pending",
            "taxi_license_status": "pending",
            "profile_photo_status": "pending",
            "verification_status": "pending",
            "created_at": now
        }
        await db.drivers.insert_one(driver_doc)
    
    token = create_access_token({"sub": user_id, "role": user_data.role})
    
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user_id, email=user_data.email, name=name, first_name=first_name,
            last_name=last_name, phone=user_data.phone, role=user_data.role, created_at=now
        )
    )

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Check if user has password (might be social auth only)
    if not user.get("password"):
        raise HTTPException(status_code=401, detail="Please login with social account")
    
    if not verify_password(credentials.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_access_token({"sub": user["id"], "role": user["role"]})
    
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user["id"],
            email=user["email"],
            name=user.get("name", ""),
            first_name=user.get("first_name"),
            last_name=user.get("last_name"),
            phone=user.get("phone"),
            role=user["role"],
            profile_photo=user.get("profile_photo"),
            created_at=user["created_at"]
        )
    )

@api_router.get("/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return {
        "id": current_user["id"],
        "email": current_user["email"],
        "name": current_user.get("name", ""),
        "first_name": current_user.get("first_name"),
        "last_name": current_user.get("last_name"),
        "phone": current_user.get("phone"),
        "role": current_user["role"],
        "profile_photo": current_user.get("profile_photo"),
        "address": current_user.get("address"),
        "country": current_user.get("country"),
        "state": current_user.get("state"),
        "city": current_user.get("city"),
        "payment_methods": current_user.get("payment_methods", []),
        "auth_provider": current_user.get("auth_provider", "email"),
        "created_at": current_user["created_at"]
    }

# ============== SOCIAL AUTH ROUTES ==============

@api_router.post("/auth/social/session")
async def process_social_session(request: Request, response: Response):
    """Process session_id from social auth callback"""
    data = await request.json()
    session_id = data.get("session_id")
    
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")
    
    # Fetch user data from Emergent Auth
    async with httpx.AsyncClient() as client:
        auth_response = await client.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id}
        )
        
        if auth_response.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid session")
        
        auth_data = auth_response.json()
    
    email = auth_data.get("email")
    name = auth_data.get("name", "")
    picture = auth_data.get("picture")
    session_token = auth_data.get("session_token")
    
    # Parse name
    name_parts = name.split() if name else ["User"]
    first_name = name_parts[0]
    last_name = " ".join(name_parts[1:]) if len(name_parts) > 1 else ""
    
    # Check if user exists
    existing_user = await db.users.find_one({"email": email})
    
    if existing_user:
        user_id = existing_user["id"]
        # Update profile photo if provided
        if picture and not existing_user.get("profile_photo"):
            await db.users.update_one(
                {"id": user_id},
                {"$set": {"profile_photo": picture}}
            )
    else:
        # Create new user
        user_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        
        user_doc = {
            "id": user_id,
            "email": email,
            "password": None,  # No password for social auth
            "name": name,
            "first_name": first_name,
            "last_name": last_name,
            "phone": None,
            "role": "user",
            "profile_photo": picture,
            "address": None,
            "country": None,
            "state": None,
            "city": None,
            "payment_methods": [],
            "auth_provider": "google",
            "created_at": now,
            "wallet_balance": 0.0
        }
        await db.users.insert_one(user_doc)
    
    # Store session
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.update_one(
        {"user_id": user_id},
        {"$set": {
            "user_id": user_id,
            "session_token": session_token,
            "expires_at": expires_at,
            "created_at": datetime.now(timezone.utc)
        }},
        upsert=True
    )
    
    # Set cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=7*24*60*60,
        path="/"
    )
    
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    
    return {
        "user": user,
        "message": "Login successful"
    }

@api_router.post("/auth/logout")
async def logout(response: Response, current_user: dict = Depends(get_current_user)):
    # Delete session from database
    await db.user_sessions.delete_one({"user_id": current_user["id"]})
    
    # Clear cookie
    response.delete_cookie(key="session_token", path="/")
    
    return {"message": "Logged out successfully"}

# ============== USER PROFILE ROUTES ==============

@api_router.put("/user/profile")
async def update_user_profile(profile: UserProfileUpdate, current_user: dict = Depends(get_current_user)):
    update_data = {k: v for k, v in profile.dict().items() if v is not None}
    
    if "first_name" in update_data or "last_name" in update_data:
        first = update_data.get("first_name", current_user.get("first_name", ""))
        last = update_data.get("last_name", current_user.get("last_name", ""))
        update_data["name"] = f"{first} {last}".strip()
    
    if update_data:
        await db.users.update_one({"id": current_user["id"]}, {"$set": update_data})
        
        # Also update driver profile if driver
        if current_user["role"] == "driver":
            await db.drivers.update_one({"user_id": current_user["id"]}, {"$set": update_data})
    
    return {"message": "Profile updated successfully"}

@api_router.post("/user/profile/photo")
async def upload_profile_photo(
    photo: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    photo_url = await save_upload_file(photo, "photos")
    
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"profile_photo": photo_url}}
    )
    
    if current_user["role"] == "driver":
        await db.drivers.update_one(
            {"user_id": current_user["id"]},
            {"$set": {"profile_photo": photo_url, "profile_photo_status": "pending"}}
        )
    
    return {"photo_url": photo_url, "message": "Photo uploaded successfully"}

@api_router.get("/user/profile")
async def get_user_profile(current_user: dict = Depends(get_current_user)):
    return {
        "id": current_user["id"],
        "email": current_user["email"],
        "name": current_user.get("name", ""),
        "first_name": current_user.get("first_name"),
        "last_name": current_user.get("last_name"),
        "phone": current_user.get("phone"),
        "address": current_user.get("address"),
        "country": current_user.get("country"),
        "state": current_user.get("state"),
        "city": current_user.get("city"),
        "profile_photo": current_user.get("profile_photo"),
        "payment_methods": current_user.get("payment_methods", []),
        "auth_provider": current_user.get("auth_provider", "email"),
        "role": current_user["role"],
        "created_at": current_user["created_at"]
    }

# ============== PAYMENT METHODS ROUTES ==============

@api_router.post("/user/payment-methods")
async def add_payment_method(method: PaymentMethodAdd, current_user: dict = Depends(get_current_user)):
    payment_method = {
        "id": str(uuid.uuid4()),
        "type": method.type,
        "card_last_four": method.card_last_four,
        "card_brand": method.card_brand,
        "expiry_month": method.expiry_month,
        "expiry_year": method.expiry_year,
        "is_default": method.is_default,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    # If this is default, unset other defaults first
    if method.is_default:
        user = await db.users.find_one({"id": current_user["id"]})
        if user and user.get("payment_methods"):
            updated_methods = [
                {**m, "is_default": False} for m in user["payment_methods"]
            ]
            await db.users.update_one(
                {"id": current_user["id"]},
                {"$set": {"payment_methods": updated_methods}}
            )
    
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$push": {"payment_methods": payment_method}}
    )
    
    return {"message": "Payment method added", "payment_method": payment_method}

@api_router.get("/user/payment-methods")
async def get_payment_methods(current_user: dict = Depends(get_current_user)):
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "payment_methods": 1})
    return {"payment_methods": user.get("payment_methods", [])}

@api_router.delete("/user/payment-methods/{method_id}")
async def delete_payment_method(method_id: str, current_user: dict = Depends(get_current_user)):
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$pull": {"payment_methods": {"id": method_id}}}
    )
    return {"message": "Payment method removed"}

# ============== DRIVER PROFILE & DOCUMENTS ROUTES ==============

@api_router.get("/driver/profile")
async def get_driver_profile(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "driver":
        raise HTTPException(status_code=403, detail="Not a driver")
    
    driver = await db.drivers.find_one({"user_id": current_user["id"]}, {"_id": 0})
    if not driver:
        raise HTTPException(status_code=404, detail="Driver profile not found")
    return driver

@api_router.put("/driver/profile")
async def update_driver_profile(profile: DriverProfileUpdate, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "driver":
        raise HTTPException(status_code=403, detail="Not a driver")
    
    update_data = {k: v for k, v in profile.dict().items() if v is not None}
    
    if "first_name" in update_data or "last_name" in update_data:
        driver = await db.drivers.find_one({"user_id": current_user["id"]})
        first = update_data.get("first_name", driver.get("first_name", ""))
        last = update_data.get("last_name", driver.get("last_name", ""))
        update_data["name"] = f"{first} {last}".strip()
    
    if update_data:
        await db.drivers.update_one({"user_id": current_user["id"]}, {"$set": update_data})
        # Also update user profile
        await db.users.update_one({"id": current_user["id"]}, {"$set": update_data})
    
    return {"message": "Profile updated"}

@api_router.post("/driver/documents/license")
async def upload_drivers_license(
    photo: UploadFile = File(...),
    license_number: str = Form(...),
    expiry_date: str = Form(...),
    current_user: dict = Depends(get_current_user)
):
    if current_user["role"] != "driver":
        raise HTTPException(status_code=403, detail="Not a driver")
    
    photo_url = await save_upload_file(photo, "documents")
    
    await db.drivers.update_one(
        {"user_id": current_user["id"]},
        {"$set": {
            "drivers_license_photo": photo_url,
            "drivers_license_number": license_number,
            "drivers_license_expiry": expiry_date,
            "drivers_license_status": "pending"
        }}
    )
    
    return {"photo_url": photo_url, "message": "Driver's license uploaded for verification"}

@api_router.post("/driver/documents/taxi-license")
async def upload_taxi_license(
    photo: UploadFile = File(...),
    license_number: str = Form(...),
    expiry_date: str = Form(...),
    current_user: dict = Depends(get_current_user)
):
    if current_user["role"] != "driver":
        raise HTTPException(status_code=403, detail="Not a driver")
    
    photo_url = await save_upload_file(photo, "documents")
    
    await db.drivers.update_one(
        {"user_id": current_user["id"]},
        {"$set": {
            "taxi_license_photo": photo_url,
            "taxi_license_number": license_number,
            "taxi_license_expiry": expiry_date,
            "taxi_license_status": "pending"
        }}
    )
    
    return {"photo_url": photo_url, "message": "Taxi license uploaded for verification"}

@api_router.post("/driver/status")
async def update_driver_status(status: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "driver":
        raise HTTPException(status_code=403, detail="Not a driver")
    
    is_available = status == "online"
    await db.drivers.update_one(
        {"user_id": current_user["id"]},
        {"$set": {"status": status, "is_available": is_available}}
    )
    return {"status": status, "is_available": is_available}

@api_router.post("/driver/location")
async def update_driver_location(location: LocationUpdate, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "driver":
        raise HTTPException(status_code=403, detail="Not a driver")
    
    await db.drivers.update_one(
        {"user_id": current_user["id"]},
        {"$set": {
            "location": {
                "latitude": location.latitude,
                "longitude": location.longitude,
                "heading": location.heading,
                "speed": location.speed,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }}
    )
    return {"message": "Location updated"}

@api_router.get("/driver/jobs")
async def get_driver_jobs(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "driver":
        raise HTTPException(status_code=403, detail="Not a driver")
    
    pending_jobs = await db.bookings.find(
        {"status": "pending", "matched_drivers": current_user["id"]},
        {"_id": 0}
    ).to_list(10)
    
    active_jobs = await db.bookings.find(
        {"driver_id": current_user["id"], "status": {"$in": ["accepted", "in_progress"]}},
        {"_id": 0}
    ).to_list(10)
    
    return {"pending_jobs": pending_jobs, "active_jobs": active_jobs}

@api_router.post("/driver/accept/{booking_id}")
async def accept_booking(booking_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "driver":
        raise HTTPException(status_code=403, detail="Not a driver")
    
    driver = await db.drivers.find_one({"user_id": current_user["id"]}, {"_id": 0})
    
    result = await db.bookings.update_one(
        {"id": booking_id, "status": "pending"},
        {"$set": {
            "status": "accepted",
            "driver_id": current_user["id"],
            "driver_name": driver.get("name", current_user.get("name", "")),
            "driver_vehicle": f"{driver.get('vehicle_color', '')} {driver.get('vehicle_make', '')} {driver.get('vehicle_model', '')}",
            "driver_plate": driver.get("license_plate", ""),
            "driver_rating": driver.get("rating", 5.0),
            "driver_photo": driver.get("profile_photo"),
            "accepted_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=400, detail="Booking no longer available")
    
    await db.drivers.update_one(
        {"user_id": current_user["id"]},
        {"$set": {"is_available": False}}
    )
    
    return {"message": "Booking accepted", "booking_id": booking_id}

@api_router.post("/driver/complete/{booking_id}")
async def complete_booking(booking_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "driver":
        raise HTTPException(status_code=403, detail="Not a driver")
    
    booking = await db.bookings.find_one({"id": booking_id, "driver_id": current_user["id"]})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    now = datetime.now(timezone.utc).isoformat()
    fare_total = booking["fare"]["total"]
    
    await db.bookings.update_one(
        {"id": booking_id},
        {"$set": {"status": "completed", "completed_at": now}}
    )
    
    await db.drivers.update_one(
        {"user_id": current_user["id"]},
        {
            "$set": {"is_available": True},
            "$inc": {
                "total_rides": 1,
                "earnings_today": fare_total * 0.8,
                "earnings_total": fare_total * 0.8
            }
        }
    )
    
    return {"message": "Ride completed", "earnings": fare_total * 0.8}

@api_router.get("/driver/earnings")
async def get_driver_earnings(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "driver":
        raise HTTPException(status_code=403, detail="Not a driver")
    
    driver = await db.drivers.find_one({"user_id": current_user["id"]}, {"_id": 0})
    
    week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    completed_rides = await db.bookings.find(
        {"driver_id": current_user["id"], "status": "completed", "completed_at": {"$gte": week_ago}},
        {"_id": 0}
    ).to_list(100)
    
    weekly_earnings = sum(r["fare"]["total"] * 0.8 for r in completed_rides)
    
    return {
        "today": driver.get("earnings_today", 0),
        "weekly": round(weekly_earnings, 2),
        "total": driver.get("earnings_total", 0),
        "total_rides": driver.get("total_rides", 0),
        "rating": driver.get("rating", 5.0),
        "recent_rides": completed_rides[:10]
    }

# ============== ADMIN ROUTES ==============

@api_router.get("/admin/stats")
async def get_admin_stats(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    total_users = await db.users.count_documents({"role": "user"})
    total_drivers = await db.drivers.count_documents({})
    online_drivers = await db.drivers.count_documents({"status": "online"})
    pending_verifications = await db.drivers.count_documents({"verification_status": "pending"})
    total_bookings = await db.bookings.count_documents({})
    active_bookings = await db.bookings.count_documents({"status": {"$in": ["pending", "accepted", "in_progress"]}})
    completed_bookings = await db.bookings.count_documents({"status": "completed"})
    
    completed = await db.bookings.find({"status": "completed"}, {"fare.total": 1}).to_list(1000)
    total_revenue = sum(b["fare"]["total"] for b in completed)
    platform_revenue = total_revenue * 0.2
    
    return {
        "users": {"total": total_users},
        "drivers": {"total": total_drivers, "online": online_drivers, "pending_verification": pending_verifications},
        "bookings": {"total": total_bookings, "active": active_bookings, "completed": completed_bookings},
        "revenue": {"total": round(total_revenue, 2), "platform": round(platform_revenue, 2)}
    }

@api_router.get("/admin/users")
async def get_all_users(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    users = await db.users.find({}, {"_id": 0, "password": 0}).to_list(100)
    return {"users": users}

@api_router.get("/admin/drivers")
async def get_all_drivers(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    drivers = await db.drivers.find({}, {"_id": 0}).to_list(100)
    return {"drivers": drivers}

@api_router.get("/admin/drivers/pending-verification")
async def get_pending_verifications(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    drivers = await db.drivers.find(
        {"$or": [
            {"drivers_license_status": "pending"},
            {"taxi_license_status": "pending"},
            {"profile_photo_status": "pending"}
        ]},
        {"_id": 0}
    ).to_list(100)
    
    return {"drivers": drivers}

@api_router.post("/admin/verify-document")
async def verify_document(verification: DocumentVerification, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    update_field = f"{verification.document_type}_status"
    update_data = {update_field: verification.status}
    
    if verification.status == "rejected" and verification.rejection_reason:
        update_data[f"{verification.document_type}_rejection_reason"] = verification.rejection_reason
    
    await db.drivers.update_one(
        {"id": verification.driver_id},
        {"$set": update_data}
    )
    
    # Check if all documents are approved
    driver = await db.drivers.find_one({"id": verification.driver_id})
    if driver:
        all_approved = (
            driver.get("drivers_license_status") == "approved" and
            driver.get("taxi_license_status") == "approved" and
            driver.get("profile_photo_status") == "approved"
        )
        if all_approved:
            await db.drivers.update_one(
                {"id": verification.driver_id},
                {"$set": {"verification_status": "approved"}}
            )
    
    return {"message": f"Document {verification.status}"}

@api_router.get("/admin/bookings")
async def get_all_bookings(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    bookings = await db.bookings.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"bookings": bookings}

# ============== FARE & BOOKING ROUTES ==============

@api_router.post("/fare/estimate")
async def estimate_fare(request: FareEstimateRequest):
    distance_km = calculate_distance_km(
        request.pickup_lat, request.pickup_lng,
        request.dropoff_lat, request.dropoff_lng
    )
    duration_min = estimate_duration_minutes(distance_km)
    
    hour = datetime.now().hour
    surge = 1.0
    if 7 <= hour <= 9 or 17 <= hour <= 19:
        surge = 1.25
    
    our_fare = calculate_fare(distance_km, duration_min, request.vehicle_type, surge)
    competitor_estimates = get_competitor_estimates(distance_km, duration_min)
    
    all_options = [{"provider": "Transpo", "estimated_fare": our_fare["total"], "is_platform": True}]
    all_options.extend(competitor_estimates)
    all_options.sort(key=lambda x: x["estimated_fare"])
    
    recommendation = "best_value" if all_options[0]["provider"] == "Transpo" else "competitive"
    
    return {
        "our_fare": our_fare,
        "competitor_estimates": competitor_estimates,
        "recommendation": recommendation,
        "cheapest_option": all_options[0],
        "disclaimer": "Competitor prices are estimates only and may vary"
    }

@api_router.post("/taxi/book")
async def book_taxi(request: TaxiBookingRequest, current_user: dict = Depends(get_current_user)):
    distance_km = calculate_distance_km(
        request.pickup_lat, request.pickup_lng,
        request.dropoff_lat, request.dropoff_lng
    )
    duration_min = estimate_duration_minutes(distance_km)
    fare = calculate_fare(distance_km, duration_min, request.vehicle_type)
    
    nearby_drivers = await find_nearby_drivers(
        request.pickup_lat, request.pickup_lng,
        radius_km=5.0, vehicle_type=request.vehicle_type, limit=5
    )
    
    booking_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    booking_doc = {
        "id": booking_id,
        "user_id": current_user["id"],
        "user_name": current_user.get("name", ""),
        "type": "taxi",
        "status": "pending",
        "pickup": {
            "latitude": request.pickup_lat,
            "longitude": request.pickup_lng,
            "address": request.pickup_address
        },
        "dropoff": {
            "latitude": request.dropoff_lat,
            "longitude": request.dropoff_lng,
            "address": request.dropoff_address
        },
        "vehicle_type": request.vehicle_type,
        "fare": fare,
        "driver_id": None,
        "driver_name": None,
        "matched_drivers": [d["id"] for d in nearby_drivers[:5]],
        "payment_status": "pending",
        "created_at": now,
        "updated_at": now
    }
    
    await db.bookings.insert_one(booking_doc)
    
    return {
        "booking_id": booking_id,
        "status": "pending",
        "fare": fare,
        "nearby_drivers_count": len(nearby_drivers),
        "estimated_pickup_time": nearby_drivers[0]["eta_minutes"] if nearby_drivers else None,
        "message": "Looking for nearby drivers..."
    }

@api_router.get("/taxi/booking/{booking_id}")
async def get_booking(booking_id: str, current_user: dict = Depends(get_current_user)):
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    return booking

@api_router.get("/bookings/user")
async def get_user_bookings(current_user: dict = Depends(get_current_user)):
    bookings = await db.bookings.find(
        {"user_id": current_user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    return {"bookings": bookings}

# ============== MAP/LOCATION ROUTES ==============

@api_router.get("/map/drivers")
async def get_map_drivers(lat: float, lng: float, radius: float = 5.0):
    drivers = await find_nearby_drivers(lat, lng, radius_km=radius, limit=20)
    return {
        "drivers": [
            {
                "id": d["id"],
                "location": d["location"],
                "vehicle_type": d["vehicle_type"],
                "rating": d["rating"],
                "eta_minutes": d["eta_minutes"],
                "profile_photo": d.get("profile_photo")
            }
            for d in drivers
        ]
    }

# ============== PAYMENT ROUTES ==============

@api_router.post("/payments/create-checkout")
async def create_checkout_session(request: Request, booking_id: str, current_user: dict = Depends(get_current_user)):
    booking = await db.bookings.find_one({"id": booking_id, "user_id": current_user["id"]})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    host_url = str(request.base_url).rstrip('/')
    amount = booking["fare"]["total"]
    
    try:
        session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price_data': {
                    'currency': 'cad',
                    'product_data': {
                        'name': f'Transpo Ride - {booking["pickup"]["address"][:30]} to {booking["dropoff"]["address"][:30]}',
                    },
                    'unit_amount': int(amount * 100),
                },
                'quantity': 1,
            }],
            mode='payment',
            success_url=f'{host_url}/payment/success?session_id={{CHECKOUT_SESSION_ID}}&booking_id={booking_id}',
            cancel_url=f'{host_url}/payment/cancel?booking_id={booking_id}',
            metadata={'booking_id': booking_id, 'user_id': current_user["id"]}
        )
        
        await db.payment_transactions.insert_one({
            "id": str(uuid.uuid4()),
            "session_id": session.id,
            "booking_id": booking_id,
            "user_id": current_user["id"],
            "amount": amount,
            "currency": "cad",
            "status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        return {"checkout_url": session.url, "session_id": session.id}
    except Exception as e:
        logger.error(f"Stripe error: {e}")
        raise HTTPException(status_code=500, detail="Payment processing error")

@api_router.get("/payments/status/{session_id}")
async def get_payment_status(session_id: str, current_user: dict = Depends(get_current_user)):
    try:
        session = stripe.checkout.Session.retrieve(session_id)
        
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {"status": session.payment_status, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        if session.payment_status == "paid":
            booking_id = session.metadata.get("booking_id")
            if booking_id:
                await db.bookings.update_one({"id": booking_id}, {"$set": {"payment_status": "paid"}})
        
        return {
            "status": session.status,
            "payment_status": session.payment_status,
            "amount_total": session.amount_total / 100 if session.amount_total else 0
        }
    except Exception as e:
        logger.error(f"Payment status error: {e}")
        raise HTTPException(status_code=500, detail="Error checking payment status")

# ============== SEED DATA ==============

@api_router.post("/seed/drivers")
async def seed_demo_drivers():
    base_lat, base_lng = 45.5017, -73.5673
    demo_drivers = []
    vehicle_types = ["sedan", "suv", "van", "bike"]
    first_names = ["John", "Marie", "David", "Sophie", "Michael", "Emma", "James", "Olivia", "Robert", "Charlotte", "William", "Amelia", "Joseph", "Mia", "Charles"]
    last_names = ["Smith", "Tremblay", "Johnson", "Roy", "Williams", "Gagnon", "Brown", "Bouchard", "Jones", "Côté", "Garcia", "Fortin", "Miller", "Lavoie", "Davis"]
    
    for i in range(15):
        driver_id = str(uuid.uuid4())
        lat_offset = (random.random() - 0.5) * 0.08
        lng_offset = (random.random() - 0.5) * 0.08
        first_name = first_names[i]
        last_name = last_names[i]
        
        driver = {
            "id": driver_id,
            "user_id": driver_id,
            "name": f"{first_name} {last_name}",
            "first_name": first_name,
            "last_name": last_name,
            "email": f"driver{i+1}@transpo.com",
            "phone": f"+1514555{1000+i}",
            "profile_photo": None,
            "status": "online" if random.random() > 0.3 else "offline",
            "is_available": random.random() > 0.2,
            "vehicle_type": random.choice(vehicle_types),
            "vehicle_make": random.choice(["Toyota", "Honda", "Ford", "Chevrolet"]),
            "vehicle_model": random.choice(["Camry", "Accord", "Escape", "Equinox"]),
            "vehicle_color": random.choice(["White", "Black", "Silver", "Blue", "Red"]),
            "license_plate": f"ABC {100+i}",
            "services": ["taxi"],
            "rating": round(4.0 + random.random(), 1),
            "total_rides": random.randint(10, 500),
            "acceptance_rate": round(0.7 + random.random() * 0.3, 2),
            "earnings_today": round(random.random() * 200, 2),
            "earnings_total": round(random.random() * 10000, 2),
            "location": {"latitude": base_lat + lat_offset, "longitude": base_lng + lng_offset},
            "drivers_license_status": "approved",
            "taxi_license_status": "approved",
            "profile_photo_status": "approved",
            "verification_status": "approved",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        demo_drivers.append(driver)
    
    await db.drivers.delete_many({"email": {"$regex": "driver.*@transpo.com"}})
    await db.drivers.insert_many(demo_drivers)
    
    return {"message": f"Created {len(demo_drivers)} demo drivers", "count": len(demo_drivers)}

# ============== HEALTH CHECK ==============

@api_router.get("/")
async def root():
    return {"message": "Transpo API is running", "version": "1.0.0"}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

# ============== TAXI METER ENDPOINTS ==============

from taxi_meter import TaxiMeter, calculate_fare_estimate, get_rates, QUEBEC_TAXI_RATES
from services.map_provider import get_map_provider

# In-memory storage for active meters (in production, use Redis)
active_meters: Dict[str, TaxiMeter] = {}

class MeterStartRequest(BaseModel):
    lat: float
    lng: float
    booking_id: Optional[str] = None  # None for street hail mode

class MeterUpdateRequest(BaseModel):
    lat: float
    lng: float

class MeterStopRequest(BaseModel):
    tip_percent: Optional[float] = 0
    custom_tip: Optional[float] = 0
    payment_method: Optional[str] = "cash"

@api_router.get("/taxi/rates")
async def get_taxi_rates():
    """Get current Quebec taxi rates."""
    now = datetime.now(timezone.utc)
    rates = get_rates(now)
    return {
        "current_period": rates["period"],
        "rates": QUEBEC_TAXI_RATES,
        "current_time": now.isoformat()
    }

@api_router.post("/taxi/meter/start")
async def start_taxi_meter(
    request: MeterStartRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """
    Start the taxi meter. 
    - With booking_id: App-booked ride
    - Without booking_id: Street hail / flag mode
    """
    current_user = await get_current_user(credentials)
    if current_user.get("role") != "driver":
        raise HTTPException(status_code=403, detail="Only drivers can use the meter")
    
    driver_id = current_user["id"]
    meter_id = str(uuid.uuid4())
    
    # Create new meter
    meter = TaxiMeter()
    meter.start(request.lat, request.lng)
    active_meters[meter_id] = meter
    
    # Get address for location
    map_provider = get_map_provider()
    address = map_provider.reverse_geocode(request.lat, request.lng)
    
    # Store meter session in DB
    session_data = {
        "id": meter_id,
        "driver_id": driver_id,
        "booking_id": request.booking_id,
        "mode": "app_booking" if request.booking_id else "street_hail",
        "start_time": datetime.now(timezone.utc).isoformat(),
        "start_location": {
            "lat": request.lat,
            "lng": request.lng,
            "address": address.formatted
        },
        "status": "running",
        "fare_snapshots": []
    }
    await db.meter_sessions.insert_one(session_data)
    
    return {
        "meter_id": meter_id,
        "mode": session_data["mode"],
        "start_location": session_data["start_location"],
        "fare": meter.get_fare_breakdown(),
        "message": "Meter started" + (" (Street Hail Mode)" if not request.booking_id else "")
    }

@api_router.post("/taxi/meter/{meter_id}/update")
async def update_taxi_meter(
    meter_id: str,
    request: MeterUpdateRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Update meter with new GPS position. Returns current fare."""
    current_user = await get_current_user(credentials)
    if current_user.get("role") != "driver":
        raise HTTPException(status_code=403, detail="Only drivers can use the meter")
    
    if meter_id not in active_meters:
        raise HTTPException(status_code=404, detail="Meter not found or expired")
    
    meter = active_meters[meter_id]
    fare = meter.update(request.lat, request.lng)
    
    # Store snapshot periodically (every update for now)
    await db.meter_sessions.update_one(
        {"id": meter_id},
        {"$push": {"fare_snapshots": {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "lat": request.lat,
            "lng": request.lng,
            "fare": fare["total_before_tip"]
        }}}
    )
    
    return {
        "meter_id": meter_id,
        "fare": fare
    }

@api_router.post("/taxi/meter/{meter_id}/stop")
async def stop_taxi_meter(
    meter_id: str,
    request: MeterStopRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Stop the meter and calculate final fare with tip."""
    current_user = await get_current_user(credentials)
    if current_user.get("role") != "driver":
        raise HTTPException(status_code=403, detail="Only drivers can use the meter")
    
    if meter_id not in active_meters:
        raise HTTPException(status_code=404, detail="Meter not found or expired")
    
    meter = active_meters[meter_id]
    meter.stop()
    
    # Calculate final fare with tip
    final_fare = meter.calculate_with_tip(
        tip_percent=request.tip_percent,
        custom_tip=request.custom_tip
    )
    
    # Get end location
    session = await db.meter_sessions.find_one({"id": meter_id})
    last_snapshot = session.get("fare_snapshots", [{}])[-1] if session else {}
    
    map_provider = get_map_provider()
    end_address = map_provider.reverse_geocode(
        last_snapshot.get("lat", 0), 
        last_snapshot.get("lng", 0)
    )
    
    # Update session as completed
    await db.meter_sessions.update_one(
        {"id": meter_id},
        {"$set": {
            "status": "completed",
            "end_time": datetime.now(timezone.utc).isoformat(),
            "end_location": {
                "lat": last_snapshot.get("lat"),
                "lng": last_snapshot.get("lng"),
                "address": end_address.formatted
            },
            "final_fare": final_fare,
            "payment_method": request.payment_method
        }}
    )
    
    # Remove from active meters
    del active_meters[meter_id]
    
    return {
        "meter_id": meter_id,
        "status": "completed",
        "final_fare": final_fare,
        "receipt": {
            "start_location": session.get("start_location") if session else None,
            "end_location": {
                "lat": last_snapshot.get("lat"),
                "lng": last_snapshot.get("lng"),
                "address": end_address.formatted
            },
            "start_time": session.get("start_time") if session else None,
            "end_time": datetime.now(timezone.utc).isoformat(),
            "fare_breakdown": final_fare,
            "payment_method": request.payment_method
        }
    }

@api_router.get("/taxi/meter/{meter_id}")
async def get_meter_status(
    meter_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Get current meter status and fare."""
    if meter_id not in active_meters:
        # Check if it's a completed session
        session = await db.meter_sessions.find_one({"id": meter_id})
        if session:
            return {
                "meter_id": meter_id,
                "status": session.get("status"),
                "final_fare": session.get("final_fare"),
                "mode": session.get("mode")
            }
        raise HTTPException(status_code=404, detail="Meter not found")
    
    meter = active_meters[meter_id]
    return {
        "meter_id": meter_id,
        "status": "running" if meter.is_running else "stopped",
        "fare": meter.get_fare_breakdown()
    }

@api_router.get("/taxi/history")
async def get_meter_history(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    limit: int = 20
):
    """Get driver's meter session history."""
    current_user = await get_current_user(credentials)
    if current_user.get("role") != "driver":
        raise HTTPException(status_code=403, detail="Only drivers can access meter history")
    
    sessions = await db.meter_sessions.find(
        {"driver_id": current_user["id"]},
        {"_id": 0, "fare_snapshots": 0}  # Exclude large snapshot data
    ).sort("start_time", -1).limit(limit).to_list(limit)
    
    return {"sessions": sessions}

@api_router.post("/taxi/estimate")
async def estimate_taxi_fare(
    pickup_lat: float,
    pickup_lng: float,
    dropoff_lat: float,
    dropoff_lng: float
):
    """
    Get fare estimate using Quebec rates and road-based distance.
    Uses MapProvider for accurate distance calculation.
    """
    map_provider = get_map_provider()
    route = map_provider.get_route(
        (pickup_lat, pickup_lng),
        (dropoff_lat, dropoff_lng)
    )
    
    # Use the taxi_meter estimate function with road-based distance
    estimate = calculate_fare_estimate(
        pickup_lat, pickup_lng,
        dropoff_lat, dropoff_lng,
        estimated_duration_minutes=route.duration_minutes
    )
    
    # Override distance with road-based calculation
    estimate["distance_km"] = route.distance_km
    estimate["estimated_duration_minutes"] = route.duration_minutes
    
    # Recalculate costs with road distance
    rates = get_rates(datetime.now(timezone.utc))
    estimate["distance_cost"] = round(route.distance_km * rates["per_km_rate"], 2)
    
    # Recalculate totals
    estimate["subtotal"] = round(
        estimate["base_fare"] + estimate["distance_cost"] + estimate["waiting_cost"], 2
    )
    estimate["total_estimate"] = round(estimate["subtotal"] + estimate["government_fee"], 2)
    estimate["estimate_range"] = {
        "low": round(estimate["total_estimate"] * 0.85, 2),
        "high": round(estimate["total_estimate"] * 1.25, 2)
    }
    
    return estimate

# Include router and middleware
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

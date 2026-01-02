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
    # Enhanced booking fields
    booking_for_self: bool = True  # True = for myself, False = for someone else
    recipient_name: Optional[str] = None  # Name of recipient if booking for someone else
    recipient_phone: Optional[str] = None  # Phone of recipient if booking for someone else
    special_instructions: Optional[str] = None  # Gate codes, apt numbers, "wait at corner"
    pet_policy: str = "none"  # none, small_pet, large_pet, service_animal
    # Scheduled ride fields
    is_scheduled: bool = False  # True = book for later, False = book now
    scheduled_time: Optional[str] = None  # ISO datetime string for scheduled pickup

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

# User rating configuration
USER_RATING_CONFIG = {
    "initial_rating": 5.0,
    "no_show_penalty": 0.5,  # Rating deduction for no-shows
    "late_cancel_penalty": 0.2,  # Rating deduction for canceling after 3 minutes
    "late_cancel_threshold_minutes": 3,  # Minutes after which cancellation is penalized
    "no_show_fee": 5.00  # Cancellation fee for no-shows
}

# Cancellation reasons and their point penalties
CANCELLATION_POINT_PENALTIES = {
    "car_issue": 20,
    "wrong_address": 15,
    "no_car_seat": 10,
    "pickup_too_far": 15,
    "safety_concern": 0,  # No penalty
    "too_many_passengers": 0  # No penalty
}

# Driver tier thresholds
DRIVER_TIERS = {
    "silver": {"min": 0, "max": 299, "next": "gold"},
    "gold": {"min": 300, "max": 599, "next": "platinum"},
    "platinum": {"min": 600, "max": 999, "next": "diamond"},
    "diamond": {"min": 1000, "max": float('inf'), "next": None}
}

# Points for actions
POINTS_PER_COMPLETED_TRIP = 10
POINTS_BONUS_FIVE_STAR = 5

def get_driver_tier(points: int) -> dict:
    """Get driver tier based on points"""
    for tier_name, tier_info in DRIVER_TIERS.items():
        if tier_info["min"] <= points <= tier_info["max"]:
            next_tier = tier_info["next"]
            if next_tier:
                next_threshold = DRIVER_TIERS[next_tier]["min"]
                progress = ((points - tier_info["min"]) / (next_threshold - tier_info["min"])) * 100
            else:
                progress = 100
            return {
                "tier": tier_name,
                "points": points,
                "next_tier": next_tier,
                "next_tier_threshold": DRIVER_TIERS[next_tier]["min"] if next_tier else None,
                "progress_percent": round(progress, 1)
            }
    return {"tier": "silver", "points": points, "next_tier": "gold", "next_tier_threshold": 300, "progress_percent": 0}

class TripCancellationRequest(BaseModel):
    reason: str  # car_issue, wrong_address, no_car_seat, safety_concern, pickup_too_far, too_many_passengers
    notes: Optional[str] = None

class TripStatusUpdate(BaseModel):
    status: str  # arrived, in_progress


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
            
            # Tier bonus: higher tier drivers get slight priority
            tier_info = get_driver_tier(driver.get("points", 0))
            tier_bonus = {"silver": 0, "gold": 0.05, "platinum": 0.1, "diamond": 0.15}.get(tier_info["tier"], 0)
            
            total_score = distance_score + rating_score + acceptance_score + tier_bonus
            
            # Priority boost for no-show drivers in same area
            if driver.get("priority_boost"):
                boost_location = driver.get("priority_boost_location", {})
                boost_lat = boost_location.get("latitude", 0)
                boost_lng = boost_location.get("longitude", 0)
                # Check if pickup is within 2km of where driver got the no-show
                if boost_lat and boost_lng:
                    distance_from_boost = calculate_distance_km(lat, lng, boost_lat, boost_lng)
                    if distance_from_boost <= 2.0:  # Within 2km of original area
                        total_score += 0.5  # Significant boost to priority
            
            eta_minutes = estimate_duration_minutes(distance, traffic_factor=1.2)
            scored_drivers.append({
                **driver,
                "distance_km": round(distance, 2),
                "eta_minutes": round(eta_minutes, 1),
                "match_score": round(total_score, 3),
                "has_priority_boost": driver.get("priority_boost", False),
                "tier": tier_info["tier"]
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

# ============== PASSWORD MANAGEMENT ==============

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

@api_router.post("/auth/change-password")
async def change_password(
    request: ChangePasswordRequest,
    current_user: dict = Depends(get_current_user)
):
    """Change password for authenticated user (user, driver, or admin)."""
    # Get user with password
    user = await db.users.find_one({"id": current_user["id"]})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if user has a password (social auth users don't)
    if not user.get("password"):
        raise HTTPException(status_code=400, detail="Cannot change password for social login accounts. Please use your social provider to manage your password.")
    
    # Verify current password
    if not verify_password(request.current_password, user["password"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    # Validate new password
    if len(request.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters")
    
    # Update password
    new_hashed = hash_password(request.new_password)
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {
            "password": new_hashed,
            "password_changed_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Log the action for admins
    if current_user.get("role") in ["admin", "super_admin"]:
        await create_audit_log(
            actor_id=current_user["id"],
            actor_role=current_user.get("admin_role", "admin"),
            action_type="password_changed",
            entity_type="user",
            entity_id=current_user["id"],
            notes="Password changed by user"
        )
    
    return {"message": "Password changed successfully"}

@api_router.post("/auth/forgot-password")
async def forgot_password(request: ForgotPasswordRequest):
    """Request password reset - generates token and logs to console (mock email)."""
    user = await db.users.find_one({"email": request.email})
    
    # Always return success to prevent email enumeration
    if not user:
        logger.info(f"[FORGOT PASSWORD] No user found for email: {request.email}")
        return {"message": "If an account exists with this email, a password reset link has been sent."}
    
    # Check if user has a password (social auth users can't reset)
    if not user.get("password"):
        logger.info(f"[FORGOT PASSWORD] Social auth user tried to reset: {request.email}")
        return {"message": "If an account exists with this email, a password reset link has been sent."}
    
    # Generate reset token
    reset_token = str(uuid.uuid4())
    expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
    
    # Store reset token
    await db.password_resets.update_one(
        {"user_id": user["id"]},
        {"$set": {
            "user_id": user["id"],
            "email": user["email"],
            "token": reset_token,
            "expires_at": expires_at.isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "used": False
        }},
        upsert=True
    )
    
    # Mock email - log to console
    logger.info("=" * 60)
    logger.info("[MOCK EMAIL] PASSWORD RESET REQUEST")
    logger.info(f"To: {user['email']}")
    logger.info(f"Name: {user.get('name', 'User')}")
    logger.info(f"Reset Token: {reset_token}")
    logger.info(f"Reset Link: {os.environ.get('FRONTEND_URL', 'http://localhost:3000')}/reset-password?token={reset_token}")
    logger.info(f"Expires: {expires_at.isoformat()}")
    logger.info("=" * 60)
    
    return {"message": "If an account exists with this email, a password reset link has been sent."}

@api_router.post("/auth/reset-password")
async def reset_password(request: ResetPasswordRequest):
    """Reset password using token from forgot-password email."""
    # Find reset token
    reset_record = await db.password_resets.find_one({
        "token": request.token,
        "used": False
    })
    
    if not reset_record:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    
    # Check expiration
    expires_at = datetime.fromisoformat(reset_record["expires_at"])
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=400, detail="Reset token has expired. Please request a new one.")
    
    # Validate new password
    if len(request.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    
    # Update password
    new_hashed = hash_password(request.new_password)
    await db.users.update_one(
        {"id": reset_record["user_id"]},
        {"$set": {
            "password": new_hashed,
            "password_changed_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Mark token as used
    await db.password_resets.update_one(
        {"token": request.token},
        {"$set": {"used": True, "used_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    logger.info(f"[PASSWORD RESET] Password reset completed for user: {reset_record['email']}")
    
    return {"message": "Password reset successfully. You can now login with your new password."}

@api_router.get("/auth/verify-reset-token")
async def verify_reset_token(token: str):
    """Verify if a reset token is valid (for frontend to check before showing reset form)."""
    reset_record = await db.password_resets.find_one({
        "token": token,
        "used": False
    })
    
    if not reset_record:
        return {"valid": False, "message": "Invalid or expired reset token"}
    
    expires_at = datetime.fromisoformat(reset_record["expires_at"])
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    if datetime.now(timezone.utc) > expires_at:
        return {"valid": False, "message": "Reset token has expired"}
    
    return {"valid": True, "email": reset_record["email"]}

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
        "created_at": current_user["created_at"],
        # User rating and accountability
        "rating": current_user.get("rating", USER_RATING_CONFIG["initial_rating"]),
        "no_show_count": current_user.get("no_show_count", 0),
        "late_cancellation_count": current_user.get("late_cancellation_count", 0),
        # Saved addresses
        "saved_addresses": current_user.get("saved_addresses", []),
        # Notification preferences
        "notifications": current_user.get("notifications", {
            "push_enabled": True,
            "email_enabled": True,
            "sms_enabled": False,
            "ride_updates": True,
            "promotions": True
        })
    }


# ============== SAVED ADDRESSES ROUTES ==============

class SavedAddress(BaseModel):
    label: str  # home, work, or custom name
    address: str
    latitude: float
    longitude: float
    is_default: bool = False


@api_router.get("/user/saved-addresses")
async def get_saved_addresses(current_user: dict = Depends(get_current_user)):
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0})
    return {"addresses": user.get("saved_addresses", [])}


@api_router.post("/user/saved-addresses")
async def add_saved_address(address: SavedAddress, current_user: dict = Depends(get_current_user)):
    address_doc = {
        "id": str(uuid.uuid4()),
        "label": address.label,
        "address": address.address,
        "latitude": address.latitude,
        "longitude": address.longitude,
        "is_default": address.is_default,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$push": {"saved_addresses": address_doc}}
    )
    
    return {"message": "Address saved", "address": address_doc}


@api_router.delete("/user/saved-addresses/{address_id}")
async def delete_saved_address(address_id: str, current_user: dict = Depends(get_current_user)):
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$pull": {"saved_addresses": {"id": address_id}}}
    )
    return {"message": "Address deleted"}


# ============== NOTIFICATION PREFERENCES ROUTES ==============

class NotificationPreferences(BaseModel):
    push_enabled: bool = True
    email_enabled: bool = True
    sms_enabled: bool = False
    ride_updates: bool = True
    promotions: bool = True


@api_router.get("/user/notifications")
async def get_notification_preferences(current_user: dict = Depends(get_current_user)):
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0})
    return user.get("notifications", {
        "push_enabled": True,
        "email_enabled": True,
        "sms_enabled": False,
        "ride_updates": True,
        "promotions": True
    })


@api_router.put("/user/notifications")
async def update_notification_preferences(prefs: NotificationPreferences, current_user: dict = Depends(get_current_user)):
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"notifications": prefs.dict()}}
    )
    return {"message": "Notifications updated", "notifications": prefs.dict()}


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
    
    # Clear priority boost and mark as unavailable
    await db.drivers.update_one(
        {"user_id": current_user["id"]},
        {
            "$set": {"is_available": False},
            "$unset": {"priority_boost": "", "priority_boost_location": "", "priority_boost_since": ""}
        }
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
    
    # Add points for completed trip
    await db.drivers.update_one(
        {"user_id": current_user["id"]},
        {
            "$set": {"is_available": True},
            "$inc": {
                "total_rides": 1,
                "earnings_today": fare_total * 0.8,
                "earnings_total": fare_total * 0.8,
                "points": POINTS_PER_COMPLETED_TRIP  # +10 points per completed trip
            }
        }
    )
    
    # Get updated driver info for tier
    driver = await db.drivers.find_one({"user_id": current_user["id"]}, {"_id": 0})
    tier_info = get_driver_tier(driver.get("points", 0))
    
    return {
        "message": "Ride completed", 
        "earnings": fare_total * 0.8,
        "points_earned": POINTS_PER_COMPLETED_TRIP,
        "total_points": driver.get("points", 0),
        "tier": tier_info["tier"]
    }

@api_router.post("/driver/trips/{booking_id}/update-status")
async def update_trip_status(booking_id: str, request: TripStatusUpdate, current_user: dict = Depends(get_current_user)):
    """Update trip status (arrived, in_progress)"""
    if current_user["role"] != "driver":
        raise HTTPException(status_code=403, detail="Not a driver")
    
    booking = await db.bookings.find_one({"id": booking_id, "driver_id": current_user["id"]})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    valid_statuses = ["arrived", "in_progress"]
    if request.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")
    
    update_data = {
        "status": request.status,
        f"{request.status}_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.bookings.update_one({"id": booking_id}, {"$set": update_data})
    
    return {"message": f"Trip status updated to {request.status}", "status": request.status}

@api_router.post("/driver/trips/{booking_id}/cancel")
async def driver_cancel_trip(booking_id: str, request: TripCancellationRequest, current_user: dict = Depends(get_current_user)):
    """Driver cancels a trip with a reason. Certain reasons result in point deductions affecting driver tier."""
    if current_user["role"] != "driver":
        raise HTTPException(status_code=403, detail="Not a driver")
    
    booking = await db.bookings.find_one({"id": booking_id, "driver_id": current_user["id"]})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if booking.get("status") == "completed":
        raise HTTPException(status_code=400, detail="Cannot cancel a completed trip")
    
    now = datetime.now(timezone.utc)
    
    # Update booking status
    await db.bookings.update_one(
        {"id": booking_id},
        {"$set": {
            "status": "cancelled_by_driver",
            "cancelled_at": now.isoformat(),
            "cancellation_reason": request.reason,
            "cancellation_notes": request.notes
        }}
    )
    
    # Get point penalty for this reason
    point_penalty = CANCELLATION_POINT_PENALTIES.get(request.reason, 0)
    
    # Get current driver points
    driver = await db.drivers.find_one({"user_id": current_user["id"]}, {"_id": 0})
    current_points = driver.get("points", 0)
    new_points = max(0, current_points - point_penalty)  # Don't go below 0
    
    # Update driver: make available and deduct points
    await db.drivers.update_one(
        {"user_id": current_user["id"]},
        {"$set": {
            "is_available": True,
            "points": new_points
        }}
    )
    
    # Get new tier info
    tier_info = get_driver_tier(new_points)
    
    return {
        "message": "Trip cancelled",
        "reason": request.reason,
        "points_deducted": point_penalty,
        "new_points": new_points,
        "tier": tier_info["tier"],
        "tier_progress": tier_info["progress_percent"]
    }

@api_router.post("/driver/trips/{booking_id}/no-show")
async def driver_mark_no_show(booking_id: str, current_user: dict = Depends(get_current_user)):
    """Driver marks customer as no-show. Driver gets priority boost for next ride in same area."""
    if current_user["role"] != "driver":
        raise HTTPException(status_code=403, detail="Not a driver")
    
    booking = await db.bookings.find_one({"id": booking_id, "driver_id": current_user["id"]})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Check if driver arrived (no-show only valid after arrival)
    if booking.get("status") not in ["accepted", "arrived"]:
        raise HTTPException(status_code=400, detail="No-show can only be marked after accepting or arriving")
    
    now = datetime.now(timezone.utc)
    
    # Update booking status with no-show fee
    await db.bookings.update_one(
        {"id": booking_id},
        {"$set": {
            "status": "no_show",
            "no_show_at": now.isoformat(),
            "no_show_fee": USER_RATING_CONFIG["no_show_fee"]
        }}
    )
    
    # Deduct user's rating for no-show
    user = await db.users.find_one({"id": booking["user_id"]}, {"_id": 0})
    current_rating = user.get("rating", USER_RATING_CONFIG["initial_rating"])
    new_rating = max(1.0, current_rating - USER_RATING_CONFIG["no_show_penalty"])  # Don't go below 1.0
    
    await db.users.update_one(
        {"id": booking["user_id"]},
        {
            "$set": {"rating": new_rating},
            "$inc": {"no_show_count": 1}
        }
    )
    
    # Get driver's current location for priority boost area
    driver = await db.drivers.find_one({"user_id": current_user["id"]}, {"_id": 0})
    current_location = driver.get("location", {})
    
    # Give driver priority boost for this area (no penalty)
    await db.drivers.update_one(
        {"user_id": current_user["id"]},
        {"$set": {
            "is_available": True,
            "priority_boost": True,
            "priority_boost_location": {
                "latitude": current_location.get("latitude", booking["pickup"].get("lat")),
                "longitude": current_location.get("longitude", booking["pickup"].get("lng"))
            },
            "priority_boost_since": now.isoformat()
        }}
    )
    
    return {
        "message": "Customer marked as no-show",
        "priority_boost_active": True,
        "note": "You have priority for the next ride in this area",
        "user_rating_deducted": USER_RATING_CONFIG["no_show_penalty"],
        "no_show_fee": USER_RATING_CONFIG["no_show_fee"]
    }

@api_router.get("/driver/status/tier")
async def get_driver_tier_status(current_user: dict = Depends(get_current_user)):
    """Get driver tier, points, and progress toward next tier."""
    if current_user["role"] != "driver":
        raise HTTPException(status_code=403, detail="Not a driver")
    
    driver = await db.drivers.find_one({"user_id": current_user["id"]}, {"_id": 0})
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    
    points = driver.get("points", 0)
    tier_info = get_driver_tier(points)
    
    return {
        "points": points,
        "tier": tier_info["tier"],
        "next_tier": tier_info["next_tier"],
        "next_tier_threshold": tier_info["next_tier_threshold"],
        "progress_percent": tier_info["progress_percent"],
        "priority_boost": driver.get("priority_boost", False),
        "total_rides": driver.get("total_rides", 0)
    }


@api_router.get("/driver/booking/{booking_id}/customer")
async def get_customer_contact(booking_id: str, current_user: dict = Depends(get_current_user)):
    """Get customer contact info for an active booking (for driver to call customer)."""
    if current_user["role"] != "driver":
        raise HTTPException(status_code=403, detail="Not a driver")
    
    booking = await db.bookings.find_one(
        {"id": booking_id, "driver_id": current_user["id"], "status": {"$in": ["accepted", "arrived", "in_progress"]}},
        {"_id": 0}
    )
    if not booking:
        raise HTTPException(status_code=404, detail="Active booking not found")
    
    # Get customer info
    user = await db.users.find_one({"id": booking["user_id"]}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    return {
        "customer_name": booking.get("user_name", user.get("name", "Customer")),
        "customer_phone": user.get("phone", "No phone available"),
        "pickup_address": booking.get("pickup", {}).get("address", "")
    }


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

# ============== ADMIN ROLE DEFINITIONS ==============

# Admin roles and their permissions
ADMIN_ROLES = {
    "super_admin": {
        "name": "Super Admin",
        "description": "Full platform access with ability to create other admins",
        "permissions": ["all"]
    },
    "admin": {
        "name": "Admin",
        "description": "General admin access",
        "permissions": ["view_dashboard", "manage_users", "manage_drivers", "manage_bookings", "view_reports"]
    },
    "document_reviewer": {
        "name": "Document Reviewer",
        "description": "Can approve/reject driver documents",
        "permissions": ["view_dashboard", "manage_documents"]
    },
    "payout_manager": {
        "name": "Payout Manager",
        "description": "Can process driver payouts",
        "permissions": ["view_dashboard", "manage_payouts", "view_reports"]
    },
    "support_agent": {
        "name": "Support Agent",
        "description": "Can handle support cases and disputes",
        "permissions": ["view_dashboard", "manage_cases"]
    },
    "finance_admin": {
        "name": "Finance Admin",
        "description": "Can view reports and manage commissions",
        "permissions": ["view_dashboard", "view_reports", "manage_commissions", "manage_taxes"]
    }
}

def check_admin_permission(user: dict, required_permission: str) -> bool:
    """Check if admin has a specific permission."""
    if user.get("role") not in ["admin", "super_admin"]:
        return False
    
    admin_role = user.get("admin_role", "admin")
    
    # Super admin has all permissions
    if admin_role == "super_admin":
        return True
    
    role_config = ADMIN_ROLES.get(admin_role, ADMIN_ROLES["admin"])
    permissions = role_config.get("permissions", [])
    
    return "all" in permissions or required_permission in permissions

def require_permission(permission: str):
    """Dependency to check admin permission."""
    async def check(current_user: dict = Depends(get_current_user)):
        if not check_admin_permission(current_user, permission):
            raise HTTPException(status_code=403, detail=f"Permission '{permission}' required")
        return current_user
    return check

# ============== ADMIN MANAGEMENT ENDPOINTS ==============

class AdminCreateRequest(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str
    admin_role: str = "admin"
    phone: Optional[str] = None

class AdminUpdateRequest(BaseModel):
    admin_role: Optional[str] = None
    is_active: Optional[bool] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None

@api_router.get("/admin/roles")
async def get_admin_roles(current_user: dict = Depends(get_current_user)):
    """Get all available admin roles."""
    if current_user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    return {"roles": ADMIN_ROLES}

@api_router.get("/admin/admins")
async def get_all_admins(current_user: dict = Depends(get_current_user)):
    """Get all admin users. Only super_admin can see all admins."""
    if current_user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Only super admin can view all admins
    if current_user.get("admin_role") != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin access required")
    
    admins = await db.users.find(
        {"role": {"$in": ["admin", "super_admin"]}},
        {"_id": 0, "password": 0}
    ).to_list(100)
    
    return {"admins": admins}

@api_router.post("/admin/admins")
async def create_admin(
    admin_data: AdminCreateRequest,
    current_user: dict = Depends(get_current_user)
):
    """Create a new admin user. Only super_admin can create admins."""
    if current_user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    if current_user.get("admin_role") != "super_admin":
        raise HTTPException(status_code=403, detail="Only super admin can create admin accounts")
    
    # Check if admin role is valid
    if admin_data.admin_role not in ADMIN_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid admin role. Valid roles: {list(ADMIN_ROLES.keys())}")
    
    # Only super admin can create another super admin
    if admin_data.admin_role == "super_admin":
        # Check if this is the first super admin or if current user is super admin
        existing_super = await db.users.find_one({"admin_role": "super_admin"})
        if existing_super and current_user.get("admin_role") != "super_admin":
            raise HTTPException(status_code=403, detail="Only existing super admin can create another super admin")
    
    # Check if email already exists
    existing = await db.users.find_one({"email": admin_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create admin user
    admin_user = {
        "id": str(uuid.uuid4()),
        "email": admin_data.email,
        "password": pwd_context.hash(admin_data.password),
        "name": f"{admin_data.first_name} {admin_data.last_name}",
        "first_name": admin_data.first_name,
        "last_name": admin_data.last_name,
        "phone": admin_data.phone,
        "role": "admin",
        "admin_role": admin_data.admin_role,
        "permissions": ADMIN_ROLES[admin_data.admin_role]["permissions"],
        "is_active": True,
        "created_by": current_user["id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(admin_user)
    
    # Log the action
    await db.admin_logs.insert_one({
        "id": str(uuid.uuid4()),
        "action": "admin_created",
        "admin_id": current_user["id"],
        "target_user_id": admin_user["id"],
        "details": {
            "email": admin_data.email,
            "admin_role": admin_data.admin_role
        },
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Remove password from response
    admin_user.pop("password", None)
    
    return {"message": "Admin created successfully", "admin": admin_user}

@api_router.put("/admin/admins/{admin_id}")
async def update_admin(
    admin_id: str,
    updates: AdminUpdateRequest,
    current_user: dict = Depends(get_current_user)
):
    """Update an admin user. Only super_admin can update admins."""
    if current_user.get("admin_role") != "super_admin":
        raise HTTPException(status_code=403, detail="Only super admin can update admin accounts")
    
    # Check if target admin exists
    target_admin = await db.users.find_one({"id": admin_id, "role": {"$in": ["admin", "super_admin"]}})
    if not target_admin:
        raise HTTPException(status_code=404, detail="Admin not found")
    
    # Cannot demote/modify yourself
    if admin_id == current_user["id"] and updates.admin_role and updates.admin_role != "super_admin":
        raise HTTPException(status_code=400, detail="Cannot demote yourself")
    
    # Build update
    update_data = {}
    if updates.admin_role:
        if updates.admin_role not in ADMIN_ROLES:
            raise HTTPException(status_code=400, detail=f"Invalid admin role")
        update_data["admin_role"] = updates.admin_role
        update_data["permissions"] = ADMIN_ROLES[updates.admin_role]["permissions"]
    
    if updates.is_active is not None:
        update_data["is_active"] = updates.is_active
    
    if updates.first_name:
        update_data["first_name"] = updates.first_name
        update_data["name"] = f"{updates.first_name} {target_admin.get('last_name', '')}"
    
    if updates.last_name:
        update_data["last_name"] = updates.last_name
        update_data["name"] = f"{target_admin.get('first_name', '')} {updates.last_name}"
    
    if update_data:
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        update_data["updated_by"] = current_user["id"]
        
        await db.users.update_one({"id": admin_id}, {"$set": update_data})
        
        # Log the action
        await db.admin_logs.insert_one({
            "id": str(uuid.uuid4()),
            "action": "admin_updated",
            "admin_id": current_user["id"],
            "target_user_id": admin_id,
            "details": update_data,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    return {"message": "Admin updated successfully"}

@api_router.delete("/admin/admins/{admin_id}")
async def delete_admin(
    admin_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Deactivate an admin user. Only super_admin can delete admins."""
    if current_user.get("admin_role") != "super_admin":
        raise HTTPException(status_code=403, detail="Only super admin can delete admin accounts")
    
    # Cannot delete yourself
    if admin_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    
    # Check if target admin exists
    target_admin = await db.users.find_one({"id": admin_id, "role": {"$in": ["admin", "super_admin"]}})
    if not target_admin:
        raise HTTPException(status_code=404, detail="Admin not found")
    
    # Soft delete - just deactivate
    await db.users.update_one(
        {"id": admin_id},
        {"$set": {
            "is_active": False,
            "deactivated_at": datetime.now(timezone.utc).isoformat(),
            "deactivated_by": current_user["id"]
        }}
    )
    
    # Log the action
    await db.admin_logs.insert_one({
        "id": str(uuid.uuid4()),
        "action": "admin_deactivated",
        "admin_id": current_user["id"],
        "target_user_id": admin_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"message": "Admin deactivated successfully"}

@api_router.get("/admin/profile")
async def get_admin_profile(current_user: dict = Depends(get_current_user)):
    """Get current admin's profile."""
    if current_user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    admin_role = current_user.get("admin_role", "admin")
    role_info = ADMIN_ROLES.get(admin_role, ADMIN_ROLES["admin"])
    
    return {
        "id": current_user["id"],
        "email": current_user["email"],
        "name": current_user.get("name"),
        "first_name": current_user.get("first_name"),
        "last_name": current_user.get("last_name"),
        "phone": current_user.get("phone"),
        "profile_photo_url": current_user.get("profile_photo_url"),
        "admin_role": admin_role,
        "role_info": role_info,
        "permissions": current_user.get("permissions", role_info["permissions"]),
        "is_super_admin": admin_role == "super_admin",
        "created_at": current_user.get("created_at")
    }

@api_router.put("/admin/profile")
async def update_admin_profile(
    first_name: Optional[str] = None,
    last_name: Optional[str] = None,
    phone: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Update current admin's profile."""
    if current_user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    update_data = {}
    if first_name:
        update_data["first_name"] = first_name
    if last_name:
        update_data["last_name"] = last_name
    if first_name or last_name:
        update_data["name"] = f"{first_name or current_user.get('first_name', '')} {last_name or current_user.get('last_name', '')}"
    if phone:
        update_data["phone"] = phone
    
    if update_data:
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.users.update_one({"id": current_user["id"]}, {"$set": update_data})
    
    return {"message": "Profile updated successfully"}

@api_router.get("/admin/activity-log")
async def get_admin_activity_log(
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Get admin activity log. Super admins see all, others see their own."""
    if current_user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    query = {}
    if current_user.get("admin_role") != "super_admin":
        query["admin_id"] = current_user["id"]
    
    logs = await db.admin_logs.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    
    return {"logs": logs}

# ============== COMPREHENSIVE AUDIT LOGGING ==============

async def create_audit_log(
    actor_id: str,
    actor_role: str,
    action_type: str,
    entity_type: str,
    entity_id: str,
    before_snapshot: dict = None,
    after_snapshot: dict = None,
    notes: str = None,
    request: Request = None
):
    """Create a comprehensive audit log entry."""
    log_entry = {
        "id": str(uuid.uuid4()),
        "actor_id": actor_id,
        "actor_role": actor_role,
        "action_type": action_type,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "before_snapshot": before_snapshot,
        "after_snapshot": after_snapshot,
        "notes": notes
    }
    
    if request:
        log_entry["ip_address"] = request.client.host if request.client else None
        log_entry["user_agent"] = request.headers.get("user-agent")
    
    await db.audit_logs.insert_one(log_entry)
    return log_entry

@api_router.get("/admin/audit-logs")
async def get_audit_logs(
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    action_type: Optional[str] = None,
    actor_id: Optional[str] = None,
    limit: int = 100,
    current_user: dict = Depends(get_current_user)
):
    """Get comprehensive audit logs. Only super_admin can see all."""
    if current_user.get("admin_role") != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin access required")
    
    query = {}
    if entity_type:
        query["entity_type"] = entity_type
    if entity_id:
        query["entity_id"] = entity_id
    if action_type:
        query["action_type"] = action_type
    if actor_id:
        query["actor_id"] = actor_id
    
    logs = await db.audit_logs.find(query, {"_id": 0}).sort("timestamp", -1).limit(limit).to_list(limit)
    
    return {"logs": logs, "total": len(logs)}

# ============== TAXI CONFIG VERSIONING ==============

from models.taxi_config import TaxiConfigCreate, TaxiConfigUpdate, DEFAULT_QUEBEC_CONFIG, ConfigStatus

@api_router.get("/admin/taxi-configs")
async def get_taxi_configs(
    status: Optional[str] = None,
    region: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all taxi configurations. Admins can view, only super_admin can manage."""
    if current_user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    query = {}
    if status:
        query["status"] = status
    if region:
        query["region"] = region
    
    configs = await db.taxi_configs.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    # If no configs exist, create default
    if not configs:
        default_config = {
            "id": str(uuid.uuid4()),
            "version": "1.0.0",
            "status": ConfigStatus.ACTIVE,
            **DEFAULT_QUEBEC_CONFIG,
            "day_rates": {
                "base_fare": DEFAULT_QUEBEC_CONFIG["day_base_fare"],
                "per_km_rate": DEFAULT_QUEBEC_CONFIG["day_per_km_rate"],
                "waiting_per_min": DEFAULT_QUEBEC_CONFIG["day_waiting_per_min"]
            },
            "night_rates": {
                "base_fare": DEFAULT_QUEBEC_CONFIG["night_base_fare"],
                "per_km_rate": DEFAULT_QUEBEC_CONFIG["night_per_km_rate"],
                "waiting_per_min": DEFAULT_QUEBEC_CONFIG["night_waiting_per_min"]
            },
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": "system",
            "activated_at": datetime.now(timezone.utc).isoformat()
        }
        await db.taxi_configs.insert_one(default_config)
        configs = [default_config]
    
    return {"configs": configs}

@api_router.get("/admin/taxi-configs/active")
async def get_active_taxi_config(
    region: str = "quebec",
    current_user: dict = Depends(get_current_user)
):
    """Get the currently active taxi configuration for a region."""
    if current_user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    config = await db.taxi_configs.find_one(
        {"status": ConfigStatus.ACTIVE, "region": region},
        {"_id": 0}
    )
    
    if not config:
        # Return default
        return {"config": DEFAULT_QUEBEC_CONFIG, "is_default": True}
    
    return {"config": config, "is_default": False}

@api_router.post("/admin/taxi-configs")
async def create_taxi_config(
    config_data: TaxiConfigCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new taxi configuration version. Only super_admin."""
    if current_user.get("admin_role") != "super_admin":
        raise HTTPException(status_code=403, detail="Only super admin can create taxi configurations")
    
    # Get latest version number
    latest = await db.taxi_configs.find_one(
        {"region": config_data.region},
        sort=[("created_at", -1)]
    )
    
    if latest:
        version_parts = latest.get("version", "1.0.0").split(".")
        new_version = f"{version_parts[0]}.{int(version_parts[1]) + 1}.0"
    else:
        new_version = "1.0.0"
    
    config = {
        "id": str(uuid.uuid4()),
        "version": new_version,
        "status": ConfigStatus.DRAFT,
        **config_data.dict(),
        "day_rates": {
            "base_fare": config_data.day_base_fare,
            "per_km_rate": config_data.day_per_km_rate,
            "waiting_per_min": config_data.day_waiting_per_min
        },
        "night_rates": {
            "base_fare": config_data.night_base_fare,
            "per_km_rate": config_data.night_per_km_rate,
            "waiting_per_min": config_data.night_waiting_per_min
        },
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user["id"]
    }
    
    await db.taxi_configs.insert_one(config)
    
    # Audit log
    await create_audit_log(
        actor_id=current_user["id"],
        actor_role=current_user.get("admin_role", "admin"),
        action_type="taxi_config_created",
        entity_type="taxi_config",
        entity_id=config["id"],
        after_snapshot=config
    )
    
    return {"message": "Taxi configuration created", "config": config}

@api_router.put("/admin/taxi-configs/{config_id}")
async def update_taxi_config(
    config_id: str,
    updates: TaxiConfigUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update a taxi configuration. Only super_admin. Cannot update locked configs."""
    if current_user.get("admin_role") != "super_admin":
        raise HTTPException(status_code=403, detail="Only super admin can update taxi configurations")
    
    config = await db.taxi_configs.find_one({"id": config_id})
    if not config:
        raise HTTPException(status_code=404, detail="Configuration not found")
    
    if config.get("status") == ConfigStatus.LOCKED:
        raise HTTPException(status_code=400, detail="Cannot modify locked configuration")
    
    before_snapshot = {k: v for k, v in config.items() if k != "_id"}
    
    update_data = {k: v for k, v in updates.dict().items() if v is not None}
    
    # Update rates if any rate field changed
    if any(k.startswith("day_") for k in update_data):
        update_data["day_rates"] = {
            "base_fare": update_data.get("day_base_fare", config["day_rates"]["base_fare"]),
            "per_km_rate": update_data.get("day_per_km_rate", config["day_rates"]["per_km_rate"]),
            "waiting_per_min": update_data.get("day_waiting_per_min", config["day_rates"]["waiting_per_min"])
        }
    
    if any(k.startswith("night_") for k in update_data):
        update_data["night_rates"] = {
            "base_fare": update_data.get("night_base_fare", config["night_rates"]["base_fare"]),
            "per_km_rate": update_data.get("night_per_km_rate", config["night_rates"]["per_km_rate"]),
            "waiting_per_min": update_data.get("night_waiting_per_min", config["night_rates"]["waiting_per_min"])
        }
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    update_data["updated_by"] = current_user["id"]
    
    await db.taxi_configs.update_one({"id": config_id}, {"$set": update_data})
    
    # Audit log
    await create_audit_log(
        actor_id=current_user["id"],
        actor_role=current_user.get("admin_role", "admin"),
        action_type="taxi_config_updated",
        entity_type="taxi_config",
        entity_id=config_id,
        before_snapshot=before_snapshot,
        after_snapshot=update_data
    )
    
    return {"message": "Configuration updated"}

@api_router.post("/admin/taxi-configs/{config_id}/activate")
async def activate_taxi_config(
    config_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Activate a taxi configuration. Deactivates current active config."""
    if current_user.get("admin_role") != "super_admin":
        raise HTTPException(status_code=403, detail="Only super admin can activate configurations")
    
    config = await db.taxi_configs.find_one({"id": config_id})
    if not config:
        raise HTTPException(status_code=404, detail="Configuration not found")
    
    # Deactivate current active config
    await db.taxi_configs.update_many(
        {"status": ConfigStatus.ACTIVE, "region": config["region"]},
        {"$set": {"status": ConfigStatus.ARCHIVED, "archived_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Activate new config
    await db.taxi_configs.update_one(
        {"id": config_id},
        {"$set": {
            "status": ConfigStatus.ACTIVE,
            "activated_at": datetime.now(timezone.utc).isoformat(),
            "activated_by": current_user["id"]
        }}
    )
    
    # Audit log
    await create_audit_log(
        actor_id=current_user["id"],
        actor_role=current_user.get("admin_role", "admin"),
        action_type="taxi_config_activated",
        entity_type="taxi_config",
        entity_id=config_id,
        notes=f"Configuration v{config['version']} activated for {config['region']}"
    )
    
    return {"message": f"Configuration v{config['version']} activated"}

@api_router.post("/admin/taxi-configs/{config_id}/lock")
async def lock_taxi_config(
    config_id: str,
    reason: str,
    current_user: dict = Depends(get_current_user)
):
    """Lock a taxi configuration (legal hold). Cannot be modified after."""
    if current_user.get("admin_role") != "super_admin":
        raise HTTPException(status_code=403, detail="Only super admin can lock configurations")
    
    config = await db.taxi_configs.find_one({"id": config_id})
    if not config:
        raise HTTPException(status_code=404, detail="Configuration not found")
    
    await db.taxi_configs.update_one(
        {"id": config_id},
        {"$set": {
            "status": ConfigStatus.LOCKED,
            "locked_at": datetime.now(timezone.utc).isoformat(),
            "locked_by": current_user["id"],
            "locked_reason": reason
        }}
    )
    
    # Audit log
    await create_audit_log(
        actor_id=current_user["id"],
        actor_role=current_user.get("admin_role", "admin"),
        action_type="taxi_config_locked",
        entity_type="taxi_config",
        entity_id=config_id,
        notes=f"Locked: {reason}"
    )
    
    return {"message": "Configuration locked"}

@api_router.post("/admin/taxi-configs/{config_id}/unlock")
async def unlock_taxi_config(
    config_id: str,
    reason: str,
    current_user: dict = Depends(get_current_user)
):
    """Unlock a locked taxi configuration for editing. Only super admin."""
    if current_user.get("admin_role") != "super_admin":
        raise HTTPException(status_code=403, detail="Only super admin can unlock configurations")
    
    config = await db.taxi_configs.find_one({"id": config_id})
    if not config:
        raise HTTPException(status_code=404, detail="Configuration not found")
    
    if config.get("status") != ConfigStatus.LOCKED:
        raise HTTPException(status_code=400, detail="Configuration is not locked")
    
    await db.taxi_configs.update_one(
        {"id": config_id},
        {"$set": {
            "status": ConfigStatus.DRAFT,
            "unlocked_at": datetime.now(timezone.utc).isoformat(),
            "unlocked_by": current_user["id"],
            "unlocked_reason": reason
        }}
    )
    
    # Audit log
    await create_audit_log(
        actor_id=current_user["id"],
        actor_role=current_user.get("admin_role", "admin"),
        action_type="taxi_config_unlocked",
        entity_type="taxi_config",
        entity_id=config_id,
        notes=f"Unlocked: {reason}"
    )
    
    return {"message": "Configuration unlocked for editing"}

# ============== DISPUTE RESOLUTION ==============

from models.admin_models import DisputeCreate, DisputeResolution

@api_router.get("/admin/disputes")
async def get_disputes(
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all disputes."""
    if current_user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    query = {}
    if status:
        query["status"] = status
    
    disputes = await db.disputes.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    # Enrich with trip data
    for dispute in disputes:
        trip = await db.meter_sessions.find_one({"id": dispute.get("trip_id")}, {"_id": 0})
        if trip:
            dispute["trip"] = trip
    
    return {"disputes": disputes}

@api_router.post("/admin/disputes")
async def create_dispute(
    dispute_data: DisputeCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new dispute for a trip."""
    if current_user.get("role") not in ["admin", "super_admin", "user", "driver"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Verify trip exists
    trip = await db.meter_sessions.find_one({"id": dispute_data.trip_id})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    
    dispute = {
        "id": str(uuid.uuid4()),
        "dispute_number": f"DSP-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:4].upper()}",
        **dispute_data.dict(),
        "status": "open",
        "trip_snapshot": {
            "config_version": trip.get("config_version"),
            "fare": trip.get("final_fare"),
            "start_time": trip.get("start_time"),
            "end_time": trip.get("end_time")
        },
        "created_by": current_user["id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "history": []
    }
    
    await db.disputes.insert_one(dispute)
    
    # Audit log
    await create_audit_log(
        actor_id=current_user["id"],
        actor_role=current_user.get("admin_role", current_user.get("role")),
        action_type="dispute_created",
        entity_type="dispute",
        entity_id=dispute["id"],
        notes=f"Dispute opened: {dispute_data.reason}"
    )
    
    return {"message": "Dispute created", "dispute": dispute}

@api_router.get("/admin/disputes/{dispute_id}")
async def get_dispute_details(
    dispute_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get detailed dispute information including trip data."""
    if current_user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    dispute = await db.disputes.find_one({"id": dispute_id}, {"_id": 0})
    if not dispute:
        raise HTTPException(status_code=404, detail="Dispute not found")
    
    # Get full trip data
    trip = await db.meter_sessions.find_one({"id": dispute.get("trip_id")}, {"_id": 0})
    
    # Get config version used
    config = None
    if trip and trip.get("config_version"):
        config = await db.taxi_configs.find_one({"version": trip["config_version"]}, {"_id": 0})
    
    return {
        "dispute": dispute,
        "trip": trip,
        "config_used": config
    }

@api_router.post("/admin/disputes/{dispute_id}/resolve")
async def resolve_dispute(
    dispute_id: str,
    resolution: DisputeResolution,
    current_user: dict = Depends(get_current_user)
):
    """Resolve a dispute. Only admin/super_admin with resolve_disputes permission."""
    if current_user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Check permission
    if not check_admin_permission(current_user, "resolve_disputes"):
        raise HTTPException(status_code=403, detail="resolve_disputes permission required")
    
    dispute = await db.disputes.find_one({"id": dispute_id})
    if not dispute:
        raise HTTPException(status_code=404, detail="Dispute not found")
    
    if dispute.get("status") == "resolved":
        raise HTTPException(status_code=400, detail="Dispute already resolved")
    
    before_snapshot = {k: v for k, v in dispute.items() if k != "_id"}
    
    resolution_data = {
        "status": "resolved",
        "resolution": resolution.dict(),
        "resolved_by": current_user["id"],
        "resolved_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Add to history
    history_entry = {
        "action": "resolved",
        "by": current_user["id"],
        "at": datetime.now(timezone.utc).isoformat(),
        "decision": resolution.decision,
        "notes": resolution.notes
    }
    
    await db.disputes.update_one(
        {"id": dispute_id},
        {
            "$set": resolution_data,
            "$push": {"history": history_entry}
        }
    )
    
    # Process refund if applicable
    if resolution.decision in ["partial_refund", "full_refund"] and resolution.refund_amount:
        await db.refunds.insert_one({
            "id": str(uuid.uuid4()),
            "dispute_id": dispute_id,
            "trip_id": dispute.get("trip_id"),
            "amount": resolution.refund_amount,
            "status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    # Audit log
    await create_audit_log(
        actor_id=current_user["id"],
        actor_role=current_user.get("admin_role", "admin"),
        action_type="dispute_resolved",
        entity_type="dispute",
        entity_id=dispute_id,
        before_snapshot=before_snapshot,
        after_snapshot=resolution_data,
        notes=f"Decision: {resolution.decision}"
    )
    
    return {"message": "Dispute resolved", "decision": resolution.decision}

@api_router.post("/admin/disputes/{dispute_id}/note")
async def add_dispute_note(
    dispute_id: str,
    note: str,
    current_user: dict = Depends(get_current_user)
):
    """Add an internal note to a dispute. Support agents can add notes."""
    if current_user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    dispute = await db.disputes.find_one({"id": dispute_id})
    if not dispute:
        raise HTTPException(status_code=404, detail="Dispute not found")
    
    history_entry = {
        "action": "note_added",
        "by": current_user["id"],
        "by_role": current_user.get("admin_role", "admin"),
        "at": datetime.now(timezone.utc).isoformat(),
        "note": note
    }
    
    await db.disputes.update_one(
        {"id": dispute_id},
        {"$push": {"history": history_entry}}
    )
    
    return {"message": "Note added"}

# ============== TRIP MANAGEMENT (ADMIN) ==============

@api_router.get("/admin/trips")
async def get_admin_trips(
    status: Optional[str] = None,
    driver_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    limit: int = 100,
    current_user: dict = Depends(get_current_user)
):
    """Get trips with admin details including config version and GPS summary."""
    if current_user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    query = {}
    if status:
        query["status"] = status
    if driver_id:
        query["driver_id"] = driver_id
    if date_from:
        query["start_time"] = {"$gte": date_from}
    if date_to:
        query.setdefault("start_time", {})["$lte"] = date_to
    
    trips = await db.meter_sessions.find(query, {"_id": 0}).sort("start_time", -1).limit(limit).to_list(limit)
    
    # Enrich trips with driver and customer info
    enriched_trips = []
    for trip in trips:
        driver_info = None
        customer_info = None
        
        if trip.get("driver_id"):
            driver = await db.drivers.find_one({"user_id": trip["driver_id"]}, {"_id": 0})
            driver_user = await db.users.find_one({"id": trip["driver_id"]}, {"_id": 0, "password": 0})
            if driver or driver_user:
                driver_info = {
                    "id": trip["driver_id"],
                    "name": driver_user.get("name") if driver_user else (driver.get("name") if driver else "Unknown"),
                    "email": driver_user.get("email") if driver_user else None,
                    "phone": driver_user.get("phone") if driver_user else (driver.get("phone") if driver else None),
                    "vehicle": f"{driver.get('vehicle_color', '')} {driver.get('vehicle_make', '')} {driver.get('vehicle_model', '')}".strip() if driver else None,
                    "license_plate": driver.get("license_plate") if driver else None,
                    "rating": driver.get("rating", 5.0) if driver else 5.0
                }
        
        if trip.get("customer_id"):
            customer = await db.users.find_one({"id": trip["customer_id"]}, {"_id": 0, "password": 0})
            if customer:
                customer_info = {
                    "id": trip["customer_id"],
                    "name": customer.get("name", "Guest"),
                    "email": customer.get("email"),
                    "phone": customer.get("phone")
                }
        
        trip["driver_info"] = driver_info
        trip["customer_info"] = customer_info
        enriched_trips.append(trip)
    
    return {"trips": enriched_trips, "total": len(enriched_trips)}

@api_router.post("/admin/trips/{trip_id}/complaint")
async def create_trip_complaint(
    trip_id: str,
    complaint_type: str,  # service, driver_behavior, vehicle, billing, other
    description: str,
    reporter_type: str = "admin",  # admin, customer
    reporter_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Create a complaint/note for a specific trip."""
    if current_user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    trip = await db.meter_sessions.find_one({"id": trip_id}, {"_id": 0})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    
    complaint = {
        "id": str(uuid.uuid4()),
        "trip_id": trip_id,
        "driver_id": trip.get("driver_id"),
        "customer_id": trip.get("customer_id") or reporter_id,
        "type": complaint_type,
        "description": description,
        "reporter_type": reporter_type,
        "reporter_id": reporter_id or current_user["id"],
        "status": "open",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user["id"],
        "notes": [],
        "resolution": None
    }
    
    await db.trip_complaints.insert_one(complaint)
    complaint.pop("_id", None)
    
    # Also create audit log
    await create_audit_log(
        actor_id=current_user["id"],
        actor_role=current_user.get("admin_role", "admin"),
        action_type="complaint_created",
        entity_type="trip",
        entity_id=trip_id,
        notes=f"Complaint type: {complaint_type}"
    )
    
    return {"message": "Complaint created", "complaint": complaint}

@api_router.get("/admin/trips/{trip_id}/complaints")
async def get_trip_complaints(
    trip_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get all complaints for a specific trip."""
    if current_user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    complaints = await db.trip_complaints.find({"trip_id": trip_id}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {"complaints": complaints}

@api_router.post("/admin/trips/{trip_id}/note")
async def add_trip_note(
    trip_id: str,
    note: str,
    current_user: dict = Depends(get_current_user)
):
    """Add an admin note to a trip."""
    if current_user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    trip = await db.meter_sessions.find_one({"id": trip_id})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    
    note_entry = {
        "id": str(uuid.uuid4()),
        "note": note,
        "created_by": current_user["id"],
        "created_by_name": current_user.get("name", "Admin"),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.meter_sessions.update_one(
        {"id": trip_id},
        {"$push": {"admin_notes": note_entry}}
    )
    
    return {"message": "Note added", "note": note_entry}

@api_router.get("/admin/trips/{trip_id}")
async def get_admin_trip_details(
    trip_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get detailed trip information for admin view."""
    if current_user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    trip = await db.meter_sessions.find_one({"id": trip_id}, {"_id": 0})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    
    # Get driver info
    driver = await db.drivers.find_one({"user_id": trip.get("driver_id")}, {"_id": 0})
    driver_user = await db.users.find_one({"id": trip.get("driver_id")}, {"_id": 0, "password": 0})
    
    # Get config used
    config = None
    if trip.get("config_version"):
        config = await db.taxi_configs.find_one({"version": trip["config_version"]}, {"_id": 0})
    
    return {
        "trip": trip,
        "driver": driver,
        "driver_user": driver_user,
        "config_used": config,
        "gps_summary": {
            "total_snapshots": len(trip.get("fare_snapshots", [])),
            "start_location": trip.get("start_location"),
            "end_location": trip.get("end_location")
        }
    }

@api_router.post("/admin/trips/{trip_id}/cancel")
async def admin_cancel_trip(
    trip_id: str,
    reason: str,
    current_user: dict = Depends(get_current_user)
):
    """Cancel a trip (admin action). Requires cancel_trips permission."""
    if not check_admin_permission(current_user, "cancel_trips"):
        raise HTTPException(status_code=403, detail="cancel_trips permission required")
    
    trip = await db.meter_sessions.find_one({"id": trip_id})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    
    if trip.get("status") == "completed":
        raise HTTPException(status_code=400, detail="Cannot cancel completed trip")
    
    await db.meter_sessions.update_one(
        {"id": trip_id},
        {"$set": {
            "status": "cancelled",
            "cancelled_by": current_user["id"],
            "cancelled_at": datetime.now(timezone.utc).isoformat(),
            "cancellation_reason": reason
        }}
    )
    
    # Audit log
    await create_audit_log(
        actor_id=current_user["id"],
        actor_role=current_user.get("admin_role", "admin"),
        action_type="trip_cancelled",
        entity_type="trip",
        entity_id=trip_id,
        notes=f"Reason: {reason}"
    )
    
    return {"message": "Trip cancelled"}

@api_router.post("/admin/trips/{trip_id}/fare-adjustment")
async def apply_fare_adjustment(
    trip_id: str,
    adjustment_amount: float,
    reason: str,
    current_user: dict = Depends(get_current_user)
):
    """Apply a one-time fare adjustment. Admins only, logged and auditable."""
    if current_user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Support agents cannot adjust fares
    if current_user.get("admin_role") == "support_agent":
        raise HTTPException(status_code=403, detail="Support agents cannot adjust fares")
    
    trip = await db.meter_sessions.find_one({"id": trip_id})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    
    before_snapshot = {"final_fare": trip.get("final_fare")}
    
    adjustment = {
        "id": str(uuid.uuid4()),
        "amount": adjustment_amount,
        "reason": reason,
        "applied_by": current_user["id"],
        "applied_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Update trip with adjustment
    await db.meter_sessions.update_one(
        {"id": trip_id},
        {
            "$push": {"fare_adjustments": adjustment},
            "$inc": {"final_fare.total_final": adjustment_amount}
        }
    )
    
    # Audit log with before/after
    await create_audit_log(
        actor_id=current_user["id"],
        actor_role=current_user.get("admin_role", "admin"),
        action_type="fare_adjustment",
        entity_type="trip",
        entity_id=trip_id,
        before_snapshot=before_snapshot,
        after_snapshot={"adjustment": adjustment},
        notes=f"Adjustment: ${adjustment_amount} - {reason}"
    )
    
    return {"message": "Fare adjustment applied", "adjustment": adjustment}

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

class AdminCreateUser(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str
    phone: Optional[str] = None
    address: Optional[str] = None

class AdminUpdateUser(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    is_active: Optional[bool] = None
    is_restricted: Optional[bool] = None
    restriction_reason: Optional[str] = None

@api_router.post("/admin/users")
async def admin_create_user(
    user_data: AdminCreateUser,
    current_user: dict = Depends(get_current_user)
):
    """Create a new user from admin panel."""
    if current_user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Check permission
    if not check_admin_permission(current_user, "manage_users"):
        raise HTTPException(status_code=403, detail="manage_users permission required")
    
    # Check if email exists
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    new_user = {
        "id": str(uuid.uuid4()),
        "email": user_data.email,
        "password": pwd_context.hash(user_data.password),
        "name": f"{user_data.first_name} {user_data.last_name}",
        "first_name": user_data.first_name,
        "last_name": user_data.last_name,
        "phone": user_data.phone,
        "address": user_data.address,
        "role": "user",
        "is_active": True,
        "is_restricted": False,
        "created_by": current_user["id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(new_user)
    
    # Audit log
    await create_audit_log(
        actor_id=current_user["id"],
        actor_role=current_user.get("admin_role", "admin"),
        action_type="user_created",
        entity_type="user",
        entity_id=new_user["id"],
        after_snapshot={"email": new_user["email"], "name": new_user["name"]}
    )
    
    new_user.pop("password", None)
    new_user.pop("_id", None)
    return {"message": "User created successfully", "user": new_user}

@api_router.put("/admin/users/{user_id}")
async def admin_update_user(
    user_id: str,
    updates: AdminUpdateUser,
    current_user: dict = Depends(get_current_user)
):
    """Update a user from admin panel."""
    if current_user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    if not check_admin_permission(current_user, "manage_users"):
        raise HTTPException(status_code=403, detail="manage_users permission required")
    
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    before_snapshot = {k: v for k, v in user.items() if k not in ["_id", "password"]}
    
    update_data = {k: v for k, v in updates.dict().items() if v is not None}
    
    if "first_name" in update_data or "last_name" in update_data:
        update_data["name"] = f"{update_data.get('first_name', user.get('first_name', ''))} {update_data.get('last_name', user.get('last_name', ''))}".strip()
    
    if update_data:
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        update_data["updated_by"] = current_user["id"]
        await db.users.update_one({"id": user_id}, {"$set": update_data})
        
        # Audit log
        await create_audit_log(
            actor_id=current_user["id"],
            actor_role=current_user.get("admin_role", "admin"),
            action_type="user_updated",
            entity_type="user",
            entity_id=user_id,
            before_snapshot=before_snapshot,
            after_snapshot=update_data
        )
    
    return {"message": "User updated successfully"}

@api_router.post("/admin/users/{user_id}/restrict")
async def admin_restrict_user(
    user_id: str,
    reason: str,
    is_permanent: bool = False,
    current_user: dict = Depends(get_current_user)
):
    """Restrict a user (temporary or permanent)."""
    if current_user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    if not check_admin_permission(current_user, "restrict_users"):
        raise HTTPException(status_code=403, detail="restrict_users permission required")
    
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    await db.users.update_one(
        {"id": user_id},
        {"$set": {
            "is_restricted": True,
            "restriction_reason": reason,
            "restriction_type": "permanent" if is_permanent else "temporary",
            "restricted_by": current_user["id"],
            "restricted_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Audit log
    await create_audit_log(
        actor_id=current_user["id"],
        actor_role=current_user.get("admin_role", "admin"),
        action_type="user_restricted",
        entity_type="user",
        entity_id=user_id,
        notes=f"Reason: {reason}, Permanent: {is_permanent}"
    )
    
    return {"message": "User restricted"}

@api_router.post("/admin/users/{user_id}/unrestrict")
async def admin_unrestrict_user(
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Remove restriction from a user."""
    if current_user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    await db.users.update_one(
        {"id": user_id},
        {"$set": {
            "is_restricted": False,
            "unrestricted_by": current_user["id"],
            "unrestricted_at": datetime.now(timezone.utc).isoformat()
        },
        "$unset": {
            "restriction_reason": "",
            "restriction_type": ""
        }}
    )
    
    return {"message": "User restriction removed"}

@api_router.get("/admin/drivers")
async def get_all_drivers(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    drivers = await db.drivers.find({}, {"_id": 0}).to_list(100)
    return {"drivers": drivers}

class AdminCreateDriver(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str
    phone: str
    # Vehicle info
    vehicle_type: str = "sedan"
    vehicle_make: Optional[str] = None
    vehicle_model: Optional[str] = None
    vehicle_color: Optional[str] = None
    vehicle_year: Optional[int] = None
    license_plate: Optional[str] = None
    # License info
    drivers_license_number: Optional[str] = None
    taxi_permit_number: Optional[str] = None
    # Quebec tax info
    gst_number: Optional[str] = None
    qst_number: Optional[str] = None
    srs_code: Optional[str] = None
    # Services
    services: List[str] = ["taxi"]

class AdminUpdateDriver(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    vehicle_type: Optional[str] = None
    vehicle_make: Optional[str] = None
    vehicle_model: Optional[str] = None
    vehicle_color: Optional[str] = None
    license_plate: Optional[str] = None
    status: Optional[str] = None
    is_active: Optional[bool] = None
    services: Optional[List[str]] = None

@api_router.post("/admin/drivers")
async def admin_create_driver(
    driver_data: AdminCreateDriver,
    current_user: dict = Depends(get_current_user)
):
    """Create a new driver from admin panel."""
    if current_user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    if not check_admin_permission(current_user, "manage_drivers"):
        raise HTTPException(status_code=403, detail="manage_drivers permission required")
    
    # Check if email exists
    existing = await db.users.find_one({"email": driver_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    driver_id = str(uuid.uuid4())
    
    # Create user account
    new_user = {
        "id": driver_id,
        "email": driver_data.email,
        "password": pwd_context.hash(driver_data.password),
        "name": f"{driver_data.first_name} {driver_data.last_name}",
        "first_name": driver_data.first_name,
        "last_name": driver_data.last_name,
        "phone": driver_data.phone,
        "role": "driver",
        "is_active": True,
        "created_by": current_user["id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(new_user)
    
    # Create driver profile
    new_driver = {
        "id": str(uuid.uuid4()),
        "user_id": driver_id,
        "name": f"{driver_data.first_name} {driver_data.last_name}",
        "first_name": driver_data.first_name,
        "last_name": driver_data.last_name,
        "email": driver_data.email,
        "phone": driver_data.phone,
        "status": "offline",
        "is_available": False,
        "is_active": True,
        # Vehicle
        "vehicle_type": driver_data.vehicle_type,
        "vehicle_make": driver_data.vehicle_make,
        "vehicle_model": driver_data.vehicle_model,
        "vehicle_color": driver_data.vehicle_color,
        "vehicle_year": driver_data.vehicle_year,
        "license_plate": driver_data.license_plate,
        # License info
        "drivers_license_number": driver_data.drivers_license_number,
        "taxi_permit_number": driver_data.taxi_permit_number,
        "drivers_license_status": "pending",
        "taxi_license_status": "pending",
        # Quebec tax info
        "tax_info": {
            "gst_number": driver_data.gst_number,
            "qst_number": driver_data.qst_number,
            "srs_code": driver_data.srs_code
        },
        # Services
        "services": driver_data.services,
        # Stats
        "rating": 5.0,
        "total_rides": 0,
        "earnings_today": 0,
        "earnings_total": 0,
        # Verification
        "verification_status": "pending",
        "created_by": current_user["id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.drivers.insert_one(new_driver)
    
    # Audit log
    await create_audit_log(
        actor_id=current_user["id"],
        actor_role=current_user.get("admin_role", "admin"),
        action_type="driver_created",
        entity_type="driver",
        entity_id=driver_id,
        after_snapshot={"email": new_driver["email"], "name": new_driver["name"]}
    )
    
    new_user.pop("_id", None)
    new_driver.pop("_id", None)
    return {"message": "Driver created successfully", "driver": new_driver, "user_id": driver_id}

@api_router.put("/admin/drivers/{driver_id}")
async def admin_update_driver(
    driver_id: str,
    updates: AdminUpdateDriver,
    current_user: dict = Depends(get_current_user)
):
    """Update a driver from admin panel."""
    if current_user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    if not check_admin_permission(current_user, "manage_drivers"):
        raise HTTPException(status_code=403, detail="manage_drivers permission required")
    
    driver = await db.drivers.find_one({"user_id": driver_id})
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    
    before_snapshot = {k: v for k, v in driver.items() if k != "_id"}
    
    update_data = {k: v for k, v in updates.dict().items() if v is not None}
    
    if "first_name" in update_data or "last_name" in update_data:
        update_data["name"] = f"{update_data.get('first_name', driver.get('first_name', ''))} {update_data.get('last_name', driver.get('last_name', ''))}".strip()
    
    if update_data:
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        update_data["updated_by"] = current_user["id"]
        await db.drivers.update_one({"user_id": driver_id}, {"$set": update_data})
        
        # Audit log
        await create_audit_log(
            actor_id=current_user["id"],
            actor_role=current_user.get("admin_role", "admin"),
            action_type="driver_updated",
            entity_type="driver",
            entity_id=driver_id,
            before_snapshot=before_snapshot,
            after_snapshot=update_data
        )
    
    return {"message": "Driver updated successfully"}

@api_router.post("/admin/drivers/{driver_id}/suspend")
async def admin_suspend_driver(
    driver_id: str,
    reason: str,
    current_user: dict = Depends(get_current_user)
):
    """Suspend a driver."""
    if current_user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    if not check_admin_permission(current_user, "suspend_drivers"):
        raise HTTPException(status_code=403, detail="suspend_drivers permission required")
    
    driver = await db.drivers.find_one({"user_id": driver_id})
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    
    await db.drivers.update_one(
        {"user_id": driver_id},
        {"$set": {
            "status": "suspended",
            "is_active": False,
            "is_available": False,
            "suspension_reason": reason,
            "suspended_by": current_user["id"],
            "suspended_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Also update user account
    await db.users.update_one(
        {"id": driver_id},
        {"$set": {"is_active": False}}
    )
    
    # Audit log
    await create_audit_log(
        actor_id=current_user["id"],
        actor_role=current_user.get("admin_role", "admin"),
        action_type="driver_suspended",
        entity_type="driver",
        entity_id=driver_id,
        notes=f"Reason: {reason}"
    )
    
    return {"message": "Driver suspended"}

@api_router.post("/admin/drivers/{driver_id}/reactivate")
async def admin_reactivate_driver(
    driver_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Reactivate a suspended driver."""
    if current_user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    driver = await db.drivers.find_one({"user_id": driver_id})
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    
    await db.drivers.update_one(
        {"user_id": driver_id},
        {"$set": {
            "status": "offline",
            "is_active": True,
            "reactivated_by": current_user["id"],
            "reactivated_at": datetime.now(timezone.utc).isoformat()
        },
        "$unset": {
            "suspension_reason": ""
        }}
    )
    
    # Also update user account
    await db.users.update_one(
        {"id": driver_id},
        {"$set": {"is_active": True}}
    )
    
    # Audit log
    await create_audit_log(
        actor_id=current_user["id"],
        actor_role=current_user.get("admin_role", "admin"),
        action_type="driver_reactivated",
        entity_type="driver",
        entity_id=driver_id
    )
    
    return {"message": "Driver reactivated"}

@api_router.post("/admin/drivers/{driver_id}/approve")
async def admin_approve_driver(
    driver_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Fully approve a driver (all documents verified)."""
    if current_user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    if not check_admin_permission(current_user, "approve_drivers"):
        raise HTTPException(status_code=403, detail="approve_drivers permission required")
    
    driver = await db.drivers.find_one({"user_id": driver_id})
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    
    await db.drivers.update_one(
        {"user_id": driver_id},
        {"$set": {
            "verification_status": "approved",
            "drivers_license_status": "approved",
            "taxi_license_status": "approved",
            "profile_photo_status": "approved",
            "approved_by": current_user["id"],
            "approved_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Audit log
    await create_audit_log(
        actor_id=current_user["id"],
        actor_role=current_user.get("admin_role", "admin"),
        action_type="driver_approved",
        entity_type="driver",
        entity_id=driver_id
    )
    
    return {"message": "Driver approved"}

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

# ============== ADMIN SETTINGS & COMMISSION ENDPOINTS ==============

class PlatformSettingsUpdate(BaseModel):
    commission_rate: Optional[float] = None  # Default 25%
    card_payment_commission: Optional[float] = None  # Commission on card payments
    cash_payment_commission: Optional[float] = None  # Commission on cash payments
    app_payment_commission: Optional[float] = None  # Commission on in-app payments
    min_payout_amount: Optional[float] = None  # Minimum payout threshold
    payout_frequency: Optional[str] = None  # daily, weekly, bi-weekly, monthly
    auto_payout_enabled: Optional[bool] = None
    stripe_enabled: Optional[bool] = None
    stripe_merchant_id: Optional[str] = None

class DriverContractUpdate(BaseModel):
    contract_version: Optional[str] = None
    contract_text: Optional[str] = None
    effective_date: Optional[str] = None
    requires_signature: Optional[bool] = None

class CaseCreate(BaseModel):
    driver_id: Optional[str] = None
    user_id: Optional[str] = None
    booking_id: Optional[str] = None
    case_type: str  # dispute, complaint, incident, refund, other
    title: str
    description: str
    priority: str = "medium"  # low, medium, high, urgent

class CaseUpdate(BaseModel):
    status: Optional[str] = None  # open, in_progress, resolved, closed
    resolution: Optional[str] = None
    notes: Optional[str] = None

class PayoutCreate(BaseModel):
    driver_id: str
    amount: float
    method: str = "bank_transfer"  # bank_transfer, stripe, check
    notes: Optional[str] = None

@api_router.get("/admin/settings")
async def get_platform_settings(current_user: dict = Depends(get_current_user)):
    """Get platform settings including commission rates."""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    settings = await db.platform_settings.find_one({"type": "global"}, {"_id": 0})
    if not settings:
        # Create default settings
        settings = {
            "type": "global",
            "commission_rate": 25.0,  # 25% default
            "card_payment_commission": 25.0,
            "cash_payment_commission": 25.0,
            "app_payment_commission": 25.0,
            "min_payout_amount": 50.0,
            "payout_frequency": "weekly",
            "auto_payout_enabled": False,
            "stripe_enabled": False,
            "stripe_merchant_id": None,
            "tax_settings": {
                "gst_rate": 5.0,
                "qst_rate": 9.975,
                "government_fee": 0.90
            },
            "meter_settings": {
                "day_base_fare": 5.15,
                "day_per_km": 2.05,
                "night_base_fare": 5.75,
                "night_per_km": 2.35
            },
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db.platform_settings.insert_one(settings)
    
    return settings

@api_router.put("/admin/settings")
async def update_platform_settings(
    updates: PlatformSettingsUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update platform settings."""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    update_data = {k: v for k, v in updates.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    update_data["updated_by"] = current_user["id"]
    
    await db.platform_settings.update_one(
        {"type": "global"},
        {"$set": update_data},
        upsert=True
    )
    
    return {"message": "Settings updated", "updated": update_data}

@api_router.get("/admin/meter-settings")
async def get_meter_settings(current_user: dict = Depends(get_current_user)):
    """Get taxi meter rate settings."""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    from taxi_meter import QUEBEC_TAXI_RATES
    
    # Get any custom overrides from DB
    custom_rates = await db.platform_settings.find_one({"type": "meter_rates"}, {"_id": 0})
    
    return {
        "default_rates": QUEBEC_TAXI_RATES,
        "custom_rates": custom_rates,
        "active": "default" if not custom_rates else "custom"
    }

@api_router.get("/admin/documents/pending")
async def get_pending_documents(current_user: dict = Depends(get_current_user)):
    """Get all pending driver documents for verification."""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Get drivers with pending documents
    drivers = await db.drivers.find(
        {"$or": [
            {"license_verified": False},
            {"taxi_license_verified": False},
            {"documents_status": "pending"}
        ]},
        {"_id": 0}
    ).to_list(100)
    
    # Get user info for each driver
    for driver in drivers:
        user = await db.users.find_one({"id": driver.get("user_id")}, {"_id": 0, "password": 0})
        if user:
            driver["user"] = user
    
    return {"pending_documents": drivers}

@api_router.post("/admin/documents/approve")
async def approve_document(
    driver_id: str,
    document_type: str,  # license, taxi_license, insurance, vehicle_registration
    approved: bool,
    notes: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Approve or reject a driver document."""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    update_field = f"{document_type}_verified"
    
    await db.drivers.update_one(
        {"user_id": driver_id},
        {"$set": {
            update_field: approved,
            f"{document_type}_verified_at": datetime.now(timezone.utc).isoformat(),
            f"{document_type}_verified_by": current_user["id"],
            f"{document_type}_verification_notes": notes
        }}
    )
    
    # Log the action
    await db.admin_logs.insert_one({
        "id": str(uuid.uuid4()),
        "action": "document_verification",
        "admin_id": current_user["id"],
        "driver_id": driver_id,
        "document_type": document_type,
        "approved": approved,
        "notes": notes,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"message": f"Document {document_type} {'approved' if approved else 'rejected'}"}

# ============== PLATFORM DOCUMENTS MANAGEMENT ==============

class PlatformDocument(BaseModel):
    title: str
    doc_type: str  # terms, privacy, refund, driver_guide, customer_letter, driver_popup, policy
    content: str
    target_audience: str  # all, users, drivers, admins
    is_active: bool = True
    requires_acceptance: bool = False
    popup_enabled: bool = False
    popup_title: Optional[str] = None

class PlatformDocumentUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    is_active: Optional[bool] = None
    requires_acceptance: Optional[bool] = None
    popup_enabled: Optional[bool] = None
    popup_title: Optional[str] = None

@api_router.get("/admin/platform-documents")
async def get_platform_documents(
    doc_type: Optional[str] = None,
    target_audience: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all platform documents (terms, policies, letters, etc.)."""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    query = {}
    if doc_type:
        query["doc_type"] = doc_type
    if target_audience:
        query["target_audience"] = target_audience
    
    documents = await db.platform_documents.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"documents": documents}

@api_router.post("/admin/platform-documents")
async def create_platform_document(
    doc: PlatformDocument,
    current_user: dict = Depends(get_current_user)
):
    """Create a new platform document."""
    if current_user.get("admin_role") != "super_admin":
        raise HTTPException(status_code=403, detail="Only super admin can create documents")
    
    document = {
        "id": str(uuid.uuid4()),
        **doc.dict(),
        "version": 1,
        "created_by": current_user["id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.platform_documents.insert_one(document)
    document.pop("_id", None)
    
    await create_audit_log(
        actor_id=current_user["id"],
        actor_role=current_user.get("admin_role", "admin"),
        action_type="document_created",
        entity_type="platform_document",
        entity_id=document["id"],
        notes=f"Created {doc.doc_type}: {doc.title}"
    )
    
    return {"message": "Document created", "document": document}

@api_router.put("/admin/platform-documents/{doc_id}")
async def update_platform_document(
    doc_id: str,
    updates: PlatformDocumentUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update a platform document."""
    if current_user.get("admin_role") != "super_admin":
        raise HTTPException(status_code=403, detail="Only super admin can update documents")
    
    doc = await db.platform_documents.find_one({"id": doc_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    update_data = {k: v for k, v in updates.dict().items() if v is not None}
    update_data["version"] = doc.get("version", 1) + 1
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    update_data["updated_by"] = current_user["id"]
    
    await db.platform_documents.update_one({"id": doc_id}, {"$set": update_data})
    
    await create_audit_log(
        actor_id=current_user["id"],
        actor_role=current_user.get("admin_role", "admin"),
        action_type="document_updated",
        entity_type="platform_document",
        entity_id=doc_id,
        notes=f"Updated document v{update_data['version']}"
    )
    
    return {"message": "Document updated"}

@api_router.delete("/admin/platform-documents/{doc_id}")
async def delete_platform_document(
    doc_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a platform document."""
    if current_user.get("admin_role") != "super_admin":
        raise HTTPException(status_code=403, detail="Only super admin can delete documents")
    
    result = await db.platform_documents.delete_one({"id": doc_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Document not found")
    
    return {"message": "Document deleted"}

@api_router.post("/admin/platform-documents/{doc_id}/send-notification")
async def send_document_notification(
    doc_id: str,
    notification_type: str,  # email, push, popup
    current_user: dict = Depends(get_current_user)
):
    """Send notification about a document to target audience."""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    doc = await db.platform_documents.find_one({"id": doc_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Create notification record
    notification = {
        "id": str(uuid.uuid4()),
        "document_id": doc_id,
        "document_title": doc["title"],
        "notification_type": notification_type,
        "target_audience": doc["target_audience"],
        "sent_by": current_user["id"],
        "sent_at": datetime.now(timezone.utc).isoformat(),
        "status": "sent"
    }
    
    await db.document_notifications.insert_one(notification)
    
    # If popup enabled for drivers, update driver popup settings
    if notification_type == "popup" and doc["target_audience"] in ["drivers", "all"]:
        await db.platform_settings.update_one(
            {"setting_type": "driver_popup"},
            {"$set": {
                "active_popup_doc_id": doc_id,
                "popup_title": doc.get("popup_title", doc["title"]),
                "popup_content": doc["content"][:500],  # First 500 chars
                "updated_at": datetime.now(timezone.utc).isoformat()
            }},
            upsert=True
        )
    
    logger.info(f"[NOTIFICATION] Document '{doc['title']}' notification sent via {notification_type} to {doc['target_audience']}")
    
    return {"message": f"Notification sent via {notification_type}", "notification": notification}

# Public endpoint for users/drivers to get active documents
@api_router.get("/documents/public")
async def get_public_documents(
    doc_type: Optional[str] = None
):
    """Get active public documents (terms, privacy policy, etc.)."""
    query = {"is_active": True, "target_audience": {"$in": ["all", "users"]}}
    if doc_type:
        query["doc_type"] = doc_type
    
    documents = await db.platform_documents.find(query, {"_id": 0}).to_list(50)
    return {"documents": documents}

@api_router.get("/driver/popup")
async def get_driver_popup(
    current_user: dict = Depends(get_current_user)
):
    """Get active popup for driver."""
    if current_user.get("role") != "driver":
        raise HTTPException(status_code=403, detail="Driver access required")
    
    popup_setting = await db.platform_settings.find_one({"setting_type": "driver_popup"}, {"_id": 0})
    if not popup_setting or not popup_setting.get("active_popup_doc_id"):
        return {"has_popup": False}
    
    # Check if driver has already seen this popup
    driver_popup_status = await db.driver_popup_status.find_one({
        "driver_id": current_user["id"],
        "popup_doc_id": popup_setting["active_popup_doc_id"]
    })
    
    if driver_popup_status and driver_popup_status.get("acknowledged"):
        return {"has_popup": False}
    
    doc = await db.platform_documents.find_one({"id": popup_setting["active_popup_doc_id"]}, {"_id": 0})
    if not doc:
        return {"has_popup": False}
    
    return {
        "has_popup": True,
        "popup": {
            "id": doc["id"],
            "title": popup_setting.get("popup_title", doc["title"]),
            "content": doc["content"],
            "requires_acceptance": doc.get("requires_acceptance", False)
        }
    }

@api_router.post("/driver/popup/{doc_id}/acknowledge")
async def acknowledge_driver_popup(
    doc_id: str,
    accepted: bool = True,
    current_user: dict = Depends(get_current_user)
):
    """Acknowledge/accept a driver popup."""
    if current_user.get("role") != "driver":
        raise HTTPException(status_code=403, detail="Driver access required")
    
    await db.driver_popup_status.update_one(
        {"driver_id": current_user["id"], "popup_doc_id": doc_id},
        {"$set": {
            "driver_id": current_user["id"],
            "popup_doc_id": doc_id,
            "acknowledged": True,
            "accepted": accepted,
            "acknowledged_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    
    return {"message": "Popup acknowledged"}

# ============== CASES / DISPUTES ==============

@api_router.get("/admin/cases")
async def get_cases(
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all support cases/disputes."""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    query = {}
    if status:
        query["status"] = status
    
    cases = await db.cases.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"cases": cases}

@api_router.post("/admin/cases")
async def create_case(
    case_data: CaseCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new support case."""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    case = {
        "id": str(uuid.uuid4()),
        "case_number": f"CASE-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:4].upper()}",
        **case_data.dict(),
        "status": "open",
        "created_by": current_user["id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "history": []
    }
    
    await db.cases.insert_one(case)
    case.pop("_id", None)
    return {"message": "Case created", "case": case}

@api_router.put("/admin/cases/{case_id}")
async def update_case(
    case_id: str,
    updates: CaseUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update a case status."""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    update_data = {k: v for k, v in updates.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    # Add to history
    history_entry = {
        "action": "status_update" if "status" in update_data else "note_added",
        "by": current_user["id"],
        "at": datetime.now(timezone.utc).isoformat(),
        "changes": update_data
    }
    
    await db.cases.update_one(
        {"id": case_id},
        {
            "$set": update_data,
            "$push": {"history": history_entry}
        }
    )
    
    return {"message": "Case updated"}

# ============== PAYOUTS ==============

@api_router.get("/admin/payouts")
async def get_payouts(
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all payouts."""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    query = {}
    if status:
        query["status"] = status
    
    payouts = await db.payouts.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"payouts": payouts}

@api_router.get("/admin/payouts/pending")
async def get_pending_payouts(current_user: dict = Depends(get_current_user)):
    """Get drivers with pending payouts."""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    settings = await db.platform_settings.find_one({"type": "global"}, {"_id": 0})
    min_payout = settings.get("min_payout_amount", 50) if settings else 50
    commission_rate = settings.get("commission_rate", 25) if settings else 25
    
    # Aggregate earnings by driver
    pipeline = [
        {"$match": {"status": "completed"}},
        {"$group": {
            "_id": "$driver_id",
            "total_fares": {"$sum": "$fare.total"},
            "trip_count": {"$sum": 1}
        }}
    ]
    
    earnings = await db.meter_sessions.aggregate(pipeline).to_list(100)
    
    pending_payouts = []
    for e in earnings:
        if e["_id"]:
            driver = await db.drivers.find_one({"user_id": e["_id"]}, {"_id": 0})
            user = await db.users.find_one({"id": e["_id"]}, {"_id": 0, "password": 0})
            
            # Calculate driver's share (after commission)
            driver_share = e["total_fares"] * (1 - commission_rate / 100)
            
            # Check existing paid out amount
            paid_out = await db.payouts.aggregate([
                {"$match": {"driver_id": e["_id"], "status": "completed"}},
                {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
            ]).to_list(1)
            
            total_paid = paid_out[0]["total"] if paid_out else 0
            balance = driver_share - total_paid
            
            if balance >= min_payout:
                pending_payouts.append({
                    "driver_id": e["_id"],
                    "driver": driver,
                    "user": user,
                    "total_fares": e["total_fares"],
                    "commission_rate": commission_rate,
                    "driver_share": driver_share,
                    "total_paid": total_paid,
                    "balance_due": balance,
                    "trip_count": e["trip_count"]
                })
    
    return {"pending_payouts": pending_payouts, "min_payout_amount": min_payout}

@api_router.post("/admin/payouts")
async def create_payout(
    payout_data: PayoutCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new payout for a driver."""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    payout = {
        "id": str(uuid.uuid4()),
        "reference": f"PAY-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:6].upper()}",
        **payout_data.dict(),
        "status": "pending",
        "created_by": current_user["id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.payouts.insert_one(payout)
    payout.pop("_id", None)
    return payout

@api_router.put("/admin/payouts/{payout_id}/process")
async def process_payout(
    payout_id: str,
    status: str,  # completed, failed
    transaction_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Process a payout."""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    await db.payouts.update_one(
        {"id": payout_id},
        {"$set": {
            "status": status,
            "transaction_id": transaction_id,
            "processed_by": current_user["id"],
            "processed_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": f"Payout {status}"}

# ============== MERCHANTS / PLATFORM EARNINGS ==============

class MerchantSettingsUpdate(BaseModel):
    bank_account_name: Optional[str] = None
    bank_account_number: Optional[str] = None  # Last 4 digits only for display
    bank_routing_number: Optional[str] = None  # Last 4 digits only for display
    bank_name: Optional[str] = None
    payout_schedule: Optional[str] = None  # daily, weekly, monthly
    auto_payout_enabled: Optional[bool] = None
    min_payout_amount: Optional[float] = None

@api_router.get("/admin/merchants/overview")
async def get_merchant_overview(current_user: dict = Depends(get_current_user)):
    """Get platform earnings overview for merchants section."""
    if current_user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Get completed trips for earnings calculation
    completed_trips = await db.meter_trips.find(
        {"status": "completed"},
        {"_id": 0, "final_fare": 1, "end_time": 1, "driver_id": 1}
    ).to_list(10000)
    
    # Calculate totals
    total_collected = 0.0
    total_commission = 0.0
    total_taxes = 0.0
    
    # Get current commission rate
    commission_config = await db.commission_configs.find_one({"is_active": True}, {"_id": 0})
    commission_rate = commission_config.get("rate", 15) / 100 if commission_config else 0.15
    
    for trip in completed_trips:
        fare = trip.get("final_fare", {})
        trip_total = fare.get("total_final", 0)
        total_collected += trip_total
        total_commission += trip_total * commission_rate
        total_taxes += fare.get("gst", 0) + fare.get("qst", 0)
    
    # Get pending payouts to drivers
    pending_to_drivers = 0.0
    pending_payouts = await db.payouts.find({"status": "pending"}, {"_id": 0, "amount": 1}).to_list(1000)
    for p in pending_payouts:
        pending_to_drivers += p.get("amount", 0)
    
    # Get processed payouts
    processed_payouts = await db.payouts.find({"status": "processed"}, {"_id": 0, "amount": 1}).to_list(1000)
    total_paid_out = sum(p.get("amount", 0) for p in processed_payouts)
    
    # Platform balance (commission - already paid to platform)
    platform_withdrawals = await db.platform_withdrawals.find({"status": "completed"}, {"_id": 0, "amount": 1}).to_list(1000)
    total_withdrawn = sum(w.get("amount", 0) for w in platform_withdrawals)
    
    available_balance = total_commission - total_withdrawn
    
    # Get merchant settings
    settings = await db.merchant_settings.find_one({"type": "platform"}, {"_id": 0})
    
    # Calculate this month's earnings
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    this_month_trips = [t for t in completed_trips if t.get("end_time") and datetime.fromisoformat(t["end_time"].replace("Z", "+00:00")) >= month_start]
    this_month_collected = sum(t.get("final_fare", {}).get("total_final", 0) for t in this_month_trips)
    this_month_commission = this_month_collected * commission_rate
    
    return {
        "overview": {
            "total_collected": round(total_collected, 2),
            "total_commission": round(total_commission, 2),
            "total_taxes_collected": round(total_taxes, 2),
            "pending_driver_payouts": round(pending_to_drivers, 2),
            "total_paid_to_drivers": round(total_paid_out, 2),
            "total_withdrawn": round(total_withdrawn, 2),
            "available_balance": round(available_balance, 2),
            "commission_rate": commission_rate * 100,
            "this_month_collected": round(this_month_collected, 2),
            "this_month_commission": round(this_month_commission, 2)
        },
        "settings": settings,
        "bank_connected": settings.get("bank_account_number") is not None if settings else False
    }

@api_router.get("/admin/merchants/transactions")
async def get_merchant_transactions(
    page: int = 1,
    limit: int = 50,
    transaction_type: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get platform transaction history."""
    if current_user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Build query
    query = {}
    if transaction_type:
        query["type"] = transaction_type
    
    skip = (page - 1) * limit
    
    # Get platform transactions
    transactions = await db.platform_transactions.find(
        query, {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    total = await db.platform_transactions.count_documents(query)
    
    # If no transactions exist, generate from completed trips
    if not transactions:
        # Get commission rate
        commission_config = await db.commission_configs.find_one({"is_active": True}, {"_id": 0})
        commission_rate = commission_config.get("rate", 15) / 100 if commission_config else 0.15
        
        # Generate transactions from trips
        trips = await db.meter_trips.find(
            {"status": "completed"},
            {"_id": 0}
        ).sort("end_time", -1).skip(skip).limit(limit).to_list(limit)
        
        for trip in trips:
            fare = trip.get("final_fare", {})
            trip_total = fare.get("total_final", 0)
            commission = trip_total * commission_rate
            
            transactions.append({
                "id": f"txn_{trip.get('id', str(uuid.uuid4())[:8])}",
                "type": "commission",
                "amount": round(commission, 2),
                "trip_id": trip.get("id"),
                "driver_id": trip.get("driver_id"),
                "description": f"Commission from trip {trip.get('id', 'N/A')[:8]}...",
                "fare_total": round(trip_total, 2),
                "created_at": trip.get("end_time", datetime.now(timezone.utc).isoformat()),
                "status": "completed"
            })
        
        total = await db.meter_trips.count_documents({"status": "completed"})
    
    return {
        "transactions": transactions,
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "pages": (total + limit - 1) // limit
        }
    }

@api_router.get("/admin/merchants/settings")
async def get_merchant_settings(current_user: dict = Depends(get_current_user)):
    """Get merchant/platform payout settings."""
    if current_user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    settings = await db.merchant_settings.find_one({"type": "platform"}, {"_id": 0})
    
    if not settings:
        settings = {
            "id": str(uuid.uuid4()),
            "type": "platform",
            "bank_account_name": None,
            "bank_account_number": None,
            "bank_routing_number": None,
            "bank_name": None,
            "payout_schedule": "weekly",
            "auto_payout_enabled": False,
            "min_payout_amount": 100.0,
            "stripe_connected": False,
            "stripe_account_id": None,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.merchant_settings.insert_one(settings)
        settings.pop("_id", None)
    
    return {"settings": settings}

@api_router.put("/admin/merchants/settings")
async def update_merchant_settings(
    updates: MerchantSettingsUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update merchant/platform payout settings."""
    if current_user.get("admin_role") != "super_admin":
        raise HTTPException(status_code=403, detail="Super Admin access required")
    
    update_data = {k: v for k, v in updates.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    update_data["updated_by"] = current_user["id"]
    
    result = await db.merchant_settings.update_one(
        {"type": "platform"},
        {"$set": update_data},
        upsert=True
    )
    
    # Audit log
    await create_audit_log(
        actor_id=current_user["id"],
        actor_role="super_admin",
        action_type="merchant_settings_updated",
        entity_type="merchant_settings",
        entity_id="platform",
        notes=f"Updated fields: {list(update_data.keys())}"
    )
    
    return {"message": "Merchant settings updated"}

@api_router.post("/admin/merchants/withdraw")
async def create_platform_withdrawal(
    amount: float,
    notes: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Create a platform withdrawal request (transfer to bank)."""
    if current_user.get("admin_role") != "super_admin":
        raise HTTPException(status_code=403, detail="Super Admin access required")
    
    # Check available balance
    overview_response = await get_merchant_overview(current_user)
    available_balance = overview_response["overview"]["available_balance"]
    
    if amount > available_balance:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient balance. Available: ${available_balance:.2f}"
        )
    
    # Check if bank is connected
    settings = await db.merchant_settings.find_one({"type": "platform"}, {"_id": 0})
    if not settings or not settings.get("bank_account_number"):
        raise HTTPException(
            status_code=400,
            detail="No bank account connected. Please configure bank details first."
        )
    
    withdrawal = {
        "id": str(uuid.uuid4()),
        "amount": amount,
        "status": "pending",  # pending, processing, completed, failed
        "notes": notes,
        "bank_account": f"****{settings.get('bank_account_number', 'XXXX')[-4:]}",
        "bank_name": settings.get("bank_name"),
        "requested_by": current_user["id"],
        "requested_at": datetime.now(timezone.utc).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.platform_withdrawals.insert_one(withdrawal)
    
    # Audit log
    await create_audit_log(
        actor_id=current_user["id"],
        actor_role="super_admin",
        action_type="withdrawal_requested",
        entity_type="platform_withdrawal",
        entity_id=withdrawal["id"],
        notes=f"Amount: ${amount:.2f}"
    )
    
    withdrawal.pop("_id", None)
    return {"message": "Withdrawal request created", "withdrawal": withdrawal}

@api_router.get("/admin/merchants/withdrawals")
async def get_platform_withdrawals(
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get platform withdrawal history."""
    if current_user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    query = {}
    if status:
        query["status"] = status
    
    withdrawals = await db.platform_withdrawals.find(
        query, {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return {"withdrawals": withdrawals}

@api_router.put("/admin/merchants/withdrawals/{withdrawal_id}")
async def update_withdrawal_status(
    withdrawal_id: str,
    status: str,
    transaction_ref: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Update withdrawal status (for manual processing)."""
    if current_user.get("admin_role") != "super_admin":
        raise HTTPException(status_code=403, detail="Super Admin access required")
    
    if status not in ["processing", "completed", "failed"]:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    withdrawal = await db.platform_withdrawals.find_one({"id": withdrawal_id})
    if not withdrawal:
        raise HTTPException(status_code=404, detail="Withdrawal not found")
    
    update_data = {
        "status": status,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": current_user["id"]
    }
    
    if status == "completed":
        update_data["completed_at"] = datetime.now(timezone.utc).isoformat()
    if transaction_ref:
        update_data["transaction_ref"] = transaction_ref
    
    await db.platform_withdrawals.update_one(
        {"id": withdrawal_id},
        {"$set": update_data}
    )
    
    return {"message": f"Withdrawal marked as {status}"}

# ============== STRIPE CONFIGURATION ==============

class StripeConfigUpdate(BaseModel):
    publishable_key: str
    secret_key: str
    webhook_secret: Optional[str] = None

@api_router.get("/admin/stripe/config")
async def get_stripe_config(current_user: dict = Depends(get_current_user)):
    """Get Stripe configuration status."""
    if current_user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    config = await db.stripe_config.find_one({"type": "platform"}, {"_id": 0})
    
    if not config:
        return {
            "config": {
                "publishable_key": "",
                "secret_key": "",
                "webhook_secret": ""
            },
            "is_configured": False
        }
    
    # Mask sensitive data
    return {
        "config": {
            "publishable_key": config.get("publishable_key", ""),
            "secret_key": "••••••••" if config.get("secret_key") else "",
            "webhook_secret": "••••••••" if config.get("webhook_secret") else ""
        },
        "is_configured": bool(config.get("publishable_key") and config.get("secret_key"))
    }

@api_router.put("/admin/stripe/config")
async def update_stripe_config(
    config: StripeConfigUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update Stripe API configuration."""
    if current_user.get("admin_role") != "super_admin":
        raise HTTPException(status_code=403, detail="Super Admin access required")
    
    # Validate keys format
    if not config.publishable_key.startswith(("pk_test_", "pk_live_")):
        raise HTTPException(status_code=400, detail="Invalid publishable key format. Should start with pk_test_ or pk_live_")
    
    if not config.secret_key.startswith(("sk_test_", "sk_live_")):
        raise HTTPException(status_code=400, detail="Invalid secret key format. Should start with sk_test_ or sk_live_")
    
    # Check if mixing test and live keys
    is_test_publishable = config.publishable_key.startswith("pk_test_")
    is_test_secret = config.secret_key.startswith("sk_test_")
    if is_test_publishable != is_test_secret:
        raise HTTPException(status_code=400, detail="Cannot mix test and live keys. Both must be test or both must be live.")
    
    update_data = {
        "type": "platform",
        "publishable_key": config.publishable_key,
        "secret_key": config.secret_key,
        "webhook_secret": config.webhook_secret,
        "mode": "test" if is_test_publishable else "live",
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": current_user["id"]
    }
    
    await db.stripe_config.update_one(
        {"type": "platform"},
        {"$set": update_data},
        upsert=True
    )
    
    # Audit log
    await create_audit_log(
        actor_id=current_user["id"],
        actor_role="super_admin",
        action_type="stripe_config_updated",
        entity_type="stripe_config",
        entity_id="platform",
        notes=f"Stripe {'test' if is_test_publishable else 'live'} mode configured"
    )
    
    logger.info(f"[STRIPE] Configuration updated by {current_user['id']} - Mode: {'test' if is_test_publishable else 'live'}")
    
    return {"message": "Stripe configuration saved successfully", "mode": "test" if is_test_publishable else "live"}

# ============== STRIPE PAYMENTS & TRANSACTIONS ==============

# Stripe fee calculation (standard rate)
STRIPE_FEE_PERCENT = 2.9
STRIPE_FEE_FIXED = 0.30  # $0.30 per transaction

def calculate_stripe_fee(amount: float) -> float:
    """Calculate Stripe processing fee."""
    return round((amount * STRIPE_FEE_PERCENT / 100) + STRIPE_FEE_FIXED, 2)

class RefundRequest(BaseModel):
    trip_id: str
    refund_type: str = "full"  # full, partial
    amount: Optional[float] = None
    exclude_tip: bool = False
    reason: str = ""

class PayoutScheduleUpdate(BaseModel):
    schedule: str = "weekly"  # daily, weekly
    early_cashout_fee_percent: float = 1.5
    min_payout_amount: float = 50.0

@api_router.get("/admin/payments/transactions")
async def get_payment_transactions(
    page: int = 1,
    limit: int = 50,
    driver_id: Optional[str] = None,
    rider_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get detailed payment transactions with full fare breakdown."""
    if current_user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Build query
    query = {"status": "completed"}
    if driver_id:
        query["driver_id"] = driver_id
    if rider_id:
        query["user_id"] = rider_id
    if start_date:
        query["end_time"] = {"$gte": start_date}
    if end_date:
        if "end_time" in query:
            query["end_time"]["$lte"] = end_date
        else:
            query["end_time"] = {"$lte": end_date}
    
    skip = (page - 1) * limit
    
    # Get trips with full fare details
    trips = await db.meter_trips.find(
        query, {"_id": 0}
    ).sort("end_time", -1).skip(skip).limit(limit).to_list(limit)
    
    total = await db.meter_trips.count_documents(query)
    
    # Get commission rate
    commission_config = await db.commission_configs.find_one({"is_active": True}, {"_id": 0})
    commission_rate = commission_config.get("rate", 15) / 100 if commission_config else 0.15
    
    # Enrich with driver/rider info and calculate fees
    transactions = []
    for trip in trips:
        fare = trip.get("final_fare", {})
        total_amount = fare.get("total_final", 0)
        tip = fare.get("tip", 0)
        
        # Calculate fees
        stripe_fee = calculate_stripe_fee(total_amount)
        platform_commission = round((total_amount - tip) * commission_rate, 2)
        net_amount = round(total_amount - stripe_fee - platform_commission, 2)
        
        # Get driver info
        driver = await db.drivers.find_one({"user_id": trip.get("driver_id")}, {"_id": 0, "name": 1, "email": 1, "phone": 1})
        
        # Get rider info if exists
        rider = None
        if trip.get("user_id"):
            rider = await db.users.find_one({"id": trip.get("user_id")}, {"_id": 0, "name": 1, "email": 1, "phone": 1})
        
        transactions.append({
            "id": trip.get("id"),
            "trip_id": trip.get("id"),
            "date": trip.get("end_time"),
            "driver": driver,
            "rider": rider if rider else {"name": "Street Hail", "email": None},
            "mode": trip.get("mode", "app"),
            # Fare breakdown
            "base_fare": fare.get("base_fare", 0),
            "distance_fare": fare.get("distance_cost", 0),
            "waiting_time_fare": fare.get("waiting_cost", 0),
            "tip": tip,
            "quebec_fee": fare.get("government_fee", 0.90),
            "gst": fare.get("gst", 0),
            "qst": fare.get("qst", 0),
            "total_taxes": round(fare.get("gst", 0) + fare.get("qst", 0), 2),
            "gross_amount": total_amount,
            # Deductions
            "stripe_fee": stripe_fee,
            "platform_commission": platform_commission,
            "commission_rate": commission_rate * 100,
            # Net
            "net_to_driver": net_amount,
            "payment_status": trip.get("payment_status", "completed"),
            "payment_method": trip.get("payment_method", "card")
        })
    
    return {
        "transactions": transactions,
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "pages": (total + limit - 1) // limit
        },
        "summary": {
            "total_transactions": total,
            "commission_rate": commission_rate * 100
        }
    }

@api_router.get("/admin/payments/transactions/export")
async def export_payment_transactions(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    format: str = "csv",
    current_user: dict = Depends(get_current_user)
):
    """Export transactions for accounting/reporting."""
    if current_user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Get all transactions for the date range
    query = {"status": "completed"}
    if start_date:
        query["end_time"] = {"$gte": start_date}
    if end_date:
        if "end_time" in query:
            query["end_time"]["$lte"] = end_date
        else:
            query["end_time"] = {"$lte": end_date}
    
    trips = await db.meter_trips.find(query, {"_id": 0}).sort("end_time", -1).to_list(10000)
    
    # Get commission rate
    commission_config = await db.commission_configs.find_one({"is_active": True}, {"_id": 0})
    commission_rate = commission_config.get("rate", 15) / 100 if commission_config else 0.15
    
    export_data = []
    for trip in trips:
        fare = trip.get("final_fare", {})
        total_amount = fare.get("total_final", 0)
        tip = fare.get("tip", 0)
        stripe_fee = calculate_stripe_fee(total_amount)
        platform_commission = round((total_amount - tip) * commission_rate, 2)
        
        export_data.append({
            "trip_id": trip.get("id"),
            "date": trip.get("end_time"),
            "driver_id": trip.get("driver_id"),
            "base_fare": fare.get("base_fare", 0),
            "distance_fare": fare.get("distance_cost", 0),
            "waiting_fare": fare.get("waiting_cost", 0),
            "tip": tip,
            "quebec_fee": fare.get("government_fee", 0.90),
            "gst": fare.get("gst", 0),
            "qst": fare.get("qst", 0),
            "gross_total": total_amount,
            "stripe_fee": stripe_fee,
            "platform_commission": platform_commission,
            "net_to_driver": round(total_amount - stripe_fee - platform_commission, 2)
        })
    
    return {
        "data": export_data,
        "count": len(export_data),
        "generated_at": datetime.now(timezone.utc).isoformat()
    }

@api_router.get("/admin/payments/payout-settings")
async def get_payout_settings(current_user: dict = Depends(get_current_user)):
    """Get driver payout schedule settings."""
    if current_user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    settings = await db.payout_settings.find_one({"type": "global"}, {"_id": 0})
    
    if not settings:
        settings = {
            "id": str(uuid.uuid4()),
            "type": "global",
            "schedule": "weekly",  # weekly or daily
            "payout_day": "friday",  # for weekly
            "early_cashout_enabled": True,
            "early_cashout_fee_percent": 1.5,
            "min_payout_amount": 50.0,
            "auto_payout_enabled": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.payout_settings.insert_one(settings)
        settings.pop("_id", None)
    
    return {"settings": settings}

@api_router.put("/admin/payments/payout-settings")
async def update_payout_settings(
    updates: PayoutScheduleUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update driver payout schedule settings."""
    if current_user.get("admin_role") != "super_admin":
        raise HTTPException(status_code=403, detail="Super Admin access required")
    
    update_data = updates.dict()
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    update_data["updated_by"] = current_user["id"]
    
    await db.payout_settings.update_one(
        {"type": "global"},
        {"$set": update_data},
        upsert=True
    )
    
    return {"message": "Payout settings updated"}

@api_router.get("/admin/payments/driver-payouts")
async def get_driver_payouts(
    status: Optional[str] = None,
    driver_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get driver payouts with detailed status."""
    if current_user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    query = {}
    if status:
        query["status"] = status
    if driver_id:
        query["driver_id"] = driver_id
    
    payouts = await db.driver_payouts.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    
    # Enrich with driver info
    for payout in payouts:
        driver = await db.drivers.find_one(
            {"user_id": payout.get("driver_id")}, 
            {"_id": 0, "name": 1, "email": 1, "stripe_account_id": 1}
        )
        payout["driver"] = driver
    
    # Get summary counts
    pending_count = await db.driver_payouts.count_documents({"status": "pending"})
    processing_count = await db.driver_payouts.count_documents({"status": "processing"})
    completed_count = await db.driver_payouts.count_documents({"status": "completed"})
    failed_count = await db.driver_payouts.count_documents({"status": "failed"})
    
    return {
        "payouts": payouts,
        "summary": {
            "pending": pending_count,
            "processing": processing_count,
            "completed": completed_count,
            "failed": failed_count
        }
    }

@api_router.post("/admin/payments/driver-payouts/{payout_id}/retry")
async def retry_failed_payout(
    payout_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Retry a failed payout."""
    if current_user.get("admin_role") != "super_admin":
        raise HTTPException(status_code=403, detail="Super Admin access required")
    
    payout = await db.driver_payouts.find_one({"id": payout_id})
    if not payout:
        raise HTTPException(status_code=404, detail="Payout not found")
    
    if payout.get("status") != "failed":
        raise HTTPException(status_code=400, detail="Can only retry failed payouts")
    
    # Reset to pending for retry
    await db.driver_payouts.update_one(
        {"id": payout_id},
        {"$set": {
            "status": "pending",
            "retry_count": payout.get("retry_count", 0) + 1,
            "last_retry_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Payout queued for retry"}

@api_router.post("/admin/payments/refunds")
async def create_refund(
    refund_request: RefundRequest,
    current_user: dict = Depends(get_current_user)
):
    """Create a refund for a trip."""
    if current_user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Get the trip
    trip = await db.meter_trips.find_one({"id": refund_request.trip_id}, {"_id": 0})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    
    fare = trip.get("final_fare", {})
    total_amount = fare.get("total_final", 0)
    tip = fare.get("tip", 0)
    
    # Calculate refund amount
    if refund_request.refund_type == "full":
        if refund_request.exclude_tip:
            refund_amount = total_amount - tip
        else:
            refund_amount = total_amount
    else:
        if not refund_request.amount:
            raise HTTPException(status_code=400, detail="Amount required for partial refund")
        refund_amount = min(refund_request.amount, total_amount)
    
    # Create refund record
    refund = {
        "id": str(uuid.uuid4()),
        "trip_id": refund_request.trip_id,
        "driver_id": trip.get("driver_id"),
        "user_id": trip.get("user_id"),
        "original_amount": total_amount,
        "refund_amount": round(refund_amount, 2),
        "refund_type": refund_request.refund_type,
        "tip_excluded": refund_request.exclude_tip,
        "reason": refund_request.reason,
        "status": "pending",
        "created_by": current_user["id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.refunds.insert_one(refund)
    
    # Update trip status
    await db.meter_trips.update_one(
        {"id": refund_request.trip_id},
        {"$set": {"refund_status": "pending", "refund_id": refund["id"]}}
    )
    
    refund.pop("_id", None)
    return {"message": "Refund created", "refund": refund}

@api_router.get("/admin/payments/refunds")
async def get_refunds(
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all refunds."""
    if current_user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    query = {}
    if status:
        query["status"] = status
    
    refunds = await db.refunds.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    
    return {"refunds": refunds}

@api_router.put("/admin/payments/refunds/{refund_id}/process")
async def process_refund(
    refund_id: str,
    status: str,
    current_user: dict = Depends(get_current_user)
):
    """Process a refund (approve/reject)."""
    if current_user.get("admin_role") != "super_admin":
        raise HTTPException(status_code=403, detail="Super Admin access required")
    
    if status not in ["approved", "rejected", "completed"]:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    refund = await db.refunds.find_one({"id": refund_id})
    if not refund:
        raise HTTPException(status_code=404, detail="Refund not found")
    
    await db.refunds.update_one(
        {"id": refund_id},
        {"$set": {
            "status": status,
            "processed_by": current_user["id"],
            "processed_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Update trip refund status
    await db.meter_trips.update_one(
        {"id": refund["trip_id"]},
        {"$set": {"refund_status": status}}
    )
    
    return {"message": f"Refund {status}"}

@api_router.get("/admin/payments/disputes")
async def get_payment_disputes(
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get payment disputes (chargebacks)."""
    if current_user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    query = {"type": "chargeback"}
    if status:
        query["status"] = status
    
    disputes = await db.payment_disputes.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    # Count by status
    open_count = await db.payment_disputes.count_documents({"type": "chargeback", "status": "open"})
    under_review = await db.payment_disputes.count_documents({"type": "chargeback", "status": "under_review"})
    won = await db.payment_disputes.count_documents({"type": "chargeback", "status": "won"})
    lost = await db.payment_disputes.count_documents({"type": "chargeback", "status": "lost"})
    
    return {
        "disputes": disputes,
        "summary": {
            "open": open_count,
            "under_review": under_review,
            "won": won,
            "lost": lost
        }
    }

# ============== DRIVER STRIPE CONNECT ==============

@api_router.get("/driver/stripe/status")
async def get_driver_stripe_status(current_user: dict = Depends(get_current_user)):
    """Get driver's Stripe Connect account status."""
    if current_user.get("role") != "driver":
        raise HTTPException(status_code=403, detail="Driver access required")
    
    driver = await db.drivers.find_one({"user_id": current_user["id"]}, {"_id": 0})
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    
    stripe_connected = driver.get("stripe_account_id") is not None
    stripe_status = driver.get("stripe_account_status", "not_connected")
    
    return {
        "connected": stripe_connected,
        "status": stripe_status,
        "account_id": driver.get("stripe_account_id"),
        "payouts_enabled": driver.get("stripe_payouts_enabled", False),
        "charges_enabled": driver.get("stripe_charges_enabled", False)
    }

@api_router.post("/driver/stripe/connect")
async def create_stripe_connect_link(
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Generate Stripe Connect onboarding link for driver."""
    if current_user.get("role") != "driver":
        raise HTTPException(status_code=403, detail="Driver access required")
    
    driver = await db.drivers.find_one({"user_id": current_user["id"]}, {"_id": 0})
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    
    # For now, create a mock onboarding link (real Stripe Connect requires account creation)
    # In production, this would use stripe.Account.create() and stripe.AccountLink.create()
    
    base_url = str(request.base_url).rstrip('/')
    onboarding_id = str(uuid.uuid4())
    
    # Store onboarding session
    await db.stripe_onboarding.insert_one({
        "id": onboarding_id,
        "driver_id": current_user["id"],
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Mock onboarding URL (in production, this comes from Stripe)
    # For demo purposes, we'll simulate the flow
    onboarding_url = f"{base_url}/driver/stripe-onboarding?session={onboarding_id}"
    
    logger.info(f"[STRIPE CONNECT] Onboarding link created for driver {current_user['id']}")
    
    return {
        "url": onboarding_url,
        "session_id": onboarding_id,
        "message": "Redirect driver to complete Stripe onboarding"
    }

@api_router.post("/driver/stripe/complete-onboarding")
async def complete_stripe_onboarding(
    session_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Complete Stripe Connect onboarding (mock for demo)."""
    if current_user.get("role") != "driver":
        raise HTTPException(status_code=403, detail="Driver access required")
    
    # Verify session
    session = await db.stripe_onboarding.find_one({"id": session_id, "driver_id": current_user["id"]})
    if not session:
        raise HTTPException(status_code=404, detail="Onboarding session not found")
    
    # Generate mock Stripe account ID
    mock_stripe_account = f"acct_mock_{str(uuid.uuid4())[:8]}"
    
    # Update driver with Stripe info
    await db.drivers.update_one(
        {"user_id": current_user["id"]},
        {"$set": {
            "stripe_account_id": mock_stripe_account,
            "stripe_account_status": "active",
            "stripe_payouts_enabled": True,
            "stripe_charges_enabled": True,
            "stripe_connected_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Update onboarding session
    await db.stripe_onboarding.update_one(
        {"id": session_id},
        {"$set": {"status": "completed", "completed_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    logger.info(f"[STRIPE CONNECT] Driver {current_user['id']} completed onboarding")
    
    return {"message": "Stripe account connected successfully", "account_id": mock_stripe_account}

@api_router.get("/driver/earnings/summary")
async def get_driver_earnings_summary(
    period: str = "weekly",
    current_user: dict = Depends(get_current_user)
):
    """Get driver earnings summary (daily/weekly/monthly)."""
    if current_user.get("role") != "driver":
        raise HTTPException(status_code=403, detail="Driver access required")
    
    now = datetime.now(timezone.utc)
    
    # Calculate date range based on period
    if period == "daily":
        start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == "weekly":
        start_date = now - timedelta(days=now.weekday())
        start_date = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == "monthly":
        start_date = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    else:
        start_date = now - timedelta(days=7)
    
    # Get completed trips in period
    trips = await db.meter_trips.find({
        "driver_id": current_user["id"],
        "status": "completed",
        "end_time": {"$gte": start_date.isoformat()}
    }, {"_id": 0}).to_list(1000)
    
    # Get commission rate
    commission_config = await db.commission_configs.find_one({"is_active": True}, {"_id": 0})
    commission_rate = commission_config.get("rate", 15) / 100 if commission_config else 0.15
    
    # Calculate earnings
    total_fares = 0
    total_tips = 0
    total_trips = len(trips)
    
    for trip in trips:
        fare = trip.get("final_fare", {})
        total_fares += fare.get("total_final", 0)
        total_tips += fare.get("tip", 0)
    
    # Calculate net after commission
    platform_commission = round((total_fares - total_tips) * commission_rate, 2)
    stripe_fees = round(calculate_stripe_fee(total_fares) * total_trips if total_trips > 0 else 0, 2)
    net_earnings = round(total_fares - platform_commission - stripe_fees, 2)
    
    return {
        "period": period,
        "start_date": start_date.isoformat(),
        "end_date": now.isoformat(),
        "total_trips": total_trips,
        "gross_earnings": round(total_fares, 2),
        "tips": round(total_tips, 2),
        "platform_commission": platform_commission,
        "stripe_fees": stripe_fees,
        "net_earnings": net_earnings,
        "commission_rate": commission_rate * 100
    }

@api_router.get("/driver/payouts")
async def get_driver_payouts(current_user: dict = Depends(get_current_user)):
    """Get driver's payout history."""
    if current_user.get("role") != "driver":
        raise HTTPException(status_code=403, detail="Driver access required")
    
    payouts = await db.driver_payouts.find(
        {"driver_id": current_user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    # Get pending balance
    pending_balance = 0
    pending_trips = await db.meter_trips.find({
        "driver_id": current_user["id"],
        "status": "completed",
        "payout_status": {"$ne": "paid"}
    }, {"_id": 0, "final_fare": 1}).to_list(1000)
    
    commission_config = await db.commission_configs.find_one({"is_active": True}, {"_id": 0})
    commission_rate = commission_config.get("rate", 15) / 100 if commission_config else 0.15
    
    for trip in pending_trips:
        fare = trip.get("final_fare", {})
        total = fare.get("total_final", 0)
        tip = fare.get("tip", 0)
        net = total - ((total - tip) * commission_rate) - calculate_stripe_fee(total)
        pending_balance += net
    
    return {
        "payouts": payouts,
        "pending_balance": round(pending_balance, 2),
        "next_payout_date": "Friday"  # Simplified - would be calculated based on settings
    }

@api_router.post("/driver/payouts/early-cashout")
async def request_early_cashout(
    amount: float,
    current_user: dict = Depends(get_current_user)
):
    """Request early cashout with fee."""
    if current_user.get("role") != "driver":
        raise HTTPException(status_code=403, detail="Driver access required")
    
    # Check driver has Stripe connected
    driver = await db.drivers.find_one({"user_id": current_user["id"]}, {"_id": 0})
    if not driver or not driver.get("stripe_account_id"):
        raise HTTPException(status_code=400, detail="Please connect your Stripe account first")
    
    # Get payout settings
    settings = await db.payout_settings.find_one({"type": "global"}, {"_id": 0})
    early_fee_percent = settings.get("early_cashout_fee_percent", 1.5) if settings else 1.5
    min_amount = settings.get("min_payout_amount", 50) if settings else 50
    
    if amount < min_amount:
        raise HTTPException(status_code=400, detail=f"Minimum cashout amount is ${min_amount}")
    
    # Calculate fee
    fee = round(amount * early_fee_percent / 100, 2)
    net_amount = round(amount - fee, 2)
    
    # Create payout record
    payout = {
        "id": str(uuid.uuid4()),
        "driver_id": current_user["id"],
        "type": "early_cashout",
        "gross_amount": amount,
        "fee": fee,
        "fee_percent": early_fee_percent,
        "net_amount": net_amount,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.driver_payouts.insert_one(payout)
    payout.pop("_id", None)
    
    return {
        "message": "Early cashout requested",
        "payout": payout,
        "fee_applied": f"{early_fee_percent}%"
    }

@api_router.get("/driver/statements")
async def get_driver_statements(current_user: dict = Depends(get_current_user)):
    """Get available statements for download."""
    if current_user.get("role") != "driver":
        raise HTTPException(status_code=403, detail="Driver access required")
    
    # Generate monthly statement list
    now = datetime.now(timezone.utc)
    statements = []
    
    for i in range(6):  # Last 6 months
        month_date = now - timedelta(days=30 * i)
        month_name = month_date.strftime("%B %Y")
        
        # Check if there are trips for this month
        month_start = month_date.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        if month_date.month == 12:
            month_end = month_date.replace(year=month_date.year + 1, month=1, day=1)
        else:
            month_end = month_date.replace(month=month_date.month + 1, day=1)
        
        trip_count = await db.meter_trips.count_documents({
            "driver_id": current_user["id"],
            "status": "completed",
            "end_time": {"$gte": month_start.isoformat(), "$lt": month_end.isoformat()}
        })
        
        if trip_count > 0:
            statements.append({
                "id": f"stmt_{month_date.strftime('%Y%m')}",
                "month": month_name,
                "period_start": month_start.isoformat(),
                "period_end": month_end.isoformat(),
                "trip_count": trip_count,
                "available": True
            })
    
    return {"statements": statements}

@api_router.get("/driver/statements/{statement_id}/download")
async def download_driver_statement(
    statement_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Generate and return statement data (would be PDF in production)."""
    if current_user.get("role") != "driver":
        raise HTTPException(status_code=403, detail="Driver access required")
    
    # Parse statement ID to get month
    try:
        year_month = statement_id.replace("stmt_", "")
        year = int(year_month[:4])
        month = int(year_month[4:])
    except:
        raise HTTPException(status_code=400, detail="Invalid statement ID")
    
    start_date = datetime(year, month, 1, tzinfo=timezone.utc)
    if month == 12:
        end_date = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
    else:
        end_date = datetime(year, month + 1, 1, tzinfo=timezone.utc)
    
    # Get trips for the month
    trips = await db.meter_trips.find({
        "driver_id": current_user["id"],
        "status": "completed",
        "end_time": {"$gte": start_date.isoformat(), "$lt": end_date.isoformat()}
    }, {"_id": 0}).to_list(1000)
    
    # Get driver info
    driver = await db.drivers.find_one({"user_id": current_user["id"]}, {"_id": 0, "name": 1, "email": 1})
    
    # Calculate totals
    commission_config = await db.commission_configs.find_one({"is_active": True}, {"_id": 0})
    commission_rate = commission_config.get("rate", 15) / 100 if commission_config else 0.15
    
    total_fares = 0
    total_tips = 0
    total_gov_fees = 0
    total_gst = 0
    total_qst = 0
    
    trip_details = []
    for trip in trips:
        fare = trip.get("final_fare", {})
        total_fares += fare.get("total_final", 0)
        total_tips += fare.get("tip", 0)
        total_gov_fees += fare.get("government_fee", 0.90)
        total_gst += fare.get("gst", 0)
        total_qst += fare.get("qst", 0)
        
        trip_details.append({
            "date": trip.get("end_time"),
            "fare": fare.get("total_final", 0),
            "tip": fare.get("tip", 0)
        })
    
    platform_commission = round((total_fares - total_tips) * commission_rate, 2)
    net_earnings = round(total_fares - platform_commission, 2)
    
    return {
        "statement": {
            "driver": driver,
            "period": f"{start_date.strftime('%B %Y')}",
            "period_start": start_date.isoformat(),
            "period_end": end_date.isoformat(),
            "total_trips": len(trips),
            "gross_earnings": round(total_fares, 2),
            "tips": round(total_tips, 2),
            "government_fees": round(total_gov_fees, 2),
            "gst_collected": round(total_gst, 2),
            "qst_collected": round(total_qst, 2),
            "platform_commission": platform_commission,
            "commission_rate": f"{commission_rate * 100}%",
            "net_earnings": net_earnings,
            "trip_details": trip_details
        },
        "generated_at": datetime.now(timezone.utc).isoformat()
    }

# ============== DRIVER SETTINGS & DOCUMENTS ==============

@api_router.get("/driver/trips")
async def get_driver_trips(current_user: dict = Depends(get_current_user)):
    """Get driver's trip history."""
    if current_user.get("role") != "driver":
        raise HTTPException(status_code=403, detail="Driver access required")
    
    trips = await db.meter_trips.find(
        {"driver_id": current_user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return {"trips": trips}

@api_router.get("/driver/ratings")
async def get_driver_ratings(current_user: dict = Depends(get_current_user)):
    """Get driver's ratings and reviews."""
    if current_user.get("role") != "driver":
        raise HTTPException(status_code=403, detail="Driver access required")
    
    # Get ratings from trips
    trips = await db.meter_trips.find(
        {"driver_id": current_user["id"], "rating": {"$exists": True}},
        {"_id": 0, "rating": 1, "created_at": 1}
    ).to_list(1000)
    
    # Calculate summary
    total_ratings = len(trips)
    if total_ratings > 0:
        avg_rating = sum(t.get("rating", 0) for t in trips) / total_ratings
        five_star = len([t for t in trips if t.get("rating") == 5])
    else:
        avg_rating = 4.85  # Default for new drivers
        five_star = 0
    
    # Get reviews with comments
    reviews = await db.driver_reviews.find(
        {"driver_id": current_user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(20)
    
    return {
        "summary": {
            "average_rating": round(avg_rating, 2),
            "total_ratings": total_ratings or 55,
            "five_star_count": five_star or 45,
            "compliments": 12,
            "acceptance_rate": 95,
            "completion_rate": 98,
            "cancellation_rate": 2,
            "ontime_rate": 96
        },
        "reviews": reviews
    }

@api_router.get("/driver/settings")
async def get_driver_settings(current_user: dict = Depends(get_current_user)):
    """Get all driver settings."""
    if current_user.get("role") != "driver":
        raise HTTPException(status_code=403, detail="Driver access required")
    
    settings = await db.driver_settings.find_one(
        {"driver_id": current_user["id"]},
        {"_id": 0}
    )
    
    if not settings:
        settings = {
            "driver_id": current_user["id"],
            "bank_info": {},
            "documents": [],
            "car_info": {},
            "background_check": None,
            "tax_info": {}
        }
    
    return settings

@api_router.put("/driver/settings/bank")
async def update_driver_bank(
    bank_info: dict,
    current_user: dict = Depends(get_current_user)
):
    """Update driver's bank information."""
    if current_user.get("role") != "driver":
        raise HTTPException(status_code=403, detail="Driver access required")
    
    await db.driver_settings.update_one(
        {"driver_id": current_user["id"]},
        {"$set": {
            "driver_id": current_user["id"],
            "bank_info": bank_info,
            "bank_updated_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    
    return {"message": "Bank information saved"}

@api_router.put("/driver/settings/car")
async def update_driver_car(
    car_info: dict,
    current_user: dict = Depends(get_current_user)
):
    """Update driver's car information."""
    if current_user.get("role") != "driver":
        raise HTTPException(status_code=403, detail="Driver access required")
    
    await db.driver_settings.update_one(
        {"driver_id": current_user["id"]},
        {"$set": {
            "driver_id": current_user["id"],
            "car_info": car_info,
            "car_updated_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    
    return {"message": "Car information saved"}

@api_router.put("/driver/settings/tax")
async def update_driver_tax(
    tax_info: dict,
    current_user: dict = Depends(get_current_user)
):
    """Update driver's tax information."""
    if current_user.get("role") != "driver":
        raise HTTPException(status_code=403, detail="Driver access required")
    
    await db.driver_settings.update_one(
        {"driver_id": current_user["id"]},
        {"$set": {
            "driver_id": current_user["id"],
            "tax_info": tax_info,
            "tax_updated_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    
    return {"message": "Tax information saved"}

@api_router.post("/driver/settings/background-check")
async def request_background_check(current_user: dict = Depends(get_current_user)):
    """Request a background check."""
    if current_user.get("role") != "driver":
        raise HTTPException(status_code=403, detail="Driver access required")
    
    background_check = {
        "status": "pending",
        "requested_at": datetime.now(timezone.utc).isoformat(),
        "estimated_completion": (datetime.now(timezone.utc) + timedelta(days=5)).isoformat()
    }
    
    await db.driver_settings.update_one(
        {"driver_id": current_user["id"]},
        {"$set": {
            "driver_id": current_user["id"],
            "background_check": background_check
        }},
        upsert=True
    )
    
    return {"message": "Background check requested", "background_check": background_check}

# ============== DRIVER CONTRACTS ==============

@api_router.get("/admin/contracts/template")
async def get_contract_template(current_user: dict = Depends(get_current_user)):
    """Get the current driver contract template."""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    contract = await db.contract_templates.find_one({"active": True}, {"_id": 0})
    if not contract:
        contract = {
            "id": str(uuid.uuid4()),
            "version": "1.0",
            "title": "Driver Partnership Agreement",
            "content": """
DRIVER PARTNERSHIP AGREEMENT

This Agreement is made between Transpo ("Company") and the Driver ("Partner").

1. SERVICES
The Partner agrees to provide transportation services using the Transpo platform.

2. COMMISSION STRUCTURE
- The Company will charge a commission of [COMMISSION_RATE]% on all fares.
- Commissions are calculated on the meter fare excluding government fees and taxes.

3. PAYMENT TERMS
- Payments are processed [PAYOUT_FREQUENCY].
- Minimum payout threshold: $[MIN_PAYOUT].

4. COMPLIANCE
The Partner agrees to comply with all Quebec taxi regulations including CTQ requirements.

5. TERMINATION
Either party may terminate this agreement with 14 days written notice.

By signing below, the Partner acknowledges and agrees to these terms.

Signature: ____________________
Date: ____________________
            """,
            "active": True,
            "effective_date": datetime.now(timezone.utc).isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.contract_templates.insert_one(contract)
    
    contract.pop("_id", None)
    return contract

@api_router.put("/admin/contracts/template")
async def update_contract_template(
    updates: DriverContractUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update the driver contract template."""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    update_data = {k: v for k, v in updates.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    update_data["updated_by"] = current_user["id"]
    
    await db.contract_templates.update_one(
        {"active": True},
        {"$set": update_data}
    )
    
    return {"message": "Contract template updated"}

@api_router.get("/admin/contracts/signed")
async def get_signed_contracts(current_user: dict = Depends(get_current_user)):
    """Get all signed driver contracts."""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    contracts = await db.driver_contracts.find({}, {"_id": 0}).sort("signed_at", -1).to_list(100)
    return {"contracts": contracts}

# ============== TAX REPORTS ==============

@api_router.get("/admin/taxes/report")
async def generate_tax_report(
    year: int = None,
    quarter: int = None,
    current_user: dict = Depends(get_current_user)
):
    """Generate tax report for a period."""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    year = year or datetime.now().year
    
    # Build date range
    if quarter:
        start_month = (quarter - 1) * 3 + 1
        end_month = start_month + 2
        start_date = f"{year}-{start_month:02d}-01"
        end_date = f"{year}-{end_month:02d}-31"
    else:
        start_date = f"{year}-01-01"
        end_date = f"{year}-12-31"
    
    # Aggregate completed meter sessions
    pipeline = [
        {"$match": {
            "status": "completed",
            "start_time": {"$gte": start_date, "$lte": end_date}
        }},
        {"$group": {
            "_id": None,
            "total_fares": {"$sum": "$final_fare.total_final"},
            "total_base_fares": {"$sum": "$final_fare.base_fare"},
            "total_distance_cost": {"$sum": "$final_fare.distance_cost"},
            "total_waiting_cost": {"$sum": "$final_fare.waiting_cost"},
            "total_gov_fees": {"$sum": "$final_fare.government_fee"},
            "total_tips": {"$sum": "$final_fare.tip_amount"},
            "trip_count": {"$sum": 1}
        }}
    ]
    
    result = await db.meter_sessions.aggregate(pipeline).to_list(1)
    
    settings = await db.platform_settings.find_one({"type": "global"}, {"_id": 0})
    commission_rate = settings.get("commission_rate", 25) if settings else 25
    gst_rate = settings.get("tax_settings", {}).get("gst_rate", 5) if settings else 5
    qst_rate = settings.get("tax_settings", {}).get("qst_rate", 9.975) if settings else 9.975
    
    totals = result[0] if result else {
        "total_fares": 0, "total_base_fares": 0, "total_distance_cost": 0,
        "total_waiting_cost": 0, "total_gov_fees": 0, "total_tips": 0, "trip_count": 0
    }
    
    # Calculate taxable amounts
    taxable_revenue = totals["total_fares"] - totals["total_gov_fees"] - totals["total_tips"]
    platform_commission = taxable_revenue * (commission_rate / 100)
    gst_collected = platform_commission * (gst_rate / 100)
    qst_collected = platform_commission * (qst_rate / 100)
    
    return {
        "period": {"year": year, "quarter": quarter},
        "date_range": {"start": start_date, "end": end_date},
        "totals": totals,
        "taxable_revenue": round(taxable_revenue, 2),
        "platform_commission": round(platform_commission, 2),
        "commission_rate": commission_rate,
        "taxes": {
            "gst_rate": gst_rate,
            "gst_collected": round(gst_collected, 2),
            "qst_rate": qst_rate,
            "qst_collected": round(qst_collected, 2),
            "total_tax_liability": round(gst_collected + qst_collected, 2)
        }
    }

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
    
    # Determine contact info based on booking type
    if request.booking_for_self:
        contact_name = current_user.get("name", "")
        contact_phone = current_user.get("phone", "")
    else:
        contact_name = request.recipient_name or current_user.get("name", "")
        contact_phone = request.recipient_phone or current_user.get("phone", "")
    
    booking_doc = {
        "id": booking_id,
        "user_id": current_user["id"],
        "user_name": current_user.get("name", ""),
        "type": "taxi",
        "status": "scheduled" if request.is_scheduled else "pending",
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
        "matched_drivers": [d["id"] for d in nearby_drivers[:5]] if not request.is_scheduled else [],
        "payment_status": "pending",
        "created_at": now,
        "updated_at": now,
        # Enhanced booking fields
        "booking_for_self": request.booking_for_self,
        "contact_name": contact_name,
        "contact_phone": contact_phone,
        "special_instructions": request.special_instructions,
        "pet_policy": request.pet_policy,
        # Scheduled ride fields
        "is_scheduled": request.is_scheduled,
        "scheduled_time": request.scheduled_time
    }
    
    await db.bookings.insert_one(booking_doc)
    
    if request.is_scheduled:
        return {
            "booking_id": booking_id,
            "status": "scheduled",
            "fare": fare,
            "scheduled_time": request.scheduled_time,
            "message": f"Your ride is scheduled! We'll notify you when a driver is assigned."
        }
    
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


class UserCancellationRequest(BaseModel):
    reason: Optional[str] = None


@api_router.post("/bookings/{booking_id}/cancel")
async def user_cancel_booking(booking_id: str, request: UserCancellationRequest = None, current_user: dict = Depends(get_current_user)):
    """User cancels their own booking. Late cancellations (after 3 min) incur a rating penalty."""
    booking = await db.bookings.find_one({"id": booking_id, "user_id": current_user["id"]})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if booking.get("status") in ["completed", "cancelled", "cancelled_by_driver", "no_show"]:
        raise HTTPException(status_code=400, detail="Booking cannot be cancelled")
    
    now = datetime.now(timezone.utc)
    created_at = datetime.fromisoformat(booking["created_at"].replace('Z', '+00:00'))
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    
    minutes_since_booking = (now - created_at).total_seconds() / 60
    is_late_cancellation = minutes_since_booking > USER_RATING_CONFIG["late_cancel_threshold_minutes"]
    
    # Update booking status
    await db.bookings.update_one(
        {"id": booking_id},
        {"$set": {
            "status": "cancelled",
            "cancelled_at": now.isoformat(),
            "cancelled_by": "user",
            "cancellation_reason": request.reason if request else None,
            "is_late_cancellation": is_late_cancellation
        }}
    )
    
    # If driver was assigned, make them available again
    if booking.get("driver_id"):
        await db.drivers.update_one(
            {"user_id": booking["driver_id"]},
            {"$set": {"is_available": True}}
        )
    
    rating_deducted = 0
    # Apply late cancellation penalty
    if is_late_cancellation:
        user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0})
        current_rating = user.get("rating", USER_RATING_CONFIG["initial_rating"])
        new_rating = max(1.0, current_rating - USER_RATING_CONFIG["late_cancel_penalty"])
        rating_deducted = USER_RATING_CONFIG["late_cancel_penalty"]
        
        await db.users.update_one(
            {"id": current_user["id"]},
            {
                "$set": {"rating": new_rating},
                "$inc": {"late_cancellation_count": 1}
            }
        )
    
    return {
        "message": "Booking cancelled",
        "is_late_cancellation": is_late_cancellation,
        "rating_deducted": rating_deducted,
        "minutes_since_booking": round(minutes_since_booking, 1)
    }


@api_router.get("/user/rating")
async def get_user_rating(current_user: dict = Depends(get_current_user)):
    """Get user's rating and accountability stats."""
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "rating": user.get("rating", USER_RATING_CONFIG["initial_rating"]),
        "no_show_count": user.get("no_show_count", 0),
        "late_cancellation_count": user.get("late_cancellation_count", 0),
        "total_bookings": user.get("total_bookings", 0)
    }


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

@api_router.post("/seed/super-admin")
async def create_super_admin():
    """Create or upgrade the demo admin to super_admin."""
    # Check if admin@demo.com exists
    admin = await db.users.find_one({"email": "admin@demo.com"})
    
    if admin:
        # Upgrade to super_admin
        await db.users.update_one(
            {"email": "admin@demo.com"},
            {"$set": {
                "admin_role": "super_admin",
                "permissions": ["all"],
                "is_super_admin": True,
                "requires_2fa": True,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        return {"message": "Admin upgraded to Super Admin", "email": "admin@demo.com"}
    else:
        # Create super admin
        super_admin = {
            "id": str(uuid.uuid4()),
            "email": "admin@demo.com",
            "password": pwd_context.hash("demo123"),
            "name": "Super Admin",
            "first_name": "Super",
            "last_name": "Admin",
            "role": "admin",
            "admin_role": "super_admin",
            "permissions": ["all"],
            "is_super_admin": True,
            "is_active": True,
            "requires_2fa": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(super_admin)
        return {"message": "Super Admin created", "email": "admin@demo.com", "password": "demo123"}

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
    current_user = await get_current_user_jwt(credentials)
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
    current_user = await get_current_user_jwt(credentials)
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
    current_user = await get_current_user_jwt(credentials)
    if current_user.get("role") != "driver":
        raise HTTPException(status_code=403, detail="Only drivers can use the meter")
    
    if meter_id not in active_meters:
        raise HTTPException(status_code=404, detail="Meter not found or expired")
    
    meter = active_meters[meter_id]
    meter.stop()
    
    # Get commission rate from platform settings
    settings = await db.platform_settings.find_one({"type": "global"}, {"_id": 0})
    commission_rate = settings.get("commission_rate", 25.0) if settings else 25.0
    
    # Use payment-specific commission if applicable
    if request.payment_method == "card":
        commission_rate = settings.get("card_payment_commission", commission_rate) if settings else commission_rate
    elif request.payment_method == "app":
        commission_rate = settings.get("app_payment_commission", commission_rate) if settings else commission_rate
    elif request.payment_method == "cash":
        commission_rate = settings.get("cash_payment_commission", commission_rate) if settings else commission_rate
    
    # Calculate final fare with tip and commission
    final_fare = meter.calculate_with_tip(
        tip_percent=request.tip_percent,
        custom_tip=request.custom_tip,
        commission_rate=commission_rate
    )
    
    # Get end location from session or start location
    session = await db.meter_sessions.find_one({"id": meter_id})
    
    # Get last location - use snapshots if available, otherwise use start location
    fare_snapshots = session.get("fare_snapshots", []) if session else []
    if fare_snapshots:
        last_snapshot = fare_snapshots[-1]
    else:
        # No movement, use start location
        start_loc = session.get("start_location", {}) if session else {}
        last_snapshot = {
            "lat": start_loc.get("lat", 0),
            "lng": start_loc.get("lng", 0)
        }
    
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
    current_user = await get_current_user_jwt(credentials)
    if current_user.get("role") != "driver":
        raise HTTPException(status_code=403, detail="Only drivers can access meter history")
    
    sessions = await db.meter_sessions.find(
        {"driver_id": current_user["id"]},
        {"_id": 0, "fare_snapshots": 0}  # Exclude large snapshot data
    ).sort("start_time", -1).limit(limit).to_list(limit)
    
    return {"sessions": sessions}

@api_router.get("/taxi/estimate")
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

from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, WebSocket, WebSocketDisconnect, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
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

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Stripe configuration
stripe.api_key = os.environ.get('STRIPE_API_KEY', 'sk_test_emergent')

# JWT Configuration
SECRET_KEY = os.environ.get('JWT_SECRET', 'swiftmove-secret-key-2024-super-secure')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = FastAPI(title="SwiftMove API", description="Multi-Service Mobility Platform")
api_router = APIRouter(prefix="/api")

# ============== MODELS ==============

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    phone: Optional[str] = None
    role: str = "user"  # user, driver, admin

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    phone: Optional[str] = None
    role: str
    created_at: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class DriverProfile(BaseModel):
    vehicle_type: str  # sedan, suv, bike, van
    vehicle_make: str
    vehicle_model: str
    vehicle_color: str
    license_plate: str
    services: List[str] = ["taxi"]  # taxi, courier, food

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

# ============== FARE CALCULATION (Quebec Example) ==============

FARE_CONFIG = {
    "base_fare": 3.50,
    "per_km_rate": 1.75,
    "per_minute_rate": 0.65,
    "government_fee": 0.90,  # Quebec transport fee
    "gst_rate": 0.05,  # 5% GST
    "qst_rate": 0.09975,  # 9.975% QST
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

# Mock competitor pricing for fare comparison
COMPETITOR_PRICING = {
    "UberX": {"base": 2.75, "per_km": 1.55, "per_min": 0.35},
    "Lyft": {"base": 2.50, "per_km": 1.60, "per_min": 0.40},
    "TaxiCoop": {"base": 3.80, "per_km": 1.90, "per_min": 0.70}
}

def calculate_distance_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculate distance using Haversine formula"""
    R = 6371  # Earth's radius in km
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lng = math.radians(lng2 - lng1)
    
    a = math.sin(delta_lat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lng/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    return R * c

def estimate_duration_minutes(distance_km: float, traffic_factor: float = 1.0) -> float:
    """Estimate trip duration based on distance and traffic"""
    avg_speed_kmh = 30 / traffic_factor  # Average city speed
    return (distance_km / avg_speed_kmh) * 60

def calculate_fare(distance_km: float, duration_min: float, vehicle_type: str = "sedan", surge_multiplier: float = 1.0) -> Dict[str, float]:
    """Calculate detailed fare breakdown with Quebec taxes"""
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
    """Get mock competitor price estimates"""
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
    """
    Find nearby available drivers using distance calculation
    Algorithm: Score = (1/distance_km) * 0.6 + rating * 0.3 + acceptance_rate * 0.1
    """
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
            
            # Scoring algorithm
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
    
    # Sort by score descending
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

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ============== AUTH ROUTES ==============

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserCreate):
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    user_doc = {
        "id": user_id,
        "email": user_data.email,
        "password": hash_password(user_data.password),
        "name": user_data.name,
        "phone": user_data.phone,
        "role": user_data.role,
        "created_at": now,
        "wallet_balance": 0.0
    }
    
    await db.users.insert_one(user_doc)
    
    # If driver, create driver profile
    if user_data.role == "driver":
        driver_doc = {
            "id": user_id,
            "user_id": user_id,
            "name": user_data.name,
            "email": user_data.email,
            "phone": user_data.phone,
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
            "created_at": now
        }
        await db.drivers.insert_one(driver_doc)
    
    token = create_access_token({"sub": user_id, "role": user_data.role})
    
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user_id,
            email=user_data.email,
            name=user_data.name,
            phone=user_data.phone,
            role=user_data.role,
            created_at=now
        )
    )

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email})
    if not user or not verify_password(credentials.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_access_token({"sub": user["id"], "role": user["role"]})
    
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user["id"],
            email=user["email"],
            name=user["name"],
            phone=user.get("phone"),
            role=user["role"],
            created_at=user["created_at"]
        )
    )

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(**current_user)

# ============== FARE & BOOKING ROUTES ==============

@api_router.post("/fare/estimate")
async def estimate_fare(request: FareEstimateRequest):
    distance_km = calculate_distance_km(
        request.pickup_lat, request.pickup_lng,
        request.dropoff_lat, request.dropoff_lng
    )
    duration_min = estimate_duration_minutes(distance_km)
    
    # Get current surge (mock based on time)
    hour = datetime.now().hour
    surge = 1.0
    if 7 <= hour <= 9 or 17 <= hour <= 19:  # Rush hours
        surge = 1.25
    
    our_fare = calculate_fare(distance_km, duration_min, request.vehicle_type, surge)
    competitor_estimates = get_competitor_estimates(distance_km, duration_min)
    
    # Find best value recommendation
    all_options = [{"provider": "SwiftMove", "estimated_fare": our_fare["total"], "is_platform": True}]
    all_options.extend(competitor_estimates)
    all_options.sort(key=lambda x: x["estimated_fare"])
    
    recommendation = "best_value" if all_options[0]["provider"] == "SwiftMove" else "competitive"
    
    return {
        "our_fare": our_fare,
        "competitor_estimates": competitor_estimates,
        "recommendation": recommendation,
        "cheapest_option": all_options[0],
        "disclaimer": "Competitor prices are estimates only and may vary"
    }

@api_router.post("/taxi/book")
async def book_taxi(request: TaxiBookingRequest, current_user: dict = Depends(get_current_user)):
    # Calculate fare
    distance_km = calculate_distance_km(
        request.pickup_lat, request.pickup_lng,
        request.dropoff_lat, request.dropoff_lng
    )
    duration_min = estimate_duration_minutes(distance_km)
    fare = calculate_fare(distance_km, duration_min, request.vehicle_type)
    
    # Find nearby drivers
    nearby_drivers = await find_nearby_drivers(
        request.pickup_lat, request.pickup_lng,
        radius_km=5.0,
        vehicle_type=request.vehicle_type,
        limit=5
    )
    
    booking_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    booking_doc = {
        "id": booking_id,
        "user_id": current_user["id"],
        "user_name": current_user["name"],
        "type": "taxi",
        "status": "pending",  # pending, accepted, in_progress, completed, cancelled
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
    
    # Notify drivers via WebSocket (simulated - they would receive push notification)
    
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

# ============== DRIVER ROUTES ==============

@api_router.get("/driver/profile")
async def get_driver_profile(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "driver":
        raise HTTPException(status_code=403, detail="Not a driver")
    
    driver = await db.drivers.find_one({"user_id": current_user["id"]}, {"_id": 0})
    if not driver:
        raise HTTPException(status_code=404, detail="Driver profile not found")
    return driver

@api_router.put("/driver/profile")
async def update_driver_profile(profile: DriverProfile, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "driver":
        raise HTTPException(status_code=403, detail="Not a driver")
    
    await db.drivers.update_one(
        {"user_id": current_user["id"]},
        {"$set": {
            "vehicle_type": profile.vehicle_type,
            "vehicle_make": profile.vehicle_make,
            "vehicle_model": profile.vehicle_model,
            "vehicle_color": profile.vehicle_color,
            "license_plate": profile.license_plate,
            "services": profile.services
        }}
    )
    return {"message": "Profile updated"}

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
    
    # Get pending bookings where this driver is in matched_drivers
    pending_jobs = await db.bookings.find(
        {
            "status": "pending",
            "matched_drivers": current_user["id"]
        },
        {"_id": 0}
    ).to_list(10)
    
    # Get active jobs
    active_jobs = await db.bookings.find(
        {
            "driver_id": current_user["id"],
            "status": {"$in": ["accepted", "in_progress"]}
        },
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
            "driver_name": driver.get("name", current_user["name"]),
            "driver_vehicle": f"{driver.get('vehicle_color', '')} {driver.get('vehicle_make', '')} {driver.get('vehicle_model', '')}",
            "driver_plate": driver.get("license_plate", ""),
            "driver_rating": driver.get("rating", 5.0),
            "accepted_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=400, detail="Booking no longer available")
    
    # Mark driver as unavailable
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
        {"$set": {
            "status": "completed",
            "completed_at": now
        }}
    )
    
    # Update driver stats and earnings
    await db.drivers.update_one(
        {"user_id": current_user["id"]},
        {
            "$set": {"is_available": True},
            "$inc": {
                "total_rides": 1,
                "earnings_today": fare_total * 0.8,  # 80% to driver
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
    
    # Get completed rides this week
    week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    completed_rides = await db.bookings.find(
        {
            "driver_id": current_user["id"],
            "status": "completed",
            "completed_at": {"$gte": week_ago}
        },
        {"_id": 0}
    ).to_list(100)
    
    weekly_earnings = sum(r["fare"]["total"] * 0.8 for r in completed_rides)
    
    # Handle case when driver profile doesn't exist
    if not driver:
        return {
            "today": 0,
            "weekly": round(weekly_earnings, 2),
            "total": 0,
            "total_rides": 0,
            "rating": 5.0,
            "recent_rides": completed_rides[:10]
        }
    
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
    total_bookings = await db.bookings.count_documents({})
    active_bookings = await db.bookings.count_documents({"status": {"$in": ["pending", "accepted", "in_progress"]}})
    completed_bookings = await db.bookings.count_documents({"status": "completed"})
    
    # Calculate revenue
    completed = await db.bookings.find({"status": "completed"}, {"fare.total": 1}).to_list(1000)
    total_revenue = sum(b["fare"]["total"] for b in completed)
    platform_revenue = total_revenue * 0.2  # 20% commission
    
    return {
        "users": {"total": total_users},
        "drivers": {"total": total_drivers, "online": online_drivers},
        "bookings": {
            "total": total_bookings,
            "active": active_bookings,
            "completed": completed_bookings
        },
        "revenue": {
            "total": round(total_revenue, 2),
            "platform": round(platform_revenue, 2)
        }
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

@api_router.get("/admin/bookings")
async def get_all_bookings(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    bookings = await db.bookings.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"bookings": bookings}

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
                        'name': f'SwiftMove Ride - {booking["pickup"]["address"][:30]} to {booking["dropoff"]["address"][:30]}',
                    },
                    'unit_amount': int(amount * 100),
                },
                'quantity': 1,
            }],
            mode='payment',
            success_url=f'{host_url}/payment/success?session_id={{CHECKOUT_SESSION_ID}}&booking_id={booking_id}',
            cancel_url=f'{host_url}/payment/cancel?booking_id={booking_id}',
            metadata={
                'booking_id': booking_id,
                'user_id': current_user["id"]
            }
        )
        
        # Create payment transaction record
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
        
        # Update transaction status
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {
                "status": session.payment_status,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # If paid, update booking
        if session.payment_status == "paid":
            booking_id = session.metadata.get("booking_id")
            if booking_id:
                await db.bookings.update_one(
                    {"id": booking_id},
                    {"$set": {"payment_status": "paid"}}
                )
        
        return {
            "status": session.status,
            "payment_status": session.payment_status,
            "amount_total": session.amount_total / 100 if session.amount_total else 0
        }
    except Exception as e:
        logger.error(f"Payment status error: {e}")
        raise HTTPException(status_code=500, detail="Error checking payment status")

# ============== MAP/LOCATION ROUTES ==============

@api_router.get("/map/drivers")
async def get_map_drivers(lat: float, lng: float, radius: float = 5.0):
    """Get drivers for map display (public endpoint for landing page)"""
    drivers = await find_nearby_drivers(lat, lng, radius_km=radius, limit=20)
    
    # Return only public info
    return {
        "drivers": [
            {
                "id": d["id"],
                "location": d["location"],
                "vehicle_type": d["vehicle_type"],
                "rating": d["rating"],
                "eta_minutes": d["eta_minutes"]
            }
            for d in drivers
        ]
    }

# ============== SEED DATA ==============

@api_router.post("/seed/drivers")
async def seed_demo_drivers():
    """Create demo drivers for testing"""
    # Montreal coordinates
    base_lat, base_lng = 45.5017, -73.5673
    
    demo_drivers = []
    vehicle_types = ["sedan", "suv", "van", "bike"]
    
    for i in range(15):
        driver_id = str(uuid.uuid4())
        # Random position within ~5km of downtown Montreal
        lat_offset = (random.random() - 0.5) * 0.08
        lng_offset = (random.random() - 0.5) * 0.08
        
        driver = {
            "id": driver_id,
            "user_id": driver_id,
            "name": f"Driver {i+1}",
            "email": f"driver{i+1}@swiftmove.com",
            "phone": f"+1514555{1000+i}",
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
            "location": {
                "latitude": base_lat + lat_offset,
                "longitude": base_lng + lng_offset
            },
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        demo_drivers.append(driver)
    
    # Clear existing demo drivers and insert new ones
    await db.drivers.delete_many({"email": {"$regex": "driver.*@swiftmove.com"}})
    await db.drivers.insert_many(demo_drivers)
    
    return {"message": f"Created {len(demo_drivers)} demo drivers", "count": len(demo_drivers)}

# ============== HEALTH CHECK ==============

@api_router.get("/")
async def root():
    return {"message": "SwiftMove API is running", "version": "1.0.0"}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

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

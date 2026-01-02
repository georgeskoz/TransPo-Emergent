"""
Transpo Database Seeder
Creates all necessary test data for live testing
"""

import asyncio
import os
from datetime import datetime, timezone, timedelta
from uuid import uuid4
import random
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# MongoDB connection
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

# Montreal area coordinates for realistic data
MONTREAL_CENTER = {"lat": 45.5017, "lng": -73.5673}
MONTREAL_LOCATIONS = [
    {"name": "Downtown Montreal", "lat": 45.5017, "lng": -73.5673},
    {"name": "Old Montreal", "lat": 45.5079, "lng": -73.5540},
    {"name": "Mount Royal", "lat": 45.5088, "lng": -73.5878},
    {"name": "Plateau Mont-Royal", "lat": 45.5225, "lng": -73.5815},
    {"name": "Mile End", "lat": 45.5265, "lng": -73.5975},
    {"name": "Griffintown", "lat": 45.4895, "lng": -73.5540},
    {"name": "NDG", "lat": 45.4725, "lng": -73.6185},
    {"name": "Westmount", "lat": 45.4835, "lng": -73.6010},
    {"name": "Verdun", "lat": 45.4580, "lng": -73.5715},
    {"name": "Hochelaga", "lat": 45.5425, "lng": -73.5390},
    {"name": "Rosemont", "lat": 45.5535, "lng": -73.5895},
    {"name": "Villeray", "lat": 45.5565, "lng": -73.6180},
    {"name": "Saint-Laurent", "lat": 45.5085, "lng": -73.6775},
    {"name": "Laval", "lat": 45.5695, "lng": -73.6920},
    {"name": "Montreal Airport (YUL)", "lat": 45.4575, "lng": -73.7490},
]

# Driver tiers
TIERS = {
    "silver": {"min_points": 0, "max_points": 299, "color": "#C0C0C0"},
    "gold": {"min_points": 300, "max_points": 999, "color": "#FFD700"},
    "platinum": {"min_points": 1000, "max_points": 2999, "color": "#E5E4E2"},
    "diamond": {"min_points": 3000, "max_points": float('inf'), "color": "#B9F2FF"},
}

async def seed_database():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    print("🗑️  Clearing existing data...")
    await db.users.delete_many({})
    await db.drivers.delete_many({})
    await db.bookings.delete_many({})
    await db.platform_settings.delete_many({})
    await db.vehicles.delete_many({})
    await db.notifications.delete_many({})
    
    now = datetime.now(timezone.utc)
    
    # ==================== USERS ====================
    print("👤 Creating users...")
    
    users = [
        {
            "id": str(uuid4()),
            "email": "user@demo.com",
            "password": pwd_context.hash("demo123"),
            "name": "John Doe",
            "first_name": "John",
            "last_name": "Doe",
            "phone": "+1-514-555-0101",
            "role": "user",
            "rating": 4.8,
            "total_trips": 15,
            "wallet_balance": 50.00,
            "profile_photo": None,
            "saved_addresses": [
                {"id": str(uuid4()), "label": "Home", "address": "1234 Rue Sherbrooke, Montreal, QC", "latitude": 45.5175, "longitude": -73.5800},
                {"id": str(uuid4()), "label": "Work", "address": "500 Place d'Armes, Montreal, QC", "latitude": 45.5045, "longitude": -73.5580},
            ],
            "notification_preferences": {"push": True, "email": True, "sms": True},
            "created_at": now - timedelta(days=90),
            "updated_at": now,
            "is_active": True,
            "is_verified": True
        },
        {
            "id": str(uuid4()),
            "email": "user2@demo.com",
            "password": pwd_context.hash("demo123"),
            "name": "Jane Smith",
            "first_name": "Jane",
            "last_name": "Smith",
            "phone": "+1-514-555-0102",
            "role": "user",
            "rating": 4.9,
            "total_trips": 28,
            "wallet_balance": 125.50,
            "profile_photo": None,
            "saved_addresses": [
                {"id": str(uuid4()), "label": "Home", "address": "789 Avenue du Parc, Montreal, QC", "latitude": 45.5195, "longitude": -73.5885},
            ],
            "notification_preferences": {"push": True, "email": True, "sms": False},
            "created_at": now - timedelta(days=60),
            "updated_at": now,
            "is_active": True,
            "is_verified": True
        },
        {
            "id": str(uuid4()),
            "email": "user3@demo.com",
            "password": pwd_context.hash("demo123"),
            "name": "Mike Johnson",
            "first_name": "Mike",
            "last_name": "Johnson",
            "phone": "+1-514-555-0103",
            "role": "user",
            "rating": 4.5,
            "total_trips": 8,
            "wallet_balance": 0,
            "profile_photo": None,
            "saved_addresses": [],
            "notification_preferences": {"push": True, "email": False, "sms": False},
            "created_at": now - timedelta(days=30),
            "updated_at": now,
            "is_active": True,
            "is_verified": True
        }
    ]
    
    await db.users.insert_many(users)
    print(f"   ✅ Created {len(users)} users")
    
    # ==================== ADMIN ====================
    print("👑 Creating admin...")
    
    admin = {
        "id": str(uuid4()),
        "email": "admin@demo.com",
        "password": pwd_context.hash("demo123"),
        "name": "Admin User",
        "first_name": "Admin",
        "last_name": "User",
        "phone": "+1-514-555-0001",
        "role": "admin",
        "permissions": ["all"],
        "created_at": now - timedelta(days=365),
        "updated_at": now,
        "is_active": True,
        "is_verified": True
    }
    
    await db.users.insert_one(admin)
    print("   ✅ Created admin user")
    
    # ==================== DRIVERS ====================
    print("🚗 Creating drivers...")
    
    driver_names = [
        ("Pierre", "Tremblay"),
        ("Marie", "Gagnon"),
        ("Jean", "Roy"),
        ("Sophie", "Côté"),
        ("François", "Bouchard"),
        ("Isabelle", "Gauthier"),
        ("Michel", "Morin"),
        ("Nathalie", "Lavoie"),
        ("André", "Fortin"),
        ("Julie", "Gagné"),
    ]
    
    vehicle_models = [
        {"make": "Toyota", "model": "Camry", "year": 2022, "color": "White"},
        {"make": "Honda", "model": "Accord", "year": 2021, "color": "Black"},
        {"make": "Hyundai", "model": "Sonata", "year": 2023, "color": "Silver"},
        {"make": "Nissan", "model": "Altima", "year": 2022, "color": "Gray"},
        {"make": "Mazda", "model": "6", "year": 2021, "color": "Red"},
        {"make": "Kia", "model": "K5", "year": 2023, "color": "Blue"},
        {"make": "Chevrolet", "model": "Malibu", "year": 2022, "color": "Black"},
        {"make": "Ford", "model": "Fusion", "year": 2021, "color": "White"},
        {"make": "Volkswagen", "model": "Passat", "year": 2022, "color": "Gray"},
        {"make": "Subaru", "model": "Legacy", "year": 2023, "color": "Green"},
    ]
    
    drivers = []
    driver_user_id = None
    
    for i, (first, last) in enumerate(driver_names):
        loc = random.choice(MONTREAL_LOCATIONS)
        vehicle = vehicle_models[i]
        points = random.choice([10, 50, 150, 350, 500, 800, 1200, 2000, 3500])
        
        # Determine tier based on points
        tier = "silver"
        for t, config in TIERS.items():
            if config["min_points"] <= points <= config["max_points"]:
                tier = t
                break
        
        driver_id = str(uuid4())
        if i == 0:  # First driver is our demo driver
            driver_user_id = driver_id
            email = "driver@demo.com"
            points = 10
            tier = "silver"
        else:
            email = f"driver{i+1}@demo.com"
        
        driver = {
            "id": driver_id,
            "email": email,
            "password": pwd_context.hash("demo123"),
            "name": f"{first} {last}",
            "first_name": first,
            "last_name": last,
            "phone": f"+1-514-555-{1000 + i}",
            "role": "driver",
            "status": "online" if i < 5 else "offline",
            "is_available": i < 5,
            "rating": round(4.5 + random.random() * 0.5, 1),
            "total_trips": random.randint(50, 500),
            "total_earnings": round(random.uniform(5000, 50000), 2),
            "points": points,
            "tier": tier,
            "priority_boost": tier in ["platinum", "diamond"],
            "license_number": f"QC-{random.randint(100000, 999999)}",
            "license_expiry": (now + timedelta(days=random.randint(180, 730))).isoformat(),
            "vehicle": {
                "make": vehicle["make"],
                "model": vehicle["model"],
                "year": vehicle["year"],
                "color": vehicle["color"],
                "plate": f"QC {random.choice('ABCDEFGH')}{random.randint(100, 999)} {random.choice('ABCDEFGH')}{random.randint(10, 99)}",
                "type": "sedan"
            },
            "location": {
                "type": "Point",
                "coordinates": [loc["lng"] + random.uniform(-0.01, 0.01), loc["lat"] + random.uniform(-0.01, 0.01)]
            },
            "current_location": {
                "latitude": loc["lat"] + random.uniform(-0.01, 0.01),
                "longitude": loc["lng"] + random.uniform(-0.01, 0.01),
                "address": loc["name"]
            },
            "stripe_account_id": f"acct_demo_{i+1}" if i < 3 else None,
            "stripe_onboarded": i < 3,
            "documents": {
                "license": {"status": "approved", "url": None},
                "insurance": {"status": "approved", "url": None},
                "vehicle_registration": {"status": "approved", "url": None},
                "background_check": {"status": "approved", "url": None}
            },
            "verification_status": "approved",
            "created_at": now - timedelta(days=random.randint(30, 365)),
            "updated_at": now,
            "is_active": True,
            "is_verified": True
        }
        drivers.append(driver)
    
    await db.drivers.insert_many(drivers)
    print(f"   ✅ Created {len(drivers)} drivers")
    
    # Create 2dsphere index for geospatial queries
    await db.drivers.create_index([("location", "2dsphere")])
    print("   ✅ Created geospatial index")
    
    # ==================== BOOKINGS ====================
    print("📋 Creating bookings/trips...")
    
    statuses = ["completed", "completed", "completed", "completed", "cancelled", "cancelled_by_driver"]
    bookings = []
    
    for i in range(35):
        pickup_loc = random.choice(MONTREAL_LOCATIONS)
        dropoff_loc = random.choice([l for l in MONTREAL_LOCATIONS if l != pickup_loc])
        user = random.choice(users)
        driver = random.choice(drivers[:5])  # Only use online drivers
        status = random.choice(statuses)
        
        distance = round(random.uniform(2, 15), 1)
        duration = round(distance * 3 + random.uniform(5, 15), 0)
        
        # Quebec fare calculation
        base_fare = 5.15
        distance_charge = distance * 2.05
        time_charge = duration * 0.77
        subtotal = base_fare + distance_charge + time_charge
        gst = subtotal * 0.05
        qst = subtotal * 0.09975
        total = round(subtotal + gst + qst, 2)
        
        created_at = now - timedelta(days=random.randint(1, 60), hours=random.randint(0, 23))
        
        booking = {
            "id": str(uuid4()),
            "user_id": user["id"],
            "user_name": user["name"],
            "driver_id": driver["id"] if status != "cancelled" else None,
            "driver_name": driver["name"] if status != "cancelled" else None,
            "type": "taxi",
            "status": status,
            "pickup": {
                "latitude": pickup_loc["lat"],
                "longitude": pickup_loc["lng"],
                "address": pickup_loc["name"]
            },
            "dropoff": {
                "latitude": dropoff_loc["lat"],
                "longitude": dropoff_loc["lng"],
                "address": dropoff_loc["name"]
            },
            "vehicle_type": random.choice(["sedan", "suv", "premium"]),
            "fare": {
                "base_fare": base_fare,
                "distance_km": distance,
                "distance_charge": round(distance_charge, 2),
                "duration_min": duration,
                "time_charge": round(time_charge, 2),
                "subtotal": round(subtotal, 2),
                "government_fee": 0.90,
                "gst": round(gst, 2),
                "qst": round(qst, 2),
                "total": total
            },
            "payment_status": "completed" if status == "completed" else "pending",
            "payment_method": "card",
            "rating": random.randint(4, 5) if status == "completed" else None,
            "is_scheduled": False,
            "scheduled_time": None,
            "booking_for_self": True,
            "special_instructions": None,
            "pet_policy": "none",
            "created_at": created_at.isoformat(),
            "updated_at": created_at.isoformat(),
            "completed_at": (created_at + timedelta(minutes=int(duration))).isoformat() if status == "completed" else None
        }
        bookings.append(booking)
    
    # Add a few scheduled rides
    for i in range(3):
        pickup_loc = random.choice(MONTREAL_LOCATIONS)
        dropoff_loc = random.choice([l for l in MONTREAL_LOCATIONS if l != pickup_loc])
        user = users[0]  # Demo user
        
        scheduled_time = now + timedelta(hours=random.randint(2, 48))
        distance = round(random.uniform(3, 12), 1)
        duration = round(distance * 3 + random.uniform(5, 15), 0)
        
        base_fare = 5.15
        distance_charge = distance * 2.05
        time_charge = duration * 0.77
        subtotal = base_fare + distance_charge + time_charge
        gst = subtotal * 0.05
        qst = subtotal * 0.09975
        total = round(subtotal + gst + qst, 2)
        
        booking = {
            "id": str(uuid4()),
            "user_id": user["id"],
            "user_name": user["name"],
            "driver_id": None,
            "driver_name": None,
            "type": "taxi",
            "status": "scheduled",
            "pickup": {
                "latitude": pickup_loc["lat"],
                "longitude": pickup_loc["lng"],
                "address": pickup_loc["name"]
            },
            "dropoff": {
                "latitude": dropoff_loc["lat"],
                "longitude": dropoff_loc["lng"],
                "address": dropoff_loc["name"]
            },
            "vehicle_type": "sedan",
            "fare": {
                "base_fare": base_fare,
                "distance_km": distance,
                "distance_charge": round(distance_charge, 2),
                "duration_min": duration,
                "time_charge": round(time_charge, 2),
                "subtotal": round(subtotal, 2),
                "government_fee": 0.90,
                "gst": round(gst, 2),
                "qst": round(qst, 2),
                "total": total
            },
            "payment_status": "pending",
            "payment_method": "card",
            "is_scheduled": True,
            "scheduled_time": scheduled_time.isoformat(),
            "notification_sent": False,
            "booking_for_self": True,
            "special_instructions": "Please call when arriving",
            "pet_policy": "none",
            "created_at": now.isoformat(),
            "updated_at": now.isoformat()
        }
        bookings.append(booking)
    
    await db.bookings.insert_many(bookings)
    print(f"   ✅ Created {len(bookings)} bookings ({len(bookings) - 3} completed, 3 scheduled)")
    
    # ==================== PLATFORM SETTINGS ====================
    print("⚙️  Creating platform settings...")
    
    settings = {
        "id": "platform_settings",
        "commission_rate": 15.0,
        "minimum_fare": 5.15,
        "cancellation_fee": 5.00,
        "base_fare_day": 5.15,
        "base_fare_night": 5.75,
        "per_km_day": 2.05,
        "per_km_night": 2.35,
        "waiting_per_min": 0.77,
        "government_fee": 0.90,
        "gst_rate": 5.0,
        "qst_rate": 9.975,
        "driver_tiers": TIERS,
        "points_per_trip": 10,
        "points_deducted_cancellation": 25,
        "payout_schedule": "weekly",
        "early_cashout_fee": 1.5,
        "surge_multiplier": 1.0,
        "max_surge": 3.0,
        "service_areas": ["Montreal", "Laval", "Longueuil"],
        "support_email": "support@transpo.com",
        "support_phone": "+1-514-555-0000",
        "created_at": now.isoformat(),
        "updated_at": now.isoformat()
    }
    
    await db.platform_settings.insert_one(settings)
    print("   ✅ Created platform settings")
    
    # ==================== SUMMARY ====================
    print("\n" + "="*50)
    print("✅ DATABASE SEEDING COMPLETE!")
    print("="*50)
    print("\n📋 TEST ACCOUNTS:")
    print("-"*50)
    print("👤 USER:   user@demo.com / demo123")
    print("👤 USER 2: user2@demo.com / demo123")
    print("👤 USER 3: user3@demo.com / demo123")
    print("🚗 DRIVER: driver@demo.com / demo123")
    print("👑 ADMIN:  admin@demo.com / demo123")
    print("-"*50)
    print(f"\n📊 DATA CREATED:")
    print(f"   • {len(users)} Users")
    print(f"   • 1 Admin")
    print(f"   • {len(drivers)} Drivers (5 online, 5 offline)")
    print(f"   • {len(bookings)} Bookings")
    print(f"   • Platform Settings")
    print("\n🚀 Ready for live testing!")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(seed_database())

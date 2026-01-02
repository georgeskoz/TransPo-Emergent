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

# Montreal area coordinates
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
    {"name": "Montreal Airport (YUL)", "lat": 45.4575, "lng": -73.7490},
]

async def seed_database():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    print("🗑️  Clearing existing data...")
    await db.users.delete_many({})
    await db.drivers.delete_many({})
    await db.bookings.delete_many({})
    await db.platform_settings.delete_many({})
    
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
            "saved_addresses": [
                {"id": str(uuid4()), "label": "Home", "address": "1234 Rue Sherbrooke, Montreal, QC", "latitude": 45.5175, "longitude": -73.5800},
                {"id": str(uuid4()), "label": "Work", "address": "500 Place d'Armes, Montreal, QC", "latitude": 45.5045, "longitude": -73.5580},
            ],
            "created_at": (now - timedelta(days=90)).isoformat(),
            "updated_at": now.isoformat(),
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
            "saved_addresses": [],
            "created_at": (now - timedelta(days=60)).isoformat(),
            "updated_at": now.isoformat(),
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
        "created_at": (now - timedelta(days=365)).isoformat(),
        "updated_at": now.isoformat(),
        "is_active": True,
        "is_verified": True
    }
    
    await db.users.insert_one(admin)
    print("   ✅ Created admin user")
    
    # ==================== DRIVERS ====================
    print("🚗 Creating drivers...")
    
    driver_data = [
        ("Pierre", "Tremblay", "driver@demo.com", 10, "silver", True),
        ("Marie", "Gagnon", "driver2@demo.com", 350, "gold", True),
        ("Jean", "Roy", "driver3@demo.com", 1200, "platinum", True),
        ("Sophie", "Côté", "driver4@demo.com", 50, "silver", True),
        ("François", "Bouchard", "driver5@demo.com", 800, "gold", True),
        ("Isabelle", "Gauthier", "driver6@demo.com", 150, "silver", False),
        ("Michel", "Morin", "driver7@demo.com", 500, "gold", False),
        ("Nathalie", "Lavoie", "driver8@demo.com", 3500, "diamond", False),
    ]
    
    vehicles = [
        {"make": "Toyota", "model": "Camry", "year": 2022, "color": "White"},
        {"make": "Honda", "model": "Accord", "year": 2021, "color": "Black"},
        {"make": "Hyundai", "model": "Sonata", "year": 2023, "color": "Silver"},
        {"make": "Nissan", "model": "Altima", "year": 2022, "color": "Gray"},
        {"make": "Mazda", "model": "6", "year": 2021, "color": "Red"},
        {"make": "Kia", "model": "K5", "year": 2023, "color": "Blue"},
        {"make": "Chevrolet", "model": "Malibu", "year": 2022, "color": "Black"},
        {"make": "Ford", "model": "Fusion", "year": 2021, "color": "White"},
    ]
    
    drivers = []
    for i, (first, last, email, points, tier, is_online) in enumerate(driver_data):
        loc = MONTREAL_LOCATIONS[i % len(MONTREAL_LOCATIONS)]
        vehicle = vehicles[i]
        
        driver = {
            "id": str(uuid4()),
            "email": email,
            "password": pwd_context.hash("demo123"),
            "name": f"{first} {last}",
            "first_name": first,
            "last_name": last,
            "phone": f"+1-514-555-{1000 + i}",
            "role": "driver",
            "status": "online" if is_online else "offline",
            "is_available": is_online,
            "rating": round(4.5 + random.random() * 0.5, 1),
            "total_trips": random.randint(50, 500),
            "total_earnings": round(random.uniform(5000, 50000), 2),
            "points": points,
            "tier": tier,
            "vehicle": {
                "make": vehicle["make"],
                "model": vehicle["model"],
                "year": vehicle["year"],
                "color": vehicle["color"],
                "plate": f"QC {chr(65+i)}{random.randint(100, 999)} {chr(65+i)}{random.randint(10, 99)}",
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
            "verification_status": "approved",
            "created_at": (now - timedelta(days=random.randint(30, 365))).isoformat(),
            "updated_at": now.isoformat(),
            "is_active": True,
            "is_verified": True
        }
        drivers.append(driver)
    
    await db.drivers.insert_many(drivers)
    await db.drivers.create_index([("location", "2dsphere")])
    print(f"   ✅ Created {len(drivers)} drivers (5 online, 3 offline)")
    
    # ==================== BOOKINGS ====================
    print("📋 Creating bookings...")
    
    bookings = []
    for i in range(30):
        pickup = random.choice(MONTREAL_LOCATIONS)
        dropoff = random.choice([l for l in MONTREAL_LOCATIONS if l != pickup])
        user = random.choice(users)
        driver = random.choice([d for d in drivers if d["status"] == "online"])
        status = random.choice(["completed", "completed", "completed", "cancelled"])
        
        distance = round(random.uniform(2, 15), 1)
        duration = round(distance * 3 + random.uniform(5, 15), 0)
        base_fare = 5.15
        distance_charge = distance * 2.05
        time_charge = duration * 0.77
        subtotal = base_fare + distance_charge + time_charge
        total = round(subtotal * 1.14975, 2)  # With taxes
        
        booking = {
            "id": str(uuid4()),
            "user_id": user["id"],
            "user_name": user["name"],
            "driver_id": driver["id"] if status == "completed" else None,
            "driver_name": driver["name"] if status == "completed" else None,
            "type": "taxi",
            "status": status,
            "pickup": {"latitude": pickup["lat"], "longitude": pickup["lng"], "address": pickup["name"]},
            "dropoff": {"latitude": dropoff["lat"], "longitude": dropoff["lng"], "address": dropoff["name"]},
            "vehicle_type": "sedan",
            "fare": {"base_fare": base_fare, "distance_km": distance, "total": total},
            "is_scheduled": False,
            "created_at": (now - timedelta(days=random.randint(1, 60))).isoformat(),
            "updated_at": now.isoformat()
        }
        bookings.append(booking)
    
    await db.bookings.insert_many(bookings)
    print(f"   ✅ Created {len(bookings)} bookings")
    
    # ==================== PLATFORM SETTINGS ====================
    print("⚙️  Creating platform settings...")
    
    settings = {
        "id": "platform_settings",
        "commission_rate": 15.0,
        "base_fare_day": 5.15,
        "base_fare_night": 5.75,
        "per_km_day": 2.05,
        "per_km_night": 2.35,
        "government_fee": 0.90,
        "gst_rate": 5.0,
        "qst_rate": 9.975,
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
    print("🚗 DRIVER: driver@demo.com / demo123")
    print("👑 ADMIN:  admin@demo.com / demo123")
    print("-"*50)
    print("\n🚀 Ready for live testing!")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(seed_database())

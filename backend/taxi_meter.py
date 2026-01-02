"""
Quebec-Compliant Taxi Meter Logic
Implements real-time metered fare calculation based on CTQ regulations.
"""

from datetime import datetime, timezone, time
from typing import Dict, Optional, Tuple
import math

# ============== QUEBEC TAXI METER CONFIGURATION ==============
# Base fares include the $0.90 government fee as per Quebec CTQ regulations

QUEBEC_TAXI_RATES = {
    "day": {
        "hours": (5, 23),  # 05:00 - 22:59
        "base_fare": 5.15,  # Includes $0.90 gov't fee
        "per_km_rate": 2.05,
        "waiting_per_hour": 46.20,
        "waiting_per_min": 0.77,
        "speed_threshold_kmh": 22.537
    },
    "night": {
        "hours": (23, 5),  # 23:00 - 04:59
        "base_fare": 5.75,  # Includes $0.90 gov't fee
        "per_km_rate": 2.35,
        "waiting_per_hour": 53.40,
        "waiting_per_min": 0.89,
        "speed_threshold_kmh": 22.723
    },
    "government_fee": 0.90,  # Already included in base_fare
    "tip_presets": [15, 20, 25],
    "gps_sample_interval_seconds": 1,
    "min_movement_meters": 3  # Ignore GPS jitter below this
}


def get_rate_period(trip_start_time: datetime) -> str:
    """
    Determine if trip uses day or night rate based on start time.
    Rate is locked at trip start and does not change mid-trip.
    
    Day: 05:00 - 22:59
    Night: 23:00 - 04:59
    """
    hour = trip_start_time.hour
    if 5 <= hour < 23:
        return "day"
    else:
        return "night"


def get_rates(trip_start_time: datetime) -> Dict:
    """
    Get all applicable rates based on trip start time.
    """
    period = get_rate_period(trip_start_time)
    rates = QUEBEC_TAXI_RATES[period].copy()
    rates["period"] = period
    rates["government_fee"] = QUEBEC_TAXI_RATES["government_fee"]
    return rates


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate distance between two GPS coordinates in meters.
    Uses Haversine formula for accuracy.
    """
    R = 6371000  # Earth's radius in meters
    
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)
    
    a = (math.sin(delta_lat / 2) ** 2 + 
         math.cos(lat1_rad) * math.cos(lat2_rad) * 
         math.sin(delta_lon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    return R * c


def calculate_speed_kmh(distance_meters: float, time_seconds: float) -> float:
    """
    Calculate speed in km/h from distance (meters) and time (seconds).
    """
    if time_seconds <= 0:
        return 0
    # Convert m/s to km/h: multiply by 3.6
    return (distance_meters / time_seconds) * 3.6


class TaxiMeter:
    """
    Quebec-compliant taxi meter that tracks:
    - Distance traveled
    - Waiting time (when speed < threshold)
    - Real-time fare calculation
    """
    
    def __init__(self, trip_start_time: Optional[datetime] = None):
        self.trip_start_time = trip_start_time or datetime.now(timezone.utc)
        self.rates = get_rates(self.trip_start_time)
        
        # Accumulators
        self.total_distance_km = 0.0
        self.total_waiting_minutes = 0.0
        self.distance_cost = 0.0
        self.waiting_cost = 0.0
        
        # GPS tracking
        self.last_gps = None
        self.last_timestamp = None
        
        # Status
        self.is_running = False
        self.is_completed = False
        
    def start(self, initial_lat: float, initial_lng: float):
        """Start the meter with initial GPS position."""
        self.is_running = True
        self.last_gps = (initial_lat, initial_lng)
        self.last_timestamp = datetime.now(timezone.utc)
        
    def update(self, current_lat: float, current_lng: float) -> Dict:
        """
        Update meter with new GPS position.
        Returns current fare breakdown.
        """
        if not self.is_running or self.is_completed:
            return self.get_fare_breakdown()
        
        current_timestamp = datetime.now(timezone.utc)
        
        if self.last_gps is None:
            self.last_gps = (current_lat, current_lng)
            self.last_timestamp = current_timestamp
            return self.get_fare_breakdown()
        
        # Calculate distance and time since last update
        distance_meters = haversine_distance(
            self.last_gps[0], self.last_gps[1],
            current_lat, current_lng
        )
        
        time_delta = (current_timestamp - self.last_timestamp).total_seconds()
        
        if time_delta <= 0:
            return self.get_fare_breakdown()
        
        # Calculate speed
        speed_kmh = calculate_speed_kmh(distance_meters, time_delta)
        
        # Ignore GPS jitter (movements < 3 meters)
        if distance_meters < QUEBEC_TAXI_RATES["min_movement_meters"]:
            # Treat as waiting
            self.total_waiting_minutes += time_delta / 60
            self.waiting_cost = self.total_waiting_minutes * self.rates["waiting_per_min"]
        elif speed_kmh >= self.rates["speed_threshold_kmh"]:
            # Above threshold - charge distance only
            distance_km = distance_meters / 1000
            self.total_distance_km += distance_km
            self.distance_cost = self.total_distance_km * self.rates["per_km_rate"]
        else:
            # Below threshold - charge both distance AND waiting time
            distance_km = distance_meters / 1000
            self.total_distance_km += distance_km
            self.distance_cost = self.total_distance_km * self.rates["per_km_rate"]
            
            self.total_waiting_minutes += time_delta / 60
            self.waiting_cost = self.total_waiting_minutes * self.rates["waiting_per_min"]
        
        # Update last position
        self.last_gps = (current_lat, current_lng)
        self.last_timestamp = current_timestamp
        
        return self.get_fare_breakdown()
    
    def stop(self) -> Dict:
        """Stop the meter and return final fare."""
        # Add any remaining waiting time since last update
        if self.is_running and self.last_timestamp:
            current_time = datetime.now(timezone.utc)
            time_since_last_update = (current_time - self.last_timestamp).total_seconds()
            if time_since_last_update > 0:
                # Assume stationary since last update (no GPS movement)
                self.total_waiting_minutes += time_since_last_update / 60
                self.waiting_cost = self.total_waiting_minutes * self.rates["waiting_per_min"]
        
        self.is_running = False
        self.is_completed = True
        return self.get_fare_breakdown()
    
    def get_fare_breakdown(self) -> Dict:
        """
        Get current fare breakdown.
        Quebec base fare already includes the $0.90 government fee.
        Quebec taxes are INCLUDED in the fare (not added on top).
        """
        base_fare = self.rates["base_fare"]  # Already includes $0.90 gov't fee
        government_fee = self.rates["government_fee"]  # For display purposes only
        
        # Calculate real-time waiting if meter is still running
        current_waiting_minutes = self.total_waiting_minutes
        current_waiting_cost = self.waiting_cost
        
        if self.is_running and self.last_timestamp:
            current_time = datetime.now(timezone.utc)
            time_since_last_update = (current_time - self.last_timestamp).total_seconds()
            if time_since_last_update > 0:
                # Add time since last GPS update as waiting time
                current_waiting_minutes += time_since_last_update / 60
                current_waiting_cost = current_waiting_minutes * self.rates["waiting_per_min"]
        
        # Base fare already includes government fee, so no need to add it again
        subtotal = base_fare + self.distance_cost + current_waiting_cost
        total_before_tip = subtotal  # Same as subtotal since gov fee is already in base
        
        return {
            "rate_period": self.rates["period"],
            "base_fare": round(base_fare, 2),
            "distance_km": round(self.total_distance_km, 2),
            "distance_cost": round(self.distance_cost, 2),
            "waiting_minutes": round(current_waiting_minutes, 1),
            "waiting_cost": round(current_waiting_cost, 2),
            "subtotal": round(subtotal, 2),
            "government_fee": round(government_fee, 2),
            "total_before_tip": round(total_before_tip, 2),
            "rates_used": {
                "base": base_fare,
                "per_km": self.rates["per_km_rate"],
                "waiting_per_min": self.rates["waiting_per_min"],
                "speed_threshold": self.rates["speed_threshold_kmh"]
            },
            "is_running": self.is_running,
            "is_completed": self.is_completed
        }
    
    def calculate_with_tip(self, tip_percent: float = 0, custom_tip: float = 0, commission_rate: float = 25.0) -> Dict:
        """
        Calculate final fare with tip and commission breakdown.
        Commission is calculated on the fare EXCLUDING government fees and tips.
        """
        breakdown = self.get_fare_breakdown()
        
        if custom_tip > 0:
            tip_amount = custom_tip
        elif tip_percent > 0:
            # Tip on fare before government fee (driver portion)
            tip_base = breakdown["subtotal"]
            tip_amount = tip_base * (tip_percent / 100)
        else:
            tip_amount = 0
        
        breakdown["tip_percent"] = tip_percent if custom_tip == 0 else 0
        breakdown["tip_amount"] = round(tip_amount, 2)
        breakdown["total_final"] = round(breakdown["total_before_tip"] + tip_amount, 2)
        
        # Calculate commission (on subtotal, excluding gov fee and tip)
        commissionable_amount = breakdown["subtotal"]  # base + distance + waiting
        platform_commission = commissionable_amount * (commission_rate / 100)
        driver_earnings = commissionable_amount - platform_commission + tip_amount
        
        breakdown["commission"] = {
            "rate": commission_rate,
            "commissionable_amount": round(commissionable_amount, 2),
            "platform_commission": round(platform_commission, 2),
            "driver_earnings": round(driver_earnings, 2)
        }
        
        return breakdown


def calculate_fare_estimate(
    pickup_lat: float,
    pickup_lng: float,
    dropoff_lat: float,
    dropoff_lng: float,
    estimated_duration_minutes: float = None,
    trip_start_time: datetime = None
) -> Dict:
    """
    Calculate fare estimate for a trip.
    Used before trip starts to show customer estimated cost.
    """
    trip_time = trip_start_time or datetime.now(timezone.utc)
    rates = get_rates(trip_time)
    
    # Calculate distance
    distance_meters = haversine_distance(pickup_lat, pickup_lng, dropoff_lat, dropoff_lng)
    distance_km = distance_meters / 1000
    
    # Estimate duration if not provided (assume 30 km/h average city speed)
    if estimated_duration_minutes is None:
        estimated_duration_minutes = (distance_km / 30) * 60
    
    # For estimate, assume 20% of time is waiting (traffic)
    waiting_minutes = estimated_duration_minutes * 0.2
    
    base_fare = rates["base_fare"]
    distance_cost = distance_km * rates["per_km_rate"]
    waiting_cost = waiting_minutes * rates["waiting_per_min"]
    government_fee = rates["government_fee"]
    
    subtotal = base_fare + distance_cost + waiting_cost
    total = subtotal + government_fee
    
    return {
        "is_estimate": True,
        "rate_period": rates["period"],
        "base_fare": round(base_fare, 2),
        "distance_km": round(distance_km, 2),
        "distance_cost": round(distance_cost, 2),
        "estimated_waiting_minutes": round(waiting_minutes, 1),
        "waiting_cost": round(waiting_cost, 2),
        "subtotal": round(subtotal, 2),
        "government_fee": round(government_fee, 2),
        "total_estimate": round(total, 2),
        "estimate_range": {
            "low": round(total * 0.85, 2),
            "high": round(total * 1.25, 2)
        },
        "rates": {
            "base": base_fare,
            "per_km": rates["per_km_rate"],
            "waiting_per_min": rates["waiting_per_min"]
        },
        "disclaimer": "Final fare may vary based on actual route and traffic conditions. Quebec taxes included."
    }


# ============== ADMIN CONFIGURABLE RATES ==============

async def get_admin_rates(db) -> Dict:
    """
    Get admin-configured rates from database.
    Falls back to Quebec defaults if not configured.
    """
    config = await db.taxi_config.find_one({"type": "quebec_rates"})
    
    if config:
        return {
            "day": {
                "base_fare": config.get("day_base_fare", 4.10),
                "per_km_rate": config.get("day_per_km", 2.05),
                "waiting_per_min": config.get("day_waiting_per_min", 0.77),
                "speed_threshold_kmh": config.get("day_speed_threshold", 22.537)
            },
            "night": {
                "base_fare": config.get("night_base_fare", 4.70),
                "per_km_rate": config.get("night_per_km", 2.35),
                "waiting_per_min": config.get("night_waiting_per_min", 0.89),
                "speed_threshold_kmh": config.get("night_speed_threshold", 22.723)
            },
            "government_fee": config.get("government_fee", 0.90),
            "tip_presets": config.get("tip_presets", [15, 20, 25])
        }
    
    return QUEBEC_TAXI_RATES


async def update_admin_rates(db, rates: Dict) -> bool:
    """
    Update admin-configured rates in database.
    """
    await db.taxi_config.update_one(
        {"type": "quebec_rates"},
        {"$set": {
            "type": "quebec_rates",
            **rates,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    return True

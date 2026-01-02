"""
Taxi Configuration Models
Versioned taxi meter configurations for Quebec compliance
"""

from typing import Dict, Optional, List
from pydantic import BaseModel
from datetime import datetime
from enum import Enum


class ConfigStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    SCHEDULED = "scheduled"
    ARCHIVED = "archived"
    LOCKED = "locked"  # Immutable - legal hold


class TaxiConfigCreate(BaseModel):
    """Create a new taxi configuration version."""
    name: str
    description: Optional[str] = None
    
    # Day rates (05:00 - 23:00)
    day_base_fare: float = 4.10
    day_per_km_rate: float = 2.05
    day_waiting_per_min: float = 0.77
    
    # Night rates (23:00 - 05:00)
    night_base_fare: float = 4.70
    night_per_km_rate: float = 2.35
    night_waiting_per_min: float = 0.89
    
    # Speed threshold (km/h) - below this, waiting charges apply
    speed_threshold_kmh: float = 20.0
    
    # Government fee (Quebec CTQ)
    government_fee: float = 0.90
    
    # Tax settings
    taxes_included: bool = True
    gst_rate: float = 5.0
    qst_rate: float = 9.975
    
    # Effective date (for scheduling)
    effective_date: Optional[str] = None
    
    # Regional assignment
    region: str = "quebec"  # quebec, montreal, etc.


class TaxiConfigUpdate(BaseModel):
    """Update an existing taxi configuration."""
    name: Optional[str] = None
    description: Optional[str] = None
    day_base_fare: Optional[float] = None
    day_per_km_rate: Optional[float] = None
    day_waiting_per_min: Optional[float] = None
    night_base_fare: Optional[float] = None
    night_per_km_rate: Optional[float] = None
    night_waiting_per_min: Optional[float] = None
    speed_threshold_kmh: Optional[float] = None
    government_fee: Optional[float] = None
    taxes_included: Optional[bool] = None
    gst_rate: Optional[float] = None
    qst_rate: Optional[float] = None
    effective_date: Optional[str] = None
    status: Optional[str] = None


class TaxiConfigResponse(BaseModel):
    """Taxi configuration response model."""
    id: str
    version: str
    name: str
    description: Optional[str]
    status: str
    
    # Rates
    day_rates: Dict
    night_rates: Dict
    speed_threshold_kmh: float
    government_fee: float
    
    # Tax
    taxes_included: bool
    gst_rate: float
    qst_rate: float
    
    # Metadata
    region: str
    effective_date: Optional[str]
    created_at: str
    created_by: str
    activated_at: Optional[str]
    locked_at: Optional[str]
    locked_reason: Optional[str]


# Default Quebec taxi rates (base fare includes $0.90 government fee)
DEFAULT_QUEBEC_CONFIG = {
    "name": "Quebec Standard Rates",
    "description": "CTQ-compliant taxi rates for Quebec province",
    "day_base_fare": 5.15,  # $4.25 base + $0.90 government fee
    "day_per_km_rate": 2.05,
    "day_waiting_per_min": 0.77,
    "night_base_fare": 5.75,  # $4.85 base + $0.90 government fee
    "night_per_km_rate": 2.35,
    "night_waiting_per_min": 0.89,
    "speed_threshold_kmh": 20.0,
    "government_fee": 0.90,  # Quebec CTQ fee (included in base_fare)
    "taxes_included": True,
    "gst_rate": 5.0,
    "qst_rate": 9.975,
    "region": "quebec"
}

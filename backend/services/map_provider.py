"""
Map Provider Service - Abstract interface for map/routing functionality.
Supports easy switching between mock data and real providers (Google Maps, etc.)
"""

from abc import ABC, abstractmethod
from typing import Dict, List, Tuple, Optional
import math
from dataclasses import dataclass


@dataclass
class Route:
    distance_km: float
    duration_minutes: float
    polyline: Optional[str] = None
    steps: Optional[List[Dict]] = None


@dataclass
class Address:
    formatted: str
    lat: float
    lng: float
    street: Optional[str] = None
    city: Optional[str] = None
    province: Optional[str] = None
    postal_code: Optional[str] = None
    country: str = "Canada"


class MapProvider(ABC):
    """Abstract base class for map providers."""
    
    # Road factor - multiply straight-line distance by this for realistic road distance
    ROAD_FACTOR = 1.4
    
    @abstractmethod
    def get_route(self, origin: Tuple[float, float], destination: Tuple[float, float]) -> Route:
        """Get route between two points."""
        pass
    
    @abstractmethod
    def calculate_distance(self, origin: Tuple[float, float], destination: Tuple[float, float]) -> float:
        """Calculate distance in km between two points."""
        pass
    
    @abstractmethod
    def estimate_duration(self, origin: Tuple[float, float], destination: Tuple[float, float]) -> float:
        """Estimate travel duration in minutes."""
        pass
    
    @abstractmethod
    def reverse_geocode(self, lat: float, lng: float) -> Address:
        """Convert coordinates to address."""
        pass
    
    @abstractmethod
    def geocode(self, address: str) -> Optional[Address]:
        """Convert address string to coordinates."""
        pass
    
    @staticmethod
    def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """
        Calculate straight-line distance between two GPS coordinates in km.
        Uses Haversine formula.
        """
        R = 6371  # Earth's radius in km
        
        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        delta_lat = math.radians(lat2 - lat1)
        delta_lon = math.radians(lon2 - lon1)
        
        a = (math.sin(delta_lat / 2) ** 2 + 
             math.cos(lat1_rad) * math.cos(lat2_rad) * 
             math.sin(delta_lon / 2) ** 2)
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        
        return R * c


class MockMapProvider(MapProvider):
    """
    Mock map provider using Montreal addresses.
    Uses haversine distance × 1.4 for road-based estimates.
    """
    
    # Average city driving speed in km/h
    AVG_CITY_SPEED = 25
    
    # Montreal area mock addresses
    MOCK_ADDRESSES = {
        (45.4987, -73.5671): Address(
            formatted="1000 Rue De La Gauchetière O, Montréal, QC H3B 4W5",
            lat=45.4987, lng=-73.5671,
            street="1000 Rue De La Gauchetière O",
            city="Montréal", province="QC", postal_code="H3B 4W5"
        ),
        (45.5045, -73.5542): Address(
            formatted="300 Rue Saint-Paul O, Montréal, QC H2Y 2A3",
            lat=45.5045, lng=-73.5542,
            street="300 Rue Saint-Paul O",
            city="Montréal", province="QC", postal_code="H2Y 2A3"
        ),
        (45.5048, -73.5619): Address(
            formatted="1001 Place Jean-Paul-Riopelle, Montréal, QC H2Z 1H5",
            lat=45.5048, lng=-73.5619,
            street="1001 Place Jean-Paul-Riopelle",
            city="Montréal", province="QC", postal_code="H2Z 1H5"
        ),
        (45.5017, -73.5673): Address(
            formatted="Downtown Montreal, QC",
            lat=45.5017, lng=-73.5673,
            city="Montréal", province="QC"
        ),
    }
    
    def get_route(self, origin: Tuple[float, float], destination: Tuple[float, float]) -> Route:
        """Get route with road-based distance estimate."""
        straight_line = self.haversine_distance(origin[0], origin[1], destination[0], destination[1])
        road_distance = straight_line * self.ROAD_FACTOR
        duration = (road_distance / self.AVG_CITY_SPEED) * 60  # minutes
        
        return Route(
            distance_km=round(road_distance, 2),
            duration_minutes=round(duration, 1),
            polyline=None,  # No polyline in mock
            steps=None
        )
    
    def calculate_distance(self, origin: Tuple[float, float], destination: Tuple[float, float]) -> float:
        """Calculate road-based distance in km."""
        straight_line = self.haversine_distance(origin[0], origin[1], destination[0], destination[1])
        return round(straight_line * self.ROAD_FACTOR, 2)
    
    def estimate_duration(self, origin: Tuple[float, float], destination: Tuple[float, float]) -> float:
        """Estimate travel duration in minutes."""
        distance = self.calculate_distance(origin, destination)
        return round((distance / self.AVG_CITY_SPEED) * 60, 1)
    
    def reverse_geocode(self, lat: float, lng: float) -> Address:
        """Convert coordinates to nearest known address."""
        # Find nearest mock address
        nearest = None
        min_dist = float('inf')
        
        for (addr_lat, addr_lng), addr in self.MOCK_ADDRESSES.items():
            dist = self.haversine_distance(lat, lng, addr_lat, addr_lng)
            if dist < min_dist:
                min_dist = dist
                nearest = addr
        
        if nearest and min_dist < 5:  # Within 5km
            return nearest
        
        # Return generic address for unknown location
        return Address(
            formatted=f"{lat:.4f}, {lng:.4f}, Montréal, QC",
            lat=lat, lng=lng,
            city="Montréal", province="QC", country="Canada"
        )
    
    def geocode(self, address: str) -> Optional[Address]:
        """Find coordinates for address string."""
        address_lower = address.lower()
        
        for coords, addr in self.MOCK_ADDRESSES.items():
            if address_lower in addr.formatted.lower():
                return addr
        
        # Return downtown Montreal as default
        return self.MOCK_ADDRESSES.get((45.5017, -73.5673))


class GoogleMapProvider(MapProvider):
    """
    Google Maps provider - for future integration.
    Requires GOOGLE_MAPS_API_KEY environment variable.
    """
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        # Initialize Google Maps client here when implemented
    
    def get_route(self, origin: Tuple[float, float], destination: Tuple[float, float]) -> Route:
        # TODO: Implement Google Directions API call
        raise NotImplementedError("Google Maps integration pending API key")
    
    def calculate_distance(self, origin: Tuple[float, float], destination: Tuple[float, float]) -> float:
        # TODO: Implement Google Distance Matrix API call
        raise NotImplementedError("Google Maps integration pending API key")
    
    def estimate_duration(self, origin: Tuple[float, float], destination: Tuple[float, float]) -> float:
        # TODO: Implement Google Distance Matrix API call
        raise NotImplementedError("Google Maps integration pending API key")
    
    def reverse_geocode(self, lat: float, lng: float) -> Address:
        # TODO: Implement Google Geocoding API call
        raise NotImplementedError("Google Maps integration pending API key")
    
    def geocode(self, address: str) -> Optional[Address]:
        # TODO: Implement Google Geocoding API call
        raise NotImplementedError("Google Maps integration pending API key")


# Singleton instance
_map_provider: Optional[MapProvider] = None


def get_map_provider() -> MapProvider:
    """Get the active map provider instance."""
    global _map_provider
    
    if _map_provider is None:
        # Check for Google Maps API key
        import os
        google_api_key = os.environ.get('GOOGLE_MAPS_API_KEY')
        
        if google_api_key:
            _map_provider = GoogleMapProvider(google_api_key)
        else:
            _map_provider = MockMapProvider()
    
    return _map_provider

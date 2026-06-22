"""Geometry primitives + the geo-math the attribution engine relies on."""
from __future__ import annotations

import math

from pydantic import BaseModel

EARTH_RADIUS_KM = 6371.0088


class LatLon(BaseModel):
    lat: float
    lon: float


class BBox(BaseModel):
    min_lat: float
    min_lon: float
    max_lat: float
    max_lon: float

    def contains(self, p: LatLon) -> bool:
        return (
            self.min_lat <= p.lat <= self.max_lat
            and self.min_lon <= p.lon <= self.max_lon
        )

    @property
    def center(self) -> LatLon:
        return LatLon(lat=(self.min_lat + self.max_lat) / 2, lon=(self.min_lon + self.max_lon) / 2)


def haversine_km(a: LatLon, b: LatLon) -> float:
    """Great-circle distance between two points, in km."""
    dlat = math.radians(b.lat - a.lat)
    dlon = math.radians(b.lon - a.lon)
    lat1, lat2 = math.radians(a.lat), math.radians(b.lat)
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 2 * EARTH_RADIUS_KM * math.asin(min(1.0, math.sqrt(h)))


def bearing_deg(a: LatLon, b: LatLon) -> float:
    """Initial compass bearing FROM a TO b, degrees in [0, 360) (0 = North, clockwise)."""
    lat1, lat2 = math.radians(a.lat), math.radians(b.lat)
    dlon = math.radians(b.lon - a.lon)
    x = math.sin(dlon) * math.cos(lat2)
    y = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(dlon)
    return (math.degrees(math.atan2(x, y)) + 360.0) % 360.0


def angular_diff(a: float, b: float) -> float:
    """Smallest absolute difference between two compass bearings, in [0, 180]."""
    d = abs((a - b) % 360.0)
    return min(d, 360.0 - d)

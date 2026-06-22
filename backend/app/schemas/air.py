"""Air-quality, weather and fire data models (raw observations + derived AQI)."""
from __future__ import annotations

from datetime import datetime
from enum import Enum

from pydantic import BaseModel


class Pollutant(str, Enum):
    pm25 = "pm2_5"
    pm10 = "pm10"
    no2 = "nitrogen_dioxide"
    so2 = "sulphur_dioxide"
    o3 = "ozone"
    co = "carbon_monoxide"


class Reading(BaseModel):
    """A single timestamped multi-pollutant observation (µg/m³; CO in µg/m³ too)."""
    ts: datetime
    pm25: float | None = None
    pm10: float | None = None
    no2: float | None = None
    so2: float | None = None
    o3: float | None = None
    co: float | None = None


class WeatherPoint(BaseModel):
    ts: datetime
    temp_c: float | None = None
    humidity: float | None = None          # %
    wind_speed: float | None = None        # m/s
    wind_dir: float | None = None          # degrees, meteorological (direction wind blows FROM)
    precip: float | None = None            # mm
    blh: float | None = None               # boundary-layer height, m (dispersion proxy)


class FirePoint(BaseModel):
    lat: float
    lon: float
    ts: datetime
    brightness: float | None = None
    confidence: float | None = None        # 0..100
    frp: float | None = None               # fire radiative power (MW)
    source: str = "FIRMS"


class AQIResult(BaseModel):
    aqi: int
    category: str
    dominant: str | None = None            # pollutant driving the index
    color: str

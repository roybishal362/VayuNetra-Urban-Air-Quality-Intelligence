"""The data bundle every downstream subsystem (ML, attribution, API) reads from."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel

from app.schemas.air import FirePoint, Reading, WeatherPoint
from app.schemas.geo import LatLon


class LandUse(BaseModel):
    """OSM-derived emission proxies used for hyperlocal downscaling."""
    industrial: list[LatLon] = []
    roads: list[LatLon] = []


class ZoneSeries(BaseModel):
    zone_id: str
    readings: list[Reading]
    weather: list[WeatherPoint]


class CityObservations(BaseModel):
    city_id: str
    generated_at: datetime
    now_ts: datetime               # boundary between observed history and forecast horizon
    forecast_hours: int            # number of trailing hours that are forecast, not observed
    source: str                    # "live" | "cache" | "snapshot"
    zones: list[ZoneSeries]
    fires: list[FirePoint]
    landuse: LandUse | None = None

    def zone(self, zone_id: str) -> ZoneSeries | None:
        return next((z for z in self.zones if z.zone_id == zone_id), None)

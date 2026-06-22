"""City + monitoring-zone definitions."""
from __future__ import annotations

from pydantic import BaseModel

from app.schemas.geo import BBox, LatLon


class Zone(BaseModel):
    """A named locality / station catchment used for drill-down + attribution."""
    id: str
    name: str
    center: LatLon
    population: int | None = None          # approx residents in catchment
    vulnerable_sites: int | None = None    # schools + hospitals (exposure weighting)


class City(BaseModel):
    id: str
    name: str
    state: str
    timezone: str
    center: LatLon
    bbox: BBox
    grid_step_km: float = 2.0              # heatmap resolution
    languages: list[str] = ["en", "hi"]    # citizen-advisory languages
    zones: list[Zone] = []

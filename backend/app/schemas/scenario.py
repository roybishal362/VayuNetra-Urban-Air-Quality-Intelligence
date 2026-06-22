"""History + what-if-simulation result models."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class HistoryPoint(BaseModel):
    ts: datetime
    pm25: float
    aqi: int
    category: str
    color: str


class ZoneHistory(BaseModel):
    zone_id: str
    now_ts: datetime
    points: list[HistoryPoint]


class SimulationResult(BaseModel):
    zone_id: str
    zone_name: str
    source: str
    source_label: str
    reduction: float                  # 0..1 fraction removed from that source
    original_pm25: float
    new_pm25: float
    original_aqi: int
    new_aqi: int
    delta_aqi: int
    new_category: str
    new_color: str

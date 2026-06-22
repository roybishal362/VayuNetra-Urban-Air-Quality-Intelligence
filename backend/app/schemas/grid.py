"""Heatmap grid models."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class GridCell(BaseModel):
    lat: float
    lon: float
    aqi: int
    category: str
    color: str


class GridResponse(BaseModel):
    city_id: str
    layer: str           # "current" | "forecast"
    horizon_h: int
    step_km: float
    now_ts: datetime
    cells: list[GridCell]

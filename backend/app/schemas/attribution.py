"""Source-attribution result models."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class SourceContribution(BaseModel):
    source: str            # vehicular | industrial | biomass_burning | dust_construction | secondary
    label: str
    pct: float             # 0..100
    concentration: float   # µg/m³ contribution to PM2.5
    confidence: float      # 0..1
    color: str


class Evidence(BaseModel):
    signal: str            # e.g. "NO₂", "Upwind fires", "PM10:PM2.5"
    detail: str
    points_to: str         # source key this evidence supports


class ZoneAttribution(BaseModel):
    zone_id: str
    zone_name: str
    ts: datetime
    pm25: float
    aqi: int
    category: str
    dominant_source: str
    dominant_label: str
    overall_confidence: float
    contributions: list[SourceContribution]
    evidence: list[Evidence]
    fires_upwind: int
    fires_modeled: bool = False   # True when fire signal came from the seasonal model, not live FIRMS

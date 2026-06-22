"""Higher-level intelligence products: advisories, enforcement priorities, city bundle."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel

from app.schemas.attribution import ZoneAttribution
from app.schemas.forecast import ForecastMetrics, ZoneForecast
from app.schemas.observations import LandUse


class AdvisoryItem(BaseModel):
    zone_id: str
    zone_name: str
    horizon_h: int
    peak_aqi: int
    category: str
    color: str
    risk_level: str                  # Low | Moderate | High | Severe
    headline: str
    guidance: list[str]
    vulnerable_note: str
    languages: dict[str, str]        # lang_code -> advisory text
    generated_by: str                # "llm" | "template"


class EnforcementItem(BaseModel):
    rank: int
    zone_id: str
    zone_name: str
    priority: float                  # 0..100
    dominant_source: str
    dominant_label: str
    current_aqi: int
    forecast_aqi_24h: int
    trend: str                       # rising | steady | falling
    population_exposed: int
    vulnerable_sites: int
    recommended_action: str
    evidence: list[str]
    confidence: float


class CityHealth(BaseModel):
    total_population: int
    exposed_population: int           # AQI > 200 (Poor or worse)
    severe_population: int            # AQI > 400 (Severe)
    vulnerable_sites_affected: int
    avg_aqi: int
    worst_category: str
    note: str


class Alert(BaseModel):
    zone_id: str
    zone_name: str
    level: str                        # watch | warning | severe
    aqi: int
    horizon_h: int
    message: str


class CityIntelligence(BaseModel):
    city_id: str
    city_name: str
    generated_at: datetime
    now_ts: datetime
    data_source: str                 # live | cache | snapshot
    summary: str
    forecasts: list[ZoneForecast]
    attributions: list[ZoneAttribution]
    enforcement: list[EnforcementItem]
    advisories: list[AdvisoryItem]
    metrics: ForecastMetrics | None = None
    landuse: LandUse | None = None
    health: CityHealth | None = None
    alerts: list[Alert] = []


class CityComparison(BaseModel):
    city_id: str
    city_name: str
    avg_aqi: int
    worst_zone: str
    worst_aqi: int
    exposed: int
    alerts: int
    improvement_pct: float
    category: str

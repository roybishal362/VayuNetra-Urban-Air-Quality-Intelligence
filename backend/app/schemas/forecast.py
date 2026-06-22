"""Forecast + evaluation result models.

Note: field names avoid the reserved `model_` prefix (pydantic v2) — we use `rmse`/`mae`
for the model and `persistence_*` for the baseline.
"""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class ForecastPoint(BaseModel):
    ts: datetime
    horizon_h: int
    pm25: float
    pm25_low: float | None = None
    pm25_high: float | None = None
    aqi: int
    category: str
    color: str


class ZoneForecast(BaseModel):
    zone_id: str
    issued_at: datetime
    points: list[ForecastPoint]


class HorizonMetric(BaseModel):
    horizon_h: int
    rmse: float
    mae: float
    persistence_rmse: float
    persistence_mae: float
    improvement_pct: float          # RMSE improvement of model over persistence baseline
    r2: float = 0.0
    bias: float = 0.0               # mean(pred - actual)


class BacktestPoint(BaseModel):
    ts: datetime
    actual: float
    predicted: float


class ScatterPoint(BaseModel):
    actual: float
    predicted: float


class ForecastMetrics(BaseModel):
    city_id: str
    target: str = "pm25"
    trained_at: datetime
    n_train: int
    n_test: int
    blend_weight: float = 1.0       # model weight in model⊕persistence blend (1=pure model)
    coverage: float = 0.0           # fraction of actuals inside the p10–p90 band
    horizons: list[HorizonMetric]
    feature_importance: dict[str, float] = {}
    backtest: list[BacktestPoint] = []     # representative zone @ +24h: actual vs predicted
    scatter: list[ScatterPoint] = []       # held-out actual vs predicted sample

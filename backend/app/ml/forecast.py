"""PM2.5 forecasting model: pooled HistGradientBoosting (median + p10/p90 bands),
temporal hold-out evaluation against the diurnal-persistence baseline.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.inspection import permutation_importance
from sklearn.metrics import mean_absolute_error, root_mean_squared_error

from app.core.config import ARTIFACT_DIR
from app.core.logging import get_logger
from app.domain.aqi import compute_aqi
from app.ml.features import (
    EVAL_HORIZONS,
    build_inference_rows,
    build_training_table,
    feature_columns,
)
from app.schemas.air import Reading
from app.schemas.city import City
from app.schemas.forecast import ForecastMetrics, ForecastPoint, HorizonMetric, ZoneForecast
from app.schemas.observations import CityObservations

log = get_logger("vayunetra.forecast")


def _artifact_path(city_id: str):
    return ARTIFACT_DIR / f"forecast_{city_id}.joblib"


@dataclass
class ForecastModel:
    city_id: str
    median: HistGradientBoostingRegressor
    lower: HistGradientBoostingRegressor
    upper: HistGradientBoostingRegressor
    feature_cols: list[str]
    metrics: ForecastMetrics

    # ---- training -------------------------------------------------------
    @classmethod
    def train(cls, obs: CityObservations, city: City, test_days: int = 7) -> "ForecastModel":
        table = build_training_table(obs, city)
        feats = feature_columns(table)
        issue = pd.to_datetime(table["issue_ts"])
        cutoff = pd.to_datetime(obs.now_ts) - pd.Timedelta(days=test_days)
        tr, te = issue < cutoff, issue >= cutoff

        x_tr, y_tr = table.loc[tr, feats], table.loc[tr, "y"]
        log.info("[%s] train rows=%d test rows=%d feats=%d", city.id, tr.sum(), te.sum(), len(feats))

        common = dict(max_iter=400, learning_rate=0.06, l2_regularization=1.0,
                      early_stopping=True, random_state=0)
        median = HistGradientBoostingRegressor(loss="squared_error", **common).fit(x_tr, y_tr)
        lower = HistGradientBoostingRegressor(loss="quantile", quantile=0.1, **common).fit(x_tr, y_tr)
        upper = HistGradientBoostingRegressor(loss="quantile", quantile=0.9, **common).fit(x_tr, y_tr)

        test = table.loc[te].copy()
        test["pred"] = median.predict(test[feats])

        horizon_metrics: list[HorizonMetric] = []
        for h in EVAL_HORIZONS:
            sub = test[test["horizon_h"] == h].dropna(subset=["y", "pred", "persist_diurnal"])
            if len(sub) < 5:
                continue
            rmse = float(root_mean_squared_error(sub["y"], sub["pred"]))
            mae = float(mean_absolute_error(sub["y"], sub["pred"]))
            p_rmse = float(root_mean_squared_error(sub["y"], sub["persist_diurnal"]))
            p_mae = float(mean_absolute_error(sub["y"], sub["persist_diurnal"]))
            imp = (p_rmse - rmse) / p_rmse * 100 if p_rmse > 0 else 0.0
            horizon_metrics.append(HorizonMetric(
                horizon_h=h, rmse=round(rmse, 2), mae=round(mae, 2),
                persistence_rmse=round(p_rmse, 2), persistence_mae=round(p_mae, 2),
                improvement_pct=round(imp, 1),
            ))

        importance = cls._importance(median, test, feats)
        metrics = ForecastMetrics(
            city_id=city.id, trained_at=datetime.now(),
            n_train=int(tr.sum()), n_test=int(te.sum()),
            horizons=horizon_metrics, feature_importance=importance,
        )
        return cls(city.id, median, lower, upper, feats, metrics)

    @staticmethod
    def _importance(model, test: pd.DataFrame, feats: list[str]) -> dict[str, float]:
        sample = test.dropna(subset=["y"]).sample(min(1500, len(test)), random_state=0)
        if len(sample) < 50:
            return {}
        try:
            r = permutation_importance(model, sample[feats], sample["y"],
                                       n_repeats=3, random_state=0, n_jobs=1)
            pairs = sorted(zip(feats, r.importances_mean), key=lambda kv: kv[1], reverse=True)
            top = {k: round(float(v), 3) for k, v in pairs[:12] if v > 0}
            return top
        except Exception as exc:  # importance is a nice-to-have, never fatal
            log.warning("permutation importance failed: %s", exc)
            return {}

    # ---- inference ------------------------------------------------------
    def predict_zone(self, obs: CityObservations, city: City, zone_id: str,
                     future_hours: int = 72) -> ZoneForecast:
        issue = obs.now_ts
        horizons = list(range(1, future_hours + 1))
        rows = build_inference_rows(obs, city, zone_id, issue, horizons)
        if rows.empty:
            return ZoneForecast(zone_id=zone_id, issued_at=issue, points=[])

        x = rows[self.feature_cols]
        med = np.clip(self.median.predict(x), 0, None)
        lo = np.clip(self.lower.predict(x), 0, None)
        hi = np.clip(self.upper.predict(x), 0, None)

        points: list[ForecastPoint] = []
        for i, (_, r) in enumerate(rows.iterrows()):
            pm = float(med[i])
            low = min(float(lo[i]), pm)
            high = max(float(hi[i]), pm)
            aqi = compute_aqi(Reading(ts=r["target_ts"], pm25=pm))
            points.append(ForecastPoint(
                ts=r["target_ts"], horizon_h=int(r["horizon_h"]),
                pm25=round(pm, 1), pm25_low=round(low, 1), pm25_high=round(high, 1),
                aqi=aqi.aqi, category=aqi.category, color=aqi.color,
            ))
        return ZoneForecast(zone_id=zone_id, issued_at=issue, points=points)

    # ---- persistence ----------------------------------------------------
    def save(self) -> None:
        joblib.dump(
            {"city_id": self.city_id, "median": self.median, "lower": self.lower,
             "upper": self.upper, "feature_cols": self.feature_cols,
             "metrics": self.metrics.model_dump(mode="json")},
            _artifact_path(self.city_id),
        )
        log.info("[%s] forecast model saved", self.city_id)

    @classmethod
    def load(cls, city_id: str) -> "ForecastModel | None":
        path = _artifact_path(city_id)
        if not path.exists():
            return None
        try:
            d = joblib.load(path)
            return cls(d["city_id"], d["median"], d["lower"], d["upper"],
                       d["feature_cols"], ForecastMetrics(**d["metrics"]))
        except Exception as exc:
            log.warning("failed to load forecast model %s: %s", city_id, exc)
            return None

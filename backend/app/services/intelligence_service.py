"""Orchestrator: runs the forecast, attribution, enforcement and advisory agents and
assembles a cached CityIntelligence bundle. This is the multi-agent core of VayuNetra.
"""
from __future__ import annotations

import threading
import time
from datetime import datetime

from app.agents.advisory import build_advisory
from app.agents.enforcement import build_enforcement
from app.core.logging import get_logger
from app.data.repository import get_city_observations
from app.domain.cities import get_city, list_cities
from app.ml.attribution import attribute_city
from app.ml.forecast import ForecastModel
from app.schemas.city import City
from app.schemas.forecast import ForecastMetrics
from app.schemas.intelligence import CityComparison, CityIntelligence
from app.schemas.observations import CityObservations
from app.services.alerts import compute_alerts
from app.services.downscale import factor_at, scale_forecast
from app.services.health import compute_health

log = get_logger("vayunetra.intel")

BUNDLE_HORIZONS = [6, 12, 24, 48, 72]
ADVISORY_TOP = 6

# Serve a cached bundle for up to TTL, then refresh it from live data in the background
# (stale-while-revalidate): requests stay instant, the data keeps moving with reality.
_TTL_SECONDS = 600
_MEM: dict[str, tuple[CityIntelligence, float]] = {}   # city_id -> (intel, built_at_epoch)
_REFRESHING: set[str] = set()
_LOCK = threading.RLock()


def _model_for(city_id: str, obs: CityObservations, city: City) -> ForecastModel:
    model = ForecastModel.load(city_id)
    if model is None:
        log.info("no saved model for %s; training from snapshot (one-off)", city_id)
        model = ForecastModel.train(obs, city)
        model.save()
    return model


def get_model(city_id: str, mode: str = "snapshot") -> ForecastModel:
    """Load (or lazily train) the forecast model for a city — used by the on-demand endpoints."""
    city = get_city(city_id)
    if city is None:
        raise KeyError(city_id)
    model = ForecastModel.load(city_id)
    if model is None:
        model = _model_for(city_id, get_city_observations(city_id, mode=mode), city)
    return model


def _summary(city: City, attributions, enforcement, metrics: ForecastMetrics | None) -> str:
    if not attributions:
        return f"No data available for {city.name}."
    worst = max(attributions, key=lambda a: a.aqi)
    avg = sum(a.aqi for a in attributions) / len(attributions)
    lead = enforcement[0].dominant_label if enforcement else worst.dominant_label
    txt = (f"{city.name}: city-average AQI {avg:.0f}; worst is {worst.zone_name} at {worst.aqi} "
           f"({worst.category}). Lead source for enforcement: {lead}.")
    if metrics and metrics.horizons:
        h = metrics.horizons[0]
        txt += f" Forecast beats the persistence baseline by {h.improvement_pct:.0f}% at +{h.horizon_h}h."
    return txt


def build_city_intelligence(city_id: str, mode: str = "auto") -> CityIntelligence:
    city = get_city(city_id)
    if city is None:
        raise KeyError(city_id)

    obs = get_city_observations(city_id, mode=mode)
    model = _model_for(city_id, obs, city)

    forecasts = []
    for z in city.zones:
        raw = model.predict_zone(obs, city, z.id, horizons=BUNDLE_HORIZONS)
        factor = factor_at(city, obs.landuse, z.center.lat, z.center.lon)
        forecasts.append(scale_forecast(raw, factor))
    fmap = {f.zone_id: f for f in forecasts}
    attributions = attribute_city(obs, city)
    enforcement = build_enforcement(city, attributions, fmap)
    health = compute_health(city, attributions)
    alerts = compute_alerts(city, attributions, forecasts)

    amap = {a.zone_id: a for a in attributions}
    zmap = {z.id: z for z in city.zones}
    worst_ids = [a.zone_id for a in sorted(attributions, key=lambda a: a.aqi, reverse=True)[:ADVISORY_TOP]]
    advisories = [
        build_advisory(zmap[zid], fmap[zid], amap.get(zid), city.languages)
        for zid in worst_ids if zid in fmap and zid in zmap
    ]

    intel = CityIntelligence(
        city_id=city.id, city_name=city.name, generated_at=datetime.now(),
        now_ts=obs.now_ts, data_source=obs.source,
        summary=_summary(city, attributions, enforcement, model.metrics),
        forecasts=forecasts, attributions=attributions,
        enforcement=enforcement, advisories=advisories, metrics=model.metrics,
        landuse=obs.landuse, health=health, alerts=alerts,
    )
    log.info("[%s] intelligence built (%d zones, src=%s)", city_id, len(attributions), obs.source)
    return intel


def _kick_background_refresh(city_id: str, mode: str) -> None:
    """Rebuild a city's bundle from live data in a daemon thread (de-duplicated)."""
    with _LOCK:
        if city_id in _REFRESHING:
            return
        _REFRESHING.add(city_id)

    def _work() -> None:
        try:
            intel = build_city_intelligence(city_id, mode)
            with _LOCK:
                _MEM[city_id] = (intel, time.time())
            log.info("[%s] intelligence refreshed in background (src=%s, ts=%s)",
                     city_id, intel.data_source, intel.now_ts)
        except Exception as exc:
            log.warning("[%s] background refresh failed: %s", city_id, exc)
        finally:
            with _LOCK:
                _REFRESHING.discard(city_id)

    threading.Thread(target=_work, daemon=True, name=f"refresh-{city_id}").start()


def get_city_intelligence(city_id: str, mode: str = "auto", refresh: bool = False) -> CityIntelligence:
    now = time.time()
    with _LOCK:
        entry = _MEM.get(city_id)
    if entry is not None and not refresh:
        intel, built_at = entry
        if now - built_at < _TTL_SECONDS:
            return intel                      # fresh → serve immediately
        _kick_background_refresh(city_id, mode)  # stale → serve now, refresh behind the scenes
        return intel
    intel = build_city_intelligence(city_id, mode)  # cold or forced refresh (outside lock)
    with _LOCK:
        _MEM[city_id] = (intel, time.time())
    return intel


def warm_cache(mode: str = "auto") -> None:
    for c in list_cities():
        try:
            get_city_intelligence(c.id, mode=mode)
        except Exception as exc:
            log.warning("warm_cache failed for %s: %s", c.id, exc)


def compare_cities() -> list[CityComparison]:
    """Compact per-city KPIs for the national comparison view (uses cached intelligence)."""
    out: list[CityComparison] = []
    for c in list_cities():
        try:
            intel = get_city_intelligence(c.id)
            h = intel.health
            worst = max(intel.attributions, key=lambda a: a.aqi) if intel.attributions else None
            skill = intel.metrics.horizons[0].improvement_pct if (intel.metrics and intel.metrics.horizons) else 0.0
            out.append(CityComparison(
                city_id=c.id, city_name=c.name,
                avg_aqi=h.avg_aqi if h else 0, worst_zone=worst.zone_name if worst else "-",
                worst_aqi=worst.aqi if worst else 0, exposed=h.exposed_population if h else 0,
                alerts=len(intel.alerts), improvement_pct=skill,
                category=h.worst_category if h else "-",
            ))
        except Exception as exc:
            log.warning("compare failed for %s: %s", c.id, exc)
    out.sort(key=lambda x: x.avg_aqi, reverse=True)
    return out

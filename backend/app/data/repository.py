"""Single data access point. Orchestrates live → cache → snapshot so callers never see
a dead end, and provides build_snapshot() for creating the committed offline datasets.
"""
from __future__ import annotations

from datetime import datetime

from app.core.config import settings
from app.core.logging import get_logger
from app.data import snapshot
from app.data.sources import firms
from app.data.sources.openmeteo import fetch_air_quality, fetch_weather
from app.data.sources.osm import fetch_landuse
from app.domain.cities import get_city
from app.schemas.city import City
from app.schemas.observations import CityObservations, ZoneSeries

log = get_logger("vayunetra.repo")

DEFAULT_PAST_DAYS = 60
DEFAULT_FORECAST_DAYS = 5
CACHE_TTL_SECONDS = 3600


class CityNotFound(KeyError):
    pass


def _gather_fires(city: City, ref_time: datetime):
    region = firms.fire_region(city.id, city.bbox)
    if settings.firms_map_key:
        try:
            return firms.fetch_live_fires(region, settings.firms_map_key, day_range=2)
        except Exception as exc:
            log.warning("FIRMS live failed (%s); using seasonal model", exc)
    return firms.synthetic_fires(region, ref_time, firms.synthetic_fire_count(city.id))


def _fetch_live(city: City, past_days: int, forecast_days: int) -> CityObservations:
    zones: list[ZoneSeries] = []
    for z in city.zones:
        aq = fetch_air_quality(z.center.lat, z.center.lon, past_days, forecast_days, city.timezone)
        wx = fetch_weather(z.center.lat, z.center.lon, past_days, forecast_days, city.timezone)
        zones.append(ZoneSeries(zone_id=z.id, readings=aq, weather=wx))
        log.info("fetched %s: %d aq / %d wx rows", z.id, len(aq), len(wx))

    forecast_hours = forecast_days * 24
    grid = zones[0].readings
    now_ts = grid[-(forecast_hours + 1)].ts if len(grid) > forecast_hours else grid[-1].ts
    fires = _gather_fires(city, now_ts)
    try:
        landuse = fetch_landuse(city)
    except Exception as exc:
        log.warning("land-use fetch failed (%s); downscaling disabled", exc)
        landuse = None
    return CityObservations(
        city_id=city.id, generated_at=datetime.now(), now_ts=now_ts,
        forecast_hours=forecast_hours, source="live", zones=zones, fires=fires, landuse=landuse,
    )


def get_city_observations(
    city_id: str,
    mode: str = "auto",
    past_days: int = DEFAULT_PAST_DAYS,
    forecast_days: int = DEFAULT_FORECAST_DAYS,
    ttl_seconds: float = CACHE_TTL_SECONDS,
) -> CityObservations:
    """mode: 'auto' (cache→live→snapshot) | 'live' | 'snapshot' | 'cache'."""
    city = get_city(city_id)
    if city is None:
        raise CityNotFound(city_id)

    if mode == "snapshot":
        snap = snapshot.load_snapshot(city_id)
        if snap is not None:
            return snap
        log.warning("no snapshot for %s; attempting live", city_id)
        mode = "live"

    if mode in ("auto", "cache"):
        cached = snapshot.load_cache(city_id, ttl_seconds)
        if cached is not None:
            cached.source = "cache"
            return cached
        if mode == "cache":
            mode = "auto"

    if mode in ("auto", "live") and (settings.allow_live_fetch or mode == "live"):
        try:
            obs = _fetch_live(city, past_days, forecast_days)
            snapshot.save_cache(obs)
            return obs
        except Exception as exc:
            log.warning("live fetch failed for %s (%s); falling back to snapshot", city_id, exc)

    snap = snapshot.load_snapshot(city_id)
    if snap is not None:
        return snap
    raise RuntimeError(f"No data available for {city_id} (live unavailable, no snapshot present)")


def build_snapshot(city_id: str, past_days: int = DEFAULT_PAST_DAYS,
                   forecast_days: int = DEFAULT_FORECAST_DAYS) -> CityObservations:
    city = get_city(city_id)
    if city is None:
        raise CityNotFound(city_id)
    obs = _fetch_live(city, past_days, forecast_days)
    obs.source = "snapshot"
    snapshot.save_snapshot(obs)
    return obs

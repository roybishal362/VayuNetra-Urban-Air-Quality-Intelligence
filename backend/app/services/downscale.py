"""Land-use-regression downscaling.

CAMS resolves pollution at ~10 km, so adjacent wards share a value. We modulate that regional
field with OSM emission proxies — proximity to industrial areas and major roads — to produce a
hyperlocal estimate. A multiplier ~[0.8, 1.65] is applied to the interpolated PM2.5; near sources
it rises, far from them it falls. Stated honestly as a downscaled estimate, not a new measurement.
"""
from __future__ import annotations

import math

from app.domain.aqi import compute_aqi
from app.schemas.air import Reading
from app.schemas.city import City
from app.schemas.forecast import ForecastPoint, ZoneForecast
from app.schemas.geo import LatLon, haversine_km
from app.schemas.observations import LandUse

_BW_IND_KM = 2.5
_BW_ROAD_KM = 1.5

# per-city cache of factors aligned to a coordinate list (spatial, independent of time/horizon)
_CACHE: dict[str, tuple[int, list[float]]] = {}


def _kernel(dist_km: float, bw: float) -> float:
    return math.exp(-((dist_km / bw) ** 2))


def _radius_km(city: City) -> float:
    b = city.bbox
    return haversine_km(LatLon(lat=b.min_lat, lon=b.min_lon), LatLon(lat=b.max_lat, lon=b.max_lon)) / 2


def components_at(city: City, landuse: LandUse | None, lat: float, lon: float,
                  radius_km: float | None = None) -> tuple[float, float, float]:
    """Return (multiplier, traffic_norm, industrial_norm) at a point."""
    if landuse is None:
        return 1.0, 0.0, 0.0
    p = LatLon(lat=lat, lon=lon)

    ind = sum(_kernel(haversine_km(p, q), _BW_IND_KM) for q in landuse.industrial)
    ind_n = min(1.0, ind / 2.0)

    if landuse.roads:
        road = sum(_kernel(haversine_km(p, q), _BW_ROAD_KM) for q in landuse.roads)
        traffic_n = min(1.0, road / 3.0)
    else:
        r = radius_km if radius_km is not None else _radius_km(city)
        traffic_n = _kernel(haversine_km(p, city.center), max(1.0, r * 0.6))

    factor = max(0.8, min(1.65, 0.85 + 0.35 * traffic_n + 0.30 * ind_n))
    return factor, traffic_n, ind_n


def factor_at(city: City, landuse: LandUse | None, lat: float, lon: float,
              radius_km: float | None = None) -> float:
    return components_at(city, landuse, lat, lon, radius_km)[0]


def factors_for(city: City, landuse: LandUse | None, coords: list[tuple[float, float]]) -> list[float]:
    """Multipliers for a fixed coordinate list (grid), cached per city since they're static."""
    cached = _CACHE.get(city.id)
    if cached and cached[0] == len(coords):
        return cached[1]
    radius = _radius_km(city)
    out = [factor_at(city, landuse, lat, lon, radius) for lat, lon in coords]
    _CACHE[city.id] = (len(coords), out)
    return out


def scale_forecast(zf: ZoneForecast, factor: float) -> ZoneForecast:
    """Apply a land-use multiplier to a forecast so a zone's chart matches its hyperlocal AQI."""
    if abs(factor - 1.0) < 1e-6:
        return zf
    pts: list[ForecastPoint] = []
    for p in zf.points:
        pm = max(0.0, p.pm25 * factor)
        lo = max(0.0, (p.pm25_low if p.pm25_low is not None else pm) * factor)
        hi = max(0.0, (p.pm25_high if p.pm25_high is not None else pm) * factor)
        res = compute_aqi(Reading(ts=p.ts, pm25=pm))
        pts.append(ForecastPoint(
            ts=p.ts, horizon_h=p.horizon_h, pm25=round(pm, 1),
            pm25_low=round(lo, 1), pm25_high=round(hi, 1),
            aqi=res.aqi if res else 0, category=res.category if res else "Unknown",
            color=res.color if res else "#888888",
        ))
    return ZoneForecast(zone_id=zf.zone_id, issued_at=zf.issued_at, points=pts)


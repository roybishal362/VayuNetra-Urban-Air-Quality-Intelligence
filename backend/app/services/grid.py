"""Inverse-distance-weighted interpolation of zone PM2.5 onto a city grid for the heatmap.

PM2.5 is interpolated (a physical quantity); the CPCB AQI + colour are then computed per
cell so the map legend stays consistent with everything else in the platform.
"""
from __future__ import annotations

import math

from app.domain.aqi import compute_aqi
from app.schemas.air import Reading
from app.schemas.city import City
from app.schemas.grid import GridCell, GridResponse
from app.schemas.intelligence import CityIntelligence

_MAX_CELLS = 4000  # safety cap so a tiny step never explodes the payload


def _idw(lat: float, lon: float, samples: list[tuple[float, float, float]], power: float = 2.0) -> float:
    num = den = 0.0
    for slat, slon, val in samples:
        d2 = (lat - slat) ** 2 + (lon - slon) ** 2
        if d2 < 1e-9:
            return val
        w = 1.0 / (d2 ** (power / 2))
        num += w * val
        den += w
    return num / den if den else 0.0


def _samples(city: City, intel: CityIntelligence, layer: str, horizon: int):
    zmap = {z.id: z for z in city.zones}
    out: list[tuple[float, float, float]] = []
    if layer == "forecast":
        fmap = {f.zone_id: f for f in intel.forecasts}
        for z in city.zones:
            f = fmap.get(z.id)
            if f and f.points:
                pt = min(f.points, key=lambda p: abs(p.horizon_h - horizon))
                out.append((z.center.lat, z.center.lon, pt.pm25))
    else:
        for a in intel.attributions:
            z = zmap.get(a.zone_id)
            if z:
                out.append((z.center.lat, z.center.lon, a.pm25))
    return out


def build_aqi_grid(city: City, intel: CityIntelligence, layer: str = "current",
                   horizon: int = 24) -> GridResponse:
    layer = "forecast" if layer == "forecast" else "current"
    samples = _samples(city, intel, layer, horizon)
    bbox = city.bbox
    mid_lat = (bbox.min_lat + bbox.max_lat) / 2
    dlat = city.grid_step_km / 111.0
    dlon = city.grid_step_km / (111.0 * max(0.2, math.cos(math.radians(mid_lat))))

    # widen step if the grid would exceed the cap
    n_est = ((bbox.max_lat - bbox.min_lat) / dlat + 1) * ((bbox.max_lon - bbox.min_lon) / dlon + 1)
    if n_est > _MAX_CELLS:
        scale = math.sqrt(n_est / _MAX_CELLS)
        dlat *= scale
        dlon *= scale

    cells: list[GridCell] = []
    if samples:
        lat = bbox.min_lat
        while lat <= bbox.max_lat:
            lon = bbox.min_lon
            while lon <= bbox.max_lon:
                pm = max(0.0, _idw(lat, lon, samples))
                res = compute_aqi(Reading(ts=intel.now_ts, pm25=pm))
                if res:
                    cells.append(GridCell(lat=round(lat, 4), lon=round(lon, 4),
                                          aqi=res.aqi, category=res.category, color=res.color))
                lon += dlon
            lat += dlat

    return GridResponse(city_id=city.id, layer=layer, horizon_h=horizon,
                        step_km=round(city.grid_step_km, 2), now_ts=intel.now_ts, cells=cells)

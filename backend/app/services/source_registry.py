"""Match a ward to the real, registered emitters near it — with geospatial + upwind evidence.

This is what turns enforcement from "category guess" into "inspect THIS named source": for each
ward we find actual registered emitters (WRI power plants today; OSM industry/kilns/landfills and
FIRMS fires next), compute distance + compass bearing, and flag whether each sits **upwind** of the
ward (i.e. the wind is carrying its plume onto the ward right now).
"""
from __future__ import annotations

import math

from app.data.sources.powerplants import plants_near
from app.schemas.intelligence import MatchedSource

_COMPASS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
            "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"]


def _bearing_deg(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    dlon = math.radians(lon2 - lon1)
    y = math.sin(dlon) * math.cos(math.radians(lat2))
    x = (math.cos(math.radians(lat1)) * math.sin(math.radians(lat2))
         - math.sin(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.cos(dlon))
    return (math.degrees(math.atan2(y, x)) + 360) % 360


def _compass(deg: float) -> str:
    return _COMPASS[round(deg / 22.5) % 16]


def _angular_diff(a: float, b: float) -> float:
    d = abs(a - b) % 360
    return min(d, 360 - d)


def match_sources(lat: float, lon: float, wind_dir: float | None,
                  radius_km: float = 90.0, limit: int = 4) -> list[MatchedSource]:
    """Registered emitters near a ward, upwind ones first. `wind_dir` is the direction the wind
    blows FROM, so a source whose bearing-from-ward ≈ wind_dir is upwind (its plume reaches us)."""
    out: list[MatchedSource] = []
    for plant, dist in plants_near(lat, lon, radius_km, fossil_only=True):
        bearing = _bearing_deg(lat, lon, plant.lat, plant.lon)
        upwind = wind_dir is not None and _angular_diff(bearing, wind_dir) < 55.0
        out.append(MatchedSource(
            name=plant.name,
            kind=f"power_plant_{plant.fuel.lower()}",
            lat=plant.lat, lon=plant.lon,
            distance_km=round(dist, 1), bearing=_compass(bearing), upwind=upwind,
            detail=f"{plant.fuel} power plant · {int(plant.capacity_mw)} MW",
        ))
    # upwind first, then nearest — these are the ones to inspect
    out.sort(key=lambda m: (not m.upwind, m.distance_km))
    return out[:limit]

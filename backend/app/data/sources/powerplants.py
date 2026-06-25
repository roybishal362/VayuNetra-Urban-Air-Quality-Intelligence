"""Registered power-plant sources — real, geolocated industrial emitters.

Source: WRI Global Power Plant Database (CC-BY-4.0), India subset committed at
data/reference/power_plants_india.csv. Static reference data (plants don't move),
so it's loaded once and cached. Used by:
  • attribution  — a physically-grounded "industrial pressure" signal per zone
  • enforcement  — matching pollution hotspots to actual named, registered emitters
"""
from __future__ import annotations

import csv
import math
from dataclasses import dataclass
from functools import lru_cache

from app.core.config import DATA_DIR
from app.core.logging import get_logger

log = get_logger("vayunetra.powerplants")

_CSV = DATA_DIR / "reference" / "power_plants_india.csv"
FOSSIL = {"Coal", "Gas", "Oil"}  # combustion plants that emit SO2/NOx/PM


@dataclass(frozen=True)
class Plant:
    name: str
    lat: float
    lon: float
    capacity_mw: float
    fuel: str

    @property
    def is_fossil(self) -> bool:
        return self.fuel in FOSSIL


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2
         + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2)
    return 2 * r * math.asin(math.sqrt(a))


@lru_cache(maxsize=1)
def _all_plants() -> tuple[Plant, ...]:
    if not _CSV.exists():
        log.warning("power-plant reference missing at %s", _CSV)
        return ()
    out: list[Plant] = []
    with open(_CSV, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            try:
                out.append(Plant(
                    name=(row.get("name") or "").strip().title(),
                    lat=float(row["latitude"]), lon=float(row["longitude"]),
                    capacity_mw=float(row.get("capacity_mw") or 0.0),
                    fuel=(row.get("primary_fuel") or "").strip(),
                ))
            except (ValueError, KeyError):
                continue
    log.info("loaded %d power plants", len(out))
    return tuple(out)


def plants_near(lat: float, lon: float, radius_km: float = 80.0,
                fossil_only: bool = False) -> list[tuple[Plant, float]]:
    """Plants within radius_km of a point, as (plant, distance_km), nearest first."""
    out: list[tuple[Plant, float]] = []
    for p in _all_plants():
        if fossil_only and not p.is_fossil:
            continue
        d = _haversine_km(lat, lon, p.lat, p.lon)
        if d <= radius_km:
            out.append((p, d))
    out.sort(key=lambda pd: pd[1])
    return out


def industrial_pressure(lat: float, lon: float, radius_km: float = 80.0) -> float:
    """A 0..1 'how much registered fossil-combustion capacity sits near this zone' signal,
    distance-weighted (capacity / distance²). Normalised so a big nearby coal plant ≈ 1.
    Feeds the attribution engine as a real, grounded industry prior."""
    score = 0.0
    for p, d in plants_near(lat, lon, radius_km, fossil_only=True):
        score += p.capacity_mw / max(d, 2.0) ** 2
    # ~scale: DADRI (1820 MW @ 39 km) ≈ 1.2 → squashed to 0..1
    return min(1.0, score / 1.5)

"""NASA FIRMS active fires.

With a free MAP_KEY we pull real VIIRS detections. Without one, we synthesise a
seasonally-plausible regional fire field (e.g. crop-residue burning NW of Delhi) so the
attribution engine still has an upwind-biomass signal. Provenance is always explicit via
`FirePoint.source` ("FIRMS" = observed, "FIRMS-model" = synthesised).
"""
from __future__ import annotations

import csv
import io
import random
from datetime import datetime, timedelta

from app.core.logging import get_logger
from app.data.http import get_json  # noqa: F401  (kept for symmetry; FIRMS uses text below)
from app.schemas.air import FirePoint
from app.schemas.geo import BBox

log = get_logger("vayunetra.firms")

_FIRMS_CSV = "https://firms.modaps.eosdis.nasa.gov/api/area/csv"

# Regions where upwind burning realistically originates for each city.
_FIRE_REGIONS: dict[str, BBox] = {
    "delhi": BBox(min_lat=29.2, min_lon=74.4, max_lat=31.3, max_lon=77.2),      # Punjab/Haryana belt
    "bengaluru": BBox(min_lat=12.4, min_lon=76.9, max_lat=13.6, max_lon=78.2),  # surrounding rural
    "mumbai": BBox(min_lat=18.6, min_lon=72.5, max_lat=19.7, max_lon=73.5),
    "kolkata": BBox(min_lat=22.0, min_lon=87.9, max_lat=23.3, max_lon=88.9),
    "chennai": BBox(min_lat=12.5, min_lon=79.8, max_lat=13.7, max_lon=80.5),
    "hyderabad": BBox(min_lat=16.9, min_lon=78.0, max_lat=17.9, max_lon=78.9),
}
_DEFAULT_COUNT = {"delhi": 30, "bengaluru": 8, "mumbai": 12, "kolkata": 14,
                  "chennai": 12, "hyderabad": 12}


def fire_region(city_id: str, fallback: BBox) -> BBox:
    return _FIRE_REGIONS.get(city_id, fallback)


def synthetic_fire_count(city_id: str) -> int:
    return _DEFAULT_COUNT.get(city_id, 10)


def fetch_live_fires(bbox: BBox, map_key: str, day_range: int = 2,
                     sensor: str = "VIIRS_SNPP_NRT") -> list[FirePoint]:
    import httpx

    area = f"{bbox.min_lon},{bbox.min_lat},{bbox.max_lon},{bbox.max_lat}"
    url = f"{_FIRMS_CSV}/{map_key}/{sensor}/{area}/{day_range}"
    resp = httpx.get(url, timeout=30.0)
    resp.raise_for_status()
    fires: list[FirePoint] = []
    for row in csv.DictReader(io.StringIO(resp.text)):
        try:
            ts = datetime.strptime(f"{row['acq_date']} {int(row['acq_time']):04d}", "%Y-%m-%d %H%M")
            conf_raw = row.get("confidence", "")
            conf = {"l": 25.0, "n": 60.0, "h": 90.0}.get(conf_raw, None)
            if conf is None:
                conf = float(conf_raw) if conf_raw.replace(".", "").isdigit() else 50.0
            fires.append(FirePoint(
                lat=float(row["latitude"]), lon=float(row["longitude"]), ts=ts,
                brightness=float(row.get("bright_ti4") or 0) or None,
                confidence=conf, frp=float(row.get("frp") or 0) or None, source="FIRMS",
            ))
        except (KeyError, ValueError):
            continue
    return fires


def synthetic_fires(region: BBox, ref_time: datetime, count: int, window_hours: int = 48,
                    seed: int = 42) -> list[FirePoint]:
    rng = random.Random(seed)
    fires: list[FirePoint] = []
    for _ in range(count):
        lat = rng.uniform(region.min_lat, region.max_lat)
        lon = rng.uniform(region.min_lon, region.max_lon)
        ts = ref_time - timedelta(hours=rng.uniform(0, window_hours))
        fires.append(FirePoint(
            lat=round(lat, 4), lon=round(lon, 4), ts=ts,
            brightness=round(rng.uniform(305, 360), 1),
            confidence=round(rng.uniform(50, 95), 0),
            frp=round(rng.uniform(4, 60), 1), source="FIRMS-model",
        ))
    return fires

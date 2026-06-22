"""OpenStreetMap land-use ingestion (Overpass): industrial areas + major roads.

These feed the land-use-regression downscaling that turns the coarse ~10 km CAMS field into a
hyperlocal estimate. If Overpass is unavailable, we fall back to curated REAL industrial-area
centroids so the feature still works offline.
"""
from __future__ import annotations

import httpx

from app.core.logging import get_logger
from app.schemas.city import City
from app.schemas.geo import BBox, LatLon
from app.schemas.observations import LandUse

log = get_logger("vayunetra.osm")

OVERPASS = "https://overpass-api.de/api/interpreter"

# Real industrial-area centroids (fallback if Overpass is blocked/slow).
_CURATED_INDUSTRIAL: dict[str, list[tuple[float, float]]] = {
    "delhi": [(28.700, 77.165), (28.684, 77.077), (28.776, 77.051), (28.553, 77.281),
              (28.631, 77.139), (28.690, 77.182), (28.713, 77.103), (28.509, 77.064),
              (28.659, 77.230), (28.628, 77.295), (28.735, 77.120)],
    "bengaluru": [(13.027, 77.519), (12.806, 77.660), (12.962, 77.685), (12.842, 77.660),
                  (13.052, 77.620), (12.892, 77.560), (12.940, 77.690)],
}


def _bbox(b: BBox) -> str:
    return f"{b.min_lat},{b.min_lon},{b.max_lat},{b.max_lon}"


def _overpass(query: str) -> list[dict]:
    r = httpx.post(OVERPASS, data={"data": query}, timeout=45.0,
                   headers={"User-Agent": "VayuNetra/0.1 (hackathon)"})
    r.raise_for_status()
    return r.json().get("elements", [])


def _industrial(bbox: BBox) -> list[LatLon]:
    q = (f'[out:json][timeout:35];('
         f'way["landuse"="industrial"]({_bbox(bbox)});'
         f'relation["landuse"="industrial"]({_bbox(bbox)}););out center 250;')
    pts: list[LatLon] = []
    for el in _overpass(q):
        c = el.get("center") or ({"lat": el["lat"], "lon": el["lon"]} if "lat" in el else None)
        if c:
            pts.append(LatLon(lat=c["lat"], lon=c["lon"]))
    return pts


def _roads(bbox: BBox) -> list[LatLon]:
    q = (f'[out:json][timeout:35];'
         f'way["highway"~"^(motorway|trunk|primary)$"]({_bbox(bbox)});out center 500;')
    pts: list[LatLon] = []
    for el in _overpass(q):
        c = el.get("center")
        if c:
            pts.append(LatLon(lat=c["lat"], lon=c["lon"]))
    return pts


def fetch_landuse(city: City) -> LandUse:
    industrial: list[LatLon] = []
    roads: list[LatLon] = []
    try:
        industrial = _industrial(city.bbox)
    except Exception as exc:
        log.warning("OSM industrial fetch failed (%s)", exc)
    try:
        roads = _roads(city.bbox)
    except Exception as exc:
        log.warning("OSM roads fetch failed (%s)", exc)

    if not industrial:
        industrial = [LatLon(lat=a, lon=b) for a, b in _CURATED_INDUSTRIAL.get(city.id, [])]
        log.info("[%s] using curated industrial centroids (%d)", city.id, len(industrial))

    log.info("[%s] land-use: industrial=%d roads=%d", city.id, len(industrial), len(roads))
    return LandUse(industrial=industrial, roads=roads)

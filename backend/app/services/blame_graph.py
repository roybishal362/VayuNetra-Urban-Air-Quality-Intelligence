"""Pollution blame-graph — "who pollutes whom" via wind transport.

A novel view: pollution rides the wind, so a ward sitting upwind of another sends its plume
downwind onto it. We build a directed graph where an edge A→B means "A's pollution is being
carried onto B right now". Edge strength = A's PM2.5 × how well the A→B direction lines up with
the downwind flow × proximity. It turns the source story from "this ward is dusty" into "this
ward is dumping on its neighbours" — useful for regional, cross-ward enforcement.
"""
from __future__ import annotations

import math

from app.schemas.attribution import ZoneAttribution
from app.schemas.city import City
from app.schemas.geo import LatLon, angular_diff, bearing_deg, haversine_km


def _circular_mean(degs: list[float]) -> float | None:
    vals = [d for d in degs if d is not None]
    if not vals:
        return None
    s = sum(math.sin(math.radians(d)) for d in vals)
    c = sum(math.cos(math.radians(d)) for d in vals)
    return math.degrees(math.atan2(s, c)) % 360.0


def blame_graph(city: City, attributions: list[ZoneAttribution], max_edges: int = 12) -> dict:
    zmap = {z.id: z for z in city.zones}
    wind_from = _circular_mean([a.wind_dir for a in attributions if a.wind_dir is not None])
    nodes = [
        {"zone_id": a.zone_id, "zone_name": a.zone_name,
         "lat": zmap[a.zone_id].center.lat, "lon": zmap[a.zone_id].center.lon, "aqi": a.aqi}
        for a in attributions if a.zone_id in zmap
    ]
    edges: list[dict] = []
    if wind_from is not None:
        downwind = (wind_from + 180) % 360   # the direction the wind is blowing TOWARD
        for a in attributions:
            za = zmap.get(a.zone_id)
            if za is None:
                continue
            for b in attributions:
                if a.zone_id == b.zone_id or b.zone_id not in zmap:
                    continue
                zb = zmap[b.zone_id]
                brg = bearing_deg(za.center, zb.center)            # direction A → B
                align = math.cos(math.radians(angular_diff(brg, downwind)))
                if align < 0.6:                                    # B must be roughly downwind of A
                    continue
                dist = haversine_km(za.center, zb.center)
                if dist < 0.5 or dist > 45:
                    continue
                edges.append({"from": a.zone_id, "to": b.zone_id,
                              "weight": a.pm25 * align * (8.0 / dist)})
        edges.sort(key=lambda e: e["weight"], reverse=True)
        edges = edges[:max_edges]
        mw = max((e["weight"] for e in edges), default=1.0) or 1.0
        for e in edges:
            e["weight"] = round(e["weight"] / mw, 2)

    return {"city_id": city.id, "wind_from": round(wind_from) if wind_from is not None else None,
            "nodes": nodes, "edges": edges}

"""What-if intervention simulation + observed-history extraction (hyperlocal-consistent)."""
from __future__ import annotations

import pandas as pd

from app.domain.aqi import compute_aqi
from app.ml.attribution import SOURCES
from app.ml.features import build_zone_frame
from app.schemas.air import Reading
from app.schemas.attribution import ZoneAttribution
from app.schemas.city import City
from app.schemas.observations import CityObservations
from app.schemas.scenario import HistoryPoint, SimulationResult, ZoneHistory
from app.services.downscale import factor_at


def simulate_reduction(attr: ZoneAttribution, source: str, reduction: float) -> SimulationResult:
    """Reduce one source's PM2.5 contribution by `reduction` and recompute the PM2.5 AQI."""
    reduction = max(0.0, min(1.0, float(reduction)))
    contrib = next((c for c in attr.contributions if c.source == source), None)
    removed = (contrib.concentration * reduction) if contrib else 0.0
    new_pm = max(0.0, attr.pm25 - removed)

    orig = compute_aqi(Reading(ts=attr.ts, pm25=attr.pm25))   # PM2.5-basis for a consistent delta
    new = compute_aqi(Reading(ts=attr.ts, pm25=new_pm))
    o_aqi = orig.aqi if orig else 0
    n_aqi = new.aqi if new else 0
    label = SOURCES.get(source, (source, "#888888"))[0]

    return SimulationResult(
        zone_id=attr.zone_id, zone_name=attr.zone_name, source=source, source_label=label,
        reduction=round(reduction, 2), original_pm25=round(attr.pm25, 1), new_pm25=round(new_pm, 1),
        original_aqi=o_aqi, new_aqi=n_aqi, delta_aqi=n_aqi - o_aqi,
        new_category=new.category if new else "Unknown", new_color=new.color if new else "#888888",
    )


def build_history(city: City, obs: CityObservations, zone_id: str, hours: int = 48) -> ZoneHistory:
    z = next((zz for zz in city.zones if zz.id == zone_id), None)
    zs = obs.zone(zone_id)
    if z is None or zs is None:
        return ZoneHistory(zone_id=zone_id, now_ts=obs.now_ts, points=[])

    df = build_zone_frame(zs)
    df = df[df.index <= pd.to_datetime(obs.now_ts)].tail(hours)
    factor = factor_at(city, obs.landuse, z.center.lat, z.center.lon)

    pts: list[HistoryPoint] = []
    for ts, row in df.iterrows():
        pmv = row.get("pm25")
        if pmv is None or pd.isna(pmv):
            continue
        pm = float(pmv) * factor
        res = compute_aqi(Reading(ts=ts, pm25=pm))
        if res:
            pts.append(HistoryPoint(ts=ts, pm25=round(pm, 1), aqi=res.aqi,
                                    category=res.category, color=res.color))
    return ZoneHistory(zone_id=zone_id, now_ts=obs.now_ts, points=pts)

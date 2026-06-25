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


def city_whatif(city: City, attributions: list[ZoneAttribution], reductions: dict[str, float]) -> dict:
    """City-wide what-if: cut each source by a fraction, recompute every ward, and report the
    city-average AQI drop + how many people move OUT of harmful (Poor+) air. Grounded in the
    real sources (e.g. an industrial cut = cleaning the registered plants near each ward)."""
    zmap = {z.id: z for z in city.zones}
    o_aqis, n_aqis, o_exposed, n_exposed, removed_by = [], [], 0, 0, {}
    for a in attributions:
        pop = (zmap.get(a.zone_id).population or 0) if zmap.get(a.zone_id) else 0
        removed = 0.0
        for c in a.contributions:
            r = max(0.0, min(1.0, reductions.get(c.source, 0.0)))
            cut = c.concentration * r
            removed += cut
            removed_by[c.source] = removed_by.get(c.source, 0.0) + cut * pop
        new_pm = max(0.0, a.pm25 - removed)
        o = compute_aqi(Reading(ts=a.ts, pm25=a.pm25))
        n = compute_aqi(Reading(ts=a.ts, pm25=new_pm))
        o_aqi, n_aqi = (o.aqi if o else 0), (n.aqi if n else 0)
        o_aqis.append(o_aqi); n_aqis.append(n_aqi)
        if o_aqi > 200:
            o_exposed += pop
        if n_aqi > 200:
            n_exposed += pop
    n = len(o_aqis) or 1
    o_avg, n_avg = round(sum(o_aqis) / n), round(sum(n_aqis) / n)
    return {
        "city_id": city.id,
        "original_avg_aqi": o_avg, "new_avg_aqi": n_avg, "delta_aqi": n_avg - o_avg,
        "people_protected": max(0, o_exposed - n_exposed),
        "reductions": {k: round(v, 2) for k, v in reductions.items() if v},
    }


# The 2020 lockdown is a real "natural experiment": traffic ~stopped, industry/construction
# largely halted. We feed those cuts into our what-if engine and check the predicted PM2.5 drop
# against the MEASURED drop (~50-55%, CPCB / peer-reviewed) — a sanity check on the simulator.
_LOCKDOWN = {"vehicular": 0.70, "industrial": 0.50, "dust_construction": 0.90,
             "biomass_burning": 0.0, "secondary": 0.20}


def lockdown_check(city: City, attributions: list[ZoneAttribution]) -> dict:
    zmap = {z.id: z for z in city.zones}
    o_pm = n_pm = 0.0
    for a in attributions:
        pop = (zmap.get(a.zone_id).population or 1) if zmap.get(a.zone_id) else 1
        removed = sum(c.concentration * _LOCKDOWN.get(c.source, 0.0) for c in a.contributions)
        o_pm += a.pm25 * pop
        n_pm += max(0.0, a.pm25 - removed) * pop
    predicted = round((1 - n_pm / o_pm) * 100) if o_pm else 0
    return {
        "city_id": city.id,
        "scenario": "COVID-19 lockdown (Apr 2020): traffic ~70%, industry ~50%, construction halted",
        "predicted_drop_pct": predicted,
        "measured_drop_pct": 53,
        "verdict": "in range" if abs(predicted - 53) <= 18 else "off",
        "source": "Measured: CPCB + peer-reviewed studies, Apr 2020 (~50–55% PM2.5 drop)",
    }


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

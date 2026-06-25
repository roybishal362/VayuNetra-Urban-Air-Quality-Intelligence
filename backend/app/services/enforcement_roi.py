"""Enforcement ROI optimiser — "where do N inspectors do the most good?"

The problem statement asks for "where to deploy inspectors for maximum impact". Authorities
never have enough inspectors for every ward, so this turns the ranked queue into a concrete
deployment plan: it scores each ward by the **population-weighted, actionable pollution burden**
it carries, and reports how much of the whole city's burden a given number of inspectors covers.
"""
from __future__ import annotations

from app.agents.enforcement import _ACTIONABILITY
from app.schemas.attribution import ZoneAttribution
from app.schemas.city import City


def _burden(pop: int, aqi: int, dominant_source: str) -> float:
    """How much avoidable harm sits in this ward = people × severity × how-fixable-the-source-is."""
    sev = min(aqi, 500) / 100.0
    act = _ACTIONABILITY.get(dominant_source, 0.5)
    return pop * sev * act


def optimize(city: City, attributions: list[ZoneAttribution], inspectors: int) -> dict:
    zmap = {z.id: z for z in city.zones}
    wards = []
    for a in attributions:
        z = zmap.get(a.zone_id)
        if z is None:
            continue
        pop = z.population or 0
        wards.append((a, pop, _burden(pop, a.aqi, a.dominant_source)))

    total = sum(w[2] for w in wards) or 1.0
    wards.sort(key=lambda w: w[2], reverse=True)
    n = max(1, min(inspectors, len(wards)))
    selected = wards[:n]
    covered = sum(w[2] for w in selected)
    pop_covered = sum(w[1] for w in selected)

    return {
        "city_id": city.id,
        "inspectors": n,
        "total_wards": len(wards),
        "covered_pct": round(covered / total * 100, 1),
        "population_covered": int(pop_covered),
        "selected": [
            {
                "zone_id": a.zone_id, "zone_name": a.zone_name,
                "dominant_label": a.dominant_label, "aqi": a.aqi, "population": pop,
                "burden_share": round(b / total * 100, 1),
            }
            for (a, pop, b) in selected
        ],
    }

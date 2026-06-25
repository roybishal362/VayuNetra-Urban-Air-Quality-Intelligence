"""Air-Health-Cost Index — what is this pollution costing, in rupees per day?

Turns an abstract AQI into money an administrator feels: the daily economic damage (health +
lost productivity) of a ward's PM2.5. Method is transparent and calibrated to a published total,
and clearly labelled as an illustrative estimate — not a fabricated precise figure.

Calibration: the World Bank / IHME put India's air-pollution cost at roughly ₹8 lakh crore a
year (~3% of GDP). Spread across ~1.4B people exposed to ~50 µg/m³ of PM2.5 above the GBD
theoretical-minimum (TMREL ≈ 5 µg/m³, below which no excess risk is assumed), that is
≈ ₹0.31 per µg/m³ per person per day. We apply that damage rate to the excess PM2.5 in each
ward, weighted by its population. (GBD uses ~5 µg/m³, not the WHO 15 µg/m³ policy target,
because health damage continues below 15.)
"""
from __future__ import annotations

from app.schemas.attribution import ZoneAttribution
from app.schemas.city import City

DAMAGE_RS_PER_UG_PERSON_DAY = 0.31   # calibrated to World Bank/IHME India total
TMREL_PM25 = 5.0                     # GBD theoretical-minimum-risk exposure level
_CRORE = 1e7


def ward_cost_rs_day(pm25: float, population: int) -> float:
    excess = max(0.0, pm25 - TMREL_PM25)
    return excess * DAMAGE_RS_PER_UG_PERSON_DAY * population


def city_health_cost(city: City, attributions: list[ZoneAttribution]) -> dict:
    zmap = {z.id: z for z in city.zones}
    rows, total, pop_total = [], 0.0, 0
    for a in attributions:
        z = zmap.get(a.zone_id)
        if z is None:
            continue
        pop = z.population or 0
        cost = ward_cost_rs_day(a.pm25, pop)
        total += cost
        pop_total += pop
        rows.append({
            "zone_id": a.zone_id, "zone_name": a.zone_name,
            "pm25": round(a.pm25, 1), "population": pop,
            "cost_cr_day": round(cost / _CRORE, 2),
        })
    rows.sort(key=lambda r: r["cost_cr_day"], reverse=True)
    return {
        "city_id": city.id,
        "total_cr_day": round(total / _CRORE, 1),
        "total_cr_year": round(total * 365 / _CRORE, 0),
        "per_capita_rs_day": round(total / pop_total, 1) if pop_total else 0.0,
        "rows": rows,
        "methodology": ("Illustrative: ₹0.31 per µg/m³ of PM2.5 above the GBD minimum (~5 µg/m³), "
                        "per person/day — calibrated to the World Bank/IHME India total (~₹8 lakh "
                        "crore/yr). Health + productivity damage, not a precise figure."),
    }

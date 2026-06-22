"""Public-health impact aggregation from per-zone AQI + population/vulnerability exposure."""
from __future__ import annotations

from app.domain.aqi import category_for
from app.schemas.attribution import ZoneAttribution
from app.schemas.city import City
from app.schemas.intelligence import CityHealth


def compute_health(city: City, attributions: list[ZoneAttribution]) -> CityHealth:
    zmap = {z.id: z for z in city.zones}
    total = sum(z.population or 0 for z in city.zones)
    exposed = severe = vuln = 0
    aqis: list[int] = []

    for a in attributions:
        z = zmap.get(a.zone_id)
        if z is None:
            continue
        aqis.append(a.aqi)
        if a.aqi > 200:  # Poor or worse
            exposed += z.population or 0
            vuln += z.vulnerable_sites or 0
        if a.aqi > 400:  # Severe
            severe += z.population or 0

    avg = int(round(sum(aqis) / len(aqis))) if aqis else 0
    worst = category_for(max(aqis) if aqis else 0)[0]
    note = f"~{exposed:,} residents breathing Poor-or-worse air"
    if severe:
        note += f" ({severe:,} in Severe)"
    note += f"; {vuln} schools/hospitals in affected wards."

    return CityHealth(
        total_population=total, exposed_population=exposed, severe_population=severe,
        vulnerable_sites_affected=vuln, avg_aqi=avg, worst_category=worst, note=note,
    )

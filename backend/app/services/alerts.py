"""Active air-quality alerts from current state + forecast trend."""
from __future__ import annotations

from app.schemas.attribution import ZoneAttribution
from app.schemas.city import City
from app.schemas.forecast import ZoneForecast
from app.schemas.intelligence import Alert


def compute_alerts(city: City, attributions: list[ZoneAttribution],
                   forecasts: list[ZoneForecast]) -> list[Alert]:
    fmap = {f.zone_id: f for f in forecasts}
    out: list[Alert] = []

    for a in attributions:
        if a.aqi >= 401:
            out.append(Alert(
                zone_id=a.zone_id, zone_name=a.zone_name, level="severe", aqi=a.aqi, horizon_h=0,
                message=f"Severe air now (AQI {a.aqi}), {a.dominant_label}-driven.",
            ))
            continue
        f = fmap.get(a.zone_id)
        if f and f.points:
            peak = max(f.points, key=lambda p: p.aqi)
            if peak.aqi >= 301 and peak.aqi > a.aqi + 25:
                level = "warning" if peak.aqi >= 401 else "watch"
                out.append(Alert(
                    zone_id=a.zone_id, zone_name=a.zone_name, level=level, aqi=peak.aqi,
                    horizon_h=peak.horizon_h,
                    message=f"AQI forecast to rise to ~{peak.aqi} ({peak.category}) within {peak.horizon_h}h.",
                ))

    out.sort(key=lambda x: x.aqi, reverse=True)
    return out

"""Multi-signal PM2.5 source attribution.

No single signal reveals the source, so we fuse four independent ones:
  1. Chemistry fingerprint   — NO2/CO -> traffic, SO2 -> industry, coarse fraction -> dust
  2. Upwind fire trajectory  — FIRMS fires aligned with the wind-FROM direction -> biomass
  3. Particulate ratio       — PM10:PM2.5 distinguishes crustal dust from combustion
  4. Meteorological dispersion — low wind / low boundary layer amplifies LOCAL sources

The output is a confidence-scored apportionment of the PM2.5 mass plus the human-readable
evidence chain that justifies it (used verbatim in enforcement briefs + the UI).
This is a calibrated rule-based fingerprint, not a chemical-transport model — stated honestly.
"""
from __future__ import annotations

import math
from datetime import timedelta

import numpy as np
import pandas as pd

from app.core.logging import get_logger
from app.domain.aqi import compute_aqi
from app.ml.features import build_zone_frame
from app.schemas.air import Reading
from app.schemas.attribution import Evidence, SourceContribution, ZoneAttribution
from app.schemas.city import City
from app.schemas.geo import LatLon, angular_diff, bearing_deg, haversine_km
from app.schemas.observations import CityObservations
from app.services.downscale import components_at

log = get_logger("vayunetra.attribution")

SOURCES = {
    "vehicular": ("Vehicular / Traffic", "#4F86C6"),
    "industrial": ("Industrial / Power", "#8E44AD"),
    "biomass_burning": ("Biomass / Crop Burning", "#E67E22"),
    "dust_construction": ("Dust / Construction", "#C2956E"),
    "secondary": ("Secondary / Regional", "#16A085"),
}

# reference levels (µg/m³) used to normalise indicator strength
_NO2_REF, _SO2_REF, _CO_REF, _O3_REF, _FIRE_REF = 40.0, 40.0, 1000.0, 100.0, 40.0
_FIRE_MAX_KM = 250.0
_FIRE_WINDOW_H = 48.0
_COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]


def _compass(deg: float) -> str:
    return _COMPASS[int(((deg % 360) + 22.5) // 45) % 8]


def _circular_mean_deg(degs: list[float]) -> float | None:
    vals = [d for d in degs if d is not None and not math.isnan(d)]
    if not vals:
        return None
    s = sum(math.sin(math.radians(d)) for d in vals)
    c = sum(math.cos(math.radians(d)) for d in vals)
    return math.degrees(math.atan2(s, c)) % 360.0


def _recent_conditions(zs, now_ts, hours: int = 6) -> dict:
    """Mean of the last `hours` observed rows up to now_ts (robust to single-hour noise)."""
    df = build_zone_frame(zs)
    df = df[df.index <= pd.to_datetime(now_ts)].tail(hours)
    if df.empty:
        return {}
    out: dict = {}
    for col in ("pm25", "pm10", "no2", "so2", "o3", "co", "wind_speed", "blh"):
        if col in df:
            v = df[col].mean(skipna=True)
            out[col] = float(v) if pd.notna(v) else None
    out["wind_dir"] = _circular_mean_deg(list(df["wind_dir"])) if "wind_dir" in df else None
    return out


def _upwind_fire_signal(center: LatLon, wind_dir: float | None, fires, now_ts):
    """Weighted intensity of fires sitting upwind (FRP × recency × 1/dist × wind-alignment)."""
    if wind_dir is None or not fires:
        return 0.0, 0, []
    score, count, dists = 0.0, 0, []
    now = pd.to_datetime(now_ts)
    for f in fires:
        age_h = (now - pd.to_datetime(f.ts)).total_seconds() / 3600.0
        if age_h < 0 or age_h > _FIRE_WINDOW_H:
            continue
        fp = LatLon(lat=f.lat, lon=f.lon)
        dist = haversine_km(center, fp)
        if dist > _FIRE_MAX_KM or dist < 1:
            continue
        # fire is "upwind" if the bearing to it matches where the wind blows FROM
        align = max(0.0, math.cos(math.radians(angular_diff(bearing_deg(center, fp), wind_dir))))
        if align < 0.3:
            continue
        recency = max(0.2, 1.0 - age_h / _FIRE_WINDOW_H)
        frp = f.frp or 10.0
        score += frp * recency * align * (60.0 / dist)
        count += 1
        dists.append(dist)
    return score, count, dists


def _clip(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


def attribute_zone(obs: CityObservations, city: City, zone_id: str) -> ZoneAttribution | None:
    zone = next((z for z in city.zones if z.id == zone_id), None)
    zs = obs.zone(zone_id)
    if zone is None or zs is None:
        return None
    c = _recent_conditions(zs, obs.now_ts)
    pm25 = c.get("pm25") or 0.0
    pm10 = c.get("pm10") or pm25
    no2, so2, co, o3 = c.get("no2") or 0.0, c.get("so2") or 0.0, c.get("co") or 0.0, c.get("o3") or 0.0
    wind, blh, wdir = c.get("wind_speed") or 1.0, c.get("blh") or 500.0, c.get("wind_dir")

    # Hyperlocal downscaling: lift PM toward nearby emission sources (roads / industry).
    lu_factor, traffic_n, ind_n = components_at(city, obs.landuse, zone.center.lat, zone.center.lon)
    pm25 *= lu_factor
    pm10 *= lu_factor

    fire_score, fires_n, fire_dists = _upwind_fire_signal(zone.center, wdir, obs.fires, obs.now_ts)

    # --- indicators (0..3) ---
    i_no2 = _clip(no2 / _NO2_REF, 0, 3)
    i_so2 = _clip(so2 / _SO2_REF, 0, 3)
    i_co = _clip(co / _CO_REF, 0, 3)
    i_o3 = _clip(o3 / _O3_REF, 0, 3)
    i_fire = _clip(fire_score / _FIRE_REF, 0, 3)
    coarse_frac = _clip((pm10 - pm25) / pm10, 0, 1) if pm10 > 0 else 0.0

    # --- raw source weights ---
    w = {
        "vehicular": 0.9 * i_no2 + 0.25 * i_co,
        "industrial": 1.0 * i_so2,
        "biomass_burning": 1.1 * i_fire + 0.35 * i_co,
        "dust_construction": 1.6 * coarse_frac,
        "secondary": 0.5 + 0.3 * i_o3,
    }

    # --- land-use modulation: roads -> traffic/dust, industry -> industrial ---
    w["vehicular"] *= 1 + 0.5 * traffic_n
    w["dust_construction"] *= 1 + 0.25 * traffic_n
    w["industrial"] *= 1 + 0.7 * ind_n

    # --- meteorological modulation: stagnation amplifies local sources ---
    local_amp = _clip(1.4 - wind / 4.0, 0.75, 1.5) * _clip(500.0 / max(blh, 150.0), 0.85, 1.6)
    transport_amp = _clip(0.6 + wind / 5.0, 0.6, 1.5)
    for k in ("vehicular", "industrial", "dust_construction"):
        w[k] *= local_amp
    for k in ("biomass_burning", "secondary"):
        w[k] *= transport_amp

    total = sum(w.values()) or 1.0
    fracs = {k: v / total for k, v in w.items()}

    # --- confidence from signal separation + completeness + intensity ---
    ps = [p for p in fracs.values() if p > 0]
    entropy = -sum(p * math.log(p) for p in ps) if ps else 0.0
    separation = 1.0 - entropy / math.log(len(SOURCES))
    completeness = sum(1 for v in (pm25, pm10, no2, so2, co) if v) / 5.0
    intensity = _clip(pm25 / 120.0, 0, 1)
    overall_conf = _clip(0.40 + 0.42 * separation + 0.10 * completeness + 0.08 * intensity, 0.30, 0.97)

    max_frac = max(fracs.values())
    contributions = []
    for key, frac in sorted(fracs.items(), key=lambda kv: kv[1], reverse=True):
        label, color = SOURCES[key]
        cat_conf = _clip(overall_conf * (0.6 + 0.4 * (frac / max_frac)), 0.25, 0.97)
        contributions.append(SourceContribution(
            source=key, label=label, pct=round(frac * 100, 1),
            concentration=round(frac * pm25, 1), confidence=round(cat_conf, 2), color=color,
        ))

    dominant = contributions[0]
    fires_modeled = any(getattr(f, "source", "") == "FIRMS-model" for f in obs.fires)
    evidence = _build_evidence(no2, so2, co, pm10, pm25, coarse_frac, i_no2, i_so2,
                               fires_n, fire_dists, wdir, wind, blh, fires_modeled,
                               traffic_n, ind_n)
    aqi = compute_aqi(Reading(ts=obs.now_ts, pm25=pm25, pm10=pm10, no2=no2, so2=so2, o3=o3, co=co))

    return ZoneAttribution(
        zone_id=zone_id, zone_name=zone.name, ts=obs.now_ts,
        pm25=round(pm25, 1), aqi=aqi.aqi if aqi else 0,
        category=aqi.category if aqi else "Unknown",
        dominant_source=dominant.source, dominant_label=dominant.label,
        overall_confidence=round(overall_conf, 2),
        contributions=contributions, evidence=evidence, fires_upwind=fires_n,
        fires_modeled=fires_modeled,
        wind_speed=round(float(wind), 1),
        wind_dir=round(float(wdir), 0) if wdir is not None else None,
    )


def _build_evidence(no2, so2, co, pm10, pm25, coarse_frac, i_no2, i_so2,
                    fires_n, fire_dists, wdir, wind, blh, fires_modeled=False,
                    traffic_n=0.0, ind_n=0.0) -> list[Evidence]:
    ev: list[Evidence] = []
    if i_no2 >= 0.8:
        ev.append(Evidence(signal="NO₂", detail=f"{no2:.0f} µg/m³ ({no2/_NO2_REF:.1f}× typical) — combustion/traffic",
                            points_to="vehicular"))
    if i_so2 >= 0.8:
        ev.append(Evidence(signal="SO₂", detail=f"{so2:.0f} µg/m³ ({so2/_SO2_REF:.1f}× typical) — coal/heavy fuel",
                            points_to="industrial"))
    if pm25 > 0 and pm10 / max(pm25, 1) >= 1.8:
        ev.append(Evidence(signal="PM10:PM2.5", detail=f"{pm10/max(pm25,1):.1f}× — coarse, crustal dust signature",
                           points_to="dust_construction"))
    if fires_n > 0 and wdir is not None:
        dmin, dmax = min(fire_dists), max(fire_dists)
        tag = " (modeled — set FIRMS_MAP_KEY for live)" if fires_modeled else ""
        ev.append(Evidence(signal="Upwind fires",
                           detail=f"{fires_n} active fires {dmin:.0f}–{dmax:.0f} km {_compass(wdir)}, wind from {_compass(wdir)}{tag}",
                           points_to="biomass_burning"))
    if wind < 1.5 or blh < 300:
        ev.append(Evidence(signal="Stagnation",
                           detail=f"wind {wind:.1f} m/s, boundary layer {blh:.0f} m — local accumulation",
                           points_to="vehicular"))
    if ind_n >= 0.4:
        ev.append(Evidence(signal="Industrial proximity",
                           detail="within ~2–3 km of mapped industrial areas",
                           points_to="industrial"))
    if traffic_n >= 0.55:
        ev.append(Evidence(signal="Traffic density",
                           detail="high arterial-road / urban-core density",
                           points_to="vehicular"))
    return ev


def attribute_city(obs: CityObservations, city: City) -> list[ZoneAttribution]:
    out = []
    for z in city.zones:
        try:
            a = attribute_zone(obs, city, z.id)
            if a:
                out.append(a)
        except Exception as exc:
            log.warning("attribution failed for %s: %s", z.id, exc)
    return out

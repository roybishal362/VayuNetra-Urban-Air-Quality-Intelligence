"""Air-quality compliance scorecards + an honest intervention ledger.

Compliance: how each city's live PM2.5 measures against the CPCB national standard (NAAQS,
60 µg/m³ 24-hour) and the WHO guideline (15 µg/m³) — the "are we meeting the law?" view the
brief asks for. Intervention ledger: a curated, CITED record of what real policies actually
did to AQI — honest about the ones that barely moved the needle (odd-even ~4%), because that
is exactly the "learn what worked across cities" the brief wants.
"""
from __future__ import annotations

from app.schemas.attribution import ZoneAttribution
from app.schemas.city import City

NAAQS_PM25_24H = 60.0   # CPCB national standard (µg/m³, 24-hour)
WHO_PM25_24H = 15.0     # WHO 2021 guideline


def _grade(avg_pm25: float) -> tuple[str, str]:
    if avg_pm25 <= 30:
        return "A", "#55A84F"
    if avg_pm25 <= NAAQS_PM25_24H:
        return "B", "#A3C853"
    if avg_pm25 <= 90:
        return "C", "#FFF833"
    if avg_pm25 <= 150:
        return "D", "#F29C33"
    return "F", "#E93F33"


def city_compliance(city: City, attributions: list[ZoneAttribution]) -> dict:
    pm = [a.pm25 for a in attributions] or [0.0]
    avg = sum(pm) / len(pm)
    over = sum(1 for p in pm if p > NAAQS_PM25_24H)
    grade, color = _grade(avg)
    return {
        "city_id": city.id, "city_name": city.name,
        "avg_pm25": round(avg, 1),
        "pct_wards_over_naaqs": round(over / len(pm) * 100, 0),
        "naaqs_exceedance": round(avg / NAAQS_PM25_24H, 1),   # × over the CPCB standard
        "who_exceedance": round(avg / WHO_PM25_24H, 1),       # × over the WHO guideline
        "grade": grade, "grade_color": color,
        "naaqs": NAAQS_PM25_24H, "who": WHO_PM25_24H,
    }


# ── Intervention ledger — real policies, honest measured/estimated effects (cited) ──
INTERVENTION_LEDGER = [
    {"policy": "COVID-19 lockdown (Apr 2020)", "city": "Delhi & nationwide",
     "effect_pct": -50, "verdict": "worked", "note": "PM2.5 fell ~50% — proof that traffic+industry cuts work.",
     "source": "CPCB / multiple peer-reviewed studies, 2020"},
    {"policy": "GRAP (Graded Response Action Plan)", "city": "Delhi-NCR",
     "effect_pct": -10, "verdict": "mixed", "note": "Modest, hard to isolate from weather; helps at higher stages.",
     "source": "CSE / TERI assessments"},
    {"policy": "Odd-Even vehicle rationing", "city": "Delhi",
     "effect_pct": -4, "verdict": "weak", "note": "~2–4% PM2.5; not significant once weather is controlled.",
     "source": "AAQR modelling; 2016 field studies"},
    {"policy": "BS-VI fuel + vehicle norms (2020)", "city": "Nationwide",
     "effect_pct": -15, "verdict": "worked", "note": "Lower per-vehicle emissions; gains compound over years.",
     "source": "MoRTH / ICCT"},
    {"policy": "LPG (Ujjwala) for cooking", "city": "Rural + peri-urban",
     "effect_pct": -20, "verdict": "worked", "note": "Cuts household biomass burning — a top PM2.5 source.",
     "source": "GBD / household-air-pollution studies"},
]


def intervention_ledger() -> list[dict]:
    return INTERVENTION_LEDGER

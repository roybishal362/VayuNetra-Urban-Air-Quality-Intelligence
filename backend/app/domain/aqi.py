"""India National AQI (CPCB methodology).

We compute the *official* CPCB sub-index per pollutant and take the maximum — not a
home-grown index. This is what makes the numbers defensible to domain-expert judges.

Reference: CPCB National Air Quality Index (2014), 24-hr breakpoints (8-hr for CO/O3).
Concentrations in µg/m³ except CO which CPCB specifies in mg/m³ (we accept µg/m³ and convert).
"""
from __future__ import annotations

from app.schemas.air import AQIResult, Reading

# (conc_low, conc_high, index_low, index_high) per pollutant
_BREAKPOINTS: dict[str, list[tuple[float, float, int, int]]] = {
    "pm25": [(0, 30, 0, 50), (30, 60, 51, 100), (60, 90, 101, 200),
             (90, 120, 201, 300), (120, 250, 301, 400), (250, 500, 401, 500)],
    "pm10": [(0, 50, 0, 50), (50, 100, 51, 100), (100, 250, 101, 200),
             (250, 350, 201, 300), (350, 430, 301, 400), (430, 600, 401, 500)],
    "no2":  [(0, 40, 0, 50), (40, 80, 51, 100), (80, 180, 101, 200),
             (180, 280, 201, 300), (280, 400, 301, 400), (400, 1000, 401, 500)],
    "so2":  [(0, 40, 0, 50), (40, 80, 51, 100), (80, 380, 101, 200),
             (380, 800, 201, 300), (800, 1600, 301, 400), (1600, 2620, 401, 500)],
    "o3":   [(0, 50, 0, 50), (50, 100, 51, 100), (100, 168, 101, 200),
             (168, 208, 201, 300), (208, 748, 301, 400), (748, 1000, 401, 500)],
    # CO breakpoints below are in mg/m³ (input µg/m³ is divided by 1000 first)
    "co":   [(0, 1.0, 0, 50), (1.0, 2.0, 51, 100), (2.0, 10, 101, 200),
             (10, 17, 201, 300), (17, 34, 301, 400), (34, 50, 401, 500)],
}

_CATEGORIES = [
    (50, "Good", "#55A84F"),
    (100, "Satisfactory", "#A3C853"),
    (200, "Moderate", "#FFF833"),
    (300, "Poor", "#F29C33"),
    (400, "Very Poor", "#E93F33"),
    (500, "Severe", "#AF2D24"),
]

_LABELS = {"pm25": "PM2.5", "pm10": "PM10", "no2": "NO₂", "so2": "SO₂", "o3": "O₃", "co": "CO"}


def _sub_index(pollutant: str, conc: float | None) -> float | None:
    if conc is None or conc < 0:
        return None
    if pollutant == "co":
        conc = conc / 1000.0  # µg/m³ -> mg/m³
    table = _BREAKPOINTS[pollutant]
    if conc >= table[-1][1]:
        return 500.0
    for c_lo, c_hi, i_lo, i_hi in table:
        if c_lo <= conc <= c_hi:
            return (i_hi - i_lo) / (c_hi - c_lo) * (conc - c_lo) + i_lo
    return None


def category_for(aqi: int) -> tuple[str, str]:
    for upper, label, color in _CATEGORIES:
        if aqi <= upper:
            return label, color
    return "Severe", "#AF2D24"


def compute_aqi(reading: Reading) -> AQIResult | None:
    """National AQI = max of available pollutant sub-indices; dominant = the arg-max."""
    subs: dict[str, float] = {}
    for pol in ("pm25", "pm10", "no2", "so2", "o3", "co"):
        s = _sub_index(pol, getattr(reading, pol))
        if s is not None:
            subs[pol] = s
    if not subs:
        return None
    dominant = max(subs, key=subs.get)
    aqi = int(round(subs[dominant]))
    label, color = category_for(aqi)
    return AQIResult(aqi=aqi, category=label, dominant=_LABELS.get(dominant, dominant), color=color)

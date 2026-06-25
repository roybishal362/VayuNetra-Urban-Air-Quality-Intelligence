"""Validate our source attribution against PUBLISHED receptor-model studies.

The brief's #1 evaluation criterion is "attribution accuracy vs ground-truth emission
inventories". We can't run a chemical-transport model, but we CAN hold our city-average
source split up against peer-reviewed / government PM2.5 source-apportionment studies
(PMF / CMB receptor models) and report — honestly — how well we agree, including where we
don't. Ranges below are taken from the cited studies.

Sources of the reference numbers (all public):
  • Delhi   — IIT-Kanpur (2016) CPCB "Comprehensive Study"; Sharma et al. PMF (2016)
  • Kolkata — WBPCB / NEERI Kolkata–Howrah source-apportionment (PMF)
  • Mumbai  — NEERI Mumbai PMF (Mahul / Khar sites)
  • S-India metros — indicative urban reference (city-specific PMF studies are limited)
"""
from __future__ import annotations

from app.ml.attribution import SOURCES
from app.schemas.attribution import ZoneAttribution

# source -> (central %, low %, high %) from the cited studies
REFERENCE: dict[str, dict] = {
    "delhi": {
        "citation": "IIT-Kanpur 2016 (CPCB) + Sharma et al. PMF (2016)",
        "indicative": False,
        "mix": {"vehicular": (20, 18, 25), "industrial": (18, 6, 25),
                "biomass_burning": (15, 12, 26), "dust_construction": (28, 20, 38),
                "secondary": (20, 10, 22)},
    },
    "kolkata": {
        "citation": "WBPCB / NEERI Kolkata–Howrah PMF study",
        "indicative": False,
        "mix": {"vehicular": (22, 18, 26), "industrial": (10, 6, 15),
                "biomass_burning": (38, 30, 42), "dust_construction": (10, 8, 15),
                "secondary": (20, 15, 24)},
    },
    "mumbai": {
        "citation": "NEERI Mumbai PMF (Mahul / Khar)",
        "indicative": False,
        "mix": {"vehicular": (21, 18, 25), "industrial": (20, 15, 27),
                "biomass_burning": (8, 4, 12), "dust_construction": (24, 18, 30),
                "secondary": (19, 15, 22)},
    },
}
# South-Indian metros: city-specific PMF studies are limited, so we compare against an
# indicative vehicular-dominated urban reference and flag it as such (honesty).
_INDICATIVE_SOUTH = {
    "citation": "Indicative urban South-India reference (limited city-specific PMF)",
    "indicative": True,
    "mix": {"vehicular": (32, 25, 40), "industrial": (12, 8, 18),
            "biomass_burning": (8, 4, 14), "dust_construction": (24, 18, 30),
            "secondary": (18, 12, 22)},
}
for _c in ("bengaluru", "chennai", "hyderabad"):
    REFERENCE[_c] = _INDICATIVE_SOUTH


def city_source_mix(attributions: list[ZoneAttribution]) -> dict[str, float]:
    """City-average % per source across all wards (matches the UI's source mix)."""
    agg: dict[str, float] = {}
    for a in attributions:
        for con in a.contributions:
            agg[con.source] = agg.get(con.source, 0.0) + con.pct
    total = sum(agg.values()) or 1.0
    return {k: round(v / total * 100, 1) for k, v in agg.items()}


def validate(city_id: str, attributions: list[ZoneAttribution]) -> dict | None:
    ref = REFERENCE.get(city_id)
    if ref is None or not attributions:
        return None
    ours = city_source_mix(attributions)
    rows, devs, within = [], [], 0
    for src, (central, lo, hi) in ref["mix"].items():
        o = ours.get(src, 0.0)
        ok = lo <= o <= hi
        within += int(ok)
        devs.append(abs(o - central))
        rows.append({
            "source": src, "label": SOURCES[src][0], "color": SOURCES[src][1],
            "ours": round(o, 1), "reference": central, "low": lo, "high": hi, "within": ok,
        })
    n = len(ref["mix"])
    mad = sum(devs) / n if n else 0.0
    agreement = round(max(0.0, 100.0 - 2.0 * mad), 1)   # 2 pts penalty per point of mean deviation
    return {
        "city_id": city_id, "citation": ref["citation"], "indicative": ref["indicative"],
        "agreement_pct": agreement, "within_range": within, "n_sources": n,
        "mean_abs_deviation_pp": round(mad, 1), "rows": rows,
    }

"""Enforcement-prioritisation agent. Deliberately rule-based (auditable) — ranks zones by a
transparent priority score and maps the dominant source to a concrete enforcement action.
An optional LLM call expands a single item into a narrative inspection brief.
"""
from __future__ import annotations

from app.agents.llm import llm
from app.core.logging import get_logger
from app.schemas.attribution import ZoneAttribution
from app.schemas.city import City
from app.schemas.forecast import ZoneForecast
from app.schemas.intelligence import EnforcementItem

log = get_logger("vayunetra.enforcement")

_ACTION = {
    "industrial": "Inspect upwind industrial units for SO₂ / stack-emission compliance; verify scrubber "
                  "and FGD operation logs; issue notices for exceedances.",
    "dust_construction": "Deploy dust-control: water sprinkling, halt non-compliant construction, enforce "
                         "C&D-waste covering and wheel-washing; check anti-smog guns.",
    "biomass_burning": "Coordinate with agriculture / rural authorities on upwind crop-residue burning; "
                       "activate field teams against satellite-flagged hotspots.",
    "vehicular": "Intensify PUC enforcement, deploy on-road emission squads, restrict heavy diesel entry "
                 "and ease congestion in the corridor.",
    "secondary": "Predominantly regional/secondary aerosol — coordinate a multi-district response; "
                 "local point-source enforcement has limited effect.",
}
# how directly enforceable each source is (drives priority)
_ACTIONABILITY = {"industrial": 1.0, "dust_construction": 0.9, "biomass_burning": 0.8,
                  "vehicular": 0.6, "secondary": 0.3}


def _trend(current: int, fc24: int) -> str:
    if fc24 >= current + 10:
        return "rising"
    if fc24 <= current - 10:
        return "falling"
    return "steady"


def build_enforcement(city: City, attributions: list[ZoneAttribution],
                      forecasts: dict[str, ZoneForecast], top_n: int = 6) -> list[EnforcementItem]:
    zmap = {z.id: z for z in city.zones}
    rows: list[EnforcementItem] = []

    for a in attributions:
        zone = zmap.get(a.zone_id)
        if zone is None:
            continue
        fc = forecasts.get(a.zone_id)
        fc24 = next((p.aqi for p in fc.points if p.horizon_h == 24), a.aqi) if fc else a.aqi
        dom = a.contributions[0]
        act = _ACTIONABILITY.get(dom.source, 0.5)

        sev = min(a.aqi, 500) / 500
        worsening = max(0.0, (fc24 - a.aqi)) / 100
        pop, vuln = zone.population or 0, zone.vulnerable_sites or 0
        exposure = min(1.0, (pop / 100_000) * 0.6 + (vuln / 40))
        priority = (0.45 * sev + 0.15 * min(worsening, 1) + 0.25 * act + 0.15 * exposure) * 100

        rows.append(EnforcementItem(
            rank=0, zone_id=a.zone_id, zone_name=a.zone_name, priority=round(priority, 1),
            dominant_source=dom.source, dominant_label=dom.label,
            current_aqi=a.aqi, forecast_aqi_24h=fc24, trend=_trend(a.aqi, fc24),
            population_exposed=pop, vulnerable_sites=vuln,
            recommended_action=_ACTION.get(dom.source, _ACTION["secondary"]),
            evidence=[e.detail for e in a.evidence], confidence=a.overall_confidence,
        ))

    rows.sort(key=lambda r: r.priority, reverse=True)
    for i, r in enumerate(rows[:top_n], start=1):
        r.rank = i
    return rows[:top_n]


def narrative_brief(item: EnforcementItem, city_name: str) -> str:
    """Optional LLM-written inspection brief; deterministic fallback otherwise."""
    if llm.enabled:
        system = ("You write concise, regulator-ready air-quality enforcement briefs for Indian "
                  "pollution-control boards. Be specific and action-oriented; 4-6 sentences.")
        prompt = (f"City: {city_name}. Zone: {item.zone_name}. Current AQI {item.current_aqi}, "
                  f"forecast +24h {item.forecast_aqi_24h} ({item.trend}). Dominant source: "
                  f"{item.dominant_label}. Evidence: {'; '.join(item.evidence)}. Recommended action: "
                  f"{item.recommended_action}. Population exposed ~{item.population_exposed:,}, "
                  f"{item.vulnerable_sites} schools/hospitals. Write the brief.")
        out = llm.generate(system, prompt, max_tokens=500)
        if out:
            return out
    return (f"Priority #{item.rank} — {item.zone_name} ({city_name}). Current AQI {item.current_aqi}, "
            f"forecast +24h {item.forecast_aqi_24h} ({item.trend}). Dominant source: {item.dominant_label} "
            f"(confidence {item.confidence:.0%}). Evidence: {'; '.join(item.evidence)}. "
            f"Recommended action: {item.recommended_action} Exposure: ~{item.population_exposed:,} residents, "
            f"{item.vulnerable_sites} schools/hospitals.")

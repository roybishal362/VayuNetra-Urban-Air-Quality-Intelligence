"""Executive city briefing — Groq-written situation report with a deterministic fallback."""
from __future__ import annotations

from app.agents.llm import llm
from app.schemas.intelligence import CityIntelligence


def city_briefing(intel: CityIntelligence) -> dict:
    top = intel.enforcement[0] if intel.enforcement else None

    if llm.enabled:
        system = (
            "You are an environmental-intelligence analyst briefing a city pollution-control board. "
            "Write a crisp 3-4 sentence situation report: the current state, the lead source and where "
            "to act first, the population at risk, and the forecast outlook. No preamble, no bullets."
        )
        facts = f"City: {intel.city_name}. {intel.summary}"
        if intel.health:
            facts += f" Health: {intel.health.note}"
        if top:
            facts += (f" Top action: {top.zone_name} ({top.dominant_label}, AQI {top.current_aqi}->"
                      f"{top.forecast_aqi_24h}): {top.recommended_action}")
        out = llm.generate(system, facts, max_tokens=320)
        if out:
            return {"generated_by": llm.provider, "briefing": out}

    parts = [intel.summary]
    if intel.health:
        parts.append(intel.health.note)
    if top:
        parts.append(f"Act first in {top.zone_name}: {top.recommended_action}")
    return {"generated_by": "template", "briefing": " ".join(parts)}

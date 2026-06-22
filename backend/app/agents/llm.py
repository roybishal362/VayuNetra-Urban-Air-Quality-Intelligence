"""Thin Anthropic Claude wrapper. Degrades to disabled (returns None) with no key — every
caller has a deterministic fallback, so the platform never depends on the LLM being present.
"""
from __future__ import annotations

import json
import re

from app.core.config import settings
from app.core.logging import get_logger

log = get_logger("vayunetra.llm")


class LLM:
    def __init__(self) -> None:
        self._client = None
        if settings.anthropic_api_key:
            try:
                import anthropic

                self._client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
                log.info("LLM enabled (model=%s)", settings.anthropic_model)
            except Exception as exc:
                log.warning("anthropic init failed (%s); using deterministic fallback", exc)

    @property
    def enabled(self) -> bool:
        return self._client is not None

    def generate(self, system: str, prompt: str, max_tokens: int = 1024,
                 temperature: float = 0.3) -> str | None:
        if self._client is None:
            return None
        try:
            msg = self._client.messages.create(
                model=settings.anthropic_model, max_tokens=max_tokens,
                temperature=temperature, system=system,
                messages=[{"role": "user", "content": prompt}],
            )
            return "".join(b.text for b in msg.content if getattr(b, "type", None) == "text").strip()
        except Exception as exc:
            log.warning("LLM generate failed: %s", exc)
            return None

    def generate_json(self, system: str, prompt: str, max_tokens: int = 1024) -> dict | None:
        txt = self.generate(system + " Respond with ONLY valid minified JSON, no prose.",
                            prompt, max_tokens, temperature=0.2)
        if not txt:
            return None
        try:
            m = re.search(r"\{.*\}", txt, re.S)
            return json.loads(m.group(0) if m else txt)
        except Exception as exc:
            log.warning("LLM JSON parse failed: %s", exc)
            return None


llm = LLM()

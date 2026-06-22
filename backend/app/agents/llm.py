"""LLM gateway. Prefers Groq (OpenAI-compatible, fast/low-cost) -> Anthropic -> disabled.
Every caller has a deterministic fallback, so the platform never depends on an LLM being present.
"""
from __future__ import annotations

import json
import re

import httpx

from app.core.config import settings
from app.core.logging import get_logger

log = get_logger("vayunetra.llm")

_GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"


class LLM:
    def __init__(self) -> None:
        self.provider: str | None = None
        self._anthropic = None

        if settings.groq_api_key:
            self.provider = "groq"
            log.info("LLM: Groq enabled (model=%s)", settings.groq_model)
        elif settings.anthropic_api_key:
            try:
                import anthropic

                self._anthropic = anthropic.Anthropic(api_key=settings.anthropic_api_key)
                self.provider = "anthropic"
                log.info("LLM: Anthropic enabled (model=%s)", settings.anthropic_model)
            except Exception as exc:
                log.warning("anthropic init failed (%s); deterministic fallback active", exc)

    @property
    def enabled(self) -> bool:
        return self.provider is not None

    @property
    def model_name(self) -> str:
        return settings.groq_model if self.provider == "groq" else settings.anthropic_model

    # ---- public API ----
    def generate(self, system: str, prompt: str, max_tokens: int = 1024,
                 temperature: float = 0.3) -> str | None:
        if self.provider == "groq":
            return self._groq(system, prompt, max_tokens, temperature, json_mode=False)
        if self.provider == "anthropic":
            return self._anthropic_gen(system, prompt, max_tokens, temperature)
        return None

    def generate_json(self, system: str, prompt: str, max_tokens: int = 1024) -> dict | None:
        if self.provider == "groq":
            txt = self._groq(system, prompt, max_tokens, 0.2, json_mode=True)
        else:
            txt = self.generate(system + " Respond with ONLY valid minified JSON.", prompt, max_tokens, 0.2)
        if not txt:
            return None
        try:
            m = re.search(r"\{.*\}", txt, re.S)
            return json.loads(m.group(0) if m else txt)
        except Exception as exc:
            log.warning("LLM JSON parse failed: %s", exc)
            return None

    # ---- providers ----
    def _groq(self, system: str, prompt: str, max_tokens: int, temperature: float,
              json_mode: bool) -> str | None:
        payload: dict = {
            "model": settings.groq_model,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": prompt},
            ],
        }
        if json_mode:
            payload["response_format"] = {"type": "json_object"}
        try:
            r = httpx.post(
                _GROQ_URL,
                headers={"Authorization": f"Bearer {settings.groq_api_key}", "Content-Type": "application/json"},
                json=payload,
                timeout=45.0,
            )
            r.raise_for_status()
            return r.json()["choices"][0]["message"]["content"].strip()
        except Exception as exc:
            log.warning("Groq generate failed: %s", exc)
            return None

    def _anthropic_gen(self, system: str, prompt: str, max_tokens: int, temperature: float) -> str | None:
        try:
            msg = self._anthropic.messages.create(
                model=settings.anthropic_model, max_tokens=max_tokens, temperature=temperature,
                system=system, messages=[{"role": "user", "content": prompt}],
            )
            return "".join(b.text for b in msg.content if getattr(b, "type", None) == "text").strip()
        except Exception as exc:
            log.warning("Anthropic generate failed: %s", exc)
            return None


llm = LLM()

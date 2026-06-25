"""LLM gateway. Prefers Groq (OpenAI-compatible, fast/low-cost) -> Anthropic -> disabled.
Every caller has a deterministic fallback, so the platform never depends on an LLM being present.
"""
from __future__ import annotations

import json
import re
import time

import httpx

from app.core.config import settings
from app.core.logging import get_logger

log = get_logger("vayunetra.llm")

_GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

# Circuit breaker: if the LLM keeps failing (bad key, decommissioned model, outage),
# stop calling it for a cooldown and use the deterministic templates. Without this, a
# broken LLM adds a failed round-trip to every advisory on every background refresh.
_FAIL_THRESHOLD = 2
_COOLDOWN_SECONDS = 300.0


class LLM:
    def __init__(self) -> None:
        self.provider: str | None = None
        self._anthropic = None
        self._fails = 0
        self._open_until = 0.0
        self._groq_keys = settings.groq_key_list
        self._key_idx = 0

        if self._groq_keys:
            self.provider = "groq"
            log.info("LLM: Groq enabled (model=%s, keys=%d)", settings.groq_model, len(self._groq_keys))
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

    def _circuit_open(self) -> bool:
        return time.time() < self._open_until

    def _note(self, ok: bool) -> None:
        if ok:
            self._fails = 0
            self._open_until = 0.0
        else:
            self._fails += 1
            if self._fails >= _FAIL_THRESHOLD:
                self._open_until = time.time() + _COOLDOWN_SECONDS
                log.warning("LLM circuit opened for %.0fs after %d consecutive failures "
                            "— using deterministic templates", _COOLDOWN_SECONDS, self._fails)

    # ---- public API ----
    def generate(self, system: str, prompt: str, max_tokens: int = 1024,
                 temperature: float = 0.3) -> str | None:
        if not self.enabled or self._circuit_open():
            return None
        if self.provider == "groq":
            return self._groq(system, prompt, max_tokens, temperature, json_mode=False)
        if self.provider == "anthropic":
            return self._anthropic_gen(system, prompt, max_tokens, temperature)
        return None

    def generate_json(self, system: str, prompt: str, max_tokens: int = 1024) -> dict | None:
        if not self.enabled or self._circuit_open():
            return None
        if self.provider == "groq":
            # Groq's strict JSON mode 400s ("json_validate_failed") for this model and
            # wastes a round-trip. Ask for JSON in the prompt and extract it below — one
            # call, no failures, and the advisories actually use the LLM.
            txt = self._groq(system + " Respond with ONLY valid minified JSON, no prose.",
                             prompt, max_tokens, 0.2, json_mode=False)
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
        # Rotate across the configured keys: on a 429 (rate limit) move to the next account
        # and retry; stick with whichever key works. Only give up once every key fails.
        n = len(self._groq_keys)
        last_exc: Exception | None = None
        for attempt in range(n):
            idx = (self._key_idx + attempt) % n
            try:
                r = httpx.post(
                    _GROQ_URL,
                    headers={"Authorization": f"Bearer {self._groq_keys[idx]}", "Content-Type": "application/json"},
                    json=payload,
                    timeout=15.0,
                )
                if r.status_code == 429:
                    log.warning("Groq key #%d rate-limited (429) — rotating to next key", idx + 1)
                    last_exc = httpx.HTTPStatusError("429", request=r.request, response=r)
                    continue
                if r.status_code >= 400:
                    # surface the reason (e.g. decommissioned model) instead of a bare status
                    log.warning("Groq key #%d HTTP %d: %s", idx + 1, r.status_code, r.text[:200])
                    last_exc = httpx.HTTPStatusError(str(r.status_code), request=r.request, response=r)
                    continue
                r.raise_for_status()
                out = r.json()["choices"][0]["message"]["content"].strip()
                self._key_idx = idx          # sticky: keep using the key that worked
                self._note(True)
                return out
            except Exception as exc:
                last_exc = exc
                continue
        self._note(False)
        log.warning("Groq generate failed on all %d key(s): %s", n, last_exc)
        return None

    def _anthropic_gen(self, system: str, prompt: str, max_tokens: int, temperature: float) -> str | None:
        try:
            msg = self._anthropic.messages.create(
                model=settings.anthropic_model, max_tokens=max_tokens, temperature=temperature,
                system=system, messages=[{"role": "user", "content": prompt}],
            )
            out = "".join(b.text for b in msg.content if getattr(b, "type", None) == "text").strip()
            self._note(True)
            return out
        except Exception as exc:
            self._note(False)
            log.warning("Anthropic generate failed: %s", exc)
            return None


llm = LLM()

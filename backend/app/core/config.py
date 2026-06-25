"""Central configuration. Everything has a safe default so the app boots with zero setup."""
from __future__ import annotations

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# ---- canonical paths -------------------------------------------------------
BACKEND_DIR = Path(__file__).resolve().parents[2]          # .../ET/backend
REPO_DIR = BACKEND_DIR.parent                              # .../ET
DATA_DIR = REPO_DIR / "data"
SNAPSHOT_DIR = DATA_DIR / "snapshots"                      # curated, committed, offline-safe
CACHE_DIR = DATA_DIR / "cache"                             # live pulls (gitignored)
ARTIFACT_DIR = DATA_DIR / "artifacts"                      # trained models / metrics


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(BACKEND_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "VayuNetra"
    environment: str = "dev"

    # --- optional integrations (all degrade gracefully) ---
    # Primary LLM: Groq (OpenAI-compatible, fast + low-cost).
    # Provide ONE key via GROQ_API_KEY, or several (different accounts) via GROQ_API_KEYS
    # = "key1,key2,key3" to multiply the free-tier rate budget — the client rotates across
    # them and fails over on 429.
    groq_api_key: str | None = None
    groq_api_keys: str | None = None
    groq_model: str = "llama-3.3-70b-versatile"
    # Optional Anthropic fallback (used only if no Groq key).
    anthropic_api_key: str | None = None
    anthropic_model: str = "claude-sonnet-4-6"
    openaq_api_key: str | None = None
    firms_map_key: str | None = None
    # Citizen-alert delivery. Telegram is free/live; SMS + WhatsApp go live when a gateway is set.
    telegram_bot_token: str | None = None
    # Twilio (global SMS + WhatsApp). For India SMS you also need a DLT-registered sender.
    twilio_account_sid: str | None = None
    twilio_auth_token: str | None = None
    twilio_from_sms: str | None = None        # e.g. +1XXXXXXXXXX  (or DLT sender for India)
    twilio_from_whatsapp: str | None = None    # e.g. whatsapp:+14155238886

    # --- behaviour ---
    allow_live_fetch: bool = True
    http_timeout_seconds: float = 20.0
    # Public read-only API: allow any origin by default so the Vercel/Render frontend
    # (and Codespaces previews) can call it. Override CORS_ORIGINS in the host env to
    # lock it down to a specific domain. No cookies/credentials are used.
    cors_origins: list[str] = ["*"]
    cors_origin_regex: str | None = None

    @property
    def groq_key_list(self) -> list[str]:
        """All configured Groq keys (GROQ_API_KEYS comma-list + GROQ_API_KEY), de-duped."""
        raw: list[str] = []
        if self.groq_api_keys:
            raw += self.groq_api_keys.split(",")
        if self.groq_api_key:
            raw.append(self.groq_api_key)
        seen: set[str] = set()
        out: list[str] = []
        for k in (s.strip() for s in raw):
            if k and k not in seen:
                seen.add(k)
                out.append(k)
        return out

    @property
    def llm_enabled(self) -> bool:
        return bool(self.groq_key_list or self.anthropic_api_key)


settings = Settings()

# Make sure data dirs always exist (idempotent, cheap).
for _d in (DATA_DIR, SNAPSHOT_DIR, CACHE_DIR, ARTIFACT_DIR):
    _d.mkdir(parents=True, exist_ok=True)

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
    groq_api_key: str | None = None
    groq_model: str = "llama-3.3-70b-versatile"
    # Optional Anthropic fallback (used only if no Groq key).
    anthropic_api_key: str | None = None
    anthropic_model: str = "claude-sonnet-4-6"
    openaq_api_key: str | None = None
    firms_map_key: str | None = None

    # --- behaviour ---
    allow_live_fetch: bool = True
    http_timeout_seconds: float = 20.0
    cors_origins: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]
    # Allow the auto-forwarded GitHub Codespaces UI origin (…-3000.app.github.dev).
    cors_origin_regex: str | None = r"https://.*\.app\.github\.dev"

    @property
    def llm_enabled(self) -> bool:
        return bool(self.groq_api_key or self.anthropic_api_key)


settings = Settings()

# Make sure data dirs always exist (idempotent, cheap).
for _d in (DATA_DIR, SNAPSHOT_DIR, CACHE_DIR, ARTIFACT_DIR):
    _d.mkdir(parents=True, exist_ok=True)

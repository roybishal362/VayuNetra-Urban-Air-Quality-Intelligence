"""Shared resilient HTTP GET (retry with backoff on transient errors)."""
from __future__ import annotations

import httpx
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from app.core.config import settings
from app.core.logging import get_logger

log = get_logger("vayunetra.http")

_HEADERS = {"User-Agent": "VayuNetra/0.1 (ET-AI-Hackathon prototype)"}


class FetchError(RuntimeError):
    """Non-retryable fetch failure (e.g. 4xx) — caller should fall back to cache/snapshot."""


@retry(
    reraise=True,
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=0.6, max=8),
    retry=retry_if_exception_type((httpx.TransportError, httpx.TimeoutException)),
)
def get_json(url: str, params: dict, timeout: float | None = None) -> dict:
    """GET JSON with retries on network/timeout errors. Raises FetchError on HTTP 4xx/5xx."""
    try:
        resp = httpx.get(url, params=params, timeout=timeout or settings.http_timeout_seconds, headers=_HEADERS)
        resp.raise_for_status()
        return resp.json()
    except httpx.HTTPStatusError as exc:
        raise FetchError(f"{url} -> HTTP {exc.response.status_code}") from exc

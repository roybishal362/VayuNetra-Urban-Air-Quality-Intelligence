"""Gzip persistence for observation bundles — curated snapshots (committed) + live cache."""
from __future__ import annotations

import gzip
from datetime import datetime
from pathlib import Path

from app.core.config import CACHE_DIR, SNAPSHOT_DIR
from app.core.logging import get_logger
from app.schemas.observations import CityObservations

log = get_logger("vayunetra.snapshot")


def snapshot_path(city_id: str) -> Path:
    return SNAPSHOT_DIR / f"{city_id}.json.gz"


def cache_path(city_id: str) -> Path:
    return CACHE_DIR / f"{city_id}.json.gz"


def _write(path: Path, obs: CityObservations) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with gzip.open(path, "wt", encoding="utf-8") as f:
        f.write(obs.model_dump_json())


def _read(path: Path) -> CityObservations | None:
    if not path.exists():
        return None
    try:
        with gzip.open(path, "rt", encoding="utf-8") as f:
            return CityObservations.model_validate_json(f.read())
    except Exception as exc:  # corrupt/partial file shouldn't crash the app
        log.warning("failed to read %s: %s", path.name, exc)
        return None


def save_snapshot(obs: CityObservations) -> Path:
    p = snapshot_path(obs.city_id)
    _write(p, obs)
    log.info("snapshot saved: %s", p.name)
    return p


def load_snapshot(city_id: str) -> CityObservations | None:
    return _read(snapshot_path(city_id))


def save_cache(obs: CityObservations) -> None:
    _write(cache_path(obs.city_id), obs)


def load_cache(city_id: str, ttl_seconds: float) -> CityObservations | None:
    p = cache_path(city_id)
    if not p.exists():
        return None
    age = datetime.now().timestamp() - p.stat().st_mtime
    if age > ttl_seconds:
        return None
    return _read(p)

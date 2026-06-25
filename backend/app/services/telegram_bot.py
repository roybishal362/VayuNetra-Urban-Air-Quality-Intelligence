"""Live Telegram bot (@VayuNetraBot) — the citizen "Act" channel.

Commands: /start /help /cities /aqi <city> /subscribe <city> /unsubscribe
Runs as two daemon threads (long-poll for commands + periodic alert broadcaster), started
from main.py when TELEGRAM_BOT_TOKEN is set. Subscribers persist in the gitignored cache dir.
"""
from __future__ import annotations

import json
import threading
import time

import httpx

from app.core.config import CACHE_DIR, settings
from app.core.logging import get_logger
from app.domain.cities import get_city, list_cities
from app.services.notifications import telegram_enabled, telegram_send

log = get_logger("vayunetra.telegram")

_APP_URL = "https://vayu-netra-urban-air-quality-intell.vercel.app"
_SUBS_FILE = CACHE_DIR / "telegram_subscribers.json"
_API = "https://api.telegram.org/bot{token}/getUpdates"
_lock = threading.RLock()
_last_alert: dict[str, float] = {}   # city_id -> epoch of last broadcast (throttle)


# ── subscribers ──────────────────────────────────────────────────────────
def _load() -> dict[str, str]:
    with _lock:
        if _SUBS_FILE.exists():
            try:
                return json.loads(_SUBS_FILE.read_text())
            except Exception:
                return {}
        return {}


def _save(d: dict[str, str]) -> None:
    with _lock:
        _SUBS_FILE.parent.mkdir(parents=True, exist_ok=True)
        _SUBS_FILE.write_text(json.dumps(d))


# ── message composition ──────────────────────────────────────────────────
def _resolve_city(text: str):
    """Match a city by id or name within the message; default to the first city."""
    t = text.lower()
    for c in list_cities():
        if c.id in t or c.name.lower() in t:
            return c
    return None


def _advice_line(aqi: int) -> str:
    if aqi <= 100:
        return "✅ Air is acceptable — normal outdoor activity is fine."
    if aqi <= 200:
        return "🟡 Sensitive groups should limit prolonged outdoor exertion."
    if aqi <= 300:
        return "🟠 Unhealthy — wear an N95 outdoors, run a purifier, limit time outside."
    if aqi <= 400:
        return "🔴 Very unhealthy — stay indoors, N95 essential, seal windows."
    return "🟣 SEVERE — avoid all outdoor exposure; purifier on max; protect children & elderly."


def advisory_text(city_id: str) -> str:
    from app.services.intelligence_service import get_city_intelligence
    intel = get_city_intelligence(city_id)
    h = intel.health
    aqi = h.avg_aqi if h else 0
    worst = max(intel.attributions, key=lambda a: a.aqi) if intel.attributions else None
    # city-wide dominant source
    agg: dict[str, tuple[str, float]] = {}
    for a in intel.attributions:
        for con in a.contributions:
            label, s = agg.get(con.source, (con.label, 0.0))
            agg[con.source] = (label, s + con.pct)
    dom = max(agg.values(), key=lambda x: x[1])[0] if agg else "—"
    name = get_city(city_id).name if get_city(city_id) else city_id
    lines = [
        f"🌫️ <b>VayuNetra — {name}</b>",
        f"Air Quality Index: <b>{aqi}</b> ({h.worst_category if h else '—'})",
    ]
    if worst:
        lines.append(f"Worst area: {worst.zone_name} (AQI {worst.aqi})")
    lines += [f"Main cause: {dom}", "", _advice_line(aqi), "", f"🔗 Live map: {_APP_URL}"]
    return "\n".join(lines)


def _help_text() -> str:
    cities = " ".join(c.id for c in list_cities())
    return (
        "🌬️ <b>VayuNetra</b> — your city's air, with a brain.\n\n"
        "<b>Commands</b>\n"
        "/aqi &lt;city&gt; — current air quality + advice\n"
        "/subscribe &lt;city&gt; — get alerts when air turns unhealthy\n"
        "/unsubscribe — stop alerts\n"
        "/cities — list cities\n\n"
        f"Cities: {cities}\n"
        f"🔗 {_APP_URL}"
    )


# ── command handling ─────────────────────────────────────────────────────
def _handle(update: dict) -> None:
    msg = update.get("message") or update.get("edited_message")
    if not msg or "text" not in msg:
        return
    chat_id = str(msg["chat"]["id"])
    text = msg["text"].strip()
    low = text.lower()

    try:
        if low.startswith("/start") or low.startswith("/help"):
            telegram_send(chat_id, _help_text())
        elif low.startswith("/cities"):
            telegram_send(chat_id, "Cities: " + ", ".join(f"{c.name} (<code>{c.id}</code>)" for c in list_cities()))
        elif low.startswith("/aqi"):
            city = _resolve_city(low) or list_cities()[0]
            telegram_send(chat_id, advisory_text(city.id))
        elif low.startswith("/subscribe"):
            city = _resolve_city(low)
            if not city:
                telegram_send(chat_id, "Which city? e.g. <code>/subscribe delhi</code>")
                return
            subs = _load(); subs[chat_id] = city.id; _save(subs)
            telegram_send(chat_id, f"🔔 Subscribed to <b>{city.name}</b> alerts. Here's the current status:")
            telegram_send(chat_id, advisory_text(city.id))
        elif low.startswith("/unsubscribe"):
            subs = _load()
            if subs.pop(chat_id, None):
                _save(subs)
                telegram_send(chat_id, "🔕 Unsubscribed. Stay safe!")
            else:
                telegram_send(chat_id, "You weren't subscribed.")
        else:
            telegram_send(chat_id, _help_text())
    except Exception as exc:
        log.warning("telegram handle failed: %s", exc)


# ── loops ────────────────────────────────────────────────────────────────
def _poll_loop() -> None:
    offset = 0
    url = _API.format(token=settings.telegram_bot_token)
    log.info("Telegram poller live (@VayuNetraBot)")
    while True:
        try:
            r = httpx.get(url, params={"offset": offset, "timeout": 30}, timeout=40.0)
            for u in r.json().get("result", []):
                offset = u["update_id"] + 1
                _handle(u)
        except Exception as exc:
            log.warning("telegram poll error: %s", exc)
            time.sleep(5)


def _broadcast_loop() -> None:
    from app.services.intelligence_service import get_city_intelligence
    while True:
        time.sleep(1800)  # every 30 min
        subs = _load()
        by_city: dict[str, list[str]] = {}
        for chat, city_id in subs.items():
            by_city.setdefault(city_id, []).append(chat)
        for city_id, chats in by_city.items():
            try:
                intel = get_city_intelligence(city_id)
                aqi = intel.health.avg_aqi if intel.health else 0
                if aqi < 200:                      # only alert on Poor-or-worse
                    continue
                if time.time() - _last_alert.get(city_id, 0) < 3 * 3600:  # throttle 3h
                    continue
                _last_alert[city_id] = time.time()
                msg = "⚠️ <b>Air quality alert</b>\n\n" + advisory_text(city_id)
                for chat in chats:
                    telegram_send(chat, msg)
            except Exception as exc:
                log.warning("broadcast failed for %s: %s", city_id, exc)


def start() -> None:
    if not telegram_enabled():
        log.info("Telegram disabled (no TELEGRAM_BOT_TOKEN)")
        return
    threading.Thread(target=_poll_loop, daemon=True, name="tg-poll").start()
    threading.Thread(target=_broadcast_loop, daemon=True, name="tg-broadcast").start()

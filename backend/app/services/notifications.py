"""Pluggable citizen-alert delivery.

Channel-agnostic by design: Telegram is live now (free, open); SMS / WhatsApp / IVR are
ready to drop in behind the same `send()` call once a paid gateway key (MSG91, Gupshup,
Twilio) is configured. So "Act → reach the citizen" isn't locked to one vendor.
"""
from __future__ import annotations

import httpx

from app.core.config import settings
from app.core.logging import get_logger

log = get_logger("vayunetra.notify")
_TG = "https://api.telegram.org/bot{token}/{method}"


def telegram_enabled() -> bool:
    return bool(settings.telegram_bot_token)


def telegram_send(chat_id: int | str, text: str) -> bool:
    if not telegram_enabled():
        return False
    try:
        r = httpx.post(
            _TG.format(token=settings.telegram_bot_token, method="sendMessage"),
            json={"chat_id": chat_id, "text": text, "parse_mode": "HTML",
                  "disable_web_page_preview": True},
            timeout=15.0,
        )
        return r.status_code == 200
    except Exception as exc:
        log.warning("telegram send failed: %s", exc)
        return False


def send(channel: str, to: str | int, text: str) -> bool:
    """Single entry point. Add SMS/WhatsApp adapters here when a gateway key is available."""
    if channel == "telegram":
        return telegram_send(to, text)
    # if channel == "sms":      return sms_send(to, text)       # plug MSG91 / Twilio (DLT-registered)
    # if channel == "whatsapp": return whatsapp_send(to, text)  # plug WhatsApp Business API
    log.warning("channel '%s' not configured", channel)
    return False

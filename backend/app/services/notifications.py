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


def _twilio_send(to: str, text: str, from_: str | None, prefix: str = "") -> bool:
    """Real Twilio send (SMS or WhatsApp). Live the moment TWILIO_* are set; otherwise a no-op."""
    sid, token = settings.twilio_account_sid, settings.twilio_auth_token
    if not (sid and token and from_):
        return False
    try:
        r = httpx.post(
            f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json",
            auth=(sid, token),
            data={"From": from_, "To": f"{prefix}{to}", "Body": text},
            timeout=15.0,
        )
        return r.status_code in (200, 201)
    except Exception as exc:
        log.warning("twilio send failed: %s", exc)
        return False


def sms_enabled() -> bool:
    return bool(settings.twilio_account_sid and settings.twilio_auth_token and settings.twilio_from_sms)


def send(channel: str, to: str | int, text: str) -> bool:
    """Single, channel-agnostic entry point. Telegram is live free; SMS/WhatsApp go live with a
    Twilio (or MSG91) key — for India SMS a DLT-registered sender ID is also required by TRAI."""
    if channel == "telegram":
        return telegram_send(to, text)
    if channel == "sms":
        return _twilio_send(str(to), text, settings.twilio_from_sms)
    if channel == "whatsapp":
        return _twilio_send(str(to), text, settings.twilio_from_whatsapp, prefix="whatsapp:")
    log.warning("channel '%s' not configured", channel)
    return False

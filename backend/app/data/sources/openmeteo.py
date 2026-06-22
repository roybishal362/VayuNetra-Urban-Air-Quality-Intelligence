"""Open-Meteo client — REAL, keyless air-quality (CAMS) + weather.

Air quality: https://air-quality-api.open-meteo.com  (PM2.5/PM10/NO2/SO2/O3/CO, µg/m³)
Weather:     https://api.open-meteo.com               (temp/humidity/wind/precip/BLH)
Both expose `past_days` (history for training) and `forecast_days` (future).
"""
from __future__ import annotations

from datetime import datetime

from app.core.logging import get_logger
from app.data.http import get_json
from app.schemas.air import Reading, WeatherPoint

log = get_logger("vayunetra.openmeteo")

AQ_URL = "https://air-quality-api.open-meteo.com/v1/air-quality"
WX_URL = "https://api.open-meteo.com/v1/forecast"

_AQ_MAP = {
    "pm2_5": "pm25", "pm10": "pm10", "nitrogen_dioxide": "no2",
    "sulphur_dioxide": "so2", "ozone": "o3", "carbon_monoxide": "co",
}
_WX_MAP = {
    "temperature_2m": "temp_c", "relative_humidity_2m": "humidity",
    "wind_speed_10m": "wind_speed", "wind_direction_10m": "wind_dir",
    "precipitation": "precip", "boundary_layer_height": "blh",
}


def _parse_hourly(data: dict, mapping: dict[str, str], model_cls):
    hourly = data.get("hourly") or {}
    times = hourly.get("time") or []
    rows = []
    for i, t in enumerate(times):
        kwargs: dict = {"ts": datetime.fromisoformat(t)}
        for src, dst in mapping.items():
            vals = hourly.get(src)
            kwargs[dst] = vals[i] if (vals is not None and i < len(vals)) else None
        rows.append(model_cls(**kwargs))
    return rows


def fetch_air_quality(lat: float, lon: float, past_days: int = 30,
                      forecast_days: int = 5, timezone: str = "Asia/Kolkata") -> list[Reading]:
    params = {
        "latitude": lat, "longitude": lon,
        "hourly": ",".join(_AQ_MAP.keys()),
        "past_days": past_days, "forecast_days": forecast_days, "timezone": timezone,
    }
    return _parse_hourly(get_json(AQ_URL, params), _AQ_MAP, Reading)


def fetch_weather(lat: float, lon: float, past_days: int = 30,
                  forecast_days: int = 5, timezone: str = "Asia/Kolkata") -> list[WeatherPoint]:
    params = {
        "latitude": lat, "longitude": lon,
        "hourly": ",".join(_WX_MAP.keys()),
        "past_days": past_days, "forecast_days": forecast_days, "timezone": timezone,
        "wind_speed_unit": "ms",
    }
    return _parse_hourly(get_json(WX_URL, params), _WX_MAP, WeatherPoint)

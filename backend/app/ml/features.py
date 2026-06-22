"""Feature engineering for PM2.5 forecasting.

Design choice: the SAME row-builder (`_supervised`) is used for both training and
inference, so there is zero train/serve skew. Features available at issue time t0:
  - PM2.5 lags + rolling means (autocorrelation)
  - current values of the other pollutants + current weather
  - the WEATHER FORECAST at target time t0+h (legitimately known ahead of time)
  - cyclic temporal encodings of the target hour
  - location (lat/lon) so one pooled model serves every zone
  - horizon h itself, so one model covers all lead times
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from app.schemas.city import City
from app.schemas.observations import CityObservations, ZoneSeries

POLLUTANTS = ["pm25", "pm10", "no2", "so2", "o3", "co"]
WEATHER = ["temp_c", "humidity", "wind_speed", "wind_dir", "precip", "blh"]
LAGS = [1, 3, 6, 12, 24, 48]
HORIZONS = [6, 12, 24, 48, 72, 96, 120]
EVAL_HORIZONS = [24, 48, 72]

_CUR_COLS = (
    ["pm25"] + [f"pm25_lag{l}" for l in LAGS] + ["pm25_roll6", "pm25_roll24"]
    + ["pm10", "no2", "so2", "o3", "co"] + WEATHER
)
_NON_FEATURE = {"y", "target_ts", "zone_id", "issue_ts", "persist_diurnal"}


def build_zone_frame(zs: ZoneSeries) -> pd.DataFrame:
    """Hourly-indexed frame of pollutants + weather for one zone."""
    rd = pd.DataFrame([r.model_dump() for r in zs.readings])
    wx = pd.DataFrame([w.model_dump() for w in zs.weather])
    rd["ts"] = pd.to_datetime(rd["ts"])
    wx["ts"] = pd.to_datetime(wx["ts"])
    df = pd.merge(rd, wx, on="ts", how="outer").sort_values("ts").set_index("ts")
    return df


def _add_lags(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    for lag in LAGS:
        df[f"pm25_lag{lag}"] = df["pm25"].shift(lag)
    df["pm25_roll6"] = df["pm25"].rolling(6, min_periods=1).mean()
    df["pm25_roll24"] = df["pm25"].rolling(24, min_periods=1).mean()
    return df


def _supervised(dfl: pd.DataFrame, lat: float, lon: float, zone_id: str, h: int) -> pd.DataFrame:
    cur = dfl[_CUR_COLS].add_prefix("cur_")
    tgt = dfl[WEATHER].shift(-h).add_prefix("tgt_")
    y = dfl["pm25"].shift(-h).rename("y")
    target_ts = pd.Series(dfl.index, index=dfl.index).shift(-h).rename("target_ts")

    out = pd.concat([cur, tgt, y, target_ts], axis=1)
    out["cur_wind_sin"] = np.sin(np.radians(out["cur_wind_dir"]))
    out["cur_wind_cos"] = np.cos(np.radians(out["cur_wind_dir"]))
    out["tgt_wind_sin"] = np.sin(np.radians(out["tgt_wind_dir"]))
    out["tgt_wind_cos"] = np.cos(np.radians(out["tgt_wind_dir"]))
    out = out.drop(columns=["cur_wind_dir", "tgt_wind_dir"])

    tt = pd.to_datetime(out["target_ts"])
    out["tgt_hour_sin"] = np.sin(2 * np.pi * tt.dt.hour / 24)
    out["tgt_hour_cos"] = np.cos(2 * np.pi * tt.dt.hour / 24)
    out["tgt_dow"] = tt.dt.dayofweek.astype(float)
    out["tgt_is_weekend"] = (tt.dt.dayofweek >= 5).astype(float)
    out["tgt_month"] = tt.dt.month.astype(float)

    out["lat"] = lat
    out["lon"] = lon
    out["horizon_h"] = float(h)
    out["zone_id"] = zone_id
    out["issue_ts"] = out.index
    # Baseline: PM2.5 at the same hour the previous day relative to target (diurnal persistence).
    out["persist_diurnal"] = dfl["pm25"].shift(-(h - 24))
    return out


def feature_columns(df: pd.DataFrame) -> list[str]:
    return [c for c in df.columns if c not in _NON_FEATURE]


def build_training_table(obs: CityObservations, city: City, horizons=HORIZONS) -> pd.DataFrame:
    """Pooled supervised table across all zones; only rows whose target is OBSERVED (<= now_ts)."""
    zmap = {z.id: z for z in city.zones}
    parts: list[pd.DataFrame] = []
    for zs in obs.zones:
        z = zmap.get(zs.zone_id)
        if z is None:
            continue
        dfl = _add_lags(build_zone_frame(zs))
        for h in horizons:
            parts.append(_supervised(dfl, z.center.lat, z.center.lon, zs.zone_id, h))
    full = pd.concat(parts, axis=0)
    now = pd.to_datetime(obs.now_ts)
    mask = (
        full["y"].notna()
        & (pd.to_datetime(full["target_ts"]) <= now)
        & (pd.to_datetime(full["issue_ts"]) <= now)
    )
    return full[mask].reset_index(drop=True)


def build_inference_rows(obs: CityObservations, city: City, zone_id: str,
                         issue_ts, horizons) -> pd.DataFrame:
    """Feature rows for a single issue time across horizons (targets may be in the forecast region)."""
    z = {zz.id: zz for zz in city.zones}[zone_id]
    zs = obs.zone(zone_id)
    if zs is None:
        return pd.DataFrame()
    dfl = _add_lags(build_zone_frame(zs))
    issue = pd.to_datetime(issue_ts)
    parts = [_supervised(dfl, z.center.lat, z.center.lon, zone_id, h) for h in horizons]
    big = pd.concat(parts, axis=0)
    sel = big[pd.to_datetime(big["issue_ts"]) == issue].sort_values("horizon_h")
    return sel

"""Live Open-Meteo connectivity + parse check (also tells us if this network allows egress)."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.data.sources.openmeteo import fetch_air_quality, fetch_weather
from app.domain.aqi import compute_aqi
from app.domain.cities import get_city


def main() -> None:
    city = get_city("delhi")
    z = city.zones[0]  # Anand Vihar
    print(f"Pulling Open-Meteo for {z.name} ({z.center.lat},{z.center.lon}) ...")

    aq = fetch_air_quality(z.center.lat, z.center.lon, past_days=7, forecast_days=3)
    wx = fetch_weather(z.center.lat, z.center.lon, past_days=7, forecast_days=3)
    print(f"AQ rows: {len(aq)}   WX rows: {len(wx)}")

    pm = [r.pm25 for r in aq if r.pm25 is not None]
    print(f"PM2.5 range: {min(pm):.1f} .. {max(pm):.1f} µg/m³  (n={len(pm)})")

    last = next((r for r in reversed(aq) if r.pm25 is not None), None)
    if last:
        res = compute_aqi(last)
        print(f"Latest {last.ts}: PM2.5={last.pm25} -> AQI {res.aqi} {res.category} (dom {res.dominant})")

    w = next((p for p in reversed(wx) if p.wind_speed is not None), None)
    if w:
        print(f"Latest wx {w.ts}: temp={w.temp_c}C wind={w.wind_speed}m/s dir={w.wind_dir} blh={w.blh}")
    print("LIVE-OK")


if __name__ == "__main__":
    main()

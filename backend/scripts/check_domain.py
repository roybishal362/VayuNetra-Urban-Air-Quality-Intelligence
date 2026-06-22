"""Quick domain-layer sanity check (run directly: python backend/scripts/check_domain.py)."""
import datetime
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))  # add backend/ to path

from app.domain.aqi import compute_aqi
from app.domain.cities import list_cities
from app.schemas.air import Reading
from app.schemas.geo import LatLon, bearing_deg, haversine_km


def main() -> None:
    print("cities:", [(c.id, c.name, len(c.zones)) for c in list_cities()])

    dirty = Reading(ts=datetime.datetime.now(), pm25=185.0, pm10=320.0, no2=70, so2=20, o3=40, co=1500)
    res = compute_aqi(dirty)
    print(f"dirty -> AQI {res.aqi} {res.category} (dominant {res.dominant}) {res.color}")

    clean = compute_aqi(Reading(ts=datetime.datetime.now(), pm25=22))
    print(f"clean -> AQI {clean.aqi} {clean.category}")

    a, b = LatLon(lat=28.6469, lon=77.3154), LatLon(lat=28.6286, lon=77.2410)
    print(f"geo: Anand Vihar->ITO {haversine_km(a, b):.1f} km, bearing {bearing_deg(a, b):.0f} deg")

    assert res.aqi == 350 and res.category == "Very Poor", "AQI math regression"
    assert clean.category == "Good", "AQI math regression"
    print("OK")


if __name__ == "__main__":
    main()

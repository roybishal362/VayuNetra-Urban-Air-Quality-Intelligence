"""City registry. Zone centers are REAL CPCB CAAQMS station localities — they double as
the sampling points for live Open-Meteo pulls. Population / vulnerable-site counts are
approximate (catchment-level) and used only for exposure weighting in advisories.
"""
from __future__ import annotations

from app.schemas.city import City, Zone
from app.schemas.geo import BBox, LatLon


def _z(zid: str, name: str, lat: float, lon: float, pop: int, vuln: int) -> Zone:
    return Zone(id=zid, name=name, center=LatLon(lat=lat, lon=lon), population=pop, vulnerable_sites=vuln)


DELHI = City(
    id="delhi",
    name="Delhi",
    state="NCT of Delhi",
    timezone="Asia/Kolkata",
    center=LatLon(lat=28.6139, lon=77.2090),
    bbox=BBox(min_lat=28.40, min_lon=76.84, max_lat=28.88, max_lon=77.40),
    grid_step_km=2.0,
    zones=[
        _z("anand_vihar", "Anand Vihar", 28.6469, 77.3154, 310000, 41),
        _z("ito", "ITO", 28.6286, 77.2410, 180000, 33),
        _z("punjabi_bagh", "Punjabi Bagh", 28.6740, 77.1310, 250000, 37),
        _z("rk_puram", "R.K. Puram", 28.5632, 77.1869, 220000, 29),
        _z("dwarka", "Dwarka Sector 8", 28.5710, 77.0719, 290000, 45),
        _z("rohini", "Rohini", 28.7325, 77.1199, 340000, 52),
        _z("jahangirpuri", "Jahangirpuri", 28.7327, 77.1726, 270000, 31),
        _z("wazirpur", "Wazirpur", 28.6998, 77.1654, 210000, 26),
        _z("bawana", "Bawana", 28.7762, 77.0510, 190000, 22),
        _z("mundka", "Mundka", 28.6843, 77.0769, 160000, 18),
        _z("najafgarh", "Najafgarh", 28.6100, 76.9855, 230000, 28),
        _z("ashok_vihar", "Ashok Vihar", 28.6952, 77.1822, 200000, 30),
    ],
)

BENGALURU = City(
    id="bengaluru",
    name="Bengaluru",
    state="Karnataka",
    timezone="Asia/Kolkata",
    center=LatLon(lat=12.9716, lon=77.5946),
    bbox=BBox(min_lat=12.83, min_lon=77.45, max_lat=13.14, max_lon=77.78),
    grid_step_km=2.0,
    zones=[
        _z("silk_board", "Silk Board", 12.9177, 77.6233, 260000, 34),
        _z("btm", "BTM Layout", 12.9135, 77.6101, 240000, 38),
        _z("hebbal", "Hebbal", 13.0358, 77.5970, 200000, 27),
        _z("hombegowda", "Hombegowda Nagar", 12.9387, 77.5950, 150000, 21),
        _z("jayanagar", "Jayanagar 5th Block", 12.9200, 77.5838, 180000, 33),
        _z("city_rly", "City Railway Station", 12.9783, 77.5712, 170000, 24),
        _z("peenya", "Peenya", 13.0274, 77.5194, 220000, 19),
        _z("bapuji", "Bapuji Nagar", 12.9520, 77.5390, 160000, 23),
        _z("kadabesanahalli", "Kadabesanahalli", 12.9357, 77.6845, 210000, 29),
        _z("saneguruji", "Sanegurava Halli", 12.9907, 77.5520, 140000, 20),
    ],
)

CITIES: dict[str, City] = {c.id: c for c in (DELHI, BENGALURU)}


def list_cities() -> list[City]:
    return list(CITIES.values())


def get_city(city_id: str) -> City | None:
    return CITIES.get(city_id)

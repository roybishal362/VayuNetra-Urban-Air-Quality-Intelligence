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
    languages=["en", "hi", "pa", "ur"],
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
    languages=["en", "kn", "ta", "hi"],
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

MUMBAI = City(
    id="mumbai", name="Mumbai", state="Maharashtra", timezone="Asia/Kolkata",
    center=LatLon(lat=19.0760, lon=72.8777),
    bbox=BBox(min_lat=18.89, min_lon=72.77, max_lat=19.27, max_lon=72.99),
    grid_step_km=2.0, languages=["en", "mr", "hi", "ur"],
    zones=[
        _z("bkc", "Bandra-Kurla Complex", 19.0660, 72.8690, 240000, 36),
        _z("worli", "Worli", 19.0176, 72.8158, 210000, 30),
        _z("andheri", "Andheri", 19.1197, 72.8468, 320000, 44),
        _z("borivali", "Borivali", 19.2307, 72.8567, 300000, 41),
        _z("sion", "Sion", 19.0410, 72.8650, 200000, 28),
        _z("colaba", "Colaba", 18.9100, 72.8146, 150000, 22),
        _z("chembur", "Chembur", 19.0560, 72.9000, 260000, 33),
        _z("malad", "Malad", 19.1860, 72.8480, 290000, 38),
        _z("powai", "Powai", 19.1170, 72.9050, 180000, 26),
        _z("mazgaon", "Mazgaon", 18.9690, 72.8440, 170000, 24),
    ],
)

KOLKATA = City(
    id="kolkata", name="Kolkata", state="West Bengal", timezone="Asia/Kolkata",
    center=LatLon(lat=22.5726, lon=88.3639),
    bbox=BBox(min_lat=22.44, min_lon=88.26, max_lat=22.72, max_lon=88.46),
    grid_step_km=2.0, languages=["en", "bn", "hi", "ur"],
    zones=[
        _z("victoria", "Victoria", 22.5450, 88.3420, 190000, 27),
        _z("rabindra_bharati", "Rabindra Bharati", 22.6280, 88.3780, 220000, 31),
        _z("ballygunge", "Ballygunge", 22.5290, 88.3650, 210000, 33),
        _z("jadavpur", "Jadavpur", 22.4990, 88.3710, 230000, 35),
        _z("fort_william", "Fort William", 22.5550, 88.3400, 120000, 18),
        _z("bidhannagar", "Bidhannagar", 22.5860, 88.4100, 250000, 37),
        _z("rabindra_sarobar", "Rabindra Sarobar", 22.5110, 88.3610, 180000, 25),
        _z("cossipore", "Cossipore", 22.6100, 88.3700, 200000, 23),
        _z("howrah", "Howrah", 22.5900, 88.3100, 270000, 29),
    ],
)

CHENNAI = City(
    id="chennai", name="Chennai", state="Tamil Nadu", timezone="Asia/Kolkata",
    center=LatLon(lat=13.0827, lon=80.2707),
    bbox=BBox(min_lat=12.92, min_lon=80.12, max_lat=13.24, max_lon=80.33),
    grid_step_km=2.0, languages=["en", "ta", "hi", "te"],
    zones=[
        _z("alandur", "Alandur", 13.0040, 80.2010, 210000, 30),
        _z("manali", "Manali", 13.1640, 80.2600, 180000, 19),
        _z("velachery", "Velachery", 12.9790, 80.2210, 240000, 34),
        _z("arumbakkam", "Arumbakkam", 13.0730, 80.2100, 200000, 28),
        _z("royapuram", "Royapuram", 13.1130, 80.2950, 170000, 24),
        _z("kodungaiyur", "Kodungaiyur", 13.1290, 80.2480, 220000, 26),
        _z("perungudi", "Perungudi", 12.9650, 80.2420, 190000, 29),
        _z("nungambakkam", "Nungambakkam", 13.0600, 80.2420, 160000, 27),
        _z("madhavaram", "Madhavaram", 13.1480, 80.2310, 150000, 18),
    ],
)

HYDERABAD = City(
    id="hyderabad", name="Hyderabad", state="Telangana", timezone="Asia/Kolkata",
    center=LatLon(lat=17.3850, lon=78.4867),
    bbox=BBox(min_lat=17.22, min_lon=78.24, max_lat=17.56, max_lon=78.64),
    grid_step_km=2.0, languages=["en", "te", "hi", "ur"],
    zones=[
        _z("sanathnagar", "Sanathnagar", 17.4530, 78.4400, 230000, 31),
        _z("bollaram", "Bollaram", 17.5340, 78.3580, 160000, 17),
        _z("zoo_park", "Zoo Park", 17.3490, 78.4510, 180000, 25),
        _z("central_univ", "Central University", 17.4600, 78.3340, 140000, 20),
        _z("nacharam", "Nacharam", 17.4290, 78.5560, 200000, 22),
        _z("somajiguda", "Somajiguda", 17.4250, 78.4600, 190000, 29),
        _z("patancheru", "Patancheru", 17.5070, 78.2720, 170000, 16),
        _z("kokapet", "Kokapet", 17.4170, 78.3300, 150000, 21),
        _z("uppal", "Uppal", 17.4010, 78.5590, 175000, 23),
    ],
)

CITIES: dict[str, City] = {
    c.id: c for c in (DELHI, MUMBAI, BENGALURU, KOLKATA, CHENNAI, HYDERABAD)
}


def list_cities() -> list[City]:
    return list(CITIES.values())


def get_city(city_id: str) -> City | None:
    return CITIES.get(city_id)

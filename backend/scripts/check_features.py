"""Exercise the new features: health, alerts, land-use, history, what-if, briefing."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient

from app.main import app

c = TestClient(app)


def main() -> None:
    intel = c.get("/api/cities/delhi/intelligence").json()
    print("health      :", intel.get("health"))
    print("alerts      :", len(intel.get("alerts", [])), "->", [a["message"] for a in intel.get("alerts", [])[:2]])
    lu = intel.get("landuse") or {}
    print("landuse      :", f"industrial={len(lu.get('industrial', []))} roads={len(lu.get('roads', []))}")

    zid = intel["enforcement"][0]["zone_id"]
    h = c.get(f"/api/cities/delhi/zones/{zid}/history?hours=48").json()
    print("history      :", len(h["points"]), "pts; first", h["points"][0] if h["points"] else None)

    s = c.get(f"/api/cities/delhi/zones/{zid}/simulate?source=dust_construction&reduction=0.4").json()
    print("simulate     :", f"PM2.5 {s['original_pm25']}->{s['new_pm25']}, AQI {s['original_aqi']}->{s['new_aqi']} ({s['delta_aqi']})")

    b = c.get("/api/cities/delhi/briefing").json()
    print("briefing     :", b["generated_by"], "-", b["briefing"][:140])
    print("OK")


if __name__ == "__main__":
    main()

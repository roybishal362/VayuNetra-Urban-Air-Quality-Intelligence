"""Exercise every API endpoint (incl. 404s) via TestClient — no server needed."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient

from app.main import app

c = TestClient(app)


def hit(url: str) -> dict | list | None:
    r = c.get(url)
    print(f"  {r.status_code}  {url}")
    return r.json() if r.headers.get("content-type", "").startswith("application/json") else None


def main() -> None:
    assert c.get("/health").status_code == 200
    cities = hit("/api/cities")
    print("    cities:", [x["id"] for x in cities])

    hit("/api/cities/delhi")
    intel = hit("/api/cities/delhi/intelligence")
    print("    summary:", intel["summary"][:90])
    print(f"    forecasts={len(intel['forecasts'])} enforcement={len(intel['enforcement'])} "
          f"advisories={len(intel['advisories'])}")

    g = hit("/api/cities/delhi/grid?layer=current")
    print("    current grid cells:", len(g["cells"]), "sample:", g["cells"][0] if g["cells"] else None)
    gf = hit("/api/cities/delhi/grid?layer=forecast&horizon=48")
    print("    forecast grid cells:", len(gf["cells"]))

    zf = hit("/api/cities/delhi/zones/anand_vihar/forecast?hours=72")
    print("    zone forecast points:", len(zf["points"]))

    zid = intel["enforcement"][0]["zone_id"]
    br = hit(f"/api/cities/delhi/enforcement/{zid}/brief")
    print("    brief:", br["brief"][:90])

    print("  -- error paths --")
    assert c.get("/api/cities/nope").status_code == 404
    hit("/api/cities/nope")
    assert c.get("/api/cities/delhi/zones/nope/forecast").status_code == 404
    hit("/api/cities/delhi/zones/nope/forecast")

    print("ALL OK")


if __name__ == "__main__":
    main()

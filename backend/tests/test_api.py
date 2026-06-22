from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health():
    assert client.get("/health").status_code == 200


def test_cities():
    r = client.get("/api/cities")
    assert r.status_code == 200
    ids = [c["id"] for c in r.json()]
    assert "delhi" in ids and "bengaluru" in ids


def test_unknown_city_404():
    assert client.get("/api/cities/atlantis").status_code == 404


def test_intelligence_bundle():
    r = client.get("/api/cities/delhi/intelligence")
    assert r.status_code == 200
    j = r.json()
    assert j["city_id"] == "delhi"
    assert len(j["attributions"]) == 12
    assert len(j["enforcement"]) >= 1
    assert j["metrics"]["horizons"][0]["improvement_pct"] != 0


def test_grid_has_cells():
    r = client.get("/api/cities/delhi/grid?layer=current")
    assert r.status_code == 200
    assert len(r.json()["cells"]) > 100


def test_unknown_zone_forecast_404():
    assert client.get("/api/cities/delhi/zones/nope/forecast").status_code == 404

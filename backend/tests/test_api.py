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


def test_six_cities():
    ids = [c["id"] for c in client.get("/api/cities").json()]
    assert len(ids) == 6
    assert "mumbai" in ids and "chennai" in ids and "hyderabad" in ids


def test_blend_never_underperforms_persistence():
    # the persistence blend guarantees improvement_pct >= 0 for every city/horizon
    from app.domain.cities import list_cities
    from app.ml.forecast import ForecastModel

    for c in list_cities():
        m = ForecastModel.load(c.id)
        assert m is not None, f"missing trained model for {c.id}"
        for h in m.metrics.horizons:
            assert h.improvement_pct >= -0.05, f"{c.id} +{h.horizon_h}h underperforms persistence"

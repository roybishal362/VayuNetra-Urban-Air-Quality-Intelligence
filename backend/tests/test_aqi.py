import datetime

from app.domain.aqi import category_for, compute_aqi
from app.schemas.air import Reading


def _r(**kw):
    return Reading(ts=datetime.datetime(2026, 1, 1), **kw)


def test_severe_is_high():
    res = compute_aqi(_r(pm25=185, pm10=320))
    assert res is not None
    assert res.aqi >= 300
    assert res.category in ("Very Poor", "Severe")


def test_good_air():
    res = compute_aqi(_r(pm25=20))
    assert res is not None and res.category == "Good" and res.aqi <= 50


def test_empty_reading_is_none():
    assert compute_aqi(_r()) is None


def test_dominant_pollutant_tracked():
    # very high SO2 should dominate
    res = compute_aqi(_r(pm25=10, so2=900))
    assert res is not None and res.dominant == "SO₂"


def test_category_bounds():
    assert category_for(0)[0] == "Good"
    assert category_for(75)[0] == "Satisfactory"
    assert category_for(500)[0] == "Severe"

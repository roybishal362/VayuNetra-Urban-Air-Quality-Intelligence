from app.data.repository import get_city_observations
from app.domain.cities import get_city
from app.ml.attribution import attribute_city


def test_attribution_shape_and_bounds():
    city = get_city("delhi")
    obs = get_city_observations("delhi", mode="snapshot")
    attrs = attribute_city(obs, city)

    assert len(attrs) == len(city.zones)
    a = attrs[0]

    # contributions should partition ~100%
    total = sum(c.pct for c in a.contributions)
    assert 99.0 <= total <= 101.0

    # confidences are valid probabilities
    assert 0.0 <= a.overall_confidence <= 1.0
    for c in a.contributions:
        assert 0.0 <= c.confidence <= 1.0
        assert c.concentration >= 0.0

    # dominant source is the largest contribution
    assert a.dominant_source == max(a.contributions, key=lambda c: c.pct).source

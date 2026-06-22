"""Train + evaluate the PM2.5 forecast model for every city; save artifacts.

Run: backend/.venv/Scripts/python backend/scripts/train_forecast.py
"""
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.logging import configure_logging
from app.data.repository import get_city_observations
from app.domain.cities import list_cities
from app.ml.forecast import ForecastModel


def main() -> None:
    configure_logging()
    for city in list_cities():
        t0 = time.time()
        obs = get_city_observations(city.id, mode="snapshot")
        model = ForecastModel.train(obs, city)
        model.save()

        m = model.metrics
        print(f"\n=== {city.name}: PM2.5 forecast (train={m.n_train}, test={m.n_test}) ===")
        for h in m.horizons:
            print(f"  +{h.horizon_h:>3}h  model RMSE {h.rmse:6.1f}  |  persistence {h.persistence_rmse:6.1f}"
                  f"  ->  {h.improvement_pct:+5.1f}%   (MAE {h.mae:.1f})")
        top = list(m.feature_importance.items())[:6]
        print("  top drivers:", ", ".join(f"{k} {v}" for k, v in top))

        zf = model.predict_zone(obs, city, city.zones[0].id, future_hours=72)
        if len(zf.points) >= 24:
            p = zf.points[23]
            print(f"  sample fcast {city.zones[0].name}: +24h PM2.5 {p.pm25} -> AQI {p.aqi} {p.category}"
                  f"  [{p.pm25_low}-{p.pm25_high}]  ({time.time()-t0:.1f}s)")
    print("\nDONE")


if __name__ == "__main__":
    main()

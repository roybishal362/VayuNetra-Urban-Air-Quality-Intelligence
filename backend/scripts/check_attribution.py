"""Inspect source-attribution output on the committed snapshots."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.data.repository import get_city_observations
from app.domain.cities import get_city
from app.ml.attribution import attribute_city


def main() -> None:
    for cid in ("delhi", "bengaluru"):
        city = get_city(cid)
        obs = get_city_observations(cid, mode="snapshot")
        print(f"\n==== {city.name} attribution (now={obs.now_ts}) ====")
        for a in attribute_city(obs, city)[:5]:
            mix = "  ".join(f"{c.label.split(' / ')[0]} {c.pct:.0f}%" for c in a.contributions[:3])
            print(f"{a.zone_name:20} PM2.5 {a.pm25:6.1f}  AQI {a.aqi:3} {a.category:11} "
                  f"| conf {a.overall_confidence:.2f}  fires↑ {a.fires_upwind}")
            print(f"{'':22}{mix}")
            for e in a.evidence[:3]:
                print(f"{'':22}- {e.signal}: {e.detail}")
    print("\nDONE")


if __name__ == "__main__":
    main()

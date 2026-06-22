"""Regenerate seasonal/regional synthetic fires inside existing snapshots (no Open-Meteo re-pull)."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.logging import configure_logging
from app.data import snapshot
from app.data.sources import firms
from app.domain.cities import list_cities


def main() -> None:
    configure_logging()
    for city in list_cities():
        obs = snapshot.load_snapshot(city.id)
        if obs is None:
            print(f"{city.id}: no snapshot")
            continue
        region = firms.fire_region(city.id, city.bbox)
        month = obs.now_ts.month
        seed = sum(ord(ch) for ch in city.id)
        obs.fires = firms.synthetic_fires(region, obs.now_ts,
                                          firms.synthetic_fire_count(city.id, month), seed=seed)
        snapshot.save_snapshot(obs)
        print(f"{city.name:10} month={month}  fires={len(obs.fires)}")
    print("DONE")


if __name__ == "__main__":
    main()

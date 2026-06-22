"""Pull REAL Open-Meteo data for every zone of every city and write committed snapshots.

Run:  backend/.venv/Scripts/python backend/scripts/build_snapshots.py
This is what makes the demo work fully offline (no live network needed at show time).
"""
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.logging import configure_logging
from app.data.repository import build_snapshot
from app.data.snapshot import snapshot_path
from app.domain.cities import list_cities


def main() -> None:
    configure_logging()
    for city in list_cities():
        t0 = time.time()
        print(f"\n=== {city.name}: pulling {len(city.zones)} zones (real Open-Meteo) ===")
        obs = build_snapshot(city.id)
        p = snapshot_path(city.id)
        n_read = sum(len(z.readings) for z in obs.zones)
        print(
            f"  now_ts={obs.now_ts}  forecast_hours={obs.forecast_hours}\n"
            f"  zones={len(obs.zones)}  readings={n_read}  fires={len(obs.fires)} ({obs.fires[0].source})\n"
            f"  -> {p.name}  {p.stat().st_size / 1e6:.2f} MB  ({time.time() - t0:.1f}s)"
        )
    print("\nDONE")


if __name__ == "__main__":
    main()

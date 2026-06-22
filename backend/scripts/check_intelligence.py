"""End-to-end check of the orchestrator: forecast + attribution + enforcement + advisory."""
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.logging import configure_logging
from app.services.intelligence_service import build_city_intelligence


def main() -> None:
    configure_logging()
    for cid in ("delhi", "bengaluru"):
        t0 = time.time()
        intel = build_city_intelligence(cid, mode="snapshot")
        dt = time.time() - t0
        print(f"\n==== {intel.city_name}  ({dt:.1f}s, data={intel.data_source}) ====")
        print("SUMMARY:", intel.summary)
        print(f"forecasts={len(intel.forecasts)} attributions={len(intel.attributions)} "
              f"enforcement={len(intel.enforcement)} advisories={len(intel.advisories)}")

        print("TOP ENFORCEMENT:")
        for e in intel.enforcement[:3]:
            print(f"  #{e.rank} {e.zone_name:20} pri {e.priority:5.1f} | {e.dominant_label:24} "
                  f"AQI {e.current_aqi}->{e.forecast_aqi_24h} ({e.trend})")

        a = intel.advisories[0]
        print(f"ADVISORY {a.zone_name}: {a.risk_level} risk, peak AQI {a.peak_aqi} ({a.category}) [{a.generated_by}]")
        for lc, txt in a.languages.items():
            print(f"   [{lc}] {txt[:78]}")
    print("\nDONE")


if __name__ == "__main__":
    main()

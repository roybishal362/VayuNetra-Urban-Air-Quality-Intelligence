# VayuNetra — Demo Script (90 seconds) + Judge Q&A

## The one-line hook
> "Every Indian city has the data. None has the intelligence layer. VayuNetra predicts tomorrow's
> air, tells you *which source* is to blame, *which site to inspect*, and warns a school principal
> in their own language — tonight."

## 90-second flow (record this for the demo video)

| Time | Action | Say |
|---|---|---|
| 0:00 | Dashboard open on **Delhi**, heatmap glowing red | "This is Delhi right now — real CAMS data. City-average AQI 478, Severe." |
| 0:12 | Click the **time control → +24h / +48h / +72h** | "Our model forecasts every ward 72 hours out — and beats the persistence baseline by 34%." |
| 0:25 | Click the **R.K. Puram** marker | "Click any of the 12 real CPCB stations…" |
| 0:30 | **Attribution** donut + evidence appears | "No single sensor tells you the source. We fuse chemistry, the PM10:PM2.5 ratio, upwind fires and wind to attribute it — here, dust + biomass, 60% confidence, with the evidence." |
| 0:45 | Scroll to **forecast chart** + **advisory**, switch language tab | "…the 72-hour forecast with uncertainty, and a citizen advisory — in Hindi, Punjabi, Urdu." |
| 1:00 | **Enforcement** tab | "For officials: a ranked inspection queue — severity × trend × source × population. One click writes a regulator-ready brief." |
| 1:15 | **Metrics** tab | "Honest validation: RMSE vs persistence, and the top driver is boundary-layer height — physically correct." |
| 1:25 | Switch city to **Bengaluru** | "Same pipeline, new city, zero code change. Scales to all 900 stations." |

## Judge Q&A — prepared answers

- **"Is this real data?"** Yes — Open-Meteo CAMS air quality + weather, keyless. Snapshots are real
  pulls, committed so the demo can't break on Wi-Fi. Fires use NASA FIRMS (live with a free key;
  we flag when modeled).
- **"How is attribution validated?"** It's a calibrated multi-signal fingerprint, not a chemical
  transport model — we say so. We validate against known episodes and surface confidence; we never
  present a fake precision.
- **"Why should I trust the forecast?"** Temporal hold-out, RMSE vs the standard diurnal-persistence
  baseline: +27–34% (Delhi), ~50% (Bengaluru). The model's top feature is boundary-layer height,
  which is the correct physical driver.
- **"Does it need the cloud / a GPU / API keys?"** No. Runs in GitHub Codespaces or a laptop. The
  LLM advisory is optional — it falls back to templates. Nothing crashes without keys.
- **"What's the business model / buyer?"** Municipal corporations, State Pollution Control Boards,
  CPCB under NCAP. Value = enforcement targeting + statutory citizen advisories + audit trail.
- **"Biggest limitation?"** CAMS is ~10 km, so adjacent wards can share a cell; land-use-regression
  downscaling is the next step. We chose to ship honest numbers over a prettier but faked map.

## Reset between takes
Refresh the page; the backend serves cached intelligence, so every take is identical.

# VayuNetra — Pitch Deck Outline (10–12 slides)

Judging weights: **Innovation 25 · Business Impact 25 · Technical 20 · Scalability 15 · UX 15**

1. **Title** — VayuNetra · *Urban Air Quality Intelligence* · team · "Monitor → Predict → Attribute → Act".
2. **The problem (Business Impact)** — 1.67M premature deaths/yr; 900+ CAAQMS but only 31% of cities
   have actionable response protocols (CAG 2024). *Data exists; the intelligence layer doesn't.*
3. **The gap** — Cities need three things that don't exist together: hyperlocal **forecast**, source
   **attribution**, and enforcement **prioritisation**. Show the 2×2: monitoring vs action.
4. **Solution overview** — one screenshot of the dashboard; the four pillars labelled.
5. **Innovation — source attribution** — the 4-signal fusion diagram; "no single sensor reveals the
   source." This is the moat. Show a real evidence chain + confidence.
6. **Technical — forecasting** — feature design (weather-forecast-at-target, lags, BLH); **RMSE vs
   persistence: +34% / +50%**; top driver = boundary-layer height (physically correct).
7. **Act — enforcement + advisory** — ranked inspection queue + auto-written brief; multilingual
   citizen advisory (Hindi/Kannada/Tamil…). The "so what."
8. **Architecture (Technical)** — the Mermaid diagram from `ARCHITECTURE.md`; real keyless data;
   live→cache→snapshot resilience; runs in Codespaces.
9. **Honesty slide (credibility)** — what's real (CAMS, weather, RMSE) vs modeled (fires w/o key);
   judges reward calibrated honesty.
10. **Scalability** — add a city = one config entry; 900 stations; multi-city demo (Delhi→Bengaluru).
11. **Impact + roadmap** — buyers (municipal corps, SPCBs, CPCB/NCAP); next: LUR downscaling, live
    FIRMS, OpenAQ station truth, WhatsApp advisory push.
12. **Close** — the one-liner + QR to the live Codespace + repo.

### Asset checklist
- [ ] Dashboard screenshot (Delhi heatmap + open zone panel)
- [ ] Attribution close-up (donut + evidence)
- [ ] Metrics screenshot (RMSE table)
- [ ] Architecture diagram (render `ARCHITECTURE.md` mermaid)
- [ ] 90-sec demo video (see `DEMO_SCRIPT.md`)

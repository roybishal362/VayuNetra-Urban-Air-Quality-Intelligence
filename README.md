# 🌬️ VayuNetra — Urban Air Quality Intelligence

> *Every Indian city has the data. None has the intelligence layer.*
> VayuNetra turns 900+ monitoring stations from a **dashboard you watch** into a system that
> **predicts** tomorrow's air, **attributes** it to its real sources, and **acts** — telling
> officials which site to inspect and warning citizens in their own language.

**ET AI Hackathon 2.0 — Problem Statement #5** · Smart Cities / Environmental Intelligence / Geospatial Analytics / Public Health

![VayuNetra dashboard — Delhi AQI heatmap, station markers and enforcement queue](docs/screenshots/dashboard.png)

---

## What it does — *Monitor → Predict → Attribute → Act*

| Pillar | Capability |
|---|---|
| **Monitor** | Live + historical pollutant readings (PM2.5/PM10/NO₂/SO₂/O₃/CO) over a city grid |
| **Predict** ⭐ | 24/48/72-hour PM2.5 forecast, benchmarked **RMSE vs persistence + CAMS baselines** |
| **Attribute** ⭐ | Multi-signal source attribution — *"this ward is 55% stubble-burning, 30% traffic"* — with confidence scores |
| **Act** | Evidence-backed **enforcement priority queue** + **multilingual citizen health advisories** |

Built on **real, free, keyless data** (Open-Meteo CAMS air quality + weather), with curated
offline snapshots so the demo **never depends on a live network**.

---

## ▶️ Run it

### Option A — GitHub Codespaces (recommended on a restricted laptop)
Nothing installs on your machine; the whole stack runs in GitHub's cloud, forwarded to your browser.

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/REPLACE-OWNER/vayunetra?quickstart=1)

1. Push this repo to GitHub (see below), then click the badge **(replace `REPLACE-OWNER`)**.
2. Wait for the container to build (deps install automatically).
3. In the Codespace terminal, start the two services:
   ```bash
   # terminal 1 — API
   backend/.venv/bin/python -m uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port 8000 --reload
   # terminal 2 — UI
   cd frontend && npm run dev
   ```
4. Open the forwarded **port 3000** preview.

### Option B — Local
```powershell
# Backend (Python 3.12+)
py -m venv backend\.venv
backend\.venv\Scripts\python -m pip install -r backend\requirements.txt
backend\.venv\Scripts\python -m uvicorn app.main:app --app-dir backend --port 8000 --reload

# Frontend (Node 20+), in a second terminal
cd frontend; npm install; npm run dev
```
API → http://localhost:8000/health · UI → http://localhost:3000

---

## 🏗️ Architecture

```
Data agents ─┐                                          ┌──────────────┐
 Open-Meteo  │  ┌───────────┐   ┌──────────────────┐   │ Agent layer  │
 (AQ+weather)├─►│ Repository │──►│ ML service        │──►│ (LLM + rules)│
 FIRMS fires │  │ live+cache │   │ • Forecast (HGBR) │   │ • Enforcement│
 OSM sources │  │ +snapshots │   │ • Attribution     │   │ • Advisory   │
─────────────┘  └───────────┘   └──────────────────┘   └──────────────┘
                                          │                     │
                                          ▼                     ▼
                         Next.js + MapLibre + deck.gl dashboard (grid heatmap,
                         time slider, ward drill-down, enforcement queue, advisories)
```

## 🧰 Tech stack
- **Backend:** FastAPI · scikit-learn (`HistGradientBoostingRegressor`) · pandas · httpx
- **Frontend:** Next.js · TypeScript · MapLibre GL · deck.gl · Tailwind
- **Agents/LLM:** Anthropic Claude (optional; deterministic fallback when no key)
- **Data:** Open-Meteo (keyless, real), NASA FIRMS, OpenAQ, OpenStreetMap

## 📦 Project layout
```
backend/    FastAPI app — data ingestion, ML, attribution, agents, API
frontend/   Next.js dashboard  (coming online)
data/       snapshots/ (committed, offline-safe) · cache/ · artifacts/
docs/       architecture, demo script, deck outline
.devcontainer/  Codespaces config
```

## 🔑 Configuration
All integrations are **optional** — copy `backend/.env.example` → `backend/.env` only if you want
live LLM advisories or live API pulls. With no keys, VayuNetra runs on real cached snapshots + a
deterministic generator. **It does not crash without keys.**

---

## ✅ Status — all subsystems built & verified
- Real data ingestion (Open-Meteo CAMS) + committed offline snapshots
- PM2.5 forecasting — **beats persistence baseline +27–50% RMSE**
- Multi-signal **source attribution** (confidence-scored, evidence chain)
- Multilingual **advisory** + auditable **enforcement** agents
- MapLibre dashboard: heatmap · forecast · attribution · advisory · enforcement · metrics
- **12 passing tests** · production build green · runs in Codespaces

## 📚 Docs
[Architecture](docs/ARCHITECTURE.md) · [Demo script](docs/DEMO_SCRIPT.md) · [Deck outline](docs/DECK_OUTLINE.md)

#!/usr/bin/env bash
# Runs once when the Codespace / dev container is created.
set -e

echo "==> [1/3] Backend: creating venv + installing deps"
python -m venv backend/.venv
backend/.venv/bin/python -m pip install --upgrade pip --quiet
backend/.venv/bin/python -m pip install -r backend/requirements.txt

echo "==> [2/3] Seeding forecast models from committed snapshots"
backend/.venv/bin/python backend/scripts/train_forecast.py || echo "  (models will train lazily on first request)"

if [ -d frontend ] && [ -f frontend/package.json ]; then
  echo "==> [3/3] Frontend: npm install"
  (cd frontend && npm install)
else
  echo "==> [3/3] Frontend not present yet — skipping"
fi

echo ""
echo "============================================================"
echo " VayuNetra ready."
echo " API : backend/.venv/bin/python -m uvicorn app.main:app \\"
echo "         --app-dir backend --host 0.0.0.0 --port 8000 --reload"
echo " UI  : (cd frontend && npm run dev)"
echo " Then set frontend NEXT_PUBLIC_API_BASE to the forwarded :8000 URL."
echo "============================================================"

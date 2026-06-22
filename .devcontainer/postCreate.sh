#!/usr/bin/env bash
# Runs once when the Codespace / dev container is created.
set -e

echo "==> [1/2] Backend: creating venv + installing deps"
python -m venv backend/.venv
backend/.venv/bin/python -m pip install --upgrade pip --quiet
backend/.venv/bin/python -m pip install -r backend/requirements.txt

if [ -d frontend ] && [ -f frontend/package.json ]; then
  echo "==> [2/2] Frontend: npm install"
  (cd frontend && npm install)
else
  echo "==> [2/2] Frontend not present yet — skipping (will install once added)"
fi

echo ""
echo "============================================================"
echo " VayuNetra ready."
echo " Start API : backend/.venv/bin/python -m uvicorn app.main:app \\"
echo "               --app-dir backend --host 0.0.0.0 --port 8000 --reload"
echo " Start UI  : (cd frontend && npm run dev)"
echo "============================================================"

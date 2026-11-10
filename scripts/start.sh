#!/usr/bin/env bash
# SpaceFire AI - start backend (8000) and frontend (3000). Usage: scripts/start.sh [--prod]
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f processed/spacefire.db ] || { echo "Database missing. Run scripts/setup.sh first."; exit 1; }
PY=backend/.venv/bin/python
[ -x "$PY" ] || PY=backend/.venv/Scripts/python
(cd backend && PYTHONIOENCODING=utf-8 "../$PY" -m uvicorn app.main:app --host 127.0.0.1 --port 8000) &
BACK=$!
trap 'kill $BACK 2>/dev/null || true' EXIT
echo "Backend PID $BACK on http://127.0.0.1:8000 (API docs: /docs)"
cd frontend
if [ "${1:-}" = "--prod" ]; then npm run build && npx next start --port 3000; else npx next dev --port 3000; fi

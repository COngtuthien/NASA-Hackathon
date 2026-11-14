#!/usr/bin/env bash
# SpaceFire AI - Linux/macOS setup: backend venv + deps, frontend deps, .env, data ingestion.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "== Backend: Python virtual environment"
[ -d backend/.venv ] || python3 -m venv backend/.venv
backend/.venv/bin/python -m pip install --upgrade pip >/dev/null
backend/.venv/bin/python -m pip install -r backend/requirements.txt

echo "== Frontend: npm dependencies"
(cd frontend && npm install)

if [ ! -f .env ]; then cp .env.example .env; echo "== Created .env from .env.example"; fi
grep -Eq '^LLM_API_KEY=\S+' .env || echo "WARNING: LLM_API_KEY is empty: assistant runs in retrieval-only mode (all other features work)."

echo "== Ingesting NASA data (read-only on source folders)"
(cd backend && PYTHONIOENCODING=utf-8 .venv/bin/python -m app.ingest.run)
echo "Setup complete. Start with: scripts/start.sh"

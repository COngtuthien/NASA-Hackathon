# SpaceFire AI - Windows setup: backend venv + deps, frontend deps, .env, data ingestion.
# Usage (from repo root):  powershell -ExecutionPolicy Bypass -File scripts\setup.ps1
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "== Backend: Python virtual environment"
if (-not (Test-Path "backend\.venv")) { python -m venv backend\.venv }
& backend\.venv\Scripts\python -m pip install --upgrade pip | Out-Null
& backend\.venv\Scripts\python -m pip install -r backend\requirements.txt
if ($LASTEXITCODE -ne 0) { throw "pip install failed" }

Write-Host "== Frontend: npm dependencies"
Push-Location frontend
npm install
if ($LASTEXITCODE -ne 0) { Pop-Location; throw "npm install failed" }
Pop-Location

if (-not (Test-Path ".env")) {
  Copy-Item ".env.example" ".env"
  Write-Host "== Created .env from .env.example"
}
$envText = Get-Content ".env" -Raw
if ($envText -notmatch "(?m)^LLM_API_KEY=\S+") {
  Write-Warning "LLM_API_KEY is empty: the assistant will run in retrieval-only mode (all other features work)."
}

Write-Host "== Ingesting NASA data (read-only on source folders)"
Push-Location backend
$env:PYTHONIOENCODING = "utf-8"
& .venv\Scripts\python -m app.ingest.run
$code = $LASTEXITCODE
Pop-Location
if ($code -ne 0) { throw "ingestion failed" }
Write-Host "Setup complete. Start with: powershell -ExecutionPolicy Bypass -File scripts\start.ps1"

# SpaceFire AI - start backend (8000) and frontend (3000) on Windows.
# Usage: powershell -ExecutionPolicy Bypass -File scripts\start.ps1 [-Prod]
param([switch]$Prod)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path "$root\processed\spacefire.db")) { throw "Database missing. Run scripts\setup.ps1 first." }

$env:PYTHONIOENCODING = "utf-8"
$backend = Start-Process -PassThru -NoNewWindow -WorkingDirectory "$root\backend" `
  -FilePath "$root\backend\.venv\Scripts\python.exe" -ArgumentList "-m","uvicorn","app.main:app","--host","127.0.0.1","--port","8000"
Write-Host "Backend PID $($backend.Id) on http://127.0.0.1:8000  (API docs: /docs)"

Push-Location "$root\frontend"
try {
  if ($Prod) { npm run build; npx next start --port 3000 } else { npx next dev --port 3000 }
} finally {
  Pop-Location
  Stop-Process -Id $backend.Id -ErrorAction SilentlyContinue
}

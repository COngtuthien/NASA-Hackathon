import { defineConfig, devices } from "@playwright/test";

// E2E against the real stack: FastAPI (port 8000) + Next.js (port 3000).
// Servers are reused if already running (scripts/start.*), otherwise started here.
// Optional overrides for running beside other local servers: PW_BASE_URL (frontend) and PW_API_PORT (backend).
// Defaults are unchanged. When overriding, start Next with BACKEND_URL pointing at the same API port.
const BASE = process.env.PW_BASE_URL ?? "http://localhost:3000";
const API_PORT = process.env.PW_API_PORT ?? "8000";

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: BASE,
    channel: process.env.PW_CHANNEL ?? "chrome",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } }, testIgnore: /mobile.spec.ts/ },
    { name: "mobile", use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } }, testMatch: /mobile\.spec\.ts/ },
  ],
  webServer: [
    {
      command: process.platform === "win32"
        ? `..\\backend\\.venv\\Scripts\\python -m uvicorn app.main:app --app-dir ../backend --port ${API_PORT}`
        : `../backend/.venv/bin/python -m uvicorn app.main:app --app-dir ../backend --port ${API_PORT}`,
      url: `http://127.0.0.1:${API_PORT}/api/v1/health`,
      reuseExistingServer: true,
      timeout: 120_000,
    },
    { command: "npm run dev", url: BASE, reuseExistingServer: true, timeout: 180_000 },
  ],
});

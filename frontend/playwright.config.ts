import { defineConfig, devices } from "@playwright/test";

// E2E against the real stack: FastAPI (port 8000) + Next.js (port 3000).
// Servers are reused if already running (scripts/start.*), otherwise started here.
export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
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
        ? "..\\backend\\.venv\\Scripts\\python -m uvicorn app.main:app --app-dir ../backend --port 8000"
        : "../backend/.venv/bin/python -m uvicorn app.main:app --app-dir ../backend --port 8000",
      url: "http://127.0.0.1:8000/api/v1/health",
      reuseExistingServer: true,
      timeout: 120_000,
    },
    { command: "npm run dev", url: "http://localhost:3000", reuseExistingServer: true, timeout: 180_000 },
  ],
});

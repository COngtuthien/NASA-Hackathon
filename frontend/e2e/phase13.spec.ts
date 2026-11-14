import { expect, test, type Page } from "@playwright/test";
import { openSection } from "./helpers";

// Phase 13: Gaseous Flame Dynamics (ACME CFI-G / Flame Design / BRE), Smoke & Fire Detection (SAME), PSI-117 on the
// FLEX page, the two new 3D studios, and Copilot retrieval of the new documents. Checks real values and interactions,
// not only HTTP 200. No model request is sent (the backend runs evidence-only).

type Stats = { mounts: number; live: number; disposed: number; camera?: number[] };
const stats = (page: Page) => page.evaluate(() => (window as unknown as { __spacefireLab?: Stats }).__spacefireLab ?? null);
const dist = (c: number[] | undefined) => (c ? Math.hypot(c[0], c[1], c[2]) : 0);
const GAS = "/phenomena/gaseous-flames";
const SMOKE = "/phenomena/smoke-detection";
const FLEX = "/phenomena/flame-extinction";

function consoleErrors(page: Page) {
  const errs: string[] = [];
  page.on("console", (m) => {
    // The Playwright browser adds caret-color styles to inputs, which React reports as a hydration attribute mismatch.
    if (m.type() === "error" && !m.text().includes("caret-color") && !m.text().includes("hydrated but some attributes")) errs.push(m.text());
  });
  page.on("pageerror", (e) => errs.push(String(e)));
  return errs;
}
async function chartReady(page: Page, testid: string) {
  const box = page.getByTestId(testid);
  await box.scrollIntoViewIfNeeded();
  await expect(box.locator(".main-svg").first()).toBeVisible({ timeout: 30_000 });
}
async function openLiteStudio(page: Page, path: string) {
  await page.goto(path);
  const host = page.getByTestId("lite-canvas-host");
  await host.scrollIntoViewIfNeeded();
  await expect(host.locator("canvas")).toBeVisible({ timeout: 60_000 });
  await expect.poll(async () => (await stats(page))?.camera?.length ?? 0, { timeout: 60_000 }).toBe(3);
}

test("navigation lists both new sections and the registry has ten investigations", async ({ page, request }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Main" });
  await expect(nav.getByRole("link", { name: /Gaseous Flame Dynamics/ })).toBeVisible();
  await expect(nav.getByRole("link", { name: /Smoke & Fire Detection/ })).toBeVisible();
  const reg = await (await request.get("/api/v1/registry")).json();
  expect(reg.items.map((i: { investigation_id: string }) => i.investigation_id).sort()).toEqual(
    ["PSI-10", "PSI-102", "PSI-117", "PSI-159", "PSI-20", "PSI-25", "PSI-62", "PSI-68", "PSI-69", "PSI-98"]);
});

test("CFI-G: charts render from data, filters update counts and URL, empty state shows", async ({ page }) => {
  const errs = consoleErrors(page);
  await page.goto(GAS);
  await expect(page.getByTestId("cfig-n")).toHaveText(/n = 333 test points matching of 333/);
  for (const id of ["chart-outcomes-fuel", "chart-normal-inverse", "chart-o2-pressure", "chart-burn-time"]) await chartReady(page, id);
  await page.getByTestId("cfig-filters").getByRole("radio", { name: "Normal" }).click();
  await expect(page.getByTestId("cfig-n")).toHaveText(/n = 179 /);
  await expect(page).toHaveURL(/cfg=normal/);
  await page.getByTestId("cfig-filters").getByRole("radio", { name: "n-Butane" }).click();
  await expect(page.getByTestId("cfig-n")).toHaveText(/n = 82 /);
  await page.getByTestId("cfig-pressure").selectOption("2.03");
  await expect(page.getByTestId("cfig-n")).toHaveText(/n = 17 /);
  await page.goto(`${GAS}?tab=cfig&cfg=inverse&o2min=0.95`);
  await expect(page.getByText("No CFI-G test point matches these conditions")).toBeVisible();
  expect(errs).toEqual([]);
});

test("CFI-G: 15 cool-flame events with footnote, test lookup shows raw values and provenance", async ({ page }) => {
  await page.goto(`${GAS}?tab=cfig`);
  const table = page.getByTestId("cool-flame-table");
  await table.scrollIntoViewIfNeeded();
  await expect(table.locator("tbody tr")).toHaveCount(15);
  await expect(table).not.toContainText("21174D13");
  await expect(table.locator("tbody tr").filter({ hasText: "21174D1" })).toContainText("–");
  await chartReady(page, "chart-cool-radii");
  await openSection(page, "cfig-lookup");
  await page.getByTestId("cfig-test-select").selectOption("21174C3");
  const rec = page.getByTestId("cfig-test-record");
  await expect(rec).toContainText("Experimental table row");
  await expect(rec).toContainText("Final report Table 3 event");
  await expect(rec).toContainText("PSI-159_Experimental table_CFI-G_Normal Flames.csv");
  await expect(rec).toContainText("17.6");
  await openSection(page, "cfig-counts");
  await expect(page.getByTestId("cfig-counts")).toContainText("280");
  await expect(page.getByTestId("cfig-counts")).toContainText("189");
  await openSection(page, "cfig-limits");
  await expect(page.getByTestId("cfig-limitations")).toContainText("CFIG-COLOR-LIMIT-UNDEFINED");
});

test("Flame Design is conditions-only; BRE shows the report day log with CSV conflicts", async ({ page }) => {
  const errs = consoleErrors(page);
  await page.goto(GAS);
  await page.getByTestId("tab-flame-design").click();
  await expect(page).toHaveURL(/tab=flame-design/);
  await expect(page.getByTestId("fd-missing-outcomes")).toContainText("Conditions only");
  await chartReady(page, "chart-fd-conditions");
  const chart = page.getByTestId("chart-fd-conditions");
  await expect(chart).not.toContainText("CFI-G · normal");
  await chart.getByRole("radio", { name: "Add CFI-G conditions" }).click();
  await expect(chart).toContainText("CFI-G · normal");
  await expect(page.getByTestId("fd-findings")).toContainText("1130 K");
  await page.getByTestId("tab-bre").click();
  await expect(page.getByTestId("bre-day-table").locator("tbody tr")).toHaveCount(18);
  await expect(page.getByTestId("bre-day-table")).toContainText("PSI CSV: 2020-10-17");
  await expect(page.getByTestId("bre-limits-callout")).toContainText("not a validated flammability classifier");
  await chartReady(page, "chart-bre-days");
  expect(errs).toEqual([]);
});

test("Smoke & Fire Detection: particle sizes, materials, flight log and deferred telemetry", async ({ page }) => {
  const errs = consoleErrors(page);
  await page.goto(SMOKE);
  await expect(page.getByTestId("same-size-table").locator("tbody tr")).toHaveCount(8);
  await chartReady(page, "chart-same-material");
  await chartReady(page, "chart-same-all");
  await expect(page.getByTestId("smoke-measured")).toContainText("80 nm");
  await page.getByTestId("smoke-controls").getByRole("radio", { name: "Aged 720 s" }).click();
  await expect(page.getByTestId("smoke-measured")).toContainText("155 nm");
  await page.getByTestId("smoke-controls").getByRole("radio", { name: "Teflon" }).click();
  await expect(page.getByTestId("smoke-measured")).toContainText("228 nm");
  await page.getByTestId("smoke-controls").getByRole("radio", { name: "DBP" }).click();
  await expect(page.getByTestId("smoke-measured")).toContainText("no row in Final Science Report Table 1");
  const log = page.getByTestId("same-log-table");
  await log.scrollIntoViewIfNeeded();
  await expect(log.locator("tbody tr")).toHaveCount(51);
  await page.getByTestId("same-log").getByRole("radio", { name: /Kapton \(6\)/ }).click();
  await expect(log.locator("tbody tr")).toHaveCount(6);
  await expect(page.getByTestId("same-telemetry-deferred")).toContainText("not charted");
  expect(errs).toEqual([]);
});

test("FLEX page: PSI-117 model vs experiment charts with distinct labels; existing FLEX analysis intact", async ({ page }) => {
  const errs = consoleErrors(page);
  await page.goto(FLEX);
  await chartReady(page, "psi117-chart");
  const list = page.getByTestId("psi117-series-list");
  await expect(list).toContainText("(experiment,");
  await expect(list).toContainText("(model,");
  await expect(page.getByTestId("psi117-caveat")).toContainText("Not FLEX rows and not 3D CFD");
  await page.getByTestId("psi117-figure").selectOption("3s-d2");
  await expect(page.getByTestId("psi117-chart")).toHaveAttribute("data-figure", "3s-d2");
  await chartReady(page, "psi117-chart");
  await expect(page.getByTestId("psi117-chart")).toContainText("published figure data");
  await expect(page.getByTestId("flex2-context")).toContainText("no FLEX-2 measurements");
  await openSection(page, "map");
  await expect(page.locator("section#map")).toContainText("plotted of");
  expect(errs).toEqual([]);
});

test("Gaseous Flame Studio: modes, measured event, orbit/zoom/reset and fullscreen", async ({ page }) => {
  const errs = consoleErrors(page);
  await openLiteStudio(page, GAS);
  await expect(page.getByTestId("conceptual-notice")).toContainText("Conceptual 3D educational visualization");
  await expect(page.getByTestId("evidence-banner")).toContainText("illustrative");
  const before = dist((await stats(page))!.camera);
  await page.getByTestId("zoom-in").click();
  await expect.poll(async () => dist((await stats(page))!.camera)).toBeLessThan(before - 0.1);
  await page.getByTestId("studio-reset").click();
  await expect.poll(async () => Math.abs(dist((await stats(page))!.camera) - before)).toBeLessThan(0.05);
  const controls = page.getByTestId("gas-controls");
  await controls.getByRole("radio", { name: "Inverse (oxidizer out)" }).click();
  await expect(page.getByTestId("gas-explain")).toContainText("Inverse flame");
  await controls.getByRole("radio", { name: "Cool flame" }).click();
  await expect(page.getByTestId("gas-explain")).toContainText("cool regime");
  await page.getByTestId("gas-compare").check();
  await page.getByTestId("gas-event").selectOption({ label: "21174C3 · hot 17.6 mm · cool 7.6 mm" });
  await expect(page.getByTestId("measured-label")).toContainText("hot 17.6 mm, cool 7.6 mm");
  await expect(page.getByTestId("evidence-banner")).toContainText("Measured (NASA)");
  await expect(page.getByTestId("gas-compare")).toBeDisabled();
  await page.getByTestId("gas-event").selectOption("");
  await expect(page.getByTestId("measured-label")).toHaveCount(0);
  await page.getByTestId("studio-fullscreen").click();
  await expect(page.getByTestId("lite-studio")).not.toHaveAttribute("data-fullscreen", "off");
  await page.getByTestId("studio-fullscreen").click();
  await expect(page.getByTestId("lite-studio")).toHaveAttribute("data-fullscreen", "off");
  await page.getByTestId("static-toggle").click();
  await expect(page.getByTestId("scene-fallback")).toBeVisible();
  expect(errs).toEqual([]);
});

test("Smoke Detection Studio: six stages, labels and scene switching without leaking WebGL contexts", async ({ page }) => {
  const errs = consoleErrors(page);
  await openLiteStudio(page, SMOKE);
  for (let i = 1; i <= 6; i++) {
    await page.getByTestId(`smoke-stage-${i}`).click();
    await expect(page.getByTestId("smoke-stage-text")).toContainText(`Stage ${i}:`);
  }
  await page.getByTestId("smoke-next").click();
  await expect(page.getByTestId("smoke-stage-text")).toContainText("Stage 1:");
  await page.getByTestId("labels-toggle").click();
  await expect(page.getByTestId("labels-toggle")).toHaveAttribute("aria-pressed", "false");
  // switch between the two studio pages client-side: never more than one live canvas
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: /Gaseous Flame Dynamics/ }).click();
  await page.getByTestId("lite-canvas-host").scrollIntoViewIfNeeded();
  await expect(page.getByTestId("lite-canvas-host").locator("canvas")).toBeVisible({ timeout: 60_000 });
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: /Smoke & Fire Detection/ }).click();
  await page.getByTestId("lite-canvas-host").scrollIntoViewIfNeeded();
  await expect(page.getByTestId("lite-canvas-host").locator("canvas")).toBeVisible({ timeout: 60_000 });
  await expect.poll(async () => (await stats(page))?.live ?? 99).toBeLessThanOrEqual(1);
  const s = (await stats(page))!;
  expect(s.disposed).toBeGreaterThanOrEqual(s.mounts - 1);
  expect(errs).toEqual([]);
});

test("light theme keeps the new pages usable", async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.setItem("spacefire:theme", "light"); } catch { /* ignore */ } });
  const errs = consoleErrors(page);
  for (const path of [GAS, SMOKE]) {
    await page.goto(path);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(page.getByTestId("lite-viewport-box")).toHaveClass(/theme-dark/);
    await expect(page.locator("h1")).toBeVisible();
  }
  expect(errs).toEqual([]);
});

test("Copilot retrieves the new NASA documents (evidence-only, no model call)", async ({ request }) => {
  const s = await (await request.get("/api/v1/evidence/search", { params: { q: "spherical cool diffusion flames n-butane radiative extinction", limit: 10 } })).json();
  expect(s.results.some((r: { document_id: string }) => r.document_id === "psi-159-reports-finalrpt-acme-cfi-g")).toBeTruthy();
  const h = await (await request.get("/api/v1/health")).json();
  test.skip(h.llm?.mode !== "retrieval_only", "only run the ask round-trip when the API is evidence-only (no Gemini quota)");
  const a = await (await request.post("/api/v1/assistant/ask", { data: { question: "Under what conditions did CFI-G observe cool diffusion flames?",
    source_scope: "internal", investigations: ["PSI-159"] } })).json();
  expect(a.investigations_detected).toEqual(["PSI-159"]);
  expect(a.citations.some((c: { document_id: string; page_pdf: number }) => c.document_id === "psi-159-reports-finalrpt-acme-cfi-g" && c.page_pdf === 44)).toBeTruthy();
});

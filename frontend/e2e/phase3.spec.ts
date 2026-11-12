import { expect, test } from "@playwright/test";
import { LEGACY } from "../lib/routes";
import { LEGACY_REDIRECTS } from "../next.config";

test.describe("Phase 3: phenomenon-first navigation, motion, preserved functions", () => {
  test.beforeEach(async ({ page }) => {
    page.on("pageerror", (e) => {
      throw new Error(`Uncaught page error: ${e.message}`);
    });
  });

  test("navigation is grouped by research goal, with NASA sources as badges", async ({ page }) => {
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Main" });
    for (const group of ["Discover", "Scientific analysis", "Research intelligence", "Trust & methods"]) {
      await expect(nav.getByText(group, { exact: true })).toBeVisible();
    }
    for (const label of ["Mission Control", "Research Copilot", "Combustion Explorer", "Flame Extinction & Burning Dynamics",
      "Flame Spread & Material Behavior", "Spacecraft Fire Dynamics", "Experiment Intelligence", "Evidence & Literature",
      "Prediction & Modeling", "Data Reliability", "Methodology"]) {
      await expect(nav.getByRole("link", { name: label })).toBeVisible();
    }
    for (const badge of ["FLEX", "BASS-II", "SAFFIRE-I"]) await expect(nav.getByText(badge, { exact: true })).toBeVisible();
  });

  test("legacy URLs redirect to the new routes and keep query strings", async ({ page }) => {
    expect(LEGACY).toEqual(LEGACY_REDIRECTS);
    for (const [from, to] of LEGACY) {
      await page.goto(`${from}?probe=1`);
      await expect.poll(() => new URL(page.url()).pathname + new URL(page.url()).search).toBe(`${to}?probe=1`);
    }
    await page.goto("/quality?severity=critical");
    await expect(page).toHaveURL(/\/reliability\?severity=critical/);
    await expect(page.getByRole("heading", { name: "Data Reliability", level: 1 })).toBeVisible();
  });

  test("Mission Control tells the physics story with NASA document citations and real counts", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/Real flame from NASA.s BASS-II experiment/)).toBeVisible();  // hero says what it shows
    const story = page.locator("#physics");
    await story.scrollIntoViewIfNeeded();
    const cites = story.locator("blockquote a");
    await expect(cites).toHaveCount(4);
    for (const href of await cites.evaluateAll((els) => els.map((e) => e.getAttribute("href")))) {
      expect(href).toMatch(/^\/api\/v1\/documents\/[\w-]+\/file#page=\d+$/);
      const res = await page.request.get(href!.split("#")[0]);
      expect(res.status(), href!).toBe(200);
    }
    const counts = await (await page.request.get("/api/v1/overview")).json();
    await expect(page.getByLabel("What is in the database")).toContainText(String(counts.counts.total_burn_rows));
    await page.locator("#scales").scrollIntoViewIfNeeded();
    await expect(page.locator("#scales article")).toHaveCount(3);
    await page.getByRole("tab", { name: /Compare/ }).click();
    await expect(page.getByRole("tabpanel")).toContainText("Find similar experiments");
  });

  test("phenomenon pages keep their analyses and attribute the NASA investigation", async ({ page }) => {
    await page.goto("/phenomena/flame-extinction");
    await expect(page.getByRole("heading", { name: "Flame Extinction & Burning Dynamics", level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: /Source: NASA FLEX PSI-69/ })).toHaveAttribute("href", /PSI-69/);
    await page.locator("#conditions").getByRole("radio", { name: "Methanol" }).click();   // Phase 7: the 3D studio has its own fuel radio
    await expect(page).toHaveURL(/fuel=Methanol/);
    await expect(page.getByText(/plotted of 157 rows matching filters/)).toBeVisible();
    await page.goto("/phenomena/spacecraft-fire");
    await expect(page.locator("#airflow")).toContainText("Concurrent");
    await expect(page.locator("#airflow")).toContainText("Opposed");
    await expect(page.getByText(/no manifest frame is shown or reconstructed/)).toBeVisible();
  });

  test("hubs keep both workflows reachable", async ({ page }) => {
    await page.goto("/intelligence/similar?uid=flex:145&mode=uid");
    await page.getByRole("link", { name: /Compare side by side/ }).click();
    await expect(page).toHaveURL(/\/intelligence\/compare/);
    await page.goto("/evidence");
    await page.getByRole("link", { name: /External literature/ }).first().click();
    await expect(page).toHaveURL(/\/evidence\/literature/);
  });

  test("reduced motion: content is visible immediately and counters show final values", async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto("/");
    const counts = await (await page.request.get("/api/v1/overview")).json();
    await expect(page.getByLabel("What is in the database").locator("dd").first()).toHaveText(
      new RegExp(String(counts.counts.total_burn_rows).replace(/\B(?=(\d{3})+(?!\d))/g, ",")));
    const loops = await page.evaluate(() => getComputedStyle(document.querySelector(".anim-twinkle")!).animationIterationCount);  // hero star field
    expect(loops).toBe("1");
    await ctx.close();
  });
});

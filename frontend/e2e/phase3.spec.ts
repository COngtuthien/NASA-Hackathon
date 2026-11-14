import { openSection } from "./helpers";
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
    for (const group of ["Discover", "Scientific analysis", "Advanced research tools", "Trust & methods"]) {
      await expect(nav.getByText(group, { exact: true })).toBeVisible();
    }
    for (const label of ["Home", "Research Copilot", "Combustion Explorer", "Flame Extinction & Burning Dynamics",
      "Flame Spread & Material Behavior", "Spacecraft Fire Dynamics", "Experiment Intelligence", "Evidence & Literature",
      "FLEX Burn-Time Estimator", "Data Reliability", "Methodology"]) {
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

  // Phase 8: "Mission Control" became Home, a calm five-section page (the physics story and counters now live on the
  // phenomenon pages and Methodology).
  test("Home is calm: hero, three phenomena, 3D studios, Copilot, trust", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Understanding Fire Beyond Earth", level: 1 })).toBeVisible();
    await expect(page.getByText(/Real flame from NASA.s BASS-II experiment/)).toBeVisible();  // hero says what it shows
    // Phase 9: the hero offers the optional guided journey or free exploration (the Copilot has its own section)
    await expect(page.getByRole("link", { name: "Start exploring" })).toHaveAttribute("href", "/?journey=choose#explore");
    await expect(page.getByRole("link", { name: "Explore on my own" })).toHaveAttribute("href", "#explore");
    await expect(page.getByLabel("What is in the database")).toHaveCount(0);           // no KPI counters
    const cards = page.getByTestId("phenomenon-card");
    await expect(cards).toHaveCount(3);
    for (const href of ["/phenomena/flame-extinction", "/phenomena/flame-spread", "/phenomena/spacecraft-fire"]) {
      await expect(page.locator(`#explore a[href="${href}"]`)).toBeVisible();
      await expect(page.locator(`#studios a[href="${href}#studio"]`)).toHaveCount(1);
    }
    // example questions only pre-fill the Copilot
    const examples = page.locator('section[aria-labelledby="cp-title"] a[href^="/copilot?"]');
    await expect(examples).toHaveCount(3);
    for (const href of await examples.evaluateAll((els) => els.map((e) => e.getAttribute("href")))) expect(href).toMatch(/\?draft=/);
    await page.getByRole("button", { name: "How it works" }).click();
    await expect(page.getByText(/code then checks that every statement cites a source/)).toBeVisible();
    await expect(page.locator('section[aria-labelledby="trust-title"]').getByRole("link", { name: "View methodology" })).toHaveAttribute("href", "/methodology");
    await expect(page.getByRole("contentinfo")).toContainText("Not an official NASA website");
  });

  test("phenomenon pages keep their analyses and attribute the NASA investigation", async ({ page }) => {
    await page.goto("/phenomena/flame-extinction");
    await expect(page.getByRole("heading", { name: "Flame Extinction & Burning Dynamics", level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: /Source: NASA FLEX PSI-69/ })).toHaveAttribute("href", /PSI-69/);
    await openSection(page, "map");   // Phase 8: the conditions and the map are one explore-level section
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

  test("reduced motion: content is visible immediately", async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Understanding Fire Beyond Earth", level: 1 })).toBeVisible();
    await expect(page.getByTestId("phenomenon-card").first()).toBeVisible();
    const loops = await page.evaluate(() => getComputedStyle(document.querySelector(".anim-twinkle")!).animationIterationCount);  // hero star field
    expect(loops).toBe("1");
    await ctx.close();
  });
});

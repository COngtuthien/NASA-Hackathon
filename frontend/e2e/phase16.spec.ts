import { expect, test, type Page } from "@playwright/test";

// Phase 16: Combustion & Fire Science Explorer (five domains, ten investigations at their evidence level, dataset-specific
// filters, record provenance, comparison rules, guided exploration), guided timelines in the Gaseous Flame and Smoke
// Detection studios, the visual Research-to-Safety entry, CFI-G similarity, media coverage and the estimator decision.

function consoleErrors(page: Page) {
  const errs: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("caret-color") && !m.text().includes("hydrated but some attributes")) errs.push(m.text());
  });
  page.on("pageerror", (e) => errs.push(String(e)));
  return errs;
}
const scrub = (page: Page) => page.getByTestId("studio-guide").getByTestId("timeline-scrub");
async function openStudio(page: Page, path: string) {
  await page.goto(path);
  const host = page.getByTestId("lite-canvas-host");
  await host.scrollIntoViewIfNeeded();
  await expect(host.locator("canvas")).toBeVisible({ timeout: 60_000 });
}

test("five domains expose all ten investigations, each at its own evidence level", async ({ page }) => {
  const errs = consoleErrors(page);
  await page.goto("/experiments");
  await expect(page.getByRole("heading", { name: "Combustion & Fire Science Explorer", level: 1 })).toBeVisible();
  // the original FLEX table is unchanged
  await expect(page.getByLabel("Fuel")).toBeVisible();
  await expect(page.getByRole("heading", { name: "274 rows" })).toBeVisible();
  const expectBadge: [string, string, RegExp][] = [
    ["droplet", "psi117", /Published figure data — series, not tests/], ["droplet", "flex2", /No downloaded per-test outcomes/],
    ["gaseous", "cfig", /Measured test outcomes/], ["gaseous", "flame_design", /Experimental conditions only/],
    ["gaseous", "bre", /Day-level summary — not individual flame tests/],
    ["smoke", "same_log", /Operational log/], ["smoke", "same_sizes", /Report-derived measurements/],
  ];
  for (const [domain, key, badge] of expectBadge) {
    await page.getByTestId(`domain-${domain}`).click();
    await page.getByTestId(`collection-${key}`).click();
    await expect(page).toHaveURL(new RegExp(`dataset=${key}`));
    await expect(page.getByTestId("collection-browser")).toHaveAttribute("data-collection", key);
    await expect(page.getByTestId("evidence-badge")).toHaveText(badge);
  }
  await page.getByTestId("domain-solid").click();
  await expect(page.getByRole("heading", { name: "129 rows" })).toBeVisible();              // BASS-II table kept
  await page.getByTestId("collection-psi62").click();
  await expect(page).toHaveURL(/dataset=psi62/);
  await expect(page.getByTestId("profile-only")).toContainText("Metadata only");
  await expect(page.getByTestId("investigation-profile")).toHaveAttribute("data-inv", "PSI-62");
  await page.getByTestId("domain-spacecraft").click();
  await expect(page.getByRole("heading", { name: "2 rows" })).toBeVisible();                // SAFFIRE-I kept
  expect(errs).toEqual([]);
});

test("CFI-G: dataset filters, record provenance, compatible and incompatible comparisons", async ({ page }) => {
  await page.goto("/experiments?dataset=cfig");
  await expect(page.getByTestId("collection-count")).toHaveText("333 records");
  await page.getByTestId("cfilter-configuration").selectOption("inverse");
  await expect(page.getByTestId("collection-count")).toHaveText("154 records");
  await page.getByTestId("cfilter-fuel_species").selectOption("propane");
  await expect(page).toHaveURL(/f_configuration=inverse.*f_fuel_species=propane|f_fuel_species=propane.*f_configuration=inverse/);
  await expect(page.getByTestId("collection-count")).not.toHaveText("154 records");
  const n = Number((await page.getByTestId("collection-count").textContent())!.split(" ")[0]);
  expect(n).toBeGreaterThan(0);
  expect(n).toBeLessThan(154);
  // compatible: two normal tests
  await page.goto("/experiments?dataset=cfig&f_configuration=normal");
  const boxes = page.getByTestId("collection-table").locator("tbody input[type=checkbox]");
  await boxes.nth(0).check();
  await boxes.nth(1).check();
  await page.getByRole("button", { name: "Compare the selected records" }).click();
  await expect(page.getByTestId("compare-result")).toContainText("Observed outcome");
  // incompatible: a normal and an inverse test (selection survives the filter change)
  await page.getByTestId("cfilter-configuration").selectOption("inverse");
  await expect(page.getByTestId("collection-count")).toHaveText("154 records");
  await page.getByTestId("collection-table").locator("tbody input[type=checkbox]").nth(0).check();
  await page.getByRole("button", { name: "Compare the selected records" }).click();
  await expect(page.getByTestId("compare-rejected")).toContainText("Normal and inverse flames are different configurations");
  // record detail
  await page.goto("/experiments/cfig/cfig%3Anormal%3A21174C3");
  await expect(page.getByTestId("record-badge")).toHaveText("Measured test outcomes");
  await expect(page.getByTestId("record-provenance")).toContainText("Normal Flames.csv");
  await expect(page.getByTestId("record-values")).toContainText("Observed outcome");
  await page.getByRole("link", { name: "Open this test on the analysis page" }).click();
  await expect(page).toHaveURL(/tab=cfig&test=21174C3#cfig-lookup/);
  await expect(page.getByTestId("cfig-test-record")).toBeVisible({ timeout: 30_000 });
});

test("conditions-only, day-level, figure and plan collections never pretend to be tests", async ({ page }) => {
  await page.goto("/experiments?dataset=flame_design&cols=all");
  await expect(page.getByTestId("collection-count")).toHaveText("327 records");
  await expect(page.getByTestId("collection-table").locator("thead")).not.toContainText(/outcome|burn time/i);
  await page.goto("/experiments?dataset=bre");
  await expect(page.getByTestId("collection-count")).toHaveText("18 days");
  await page.goto("/experiments?dataset=psi117");
  await expect(page.getByTestId("collection-count")).toHaveText("61 series");
  await expect(page.getByTestId("compare-unavailable")).toContainText("not tests");
  await page.getByTestId("cfilter-role").selectOption("model");
  await expect(page.getByTestId("collection-table").locator("tbody tr").first()).toContainText("model");
  await page.goto("/experiments?dataset=same_sizes&f_material=kapton");
  await expect(page.getByTestId("collection-count")).toHaveText("2 records");
  await expect(page.getByTestId("collection-table")).toContainText("186");
  await page.goto("/experiments?dataset=flex2");
  await expect(page.getByTestId("compare-unavailable")).toContainText("test plan");
});

test("Combustion Explorer guided exploration: six real steps, never sends a question", async ({ page }) => {
  const asks: string[] = [];
  page.on("request", (r) => { if (r.url().includes("/assistant/ask")) asks.push(r.url()); });
  await page.goto("/experiments?dataset=cfig");
  await page.getByTestId("start-explore").click();
  const bar = page.getByTestId("demo-bar");
  await expect(bar).toHaveAttribute("data-mode", "explore");
  await expect(page.getByTestId("demo-step-title")).toContainText("Step 1 of 6");
  await page.getByTestId("demo-next").click();
  await page.getByTestId("demo-next").click();
  await expect(page).toHaveURL(/dataset=cfig&f_configuration=normal&f_fuel_species=n-butane/);
  await page.getByTestId("demo-next").click();
  await expect(page.getByTestId("record-view")).toHaveAttribute("data-record", "cfig:normal:21174C3");
  await page.getByTestId("demo-next").click();
  await expect(page).toHaveURL(/\/phenomena\/gaseous-flames\?tab=cfig/);
  await page.getByTestId("demo-next").click();
  await expect(page).toHaveURL(/\/copilot\?draft=.*scenario=gaseous-flames.*test=21174C3/);
  await expect(page.getByTestId("explorer-context")).toContainText("21174C3");
  await page.getByTestId("demo-exit").click();
  await expect(bar).toHaveCount(0);
  expect(asks).toEqual([]);
});

test("Research-to-Safety and Combustion Explorer link both ways", async ({ page }) => {
  await page.goto("/safety-explorer/gaseous-flames");
  await page.getByTestId("browse-PSI-159").getByRole("link").click();
  await expect(page).toHaveURL(/\/experiments\?dataset=cfig$/);
  await expect(page.getByTestId("collection-browser")).toBeVisible();
  await page.getByTestId("domain-scenario-link").click();
  await expect(page).toHaveURL(/\/safety-explorer\/gaseous-flames$/);
  await expect(page.getByTestId("evidence-record-link").first()).toHaveAttribute("href", /\/experiments\/cfig\/cfig%3A/);
});

test("Gaseous Flame guided timeline: start, step, seek, speed, pause with the animation, restart; scene follows", async ({ page }) => {
  const errs = consoleErrors(page);
  await openStudio(page, "/phenomena/gaseous-flames#studio");
  await expect(page.getByTestId("timeline-caveat")).toContainText("not the timeline of any CFI-G test");
  await page.getByTestId("guide-start").click();
  const stage = page.getByTestId("studio-guide").getByTestId("timeline-stage");
  await expect(stage).toContainText("Setup");
  await page.getByTestId("timeline-play").click();                                   // pause the guide
  await expect(page.getByText("Hot flame (illustrative size)")).toHaveCount(0);       // no flame during setup
  await page.getByTestId("stage-next").click();
  await expect(stage).toContainText("Gas delivery");
  await page.getByTestId("stage-next").click();
  await expect(stage).toContainText("Ignition");
  await expect(page.getByText("Hot flame (illustrative size)")).toBeVisible();        // the flame appears at ignition
  await page.getByTestId("stage-prev").click();
  await expect(stage).toContainText("Gas delivery");
  await scrub(page).fill("75");
  await expect(stage).toContainText("Extinction or transition");
  await expect(stage).toContainText("only at 30 % n-butane");
  // playing advances; 2x is faster than 1x; pausing the animation pauses the guide
  await page.getByTestId("timeline-speed").selectOption("2");
  await scrub(page).fill("0");
  await page.getByTestId("timeline-play").click();
  await page.waitForTimeout(1500);
  const p1 = Number(await scrub(page).inputValue());
  expect(p1).toBeGreaterThan(0);
  await page.getByTestId("motion-toggle").click();
  await expect(page.getByTestId("timeline-play")).toHaveText("Play");
  const p2 = Number(await scrub(page).inputValue());
  await page.waitForTimeout(800);
  expect(Number(await scrub(page).inputValue())).toBe(p2);
  await page.getByTestId("timeline-reset").click();
  expect(Number(await scrub(page).inputValue())).toBe(0);
  // Reset of the studio switches the guide off
  await page.getByTestId("studio-reset-all").click();
  await expect(stage).toContainText("Timeline off");
  expect(errs).toEqual([]);
});

test("Smoke Detection guided timeline drives the stage and the explanation; works under reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openStudio(page, "/phenomena/smoke-detection#studio");
  const loop = page.locator('[data-studio="smoke"] [data-frameloop]');
  await expect(loop).toHaveAttribute("data-frameloop", "demand");                       // reduced motion: no idle animation
  await page.getByTestId("guide-start").click();
  await expect(page.getByTestId("smoke-stage-text")).toContainText("Stage 1:");
  await expect(loop).toHaveAttribute("data-frameloop", "always");                       // the user pressed play
  await page.waitForTimeout(1200);
  expect(Number(await scrub(page).inputValue())).toBeGreaterThan(0);
  await scrub(page).fill("70");
  await expect(page.getByTestId("smoke-stage-text")).toContainText("Stage 5:");
  await expect(page.getByTestId("studio-guide").getByTestId("timeline-stage")).toContainText("Instrument sampling");
  await page.getByTestId("stage-next").click();
  await expect(page.getByTestId("smoke-stage-text")).toContainText("Stage 6:");
  await page.getByTestId("smoke-stage-2").click();                                       // stage buttons move the guide too
  await expect(page.getByTestId("studio-guide").getByTestId("timeline-stage")).toContainText("Smoke formation");
  await page.getByTestId("lite-toggle-controls").click();
  await expect(page.getByTestId("studio-guide")).toHaveCount(0);
  await page.getByTestId("lite-show-controls").click();
  await expect(page.getByTestId("studio-guide")).toBeVisible();
});

test("Research-to-Safety entry is visual and short; every scenario has a guided start", async ({ page }) => {
  await page.goto("/safety-explorer");
  await expect(page.getByRole("heading", { name: "Explore Spacecraft Fire Science", level: 1 })).toBeVisible();
  for (const id of ["flame-spread", "gaseous-flames", "smoke-detection", "droplet-extinction"]) {
    await expect(page.getByTestId(`card-image-${id}`)).toBeVisible();
    const short = await page.getByTestId(`scenario-card-${id}`).getByTestId("card-short").textContent();
    expect(short!.length).toBeLessThan(90);
  }
  await page.getByTestId("start-guide-smoke-detection").click();
  await expect(page).toHaveURL(/\/safety-explorer\/smoke-detection$/);
  await expect(page.getByTestId("demo-bar")).toHaveAttribute("data-step", "3");
  await expect(page.getByTestId("summary-chart").locator(".main-svg").first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("filters-section")).toHaveAttribute("data-open", "false");   // advanced filters on request
  await page.getByTestId("demo-exit").click();
});

test("Find similar: local database only, CFI-G scoped to one configuration", async ({ page }) => {
  await page.goto("/intelligence/similar");
  await expect(page.getByTestId("similar-scope")).toContainText("not the internet");
  await page.getByRole("tab", { name: "ACME CFI-G" }).click();
  await page.locator("#c-configuration").selectOption("inverse");
  await page.locator("#c-fuel_species").selectOption("propane");
  await page.getByRole("button", { name: "Search conditions" }).click();
  await expect(page.getByTestId("similar-scope-line")).toContainText("CFI-G inverse flames only");
  await page.goto("/intelligence/similar?uid=cfig:normal:21174C3&mode=uid");
  await expect(page.getByTestId("similar-scope-line")).toContainText("normal flames only");
});

test("media coverage states missing investigations; the estimator is labelled exploratory and FLEX-only", async ({ page }) => {
  await page.goto("/evidence/media");
  await page.getByTestId("media-coverage").locator("summary").click();
  await expect(page.getByTestId("coverage-PSI-102")).toContainText("No verified NASA media in SpaceFire");
  await expect(page.getByTestId("coverage-PSI-159")).toHaveAttribute("data-count", "1");
  await page.getByTestId("coverage-PSI-159").getByRole("button").click();
  await expect(page).toHaveURL(/investigation=CFI-G/);
  await page.goto("/modeling");
  await expect(page.getByRole("heading", { name: "Exploratory FLEX Burn-Time Estimator", level: 1 })).toBeVisible();
  await expect(page.getByTestId("ml-validation-summary")).toContainText("grouped 5-fold cross-validation");
  await expect(page.getByTestId("ml-validation-summary")).toContainText("no other investigation is pooled");
});

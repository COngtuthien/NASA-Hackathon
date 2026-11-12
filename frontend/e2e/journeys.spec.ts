import { openSection } from "./helpers";
import { expect, test } from "@playwright/test";

test.describe("SpaceFire AI user journeys", () => {
  test.beforeEach(async ({ page }) => {
    page.on("pageerror", (e) => {
      throw new Error(`Uncaught page error: ${e.message}`);
    });
  });

  // Phase 8: Home no longer shows statistics; the real counts and the fuel-filtered chart live on the FLEX page.
  test("real counts appear where they belong and the FLEX chart responds to the fuel filter", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('#explore a[href="/phenomena/flame-extinction"]')).toBeVisible();
    const inv = await (await page.request.get("/api/v1/investigations")).json();
    expect(Object.fromEntries(inv.items.map((i: { investigation_id: string; burns: number }) => [i.investigation_id, i.burns])))
      .toMatchObject({ "PSI-69": 274, "PSI-25": 129, "PSI-98": 2 });
    await page.goto("/phenomena/flame-extinction#map");
    await expect(page.getByText(/n = 262 plotted of 274 rows/)).toBeVisible();
    await page.locator("#conditions").getByRole("radio", { name: "Methanol" }).click();
    await expect(page.getByText(/plotted of 157 rows/)).toBeVisible();
  });

  test("explorer: FLEX filter by oxygen, open a detail page, follow source evidence", async ({ page }) => {
    await page.goto("/experiments?dataset=flex");
    await page.getByLabel("Fuel").selectOption("Methanol");
    await expect(page).toHaveURL(/f_fuel=Methanol/);
    const max = page.getByLabel("Initial O2 maximum");
    await max.fill("0.1749");
    await max.press("Enter");
    await expect(page.getByRole("heading", { name: "54 rows" })).toBeVisible();
    await expect(page).toHaveURL(/max_x_o2=0.1749/);
    await page.goto("/experiments?dataset=flex&q=193F001");
    await expect(page.getByRole("heading", { name: "2 rows" })).toBeVisible();
    await page.getByRole("link", { name: "193F001" }).first().click();
    await expect(page.getByRole("heading", { name: "FLEX 193F001" })).toBeVisible();
    await expect(page.getByText(/also appears on/)).toBeVisible();
    await openSection(page, "provenance");
    await expect(page.getByText("FLEX/PSI-69_Experimental table_FLEX.csv").first()).toBeVisible();
    await openSection(page, "flags");
    await expect(page.getByText("FLEX-DUP-ID").first()).toBeVisible();
  });

  test("BASS-II detail shows GMT as day of year and report pages with links", async ({ page }) => {
    await page.goto("/experiments/bass2/bass2%3A31");
    await expect(page.getByRole("heading", { name: "BASS-II M5" })).toBeVisible();
    await openSection(page, "values");
    await expect(page.getByText("Day-of-year (NOT a clock time)").first()).toBeVisible();
    await openSection(page, "report");
    await openSection(page, "pages");
    const docLink = page.getByRole("link", { name: /BASS-II Summary Report.*PDF p\.\d+/ }).first();
    await expect(docLink).toHaveAttribute("href", /\/api\/v1\/documents\/bass-ii-summary-report\/file#page=\d+/);
  });

  test("compare two BASS-II tests: chart and quality warnings; cross-investigation shows no shared axis", async ({ page }) => {
    await page.goto("/compare?uids=bass2:31,bass2:30");
    await expect(page.getByRole("heading", { name: "Side by side" })).toBeVisible();
    await expect(page.locator(".js-plotly-plot")).toBeVisible();
    await page.getByLabel("Field").selectOption("co2_final");
    await expect(page.getByText("Δ -1.07 vs first")).toBeVisible();
    await page.goto("/compare?uids=flex:1,bass2:31");
    await expect(page.getByText("These tests come from different investigations")).toBeVisible();
    await expect(page.locator(".js-plotly-plot")).toHaveCount(0);
  });

  test("assistant without an LLM key returns evidence only, never a fabricated answer", async ({ page }) => {
    await page.goto("/assistant");
    await page.getByLabel("Your scientific question").fill("Does Disruption definitively mean extinction in FLEX?");
    await page.getByRole("button", { name: "Ask", exact: true }).click();
    const health = await (await page.request.get("/api/v1/health")).json();
    if (!health.llm.configured) {
      await expect(page.getByText("Evidence only")).toBeVisible({ timeout: 60_000 });
      await expect(page.getByText(/AI synthesis is not configured/)).toBeVisible();
    } else {
      await expect(page.getByText(/Answered|Partial answer|Insufficient evidence/)).toBeVisible({ timeout: 90_000 });
    }
    await expect(page.getByText("Quality rule FLEX-DISRUPTION")).toBeVisible();
    await expect(page.getByRole("heading", { name: /Sources \(\d+\)/ })).toBeVisible();
  });

  test("assistant abstains on an operational safety threshold", async ({ page }) => {
    await page.goto(`/assistant?q=${encodeURIComponent("What is the exact safe O2 threshold for an occupied future spacecraft?")}`);
    await expect(page.getByText(/does not infer one/)).toBeVisible({ timeout: 60_000 });
  });

  test("external research lists papers with links, or reports providers unavailable", async ({ page }) => {
    await page.goto(`/research?q=${encodeURIComponent("cool flame droplet microgravity")}`);
    const ok = page.getByText(/results for “cool flame droplet microgravity”/);
    await expect(ok).toBeVisible({ timeout: 60_000 });
    const items = page.locator("main li a[target=_blank]");
    const unavailable = await page.getByText("External sources temporarily unavailable").isVisible();
    if (!unavailable) {
      await expect(items.first()).toHaveAttribute("href", /^https:\/\//);
      await expect(page.getByText(/Found in (NASA NTRS|OpenAlex)/).first()).toBeVisible();
    }
  });

  test("external failure leaves local features working", async ({ page }) => {
    await page.route("**/api/v1/research/search**", (r) => r.fulfill({ status: 503, contentType: "application/json",
      body: JSON.stringify({ error: { code: "unavailable", message: "External providers unreachable", request_id: "e2e" } }) }));
    await page.goto(`/research?q=${encodeURIComponent("anything")}`);
    await expect(page.locator("[role=alert]", { hasText: "External providers unreachable" })).toBeVisible();
    await page.getByRole("link", { name: "Combustion Explorer" }).first().click();
    await expect(page.getByRole("heading", { name: /\d+ rows/ })).toBeVisible();
  });

  test("evidence search finds M5 and Table 5.1 with page citations", async ({ page }) => {
    await page.goto("/evidence?q=M5");
    await expect(page.getByText(/BASS-II M5 \(row 31\)/)).toBeVisible();
    await expect(page.getByText(/BASS-II Summary Report \(NASA\/TM-20210011385\), PDF p\.\d+/).first()).toBeVisible();
    await page.goto(`/evidence?q=${encodeURIComponent("BASS-II Table 5.1")}`);
    await expect(page.getByText("PDF p.65 (printed p.57)").first()).toBeVisible();
    await page.getByRole("button", { name: "Read full passage" }).first().click();
    await expect(page.getByRole("heading", { name: "Passage", exact: true })).toBeVisible();
  });

  test("FLEX physics lab: extinction map and d²-law consistency", async ({ page }) => {
    await page.goto("/physics/flex#map");
    await expect(page.getByText(/n = 262 plotted of 274 rows/)).toBeVisible();
    await openSection(page, "d2");
    await expect(page.locator("#d2")).toContainText("NOT an independent prediction");
    await expect(page.locator("#d2")).toContainText(/Median reported \/ estimated time: 1\.0\d+/);
    await expect(page.locator("#d2 .js-plotly-plot")).toBeVisible();
  });

  test("BASS-II lab: gas analysis with exclusions and raw non-numeric cells", async ({ page }) => {
    await page.goto("/physics/bass-ii#gas");
    await expect(page.getByText(/5 excluded as unphysical/)).toBeVisible();
    await expect(page.getByText("PMMA complete combustion").first()).toBeVisible();
    await openSection(page, "endpoints");
    const m5 = page.locator("tr", { has: page.getByRole("link", { name: "M5", exact: true }) });
    await expect(m5).toContainText(">500");
  });

  test("SAFFIRE-I timeline comes from the real manifest; no images", async ({ page }) => {
    await page.goto("/physics/saffire-i");
    await expect(page.getByText(/no manifest frame is shown or reconstructed/)).toBeVisible();
    await openSection(page, "manifest");
    await expect(page.locator("tr", { hasText: "S1 burn (concurrent)" }).filter({ hasText: "S1C1" })).toContainText("18,124");
    await openSection(page, "timeline");
    await page.getByLabel("Image set").selectOption("Sample2");
    await expect(page.locator("#timeline .js-plotly-plot")).toBeVisible();
    await expect(page.getByRole("link", { name: "Download timeline CSV" })).toHaveAttribute("href", /timeline\.csv/);
  });

  test("data quality: flag leads to the exact source record", async ({ page }) => {
    await page.goto("/quality?severity=critical");
    const item = page.locator("section#flags li", { hasText: "FLEX-P-ZERO" }).first();   // the flag browser, not the top-warnings summary
    await expect(item).toContainText("row 114");
    await item.getByRole("link", { name: /C11M201/ }).click();
    await expect(page.getByRole("heading", { name: "FLEX C11M201" })).toBeVisible();
    await expect(page.getByText("Ambient pressure recorded as 0 mmHg").first()).toBeVisible();
  });

  test("similar experiments explain input-feature differences", async ({ page }) => {
    await page.goto("/similar?uid=flex:145&mode=uid");
    await expect(page.getByText(/Never used: burn_time_s, dext_mm, k_mm2_s, test_end/)).toBeVisible();
    await page.getByRole("button", { name: "Breakdown" }).first().click();
    await expect(page.getByRole("columnheader", { name: "Contribution" })).toBeVisible();
  });

  test("ML page shows gate result and validation metrics", async ({ page }) => {
    await page.goto("/ml/flex");
    await expect(page.getByText(/Prediction (enabled \(exploratory\)|disabled)\./)).toBeVisible();
    await openSection(page, "metrics");
    await expect(page.locator("#metrics").getByText(/GroupKFold/).first()).toBeVisible();
  });
});

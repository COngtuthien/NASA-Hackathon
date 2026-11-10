import { expect, test } from "@playwright/test";

test.describe("Phase 2: curated report data, citation confidence, UI refinements", () => {
  test("BASS-II lab shows Table 5.1 spread rates and Table 7.1 outcomes with BASS (I) rows unlinked", async ({ page }) => {
    await page.goto("/physics/bass-ii");
    await expect(page.locator("#spread .js-plotly-plot")).toBeVisible();
    await expect(page.locator("#spread")).toContainText(/n = \d+ stages from \d+ tests/);
    const bass1 = page.locator("#outcomes tr", { hasText: "GMT96-T8" });
    await expect(bass1).toContainText("Different investigation");
    await expect(bass1.getByRole("link")).toHaveCount(0);
    await expect(page.locator("#outcomes tr", { hasText: "GMT175-T9" })).toContainText("No ignition");
    await page.getByRole("link", { name: "SIBAL outcomes (Table 7.1)" }).click();
    await expect(page).toHaveURL(/#outcomes$/);
  });

  test("experiment detail shows verified report rows and link-confidence badges", async ({ page }) => {
    await page.goto("/experiments/bass2/bass2%3A33");
    await expect(page.getByRole("heading", { name: "Values printed in the NASA Summary Report" })).toBeVisible();
    await expect(page.getByText("Table 5.1, row M7")).toBeVisible();
    await expect(page.getByText("Verified against CSV").first()).toBeVisible();
    await expect(page.getByText("Verified table row").first()).toBeVisible();
    await expect(page.getByText(/self-extinguished|Prolonged|spread/i).first()).toBeVisible();
  });

  test("conflicting report rows are flagged, not corrected", async ({ page }) => {
    await page.goto("/quality?rule_id=BASS-REPORT-CSV-CONFLICT");
    await expect(page.getByRole("heading", { name: "3 matching" }).or(page.getByText("3 matching"))).toBeVisible();
    await expect(page.getByText(/236.*239/).first()).toBeVisible();
  });

  test("explorer filter chips reflect and remove URL filters", async ({ page }) => {
    await page.goto("/experiments?dataset=bass2&f_flow_direction=Concurrent");
    const chip = page.getByRole("button", { name: /Remove filter Flow direction \(report\): Concurrent/ });
    await expect(chip).toBeVisible();
    await chip.click();
    await expect(page).not.toHaveURL(/f_flow_direction/);
    await expect(page.getByRole("heading", { name: "129 rows" })).toBeVisible();
  });

  test("assistant source tabs filter the citation list", async ({ page }) => {
    await page.goto(`/assistant?q=${encodeURIComponent("Show BASS-II test M7 and its spread rate")}`);
    const tabs = page.getByRole("tablist", { name: "Filter sources by type" });
    await expect(tabs).toBeVisible({ timeout: 60_000 });
    await tabs.getByRole("tab", { name: /Report tables/ }).click();
    await expect(page.getByText(/BASS-II Summary Report Table 5\.1, row M7/)).toBeVisible();
  });
});

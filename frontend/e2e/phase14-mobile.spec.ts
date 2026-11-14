import { expect, test } from "@playwright/test";

// Phase 14 on a phone (390 px): the Explorer entry page and a scenario workspace fit without horizontal scroll,
// filters stay usable, and the ranked list and actions are reachable.
test("Explorer fits a phone screen and filters still work", async ({ page }) => {
  await page.goto("/safety-explorer");
  await expect(page.getByTestId("scenario-card-gaseous-flames")).toBeVisible();
  let overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await page.getByTestId("scenario-card-gaseous-flames").click();
  await expect(page.getByTestId("explorer-workspace")).toBeVisible({ timeout: 30_000 });
  const resp = page.waitForResponse((r) => r.url().includes("/api/v1/explorer/scenarios/") && r.status() === 200);
  await page.getByTestId("filters-toggle").click();
  await page.getByTestId("filter-configuration").selectOption("flow:inverse");
  await resp;
  await expect(page.getByTestId("evidence-summary")).toContainText("inverse flames");
  overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  const act = page.getByTestId("action-copilot");
  await act.scrollIntoViewIfNeeded();
  await expect(act).toBeVisible();
});

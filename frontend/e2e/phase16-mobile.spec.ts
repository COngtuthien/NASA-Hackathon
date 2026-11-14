import { expect, test } from "@playwright/test";

// Phase 16 on a phone (390 px): the domain picker, a collection table and the Research-to-Safety cards fit without
// horizontal page scroll; wide tables scroll inside their own container.
const overflow = (page: import("@playwright/test").Page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

test("phone: Combustion Explorer domains and a collection table fit", async ({ page }) => {
  await page.goto("/experiments?dataset=cfig");
  await expect(page.getByTestId("domain-picker")).toBeVisible();
  await expect(page.getByTestId("collection-table")).toBeVisible({ timeout: 30_000 });
  expect(await overflow(page)).toBeLessThanOrEqual(1);
  await page.getByTestId("domain-smoke").tap();
  await expect(page.getByTestId("collection-browser")).toHaveAttribute("data-collection", "same_log");
  expect(await overflow(page)).toBeLessThanOrEqual(1);
});

test("phone: Research-to-Safety cards and a guided studio timeline fit", async ({ page }) => {
  await page.goto("/safety-explorer");
  await expect(page.getByTestId("card-image-gaseous-flames")).toBeVisible();
  expect(await overflow(page)).toBeLessThanOrEqual(1);
  await page.goto("/phenomena/smoke-detection#studio");
  await page.getByTestId("guide-start").scrollIntoViewIfNeeded();
  await page.getByTestId("guide-start").tap();
  await expect(page.getByTestId("studio-guide")).toBeVisible();
  expect(await overflow(page)).toBeLessThanOrEqual(1);
});

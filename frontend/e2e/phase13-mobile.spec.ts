import { expect, test } from "@playwright/test";

// Phase 13 on a phone (390 px): the new pages have no horizontal page scroll, the studios load or fall back
// gracefully, and charts and tables stay reachable.
for (const path of ["/phenomena/gaseous-flames", "/phenomena/smoke-detection"]) {
  test(`${path} fits a phone screen`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator("h1")).toBeVisible();
    const box = page.getByTestId("lite-viewport-box");
    await box.scrollIntoViewIfNeeded();
    await expect(box.locator("canvas, [data-testid=scene-fallback]").first()).toBeVisible({ timeout: 60_000 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await expect(page.getByTestId("conceptual-notice")).toBeVisible();
  });
}

test("CFI-G charts render on a phone", async ({ page }) => {
  await page.goto("/phenomena/gaseous-flames?tab=cfig");
  const c = page.getByTestId("chart-outcomes-fuel");
  await c.scrollIntoViewIfNeeded();
  await expect(c.locator(".main-svg").first()).toBeVisible({ timeout: 30_000 });
});

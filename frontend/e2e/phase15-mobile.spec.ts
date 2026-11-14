import { expect, test } from "@playwright/test";

// Phase 15 on a phone (390 px): the guided demo bar and the unified studio controls fit without horizontal scroll and
// stay usable by touch.
const overflow = (page: import("@playwright/test").Page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

test("phone: guided demo bar fits and navigates", async ({ page }) => {
  await page.goto("/demo");
  await page.getByTestId("demo-begin").click();
  const bar = page.getByTestId("demo-bar");
  await expect(bar).toBeVisible();
  expect(await overflow(page)).toBeLessThanOrEqual(1);
  const box = await bar.boundingBox();
  expect(box!.width).toBeLessThanOrEqual(390);
  await page.getByTestId("demo-next").click();
  await expect(page).toHaveURL(/\/safety-explorer$/);
  await page.getByTestId("demo-next").click();
  await expect(page.getByTestId("explorer-workspace")).toBeVisible({ timeout: 30_000 });
  expect(await overflow(page)).toBeLessThanOrEqual(1);
  await page.getByTestId("demo-exit").click();
  await expect(bar).toHaveCount(0);
});

test("phone: studio controls wrap inside the viewport and Hide/Show controls works", async ({ page }) => {
  await page.goto("/phenomena/gaseous-flames#studio");
  const host = page.getByTestId("lite-canvas-host");
  await host.scrollIntoViewIfNeeded();
  await expect(host.locator("canvas, [data-testid=scene-fallback]").first()).toBeVisible({ timeout: 60_000 });
  expect(await overflow(page)).toBeLessThanOrEqual(1);
  const vp = (await page.getByTestId("lite-viewport-box").boundingBox())!;
  for (const id of ["motion-toggle", "studio-reset-all", "studio-fullscreen", "zoom-in", "studio-reset"]) {
    const b = (await page.getByTestId(id).boundingBox())!;
    expect(b.x).toBeGreaterThanOrEqual(vp.x - 1);
    expect(b.x + b.width).toBeLessThanOrEqual(vp.x + vp.width + 1);
    expect(b.height).toBeGreaterThanOrEqual(32);                       // touch-sized
  }
  await page.getByTestId("lite-toggle-controls").click();
  await expect(page.getByTestId("studio-panel")).toBeHidden();
  await page.getByTestId("lite-show-controls").tap();
  await expect(page.getByTestId("studio-panel")).toBeVisible();
});

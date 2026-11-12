import { expect, test } from "@playwright/test";

// Phase 6 on a phone (Pixel 7 profile, 390 px): the 3D viewport comes first, panels follow, nothing overflows.

test("Interactive Lab on mobile: viewport first, touch-sized camera buttons, tabs, no horizontal scroll", async ({ page }) => {
  await page.goto("/lab");
  const viewport = page.getByTestId("lab-viewport");
  await viewport.scrollIntoViewIfNeeded();
  await expect(viewport.locator("canvas")).toBeVisible({ timeout: 60_000 });
  const vb = (await viewport.boundingBox())!;
  expect(vb.width).toBeGreaterThan(330);
  expect(vb.height).toBeGreaterThan(340);
  // the panel comes after the viewport
  const pb = (await page.getByRole("complementary", { name: "Lab panel" }).boundingBox())!;
  expect(pb.y).toBeGreaterThan(vb.y + vb.height - 1);
  await expect(page.getByTestId("mode-banner")).toBeVisible();

  const zoom = page.getByRole("button", { name: "Zoom in" });
  const zb = (await zoom.boundingBox())!;
  expect(zb.width).toBeGreaterThanOrEqual(36);
  await zoom.tap();
  await page.getByRole("button", { name: "Reset camera" }).tap();

  await page.getByRole("tab", { name: "NASA evidence" }).tap();
  await expect(page.getByTestId("flex-nearby").getByRole("button").first()).toBeVisible();
  await page.getByRole("radio", { name: /Spacecraft Fire Safety/ }).tap();
  await expect(page).toHaveURL(/scene=saffire/);
  await page.waitForLoadState("networkidle");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

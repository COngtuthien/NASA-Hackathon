import { expect, test } from "@playwright/test";

// Phase 7 on a phone (Pixel 7 profile, 390 px): the studio stacks viewport, timeline and a collapsible panel; the
// guided tour sits below the viewport; nothing overflows horizontally.

test("Science Studio on mobile: stacked layout, collapsible panel, tour below the viewport, no horizontal scroll", async ({ page }) => {
  for (const path of ["/phenomena/flame-extinction", "/phenomena/flame-spread", "/phenomena/spacecraft-fire"]) {
    await page.goto(`${path}#studio`);
    const viewport = page.getByTestId("lab-viewport");
    await viewport.scrollIntoViewIfNeeded();
    await expect(viewport.locator("canvas")).toBeVisible({ timeout: 60_000 });
    const vb = (await viewport.boundingBox())!;
    expect(vb.width).toBeGreaterThan(300);
    expect(vb.height).toBeGreaterThan(340);
    const pb = (await page.getByRole("complementary", { name: /studio panel/ }).boundingBox())!;
    expect(pb.y).toBeGreaterThan(vb.y + vb.height - 1);
    await page.waitForLoadState("networkidle");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `horizontal overflow on ${path}`).toBeLessThanOrEqual(1);
  }
  // collapsible panel
  const toggle = page.getByRole("button", { name: "Collapse" });
  await toggle.tap();
  await expect(page.getByRole("button", { name: "Expand" })).toHaveAttribute("aria-expanded", "false");
  await page.getByRole("button", { name: "Expand" }).tap();
  await expect(page.getByRole("tabpanel").first()).toBeVisible();
  // touch-sized camera buttons and a tour below the viewport
  const zb = (await page.getByTestId("lab-viewport").getByRole("button", { name: "Zoom in" }).boundingBox())!;
  expect(zb.width).toBeGreaterThanOrEqual(36);
  await page.getByTestId("start-tour").tap();
  const tour = page.getByTestId("guided-tour").filter({ visible: true });
  await expect(tour).toBeVisible();
  const tb = (await tour.boundingBox())!;
  const vb = (await page.getByTestId("lab-viewport").boundingBox())!;
  expect(tb.y).toBeGreaterThan(vb.y + vb.height - 1);
});

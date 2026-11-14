import { expect, test, type Page } from "@playwright/test";

// Phase 10 at 390 px (mobile project) and 768 px: the Earth vs microgravity comparison stacks (one canvas), the stage
// explanation stays readable, touch controls step the stages, and nothing scrolls sideways.
async function noOverflow(page: Page) {
  const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  expect(r.sw, "horizontal overflow").toBeLessThanOrEqual(r.cw);
}

test("mobile: stacked Earth vs microgravity, stage stepping by touch, readable explanation", async ({ page }) => {
  await page.goto("/phenomena/flame-extinction?view=gravity#studio");
  await expect(page.getByTestId("lab-canvas-host").locator("canvas")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("split-captions")).toHaveAttribute("data-layout", "stacked");
  await expect(page.getByTestId("lab-canvas-host").locator("canvas")).toHaveCount(1);
  const tl = page.getByTestId("timeline");
  await tl.getByTestId("stage-start").tap();
  const next = tl.getByTestId("stage-next");
  expect((await next.boundingBox())!.height).toBeGreaterThanOrEqual(36);
  await next.tap();
  await next.tap();
  await expect(tl.getByTestId("stage-explainer")).toHaveAttribute("data-stage", "burning");
  const earth = tl.getByTestId("gravity-earth"), micro = tl.getByTestId("gravity-micro");
  await expect(earth).toBeVisible();
  await expect(micro).toBeVisible();
  const e = (await earth.boundingBox())!, m = (await micro.boundingBox())!;
  expect(m.y).toBeGreaterThan(e.y);                                                        // stacked text, not two narrow columns
  await tl.getByTestId("why-different").tap();
  await expect(tl.getByTestId("why-different-body")).toBeVisible();
  await noOverflow(page);
});

test("tablet 768 px: side-by-side comparison and walkthrough fit", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 768, height: 1024 } });
  const page = await ctx.newPage();
  await page.goto("/phenomena/flame-extinction?view=gravity#studio");
  await expect(page.getByTestId("lab-canvas-host").locator("canvas")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("split-captions")).toHaveAttribute("data-layout", "side-by-side");
  await page.getByTestId("timeline").getByTestId("stage-start").click();
  await noOverflow(page);
  await page.goto("/phenomena/spacecraft-fire#studio");
  await page.getByTestId("walk-start").click();
  await expect(page.getByTestId("walk-step")).toContainText("Step 1 of 5");
  await noOverflow(page);
  await ctx.close();
});

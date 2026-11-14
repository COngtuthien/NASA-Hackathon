import { expect, test, type Page } from "@playwright/test";

// Phase 9 at 390 px (mobile project): journey card, NASA comparison stacked under the model, chart spotlight and the
// glossary popover all fit the viewport, with touch-sized controls and no horizontal scroll.
async function noOverflow(page: Page) {
  const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  expect(r.sw, "horizontal overflow").toBeLessThanOrEqual(r.cw);
}

test("mobile: journey through the studio steps, comparison stacked, no overflow", async ({ page }) => {
  await page.goto("/?journey=choose#explore");
  await expect(page.getByTestId("journey-card")).toBeVisible();
  await noOverflow(page);
  await page.getByTestId("phenomenon-card").nth(1).click();
  const card = page.getByTestId("journey-card");
  await expect(card.getByRole("heading", { name: "Explore the flow duct" })).toBeVisible({ timeout: 60_000 });
  const next = card.getByTestId("journey-next");
  expect((await next.boundingBox())!.height).toBeGreaterThanOrEqual(36);                  // touch-sized
  await card.getByTestId("journey-action").tap();
  await expect(card.getByTestId("journey-task")).toContainText("Done.");
  await next.tap();
  await card.getByTestId("journey-action").tap();                                         // opposed vs concurrent
  await expect(page).toHaveURL(/view=compare/);
  await card.getByTestId("journey-next").tap();
  await card.getByTestId("journey-action").tap();
  const cmp = page.getByTestId("evidence-compare");
  await expect(cmp.getByTestId("record-warning").first()).toBeVisible({ timeout: 30_000 });
  const host = (await page.getByTestId("lab-canvas-host").boundingBox())!;
  const box = (await cmp.boundingBox())!;
  expect(box.y).toBeGreaterThan(host.y);                                                  // stacked under the model
  await noOverflow(page);
});

test("mobile: chart spotlight and glossary popover stay inside the screen", async ({ page }) => {
  await page.goto("/phenomena/flame-extinction?record=flex%3A180#map");
  const spot = page.locator("section#map").getByTestId("record-spotlight");
  await expect(spot.getByRole("heading", { name: /Selected test: C02H101/ })).toBeVisible({ timeout: 30_000 });
  await noOverflow(page);
  await page.goto("/phenomena/flame-spread");
  const term = page.getByTestId("glossary-term").first();
  await term.scrollIntoViewIfNeeded();
  await term.tap();
  const pop = page.getByTestId("glossary-popover").first();
  await expect(pop).toBeVisible();
  const r = (await pop.boundingBox())!;
  const vw = page.viewportSize()!.width;
  expect(r.x).toBeGreaterThanOrEqual(8);
  expect(r.x + r.width).toBeLessThanOrEqual(vw - 8);
  await noOverflow(page);
});

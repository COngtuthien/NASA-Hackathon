import { expect, test, type Page } from "@playwright/test";

// Phase 11 on touch devices (Pixel 7 profile, 390 px) and a 768 px tablet: tap to reveal and dismiss the fullscreen
// controls, the setup panel as a bottom sheet, readable explanations, nothing overlapping or overflowing.

type Stats = { mounts: number; camera?: number[] };
const stats = (page: Page) => page.evaluate(() => (window as unknown as { __spacefireLab?: Stats }).__spacefireLab ?? null);
const studio = (page: Page) => page.getByTestId("science-studio");

async function openStudio(page: Page, path: string) {
  await page.addInitScript(() => { (window as unknown as { __SPACEFIRE_AUTOHIDE_MS: number }).__SPACEFIRE_AUTOHIDE_MS = 1000; });
  await page.goto(path);
  const host = page.getByTestId("lab-canvas-host");
  await host.scrollIntoViewIfNeeded();
  await expect(host.locator("canvas")).toBeVisible({ timeout: 60_000 });
  await expect.poll(async () => (await stats(page))?.camera?.length ?? 0, { timeout: 60_000 }).toBe(3);
}

type Box = { x: number; y: number; width: number; height: number };
const overlaps = (a: Box, b: Box) => a.x < b.x + b.width - 1 && b.x < a.x + a.width - 1 && a.y < b.y + b.height - 1 && b.y < a.y + a.height - 1;

async function checkLayout(page: Page, label: string) {
  const vp = page.viewportSize()!;
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${label}: horizontal overflow`).toBeLessThanOrEqual(1);
  // every top-bar button is on screen, touch-sized and not overlapping another
  const btns = page.getByTestId("fs-topbar").getByRole("button");
  const boxes: Box[] = [];
  for (let i = 0; i < await btns.count(); i++) {
    const b = (await btns.nth(i).boundingBox())!;
    expect(b.x, `${label}: button ${i} on screen`).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width).toBeLessThanOrEqual(vp.width + 1);
    expect(b.height).toBeGreaterThanOrEqual(36);
    for (const o of boxes) expect(overlaps(b, o), `${label}: top-bar buttons overlap`).toBe(false);
    boxes.push(b);
  }
  const bar = (await page.getByTestId("fs-playback").boundingBox())!;
  expect(bar.y + bar.height).toBeLessThanOrEqual(vp.height + 1);
  expect(bar.x + bar.width).toBeLessThanOrEqual(vp.width + 1);
  for (const o of boxes) expect(overlaps(bar, o), `${label}: top bar and playback bar overlap`).toBe(false);
}

test("phone: tap reveals and dismisses, bottom-sheet setup, readable explanation, nothing overflows", async ({ page }) => {
  for (const path of ["/phenomena/flame-extinction", "/phenomena/flame-spread", "/phenomena/spacecraft-fire"]) {
    await openStudio(page, path);
    const mounts = (await stats(page))!.mounts;
    await page.getByTestId("enter-fullscreen").tap();
    await expect(studio(page)).toHaveAttribute("data-immersive", /./);
    await checkLayout(page, path);
    expect((await stats(page))!.mounts).toBe(mounts);

    // idle → hidden; a tap on the scene reveals; a second quick tap dismisses
    await expect.poll(() => studio(page).getAttribute("data-chrome"), { timeout: 8000 }).toBe("hidden");
    const vp = page.viewportSize()!;
    await page.touchscreen.tap(vp.width / 2, vp.height * 0.42);
    await expect(studio(page)).toHaveAttribute("data-chrome", "shown");
    await page.touchscreen.tap(vp.width / 2, vp.height * 0.42);
    await expect(studio(page)).toHaveAttribute("data-chrome", "hidden");
    await page.touchscreen.tap(vp.width / 2, vp.height * 0.42);
    await expect(studio(page)).toHaveAttribute("data-chrome", "shown");

    // setup as a bottom sheet: inside the screen, scrollable, closable; it holds the controls shown
    await page.getByTestId("fs-controls").tap();
    const sheet = page.getByTestId("studio-panel");
    await expect.poll(async () => { const b = (await sheet.boundingBox())!; return b.y + b.height; }).toBeLessThanOrEqual(vp.height + 1);   // slid in
    const sb = (await sheet.boundingBox())!;
    expect(sb.y).toBeGreaterThan(vp.height * 0.2);                 // the scene stays visible above it
    expect(sb.x).toBeGreaterThanOrEqual(-1);
    expect(sb.x + sb.width).toBeLessThanOrEqual(vp.width + 1);
    expect(sb.y + sb.height).toBeLessThanOrEqual(vp.height + 1);
    await page.waitForTimeout(2500);
    await expect(studio(page)).toHaveAttribute("data-chrome", "shown");
    await expect(page.getByTestId("fs-panel-close")).toBeInViewport();
    await page.getByTestId("fs-panel-close").tap();
    await expect(page.getByTestId("fs-controls")).toHaveAttribute("aria-expanded", "false");

    // explanation: on screen, clear of the playback bar, closable
    await page.getByTestId("fs-explain").tap();
    const ex = page.getByTestId("fs-explanation");
    await expect(ex).toBeVisible();
    const eb = (await ex.boundingBox())!;
    const pb = (await page.getByTestId("fs-playback").boundingBox())!;
    expect(eb.x).toBeGreaterThanOrEqual(0);
    expect(eb.x + eb.width).toBeLessThanOrEqual(vp.width + 1);
    expect(eb.y + eb.height).toBeLessThanOrEqual(pb.y + 40);      // sits above the controls row
    await expect(ex.getByTestId("fs-explain-close")).toBeInViewport();
    await ex.getByTestId("fs-explain-close").tap();
    await page.getByTestId("fs-exit").tap();
    await expect(studio(page)).not.toHaveAttribute("data-immersive", /./);
    expect((await stats(page))!.mounts).toBe(mounts);
  }
});

test("tablet 768 px, portrait and landscape: fullscreen controls fit", async ({ page }) => {
  for (const size of [{ width: 768, height: 1024 }, { width: 1024, height: 768 }]) {
    await page.setViewportSize(size);
    await openStudio(page, "/phenomena/flame-extinction?view=gravity");
    await page.getByTestId("enter-fullscreen").tap();
    await expect(studio(page)).toHaveAttribute("data-immersive", /./);
    await checkLayout(page, `${size.width}x${size.height}`);
    // Earth vs Microgravity stays legible: both captions on screen
    const caps = page.getByTestId("split-captions").locator("p");
    await expect(caps.nth(0)).toHaveText("Earth");
    await expect(caps.nth(0)).toBeInViewport();
    await expect(caps.nth(1)).toBeInViewport();
    await page.getByTestId("fs-exit").tap();
  }
});

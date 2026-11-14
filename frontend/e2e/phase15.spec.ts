import { expect, test, type Page } from "@playwright/test";

// Phase 15: unified studio controls (Hide/Show controls, Play/Pause that really stops rendering, Reset, Reset camera,
// Fullscreen, Labels/Explanation/Evidence), media playback (local NASA clip, NASA animation, failure state), the
// Guided Demo across real routes, and the Explorer scenario switcher. The backend runs evidence-only.

type Stats = { frames?: number; camera?: number[]; live: number };
const stats = (page: Page) => page.evaluate(() => (window as unknown as { __spacefireLab?: Stats }).__spacefireLab ?? null);
const frames = async (page: Page) => (await stats(page))?.frames ?? 0;
const dist = (c: number[] | undefined) => (c ? Math.hypot(c[0], c[1], c[2]) : 0);

function consoleErrors(page: Page) {
  const errs: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("caret-color") && !m.text().includes("hydrated but some attributes")) errs.push(m.text());
  });
  page.on("pageerror", (e) => errs.push(String(e)));
  return errs;
}
async function openLite(page: Page, path: string) {
  await page.goto(path);
  const host = page.getByTestId("lite-canvas-host");
  await host.scrollIntoViewIfNeeded();
  await expect(host.locator("canvas")).toBeVisible({ timeout: 60_000 });
  await expect.poll(async () => (await stats(page))?.camera?.length ?? 0, { timeout: 60_000 }).toBe(3);
}
/** Frames rendered during `ms`: continuous rendering while playing, (almost) none while paused. */
async function framesDuring(page: Page, ms = 900) {
  const a = await frames(page);
  await page.waitForTimeout(ms);
  return (await frames(page)) - a;
}

for (const [name, path, studio] of [["Gaseous Flame", "/phenomena/gaseous-flames#studio", "gas"], ["Smoke Detection", "/phenomena/smoke-detection#studio", "smoke"]] as const) {
  test(`${name} Studio: Hide/Show controls, Play/Pause, Reset camera, panels, in page and fullscreen`, async ({ page }) => {
    const errs = consoleErrors(page);
    await openLite(page, path);
    const box = page.locator(`[data-studio="${studio}"]`);
    // Play/Pause controls the real render loop
    await expect(box.locator("[data-frameloop]")).toHaveAttribute("data-frameloop", "always");
    expect(await framesDuring(page)).toBeGreaterThan(10);
    await page.getByTestId("motion-toggle").click();
    await expect(page.getByTestId("motion-toggle")).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByTestId("motion-toggle")).toHaveAccessibleName("Play animation");
    await expect(box.locator("[data-frameloop]")).toHaveAttribute("data-frameloop", "demand");
    await page.waitForTimeout(300);
    expect(await framesDuring(page)).toBeLessThanOrEqual(2);
    await page.getByTestId("motion-toggle").click();
    await expect(box.locator("[data-frameloop]")).toHaveAttribute("data-frameloop", "always");
    expect(await framesDuring(page)).toBeGreaterThan(10);
    // Explanation / Evidence / Labels toggles hide and restore their content
    await page.getByTestId("explanation-toggle").click();
    await expect(page.getByTestId("studio-explanation")).toHaveCount(0);
    await page.getByTestId("evidence-toggle").click();
    await expect(page.getByTestId("studio-evidence")).toHaveCount(0);
    await page.getByTestId("explanation-toggle").click();
    await page.getByTestId("evidence-toggle").click();
    await expect(page.getByTestId("studio-explanation")).toBeVisible();
    await expect(page.getByTestId("studio-evidence")).toBeVisible();
    // Reset camera after zooming
    const home = dist((await stats(page))!.camera);
    await page.getByTestId("zoom-in").click();
    await expect.poll(async () => dist((await stats(page))!.camera)).toBeLessThan(home - 0.1);
    await page.getByTestId("studio-reset").click();
    await expect.poll(async () => Math.abs(dist((await stats(page))!.camera) - home)).toBeLessThan(0.05);
    // Hide controls hides the panel and toolbars; a floating Show controls restores them
    await page.getByTestId("lite-toggle-controls").click();
    await expect(box).toHaveAttribute("data-controls", "hidden");
    await expect(page.getByTestId("studio-panel")).toBeHidden();
    await expect(page.getByTestId("lite-main-toolbar")).toHaveCount(0);
    await expect(page.getByTestId("lite-show-controls")).toBeVisible();
    await page.getByTestId("lite-show-controls").click();
    await expect(page.getByTestId("studio-panel")).toBeVisible();
    await expect(page.getByTestId("lite-main-toolbar")).toBeVisible();
    // the same in fullscreen; exit stays reachable while controls are hidden; state survives
    await page.getByTestId("motion-toggle").click();
    await page.getByTestId("studio-fullscreen").click();
    await expect(box).not.toHaveAttribute("data-fullscreen", "off");
    await page.getByTestId("lite-toggle-controls").click();
    await expect(page.getByTestId("studio-panel")).toBeHidden();
    await expect(page.getByTestId("lite-show-controls")).toBeVisible();
    await expect(page.getByTestId("studio-fullscreen")).toBeVisible();
    await page.getByTestId("lite-show-controls").click();
    await expect(page.getByTestId("studio-panel")).toBeVisible();
    await expect(page.getByTestId("motion-toggle")).toHaveAttribute("aria-pressed", "false");   // paused state kept
    await page.getByTestId("studio-fullscreen").click();
    await expect(box).toHaveAttribute("data-fullscreen", "off");
    expect(errs).toEqual([]);
  });
}

test("Gaseous Flame Studio: Reset restores the documented starting state", async ({ page }) => {
  await openLite(page, "/phenomena/gaseous-flames#studio");
  const controls = page.getByTestId("gas-controls");
  await controls.getByRole("radio", { name: "Inverse (oxidizer out)" }).click();
  await controls.getByRole("radio", { name: "Cool flame" }).click();
  await page.getByTestId("gas-event").selectOption({ label: "21174C3 · hot 17.6 mm · cool 7.6 mm" });
  await expect(page.getByTestId("measured-label")).toContainText("hot 17.6 mm");
  await page.getByTestId("motion-toggle").click();
  await page.getByTestId("labels-toggle").click();
  await page.getByTestId("zoom-in").click();
  await page.getByTestId("studio-reset-all").click();
  await expect(controls.getByRole("radio", { name: "Normal (fuel out)" })).toHaveAttribute("aria-checked", "true");
  await expect(controls.getByRole("radio", { name: "Hot flame" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByTestId("gas-event")).toHaveValue("");
  await expect(page.getByTestId("measured-label")).toHaveCount(0);
  await expect(page.getByTestId("motion-toggle")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("labels-toggle")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("gas-explain")).toContainText("Normal flame · hot regime");
});

test("Smoke Detection Studio: material updates the verified panel, stage stepping, Reset", async ({ page, request }) => {
  const same = await (await request.get("/api/v1/smoke/same")).json();
  const teflonAged = same.particle_sizes.find((s: { material: string; aged: boolean }) => s.material === "teflon" && s.aged);
  await openLite(page, "/phenomena/smoke-detection#studio");
  const ctl = page.getByTestId("smoke-controls");
  await ctl.getByRole("radio", { name: "Teflon" }).click();
  await ctl.getByRole("radio", { name: "Aged 720 s" }).click();
  await expect(page.getByTestId("smoke-measured")).toContainText(`${teflonAged.d10_nm} nm`);
  await expect(page.getByTestId("measured-label")).toContainText("aged 720 s");
  await page.getByTestId("smoke-next").click();
  await page.getByTestId("smoke-next").click();
  await expect(page.getByTestId("smoke-stage-text")).toContainText("Stage 3:");
  await page.getByTestId("smoke-prev").click();
  await expect(page.getByTestId("smoke-stage-text")).toContainText("Stage 2:");
  // paused: no rendering, and the stage does not move on by itself
  await page.getByTestId("motion-toggle").click();
  await page.waitForTimeout(1200);
  await expect(page.getByTestId("smoke-stage-text")).toContainText("Stage 2:");
  await page.getByTestId("studio-reset-all").click();
  await expect(page.getByTestId("smoke-stage-text")).toContainText("Stage 1:");
  await expect(ctl.getByRole("radio", { name: "Kapton" })).toHaveAttribute("aria-checked", "true");
  await expect(ctl.getByRole("radio", { name: "Fresh" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByTestId("motion-toggle")).toHaveAttribute("aria-pressed", "true");
});

for (const [name, path] of [["FLEX", "/phenomena/flame-extinction#studio"], ["BASS-II", "/phenomena/flame-spread#studio"], ["SAFFIRE-I", "/phenomena/spacecraft-fire#studio"]] as const) {
  test(`${name} studio: visible Play/Pause stops and resumes rendering; Hide/Show controls still work`, async ({ page }) => {
    const errs = consoleErrors(page);
    await page.goto(path);
    const host = page.getByTestId("lab-canvas-host");
    await host.scrollIntoViewIfNeeded();
    await expect(host.locator("canvas")).toBeVisible({ timeout: 60_000 });
    const loop = page.getByTestId("science-studio").locator("[data-frameloop]");
    const btn = page.getByTestId("motion-toggle");
    await expect(btn).toHaveAttribute("aria-pressed", "true");
    await expect(loop).toHaveAttribute("data-frameloop", "always");
    await btn.click();
    await expect(btn).toHaveAccessibleName("Play animation");
    await expect(loop).toHaveAttribute("data-frameloop", "demand");
    await page.waitForTimeout(300);
    expect(await framesDuring(page)).toBeLessThanOrEqual(2);
    await btn.click();
    await expect(loop).toHaveAttribute("data-frameloop", "always");
    expect(await framesDuring(page)).toBeGreaterThan(10);
    await page.getByTestId("toggle-controls").click();
    await expect(page.getByTestId("studio-layout")).toHaveAttribute("data-controls", "hidden");
    await page.getByTestId("toggle-controls").click();
    await expect(page.getByTestId("studio-layout")).toHaveAttribute("data-controls", "shown");
    expect(errs).toEqual([]);
  });
}

test("NASA CFI-G clip on the Gaseous Flame page: play, pause, replay, seek, muted; nothing autoplays", async ({ page }) => {
  await page.goto("/phenomena/gaseous-flames");
  const player = page.getByTestId("gas-footage").getByTestId("clip-player");
  const video = player.getByTestId("clip-video");
  await video.scrollIntoViewIfNeeded();
  await expect(player).toHaveAttribute("data-state", "idle");
  expect(await video.evaluate((v: HTMLVideoElement) => ({ paused: v.paused, muted: v.muted, controls: v.controls, preload: v.preload })))
    .toEqual({ paused: true, muted: true, controls: true, preload: "none" });
  await video.evaluate((v: HTMLVideoElement) => v.play());
  await expect(player).toHaveAttribute("data-state", "playing", { timeout: 30_000 });
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime), { timeout: 15_000 }).toBeGreaterThan(0.5);
  await video.evaluate((v: HTMLVideoElement) => v.pause());
  await expect(player).toHaveAttribute("data-state", "paused");
  await expect(player.getByTestId("clip-status")).toHaveText("Paused");
  await video.evaluate((v: HTMLVideoElement) => { v.currentTime = 10; });
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => Math.round(v.currentTime))).toBe(10);
  await player.getByTestId("clip-replay").click();
  await expect(player).toHaveAttribute("data-state", "playing");
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime)).toBeLessThan(5);
  await video.evaluate((v: HTMLVideoElement) => { v.muted = false; });
  expect(await video.evaluate((v: HTMLVideoElement) => v.muted)).toBe(false);
  await video.evaluate((v: HTMLVideoElement) => v.pause());
  await expect(page.getByTestId("gas-footage")).toContainText("not tied to a data row");
});

test("a clip that cannot load shows an error with the NASA source, not a dead player", async ({ page }) => {
  await page.route("**/media/cfi-g-cool-flame-video/clip.mp4", (r) => r.fulfill({ status: 404, body: "" }));
  await page.goto("/phenomena/gaseous-flames");
  const player = page.getByTestId("gas-footage").getByTestId("clip-player");
  await player.scrollIntoViewIfNeeded();
  // a 404 source never resolves play(): start it without waiting for the promise
  await player.getByTestId("clip-video").evaluate((v: HTMLVideoElement) => { void v.play().catch(() => undefined); });
  await expect(player).toHaveAttribute("data-state", "error", { timeout: 30_000 });
  await expect(player.getByTestId("media-error")).toContainText("could not be loaded");
  await expect(player.getByTestId("media-error").getByRole("link")).toHaveAttribute("href", /nasa\.gov/);
});

test("SAFFIRE-I NASA animation: play on request, replay restarts, still frame stops it", async ({ page }) => {
  await page.goto("/phenomena/spacecraft-fire?view=footage#studio");
  const p = page.getByTestId("footage-view").getByTestId("animation-player");
  await expect(p).toHaveAttribute("data-state", "still", { timeout: 30_000 });
  await p.getByTestId("animation-play").click();
  await expect(p).toHaveAttribute("data-state", "playing");
  await expect(p.locator("img")).toHaveAttribute("src", /animation\.webp\?run=0/);
  await p.getByTestId("animation-replay").click();
  await expect(p.locator("img")).toHaveAttribute("src", /animation\.webp\?run=1/);
  await p.getByTestId("animation-play").click();
  await expect(p).toHaveAttribute("data-state", "still");
  await expect(p.getByTestId("animation-replay")).toHaveCount(0);
});

test("Guided demo: start, five real steps, scenario switch, previous, restart, skip, exit; never sends a question", async ({ page }) => {
  const errs = consoleErrors(page);
  const asks: string[] = [];
  page.on("request", (r) => { if (r.url().includes("/assistant/ask")) asks.push(r.url()); });
  await page.goto("/");
  await page.getByTestId("start-demo").first().click();
  await expect(page).toHaveURL(/\/demo$/);
  const bar = page.getByTestId("demo-bar");
  await expect(bar).toHaveAttribute("data-step", "1");
  await expect(page.getByTestId("demo-count-investigations")).toHaveText("10");
  await page.getByTestId("demo-next").click();
  await expect(page).toHaveURL(/\/safety-explorer$/);
  await expect(bar).toHaveAttribute("data-step", "2");
  await expect(page.getByTestId("scenario-card-gaseous-flames")).toHaveAttribute("data-selected", "true");
  await page.getByTestId("demo-scenario-smoke-detection").click();
  await expect(page.getByTestId("scenario-card-smoke-detection")).toHaveAttribute("data-selected", "true");
  await page.getByTestId("demo-next").click();
  await expect(page).toHaveURL(/\/safety-explorer\/smoke-detection$/);
  await expect(page.getByTestId("ranked-PSI-102")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("demo-notes")).toContainText("105 nm fresh and 186 nm");
  await page.getByTestId("demo-next").click();
  await expect(page).toHaveURL(/\/phenomena\/smoke-detection\?material=kapton#studio$/);
  await expect(page.getByTestId("lite-studio")).toBeVisible();
  await page.getByTestId("demo-next").click();
  await expect(page).toHaveURL(/\/copilot\?draft=.*scenario=smoke-detection/);
  await expect(page.getByTestId("explorer-context")).toBeVisible();
  await expect(page.locator("#aq")).toHaveValue(/SAME particle-size information/);
  await expect(bar).toHaveAttribute("data-step", "5");
  await page.getByTestId("demo-prev").click();
  await expect(page).toHaveURL(/\/phenomena\/smoke-detection/);
  await expect(bar).toHaveAttribute("data-step", "4");
  await page.getByTestId("demo-skip").click();
  await expect(page).toHaveURL(/\/safety-explorer$/);
  await page.getByTestId("demo-restart").click();
  await expect(page).toHaveURL(/\/demo$/);
  await expect(bar).toHaveAttribute("data-step", "1");
  await expect(bar).toHaveAttribute("data-scenario", "smoke-detection");      // the chosen scenario is kept
  await page.getByTestId("demo-exit").click();
  await expect(page.getByTestId("demo-bar")).toHaveCount(0);
  await page.goto("/safety-explorer");
  await expect(page.getByTestId("demo-bar")).toHaveCount(0);
  expect(asks).toEqual([]);
  expect(errs).toEqual([]);
});

test("Guided demo default journey (A) opens the CFI-G evidence, charts and gas studio", async ({ page }) => {
  await page.goto("/safety-explorer");
  await page.getByTestId("start-demo").click();
  await page.getByTestId("demo-dot-3").click();
  await expect(page).toHaveURL(/\/safety-explorer\/gaseous-flames$/);
  await expect(page.getByTestId("ranked-PSI-159")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("demo-charts")).toHaveAttribute("href", "/phenomena/gaseous-flames?tab=cfig");
  await page.getByTestId("demo-next").click();
  await expect(page).toHaveURL(/\/phenomena\/gaseous-flames#studio$/);
  await expect(page.getByTestId("demo-notes")).toContainText("Table 3 event");
});

test("Explorer scenario switcher keeps one coherent workspace", async ({ page }) => {
  await page.goto("/safety-explorer/flame-spread");
  const sw = page.getByTestId("scenario-switcher");
  await expect(sw.getByRole("link", { name: /Flame Spread in Spacecraft Materials/ })).toHaveAttribute("aria-current", "page");
  await sw.getByRole("link", { name: /Droplet Flame Extinction/ }).click();
  await expect(page).toHaveURL(/\/safety-explorer\/droplet-extinction$/);
  await expect(page.getByTestId("ranked-PSI-69")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("scenario-switcher").getByRole("link", { name: /Droplet Flame Extinction/ })).toHaveAttribute("aria-current", "page");
});

import { expect, test, type Page } from "@playwright/test";

// Phase 11: immersive 3D studios. Collapsible setup panel, collapsible site navigation, fullscreen with the SAME
// canvas, video-player auto-hide chrome, explanation overlay, part labels, and the scientific statements that moved
// out of the viewport. No test sends a model request (assistant calls are counted and must stay at zero).
//
// Timing: most tests shorten the inactivity timeout to 1 s through a test hook (window.__SPACEFIRE_AUTOHIDE_MS) and
// use generous polling windows, so nothing depends on a tight delay. One test checks the real 3 s default.

type Stats = { mounts: number; live: number; camera?: number[] };
const stats = (page: Page) => page.evaluate(() => (window as unknown as { __spacefireLab?: Stats }).__spacefireLab ?? null);
const imm = (page: Page) => page.evaluate(() => {
  const h = window.__spacefireImmersive;
  return h ? { visible: h.visible(), pending: h.pending(), holds: h.holds() } : null;
});
const PAGE = { flex: "/phenomena/flame-extinction", bass: "/phenomena/flame-spread", saffire: "/phenomena/spacecraft-fire" } as const;
const FAST = 1000;

async function openStudio(page: Page, path: string) {
  await page.goto(path);
  const host = page.getByTestId("lab-canvas-host");
  await host.scrollIntoViewIfNeeded();
  await expect(host.locator("canvas")).toBeVisible({ timeout: 60_000 });
  await expect.poll(async () => (await stats(page))?.camera?.length ?? 0, { timeout: 60_000 }).toBe(3);
}
function countAssistant(page: Page) {
  const calls: string[] = [];
  page.on("request", (r) => { if (r.url().includes("/api/v1/assistant/")) calls.push(r.url()); });
  return calls;
}
const fastTimeout = (page: Page, ms = FAST) => page.addInitScript((v) => { (window as unknown as { __SPACEFIRE_AUTOHIDE_MS: number }).__SPACEFIRE_AUTOHIDE_MS = v; }, ms);
const studio = (page: Page) => page.getByTestId("science-studio");
const chromeState = (page: Page) => studio(page).getAttribute("data-chrome");

async function enterFullscreen(page: Page) {
  await page.getByTestId("enter-fullscreen").click();
  await expect(studio(page)).toHaveAttribute("data-immersive", /native|fallback/);
  const box = (await studio(page).boundingBox())!;
  const vp = page.viewportSize()!;
  expect(Math.round(box.width)).toBe(vp.width);
  expect(Math.round(box.height)).toBe(vp.height);
}
/** Reveal the chrome the way a person does: move the mouse over the scene. */
async function wiggle(page: Page) {
  const vp = page.viewportSize()!;
  await page.mouse.move(vp.width / 2, vp.height / 2);
  await page.mouse.move(vp.width / 2 + 7, vp.height / 2 + 5);
}
async function waitHidden(page: Page) {
  await expect.poll(() => chromeState(page), { timeout: 8000 }).toBe("hidden");
}

test.describe("Phase 11: normal page layout", () => {
  test("the setup panel hides and returns; the viewport widens; scene, tab, values and timeline are untouched", async ({ page }) => {
    const calls = countAssistant(page);
    await openStudio(page, PAGE.flex);
    // some state to preserve: methanol, a selected component (Layers tab), a stage
    await page.getByRole("radio", { name: "Methanol" }).click();
    await page.getByRole("tab", { name: "Layers" }).click();
    await page.getByTestId("timeline").getByTestId("stage-start").click();
    await page.getByTestId("timeline").getByTestId("stage-next").click();
    await expect(page.getByTestId("stage-chip")).toContainText("Stage 2 of 5");
    const mounts = (await stats(page))!.mounts;
    const before = (await page.getByTestId("viewport-box").boundingBox())!.width;

    const toggle = page.getByTestId("toggle-controls");
    await expect(toggle).toHaveText(/Hide controls/);
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await toggle.click();
    await expect(page.getByTestId("studio-panel")).toBeHidden();
    await expect(toggle).toHaveText(/Show controls/);
    await expect.poll(async () => (await page.getByTestId("viewport-box").boundingBox())!.width).toBeGreaterThan(before + 300);
    // the canvas follows the box (resized, not remounted)
    await expect.poll(async () => (await page.locator("canvas").boundingBox())!.width).toBeGreaterThan(before + 300);
    expect((await stats(page))!.mounts).toBe(mounts);
    await expect(page.getByTestId("stage-chip")).toContainText("Stage 2 of 5");

    // remembered for the session
    expect(await page.evaluate(() => sessionStorage.getItem("spacefire:studio-controls"))).toBe("hidden");

    await toggle.click();
    await expect(page.getByTestId("studio-panel")).toBeVisible();
    await expect(page.getByRole("tab", { name: "Layers" })).toHaveAttribute("aria-selected", "true");
    await page.getByRole("tab", { name: "Explore" }).click();
    await expect(page.getByRole("radio", { name: "Methanol" })).toHaveAttribute("aria-checked", "true");
    expect((await stats(page))!.mounts).toBe(mounts);

    // hidden state survives a reload in the same tab
    await toggle.click();
    await page.reload();
    await expect(page.getByTestId("toggle-controls")).toHaveText(/Show controls/, { timeout: 60_000 });
    await expect(page.getByTestId("studio-layout")).toHaveAttribute("data-controls", "hidden");
    await page.getByTestId("toggle-controls").click();
    expect(calls).toEqual([]);
  });

  test("the viewport banners are gone; a compact mode label stays, and the full statements sit beside the controls", async ({ page }) => {
    await openStudio(page, PAGE.flex);
    const vp = page.getByTestId("lab-viewport");
    await expect(vp.getByText("Conceptual visualization — not measured NASA output.", { exact: true })).toHaveCount(0);
    await expect(page.getByTestId("mode-chip")).toContainText("Conceptual 3D");
    await expect(page.getByTestId("mode-note")).toContainText("Conceptual visualization — not measured NASA output.");
    // NASA Evidence: the statement changes, and the measured size is labelled in the viewport (with its caveat)
    await page.goto(`${PAGE.bass}?mode=evidence&record=bass2%3A27`);
    await expect(page.getByTestId("mode-note")).toContainText("NASA Evidence — measured values are in the panel; 3D geometry stays illustrative unless marked as measured.", { timeout: 60_000 });
    await expect(page.getByTestId("mode-chip")).toContainText("NASA Evidence");
    await expect(page.getByTestId("measured-label")).toContainText("width 2 cm (CSV, nominal)", { timeout: 60_000 });
    // Earth vs Microgravity: simple labels; the conceptual caveat sits right under the viewport
    await openStudio(page, `${PAGE.flex}?view=gravity`);
    await expect(page.getByRole("radio", { name: "Earth vs Microgravity" })).toHaveAttribute("aria-checked", "true");
    const caps = page.getByTestId("split-captions").locator("p");
    await expect(caps.nth(0)).toHaveText("Earth");
    await expect(caps.nth(1)).toHaveText("Microgravity");
    await expect(page.getByTestId("split-note")).toContainText("Conceptual comparison — not paired Earth and ISS measurements");
    await expect(vp.getByTestId("split-note")).toHaveCount(0);       // no longer floating over the scene
    await page.getByRole("tab", { name: "Explore" }).click();
    await expect(page.getByRole("radio", { name: "Earth", exact: true })).toBeVisible();
    await expect(page.getByRole("radio", { name: /1 g/ })).toHaveCount(0);
  });

  test("Part labels toggle shows and hides the 3D component labels without losing the selection", async ({ page }) => {
    await openStudio(page, `${PAGE.saffire}?component=fans`);
    const labels = page.locator("[data-annotation]");
    await expect.poll(() => labels.count()).toBeGreaterThan(0);
    const t = page.getByTestId("labels-toggle");
    await expect(t).toHaveAttribute("aria-pressed", "true");
    await t.click();
    await expect(t).toHaveAttribute("aria-pressed", "false");
    await expect(labels).toHaveCount(0);
    await expect(page).toHaveURL(/component=fans/);
    await expect(page.getByRole("tab", { name: "Layers" })).toHaveAttribute("aria-selected", "true");
    await t.click();
    await expect.poll(() => labels.count()).toBeGreaterThan(0);
  });

  test("the site navigation collapses to an icon rail, keeps working, and is remembered", async ({ page }) => {
    await page.goto(PAGE.flex);
    const nav = page.getByTestId("site-nav");
    const toggle = page.getByTestId("nav-toggle");
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    const wide = (await nav.boundingBox())!.width;
    const mainBefore = (await page.locator("main").boundingBox())!.width;
    expect(wide).toBeGreaterThan(250);

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(toggle).toHaveAccessibleName("Expand sidebar");
    await expect.poll(async () => (await nav.boundingBox())!.width).toBeLessThan(80);
    expect((await page.locator("main").boundingBox())!.width).toBeGreaterThanOrEqual(mainBefore);
    // icons stay usable; the active page is marked; names stay accessible and show as a tooltip on focus
    const main = page.getByRole("navigation", { name: "Main" });
    await expect(main.locator('[aria-current="page"]')).toHaveCount(1);
    const link = main.getByRole("link", { name: /Flame Spread & Material Behavior/ });
    await link.hover();
    expect(await link.evaluate((el) => getComputedStyle(el, "::after").content)).toContain("Flame Spread & Material Behavior");
    // keyboard: from the toggle, Tab reaches the first icon and its name appears as a tooltip too
    await toggle.focus();
    await page.keyboard.press("Tab");
    const home = main.getByRole("link", { name: "Home" });
    await expect(home).toBeFocused();
    expect(await home.evaluate((el) => getComputedStyle(el, "::after").content)).toContain("Home");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await link.click();
    await expect(page).toHaveURL(/\/phenomena\/flame-spread/);
    await expect(page.getByTestId("nav-toggle")).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toContainText("Flame Spread & Material Behavior");

    // remembered across a full reload, applied before paint (no wide flash): the html attribute is in the first HTML
    await page.reload();
    expect(await page.evaluate(() => document.documentElement.dataset.nav)).toBe("collapsed");
    await expect.poll(async () => (await page.getByTestId("site-nav").boundingBox())?.width ?? 999, { timeout: 30_000 }).toBeLessThan(80);
    await page.getByTestId("nav-toggle").click();
    await expect.poll(async () => (await page.getByTestId("site-nav").boundingBox())?.width ?? 0).toBeGreaterThan(250);
    expect(await page.evaluate(() => localStorage.getItem("spacefire:nav"))).toBe("expanded");
  });
});

test.describe("Phase 11: fullscreen studios", () => {
  test("FLEX, BASS-II and SAFFIRE-I enter and leave fullscreen with the same canvas and state", async ({ page }) => {
    const calls = countAssistant(page);
    for (const [path, id] of [[PAGE.flex, "flex"], [PAGE.bass, "bass"], [PAGE.saffire, "saffire"]] as const) {
      await openStudio(page, `${path}?component=${id === "flex" ? "flame" : "sample"}`);
      const url = page.url();
      const s0 = (await stats(page))!;
      await enterFullscreen(page);
      // the site navigation and page header are not shown over the model
      const vp = page.viewportSize()!;
      const topEl = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest("[data-testid=science-studio]") !== null, [40, vp.height / 2]);
      expect(topEl, "the studio covers the navigation area").toBe(true);
      await expect(page.locator("canvas")).toHaveCount(1);
      const s1 = (await stats(page))!;
      expect(s1.mounts).toBe(s0.mounts);
      expect(s1.live).toBe(1);
      await expect(page.getByTestId("fs-playback")).toBeVisible();
      await expect(page.getByTestId("fs-topbar")).toContainText(id === "flex" ? "FLEX" : id === "bass" ? "BASS-II" : "SAFFIRE-I");
      // a component being inspected keeps its label in fullscreen
      await expect.poll(() => page.locator("[data-annotation]").count()).toBeGreaterThan(0);
      await wiggle(page);
      await page.getByTestId("fs-exit").click();
      await expect(studio(page)).not.toHaveAttribute("data-immersive", /./);
      await expect(page.getByTestId("enter-fullscreen")).toBeFocused();
      expect(page.url()).toBe(url);
      expect((await stats(page))!.mounts).toBe(s0.mounts);
      expect(await page.evaluate(() => document.fullscreenElement)).toBeNull();
      expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe("");
    }
    expect(calls).toEqual([]);
  });

  test("native fullscreen when granted; browser exit (Esc, F11, UI) is followed", async ({ page }) => {
    await openStudio(page, PAGE.bass);
    await page.getByTestId("enter-fullscreen").click();
    const mode = await studio(page).getAttribute("data-immersive");
    test.info().annotations.push({ type: "fullscreen-path", description: mode ?? "none" });
    console.log(`fullscreen path in this browser: ${mode}`);
    if (mode === "native") {
      expect(await page.evaluate(() => document.fullscreenElement?.id)).toBe("studio");
      await page.evaluate(() => document.exitFullscreen());           // what the browser does on Esc
      await expect(studio(page)).not.toHaveAttribute("data-immersive", /./);
    } else {
      // this browser declined: the page says so instead of pretending
      await expect(page.getByTestId("fs-notice")).toContainText("declined fullscreen");
      await page.keyboard.press("Escape");
      await expect(studio(page)).not.toHaveAttribute("data-immersive", /./);
    }
  });

  test("when the browser refuses or lacks fullscreen: honest notice, expanded fallback, Escape exits", async ({ page }) => {
    await page.addInitScript(() => { Element.prototype.requestFullscreen = () => Promise.reject(new Error("denied")); });
    await openStudio(page, PAGE.flex);
    await enterFullscreen(page);
    await expect(studio(page)).toHaveAttribute("data-immersive", "fallback");
    await expect(page.getByTestId("fs-notice")).toContainText("The browser declined fullscreen");
    expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe("hidden");
    await page.keyboard.press("Escape");
    await expect(studio(page)).not.toHaveAttribute("data-immersive", /./);
    await expect(page.getByTestId("enter-fullscreen")).toBeFocused();

    await page.addInitScript(() => { Object.defineProperty(Document.prototype, "fullscreenEnabled", { get: () => false }); });
    await openStudio(page, PAGE.flex);
    await page.getByTestId("enter-fullscreen").click();
    await expect(studio(page)).toHaveAttribute("data-immersive", "fallback");
    await expect(page.getByTestId("fs-notice")).toContainText("isn't available in this browser");
  });
});

test.describe("Phase 11: auto-hiding controls", () => {
  test("real default: shown on entry, hidden after about 3 s, cursor hidden too", async ({ page }) => {
    await openStudio(page, PAGE.flex);
    await enterFullscreen(page);
    expect(await chromeState(page)).toBe("shown");
    expect((await imm(page))!.pending).toBe(1);
    const t0 = Date.now();
    await waitHidden(page);
    const took = Date.now() - t0;
    expect(took).toBeGreaterThan(2000);
    expect(took).toBeLessThan(6000);
    const cursor = await page.getByTestId("lab-canvas-host").evaluate((el) => getComputedStyle(el).cursor);
    expect(cursor).toBe("none");
  });

  test("mouse reveals, stillness hides, playback continues, hidden controls do not intercept clicks", async ({ page }) => {
    await fastTimeout(page);
    await openStudio(page, PAGE.flex);
    await enterFullscreen(page);
    await page.getByTestId("fs-play").click();
    await expect(page.getByTestId("fs-play")).toHaveAccessibleName("Pause");
    await page.mouse.move(5, 300);                                   // away from the bars
    await waitHidden(page);
    // playback keeps going while the chrome is hidden
    const s1 = await page.getByTestId("fs-scrub").inputValue();
    await expect.poll(() => page.getByTestId("fs-scrub").inputValue(), { timeout: 8000 }).not.toBe(s1);
    // hidden chrome: inert, no pointer events; a click where Play was does not pause
    await expect(page.getByTestId("fs-playback")).toHaveJSProperty("inert", true);
    const pe = await page.getByTestId("fs-playback").evaluate((el) => getComputedStyle(el).pointerEvents);
    expect(pe).toBe("none");
    // hit-testing passes through the hidden bar to the scene (a real pointer first reveals the bar by moving)
    const pb = (await page.getByTestId("fs-play").boundingBox())!;
    const hit = await page.evaluate(([x, y]) => {
      const el = document.elementFromPoint(x, y);
      return { inBar: !!el?.closest("[data-testid=fs-playback]"), tag: el?.tagName };
    }, [pb.x + pb.width / 2, pb.y + pb.height / 2]);
    expect(hit.inBar).toBe(false);
    await expect(page.getByTestId("fs-play")).toHaveAccessibleName("Pause");
    // moving reveals, stopping hides again
    await wiggle(page);
    await page.mouse.move(5, 300);
    expect(await chromeState(page)).toBe("shown");
    await waitHidden(page);
    await wiggle(page);
    await expect.poll(() => chromeState(page)).toBe("shown");
  });

  test("dragging the timeline, an open setup drawer and keyboard focus keep the controls shown", async ({ page }) => {
    await fastTimeout(page);
    await openStudio(page, PAGE.flex);
    await enterFullscreen(page);
    // drag the scrubber and hold it
    const sb = (await page.getByTestId("fs-scrub").boundingBox())!;
    await page.mouse.move(sb.x + sb.width * 0.2, sb.y + sb.height / 2);
    await page.mouse.down();
    await page.mouse.move(sb.x + sb.width * 0.4, sb.y + sb.height / 2, { steps: 4 });
    await page.waitForTimeout(FAST * 2.5);
    expect(await chromeState(page)).toBe("shown");
    expect((await imm(page))!.holds).toContain("press");
    await page.mouse.up();
    await expect(page.getByTestId("fs-stage")).toContainText(/Stage \d\/5/);
    await page.mouse.move(5, 300);
    await waitHidden(page);

    // the setup drawer: opens with focus inside, keeps everything shown, Escape closes it and returns focus
    await wiggle(page);
    await page.getByTestId("fs-controls").click();
    await expect(page.getByTestId("fs-controls")).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByTestId("studio-panel")).not.toHaveJSProperty("inert", true);
    await expect(page.getByRole("tab", { name: "Explore" })).toBeFocused();
    await page.mouse.move(5, 300);
    await page.waitForTimeout(FAST * 2.5);
    expect(await chromeState(page)).toBe("shown");
    // the drawer's controls work and the scene keeps the change
    await page.getByRole("radio", { name: "Methanol" }).click();
    await expect(page.getByRole("radio", { name: "Methanol" })).toHaveAttribute("aria-checked", "true");
    await page.getByRole("tab", { name: "Explore" }).focus();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("fs-controls")).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByTestId("fs-controls")).toBeFocused();
    await expect(studio(page)).toHaveAttribute("data-immersive", /./);    // still fullscreen

    // keyboard: focus on a control holds; Tab from hidden reveals first
    await page.waitForTimeout(FAST * 2.5);
    expect(await chromeState(page)).toBe("shown");
    expect((await imm(page))!.holds).toContain("focus");
    await page.mouse.click(5, 300);                                    // a pointer user again: focus leaves the bar
    await waitHidden(page);
    await page.keyboard.press("Tab");
    await expect.poll(() => chromeState(page)).toBe("shown");
    const focusedInChrome = await page.evaluate(() => !!document.activeElement?.closest("[data-chrome-item],[data-immersive-panel]"));
    expect(focusedInChrome).toBe(true);
    await page.waitForTimeout(FAST * 2.5);
    expect(await chromeState(page)).toBe("shown");
  });

  test("exiting clears the inactivity timer; re-entering never duplicates it", async ({ page }) => {
    await fastTimeout(page);
    await openStudio(page, PAGE.saffire);
    for (let i = 0; i < 3; i++) {
      await page.getByTestId("enter-fullscreen").click();
      await expect(studio(page)).toHaveAttribute("data-immersive", /./);
      expect((await imm(page))!.pending).toBe(1);
      await page.keyboard.press("Escape");
      await expect(studio(page)).not.toHaveAttribute("data-immersive", /./);
      expect((await imm(page))!.pending).toBe(0);
      expect(await chromeState(page)).toBe("shown");
    }
    // leaving the page while fullscreen leaves nothing behind
    await page.getByTestId("enter-fullscreen").click();
    await page.goto("/methodology");
    await page.waitForTimeout(FAST * 1.5);
    expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe("");
  });

  test("reduced motion: no fades, but auto-hide and every playback control still work", async ({ page }) => {
    await fastTimeout(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openStudio(page, PAGE.bass);
    await enterFullscreen(page);
    const dur = await page.getByTestId("fs-playback").evaluate((el) => parseFloat(getComputedStyle(el).transitionDuration));
    expect(dur).toBeLessThan(0.01);
    await page.getByTestId("fs-next").click();
    await expect(page.getByTestId("fs-stage")).toContainText("Stage 1/3");
    await page.getByTestId("fs-play").click();
    await page.mouse.move(5, 300);
    await waitHidden(page);
    await wiggle(page);
    await expect.poll(() => chromeState(page)).toBe("shown");
  });
});

test.describe("Phase 11: explanations, labels and evidence in fullscreen", () => {
  test("explanations follow the stage, keep their sources, and stay open while the controls fade", async ({ page }) => {
    await fastTimeout(page);
    const calls = countAssistant(page);
    await openStudio(page, PAGE.flex);
    await enterFullscreen(page);
    await expect(page.getByTestId("fs-explanation")).toHaveCount(0);       // starts hidden
    await page.getByTestId("fs-explain").click();
    const ex = page.getByTestId("fs-explanation");
    await expect(ex).toHaveAttribute("data-stage", "none");
    await ex.getByTestId("fs-explain-start").click();
    await expect(ex).toHaveAttribute("data-stage", "initial");
    for (const id of ["ignition", "burning", "regression"]) {
      await page.getByTestId("fs-next").click();
      await expect(ex).toHaveAttribute("data-stage", id);
    }
    await expect(ex.getByTestId("fs-explain-title")).toHaveText("Droplet regression");
    // the same stage everywhere: the page explainer behind it agrees
    await expect(page.getByTestId("stage-explainer")).toHaveAttribute("data-stage", "regression");
    await ex.getByTestId("fs-why").click();
    await expect(ex.getByTestId("fs-why-body")).toContainText("d²");
    await ex.getByTestId("fs-sources").click();
    await expect(ex.getByTestId("fs-sources-body").getByRole("link").first()).toBeVisible();
    await expect(ex.getByTestId("fs-mode-note")).toHaveText("Conceptual visualization — not measured NASA output.");
    // the chrome fades; the explanation stays
    await page.mouse.move(700, 450);
    await page.mouse.move(705, 452);
    await waitHidden(page);
    await expect(ex).toBeVisible();
    // the context changes the explanation: methanol has its own fuel line
    await wiggle(page);
    await page.getByTestId("fs-controls").click();
    await page.getByRole("radio", { name: "Methanol" }).click();
    await expect(ex).toContainText("Methanol:");
    await page.getByTestId("fs-panel-close").click();
    await ex.getByTestId("fs-explain-close").click();
    await expect(page.getByTestId("fs-explanation")).toHaveCount(0);
    await expect(page.getByTestId("fs-explain")).toBeFocused();
    expect(calls).toEqual([]);
  });

  test("part labels start hidden in fullscreen and toggle; they never change the page's own setting", async ({ page }) => {
    await openStudio(page, PAGE.bass);
    const labels = page.locator("[data-annotation]");
    await expect.poll(() => labels.count()).toBeGreaterThan(0);
    await enterFullscreen(page);
    await expect(labels).toHaveCount(0);
    const t = page.getByTestId("fs-labels");
    await expect(t).toHaveAttribute("aria-pressed", "false");
    await t.click();
    await expect.poll(() => labels.count()).toBeGreaterThan(0);
    await t.click();
    await expect(labels).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(studio(page)).not.toHaveAttribute("data-immersive", /./);
    await expect.poll(() => labels.count()).toBeGreaterThan(0);          // page labels as before
  });

  test("NASA Evidence, Compare with NASA and footage keep their provenance in fullscreen", async ({ page }) => {
    await openStudio(page, `${PAGE.flex}?mode=evidence&record=flex%3A180`);
    await enterFullscreen(page);
    await expect(page.getByTestId("fs-mode")).toContainText("NASA Evidence");
    await expect(page.getByTestId("fs-context")).toContainText("Drawn to measured size: test");
    await page.keyboard.press("Escape");

    await openStudio(page, `${PAGE.flex}?view=nasa&record=flex%3A180`);
    await enterFullscreen(page);
    await expect(page.getByTestId("model-label")).toHaveText("3D conceptual model");
    const ev = page.getByTestId("evidence-compare");
    await expect(ev).toBeVisible();
    await expect(ev.locator("figcaption").first()).toContainText(/NASA/);
    await page.keyboard.press("Escape");

    await page.goto(`${PAGE.saffire}?view=footage`);
    await expect(page.getByTestId("footage-view")).toBeVisible({ timeout: 60_000 });
    await page.getByTestId("enter-fullscreen").click();
    await expect(studio(page)).toHaveAttribute("data-immersive", /./);
    await expect(page.getByTestId("footage-view")).toBeVisible();
    await expect(page.locator("iframe")).toHaveCount(0);                   // nothing plays without a click
    await expect(page.getByTestId("fs-caveat")).toHaveText("Explanatory steps — not a timeline of the burn");
  });
});

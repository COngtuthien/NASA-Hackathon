import { expect, test, type Page } from "@playwright/test";

// Phase 10: combustion storytelling. One timeline store drives the stage everywhere (3D, chip, explanation,
// highlighted components); Earth vs microgravity share that stage; BASS-II and SAFFIRE-I get their own stage models.
// No test sends a model request: assistant calls are counted and must stay at zero.

type Stats = { mounts: number; camera?: number[] };
const stats = (page: Page) => page.evaluate(() => (window as unknown as { __spacefireLab?: Stats }).__spacefireLab ?? null);
const PAGE = { flex: "/phenomena/flame-extinction", bass: "/phenomena/flame-spread", saffire: "/phenomena/spacecraft-fire" } as const;

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
const stageLine = (page: Page) => page.getByTestId("timeline").getByTestId("timeline-stage");

test.describe("Phase 10: combustion stage storytelling", () => {
  test("FLEX: five stages driven by one timeline; every control moves the whole explanation", async ({ page }) => {
    const calls = countAssistant(page);
    await openStudio(page, PAGE.flex);
    const tl = page.getByTestId("timeline");
    const ex = tl.getByTestId("stage-explainer");
    await expect(ex).toHaveAttribute("data-stage", "none");
    await tl.getByTestId("stage-start").click();
    await expect(ex).toHaveAttribute("data-stage", "initial");
    await expect(stageLine(page)).toContainText("Stage 1 of 5 — Initial droplet");
    await expect(page.getByTestId("stage-chip")).toHaveText("Stage 1 of 5 · Initial droplet");
    await expect(tl.getByTestId("stage-prev")).toBeDisabled();
    const order = ["ignition", "burning", "regression", "end"];
    for (const id of order) {
      await tl.getByTestId("stage-next").click();
      await expect(ex).toHaveAttribute("data-stage", id);
    }
    await expect(stageLine(page)).toContainText("Stage 5 of 5 — Extinction or end of burning");
    await expect(tl.getByTestId("stage-next")).toBeDisabled();
    await tl.getByTestId("stage-prev").click();
    await expect(ex).toHaveAttribute("data-stage", "regression");
    // scrubbing selects the stage under the slider; the stage list marks it
    await tl.getByTestId("timeline-scrub").fill("25");
    await expect(ex).toHaveAttribute("data-stage", "burning");
    await expect(tl.getByRole("button", { name: "Established burning" })).toHaveAttribute("aria-current", "step");
    await expect(tl.getByTestId("timeline-scrub")).toHaveAttribute("aria-valuetext", /stage: Established burning/);
    // direct stage selection
    await tl.getByRole("button", { name: "Ignition" }).click();
    await expect(ex).toHaveAttribute("data-stage", "ignition");
    // play advances the stage on its own; pause holds it; restart returns to the first stage
    await tl.getByTestId("timeline-speed").selectOption("2");
    await tl.getByTestId("timeline-play").click();
    await expect.poll(async () => ex.getAttribute("data-stage"), { timeout: 20_000 }).toBe("burning");
    await tl.getByTestId("timeline-play").click();
    const held = await ex.getAttribute("data-stage");
    await page.waitForTimeout(700);
    expect(await ex.getAttribute("data-stage")).toBe(held);
    await tl.getByTestId("timeline-reset").click();
    await expect(ex).toHaveAttribute("data-stage", "initial");
    expect(calls).toEqual([]);
  });

  test("progressive disclosure: why, NASA evidence with its basis, and inspection of the stage's component", async ({ page }) => {
    await openStudio(page, PAGE.flex);
    const tl = page.getByTestId("timeline");
    await tl.getByRole("button", { name: "Established burning" }).click();
    const why = tl.getByTestId("stage-why");
    await expect(why).toHaveAttribute("aria-expanded", "false");
    await expect(tl.getByTestId("stage-why-body")).toBeHidden();
    await why.press("Enter");
    await expect(tl.getByTestId("stage-why-body")).toContainText("The vapour diffuses outward, oxygen diffuses inward");
    await expect(tl.getByTestId("stage-why-body")).toContainText("Particle and arrow motion shows direction only, not measured velocity.");
    await tl.getByTestId("stage-evidence").click();
    const ev = tl.getByTestId("stage-evidence-body");
    await expect(ev.getByRole("link", { name: /Liu et al\. 2013, PDF p\.2/ })).toHaveAttribute("href", "/api/v1/documents/2g11-070he-0310/file#page=2");
    const res = await page.request.get("/api/v1/documents/2g11-070he-0310/file");
    expect(res.status()).toBe(200);
    // the explanation stays open while the stage changes, and its content follows the stage
    await tl.getByTestId("stage-next").click();
    await expect(tl.getByTestId("stage-why-body")).toContainText("The classical d²-law assumes a quasi-steady");
    await tl.getByTestId("stage-inspect").click();                                       // "Inspect the shrinking droplet"
    await expect(page).toHaveURL(/component=droplet/);
    // a component the stage does not draw explains itself instead of showing an empty inspector
    await tl.getByRole("button", { name: "Initial droplet" }).click();
    await page.getByTestId("science-studio").getByRole("tab", { name: "Layers" }).click();
    await page.getByRole("button", { name: /^Flame envelope/ }).first().click();
    await expect(tl.getByTestId("stage-absent")).toHaveText("No flame exists before ignition, so it is not drawn in this stage.");
    await expect(page.getByTestId("science-studio").getByText(/not drawn in this stage: no flame exists before ignition/).first()).toBeVisible();
  });

  test("selected test: the stage explanation uses its recorded values and its own outcome", async ({ page }) => {
    await openStudio(page, `${PAGE.flex}?record=flex%3A180`);
    const tl = page.getByTestId("timeline");
    await tl.getByRole("button", { name: "Droplet regression" }).click();
    const rec = tl.getByTestId("stage-record");
    await expect(rec).toContainText("Test C02H101");
    await expect(rec).toContainText("D₀²/K = 28.2 s");
    await expect(rec).toContainText("calculated from D₀ = 3.4 mm and K = 0.41 mm²/s; not a measurement and not the extinction time");
    await expect(rec).toContainText("Recorded: burn time 4.5 s, test end Extinction");
    await tl.getByRole("button", { name: /Extinction or end/ }).click();
    await expect(rec).toHaveText(/Recorded as ‘Extinction’: the visible flame went out at a recorded diameter of 3\.13 mm\. The record does not state the extinction mechanism\./);
    await expect(page).toHaveURL(/record=flex%3A180/);                                   // the selection is kept
    // a Disruption test is not forced into the extinction story
    await openStudio(page, `${PAGE.flex}?record=flex%3A1`);
    await page.getByTestId("timeline").getByRole("button", { name: /Extinction or end/ }).click();
    await expect(page.getByTestId("timeline").getByTestId("stage-record")).toContainText("How this burn ended cannot be determined from the available evidence");
  });

  test("Earth vs microgravity: one shared stage, distinct explanations, stage-specific why, attributed NASA image, one canvas", async ({ page }) => {
    const calls = countAssistant(page);
    await openStudio(page, `${PAGE.flex}?view=gravity`);
    const mounts = (await stats(page))!.mounts;
    const caps = page.getByTestId("split-captions").locator("p");
    await expect(caps.nth(0)).toHaveText("Earth");
    await expect(caps.nth(1)).toHaveText("Microgravity");
    await expect(page.getByTestId("split-note")).toContainText("Conceptual comparison — not paired Earth and ISS measurements");
    const tl = page.getByTestId("timeline");
    await tl.getByRole("button", { name: "Established burning" }).click();
    const g = tl.getByTestId("gravity-stage");
    await expect(g).toContainText("Conceptual comparison — not paired Earth and ISS measurements.");
    await expect(g.getByTestId("gravity-earth")).toContainText("buoyancy-driven convection");
    await expect(g.getByTestId("gravity-micro")).toContainText("nearly spherical");
    const why = g.getByTestId("why-different");
    await why.click();
    const body = g.getByTestId("why-different-body");
    await expect(body).toContainText("Gravity turns density differences into flow");
    await expect(body.getByRole("link", { name: /FLEX ERD v4, PDF p\.64/ })).toHaveAttribute("href", "/api/v1/documents/flex-eird-v4/file#page=64");
    await expect(body.locator('img[src^="/media/flex-1g-vs-microgravity/"]')).toHaveCount(1);
    await expect(body.getByRole("link", { name: /NASA Science, Flame Extinguishment Experiment/ })).toHaveAttribute("href", /science\.nasa\.gov/);
    await expect(body).toContainText("not a paired FLEX measurement");
    // next stage: both sides move together and the "why" changes with it
    await tl.getByTestId("stage-next").click();
    await expect(tl.getByTestId("stage-explainer")).toHaveAttribute("data-stage", "regression");
    await expect(page.getByTestId("stage-chip")).toHaveText("Stage 4 of 5 · Droplet regression");
    await expect(body).toContainText("so the rate cannot be read off the flame shape");
    await expect(body).toContainText("no faster-or-slower claim");
    await tl.getByTestId("stage-next").click();
    await expect(body).toContainText("Flame shape alone does not decide when or how a flame goes out");
    await tl.getByRole("button", { name: "Initial droplet" }).click();
    await expect(body).toContainText("no flame to compare");
    await expect(page.getByTestId("stage-chip")).toHaveCount(1);                         // one stage for both views
    await expect(page.getByTestId("lab-canvas-host").locator("canvas")).toHaveCount(1);
    expect((await stats(page))!.mounts).toBe(mounts);                                    // no remount across stages
    // nothing numeric is invented for Earth
    await expect(g).not.toContainText(/\d+(\.\d+)?\s*(s|mm\/s|mm²\/s|°C|K)\b/);
    expect(calls).toEqual([]);
  });

  test("fuels: methanol and n-heptane explanations differ; Compare Fuels keeps each fuel separate", async ({ page }) => {
    await openStudio(page, PAGE.flex);
    const tl = page.getByTestId("timeline");
    await tl.getByRole("button", { name: "Established burning" }).click();
    await expect(tl.getByTestId("stage-fuel")).toContainText("n-Heptane: n-Heptane is a sooting fuel");
    await tl.getByRole("button", { name: /Extinction or end/ }).click();
    await expect(tl.getByTestId("stage-fuel")).toContainText("low-temperature second stage");
    await expect(tl.getByTestId("stage-fuel")).toContainText("not every test shows it");
    await page.getByTestId("science-studio").getByRole("radio", { name: "Methanol" }).first().click();
    await expect(tl.getByTestId("stage-fuel")).toContainText("Methanol: Large methanol droplets have shown classical radiative extinction");
    await tl.getByRole("button", { name: "Established burning" }).click();
    await expect(tl.getByTestId("stage-fuel")).toContainText("non-sooting alcohol fuel, so no soot shell is drawn");
    await page.getByTestId("science-studio").getByRole("radio", { name: "Compare fuels" }).click();
    const ctx = tl.getByTestId("stage-context");
    await expect(ctx).toContainText("n-Heptane:");
    await expect(ctx).toContainText("Methanol:");
    await expect(ctx).toContainText("it does not mean the two fuels burn for equal times");
  });

  test("BASS-II: material- and flow-aware stages; measured rates separate from the conceptual front", async ({ page }) => {
    await openStudio(page, `${PAGE.bass}?record=bass2%3A33`);
    const tl = page.getByTestId("timeline");
    await tl.getByTestId("stage-start").click();
    await expect(stageLine(page)).toContainText("Stage 1 of 3 — Ignition");
    await expect(tl.getByTestId("stage-record")).toContainText("width 1 cm in the CSV (nominal), 1.2 cm in Table 5.1 (actual); both kept");
    await tl.getByTestId("stage-next").click();
    await expect(stageLine(page)).toContainText("toward the incoming air (opposed spread)");
    await expect(tl.getByTestId("stage-record")).toContainText("measured spread rate 0.106, 0.099, 0.083, 0.07 mm/s at 10, 6, 5, 3 cm/s (Table 5.1, PDF p.65). The animated front is not scaled to it.");
    await tl.getByTestId("stage-why").click();
    await expect(tl.getByTestId("stage-why-body")).toContainText("its speed is not a measured spread rate");
    await tl.getByTestId("stage-next").click();
    await expect(tl.getByTestId("stage-record")).toContainText("no recorded outcome in the local records; how this test ended cannot be inferred");
    // a test whose report records an outcome shows it as recorded
    await openStudio(page, `${PAGE.bass}?record=bass2%3A123`);
    await page.getByTestId("timeline").getByRole("button", { name: "End of spread" }).click();
    await expect(page.getByTestId("timeline").getByTestId("stage-record")).toContainText("the report records the outcome “ignited_one_sided” (Table 7.1, PDF p.104)");
    // the flow choice changes the spread explanation (conceptual mode, no test)
    await openStudio(page, PAGE.bass);
    await page.getByTestId("science-studio").getByRole("radio", { name: "Concurrent" }).first().click();
    await page.getByTestId("timeline").getByRole("button", { name: "Flame spread" }).click();
    await expect(stageLine(page)).toContainText("moves with the airflow");
  });

  test("SAFFIRE-I: an explanatory walkthrough, keyboard operable, burn-aware, footage on request", async ({ page }) => {
    await openStudio(page, PAGE.saffire);
    const w = page.getByTestId("walkthrough");
    await expect(w).toContainText("Explanatory steps — not a timeline of the burn");
    await expect(page.getByTestId("timeline")).toHaveCount(0);                            // no burn timeline for SAFFIRE-I
    await w.getByTestId("walk-start").click();
    await expect(w.getByTestId("walk-step")).toContainText("Step 1 of 5 — Experiment setup");
    await expect(page.getByTestId("stage-chip")).toHaveText("Step 1 of 5 · Experiment setup");
    await w.getByTestId("walk-next").click();
    await expect(w.getByTestId("walk-step")).toContainText("Step 2 of 5 — Airflow and ignition");
    await expect(w).toContainText("Burn S1 spread with the airflow (concurrent).");
    await w.getByTestId("walk-next").focus();
    await page.keyboard.press("ArrowRight");
    await expect(w.getByTestId("walk-step")).toContainText("Step 3 of 5 — Flame-spread investigation");
    await w.getByTestId("stage-why").click();
    await expect(w.getByTestId("stage-why-body")).toContainText("Flame-front positions, spread rates and temperatures are not in the local files.");
    await page.keyboard.press("ArrowLeft");
    await expect(w.getByTestId("walk-step")).toContainText("Step 2 of 5");
    // switching the burn updates the explanation, nothing else is invented
    await page.goto(`${PAGE.saffire}?record=saffire1%3AS2#studio`);
    await page.getByTestId("walkthrough").getByRole("button", { name: "2. Airflow and ignition" }).click();
    await expect(page.getByTestId("walkthrough")).toContainText("Burn S2 spread against the airflow (opposed).");
    await page.getByTestId("walkthrough").getByRole("button", { name: "5. Evidence and limitations" }).click();
    await page.getByTestId("walk-footage").click();
    await expect(page.getByTestId("footage-view")).toBeVisible();
  });

  test("camera: stage changes move it only when asked; manual control is never overridden", async ({ page }) => {
    await openStudio(page, PAGE.flex);
    const tl = page.getByTestId("timeline");
    const home = (await stats(page))!.camera!;
    await tl.getByTestId("stage-start").click();
    await tl.getByTestId("stage-next").click();
    await page.waitForTimeout(900);
    expect((await stats(page))!.camera).toEqual(home);                                   // follow is off by default
    await tl.getByTestId("stage-follow").check();
    await tl.getByTestId("stage-next").click();
    await expect.poll(async () => JSON.stringify((await stats(page))!.camera), { timeout: 10_000 }).not.toBe(JSON.stringify(home));
    await page.getByRole("button", { name: "Reset camera" }).click();
    await expect.poll(async () => JSON.stringify((await stats(page))!.camera), { timeout: 10_000 }).toBe(JSON.stringify(home));
    await page.waitForTimeout(900);
    expect((await stats(page))!.camera).toEqual(home);                                   // no repeated re-targeting
  });

  test("guided tour still drives the timeline, and the explainer follows it", async ({ page }) => {
    await openStudio(page, PAGE.flex);
    await page.getByTestId("start-tour").click();
    const tour = page.getByTestId("guided-tour").first();
    for (let i = 0; i < 6; i++) await tour.getByTestId("tour-next").click();
    await expect(tour.getByTestId("tour-title")).toHaveText("A burn, step by step");
    await expect(page.getByTestId("timeline").getByTestId("stage-explainer")).toHaveAttribute("data-stage", "regression");
    await expect(page.getByTestId("timeline").getByTestId("timeline-play")).toHaveText("Play");   // nothing auto-plays
  });

  test("reduced motion and no WebGL: the stage story still works from text and controls", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
    await ctx.addInitScript(() => {
      const orig = HTMLCanvasElement.prototype.getContext as (...a: unknown[]) => unknown;
      Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
        value(this: HTMLCanvasElement, type: string, ...rest: unknown[]) { return /webgl/.test(type) ? null : orig.apply(this, [type, ...rest]); },
      });
    });
    const page = await ctx.newPage();
    await page.goto(`${PAGE.flex}?view=gravity#studio`);
    await expect(page.getByTestId("scene-fallback")).toBeVisible({ timeout: 60_000 });
    const tl = page.getByTestId("timeline");
    await tl.getByTestId("stage-start").click();
    await tl.getByTestId("stage-next").click();
    await tl.getByTestId("stage-next").click();
    await expect(tl.getByTestId("stage-explainer")).toHaveAttribute("data-stage", "burning");
    await expect(tl.getByTestId("gravity-earth")).toBeVisible();
    await expect(tl.locator("p.sr-only", { hasText: "In the 3D view:" })).toHaveText(/blue flame shell surrounds the droplet/);
    await tl.getByTestId("why-different").click();
    await expect(tl.getByTestId("why-different-body").getByRole("link", { name: /FLEX ERD v4, PDF p\.64/ })).toBeVisible();
    await ctx.close();
  });
});

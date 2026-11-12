import { expect, test, type Page } from "@playwright/test";
import { SCENES } from "../lib/lab-models";
import { SOURCES } from "../lib/lab-scientific-metadata";

// Phase 7: Interactive Science Studios inside the three Scientific Analysis pages (supersedes the Phase 6 /lab tests;
// every Phase 6 assertion is carried over to the integrated studios). Runs on SwiftShader WebGL. Assistant endpoints
// are never called for real: requests are counted, and the one Ask test answers from a mocked stream.
// Mount counters are compared before/after (the dev server's StrictMode runs mount effects twice).

type Stats = { live: number; mounts: number; disposed: number; contextLost: number; sceneLoads: Record<string, number>; camera?: number[] };
const stats = (page: Page) => page.evaluate(() => (window as unknown as { __spacefireLab?: Stats }).__spacefireLab ?? null);
const PAGE = { flex: "/phenomena/flame-extinction", bass: "/phenomena/flame-spread", saffire: "/phenomena/spacecraft-fire" } as const;
const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

async function openStudio(page: Page, path: string) {
  await page.goto(path);
  const host = page.getByTestId("lab-canvas-host");
  await host.scrollIntoViewIfNeeded();
  await expect(host.locator("canvas")).toBeVisible({ timeout: 60_000 });
  await expect.poll(async () => (await stats(page))?.camera?.length ?? 0, { timeout: 60_000 }).toBe(3);
  await expect.poll(async () => Object.keys((await stats(page))?.sceneLoads ?? {}).length, { timeout: 60_000 }).toBeGreaterThan(0);
  return host;
}

function consoleErrors(page: Page) {
  const errs: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  page.on("pageerror", (e) => errs.push(String(e)));
  return errs;
}

/** Same formatting as lib/api fmt(). */
const fmt = (v: number) => (Number.isInteger(v) ? v.toLocaleString("en-US") : Number(v.toPrecision(4)).toString());

test.describe("Phase 7: integrated Interactive Science Studios", () => {
  test("each Scientific Analysis page embeds its own studio; the standalone lab is gone from navigation", async ({ page }) => {
    const errs = consoleErrors(page);
    for (const [id, path] of Object.entries(PAGE)) {
      await openStudio(page, path);
      const studio = page.getByTestId("science-studio");
      await expect(studio).toBeVisible();
      await expect(page.getByTestId("lab-viewport")).toHaveAttribute("data-scene", id);
      await expect(page.getByTestId("mode-banner")).toHaveText(/Conceptual visualization — not measured NASA output\./);
      await expect(studio.getByRole("radio", { name: /Validated/ })).toHaveCount(0);
      await expect(page.getByRole("navigation", { name: "On this page" }).getByRole("link", { name: /3D studio/ })).toBeVisible();
      expect(await page.locator("canvas").count()).toBe(1);
      expect(Object.keys((await stats(page))!.sceneLoads)).toEqual([id]);   // only this page's scene is mounted
    }
    const nav = page.getByRole("navigation", { name: "Main" });
    await expect(nav.getByRole("link", { name: /Interactive Combustion Lab/ })).toHaveCount(0);
    expect(errs).toEqual([]);
  });

  test("old /lab links redirect to the right page and keep record, mode and component", async ({ page }) => {
    await page.goto("/lab?scene=bass&record=bass2%3A27&mode=evidence");
    await expect(page).toHaveURL(/\/phenomena\/flame-spread\?.*record=bass2%3A27/);
    await expect(page).toHaveURL(/mode=evidence/);
    await expect(page.getByTestId("evidence-record").getByRole("heading", { name: /Test M1/ })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId("mode-banner")).toContainText("width 2 cm (CSV, nominal)");

    await page.goto("/lab?scene=flex&component=flame");
    await expect(page).toHaveURL(/\/phenomena\/flame-extinction\?.*component=flame/);
    await expect(page.getByTestId("component-detail").getByRole("heading", { name: "Flame envelope" })).toBeVisible({ timeout: 60_000 });

    await page.goto("/lab?scene=saffire");
    await expect(page).toHaveURL(/\/phenomena\/spacecraft-fire/);
    await page.goto("/lab");
    await expect(page).toHaveURL(/\/phenomena\/flame-extinction/);
  });

  test("entry points: Mission Control and experiment records open the matching studio, and the chart rings the record", async ({ page }) => {
    await page.goto("/");
    const band = page.locator('section[aria-labelledby="lab-title"]');
    await band.scrollIntoViewIfNeeded();
    for (const path of Object.values(PAGE)) await expect(band.locator(`a[href="${path}#studio"]`).first()).toBeVisible();
    await page.goto("/experiments/flex/flex%3A180");
    await page.getByRole("link", { name: "Explore in 3D" }).click();
    await expect(page).toHaveURL(/\/phenomena\/flame-extinction\?record=flex%3A180&mode=evidence/);
    await expect(page.getByTestId("evidence-record").getByRole("heading", { name: /^Test C02H101/ })).toBeVisible({ timeout: 60_000 });
    const map = page.locator("#map");
    await map.scrollIntoViewIfNeeded();
    await expect(map.getByText("Selected in the 3D studio: C02H101")).toBeVisible({ timeout: 30_000 });
    await expect(map.getByText("The ringed point is the test selected in the 3D studio.")).toBeVisible();
  });

  test("camera: drag rotates, buttons and keys rotate and zoom, reset returns home", async ({ page }) => {
    const host = await openStudio(page, PAGE.flex);
    const home = (await stats(page))!.camera!;
    const box = (await host.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 160, box.y + box.height / 2 + 30, { steps: 8 });
    await page.mouse.up();
    await expect.poll(async () => dist((await stats(page))!.camera!, home)).toBeGreaterThan(1);
    await page.getByTestId("lab-viewport").getByRole("button", { name: "Reset camera" }).click();
    await expect.poll(async () => dist((await stats(page))!.camera!, home)).toBeLessThan(0.05);
    await page.getByTestId("lab-viewport").getByRole("button", { name: "Zoom in" }).click();
    expect(Math.hypot(...(await stats(page))!.camera!)).toBeLessThan(Math.hypot(...home));
    await host.focus();
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("0");
    await expect.poll(async () => dist((await stats(page))!.camera!, home)).toBeLessThan(0.05);
  });

  test("FLEX fuels: selection changes explanation, soot layer, media, slider ranges and evidence; never fabricates data", async ({ page, request }) => {
    await openStudio(page, PAGE.flex);
    const map = await (await request.get("/api/v1/analytics/flex/map")).json();
    const n = (f: string) => map.points.filter((p: { fuel: string }) => p.fuel === f).length;
    const info = page.getByTestId("fuel-info");
    await expect(info.getByRole("heading", { name: /n-Heptane/ })).toBeVisible();
    await expect(info.getByText(/wide range of sooting behaviour/)).toBeVisible();
    await expect(info.locator('img[src^="/media/flex-heptane-soot-composite/"]')).toHaveCount(1);
    await expect(page.getByTestId("fuel-coverage")).toContainText(`${n("Heptane")} FLEX n-heptane tests`);

    await page.getByRole("radio", { name: "Methanol" }).first().click();
    await expect(info.getByRole("heading", { name: /Methanol/ })).toBeVisible();
    await expect(info.getByText("A non-sooting alcohol fuel.")).toBeVisible();
    await expect(info.getByText(/has no NASA image that names a methanol FLEX droplet/)).toBeVisible();
    await expect(page.getByTestId("fuel-coverage")).toContainText(`${n("Methanol")} FLEX methanol tests`);
    await page.getByRole("tab", { name: "Layers" }).click();
    await expect(page.getByTestId("lab-explain").getByText("(not drawn: methanol is non-sooting)")).toBeVisible();
    await page.getByRole("tab", { name: "NASA evidence" }).click();
    await expect(page.getByTestId("lab-evidence").getByText(/^Methanol, initial O₂/)).toBeVisible();
    // no per-fuel temperature, rate or threshold is stated anywhere in the studio
    expect(await page.getByTestId("science-studio").innerText()).not.toMatch(/\d+\s?K\b|°C|flame temperature of|extinction threshold of/i);
  });

  test("Compare Fuels: two fuels in one canvas with a shared camera; matched records and honest verdict", async ({ page }) => {
    await openStudio(page, `${PAGE.flex}?view=fuels`);
    const mounts = (await stats(page))!.mounts;
    await expect(page.getByTestId("lab-viewport")).toHaveAttribute("data-view", "split");
    await expect(page.getByTestId("split-captions")).toContainText("n-Heptane");
    await expect(page.getByTestId("split-captions")).toContainText("Methanol");
    expect(await page.locator("canvas").count()).toBe(1);
    await page.getByRole("tab", { name: "Compare" }).click();
    const cmp = page.getByTestId("fuel-compare");
    await cmp.getByTestId("compare-list-a").getByRole("button").first().click();
    await cmp.getByTestId("compare-list-b").getByRole("button").first().click();
    const table = cmp.getByTestId("compare-table");
    await expect(table).toBeVisible();
    const mismatched = await table.locator('tr[data-mismatch="true"]').count();
    await expect(cmp.getByTestId("compare-verdict")).toHaveText(mismatched ? /Not a controlled comparison/ : /match within the display tolerances/);
    await expect(table.getByText(/No conclusion about which fuel burns faster/)).toBeVisible();
    await expect(table.getByText("Burning-rate constant K (mm²/s)")).toBeVisible();
    // evidence mode draws each side at its record's measured size
    await page.getByRole("radio", { name: "NASA Evidence" }).click();
    await expect(page.getByTestId("split-note")).toContainText("measured D₀ and D_ext");
    expect((await stats(page))!.mounts).toBe(mounts);   // no canvas remount across view, mode and record changes
  });

  test("Earth vs microgravity: side-by-side conceptual comparison with NASA imagery", async ({ page }) => {
    await openStudio(page, `${PAGE.flex}?view=gravity`);
    await expect(page.getByTestId("split-captions")).toContainText("Microgravity");
    await expect(page.getByTestId("split-captions")).toContainText("Earth 1 g (conceptual comparison)");
    await expect(page.getByTestId("split-note")).toContainText("not a FLEX measurement");
    await expect(page.getByTestId("mode-banner")).toHaveText(/Conceptual visualization/);
    await page.getByRole("tab", { name: "Compare" }).click();
    const g = page.getByTestId("gravity-compare");
    await expect(g.locator('img[src^="/media/flex-1g-vs-microgravity/"]')).toHaveCount(1);
    await expect(g.getByText(/not spherical under every condition/)).toBeVisible();
  });

  test("burn timeline: play, pause, scrub, speed and restart; measured burn time shown separately", async ({ page }) => {
    await openStudio(page, `${PAGE.flex}?record=flex%3A180`);
    const tl = page.getByTestId("timeline");
    await expect(tl.getByTestId("timeline-caveat")).toHaveText("Illustrative sequence — not a NASA test's timing");
    await expect(tl).toContainText("burn time 4.5 s");
    await expect(tl).toContainText("the timeline is not scaled to it");
    const scrub = tl.getByTestId("timeline-scrub");
    await tl.getByTestId("timeline-speed").selectOption("2");
    await tl.getByTestId("timeline-play").click();
    await expect(tl.getByTestId("timeline-play")).toHaveText("Pause");
    await expect.poll(async () => Number(await scrub.inputValue()), { timeout: 15_000 }).toBeGreaterThan(10);
    await tl.getByTestId("timeline-play").click();                        // pause
    const paused = Number(await scrub.inputValue());
    await page.waitForTimeout(800);
    expect(Number(await scrub.inputValue())).toBe(paused);
    await scrub.fill("50");
    await expect(tl.getByTestId("timeline-stage")).toContainText("Droplet regression");
    await scrub.fill("95");
    await expect(tl.getByTestId("timeline-stage")).toContainText("Extinction or end of burning");
    await tl.getByTestId("timeline-reset").click();
    await expect(scrub).toHaveValue("0");
    await expect(tl.getByTestId("timeline-stage")).toContainText("Initial droplet");
  });

  test("d²-law idealized calculation uses the record's D₀ and K and the backend's consistency result", async ({ page, request }) => {
    await openStudio(page, `${PAGE.flex}?record=flex%3A180&mode=evidence`);
    const api = await (await request.get("/api/v1/analytics/flex/d2?uid=flex%3A180")).json();
    const r = api.record;
    const calc = page.getByTestId("d2-calc");
    await expect(calc.getByTestId("d2-label")).toHaveText("Idealized calculation — assumptions apply");
    await expect(calc.getByTestId("d2-tstar")).toHaveText(`${fmt((r.d0_mm * r.d0_mm) / r.k_mm2_s)} s`);
    await expect(calc.getByTestId("d2-ratio")).toHaveText(fmt(r.ratio));
    await expect(calc).toContainText("not an extinction time");
    await expect(calc).toContainText(`K = ${r.k_mm2_s} mm²/s`);
  });

  test("layer inspector: select focuses the camera, isolate and hide work, Show all restores", async ({ page }) => {
    await openStudio(page, PAGE.flex);
    const before = (await stats(page))!.camera!;
    await page.getByRole("tab", { name: "Layers" }).click();
    const ins = page.getByTestId("lab-explain");
    for (const c of SCENES[0].components) await expect(ins.locator(`[data-component="${c.id}"]`)).toBeVisible();
    await ins.locator('[data-component="droplet"]').click();
    await expect(page).toHaveURL(/component=droplet/);
    await expect.poll(async () => Math.hypot(...(await stats(page))!.camera!), { timeout: 10_000 }).toBeLessThan(Math.hypot(...before) * 0.6);
    await expect(page.getByTestId("component-detail").getByRole("heading", { name: "Fuel droplet" })).toBeVisible();
    await page.getByTestId("isolate").click();
    await expect(page.getByTestId("isolate")).toHaveAttribute("aria-pressed", "true");
    await ins.locator('[data-layer-toggle="ambient"]').click();
    await expect(ins.locator('[data-layer-toggle="ambient"]')).toHaveText("Hidden");
    await page.getByTestId("show-all").click();
    await expect(ins.locator('[data-layer-toggle="ambient"]')).toHaveText("Shown");
    await expect(page.getByTestId("isolate")).toHaveAttribute("aria-pressed", "false");
    // a 3D click also selects (raycast picking of nested parts)
    const host = page.getByTestId("lab-canvas-host");
    await page.getByTestId("lab-viewport").getByRole("button", { name: "Reset camera" }).click();
    const box = (await host.boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2 + 10);
    await expect(page).toHaveURL(/component=(droplet|flame|soot|vapour)/);
  });

  test("BASS-II: source-driven sample menu, flow labels, illustrative timeline and two-test material comparison", async ({ page, request }) => {
    await openStudio(page, PAGE.bass);
    const facets = (await (await request.get("/api/v1/experiments?dataset=bass2&page_size=1")).json()).facets.material_class as { value: string; count: number }[];
    const rods = facets.filter((f) => f.value.startsWith("PMMA rod")).reduce((a, f) => a + f.count, 0);
    await page.getByRole("radio", { name: `PMMA rod (${rods})` }).click();
    await page.getByRole("radio", { name: "Stagnation" }).click();
    await page.getByRole("radio", { name: "Concurrent" }).click();
    await expect(page.locator('[data-annotation="flame"]').getByText(/Flame trails downstream/)).toBeVisible();
    const tl = page.getByTestId("timeline");
    await expect(tl.getByTestId("timeline-caveat")).toHaveText("Illustrative progression — not measured flame-front motion");
    await tl.getByTestId("timeline-scrub").fill("50");
    await expect(tl.getByTestId("timeline-stage")).toContainText("Flame spread");

    await page.getByRole("radio", { name: "Compare" }).first().click();
    await expect(page.getByTestId("split-captions")).toContainText("Concurrent flow");
    await page.getByRole("tab", { name: "Compare" }).click();
    const bc = page.getByTestId("bass-compare");
    await bc.getByLabel("Test A (left)").selectOption("bass2:27");
    await bc.getByLabel("Test B (right)").selectOption("bass2:28");
    const table = bc.getByTestId("compare-table");
    await expect(table.getByText(/spread 0\.071 mm\/s/)).toBeVisible();
    await expect(table.getByText(/CSV widths are nominal/)).toBeVisible();
    await expect(page.getByTestId("split-captions")).toContainText("A · M1");
    await expect(bc.getByTestId("compare-verdict")).toBeVisible();
  });

  test("BASS-II evidence keeps report-table values and known discrepancies visible", async ({ page }) => {
    await openStudio(page, `${PAGE.bass}?mode=evidence&record=bass2%3A27`);
    const panel = page.getByTestId("lab-evidence");
    await expect(panel.getByTestId("bass-discrepancies").getByText(/T24/)).toBeVisible();
    const rec = panel.getByTestId("evidence-record");
    await expect(rec.getByText("Spread rate: 0.071 mm/s")).toBeVisible();
    await expect(rec.getByText("Width: 2.2 cm")).toBeVisible();
    await expect(rec.getByText("2 cm", { exact: true })).toBeVisible();
    await expect(page.getByTestId("timeline")).toContainText("independent of the animation");
  });

  test("SAFFIRE-I: presets, isolation, S1/S2 switch, footage on request, evidence and metadata view", async ({ page }) => {
    const yt: string[] = [];
    page.on("request", (r) => { if (/youtube|ytimg|animation\.webp/.test(r.url())) yt.push(r.url()); });
    await openStudio(page, PAGE.saffire);
    const home = (await stats(page))!.camera!;
    await page.getByRole("toolbar", { name: "Camera presets" }).getByRole("button", { name: "Fans and straighteners" }).click();
    await expect(page).toHaveURL(/component=fans/);
    await expect.poll(async () => dist((await stats(page))!.camera!, home), { timeout: 10_000 }).toBeGreaterThan(0.3);
    await page.getByRole("tab", { name: "Layers" }).click();
    await page.getByTestId("isolate").click();
    await expect(page.getByTestId("isolate")).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("tab", { name: "Explore" }).click();
    await page.getByRole("switch", { name: /Exploded view/ }).click();
    await page.getByRole("radio", { name: "S2 · opposed" }).click();
    await expect(page).toHaveURL(/record=saffire1%3AS2/);
    await page.getByRole("tab", { name: "Layers" }).click();
    await page.getByTestId("lab-explain").locator('[data-component="enclosure"]').click();
    await expect(page.getByTestId("component-detail").getByText(/not a reconstruction of the flight hardware/)).toBeVisible();

    await page.getByRole("radio", { name: "NASA footage" }).click();
    const fv = page.getByTestId("footage-view");
    await expect(fv.getByRole("button", { name: /Play “Saffire-I Experiment Burns in Space”/ })).toBeVisible();
    await expect(fv.locator("iframe")).toHaveCount(0);
    expect(yt).toEqual([]);                                                     // nothing loaded before a click
    await page.getByRole("radio", { name: "Evidence & metadata" }).click();
    await expect(page.getByTestId("data-view").getByText("Appears swapped with width (SAF-LENGTH-WIDTH)")).toBeVisible();
    await page.getByRole("radio", { name: "3D model" }).click();
    await expect(page.getByTestId("lab-canvas-host").locator("canvas")).toBeVisible();
  });

  test("guided tours advance, take an interaction, support the keyboard and never call the model", async ({ page }) => {
    const asks: string[] = [];
    page.on("request", (r) => { if (r.url().includes("/assistant/")) asks.push(r.url()); });
    await openStudio(page, PAGE.flex);
    await page.getByTestId("start-tour").click();
    const tour = page.getByTestId("guided-tour").first();
    await expect(tour.getByTestId("tour-title")).toHaveText("Why burn a single droplet in orbit?");
    await expect(tour.getByTestId("tour-title")).toBeFocused();
    await tour.getByTestId("tour-next").click();
    await expect(tour.getByTestId("tour-title")).toHaveText("The droplet");
    await expect(page).toHaveURL(/component=droplet/);
    await page.keyboard.press("ArrowRight");
    await expect(tour.getByTestId("tour-title")).toHaveText("A flame shell, not a candle flame");
    await tour.getByTestId("tour-next").click();
    await expect(tour.getByTestId("tour-task")).toContainText("Your turn");
    await page.getByRole("radio", { name: "Earth 1 g (comparison)" }).click();
    await expect(tour.getByTestId("tour-task")).toContainText("Done");
    await tour.getByRole("button", { name: "Restart" }).click();
    await expect(tour.getByTestId("tour-title")).toHaveText("Why burn a single droplet in orbit?");
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("guided-tour")).toHaveCount(0);

    for (const path of [PAGE.bass, PAGE.saffire]) {
      await openStudio(page, path);
      await page.getByTestId("start-tour").click();
      const t = page.getByTestId("guided-tour").first();
      const steps = path === PAGE.bass ? 9 : 8;
      for (let i = 1; i < steps; i++) {
        await expect(t).toContainText(`step ${i} of ${steps}`);
        await t.getByTestId("tour-next").click();
      }
      await expect(t.getByTestId("tour-title")).toHaveText("Takeaway");
      await t.getByRole("button", { name: "Finish" }).click();
      await expect(page.getByTestId("guided-tour")).toHaveCount(0);
    }
    expect(asks).toEqual([]);
  });

  test("Ask AI opens the Copilot with a draft, never auto-sends, and sends only bounded context", async ({ page }) => {
    const asks: { body: string | null }[] = [];
    await page.route("**/api/v1/assistant/**", (r) => {
      asks.push({ body: r.request().postData() });
      return r.fulfill({ status: 200, contentType: "application/x-ndjson",
        body: JSON.stringify({ event: "result", data: { question: "q", answer: null, status: "retrieval_only", claims: [], citations: [], limitations: [], suggested_followups: [],
          tool_calls: [], llm: { configured: false, mode: "retrieval_only", reason: "test" }, investigations_detected: [], experiments_matched: [], external_providers: null, trace_id: "e2e7" } }) + "\n" });
    });
    await openStudio(page, `${PAGE.flex}?component=flame&record=flex%3A180`);
    const ask = page.getByTestId("ask-ai");
    await expect(ask).toHaveAttribute("href", /uid=flex%3A180/);
    await page.getByRole("tab", { name: "Explore" }).click();
    await page.getByRole("radio", { name: "Methanol" }).first().click();       // controls never send anything
    await page.getByRole("tab", { name: "Layers" }).click();
    await ask.click();
    await expect(page).toHaveURL(/\/copilot\?/);
    const q = page.getByLabel("Your scientific question");
    await expect(q).toHaveValue(/flame envelope around a burning droplet/);
    await page.waitForTimeout(1200);
    expect(asks).toEqual([]);
    await page.getByRole("button", { name: /^Ask/ }).click();
    await expect.poll(() => asks.length).toBe(1);
    const body = JSON.parse(asks[0].body!);
    expect(Object.keys(body).sort()).toEqual(["context_experiment_uids", "investigations", "question", "source_scope"]);
    expect(body.investigations).toEqual(["PSI-69"]);
    expect(body.context_experiment_uids).toEqual(["flex:180"]);
    expect(body.question).not.toMatch(/methanol|0\.2\d|slider/i);
  });

  test("leaving a page disposes the renderer", async ({ page }) => {
    await openStudio(page, PAGE.bass);
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Mission Control" }).click();
    await expect(page.getByRole("heading", { name: "Understanding Fire Beyond Gravity" })).toBeVisible();
    await expect.poll(async () => (await stats(page))?.live).toBe(0);
    const s = (await stats(page))!;
    expect(s.disposed).toBe(s.mounts);
    expect(s.contextLost).toBe(0);
  });

  test("without WebGL the studio shows a static fallback and keeps controls and evidence", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.addInitScript(() => {
      const orig = HTMLCanvasElement.prototype.getContext as (...a: unknown[]) => unknown;
      Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
        value(this: HTMLCanvasElement, type: string, ...rest: unknown[]) { return /webgl/.test(type) ? null : orig.apply(this, [type, ...rest]); },
      });
    });
    const page = await ctx.newPage();
    await page.goto(PAGE.bass);
    const fb = page.getByTestId("scene-fallback");
    await expect(fb).toBeVisible({ timeout: 60_000 });
    await expect(fb.getByText(/does not provide WebGL/)).toBeVisible();
    await page.getByRole("tab", { name: "NASA evidence" }).click();
    await expect(page.getByTestId("bass-list").getByRole("button").first()).toBeVisible();
    await ctx.close();
  });

  test("reduced motion: decorative motion off, on-demand rendering, instant camera moves; static view on request", async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await openStudio(page, PAGE.saffire);
    await expect(page.getByRole("switch", { name: "Decorative motion" })).toHaveAttribute("aria-checked", "false");
    await expect(page.locator("[data-frameloop]")).toHaveAttribute("data-frameloop", "demand");
    await page.getByRole("toolbar", { name: "Camera presets" }).getByRole("button", { name: "Fabric sample" }).click();
    await expect.poll(async () => (await stats(page))!.camera!.join(","), { timeout: 3_000 }).toBe("0.22,0.1,1.7");   // jump, no tween
    await page.getByRole("button", { name: "Static view", exact: true }).click();
    await expect(page.getByTestId("scene-fallback").getByText(/Static view selected/)).toBeVisible();
    await page.getByRole("button", { name: "Load the 3D view" }).click();
    await expect(page.locator("canvas")).toHaveCount(1, { timeout: 60_000 });
    await ctx.close();
  });

  test("every studio source link resolves", async ({ request }) => {
    for (const s of Object.values(SOURCES)) {
      if (s.href.startsWith("/")) expect((await request.get(s.href.split("#")[0])).status(), s.href).toBe(200);
      else expect(s.href, s.label).toMatch(/^https:\/\//);
    }
  });

  test("conclusions and literature are sourced on all three pages", async ({ page }) => {
    for (const path of Object.values(PAGE)) {
      await page.goto(path);
      const c = page.getByTestId("conclusions");
      await c.scrollIntoViewIfNeeded();
      await expect(c.getByRole("heading", { name: "Key findings" })).toBeVisible({ timeout: 60_000 });
      await expect(c.getByRole("heading", { name: "Uncertainties and limits" })).toBeVisible();
      const lit = page.locator("#literature");
      await lit.scrollIntoViewIfNeeded();
      await expect(lit.getByTestId("publications").locator("li").first()).toBeVisible();
      await expect(lit.getByTestId("literature-ask")).toHaveAttribute("href", /draft=/);
    }
  });
});

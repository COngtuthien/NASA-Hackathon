import { expect, test, type Page } from "@playwright/test";
import { SCENES } from "../lib/lab-models";
import { SOURCES } from "../lib/lab-scientific-metadata";

// Phase 6: Interactive Combustion Lab. Runs on SwiftShader WebGL in headless Chrome. The assistant endpoints are
// never called for real: requests are counted, and the one Ask test answers from a mocked stream.
// Mount counters are compared before/after (the dev server's StrictMode runs mount effects twice).

type Stats = { live: number; mounts: number; disposed: number; contextLost: number; sceneLoads: Record<string, number>; camera?: number[] };
const stats = (page: Page) => page.evaluate(() => (window as unknown as { __spacefireLab?: Stats }).__spacefireLab ?? null);

async function openLab(page: Page, query = "") {
  await page.goto(`/lab${query}`);
  const host = page.getByTestId("lab-canvas-host");
  await host.scrollIntoViewIfNeeded();
  await expect(host.locator("canvas")).toBeVisible({ timeout: 60_000 });
  // the scene chunk has mounted once the camera has reported its home position
  await expect.poll(async () => (await stats(page))?.camera?.length ?? 0, { timeout: 60_000 }).toBe(3);
  await expect.poll(async () => Object.keys((await stats(page))?.sceneLoads ?? {}).length, { timeout: 60_000 }).toBeGreaterThan(0);
  return host;
}

const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** Collect console errors, ignoring the known THREE.Clock deprecation (a warning inside R3F). */
function consoleErrors(page: Page) {
  const errs: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  page.on("pageerror", (e) => errs.push(String(e)));
  return errs;
}

test.describe("Phase 6: Interactive Combustion Lab", () => {
  test("lab loads one scene lazily with a WebGL canvas and the conceptual banner", async ({ page }) => {
    const errs = consoleErrors(page);
    const host = await openLab(page);
    await expect(page.getByRole("heading", { name: "Interactive Combustion Lab", level: 1 })).toBeVisible();
    await expect(page.getByTestId("mode-banner")).toHaveText(/Conceptual visualization — not measured NASA output\./);
    expect(await host.locator("canvas").count()).toBe(1);
    const s = await stats(page);
    expect(Object.keys(s!.sceneLoads)).toEqual(["flex"]);  // BASS-II and SAFFIRE-I scenes are not mounted
    expect(s!.live).toBe(1);
    expect(s!.contextLost).toBe(0);
    // no fake "Validated model" mode is offered
    await expect(page.getByRole("radio", { name: /Validated/ })).toHaveCount(0);
    await expect(page.getByRole("radio", { name: "Conceptual 3D" })).toBeVisible();
    await expect(page.getByRole("radio", { name: "NASA Evidence" })).toBeVisible();
    expect(errs).toEqual([]);
  });

  test("camera: drag rotates, buttons and keys rotate and zoom, reset returns home", async ({ page }) => {
    const host = await openLab(page);
    const home = (await stats(page))!.camera!;
    const box = (await host.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 160, box.y + box.height / 2 + 30, { steps: 8 });
    await page.mouse.up();
    await expect.poll(async () => dist((await stats(page))!.camera!, home)).toBeGreaterThan(1);

    await page.getByRole("button", { name: "Reset camera" }).click();
    await expect.poll(async () => dist((await stats(page))!.camera!, home)).toBeLessThan(0.05);

    await page.getByRole("button", { name: "Zoom in" }).click();
    const r0 = Math.hypot(...home), r1 = Math.hypot(...(await stats(page))!.camera!);
    expect(r1).toBeLessThan(r0);
    await page.getByRole("button", { name: "Rotate right" }).click();
    await host.focus();
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("-");
    expect(dist((await stats(page))!.camera!, home)).toBeGreaterThan(0.5);
    await page.keyboard.press("0");
    await expect.poll(async () => dist((await stats(page))!.camera!, home)).toBeLessThan(0.05);
  });

  test("scene switching reuses one canvas and loads each scene once; controls never remount it", async ({ page }) => {
    const errs = consoleErrors(page);
    await openLab(page);
    const before = (await stats(page))!;
    const mounts = before.mounts, flexLoads = before.sceneLoads.flex;

    // FLEX controls: gravity, oxygen, annotations
    await page.getByRole("radio", { name: "Earth 1 g (comparison)" }).click();
    await expect(page.locator('[data-annotation="transport"]').getByText("Buoyant updraft (1 g)")).toBeVisible();
    await page.getByLabel("Ambient O₂ (mole fraction)").fill("0.3");
    await expect(page.locator('[data-annotation="ambient"]').getByText("O₂ 0.30")).toBeVisible();
    await page.getByRole("switch", { name: "Annotations" }).click();
    await expect(page.locator("[data-annotation]")).toHaveCount(0);
    expect((await stats(page))!.mounts).toBe(mounts);
    expect((await stats(page))!.sceneLoads.flex).toBe(flexLoads);

    // reset parameters restores the defaults
    await page.getByTestId("reset-params").click();
    await expect(page.getByRole("radio", { name: "Microgravity" })).toHaveAttribute("aria-checked", "true");
    await expect(page.getByRole("switch", { name: "Annotations" })).toHaveAttribute("aria-checked", "true");
    await expect(page.getByLabel("Ambient O₂ (mole fraction)")).toHaveValue("0.21");

    // switch scenes with the keyboard (radio group, roving focus)
    await page.getByRole("radio", { name: /Droplet Combustion/ }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(page).toHaveURL(/scene=bass/);
    await expect(page.getByTestId("lab-viewport")).toHaveAttribute("data-scene", "bass");
    await expect(page.locator('[data-annotation="duct"]').first()).toBeVisible();
    await page.getByRole("radio", { name: /Spacecraft Fire Safety/ }).click();
    await expect(page.locator('[data-annotation="fans"]').first()).toBeVisible();
    const s = (await stats(page))!;
    expect(s.mounts).toBe(mounts);                       // still the same WebGL canvas
    expect(s.sceneLoads.flex).toBe(flexLoads);
    expect(s.sceneLoads.bass).toBeGreaterThanOrEqual(1);
    expect(s.sceneLoads.saffire).toBeGreaterThanOrEqual(1);
    expect(await page.locator("canvas").count()).toBe(1);

    // BASS-II controls: sample type and flow direction
    await page.getByRole("radio", { name: /Flame Spread over Solids/ }).click();
    await page.getByRole("radio", { name: "PMMA rod" }).click();
    await page.getByRole("radio", { name: "Stagnation" }).click();
    await expect(page.locator('[data-annotation="flame"]').getByText("Flame at the rod tip (stagnation)")).toBeVisible();
    await page.getByRole("radio", { name: "Concurrent" }).click();
    await expect(page.locator('[data-annotation="flame"]').getByText(/Flame trails downstream/)).toBeVisible();
    await expect(page.locator('[data-annotation="flame"]').getByText("Illustrative front travel, not a measured rate")).toBeVisible();
    // SAFFIRE-I: cutaway, exploded, burn record
    await page.getByRole("radio", { name: /Spacecraft Fire Safety/ }).click();
    await page.getByRole("switch", { name: /Exploded view/ }).click();
    await expect(page.getByRole("switch", { name: /Exploded view/ })).toHaveAttribute("aria-checked", "true");
    await page.getByRole("radio", { name: "S2 · opposed" }).click();
    await expect(page.locator('[data-annotation="flame"]').getByText("Opposed spread (S2, CSV)")).toBeVisible();
    expect((await stats(page))!.mounts).toBe(mounts);
    expect(errs).toEqual([]);
  });

  test("selecting components by click in 3D and from the keyboard list explains provenance", async ({ page }) => {
    const host = await openLab(page);
    // click the middle of the viewport: the droplet is under the pointer, inside the flame shell
    const box = (await host.boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.5 + 10);
    await expect(page).toHaveURL(/component=(droplet|flame|soot)/);
    await expect(page.getByTestId("component-detail")).toBeVisible();

    // keyboard route: every component is a button in the Explain panel
    await page.getByRole("tab", { name: "Explain" }).click();
    for (const c of SCENES[0].components) await expect(page.getByTestId("lab-explain").locator(`[data-component="${c.id}"]`)).toBeVisible();
    const flame = page.getByTestId("lab-explain").getByRole("button", { name: "Flame envelope", exact: true });
    await flame.focus();
    await page.keyboard.press("Enter");
    await expect(flame).toHaveAttribute("aria-pressed", "true");
    const detail = page.getByTestId("component-detail");
    await expect(detail.getByText("Documented principle")).toBeVisible();
    await expect(detail.getByText(/fixed 4× the droplet radius/)).toBeVisible();
    await expect(page).toHaveURL(/component=flame/);
    // clicking a 3D label selects too
    await page.locator('[data-annotation="ambient"] button').click();
    await expect(page).toHaveURL(/component=ambient/);
    await expect(page.getByTestId("component-detail").getByText("Illustrative", { exact: true })).toBeVisible();
  });

  test("FLEX evidence: real record, K in mm²/s with the raw header, drawn to measured size", async ({ page, request }) => {
    await openLab(page, "?scene=flex&mode=evidence");
    const panel = page.getByTestId("lab-evidence");
    await expect(panel.getByTestId("flex-nearby").getByRole("button").first()).toBeVisible();
    await panel.getByTestId("flex-nearby").getByRole("button").first().click();
    await expect(page).toHaveURL(/record=flex%3A\d+/);
    const uid = decodeURIComponent(new URL(page.url()).searchParams.get("record")!);
    const api = await (await request.get(`/api/v1/experiments/${encodeURIComponent(uid)}`)).json();
    const n = api.normalized;
    const rec = panel.getByTestId("evidence-record");
    await expect(rec.getByTestId("k-value")).toHaveText(`${n.k_mm2_s} mm²/s`);
    await expect(rec.getByText("Burning rate; mm", { exact: true })).toBeVisible();
    await expect(rec.getByText(/interprets the value as mm²\/s/)).toBeVisible();
    await expect(rec.getByText(`${n.d0_mm} mm`, { exact: true }).first()).toBeVisible();
    await expect(rec.getByText(/FLEX-HDR-CO2/).first()).toBeVisible();
    // the K value is never shown with another unit anywhere in the panel
    expect(await panel.innerText()).not.toMatch(/\d mm\/s/);
    // the scene and banner follow the record's measured sizes
    await expect(page.getByTestId("mode-banner")).toContainText(`D₀ ${n.d0_mm} mm`);
    await expect(page.locator('[data-annotation="droplet"]').getByText(`Droplet D₀ ${n.d0_mm} mm (measured)`)).toBeVisible();
    await page.getByRole("tab", { name: "Controls" }).click();
    await expect(page.getByLabel("Ambient O₂ (mole fraction)")).toBeDisabled();
  });

  test("BASS-II evidence keeps report-table values and known discrepancies visible", async ({ page }) => {
    await openLab(page, "?scene=bass&mode=evidence&record=bass2%3A27");
    const panel = page.getByTestId("lab-evidence");
    await expect(panel.getByTestId("bass-discrepancies").getByText(/T24/)).toBeVisible();
    await expect(panel.getByTestId("bass-discrepancies").getByText(/Table 7.1 prints 2.2 cm/)).toBeVisible();
    const rec = panel.getByTestId("evidence-record");
    await expect(rec.getByRole("heading", { name: /Test M1/ })).toBeVisible();
    await expect(rec.getByText("Table 5.1")).toBeVisible();
    await expect(rec.getByText("Spread rate: 0.071 mm/s")).toBeVisible();             // as printed in the report
    await expect(rec.getByText("Width: 2.2 cm")).toBeVisible();                       // report: actual width
    await expect(rec.getByText("2 cm", { exact: true })).toBeVisible();               // CSV: nominal width, not reconciled
    await expect(page.getByTestId("mode-banner")).toContainText("width 2 cm (CSV, nominal)");
  });

  test("SAFFIRE-I evidence flags the swapped size columns and keeps NASA footage user-initiated", async ({ page }) => {
    const anim: string[] = [];
    page.on("request", (r) => { if (r.url().includes("animation.webp") || r.url().includes("youtube")) anim.push(r.url()); });
    await openLab(page, "?scene=saffire&mode=evidence");
    const panel = page.getByTestId("lab-evidence");
    await expect(panel.getByText(/SAF-LENGTH-WIDTH/).first()).toBeVisible();
    await expect(panel.getByText("Appears swapped with width (SAF-LENGTH-WIDTH)")).toBeVisible();
    await expect(panel.getByText(/Flame spread rates, flame area, temperatures and gas histories are not available/)).toBeVisible();
    await page.getByRole("tab", { name: "Explain" }).click();
    await page.getByTestId("lab-explain").getByRole("button", { name: "Experiment enclosure" }).click();
    await expect(page.getByTestId("component-detail").getByText(/not a reconstruction of the flight hardware/)).toBeVisible();
    expect(anim).toEqual([]);
  });

  test("every lab source link resolves", async ({ request }) => {
    for (const s of Object.values(SOURCES)) {
      if (s.href.startsWith("/")) {
        const r = await request.get(s.href.split("#")[0]);
        expect(r.status(), s.href).toBe(200);
      } else expect(s.href, s.label).toMatch(/^https:\/\//);
    }
  });

  test("Ask AI opens the Copilot with a draft, never auto-sends, and sends only bounded context", async ({ page }) => {
    const asks: { url: string; body: string | null }[] = [];
    await page.route("**/api/v1/assistant/**", (r) => {
      asks.push({ url: r.request().url(), body: r.request().postData() });
      return r.fulfill({ status: 200, contentType: "application/x-ndjson",
        body: JSON.stringify({ event: "result", data: { question: "q", answer: null, status: "retrieval_only", claims: [], citations: [], limitations: [], suggested_followups: [],
          tool_calls: [], llm: { configured: false, mode: "retrieval_only", reason: "test" }, investigations_detected: [], experiments_matched: [], external_providers: null, trace_id: "e2e6" } }) + "\n" });
    });
    await openLab(page, "?scene=flex&component=flame&record=flex%3A180");
    const ask = page.getByTestId("ask-ai");
    await expect(ask).toHaveAttribute("href", /uid=flex%3A180/);
    // toggling 3D controls sends nothing
    await page.getByRole("tab", { name: "Controls" }).click();
    await page.getByRole("radio", { name: "Earth 1 g (comparison)" }).click();
    await page.getByRole("tab", { name: "Explain" }).click();
    await ask.click();
    await expect(page).toHaveURL(/\/copilot\?/);
    const q = page.getByLabel("Your scientific question");
    await expect(q).toHaveValue(/flame envelope around a burning droplet/);
    await expect(q).toHaveValue(/C02H101 \(flex:180\)/);
    await expect(page.getByTestId("lab-context")).toContainText("Lab slider positions are never sent");
    await page.waitForTimeout(1500);
    expect(asks).toEqual([]);                            // nothing sent until Ask
    await page.getByRole("button", { name: /^Ask/ }).click();
    await expect.poll(() => asks.length).toBe(1);
    const body = JSON.parse(asks[0].body!);
    expect(Object.keys(body).sort()).toEqual(["context_experiment_uids", "investigations", "question", "source_scope"]);
    expect(body.investigations).toEqual(["PSI-69"]);
    expect(body.context_experiment_uids).toEqual(["flex:180"]);
    expect(body.question.length).toBeLessThanOrEqual(400);
    expect(body.question).not.toMatch(/1 g|0\.2\d|slider/i);
  });

  test("leaving the lab disposes the renderer", async ({ page }) => {
    await openLab(page);
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Mission Control" }).click();
    await expect(page.getByRole("heading", { name: "Understanding Fire Beyond Gravity" })).toBeVisible();
    await expect.poll(async () => (await stats(page))?.live).toBe(0);
    expect(await page.locator("canvas").count()).toBe(0);
    const s = (await stats(page))!;
    expect(s.disposed).toBe(s.mounts);
    expect(s.contextLost).toBe(0);
  });

  test("without WebGL the static fallback keeps the description, controls and evidence", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.addInitScript(() => {
      // report no WebGL support; 2D canvases keep working
      const orig = HTMLCanvasElement.prototype.getContext as (...a: unknown[]) => unknown;
      Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
        value(this: HTMLCanvasElement, type: string, ...rest: unknown[]) { return /webgl/.test(type) ? null : orig.apply(this, [type, ...rest]); },
      });
    });
    const page = await ctx.newPage();
    await page.goto("/lab?scene=bass");
    const fb = page.getByTestId("scene-fallback");
    await expect(fb).toBeVisible({ timeout: 60_000 });
    await expect(fb.getByText(/does not provide WebGL/)).toBeVisible();
    await expect(fb.getByText(/7.6 by 7.6 by 17 centimetres/)).toBeVisible();
    await expect(page.locator("canvas")).toHaveCount(0);
    await page.getByRole("tab", { name: "NASA evidence" }).click();
    await expect(page.getByTestId("bass-list").getByRole("button").first()).toBeVisible();
    await ctx.close();
  });

  test("reduced motion: decorative motion off and on-demand rendering; static view on request", async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await openLab(page);
    await expect(page.getByRole("switch", { name: "Decorative motion" })).toHaveAttribute("aria-checked", "false");
    await expect(page.locator("[data-frameloop]")).toHaveAttribute("data-frameloop", "demand");
    await page.getByRole("button", { name: "Static view", exact: true }).click();
    await expect(page.getByTestId("scene-fallback").getByText(/Static view selected/)).toBeVisible();
    await expect.poll(async () => (await stats(page))?.live).toBe(0);
    await page.getByRole("button", { name: "Load the 3D view" }).click();
    await expect(page.locator("canvas")).toHaveCount(1, { timeout: 60_000 });
    await ctx.close();
  });

  test("the lab is reachable from navigation, Mission Control, phenomenon pages and test records", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Interactive Combustion Lab" })).toHaveAttribute("href", "/lab");
    const band = page.locator('section[aria-labelledby="lab-title"]');
    await band.scrollIntoViewIfNeeded();
    await expect(band.getByRole("link", { name: /Enter the lab/ })).toHaveAttribute("href", "/lab");
    await expect(band.locator('a[href="/lab?scene=saffire"]')).toBeVisible();
    for (const [path, scene] of [["/phenomena/flame-extinction", "flex"], ["/phenomena/flame-spread", "bass"], ["/phenomena/spacecraft-fire", "saffire"]]) {
      await page.goto(path);
      await expect(page.getByTestId("lab-entry")).toHaveAttribute("href", `/lab?scene=${scene}`);
    }
    await page.goto("/experiments/flex/flex%3A180");
    await page.getByRole("link", { name: "View in 3D lab" }).click();
    await expect(page).toHaveURL(/\/lab\?scene=flex&record=flex%3A180&mode=evidence/);
    await expect(page.getByTestId("evidence-record").getByText("Test C02H101")).toBeVisible();
  });
});

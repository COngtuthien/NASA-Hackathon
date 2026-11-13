import { expect, test, type Page } from "@playwright/test";
import { openSection } from "./helpers";

// Phase 12: Light / Dark / System themes. Contrast of the real computed tokens (WCAG 2 formula), OS preference before
// a choice, explicit choice after it, no flash and no hydration error, and that switching never touches route,
// 3D scene, timeline, fullscreen or sidebar state. Screenshots of both themes are attached to the report.
// No test sends a model request.

type Stats = { mounts: number; live: number; camera?: number[] };
const stats = (page: Page) => page.evaluate(() => (window as unknown as { __spacefireLab?: Stats }).__spacefireLab ?? null);
const theme = (page: Page) => page.evaluate(() => document.documentElement.dataset.theme ?? null);
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
function consoleErrors(page: Page) {
  const errs: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  page.on("pageerror", (e) => errs.push(String(e)));
  return errs;
}

/** Read tokens from the live CSS (optionally inside a scoped element) and return WCAG contrast ratios. */
async function ratios(page: Page, pairs: [string, string][], selector?: string) {
  return page.evaluate(({ pairs, selector }) => {
    const el = selector ? document.querySelector(selector)! : document.documentElement;
    const css = getComputedStyle(el);
    const hex = (v: string) => {
      const s = css.getPropertyValue(v).trim();
      const n = s.length === 4 ? s.slice(1).split("").map((c) => c + c).join("") : s.slice(1);
      return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255);
    };
    const lum = (c: number[]) => c.map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
      .reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
    return pairs.map(([fg, bg]) => {
      const [a, b] = [lum(hex(fg)), lum(hex(bg))].sort((x, y) => y - x);
      return { pair: `${fg} on ${bg}`, ratio: Math.round(((a + 0.05) / (b + 0.05)) * 100) / 100 };
    });
  }, { pairs, selector });
}
const SURFACES = ["--void", "--ink", "--panel", "--raised"];
const TEXT = ["--text", "--text-2", "--text-3", "--link", "--flame", "--data", "--electric", "--crit", "--warn", "--info", "--ok"];

async function choose(page: Page, t: "light" | "dark" | "system") {
  await page.getByTestId(`theme-${t}`).click();
}

test.describe("Phase 12: theme system", () => {
  test("WCAG AA: every text token on every surface ≥ 4.5:1, controls and focus ≥ 3:1, in both themes and the dark islands", async ({ page }) => {
    await page.goto("/");
    for (const t of ["light", "dark"] as const) {
      await choose(page, t);
      await expect.poll(() => theme(page)).toBe(t);
      const text = await ratios(page, TEXT.flatMap((fg) => SURFACES.map((bg) => [fg, bg] as [string, string])));
      for (const r of text) expect(r.ratio, `${t}: ${r.pair}`).toBeGreaterThanOrEqual(4.5);
      const btn = await ratios(page, [["--flame-ink", "--flame"]]);
      expect(btn[0].ratio, `${t}: button text`).toBeGreaterThanOrEqual(4.5);
      const ui = await ratios(page, [["--line-strong", "--ink"], ["--line-strong", "--panel"], ["--flame", "--ink"], ["--flame", "--panel"]]);
      for (const r of ui) expect(r.ratio, `${t}: ${r.pair} (control border / focus ring)`).toBeGreaterThanOrEqual(3);
      test.info().annotations.push({ type: `contrast-${t}`, description: [...text, ...btn, ...ui].map((r) => `${r.pair}=${r.ratio}`).join("; ") });
    }
    // a dark island (3D stage) keeps dark tokens inside Light Mode
    await choose(page, "light");
    await page.goto(PAGE.flex);
    await expect(page.getByTestId("viewport-box")).toBeVisible({ timeout: 60_000 });
    const island = await ratios(page, [["--text", "--panel"], ["--text-3", "--void"]], "[data-testid=viewport-box]");
    for (const r of island) expect(r.ratio, `3D stage: ${r.pair}`).toBeGreaterThanOrEqual(4.5);
    const islandPanel = await page.getByTestId("viewport-box").evaluate((el) => getComputedStyle(el).getPropertyValue("--panel").trim());
    expect(islandPanel).toBe("#182840");
  });

  test("first visit follows the OS; an explicit choice wins over it and survives reloads and restarts", async ({ browser }) => {
    for (const scheme of ["light", "dark"] as const) {
      const ctx = await browser.newContext({ colorScheme: scheme });
      const page = await ctx.newPage();
      await page.goto("/methodology");
      expect(await theme(page)).toBe(scheme);
      await expect(page.getByTestId("theme-system")).toHaveAttribute("aria-checked", "true");
      // the OS changes while on System: the page follows without reload
      await page.emulateMedia({ colorScheme: scheme === "light" ? "dark" : "light" });
      await expect.poll(() => theme(page)).toBe(scheme === "light" ? "dark" : "light");
      await ctx.close();
    }
    const ctx = await browser.newContext({ colorScheme: "light" });
    const page = await ctx.newPage();
    await page.goto("/methodology");
    await choose(page, "dark");
    await expect.poll(() => theme(page)).toBe("dark");
    expect(await page.evaluate(() => localStorage.getItem("spacefire:theme"))).toBe("dark");
    await page.emulateMedia({ colorScheme: "light" });
    await page.reload();
    expect(await theme(page)).toBe("dark");                                   // explicit choice beats the OS
    await expect(page.getByTestId("theme-dark")).toHaveAttribute("aria-checked", "true");
    // "browser restart": a new page in the same storage
    const page2 = await ctx.newPage();
    await page2.goto("/");
    expect(await theme(page2)).toBe("dark");
    await ctx.close();
  });

  test("no flash and no hydration error: the theme is on <html> before first paint, every page renders clean", async ({ page }) => {
    const errs = consoleErrors(page);
    await page.addInitScript(() => {
      try { localStorage.setItem("spacefire:theme", "light"); } catch { /* ignore */ }
      // record the theme the moment the body starts parsing (after the head's pre-paint script, before any paint)
      new MutationObserver((_, mo) => {
        if (document.body) {
          (window as unknown as { __firstTheme?: string }).__firstTheme = document.documentElement.dataset.theme ?? "none";
          mo.disconnect();
        }
      }).observe(document, { childList: true, subtree: true });
    });
    const html = await (await page.request.get("/")).text();
    const head = html.slice(0, html.indexOf("</head>"));
    expect(head).toContain('localStorage.getItem("spacefire:theme")');      // render-blocking pre-paint script in <head>
    for (const path of ["/", "/copilot", "/experiments", "/experiments/flex/flex%3A180", PAGE.flex, PAGE.bass, PAGE.saffire,
      "/intelligence/similar", "/evidence", "/evidence/media", "/modeling", "/reliability", "/methodology"]) {
      await page.goto(path);
      expect(await page.evaluate(() => (window as unknown as { __firstTheme?: string }).__firstTheme), path).toBe("light");
      await page.waitForLoadState("networkidle");
      const bg = await page.evaluate(() => getComputedStyle(document.querySelector(".sky")!).backgroundColor);
      expect(bg, path).toBe("rgb(241, 245, 250)");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, path).toBeLessThanOrEqual(1);
    }
    expect(errs.filter((e) => /hydrat|did not match|mismatch/i.test(e))).toEqual([]);
    expect(errs).toEqual([]);
  });

  test("the switcher is a keyboard radio group; switching keeps the route, the sidebar and never reloads", async ({ page }) => {
    await page.goto("/reliability");
    const group = page.getByRole("radiogroup", { name: "Colour theme" });
    await expect(group.getByRole("radio")).toHaveCount(3);
    await expect(group.getByRole("radio", { name: "Light theme" })).toBeVisible();
    await page.getByTestId("nav-toggle").click();                             // collapsed rail
    await page.evaluate(() => { (window as unknown as { __alive: boolean }).__alive = true; });
    await group.getByRole("radio", { name: "Dark theme" }).click();
    await expect.poll(() => theme(page)).toBe("dark");
    const checked = group.getByRole("radio", { checked: true });
    await checked.focus();
    await page.keyboard.press("ArrowLeft");                                   // dark → light
    await expect.poll(() => theme(page)).toBe("light");
    await expect(group.getByRole("radio", { name: "Light theme" })).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect.poll(() => theme(page)).toBe("dark");
    expect(await page.evaluate(() => (window as unknown as { __alive?: boolean }).__alive)).toBe(true);   // same document
    await expect(page).toHaveURL(/\/reliability$/);
    await expect(page.getByTestId("nav-toggle")).toHaveAttribute("aria-expanded", "false");
    // the switcher stays reachable with the rail collapsed, and the choice follows navigation
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: /Methodology/ }).click();
    await expect(page).toHaveURL(/\/methodology/);
    expect(await theme(page)).toBe("dark");
    expect(await page.evaluate(() => (window as unknown as { __alive?: boolean }).__alive)).toBe(true);
    await page.getByTestId("nav-toggle").click();
  });

  test("3D studio: switching theme keeps the canvas, scene, camera, timeline playback and selection", async ({ page }) => {
    const calls = countAssistant(page);
    await openStudio(page, `${PAGE.flex}?view=gravity&component=flame`);
    await choose(page, "dark");
    const tl = page.getByTestId("timeline");
    await tl.getByTestId("timeline-play").click();
    const s0 = (await stats(page))!;
    const p0 = Number(await tl.getByTestId("timeline-scrub").inputValue());
    await choose(page, "light");
    await choose(page, "dark");
    await choose(page, "light");
    const s1 = (await stats(page))!;
    expect(s1.mounts).toBe(s0.mounts);
    expect(s1.live).toBe(1);
    expect(s1.camera).toEqual(s0.camera);
    await expect.poll(async () => Number(await tl.getByTestId("timeline-scrub").inputValue())).toBeGreaterThan(p0);   // still playing
    await expect(tl.getByTestId("timeline-play")).toHaveAccessibleName(/Pause|Replay/);
    await expect(page).toHaveURL(/view=gravity/);
    await expect(page).toHaveURL(/component=flame/);
    await expect(page.getByTestId("split-captions").locator("p").first()).toHaveText("Earth");
    // the stage stays a dark island; the page around it is light
    const stageBg = await page.getByTestId("viewport-box").evaluate((el) => getComputedStyle(el).getPropertyValue("--ink").trim());
    expect(stageBg).toBe("#111d30");
    expect(calls).toEqual([]);
  });

  test("fullscreen and auto-hide survive a theme change (OS switch while on System)", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await openStudio(page, PAGE.bass);
    await choose(page, "system");
    await page.getByTestId("enter-fullscreen").click();
    const studio = page.getByTestId("science-studio");
    await expect(studio).toHaveAttribute("data-immersive", /./);
    const mounts = (await stats(page))!.mounts;
    await page.emulateMedia({ colorScheme: "light" });
    await expect.poll(() => theme(page)).toBe("light");
    await expect(studio).toHaveAttribute("data-immersive", /./);
    expect((await stats(page))!.mounts).toBe(mounts);
    const pending = await page.evaluate(() => window.__spacefireImmersive?.pending() ?? -1);
    expect(pending).toBeLessThanOrEqual(1);
    // the fullscreen studio is a dark island in both themes
    const ink = await studio.evaluate((el) => getComputedStyle(el).getPropertyValue("--ink").trim());
    expect(ink).toBe("#111d30");
    await expect.poll(() => studio.getAttribute("data-chrome"), { timeout: 8000 }).toBe("hidden");
    await page.keyboard.press("Escape");
    await expect(studio).not.toHaveAttribute("data-immersive", /./);
  });

  test("charts recolour to the theme; their data is untouched", async ({ page }) => {
    await page.goto("/phenomena/flame-extinction?record=flex%3A180");
    await openSection(page, "map");
    const plot = page.locator("section#map .js-plotly-plot").first();
    await expect(plot).toBeVisible({ timeout: 60_000 });
    const read = () => plot.evaluate((el) => {
      const p = el as unknown as { _fullLayout: { paper_bgcolor: string; xaxis: { tickfont: { color: string } } }; data: { x?: unknown[]; marker?: { color?: unknown } }[] };
      return { paper: p._fullLayout.paper_bgcolor, tick: p._fullLayout.xaxis.tickfont.color,
        points: p.data.map((d) => d.x?.length ?? 0), colors: p.data.map((d) => String(d.marker?.color ?? "")) };
    });
    await choose(page, "dark");
    await expect.poll(async () => (await read()).paper).toBe("#182840");
    const dark = await read();
    await choose(page, "light");
    await expect.poll(async () => (await read()).paper).toMatch(/^#fff(fff)?$/);
    const light = await read();
    expect(light.points).toEqual(dark.points);                                  // same observations
    expect(light.tick).toBe("#3f5169");
    expect(light.colors).toContain("#0086a3");                                  // Extinction keeps its teal identity
    expect(dark.colors).toContain("#22a6bf");
  });

  test("screenshots of both themes (attached to the report)", async ({ page }) => {
    test.setTimeout(240_000);
    for (const t of ["light", "dark"] as const) {
      await page.goto("/");
      await choose(page, t);
      for (const [name, path] of [["home", "/"], ["flex", `${PAGE.flex}#studio`], ["reliability", "/reliability"], ["explorer", "/experiments"], ["copilot", "/copilot"]] as const) {
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(1200);
        await test.info().attach(`${name}-${t}`, { body: await page.screenshot(), contentType: "image/png" });
      }
    }
  });
});

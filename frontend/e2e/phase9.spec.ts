import { expect, test, type Page } from "@playwright/test";

// Phase 9: discovery experience. Optional URL-driven journey, smart scientific notices, NASA evidence comparison beside
// the 3D model, chart-to-record selection, contextual Copilot drafts and the glossary. No test sends a model request:
// assistant calls are counted and must stay at zero.

function countAssistant(page: Page) {
  const calls: string[] = [];
  page.on("request", (r) => { if (r.url().includes("/api/v1/assistant/")) calls.push(r.url()); });
  return calls;
}

const studio = (page: Page) => page.getByTestId("science-studio");

test.describe("Phase 9: scientific discovery experience", () => {
  test("Home offers the optional journey; choosing a phenomenon continues it", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Why does fire behave differently in space?")).toBeVisible();
    await expect(page.getByTestId("journey-card")).toHaveCount(0);                     // never starts on its own
    await page.getByRole("link", { name: "Start exploring" }).click();
    await expect(page).toHaveURL(/\?journey=choose#explore$/);
    const card = page.getByTestId("journey-card");
    await expect(card.getByRole("heading", { name: "Choose a phenomenon" })).toBeVisible();
    await expect(card.getByRole("progressbar", { name: "Journey progress" })).toHaveAttribute("aria-valuenow", "2");
    const hrefs = await page.getByTestId("phenomenon-card").evaluateAll((els) => els.map((e) => e.getAttribute("href")));
    expect(hrefs).toEqual(["/phenomena/flame-extinction?journey=model#studio", "/phenomena/flame-spread?journey=model#studio",
      "/phenomena/spacecraft-fire?journey=model#studio"]);
    // "Explore on my own" leaves the journey out entirely
    await page.goto("/");
    await page.getByRole("link", { name: "Explore on my own" }).click();
    await expect(page.getByTestId("journey-card")).toHaveCount(0);
    expect(await page.getByTestId("phenomenon-card").first().getAttribute("href")).toBe("/phenomena/flame-extinction");
  });

  test("the FLEX journey can be completed end to end without any model request", async ({ page }) => {
    const calls = countAssistant(page);
    await page.goto("/?journey=choose#explore");
    await page.getByTestId("phenomenon-card").first().click();
    const card = page.getByTestId("journey-card");
    await expect(card.getByRole("heading", { name: "Explore the 3D droplet" })).toBeVisible({ timeout: 60_000 });
    await expect(card).toHaveAttribute("data-step", "model");
    await card.getByTestId("journey-action").click();                                  // select the flame
    await expect(card.getByTestId("journey-task")).toContainText("Done.");
    await expect(page).toHaveURL(/component=flame/);
    await card.getByTestId("journey-next").click();
    await expect(card.getByRole("heading", { name: "Switch gravity off and on" })).toBeVisible();
    await card.getByTestId("journey-action").click();
    await expect(page).toHaveURL(/view=gravity/);
    await expect(card.getByTestId("journey-task")).toContainText("Done.");
    await card.getByTestId("journey-next").click();
    await expect(card.getByRole("heading", { name: "Compare with NASA imagery" })).toBeVisible();
    await expect(page).toHaveURL(/view=nasa/);
    await expect(page).not.toHaveURL(/mode=evidence/);                                 // the visitor's mode is kept
    await card.getByTestId("journey-action").click();                                  // an example test
    await expect(page).toHaveURL(/record=flex%3A180/);
    await expect(page.getByTestId("evidence-compare").getByTestId("record-facts")).toContainText("0.41 mm²/s");
    await expect(card.getByTestId("journey-task")).toContainText("Done.");
    await card.getByTestId("journey-next").click();
    await expect(page).toHaveURL(/\/copilot\?.*journey=ask/);
    const ask = page.getByTestId("journey-card");
    await expect(ask.getByRole("heading", { name: "Ask a scientific question" })).toBeVisible();
    await expect(ask).toContainText("AI generation begins only when you press Ask");
    await expect(page.getByLabel("Your scientific question")).toHaveValue(/nearly spherical in microgravity.*FLEX \(PSI-69\)/);
    await ask.getByTestId("journey-next").click();
    const fin = page.getByTestId("journey-finish");
    await expect(fin.getByRole("link", { name: "Return Home" })).toHaveAttribute("href", "/");
    await expect(fin.getByRole("link", { name: /Explore flame spread/ })).toHaveAttribute("href", "/phenomena/flame-spread?journey=model#studio");
    await expect(fin.getByRole("link", { name: /detailed FLEX measurements/ })).toHaveAttribute("href", "/phenomena/flame-extinction#data");
    await page.getByTestId("journey-exit").click();
    await expect(page.getByTestId("journey-card")).toHaveCount(0);
    await expect(page).not.toHaveURL(/journey=/);
    expect(calls).toEqual([]);
  });

  test("journey Back, End and Escape; ordinary browsing is untouched", async ({ page }) => {
    await page.goto("/phenomena/flame-spread?journey=interact&record=bass2%3A33#studio");
    const card = page.getByTestId("journey-card");
    await expect(card.getByRole("heading", { name: "Compare opposed and concurrent flow" })).toBeVisible({ timeout: 60_000 });
    await card.getByRole("button", { name: "Back" }).click();
    await expect(card).toHaveAttribute("data-step", "model");
    await expect(page).toHaveURL(/record=bass2%3A33/);                                  // same-page steps keep the selection
    await card.getByRole("heading").focus();
    await page.keyboard.press("Escape");                                                 // Escape ends the journey
    await expect(page.getByTestId("journey-card")).toHaveCount(0);
    await expect(page).toHaveURL(/record=bass2%3A33/);
    await expect(page.getByTestId("start-tour")).toBeVisible();                          // the studio's own tour is back
    await page.goto("/phenomena/flame-spread");
    await expect(studio(page)).toBeVisible();
    await expect(page.getByTestId("journey-card")).toHaveCount(0);
  });

  test("FLEX: compare the 3D model with NASA imagery, labelled and sourced", async ({ page }) => {
    await page.goto("/phenomena/flame-extinction?view=nasa&record=flex%3A180#studio");
    const cmp = page.getByTestId("evidence-compare");
    await expect(page.getByTestId("model-label")).toHaveText("3D conceptual model");
    await expect(cmp.getByText("NASA experiment image")).toBeVisible();
    await expect(cmp.getByText("Experiment media").first()).toBeVisible();
    await expect(cmp.getByTestId("compare-fit")).toContainText("not tied to any test number");
    await expect(cmp.getByRole("link", { name: "Open the original NASA source" })).toHaveAttribute("href", /nasa\.gov/);
    await expect(cmp.getByTestId("record-facts")).toContainText("source header ‘Burning rate; mm’, read as mm²/s");
    await cmp.getByRole("radio", { name: "Earth vs orbit" }).click();
    await expect(cmp.getByRole("heading", { name: /Droplet flame on Earth vs aboard the ISS/ })).toBeVisible();
    const diff = cmp.getByRole("button", { name: /What differs between the model and the evidence/ });
    await expect(diff).toHaveAttribute("aria-expanded", "false");
    await diff.press("Enter");
    await expect(cmp.getByText(/Neither picture gives a flame radius/)).toBeVisible();
    // one canvas only: the comparison reuses the studio's viewport
    await expect(page.getByTestId("lab-canvas-host").locator("canvas")).toHaveCount(1, { timeout: 60_000 });
    // a methanol test is told plainly that no methanol FLEX image exists
    await page.goto("/phenomena/flame-extinction?view=nasa&record=flex%3A1#studio");
    await expect(cmp.getByRole("heading", { name: /Droplet flame on Earth vs aboard the ISS/ })).toBeVisible({ timeout: 30_000 });
    await cmp.getByRole("radio", { name: "Burning droplet" }).click();
    await expect(cmp.getByTestId("compare-fit")).toContainText("no verified NASA image names a methanol FLEX droplet");
  });

  test("BASS-II: comparison shows only BASS-II media and the selected test's width conflict in context", async ({ page }) => {
    await page.goto("/phenomena/flame-spread?view=nasa&record=bass2%3A33#studio");
    const cmp = page.getByTestId("evidence-compare");
    await expect(cmp.getByTestId("compare-fit")).toContainText("same sample type as test M7; not a photo of that test", { timeout: 30_000 });
    await expect(cmp.getByRole("radio")).toHaveCount(3);
    for (const name of ["Slab flame", "Rod flame", "Glovebox"]) {
      await cmp.getByRole("radio", { name }).click();
      await expect(cmp.locator("figure img")).toHaveAttribute("src", /\/media\/bass2-/);   // never BASS (I) imagery
    }
    const w = cmp.getByTestId("record-warning").filter({ hasText: "Sample width differs between sources" });
    await expect(w).toBeVisible();
    await expect(w).toContainText("1 cm in the CSV (nominal) and 1.2 cm in Table 5.1");
    // T24's internal report conflict is shown next to its values too
    await page.goto("/phenomena/flame-spread?view=nasa&record=bass2%3A123#studio");
    await expect(cmp.getByTestId("record-warning").filter({ hasText: "BASS-REPORT-INTERNAL-CONFLICT" })).toBeVisible({ timeout: 30_000 });
  });

  test("SAFFIRE-I: hardware photo and footage on request; nothing plays on its own", async ({ page }) => {
    const yt: string[] = [];
    page.on("request", (r) => { if (/youtube|animation\.webp/.test(r.url())) yt.push(r.url()); });
    await page.goto("/phenomena/spacecraft-fire?view=nasa#studio");
    const cmp = page.getByTestId("evidence-compare");
    await expect(cmp.getByTestId("compare-fit")).toContainText("hardware context, no flame", { timeout: 30_000 });
    await expect(cmp.getByTestId("record-facts")).toContainText("Concurrent");
    await cmp.getByRole("radio", { name: "Burn footage" }).click();
    await expect(cmp.getByTestId("compare-fit")).toContainText("loads only when you press play");
    await cmp.getByRole("button", { name: /Open “Saffire-I sample burning aboard Cygnus”/ }).click();
    const dlg = page.getByRole("dialog", { name: "Saffire-I sample burning aboard Cygnus" });
    await expect(dlg).toBeVisible();
    expect(yt).toEqual([]);                                                              // still nothing loaded
    await dlg.getByRole("button", { name: "Play NASA animation" }).click();
    await expect.poll(() => yt.length).toBeGreaterThan(0);
    await page.keyboard.press("Escape");
    await expect(dlg).toBeHidden();
    // the separate NASA footage view is still there
    await studio(page).getByRole("radio", { name: "NASA footage" }).click();
    await expect(page.getByTestId("footage-view")).toBeVisible();
  });

  test("chart selection: a test chosen on the chart is one URL selection shared with the studio, kept on reload", async ({ page }) => {
    const calls = countAssistant(page);
    await page.goto("/phenomena/flame-extinction#map");
    const map = page.locator("section#map");
    const spot = map.getByTestId("record-spotlight");
    await expect(spot.getByRole("heading", { name: "Inspect a test" })).toBeVisible({ timeout: 30_000 });
    await spot.getByLabel("Click a point, or choose a test").selectOption("flex:180");   // keyboard-accessible equivalent of a click
    await expect(page).toHaveURL(/record=flex%3A180/);
    await expect(page).toHaveURL(/#map$/);
    await expect(spot.getByRole("heading", { name: /Selected test: C02H101/ })).toBeVisible();
    await expect(spot.getByTestId("record-facts")).toContainText("3.4 mm");
    await expect(spot.getByRole("link", { name: /Open full record/ })).toHaveAttribute("href", "/experiments/flex/flex%3A180");
    await expect(spot.getByRole("link", { name: /Explore in 3D/ })).toHaveAttribute("href", "#studio");
    await expect(map.getByText("Selected test: C02H101").first()).toBeVisible();          // ring legend on the chart
    // the studio follows the same selection, in the visitor's own mode
    await page.reload();
    await expect(spot.getByRole("heading", { name: /Selected test: C02H101/ })).toBeVisible({ timeout: 30_000 });
    await studio(page).getByRole("tab", { name: "NASA evidence" }).click();
    await expect(page.getByTestId("evidence-record").getByRole("heading", { name: /^Test C02H101/ })).toBeVisible({ timeout: 30_000 });
    await expect(studio(page).getByRole("radio", { name: "Conceptual 3D" })).toHaveAttribute("aria-checked", "true");
    await spot.getByRole("button", { name: "Clear" }).click();
    await expect(page).not.toHaveURL(/record=/);
    expect(calls).toEqual([]);
  });

  test("contextual questions open the Copilot with a draft and never auto-submit", async ({ page }) => {
    const calls = countAssistant(page);
    await page.goto("/phenomena/flame-spread");
    const box = page.getByTestId("ask-suggestions").first();
    await box.scrollIntoViewIfNeeded();
    const first = box.getByRole("link").first();
    const text = (await first.innerText()).trim();
    expect(text).toMatch(/airflow direction affect flame spread over solid materials.*BASS-II/);
    await expect(box).toContainText("AI generation begins only when you press Ask");
    await first.click();
    await expect(page.getByLabel("Your scientific question")).toHaveValue(text);
    await expect(page.getByTestId("draft-context")).toContainText("nothing has been sent");
    await page.waitForTimeout(800);
    // a record page offers questions that name the test
    await page.goto("/experiments/bass2/bass2%3A33");
    const rec = page.getByTestId("ask-suggestions");
    await expect(rec.getByRole("link").first()).toContainText("M7");
    await expect(page.getByTestId("show-on-chart")).toHaveAttribute("href", "/phenomena/flame-spread?record=bass2%3A33#gas");
    expect(calls).toEqual([]);
  });

  test("smart notices: concise and visible, details by keyboard, deep-linkable; important warnings never hidden", async ({ page }) => {
    await page.goto("/phenomena/flame-extinction");
    const n = page.getByTestId("scientific-notice");
    await n.scrollIntoViewIfNeeded();
    await expect(n).toHaveAttribute("role", "note");
    await expect(n).toContainText("Data warning");
    await expect(n).toContainText("Two FLEX source headers require scientific interpretation.");
    await expect(n).toContainText("labelled ‘mm’ but read as mm²/s");                     // the actual issue, while collapsed
    const btn = n.getByRole("button", { name: "Show the details" });
    await expect(btn).toHaveAttribute("aria-expanded", "false");
    await expect(n.getByRole("table")).toBeHidden();
    await btn.focus();
    await page.keyboard.press("Enter");
    await expect(n.getByRole("button", { name: "Hide the details" })).toHaveAttribute("aria-expanded", "true");
    await expect(n.getByRole("table")).toContainText("Header ‘Burning rate; mm’");
    await expect(n.getByRole("link", { name: "FLEX-UNIT-K" })).toHaveAttribute("href", /rule_id=FLEX-UNIT-K/);
    await page.goto("/phenomena/flame-spread#notice-bass");
    await expect(page.locator("#notice-bass")).toHaveAttribute("data-open", "true");
    await expect(page.locator("#notice-bass").getByRole("table")).toContainText("Table 7.1 prints 2.2 cm");
    await page.goto("/phenomena/spacecraft-fire");
    await expect(page.getByTestId("scientific-notice")).toContainText("Some experimental measurements are unavailable in the local dataset.", { timeout: 30_000 });
    await expect(page.getByTestId("mode-banner")).toContainText("not measured NASA output", { timeout: 60_000 });   // studio banner kept
  });

  test("glossary terms open on click or keyboard, close with Escape and return focus", async ({ page }) => {
    await page.goto("/phenomena/flame-spread");
    const term = page.getByTestId("glossary-term").filter({ hasText: "opposed" }).first();
    await term.scrollIntoViewIfNeeded();
    await expect(term).toHaveAttribute("aria-expanded", "false");
    await term.focus();
    await page.keyboard.press("Enter");
    const pop = page.getByRole("dialog", { name: "Opposed flow: definition" });
    await expect(pop).toBeVisible();
    await expect(pop).toContainText("against the direction the flame spreads");
    await page.keyboard.press("Escape");
    await expect(pop).toBeHidden();
    await expect(term).toBeFocused();
    await term.click();
    await expect(pop).toBeVisible();
    await page.mouse.click(5, 300);                                                       // outside closes it
    await expect(pop).toBeHidden();
    await page.goto("/methodology#glossary-d2-law");
    await expect(page.locator("section#glossary")).toHaveAttribute("data-disclosure", "open");
    await expect(page.locator("#glossary-d2-law")).toContainText("consistency check");
  });

  test("without WebGL the journey and the NASA comparison still work", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.addInitScript(() => {
      const orig = HTMLCanvasElement.prototype.getContext as (...a: unknown[]) => unknown;
      Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
        value(this: HTMLCanvasElement, type: string, ...rest: unknown[]) { return /webgl/.test(type) ? null : orig.apply(this, [type, ...rest]); },
      });
    });
    const page = await ctx.newPage();
    await page.goto("/phenomena/flame-extinction?journey=evidence&view=nasa#studio");
    await expect(page.getByTestId("scene-fallback")).toBeVisible({ timeout: 60_000 });
    const card = page.getByTestId("journey-card");
    await card.getByTestId("journey-action").click();
    await expect(page.getByTestId("evidence-compare").getByTestId("record-facts")).toContainText("Heptane");
    await expect(card.getByTestId("journey-task")).toContainText("Done.");
    await card.getByTestId("journey-next").click();
    await expect(page).toHaveURL(/\/copilot\?/);
    await ctx.close();
  });
});

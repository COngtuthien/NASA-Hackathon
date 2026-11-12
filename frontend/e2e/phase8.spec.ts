import { expect, test, type Page } from "@playwright/test";

// Phase 8: human-centred UX. Home naming, progressive disclosure (accessible, state-preserving, deep-linkable),
// visible scientific warnings, concise defaults, answer-first Copilot, and a density budget against regressions.

/** Words of visible text in <main> (closed disclosures and hidden panels excluded). */
async function visibleWords(page: Page) {
  return page.evaluate(() => {
    const main = document.querySelector("main")!;
    const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
    let words = 0;
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const p = n.parentElement;
      if (!p || !p.checkVisibility?.() || !n.textContent!.trim()) continue;
      words += n.textContent!.trim().split(/\s+/).length;
    }
    return words;
  });
}

test.describe("Phase 8: simplified, progressive UX", () => {
  test("the home page is called Home everywhere", async ({ page }) => {
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Main" });
    await expect(nav.getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("heading", { name: "Understanding Fire Beyond Earth", level: 1 })).toBeVisible();
    for (const path of ["/", "/phenomena/flame-spread", "/reliability"]) {
      await page.goto(path);
      expect(await page.locator("body").innerText()).not.toContain("Mission Control");
    }
    await expect(page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link", { name: "Home" })).toBeVisible();
  });

  test("disclosures are accessible, keyboard operable and keep their state", async ({ page }) => {
    await page.goto("/phenomena/flame-extinction");
    const section = page.locator("section#map");
    const btn = section.getByRole("button", { name: "Explore the extinction map" });
    await btn.scrollIntoViewIfNeeded();
    await expect(btn).toHaveAttribute("aria-expanded", "false");
    const bodyId = await btn.getAttribute("aria-controls");
    await expect(page.locator(`[id="${bodyId}"]`)).toBeHidden();
    await btn.focus();
    await page.keyboard.press("Enter");
    await expect(section.getByRole("button", { name: "Hide" })).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator(`[id="${bodyId}"]`)).toBeVisible();
    // a filter chosen inside survives closing and reopening
    await page.locator("#conditions").getByRole("radio", { name: "Methanol" }).click();
    await expect(page).toHaveURL(/fuel=Methanol/);
    await section.getByRole("button", { name: "Hide" }).click();
    await section.getByRole("button", { name: "Explore the extinction map" }).click();
    await expect(page.locator("#conditions").getByRole("radio", { name: "Methanol" })).toHaveAttribute("aria-checked", "true");
    // no generic "More" buttons anywhere on the page
    await expect(page.getByRole("button", { name: /^(More|Show more|Read more)$/ })).toHaveCount(0);
  });

  test("deep links open the right section, including content that loads later", async ({ page }) => {
    await page.goto("/phenomena/flame-spread#report-trust");
    await expect(page.locator("#report-trust").getByText(/T24: Table 7\.1 prints 2\.2 cm/)).toBeVisible({ timeout: 30_000 });
    await page.goto("/methodology#limits");
    await expect(page.locator("section#limits")).toHaveAttribute("data-disclosure", "open");
  });

  test("important scientific warnings stay visible by default", async ({ page }) => {
    const cases: [string, RegExp][] = [
      ["/phenomena/flame-extinction", /labelled ‘mm’ but read as mm²\/s/],
      ["/phenomena/flame-spread", /nominal widths .* actual widths/],
      ["/phenomena/spacecraft-fire", /no manifest frame is shown or reconstructed/],
    ];
    for (const [path, text] of cases) {
      await page.goto(path);
      const note = page.getByRole("note").filter({ hasText: text });
      await note.scrollIntoViewIfNeeded();
      await expect(note).toBeVisible();
    }
    // the conceptual/measured banner is still on the 3D studio
    await expect(page.getByTestId("mode-banner")).toContainText("not measured NASA output", { timeout: 60_000 });
  });

  test("findings are short takeaways whose evidence opens on request", async ({ page }) => {
    await page.goto("/phenomena/flame-extinction");
    const t = page.getByTestId("takeaway").first();
    await t.scrollIntoViewIfNeeded();
    const why = t.getByRole("button", { name: "Why we say this" });
    await expect(why).toHaveAttribute("aria-expanded", "false");
    await why.click();
    await expect(t.getByRole("button", { name: "Hide the evidence" })).toHaveAttribute("aria-expanded", "true");
    await expect(t.getByRole("link").first()).toBeVisible();
  });

  test("Explorer shows key fields first; all columns and filters on request, kept in the URL", async ({ page }) => {
    await page.goto("/experiments?dataset=flex");
    const table = page.locator("table.data");
    await expect(table.getByRole("columnheader", { name: /Initial droplet diameter/ })).toBeVisible();
    await expect(table.getByRole("columnheader", { name: /Burn time/ })).toHaveCount(0);
    await page.getByTestId("all-columns").click();
    await expect(page).toHaveURL(/cols=all/);
    await expect(table.getByRole("columnheader", { name: /Burn time/ })).toBeVisible();
    await expect(page.getByLabel("Diluent")).toBeHidden();
    await page.getByTestId("more-filters").click();
    await page.getByLabel("Diluent").selectOption("He");
    await expect(page).toHaveURL(/f_diluent=He/);
    await page.reload();
    await expect(page.locator("#f-diluent")).toBeVisible();          // an active advanced filter keeps its panel open
    await expect(page.locator("#f-diluent")).toHaveValue("He");
  });

  test("experiment detail: key values with units first, raw cells one click away", async ({ page }) => {
    await page.goto("/experiments/flex/flex%3A180");
    const ov = page.getByTestId("test-overview");
    await expect(ov.getByText("0.41")).toBeVisible();
    await expect(ov.getByText("mm²/s").first()).toBeVisible();
    await expect(ov.getByText(/header reads ‘Burning rate; mm’/)).toBeVisible();
    const raw = page.getByRole("button", { name: "Show raw and parsed values" });
    await raw.click();
    await expect(page.locator("section#values").getByText("Burning rate; mm", { exact: true })).toBeVisible();
  });

  test("Copilot is answer-first; sources and build details on request; evidence-only stays explicit", async ({ page }) => {
    const claims = Array.from({ length: 5 }, (_, i) => ({ text: `Statement ${i + 1} about FLEX.`, kind: "COMPUTED", citation_ids: ["cite-1"], conditions: "" }));
    const data = { question: "q", source_scope: "internal", investigations_detected: ["PSI-69"], experiments_matched: [],
      citations: [{ citation_id: "cite-1", source_type: "analysis", title: "FLEX d²-law consistency analysis", url: null, document_id: null, chunk_id: null,
        experiment_uid: null, doi: null, page_pdf: null, section: null, excerpt: null, data: null, access_level: "computed", rank_label: null, reasons: null }],
      tool_calls: [{ tool: "flex_d2_check", args: {}, ok: true, ms: 7 }], external_providers: null, trace_id: "e2e8",
      llm: { configured: true, provider: "gemini", model: "gemini-3.8-flash", mode: "synthesis", reason: null, calls: 1, latency_ms: 1000 },
      answer: "The median ratio is close to one [cite-1].", status: "answered", claims, limitations: ["Adaptive test design."], suggested_followups: [],
      verification: { rejected: [], accepted_claims: 5 } };
    await page.route("**/api/v1/assistant/ask/stream", (r) => r.fulfill({ status: 200, contentType: "application/x-ndjson",
      body: JSON.stringify({ event: "result", data }) + "\n" }));
    await page.goto("/copilot");
    await page.getByLabel("Your scientific question").fill("Is the d2 law consistent?");
    await page.getByRole("button", { name: /^Ask/ }).click();
    await expect(page.getByTestId("answer-text")).toHaveText("The median ratio is close to one 1.");   // exact text, marker rendered
    await expect(page.getByText(/^Statement \d about FLEX\.$/)).toHaveCount(3);
    await page.getByRole("button", { name: "Show all 5 statements" }).click();
    await expect(page.getByText(/^Statement \d about FLEX\.$/)).toHaveCount(5);
    await expect(page.getByText("Adaptive test design.")).toBeVisible();                   // limitations always visible
    const toggle = page.getByTestId("sources-toggle");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await page.getByTestId("answer-text").getByRole("button", { name: "1" }).click();      // a citation marker opens the sources
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator("#c-cite-1")).toBeVisible();
    await expect(page.getByRole("list", { name: "Tools that ran for this answer" })).toBeHidden();
  });

  test("reliability leads with the most important warnings; the full browser opens with a filter", async ({ page }) => {
    await page.goto("/reliability");
    const top = page.getByTestId("top-warnings");
    await expect(top.locator("li").first()).toBeVisible({ timeout: 30_000 });
    await expect(top.getByText("critical").first()).toBeVisible();
    await expect(page.locator("section#flags")).toHaveAttribute("data-disclosure", "closed");
    await page.goto("/reliability?severity=critical");
    await expect(page.locator("section#flags")).toHaveAttribute("data-disclosure", "open");
  });

  test("Home example questions only pre-fill the Copilot (no request)", async ({ page }) => {
    const asks: string[] = [];
    page.on("request", (r) => { if (r.url().includes("/assistant/")) asks.push(r.url()); });
    await page.goto("/");
    const ex = page.locator('section[aria-labelledby="cp-title"] a[href^="/copilot?"]').first();
    await ex.scrollIntoViewIfNeeded();
    const text = (await ex.innerText()).trim();
    await ex.click();
    await expect(page.getByLabel("Your scientific question")).toHaveValue(text);
    await page.waitForTimeout(1000);
    expect(asks).toEqual([]);
  });

  test("density budget: default pages stay concise", async ({ page }) => {
    const budget: [string, number][] = [
      ["/", 700], ["/phenomena/flame-extinction", 1100], ["/phenomena/flame-spread", 1100], ["/phenomena/spacecraft-fire", 1100],
      ["/reliability", 900], ["/methodology", 700], ["/experiments/flex/flex%3A180", 500],
    ];
    for (const [path, max] of budget) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const w = await visibleWords(page);
      expect(w, `${path} shows ${w} words by default`).toBeLessThanOrEqual(max);
    }
  });
});

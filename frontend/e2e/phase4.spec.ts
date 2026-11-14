import { openSection } from "./helpers";
import { expect, test, type Page } from "@playwright/test";

// Phase 4: Gemini synthesis UI (with deterministic mocked streams), live progress, quota states, Methodology,
// BASS-II report cross-checks and reviewed citation links. The opt-in live test at the end calls the real model.

const Q = "Is the d2 law consistent with the reported FLEX burn times?";

function answer(over: Record<string, unknown> = {}) {
  return {
    question: Q, source_scope: "internal", investigations_detected: ["PSI-69"], experiments_matched: [], charts: [],
    citations: [{ citation_id: "cite-1", source_type: "analysis", title: "FLEX d²-law consistency analysis", url: "/physics/flex#d2",
      document_id: null, chunk_id: null, experiment_uid: null, paper_id: null, doi: null, page_pdf: null, section: null, excerpt: null,
      data: { summary: { n_included: 183, median_ratio: 1.0483 } }, access_level: "computed", rank_label: null, reasons: null }],
    tool_calls: [{ tool: "flex_d2_check", args: {}, ok: true, ms: 7 }, { tool: "get_document_evidence", args: {}, ok: true, ms: 110 },
      { tool: "synthesize_answer", args: { attempt: 1, model: "gemini-3.8-flash" }, ok: true, ms: 4200 },
      { tool: "verify_citations", args: { claims: 1 }, ok: true, ms: 0 }],
    external_providers: null, trace_id: "e2e000000001",
    llm: { configured: true, provider: "gemini", model: "gemini-3.8-flash", mode: "synthesis", reason: null, calls: 1,
      model_version: "gemini-3.8-flash", latency_ms: 4200, cached: false },
    answer: "Yes: the median ratio of reported to estimated burn time is 1.0483 over 183 tests [cite-1].", status: "answered",
    claims: [{ text: "Median t_reported / t_est is 1.0483 across 183 included tests.", kind: "COMPUTED", citation_ids: ["cite-1"], conditions: "FLEX, d²-law" }],
    limitations: [], suggested_followups: [], verification: { rejected: [], accepted_claims: 1 },
    ...over,
  };
}

async function mockStream(page: Page, final: Record<string, unknown>) {
  await page.route("**/api/v1/assistant/ask/stream", (r) => r.fulfill({
    status: 200, contentType: "application/x-ndjson",
    body: [
      { event: "start", trace_id: "e2e000000001" },
      { event: "tool_start", tool: "flex_d2_check", args: {} }, { event: "tool_end", tool: "flex_d2_check", ok: true, ms: 7 },
      { event: "tool_start", tool: "synthesize_answer", args: { attempt: 1 } },
      { event: "tool_end", tool: "synthesize_answer", ok: true, ms: 4200 },
      { event: "result", data: final },
    ].map((e) => JSON.stringify(e)).join("\n") + "\n",
  }));
}

async function askCopilot(page: Page) {
  await page.goto("/copilot");
  await page.getByLabel("Your scientific question").fill(Q);
  await page.getByRole("button", { name: /^Ask/ }).click();
}

test.describe("Phase 4", () => {
  test("Copilot uses the streaming endpoint and renders a verified AI answer with model line and citations", async ({ page }) => {
    await mockStream(page, answer());
    const req = page.waitForRequest("**/api/v1/assistant/ask/stream");
    await askCopilot(page);
    expect((await req).postDataJSON()).toMatchObject({ question: Q, source_scope: "internal" });
    await expect(page.getByText("Answered", { exact: true })).toBeVisible();
    await expect(page.getByText(/Written by gemini-3\.8-flash in 4\.2 s/)).toBeVisible();
    await expect(page.getByText(/1 verified statement/)).toBeVisible();
    await page.getByText(/How this answer was built/).click();   // Phase 8: the tool trace is build detail, on request
    const trace = page.getByRole("list", { name: "Tools that ran for this answer" });
    await expect(trace.getByText("Write answer with the model")).toBeVisible();
    await expect(trace.getByText("Verify citations and numbers")).toBeVisible();
    await page.locator("p button", { hasText: "1" }).first().click();  // citation marker jumps to the source
    await expect(page.locator("#c-cite-1")).toHaveClass(/border-flame/);
  });

  test("a quota error shows evidence only with the reset hint, never AI text", async ({ page }) => {
    await mockStream(page, answer({
      status: "retrieval_only", answer: null, claims: [], verification: undefined,
      llm: { configured: true, provider: "gemini", model: "gemini-3.8-flash", mode: "paused", reason: "quota", error: "rate_limit", retry_after_s: 5400 },
      limitations: ["AI synthesis failed (rate_limit): Gemini free-tier quota reached (daily request limit). Showing retrieved evidence only."],
    }));
    await askCopilot(page);
    await expect(page.getByText("Evidence only", { exact: true })).toBeVisible();
    await expect(page.getByTestId("llm-error")).toHaveText(/free request quota is used up for now\. It should be available again in about 90 min/);
    await expect(page.getByTestId("llm-retry")).toHaveCount(0);   // a quota error is not retried from the page
    await expect(page.getByText(/Written by/)).toHaveCount(0);
  });

  test("a saved answer says it used no model request", async ({ page }) => {
    await mockStream(page, answer({ llm: { configured: true, provider: "gemini", model: "gemini-3.8-flash", mode: "synthesis",
      reason: null, calls: 0, cached: true, cached_at: "2026-11-11T06:00:00+00:00", model_version: "gemini-3.8-flash" } }));
    await askCopilot(page);
    await expect(page.getByText(/saved answer from 2026-11-11 06:00 UTC .* no model request used/)).toBeVisible();
  });

  test("real backend stream: live steps, then the final trace", async ({ page }) => {
    await askCopilot(page);
    await expect(page.getByText(/^(Answered|Partial answer|Insufficient evidence|Evidence only)$/)).toBeVisible({ timeout: 90_000 });
    await page.getByText(/How this answer was built/).click();
    const trace = page.getByRole("list", { name: "Tools that ran for this answer" });
    await expect(trace.getByText("FLEX d²-law check")).toBeVisible();
    await expect(trace.getByText("Search NASA documents")).toBeVisible();
  });

  test("Methodology shows the pipeline, AI verification and live link-confidence counts", async ({ page }) => {
    await page.goto("/methodology");
    for (const h of ["From NASA files to a cited answer", "The model phrases; code verifies", "How strongly a passage is tied to a test",
      "Scientific rules the system follows", "What this system cannot do"]) {
      await expect(page.getByRole("heading", { name: h })).toBeVisible();
    }
    await openSection(page, "citations");
    await expect(page.getByText(/Reviewed by hand: .*3 cross-reference/)).toBeVisible();
    await openSection(page, "ai");
    await expect(page.getByText(/20 of 20/).first()).toBeVisible();
    await expect(page.getByRole("navigation", { name: "On this page" }).getByRole("link", { name: "AI answers" })).toBeVisible();
    const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(ov).toBeLessThanOrEqual(1);
  });

  test("BASS-II page shows report cross-checks and the T24 conflict", async ({ page }) => {
    await page.goto("/phenomena/flame-spread#report-trust");
    const p = page.locator("#report-trust");
    await expect(p.getByText("How far the report-only values can be trusted")).toBeVisible({ timeout: 30_000 });
    await expect(p.getByText(/T24: Table 7\.1 prints 2\.2 cm/)).toBeVisible();
    await expect(p.getByRole("link", { name: "Read the flag" })).toHaveAttribute("href", /BASS-AIR-DISPLAY-NOT-VELOCITY/);
  });

  test("experiment detail labels a reviewed cross-reference link", async ({ page }) => {
    await page.goto("/experiments/bass2/bass2:2#pages");
    await expect(page.getByText(/Reviewed mention/).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/named in another test's notes/)).toBeVisible();
  });
});

// Opt-in: spends one real Gemini request (free tier: 20/day). Run with E2E_LIVE_LLM=1.
test("live Gemini answer is cited and verified end to end", async ({ page }) => {
  test.skip(!process.env.E2E_LIVE_LLM, "set E2E_LIVE_LLM=1 to call the real model");
  test.setTimeout(150_000);
  await page.goto("/copilot");
  await page.getByLabel("Your scientific question").fill("What is SIBAL fabric?");
  await page.getByRole("button", { name: /^Ask/ }).click();
  await expect(page.getByText("Write answer with the model").first()).toBeVisible({ timeout: 30_000 });  // live step
  await expect(page.getByText(/^(Answered|Partial answer)$/)).toBeVisible({ timeout: 120_000 });
  await expect(page.getByText(/Written by gemini/)).toBeVisible();
  const markers = page.locator("p.max-w-\\[78ch\\] button");
  expect(await markers.count()).toBeGreaterThan(0);
});

import { expect, test, type Page } from "@playwright/test";

// Research Copilot reliability (fix/spacefire-copilot-server-error). The real request path (browser → Next proxy →
// FastAPI → retrieval) is exercised with the model disabled; provider failures and server errors are replayed as
// deterministic streams. No test makes a model request.

const Q = "Why do droplet flames become nearly spherical in microgravity?";

function evidenceOnly(kind: string, retryAfter: number | null = null) {
  return {
    question: Q, source_scope: "internal", investigations_detected: ["PSI-69"], experiments_matched: [], charts: [],
    citations: [{ citation_id: "cite-1", source_type: "local_document", title: "Effect of Varying the Initial Diameter of n-Octane and n-Decane Droplets in Microgravity",
      url: null, document_id: "d1", chunk_id: "c1", experiment_uid: null, paper_id: null, doi: null, page_pdf: 3, section: null,
      excerpt: "a spherically symmetric n-decane droplet flame from the microgravity experiments on the ISS", data: null,
      access_level: "public", rank_label: null, reasons: null }],
    tool_calls: [{ tool: "get_document_evidence", args: {}, ok: true, ms: 1500 },
      { tool: "synthesize_answer", args: { attempt: 1, model: "gemini-3.8-flash" }, ok: false, ms: 70319, error: `${kind}: provider detail` }],
    external_providers: null, trace_id: "e2e0000000aa",
    llm: { configured: true, provider: "gemini", model: "gemini-3.8-flash", mode: "synthesis", reason: null, error: kind, retry_after_s: retryAfter },
    answer: null, status: "retrieval_only", claims: [], limitations: ["AI synthesis failed. Showing retrieved evidence only."],
    suggested_followups: [],
  };
}

async function stream(page: Page, events: Record<string, unknown>[]) {
  await page.route("**/api/v1/assistant/ask/stream", (r) => r.fulfill({
    status: 200, contentType: "application/x-ndjson", body: events.map((e) => JSON.stringify(e)).join("\n") + "\n",
  }));
}
async function ask(page: Page) {
  await page.goto("/copilot");
  await page.getByLabel("Your scientific question").fill(Q);
  await page.getByRole("button", { name: /^Ask/ }).click();
}
function errorsOf(page: Page) {
  const errs: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  page.on("pageerror", (e) => errs.push(String(e)));
  return errs;
}

test.describe("Copilot errors and fallback", () => {
  test("real flow: the question reaches FastAPI through the proxy, NASA evidence comes back, citations are usable", async ({ page }) => {
    const errs = errorsOf(page);
    const req = page.waitForRequest("**/api/v1/assistant/ask/stream");
    const res = page.waitForResponse("**/api/v1/assistant/ask/stream");
    await ask(page);
    expect((await req).postDataJSON()).toMatchObject({ question: Q });
    const r = await res;
    expect(r.status()).toBe(200);
    expect(r.headers()["content-type"]).toContain("application/x-ndjson");
    await expect(page.getByText("Evidence only", { exact: true })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText(/Written by/)).toHaveCount(0);                  // never presented as AI-written
    const src = page.locator("[id^=c-cite-]").first();
    await expect(src).toBeVisible();
    await expect(src.getByRole("link").first()).toHaveAttribute("href", /.+/);   // the passage opens in the evidence explorer
    await expect(page.locator("main [role=alert]")).toHaveCount(0);
    expect(errs).toEqual([]);
  });

  for (const [kind, text, retry] of [
    ["unavailable", /temporarily unavailable \(Google reports it as overloaded or unreachable\)/, true],
    ["timeout", /did not respond in time/, true],
    ["auth", /rejected the configured credentials \(check LLM_API_KEY/, false],
    ["bad_request", /could not use the configured model or request \(check LLM_MODEL/, false],
    ["rate_limit", /free request quota is used up for now\. It should be available again in about 90 s\./, false],
  ] as const) {
    test(`provider ${kind}: plain message, the NASA evidence stays, retry only when it can help`, async ({ page }) => {
      await stream(page, [{ event: "start", trace_id: "e2e0000000aa" }, { event: "heartbeat" },
        { event: "result", data: evidenceOnly(kind, kind === "rate_limit" ? 90 : null) }]);
      await ask(page);
      await expect(page.getByText("Evidence only", { exact: true })).toBeVisible();
      await expect(page.getByTestId("llm-error")).toHaveText(text);
      await expect(page.getByText(/You can still explore the NASA evidence found for your question below/)).toBeVisible();
      await expect(page.locator("#c-cite-1")).toBeVisible();
      await expect(page.getByText(/Written by/)).toHaveCount(0);
      await expect(page.getByTestId("llm-retry")).toHaveCount(retry ? 1 : 0);
      await expect(page.getByText(/Server Error/i)).toHaveCount(0);
    });
  }

  test("retry asks again exactly once per click (no automatic retry loop)", async ({ page }) => {
    let calls = 0;
    await page.route("**/api/v1/assistant/ask/stream", (r) => {
      calls += 1;
      return r.fulfill({ status: 200, contentType: "application/x-ndjson",
        body: JSON.stringify({ event: "result", data: evidenceOnly("unavailable") }) + "\n" });
    });
    await ask(page);
    await expect(page.getByTestId("llm-retry")).toBeVisible();
    await page.waitForTimeout(1500);
    expect(calls).toBe(1);
    await page.getByTestId("llm-retry").getByRole("button").click();
    await expect.poll(() => calls).toBe(2);
    await page.waitForTimeout(1500);
    expect(calls).toBe(2);
  });

  test("an internal server error is explained, distinct from the AI service, with Retry", async ({ page }) => {
    await stream(page, [{ event: "start", trace_id: "x" },
      { event: "error", error: { code: "internal_error", message: "Unexpected server error." } }]);
    await ask(page);
    const alert = page.locator("main [role=alert]");
    await expect(alert).toContainText("Something went wrong on the SpaceFire server while answering (an internal error, not the AI service)");
    await expect(alert.getByRole("button", { name: "Retry" })).toBeVisible();
  });

  test("backend down: says the API is not reachable", async ({ page }) => {
    await page.route("**/api/v1/assistant/ask/stream", (r) => r.fulfill({ status: 500, contentType: "text/plain", body: "Internal Server Error" }));
    await ask(page);
    await expect(page.locator("main [role=alert]")).toContainText("The SpaceFire API is not reachable");
  });

  test("a stream cut before the result is reported as an interrupted connection", async ({ page }) => {
    await stream(page, [{ event: "start", trace_id: "x" }, { event: "tool_start", tool: "get_document_evidence", args: {} }]);
    await ask(page);
    await expect(page.locator("main [role=alert]")).toContainText("interrupted before the answer was complete");
  });

  test("the page gives up only after 45 s of silence (the server sends a heartbeat every 15 s)", async ({ page }) => {
    await page.clock.install();
    await page.route("**/api/v1/assistant/ask/stream", () => { /* never answers: a server that went silent */ });
    await ask(page);
    await page.clock.runFor(44_000);
    await expect(page.locator("main [role=alert]")).toHaveCount(0);               // 44 s of silence: still waiting
    await page.clock.runFor(2_000);
    await expect(page.locator("main [role=alert]")).toContainText("stopped responding while answering");
  });
});

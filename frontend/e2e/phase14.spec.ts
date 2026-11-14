import { expect, test, type Page } from "@playwright/test";

// Phase 14: Research-to-Safety Explorer. For each of the four scenarios: entry card, a real filter, ranked
// investigations (primary first), evidence with its class and source, interpretation, chart and 3D deep links that
// land on working pages, and the Copilot handoff. The backend runs evidence-only: no model request is sent.

function consoleErrors(page: Page) {
  const errs: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("caret-color") && !m.text().includes("hydrated but some attributes")) errs.push(m.text());
  });
  page.on("pageerror", (e) => errs.push(String(e)));
  return errs;
}
const ranked = (page: Page) => page.getByTestId("ranked-list").locator(":scope > li");
async function workspace(page: Page, path: string) {
  await page.goto(path);
  await expect(page.getByTestId("explorer-workspace")).toBeVisible({ timeout: 30_000 });
}
async function pick(page: Page, testid: string, value: string) {
  const resp = page.waitForResponse((r) => r.url().includes("/api/v1/explorer/scenarios/") && r.status() === 200);
  await page.getByTestId(testid).selectOption(value);
  await resp;
}

test("entry page: four scenario cards, ranking explanation, research-only notice, navigation", async ({ page }) => {
  const errs = consoleErrors(page);
  await page.goto("/safety-explorer");
  for (const id of ["flame-spread", "gaseous-flames", "smoke-detection", "droplet-extinction"]) {
    await expect(page.getByTestId(`scenario-card-${id}`)).toBeVisible();
  }
  await expect(page.getByTestId("explorer-disclaimer")).toContainText("not fire-risk scores");
  await expect(page.getByTestId("ranking-explainer")).toContainText("Applicability");
  await expect(page.getByRole("navigation", { name: /main/i }).getByRole("link", { name: "Research-to-Safety Explorer" }).first())
    .toHaveAttribute("aria-current", "page");
  await page.getByTestId("scenario-card-smoke-detection").click();
  await expect(page).toHaveURL(/\/safety-explorer\/smoke-detection$/);
  await expect(page.getByTestId("research-question")).toContainText("smoke particle characteristics");
  expect(errs).toEqual([]);
});

test("A. flame spread: material + flow filter, BASS-II first, report spread rates, chart and 3D links", async ({ page }) => {
  const errs = consoleErrors(page);
  await workspace(page, "/safety-explorer/flame-spread");
  await expect(ranked(page).first()).toHaveAttribute("data-testid", "ranked-PSI-25");
  await pick(page, "filter-material", "mat:pmma");
  await pick(page, "filter-flow", "flow:opposed");
  await expect(page).toHaveURL(/material=mat%3Apmma.*flow=flow%3Aopposed|flow=flow%3Aopposed.*material=mat%3Apmma/);
  const bass = page.getByTestId("ranked-PSI-25");
  await expect(bass.getByTestId("rank-explanation")).toContainText(/\d+ of 129 records meet the selected conditions/);
  await expect(page.getByTestId("ranked-PSI-62").getByTestId("rank-explanation")).toContainText("Supporting context only");
  const first = page.getByTestId("evidence-item").first();
  await expect(first).toHaveAttribute("data-evidence-class", "measured");
  await expect(first).toContainText("Summary Report Table 5.1");
  await expect(page.getByTestId("evidence-summary")).toContainText("PMMA slab");
  // BRE never appears as a BASS-II spread measurement
  await page.getByTestId("evidence-more").click();
  await expect(page.getByTestId("evidence-list")).toContainText("not a measured BASS-II flame-spread rate");
  // score breakdown is explainable
  await bass.getByRole("button", { name: "How this score was computed" }).click();
  await expect(page.getByTestId("breakdown-PSI-25")).toContainText("Score = 0.5 × relevance");
  // chart deep link opens the BASS-II report tables
  await page.getByTestId("action-charts").getByRole("link").click();
  await expect(page).toHaveURL(/\/phenomena\/flame-spread#spread$/);
  await expect(page.locator("section#report-tables")).toHaveAttribute("data-disclosure", "open");
  await page.goBack();
  await workspace(page, page.url());
  // 3D deep link selects the BASS-II test in the existing studio
  const studio = await page.getByTestId("action-studio").getByRole("link").getAttribute("href");
  expect(studio).toMatch(/^\/phenomena\/flame-spread\?record=bass2%3A\d+#studio$|^\/phenomena\/flame-spread\?record=bass2:\d+#studio$/);
  await page.getByTestId("action-studio").getByRole("link").click();
  await expect(page.getByTestId("science-studio")).toBeVisible({ timeout: 30_000 });
  expect(errs).toEqual([]);
});

test("B. gaseous flames: inverse filter rejects normal tests, cool-flame evidence, CFI-G deep links", async ({ page }) => {
  const errs = consoleErrors(page);
  await workspace(page, "/safety-explorer/gaseous-flames");
  await expect(ranked(page).first()).toHaveAttribute("data-testid", "ranked-PSI-159");
  await expect(page.getByTestId("evidence-list")).toContainText("Cool-flame event 21174C3");
  await expect(page.getByTestId("evidence-list")).toContainText("CFI-G Final Report Table 3, PDF p.46");
  await pick(page, "filter-configuration", "flow:inverse");
  const sum = page.getByTestId("evidence-summary");
  await expect(sum).toContainText("inverse flames");
  await expect(sum).not.toContainText("normal flames");
  await expect(page.getByTestId("evidence-list")).not.toContainText("Cool-flame event");      // Table 3 events are all normal flames
  await expect(page.getByTestId("interp-cannot")).toContainText("Flow-terminated burn times are lower bounds");
  // the chart link carries the configuration into the CFI-G page's own filter
  const charts = page.getByTestId("action-charts").getByRole("link");
  await expect(charts).toHaveAttribute("href", /tab=cfig&cfg=inverse/);
  await charts.click();
  await expect(page.getByTestId("cfig-filters").getByRole("radio", { name: "Inverse" })).toHaveAttribute("aria-checked", "true");
  await page.goBack();
  await workspace(page, page.url());
  await page.getByTestId("action-experiment").getByRole("link").click();
  await expect(page.getByTestId("cfig-test-record")).toBeVisible({ timeout: 30_000 });
  await page.goto("/safety-explorer/gaseous-flames");
  await page.getByTestId("action-studio").getByRole("link").click();
  await expect(page).toHaveURL(/\/phenomena\/gaseous-flames#studio$/);
  await expect(page.getByTestId("lite-studio")).toBeVisible({ timeout: 30_000 });
  expect(errs).toEqual([]);
});

test("C. smoke detection: Kapton sizes from Table 1, instruments, material carried into the studio", async ({ page }) => {
  const errs = consoleErrors(page);
  await workspace(page, "/safety-explorer/smoke-detection");
  await expect(ranked(page).first()).toHaveAttribute("data-testid", "ranked-PSI-102");
  await expect(page.getByTestId("ranked-PSI-25").getByTestId("rank-explanation")).toContainText("Supporting context only");
  await pick(page, "filter-material", "mat:kapton-polyimide-film");
  const list = page.getByTestId("evidence-list");
  await expect(list).toContainText("Kapton (polyimide film), fresh smoke");
  await expect(list).toContainText("arithmetic mean 105 nm");
  await expect(page.getByTestId("interp-shows")).toContainText("105 nm fresh, 186 nm after aging");
  await expect(page.getByTestId("interp-cannot")).toContainText("No detector sensitivity");
  await page.getByTestId("action-studio").getByRole("link").click();
  await expect(page).toHaveURL(/\/phenomena\/smoke-detection\?material=kapton#studio$/);
  await expect(page.getByTestId("lite-studio")).toBeVisible({ timeout: 30_000 });
  await page.goto("/safety-explorer/smoke-detection");
  await page.getByTestId("action-charts").getByRole("link").click();
  await expect(page.getByTestId("same-size-table")).toBeVisible();
  expect(errs).toEqual([]);
});

test("D. droplet extinction: out-of-range oxygen says no evidence; PSI-117 and FLEX links work", async ({ page }) => {
  const errs = consoleErrors(page);
  await workspace(page, "/safety-explorer/droplet-extinction?o2_min=0.9&o2_max=1");
  await expect(page.getByTestId("no-match")).toHaveText("No matching experimental evidence is available for these conditions.");
  await expect(page.getByTestId("ranked-PSI-117").getByTestId("rank-explanation")).toContainText("does not record oxygen");
  await workspace(page, "/safety-explorer/droplet-extinction");
  await expect(ranked(page).first()).toHaveAttribute("data-testid", "ranked-PSI-69");
  await pick(page, "filter-fuel", "fuel:n-heptane");
  await expect(page.getByTestId("evidence-summary")).toContainText("Heptane");
  await expect(page.getByTestId("evidence-summary")).not.toContainText("Methanol");
  await expect(page.getByTestId("ranked-PSI-68").getByTestId("rank-explanation")).toContainText("no measurements");
  await page.getByTestId("action-psi117").getByRole("link").click();
  await expect(page.locator("section#psi117-explore")).toHaveAttribute("data-disclosure", "open");
  await page.goBack();
  await workspace(page, page.url());
  await page.getByTestId("action-charts").getByRole("link").click();
  await expect(page).toHaveURL(/\/phenomena\/flame-extinction\?fuel=Heptane#map$/);
  await expect(page.locator("section#map")).toHaveAttribute("data-disclosure", "open");
  expect(errs).toEqual([]);
});

test("Copilot handoff: Explorer context is shown, sent as ids, and resolved by the server", async ({ page, request }) => {
  await workspace(page, "/safety-explorer/gaseous-flames?configuration=flow%3Anormal&fuel=fuel%3An-butane");
  await page.getByTestId("action-copilot").getByRole("link").click();
  await expect(page).toHaveURL(/\/copilot\?draft=.*scenario=gaseous-flames/);
  const ctx = page.getByTestId("explorer-context");
  await expect(ctx).toContainText("gaseous flames");
  await expect(ctx).toContainText("PSI-159");
  await expect(page.locator("#aq")).toHaveValue(/Under which experimental conditions do gaseous microgravity flames/);
  const h = await (await request.get("/api/v1/health")).json();
  test.skip(h.llm?.mode !== "retrieval_only", "only send the question when the API is evidence-only (no Gemini quota)");
  const sent = page.waitForRequest((r) => r.url().includes("/assistant/ask") && r.method() === "POST");
  await page.getByRole("button", { name: /^Ask/ }).click();
  const body = JSON.parse((await sent).postData() ?? "{}");
  expect(body.explorer_context.scenario).toBe("gaseous-flames");
  expect(body.explorer_context.investigation).toBe("PSI-159");
  await expect(page.getByTestId("question-type").first()).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("Research-to-Safety Explorer: Gaseous Flame Behavior").first()).toBeAttached();
});

test("Copilot abstains on an unsupported certification question (no model call)", async ({ request }) => {
  const a = await (await request.post("/api/v1/assistant/ask", { data: {
    question: "Can SpaceFire AI certify that an untested polymer is safe in a spacecraft cabin?", source_scope: "internal" } })).json();
  expect(a.question_type.type).toBe("unsupported");
  expect(a.status).toBe("insufficient_evidence");
  expect(a.answer).toMatch(/^I can't answer this from the NASA evidence/);
  expect(a.llm.calls ?? 0).toBe(0);
});

test("invalid filter values show an error, and the light theme renders the Explorer", async ({ page }) => {
  await page.goto("/safety-explorer/gaseous-flames?fuel=fuel%3Aunobtainium");
  await expect(page.getByText(/Unknown fuel/)).toBeVisible({ timeout: 30_000 });
  await page.addInitScript(() => { try { localStorage.setItem("spacefire:theme", "light"); } catch { /* ignore */ } });
  const errs = consoleErrors(page);
  for (const path of ["/safety-explorer", "/safety-explorer/flame-spread"]) {
    await page.goto(path);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(page.locator("h1")).toBeVisible();
  }
  expect(errs).toEqual([]);
});

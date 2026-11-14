# SpaceFire AI

Evidence-grounded microgravity combustion intelligence for the NASA Space Apps Challenge 2026
(*Flame in Freefall: AI-Powered Fire Safety Insights from Microgravity Combustion Data*).

SpaceFire AI turns three NASA Physical Sciences Informatics investigations into a searchable, citable research workspace:

| Investigation | What it is | Local records |
|---|---|---|
| **FLEX** (PSI-69) | Liquid droplet (methanol, n-heptane) flame extinction on the ISS | 274 test rows |
| **BASS-II** (PSI-25) | Small solid samples (PMMA, SIBAL, Nomex, wax) in a glovebox flow duct | 129 test rows |
| **SAFFIRE-I** (PSI-98) | Large-scale fabric fire aboard an uncrewed Cygnus vehicle (2016) | 2 burns + 2 image-set rows + a 12-sheet image manifest |

**Phase 13** adds seven more investigations at the evidence level their downloaded files support (see
`docs/PHASE13_IMPLEMENTATION_REPORT.md`):

| Investigation | Evidence in SpaceFire | Where |
|---|---|---|
| **ACME CFI-G** (PSI-159) | 333 per-test outcomes (normal/inverse kept apart) + 15 measured cool-flame events | Gaseous Flame Dynamics |
| **ACME Flame Design** (PSI-10) | 327 test conditions (no outcomes in the data) + report findings | Gaseous Flame Dynamics |
| **ACME BRE** (PSI-20) | 18-day campaign log + report findings (emulation, not a material test) | Gaseous Flame Dynamics |
| **SAME** (PSI-102) | Verified particle sizes (8), 47-test flight log; raw telemetry deferred | Smoke & Fire Detection |
| **PSI-117** | 61 published figure series: experiment vs 1-D model | Flame Extinction page |
| **FLEX-2** (PSI-68), **PSI-62** | Documents and metadata only | Copilot and registry |

The NASA source folders for these seven are local-only (not in Git); their verified derivatives are committed in
`processed/curated/phase13/` and rebuilt with `python -m app.ingest.phase13.run`.

**Phase 14** adds the **Research-to-Safety Explorer** (`/safety-explorer`): start from one of four research scenarios
(flame spread in spacecraft materials, gaseous flame behavior, early smoke detection, droplet flame extinction), filter
by conditions present in the data, and get the NASA investigations ranked by a transparent research-relevance score
(not a fire-risk score), the supporting evidence with its class and source, an interpretation, and links to the charts,
3D studios and Copilot. It is backed by a provenance-tracked SQLite knowledge graph (`/api/v1/graph/*`), which the
Copilot also queries; the Copilot now classifies questions and abstains on certification or prediction requests without
calling the model. See `docs/PHASE14_IMPLEMENTATION_REPORT.md`.

**Phase 15** makes the product demo-ready: a **Guided Demo** (`/demo`, or "Start guided demo" on Home) walks through
the challenge, the Explorer, NASA evidence, a 3D studio and the Copilot for one of four journeys; all five 3D studios
share the same controls (Play/Pause, Reset, Fullscreen, Hide/Show controls, Labels / Explanation / Evidence); NASA video
and animation players gained status, Replay and error states. See `docs/PHASE15_DEMO_GUIDE.md`.

Every number in the UI links back to the CSV row, document page or external record it came from. The investigations
are different physical systems and are never pooled into one dataset or model.

## Features

Pages are organized by scientific phenomenon and research goal; the NASA investigation behind each view is shown as a
source badge. Old Phase 1–2 URLs (`/physics/flex`, `/assistant`, `/quality`, ...) redirect to the routes below.

| Group | Page | Route | Notes |
|---|---|---|---|
| Discover | Home | `/` | A calm start: "Why does fire behave differently in space?" with a real BASS-II flame photographed on the ISS; **Start exploring** opens the optional seven-step Discover SpaceFire journey, **Explore on my own** goes to the three phenomena; then the 3D studios, the Research Copilot (example questions only pre-fill) and how the evidence is checked |
| | Research-to-Safety Explorer | `/safety-explorer` | Four research scenarios; data-driven filters; deterministic, explainable ranking (relevance, evidence strength, applicability); evidence with class and source; interpretation; chart, 3D and Copilot links |
| | Research Copilot | `/copilot` | Gemini-written answers (or evidence only) from whitelisted data tools, hybrid document search and optional external literature; every claim's citations and numbers verified in code; live step-by-step progress streamed from the backend; quota-aware fallback |
| | Combustion Explorer | `/experiments`, `/experiments/{dataset}/{uid}` | Server-side filters/sort/paging, CSV export (normalized or original cells), raw vs parsed values, provenance, flags, report pages |
| Scientific analysis | Flame Extinction & Burning Dynamics (FLEX) | `/phenomena/flame-extinction` | **Interactive Science Studio** (3D droplet flame: five explained combustion stages, fuel comparison, Earth vs microgravity explained stage by stage, **Compare with NASA** imagery and recorded values, burn timeline, layers, idealized d²-law calculation, guided tour), clickable charts that select a test (record spotlight), condition console, extinction map, outcome bars by O₂ band, d²-law consistency check, Dext/D₀ vs O₂, conclusions, literature |
| | Flame Spread & Material Behavior (BASS-II) | `/phenomena/flame-spread` | **Interactive Science Studio** (3D flow duct: sample types, opposed/concurrent/stagnation flow, explained ignition / spread / end stages, **Compare with NASA** photographs and recorded geometry, spread timeline, two-test material comparison, guided tour), gas balance vs PMMA 5/6 stoichiometry, per-test endpoints, curated Summary Report Tables 5.1, 7.1 and Appendix A, cross-checks, conclusions, literature |
| | Spacecraft Fire Dynamics (SAFFIRE-I) | `/phenomena/spacecraft-fire` | **Interactive Science Studio** (conceptual 3D duct with camera presets, isolation, S1/S2, a five-step experiment walkthrough, **Compare with NASA** hardware and footage, NASA footage view, guided tour), airflow/spread-direction schematics, S1/S2 comparison, manifest-derived downlink timeline (no fabricated media), conclusions, literature |
| Research intelligence | Experiment Intelligence | `/intelligence/similar`, `/intelligence/compare` | Gower similarity on initial conditions only; 2–5 test comparison within one investigation |
| | Evidence & Literature | `/evidence`, `/evidence/literature`, `/evidence/media` | FTS5 BM25 + local LSA with rank reasons and PDF pages; NASA NTRS + OpenAlex search, Crossref DOI verification; scientific media gallery (verified NASA photos, footage and animation with provenance and filters) |
| | Prediction & Modeling | `/modeling` | Model card, leakage-safe GroupKFold metrics, gated exploratory FLEX burn-time estimate with interval and OOD refusal |
| Trust & methods | Data Reliability | `/reliability` | 559 flags across 37 rules: rows carrying flags, review status, problem categories, each flag traced to file/row/column, CSV export |
| | Methodology | `/methodology` | Pipeline, provenance labels, how AI answers are produced and verified, citation-link confidence, safeguards, limitations, sources (live figures) |

3D studios: each Scientific Analysis page opens with an Interactive Science Studio (`#studio`, three.js loaded only there).
It has two modes, Conceptual 3D and NASA Evidence: the 3D explains, and measured values stay in the evidence panel.
The Phase 6 standalone lab was retired; old `/lab?scene=…&record=…` links redirect to the right page with their
context. Details: `docs/INTERACTIVE_SCIENTIFIC_ANALYSIS_V2.md`.
Studio controls (Phase 11): **Hide controls / Show controls** folds the setup panel away (remembered for the session)
and **Fullscreen** opens a video-player-style view of the same scene: the top bar and playback bar fade after 3 s
without input and return on any mouse move, tap or key; **Controls** (setup drawer), **Explanations** (the active
stage, why it happens, sources) and **Part labels** toggle independently; Escape exits. The left navigation collapses
to an icon rail with its toggle at the top (remembered). Details: `docs/IMMERSIVE_3D_UX_V1.md`.

Themes (Phase 12): **Light**, **Dark** or **System** from the sun / moon / monitor buttons at the top right of every
page. The first visit follows the operating system; an explicit choice is remembered in the browser. Switching is
instant and keeps the page, the 3D scene, playback, fullscreen and the sidebar as they are. The 3D stages stay dark in
Light Mode so flames and particles keep their contrast. Details: `docs/THEME_DESIGN_SYSTEM_V1.md`.

Current development branch: `feature/spacefire-phase12-premium-themes`. The pre-theme website is preserved on
`backup/spacefire-before-phase12` (commit `e5edd9f`); to go back, `git switch backup/spacefire-before-phase12`
(see `docs/PHASE12_ROLLBACK.md` for uncommitted changes and other options).

Scientific media: 15 verified NASA photographs, clips and animations (`frontend/lib/scientific-media.ts`). Each is
labelled as real experiment media, related NASA media or a schematic, credited, and linked to its original record. None
is attached to a test ID. Sources, usage terms and rejected candidates: `docs/SCIENTIFIC_MEDIA_SOURCES.md`.

Motion: Motion for React (scroll reveals, staggered entrances, parallax, count-up of real values), React `<ViewTransition>`
page transitions and CSS ambient loops that pause off-screen. Everything honours `prefers-reduced-motion`; charts never
tween values.

## Quick start

Prerequisites: Python 3.11+ (tested 3.13), Node.js 20+ (tested 24), npm. No GPU, no model downloads.

**Windows (PowerShell)**

```powershell
powershell -ExecutionPolicy Bypass -File scripts\setup.ps1   # venv, deps, .env, ingestion (~15 s)
powershell -ExecutionPolicy Bypass -File scripts\start.ps1   # backend :8000 + frontend :3000
```

**Linux / macOS**

```bash
bash scripts/setup.sh
bash scripts/start.sh
```

Open http://localhost:3000. API docs: http://127.0.0.1:8000/docs.

Manual steps, if you prefer:

```bash
cd backend && python -m venv .venv && .venv/Scripts/python -m pip install -r requirements.txt   # bin/ on Linux
.venv/Scripts/python -m app.ingest.run          # builds processed/ (DB, vectors, reports); --dry-run validates only
.venv/Scripts/python -m uvicorn app.main:app --port 8000
cd ../frontend && npm install && npx next dev --port 3000
```

## Configuration

Copy `.env.example` to `.env`. Everything is optional:

- `LLM_PROVIDER=gemini`, `LLM_MODEL=gemini-3.8-flash`, `LLM_API_KEY=<Google AI Studio key>`: enables AI synthesis
  through the official `google-genai` SDK. The free tier works without billing (see "AI answers" below).
  `LLM_THINKING_LEVEL` (minimal/low/medium/high, default low), `LLM_TIMEOUT_S` (default 60) and
  `LLM_CACHE_TTL_HOURS` (verified-answer cache, default 168, 0 disables) are optional.
  `LLM_PROVIDER=anthropic` with a Claude model is also supported.
- Without a key the assistant returns retrieved evidence and computed tool outputs only and says so; it never writes a
  canned answer.
- `EXTERNAL_SEARCH_ENABLED`, `EXTERNAL_CACHE_TTL_HOURS`, `OPENALEX_MAILTO`, `OPENALEX_API_KEY`: literature search.
- Keys are read only by the backend; the frontend talks to the backend through a same-origin proxy and never sees them.

## AI answers (Research Copilot)

1. Deterministic intent routing runs whitelisted tools (experiment records, comparisons, counts, d²-law and gas-balance
   checks, quality rules) and hybrid document search; each result enters an *evidence pack* with a citation id.
2. Gemini receives only the question and the evidence pack (marked as untrusted data) and must return JSON claims, each
   with a kind (DOC / COMPUTED / EXTERNAL / HYPOTHESIS) and citation ids.
3. Code verifies every claim: cited ids must exist, every number must appear in the cited evidence, and quantities
   whose header unit is documented as wrong must use the corrected unit (FLEX burning rate K in mm²/s). A failing
   draft is regenerated once with the problems listed; statements that still fail are removed (status `partial`).
4. Provider errors, timeouts, refusals, malformed output and quota limits fall back to evidence only. After a 429 the
   model is paused until the reset time the provider returns, so no request is wasted; an identical question with
   identical evidence reuses the earlier output (re-verified on every use).
5. `POST /api/v1/assistant/ask/stream` streams each tool and model step as NDJSON; the Copilot shows them live.

Free-tier budget: Gemini 3.8 Flash allows **20 generation requests per day** per project (reset at midnight Pacific).
A question costs 1 request, or 2 when the first draft fails verification. Live evaluation over the golden questions:
`cd backend && .venv/Scripts/python -m app.eval.live_llm --ids g01,g13 --report ../docs/LIVE_LLM_EVALUATION_RUN_B.md`
(results in `docs/LIVE_LLM_EVALUATION.md` and `docs/LIVE_LLM_EVALUATION_RUN_B.md`).

The key stays on the server: it is read from `.env`, sent to Google in the `x-goog-api-key` header, and never returned by
the API, logged, or bundled into the frontend.

## Tests

```bash
cd backend && .venv/Scripts/python -m pytest          # 181 tests: unit, providers (Gemini mocked), API, streaming, quota/cache,
                                                       # FLEX unit guard, 42 golden questions, curation, link reviews, report cross-checks
cd frontend && npx playwright test                     # 114 tests (113 run + 1 opt-in live test; browser tests at 1440, 768 and 390 px plus logic tests); the model is never called
# Beside other local servers: build with NEXT_DIST_DIR=.next-verify BACKEND_URL=http://127.0.0.1:8010, serve on 3010, then
#   PW_BASE_URL=http://localhost:3010 PW_API_PORT=8010 npx playwright test
E2E_LIVE_LLM=1 npx playwright test -g "live Gemini"    # opt-in: one real Gemini request end to end
backend/.venv/Scripts/python scripts/smoke_test.py     # against a running backend
cd frontend && npx tsc --noEmit && npx eslint . && npx next build
```

## Architecture

```
Next.js 16 (App Router, Tailwind 4, Plotly)  --/api/v1 proxy-->  FastAPI
                                                                  ├─ services: experiments, analytics, similarity, quality,
                                                                  │            retrieval (FTS5 + LSA), literature, assistant, ml
                                                                  ├─ providers: NTRS, OpenAlex, Crossref, LLM (Gemini, Anthropic)
                                                                  └─ processed/spacefire.db  <-- app/ingest (read-only on FLEX/, BASS-II/, SAFFIRE-1/)
```

- `backend/app/ingest/` parses the raw files deterministically (cp1252 FLEX CSV, BOM BASS-II CSV, SAFFIRE CSV + streamed XLSX
  manifest, PDF/DOCX/PPTX/ISA-Tab with page-preserving chunks) and writes `processed/` only.
- Raw cells are preserved; each parsed value carries a kind (`present`, `blank`, `dash`, `none`, `approximate`, `range`,
  `over_range`, `lower_bound`, `sequence`, ...). Header interpretations are annotations with evidence, not renames.
- See `docs/SCIENTIFIC_METHODS.md` for assumptions and limitations and `docs/IMPLEMENTATION_STATUS.md` for verified status.

## Data rights and sources

NASA PSI public data: [PSI-69](https://psi.nasa.gov/physci/repo/data/investigations/PSI-69),
[PSI-25](https://psi.nasa.gov/physci/repo/data/investigations/PSI-25),
[PSI-98](https://psi.nasa.gov/physci/repo/data/investigations/PSI-98). External metadata from NASA NTRS, OpenAlex and
Crossref is attributed and linked; abstracts are stored only when the provider API returns them; external full texts are
never downloaded or analyzed. The original dataset folders are never modified (tests verify their SHA-256 hashes).

## Demo script (3–4 minutes)

1. Home: press "Start exploring" and follow the journey for droplet flames: select a part, switch Earth vs microgravity, then
   "Compare with NASA" with an example test (K shown in mm²/s with its raw ‘mm’ header). Or, on Flame Extinction, open
   "Explore the extinction map", filter to Methanol and click a point to inspect that test.
2. Flame Extinction & Burning Dynamics: press "Start guided exploration" in the 3D studio, switch to Earth and to methanol when asked,
   then open a real test in NASA Evidence mode and read its idealized d²-law line; below, check the d²-law (median ratio ≈ 1.05).
3. Flame Spread & Material Behavior: in the studio, play the opposed vs concurrent timeline and compare tests M1 and M2; then gas balance and Table 5.1.
4. Spacecraft Fire Dynamics: use the studio's camera presets and the NASA footage view, then S1 vs S2 and the downlink timeline; no images exist locally, and the app says so.
5. Research Copilot: ask "Is the d2 law consistent with the reported FLEX burn times?" and watch the steps run live, then
   click a citation marker; ask for a safe spacecraft O₂ threshold and see the abstention.
6. Data Reliability: read the most important warnings, then open the flag browser and follow a flag to its source row.

## Retrieval options

Default evidence retrieval is BM25 + LSA. An optional neural fusion (bge-small, ONNX) is available:
`pip install -r backend/requirements-neural.txt`, `python -m app.services.neural --build`, `RETRIEVAL_DENSE=neural`.
See `docs/RETRIEVAL_EVALUATION.md` for the benchmark that motivated keeping LSA as the default.

## Known limitations

See `docs/IMPLEMENTATION_STATUS.md`: the free-tier model quota (20 requests/day) limits AI answers; the verifier checks
citations and numbers, not reasoning; BASS-II report figures are not digitized and spread rates / burn times are
transcriptions printed only once.

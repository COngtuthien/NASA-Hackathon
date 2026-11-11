# SpaceFire AI

Evidence-grounded microgravity combustion intelligence for the NASA Space Apps Challenge 2026
(*Flame in Freefall: AI-Powered Fire Safety Insights from Microgravity Combustion Data*).

SpaceFire AI turns three NASA Physical Sciences Informatics investigations into a searchable, citable research workspace:

| Investigation | What it is | Local records |
|---|---|---|
| **FLEX** (PSI-69) | Liquid droplet (methanol, n-heptane) flame extinction on the ISS | 274 test rows |
| **BASS-II** (PSI-25) | Small solid samples (PMMA, SIBAL, Nomex, wax) in a glovebox flow duct | 129 test rows |
| **SAFFIRE-I** (PSI-98) | Large-scale fabric fire aboard an uncrewed Cygnus vehicle (2016) | 2 burns + 2 image-set rows + a 12-sheet image manifest |

Every number in the UI links back to the CSV row, document page or external record it came from. The three
investigations are different physical systems and are never pooled into one dataset or model.

## Features

Pages are organized by scientific phenomenon and research goal; the NASA investigation behind each view is shown as a
source badge. Old Phase 1–2 URLs (`/physics/flex`, `/assistant`, `/quality`, ...) redirect to the routes below.

| Group | Page | Route | Notes |
|---|---|---|---|
| Discover | Mission Control | `/` | Cinematic overview: labelled hero illustration, scroll story of microgravity combustion quoting NASA document pages, three scales of combustion, recomputed findings, interactive FLEX chart, research workflow |
| | Research Copilot | `/copilot` | Gemini-written answers (or evidence only) from whitelisted data tools, hybrid document search and optional external literature; every claim's citations and numbers verified in code; live step-by-step progress streamed from the backend; quota-aware fallback |
| | Combustion Explorer | `/experiments`, `/experiments/{dataset}/{uid}` | Server-side filters/sort/paging, CSV export (normalized or original cells), raw vs parsed values, provenance, flags, report pages |
| Scientific analysis | Flame Extinction & Burning Dynamics (FLEX) | `/phenomena/flame-extinction` | Condition console, extinction map, outcome bars by O₂ band, d²-law consistency check, Dext/D₀ vs O₂ |
| | Flame Spread & Material Behavior (BASS-II) | `/phenomena/flame-spread` | Gas balance vs PMMA 5/6 stoichiometry, per-test endpoints, curated Summary Report Tables 5.1, 7.1 and Appendix A, cross-checks of report-only values |
| | Spacecraft Fire Dynamics (SAFFIRE-I) | `/phenomena/spacecraft-fire` | Airflow/spread-direction schematics from CSV fields, S1/S2 comparison, manifest-derived downlink timeline (no fabricated media) |
| Research intelligence | Experiment Intelligence | `/intelligence/similar`, `/intelligence/compare` | Gower similarity on initial conditions only; 2–5 test comparison within one investigation |
| | Evidence & Literature | `/evidence`, `/evidence/literature` | FTS5 BM25 + local LSA with rank reasons and PDF pages; NASA NTRS + OpenAlex search, Crossref DOI verification |
| | Prediction & Modeling | `/modeling` | Model card, leakage-safe GroupKFold metrics, gated exploratory FLEX burn-time estimate with interval and OOD refusal |
| Trust & methods | Data Reliability | `/reliability` | 559 flags across 37 rules: rows carrying flags, review status, problem categories, each flag traced to file/row/column, CSV export |
| | Methodology | `/methodology` | Pipeline, provenance labels, how AI answers are produced and verified, citation-link confidence, safeguards, limitations, sources (live figures) |

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
3. Code verifies every claim: cited ids must exist and every number must appear in the cited evidence. A failing draft is
   regenerated once with the problems listed; statements that still fail are removed (status `partial`).
4. Provider errors, timeouts, refusals, malformed output and quota limits fall back to evidence only. After a 429 the
   model is paused until the reset time the provider returns, so no request is wasted; an identical question with
   identical evidence reuses the earlier output (re-verified on every use).
5. `POST /api/v1/assistant/ask/stream` streams each tool and model step as NDJSON; the Copilot shows them live.

Free-tier budget: Gemini 3.8 Flash allows **20 generation requests per day** per project (reset at midnight Pacific).
A question costs 1 request, or 2 when the first draft fails verification. Live evaluation over the golden questions:
`cd backend && .venv/Scripts/python -m app.eval.live_llm --ids g01,g13 --report ../docs/LIVE_LLM_EVALUATION.md`
(results in `docs/LIVE_LLM_EVALUATION.md`).

The key stays on the server: it is read from `.env`, sent to Google in the `x-goog-api-key` header, and never returned by
the API, logged, or bundled into the frontend.

## Tests

```bash
cd backend && .venv/Scripts/python -m pytest          # 170 tests: unit, providers (Gemini mocked), API, streaming, quota/cache,
                                                       # 42 golden questions, curation, link reviews, report cross-checks
cd frontend && npx playwright test                     # 36 browser E2E tests (desktop + 390 px mobile); the model is never called
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

1. Mission Control: scroll the physics story (each step quotes a NASA page), then the three scales; filter the FLEX chart to Methanol.
2. Flame Extinction & Burning Dynamics: pick Methanol in the condition console, read the outcome bars, check the d²-law (median ratio ≈ 1.05).
3. Flame Spread & Material Behavior: gas balance vs PMMA stoichiometry; Table 5.1 spread rate vs flow velocity.
4. Spacecraft Fire Dynamics: S1 concurrent vs S2 opposed, then the downlink timeline; no images exist locally, and the app says so.
5. Research Copilot: ask "Is the d2 law consistent with the reported FLEX burn times?" and watch the steps run live, then
   click a citation marker; ask for a safe spacecraft O₂ threshold and see the abstention.
6. Data Reliability: open "Source mismatches" and follow a flag to its source row.

## Retrieval options

Default evidence retrieval is BM25 + LSA. An optional neural fusion (bge-small, ONNX) is available:
`pip install -r backend/requirements-neural.txt`, `python -m app.services.neural --build`, `RETRIEVAL_DENSE=neural`.
See `docs/RETRIEVAL_EVALUATION.md` for the benchmark that motivated keeping LSA as the default.

## Known limitations

See `docs/IMPLEMENTATION_STATUS.md`: the free-tier model quota (20 requests/day) limits AI answers; the verifier checks
citations and numbers, not reasoning; BASS-II report figures are not digitized and spread rates / burn times are
transcriptions printed only once.

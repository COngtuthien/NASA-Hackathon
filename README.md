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

| Feature | Route | Notes |
|---|---|---|
| Overview dashboard | `/` | Counts and findings recomputed from the database; interactive FLEX chart |
| Research assistant | `/assistant` | Whitelisted data tools + hybrid document search + optional external literature; citation and number verification; explicit retrieval-only mode without an LLM key |
| External research | `/research` | NASA NTRS + OpenAlex search, Crossref DOI verification, DOI dedupe, related works, cache with staleness labels |
| Experiment explorer / detail | `/experiments`, `/experiments/{dataset}/{uid}` | Server-side filters/sort/paging, CSV export (normalized or original cells), raw vs parsed values, provenance, flags, report pages |
| Compare | `/compare` | 2–5 tests; numeric deltas/charts only within one investigation |
| Evidence explorer | `/evidence` | FTS5 BM25 + local LSA vectors, reciprocal rank fusion, rank reasons, verbatim snippets with PDF pages |
| FLEX physics lab | `/physics/flex` | Extinction map, outcome-by-O₂ table, d²-law consistency check, Dext/D₀ vs O₂ |
| BASS-II lab | `/physics/bass-ii` | Before/after gas deltas, O₂ consumed vs CO₂ produced vs PMMA 5/6 stoichiometry |
| SAFFIRE-I case study | `/physics/saffire-i` | S1/S2 comparison, manifest-derived downlink timeline (no fabricated media) |
| Similar experiments | `/similar` | Gower distance on initial conditions only, per-field explanations |
| Data quality | `/quality` | 557 flags across 35 rules, traced to file/row/column, CSV export |
| Curated report tables | `/physics/bass-ii`, experiment pages | BASS-II Summary Report Tables 5.1, 7.1, Appendix A extracted and verified row-by-row against the CSV |
| FLEX ML (P2, gated) | `/ml/flex` | Leakage-safe GroupKFold evaluation; exploratory prediction with OOD refusal |
| Methodology | `/methodology` | Provenance labels, rules, sources |

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

- `LLM_API_KEY` (+ `LLM_PROVIDER=anthropic`, `LLM_MODEL=claude-opus-5-5`): enables AI synthesis. Without it the
  assistant returns retrieved evidence and computed tool outputs only and says so; it never writes a canned answer.
- `EXTERNAL_SEARCH_ENABLED`, `EXTERNAL_CACHE_TTL_HOURS`, `OPENALEX_MAILTO`, `OPENALEX_API_KEY`: literature search.
- Keys are read only by the backend; the frontend talks to the backend through a same-origin proxy and never sees them.

## Tests

```bash
cd backend && .venv/Scripts/python -m pytest          # 131 tests: unit, providers, API, golden questions, curation, citations
cd frontend && npx playwright test                     # browser E2E journeys (desktop + 390 px mobile)
backend/.venv/Scripts/python scripts/smoke_test.py     # against a running backend
cd frontend && npx tsc --noEmit && npx eslint . && npx next build
```

## Architecture

```
Next.js 16 (App Router, Tailwind 4, Plotly)  --/api/v1 proxy-->  FastAPI
                                                                  ├─ services: experiments, analytics, similarity, quality,
                                                                  │            retrieval (FTS5 + LSA), literature, assistant, ml
                                                                  ├─ providers: NTRS, OpenAlex, Crossref, LLM (Anthropic)
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

1. Overview: 274 / 129 / 2 and why the three systems differ; filter the FLEX chart to Methanol.
2. FLEX lab: extinction map, click a point to its source row; d²-law check (median ratio ≈ 1.05) and the `CO` / `mm²/s` header flags.
3. BASS-II: compare M5 and M4; open the Summary Report page for M5; gas balance vs PMMA stoichiometry.
4. External research: “Saffire spacecraft fire experiment”; verify DOI 10.1016/j.combustflame.2018.10.012.
5. Assistant: ask about `Disruption`; then ask for a safe spacecraft O₂ threshold and see the abstention.
6. SAFFIRE-I: S1 vs S2 and the downlink timeline; no images exist locally, and the app says so.

## Retrieval options

Default evidence retrieval is BM25 + LSA. An optional neural fusion (bge-small, ONNX) is available:
`pip install -r backend/requirements-neural.txt`, `python -m app.services.neural --build`, `RETRIEVAL_DENSE=neural`.
See `docs/RETRIEVAL_EVALUATION.md` for the benchmark that motivated keeping LSA as the default.

## Known limitations

See `docs/IMPLEMENTATION_STATUS.md` (LLM synthesis deferred to a later phase; report figures not digitized; a few
test-ID links are labelled "unreviewed mention").

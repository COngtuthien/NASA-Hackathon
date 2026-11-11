# SpaceFire AI — Implementation Status

## Phase 3 status (branch `feature/spacefire-phase3-ui-motion`, 2026-11-11)
Cinematic product redesign of the frontend only; backend, data, API contracts and NASA files are unchanged.

| Milestone | Status | Notes |
|---|---|---|
| M1 IA + design system + motion system | DONE | Navigation grouped as Discover / Scientific analysis / Research intelligence / Trust & methods. Pages renamed by phenomenon; NASA investigations shown as source badges. Old URLs redirect (`next.config.ts` → `LEGACY_REDIRECTS`, mirrored in `lib/routes.ts`). Motion: `components/motion.tsx` (Motion 14.7.1: reveals, stagger, word reveal, parallax, count-up, off-screen pause), React `<ViewTransition>` page transitions, CSS tokens in `app/globals.css`; reduced motion respected |
| M2 Mission Control | DONE | Hero (labelled illustration, parallax, live counts), scroll story with 4 cited NASA passages, three-scales section, recomputed findings, interactive FLEX preview, workflow tabs, Copilot band |
| M3 Phenomenon pages | DONE | Flame Extinction & Burning Dynamics (FLEX), Flame Spread & Material Behavior (BASS-II), Spacecraft Fire Dynamics (SAFFIRE-I): phenomenon headers with computed facts, condition consoles, outcome bars, airflow schematics from CSV fields, fixed SAFFIRE timeline bar widths |
| M4 Research / exploration pages | DONE | Research Copilot (source segmented control, phenomenon toggles, evidence-only mode banner, tool trace built from the real `tool_calls`, starter questions); Combustion Explorer (phenomenon-first dataset tabs, workflow strip); Experiment Intelligence hub (similar + compare tabs); Evidence & Literature hub (documents + external literature tabs); Prediction & Modeling (model card, interval figure for estimates); Data Reliability (rows-with-flags per investigation, review status, problem categories linked to filters); experiment detail headers with phenomenon kicker + source badge; chart refresh pulse (opacity only) |
| M5 Validation | DONE | Backend `pytest` 131 passed; `tsc` and `eslint .` clean; `next build` OK (17 routes); API smoke 7/7; Playwright on the production build 28/28 (27 desktop incl. 6 Phase 3 tests, 1 mobile sweeping 10 routes); 26-route sweep at 1440/768/390 px: 0 console errors, 0 horizontal overflow; Mission Control CLS 0.012; view transition fires on navigation and Back works; reduced-motion test: counters show final values and ambient loops stop; NASA files: 49/50 baseline hashes match (only README.md differs, intentionally since Phase 2) |

Phase 3 known limitations: page transitions animate only in browsers with the View Transitions API (others swap instantly);
the physics-story figures and phenomenon art are schematics, labelled as such; Copilot tool trace appears when the
response arrives (the backend does not stream per-tool progress); LLM synthesis still deferred.

Route map (old → new): `/assistant` → `/copilot`; `/physics/flex` → `/phenomena/flame-extinction`; `/physics/bass-ii` → `/phenomena/flame-spread`;
`/physics/saffire-i` → `/phenomena/spacecraft-fire`; `/similar` → `/intelligence/similar`; `/compare` → `/intelligence/compare`;
`/research` → `/evidence/literature`; `/ml/flex` → `/modeling`; `/quality` → `/reliability`. Unchanged: `/`, `/experiments`, `/experiments/{dataset}/{uid}`, `/evidence`, `/methodology`.

## Phase 2 status (branch `feature/spacefire-phase2`, 2026-11-11)
| Priority | Status | Evidence |
|---|---|---|
| P1 GitHub sync | DONE | Commits `ad46fbe` (checkpoint), `7e1ecc4`, `315547e`, `ce0d5e7`, plus final regression commit; all pushed, no force-push |
| P2 BASS-II report curation | DONE | `app/curation/bass_report.py` → `processed/curated/*.json` (committed, reproducibility-tested). Table 5.1: 20/20 rows verified vs CSV; Table 7.1: 27/27 BASS-II rows verified + 4 BASS (I) rows kept unlinked; Appendix A: 123/126 verified, 3 genuine report-vs-CSV conflicts (F3, P3a, P22b) flagged; flow direction for 117 tests; 126-vs-129 explained (O20–O22 absent). Shown in detail pages, BASS-II lab (spread-rate chart, SIBAL outcomes), Explorer filter, assistant evidence |
| P3 Citation reliability | DONE | `app/ingest/linking.py`: verified_table_row / exact_context / auto_unreviewed; excludes ambiguous tokens (O2 = oxygen, F2 = SD card), GMT collisions with BASS (I), Table/Figure labels; badges in UI; slides no longer cited as "PDF p." |
| P4 UI refinement | DONE (incremental redesign) | Icons, breadcrumbs, status pills, section navs, filter chips, metric band, scale ladder, citation-type tabs, severity chart, error/empty states; 25-route sweep with 0 console errors, 0 horizontal overflow |
| P5 Retrieval | DONE | 30-question benchmark (`docs/RETRIEVAL_EVALUATION.md`): BM25+LSA R@5 0.767 / nDCG 0.555; BM25+bge-small R@5 0.800 / nDCG 0.566 (within noise) → LSA stays default, neural opt-in via `RETRIEVAL_DENSE`; NASA-PSI-listed badge on external papers |
| P6 Regression | DONE | See "Verification results" |

## Current milestone
**M7 — End-to-end validation: complete.** All P0 and P1 features are implemented and verified; P2 (FLEX ML) is implemented behind a validation gate.
Phase 2 work is committed and pushed to `feature/spacefire-phase2` (main untouched).

## How to run
`scripts/setup.ps1` then `scripts/start.ps1` (Windows) or `scripts/setup.sh` / `scripts/start.sh`. UI http://localhost:3000, API http://127.0.0.1:8000/docs.

## Feature status (evidence = command actually run this session)
| ID | Feature | Status | Evidence |
|---|---|---|---|
| F12 | Overview | **DONE** | Counts from `/overview` (274/129/2); 5 computed insights with citations; fuel filter re-queries chart (E2E) |
| F01 | AI assistant | **DONE (retrieval-only verified); live LLM PARTIAL** | 11 whitelisted tools, verifier, injection guard; 42 golden questions + verifier tests with fake LLM pass. No `LLM_API_KEY` in this environment, so live Anthropic synthesis was not exercised (by design the UI shows "Evidence only") |
| F02 | External research | **DONE** | Live: NTRS (12 hits) and OpenAlex (53 hits) for "Saffire spacecraft fire flame spread"; Crossref verified DOI 10.1016/j.combustflame.2018.10.012; OpenAlex related works (12 refs, 7 related); offline → stale cache / unavailable message (tests + E2E) |
| F03 | Explorer & detail | **DONE** | All 405 burn rows; 193F001 → flex:70 / flex:73; BASS GMT shown as day-of-year; SAFFIRE image sets not burns; CSV export normalized/original |
| F04 | Compare | **DONE** | Same-investigation deltas/chart; FLEX+BASS shows qualitative mode with no chart (E2E) |
| F05 | Evidence explorer | **DONE** | `M5`, `BASS-II Table 5.1` (PDF p.65 / printed p.57), `FLEX d²-law`, `SIBAL` all return expected docs with pages; snippets verbatim (tests) |
| F06 | FLEX lab | **DONE** | Extinction map (n=262/274), outcome-by-O₂ table, d²-law check n=183, median 1.048, exclusions listed |
| F07 | BASS-II lab | **DONE** | ΔCO₂/O₂ slope 0.810 (n=66) vs 5/6; 5 unphysical rows excluded; raw `OR`/`>500`/`none` shown verbatim |
| F08 | SAFFIRE-I | **DONE** | S1/S2 table; manifest timeline (10/30/60 s bins) + CSV export; F2 conflict flagged; no media fabricated |
| F09 | Similar | **DONE** | Deterministic Gower on inputs only, per-field breakdown; SAFFIRE returns "not meaningful (n=2)" |
| F10 | Data quality | **DONE** | 554 flags, 34 rules, file/row/column/raw value; CSV export; links to records (E2E) |
| F11 | FLEX ML (P2) | **DONE (exploratory)** | GroupKFold(5), 71 groups; Ridge −29.8 % MAE(log) vs dummy → gate passed; OOD refusal; classification evaluation-only |

## Verification results (Phase 2 final run)
- Backend: `pytest` → **131 passed** (unit, providers mocked, API, 42 golden questions, curation/linking validation, retrieval benchmark guard, citation integrity).
- Frontend: `npx tsc --noEmit` clean; `npx eslint .` clean; `npx next build` succeeds (17 routes).
- E2E: `npx playwright test` → **22 passed** (21 desktop journeys + 1 mobile 390 px).
- Smoke: `scripts/smoke_test.py` all pass. Route sweep: 25 routes, 0 console errors, 0 failed API calls (except the intentional 404 test), 0 horizontal overflow.
- Source integrity: original NASA datasets, research reports and specs unchanged (SHA-256 baseline + `git diff` on tracked dataset paths).

## Known issues / limitations
1. Live LLM synthesis intentionally not integrated in Phase 2 (deferred by the user); assistant runs evidence-only.
2. Curated report values are verified only where the CSV offers a cross-check (IDs, gases); report-only fields (spread rates, flow direction, observations) are faithful transcriptions of the printed page, not independently re-measured. Figures in the report (plots) are not digitized.
3. 28 `auto_unreviewed` ID links remain (bare mentions); they are labelled as such.
4. Neural retrieval is optional and not the default (benchmark difference within noise).
5. External providers: NTRS can return duplicate records without DOIs (not merged, by design: dedupe is DOI-exact). OpenAlex works without a key on a shared daily budget; set `OPENALEX_API_KEY` for heavier use.
6. Optional Docker Compose not provided.

## Next actions (if continuing)
- Phase 3: LLM provider integration (deferred), then run the golden suite with live synthesis and review manually.
- Open a PR from `feature/spacefire-phase2` into `main` after review.
- Optional: digitize report figures, Semantic Scholar/arXiv adapters, Docker.

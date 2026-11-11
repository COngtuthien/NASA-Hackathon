# SpaceFire AI — Implementation Status

## Phase 5 status (branch `feature/spacefire-phase5-scientific-visuals`, 2026-11-11): COMPLETE
Real NASA scientific media woven into the existing experience. Frontend only: backend, data, Gemini integration and
verification are unchanged. No Gemini request was made during Phase 5.

| Milestone | Status | Evidence |
|---|---|---|
| M1 Media research + provenance registry | DONE | `frontend/lib/scientific-media.ts`: 15 items (FLEX, BASS-II, SAFFIRE-I + related CFI-G, FLEX-2, BASS (I), SoFIE). Each has source URL, credit, date, NASA ID, relation (real experimental / related / illustration), relation reason, alt text and caveat. Metadata from the NASA Image and Video Library API, nasa.gov / science.nasa.gov captions and Wikimedia Commons; all 14 source URLs returned HTTP 200. No item claims a test ID |
| M2 Acquisition + optimization | DONE | WebP 480/960/1600 px with explicit dimensions; Saffire-I GIF 12.9 MB → 756 KB animated WebP (all 574 frames); 1.6 MB silent NASA clip; 3.0 MB total. Rejected: a lab photo with the NASA insignia as a print element, Saffire-II/V/VI media, a Cygnus record whose date and caption disagree (`docs/SCIENTIFIC_MEDIA_SOURCES.md`) |
| M3 Mission Control | DONE | Full-bleed hero with a real BASS-II flame (fade, glow and star field labelled decorative); each of the 4 physics steps paired with matching NASA media (document citations kept); three-scales cards with investigation imagery; context image on the lead finding; new "Recorded in orbit" band; no image repeats on the page |
| M4 Phenomenon pages | DONE | Real media as header art on all three pages; "Seen in orbit" panels show real media and a labelled schematic side by side. SAFFIRE-I: NASA burn animation (plays only on request), click-to-load NASA YouTube video (youtube-nocookie), hardware photos; the callout now separates NASA's public footage from the local manifest (no frame reconstructed) |
| M5 Experiment + Evidence media | DONE | Detail pages show an investigation-level **apparatus** photo with "It does not show test {ID}". New `/evidence/media` gallery tab (filters: phenomenon, investigation, type, relation; URL-synced; accessible `<dialog>` lightbox with full provenance) |
| M6 Visual polish + motion | DONE | Mask reveals, hover depth and scroll zoom only with rich motion (off for reduced motion and narrow screens); opaque badges on bright photos; no autoplay, no audio, no video backgrounds |
| M7 Validation | DONE | See below |

Photo-to-test analysis: NASA's BASS-II captions give session days but no test numbers. One possible match (iss040e072900 ↔ M10)
contradicts NASA's own caption day, and one session day (214) has no CSV test, so no image is attached to a test.

### Phase 5 verification (2026-11-11)
- Frontend: `tsc --noEmit` clean; `eslint .` clean; `next build` OK (18 routes, new `/evidence/media`).
- Playwright on the production build (model disabled): **42 passed, 1 skipped** (opt-in live Gemini). Includes 7 new
  Phase 5 tests:
  - every registry file is served and every item fully attributed;
  - every image decodes with reserved size, and every media figure links its source;
  - lightbox: keyboard open, focus on Close, Esc closes, focus returns;
  - gallery filters;
  - no YouTube request and no animation before a click;
  - the detail-page disclaimer;
  - reduced motion.

  Two Phase 1/3 assertions were reworded with unchanged intent: the SAFFIRE callout text, and the hero label check (the
  hero is now labelled real media).
- Route sweep: 18 routes × 1440/768/390 px: 0 console errors, 0 failed API or media requests, 0 horizontal overflow.
  Mission Control CLS 0.024.
- Backend `pytest`: 181 passed (unchanged code). API smoke test: 7/7 passed. NASA source files unchanged.

## Phase 4 status (branch `feature/spacefire-phase4-gemini`, 2026-11-11): PARTIAL — LIVE GEMINI VALIDATION PENDING
Gemini-backed Research Copilot with code-verified citations and units, streamed progress, quota protection, reviewed
citation links, BASS-II report cross-checks and a redesigned Methodology page. NASA source files unchanged.

**What is pending:** live confirmation of the FLEX unit correction (g02, g27), a final live sample across BASS-II, SAFFIRE-I
and external literature, and the opt-in live browser test. The Gemini free-tier daily quota was exhausted (probe at 06:54
UTC: HTTP 429, retry delay 3,773 s). The exact commands and the request budget are in `docs/LIVE_LLM_EVALUATION.md`.

| Item | Status | Evidence |
|---|---|---|
| 1 Gemini provider | DONE | `GeminiProvider` (`backend/app/providers/llm.py`) on `google-genai==3.1.0`: JSON-schema output, thinking level, header auth, 2 retries on 5xx. 25 adapter tests with a fake SDK client and real SDK error objects |
| 2–3 Copilot + RAG with real answers | DONE; live revalidation PENDING | Pre-flight: key valid; `gemini-2.5-flash` 404 for new users → `gemini-3.8-flash`. Live (before the unit fix): 15 golden questions, 13 synthesized, all 35 claims cited and number-verified, every cited record resolves; 2 HTTP 503 fell back to evidence. Manual review: 2 answers (g02, g27) stated FLEX K as "mm" instead of mm²/s; reasoning review in `docs/LIVE_LLM_EVALUATION.md` |
| 2a FLEX unit correction (FLEX-UNIT-K) | DONE (deterministic); live PENDING | Column rules travel with experiment evidence (raw header unchanged); prompt rule; **verifier `UNIT_RULES`** rejects K stated in any unit but mm²/s, regenerates once, then removes the statement and withholds the prose. Same path for `/ask` and `/ask/stream`. 11 regression tests, including the literal g02/g27 live outputs; applied retroactively, it flags exactly those statements |
| 4–5 Fallback and error handling | DONE | 429 (per-minute/daily, retry delay parsed), 401/403/invalid key, 404, 408/504/timeouts, 5xx, transport errors, refusals/safety blocks, MAX_TOKENS, empty/non-JSON/non-object output → typed `LLMError` → evidence-only answer with the reason. Quota circuit breaker pauses synthesis until the provider's reset; verified-answer cache (key = model + prompt + full evidence pack) |
| 6 28 unreviewed citation links | DONE | All reviewed against Appendix A (run #, sample, GMT day): 20 own rows, 5 figure captions, 3 cross-references (`backend/app/curation/link_reviews.json`), applied at ingest as `manually_reviewed`; 0 `auto_unreviewed` remain; stale-review detection |
| 7 Methodology redesign | DONE | `/methodology`: pipeline, provenance, AI answers, citation-link confidence, safeguards, limitations, sources; live figures from new `GET /api/v1/methodology` |
| 8 Copilot tool progress | DONE | `POST /api/v1/assistant/ask/stream` (NDJSON): `tool_start`/`tool_end` per tool and model call; verified live through the Next proxy with Gemini (events arrive at 0.03 s, 1.6 s, 2.1 s, 6.4 s, not batched). In the browser the live steps and the quota fallback were seen; a live synthesized answer in the browser is still pending (quota) |
| 9 BASS-II limitations / report-only values | DONE | `app/curation/report_consistency.py`: thickness 20/20 agree; width 46/47 (T24 conflict flagged); velocity 28/47 consistent with Air display → new rule `BASS-AIR-DISPLAY-NOT-VELOCITY`; flow direction for T1/T2/T4/T15 from the Table 7.1 title. Shown on the flame-spread page (`#report-trust`) |
| 10 Phase 3 preserved | DONE | All 29 Phase 1–3 E2E tests pass unchanged |
| 11 Validation | DONE except live checks | See "Phase 4 verification" |
| 12 Credentials | DONE | Key never in source, logs, API responses or bundle; staged diffs scanned before each commit (configured key and generic key patterns: none); `.env` never committed |

### Phase 4 verification
Final run (2026-11-11, ~07:00 UTC, after the unit guard):
- Backend `pytest`: **181 passed** (131 before Phase 4 + Gemini adapter, streaming, quota pause, cache, link reviews,
  report cross-checks, methodology, FLEX unit guard).
- Frontend: `tsc --noEmit` clean; `eslint .` clean. No frontend source changed after the 06:22 UTC production build, which
  was reused instead of rebuilt (memory pressure).
- API smoke test (`scripts/smoke_test.py`): 7/7 passed.
- Playwright on the production build, model disabled for determinism: **35 passed, 1 skipped** (opt-in live test,
  blocked by quota).
- Security: `.env` ignored and untracked; the key is absent from the staged diff, all 285 blobs of git history, the
  `.next` bundle (1,499 files), `processed/`, logs and test output. Provider errors are mapped to fixed messages that
  never include the key.
- NASA sources: all 28 dataset files, 2 zips and 17 research files tracked by git and unmodified.

Earlier in the session (not rerun): `next build` OK (17 routes, 06:22 UTC); route sweep of 18 routes × 1440/768/390 px with
0 console errors, 0 failed API calls and 0 horizontal overflow.

### Phase 4 known limitations
1. Gemini free tier: **20 generation requests per day** for `gemini-3.8-flash` (`GenerateRequestsPerDayPerProjectPerModel-FreeTier`,
   confirmed from the 429 body). A question costs 1–2 requests. The full 42-question golden suite cannot run live in one day;
   it runs on every `pytest` with a fake model, and live runs cover subsets.
2. The quota pause is held in process memory; after an API restart the first request re-discovers it (one 429, no cost).
3. The verifier checks citations and numbers, not reasoning.
4. HTTP 503 "model overloaded" occurs on the free tier; after 2 SDK retries the answer falls back to evidence only.
5. A 429 can take 20–125 s to arrive, so the first question after the quota runs out is slow; later ones are instant.
6. The unit rule covers the documented FLEX-UNIT-K correction. A K value written without any unit is not rejected.
7. Live revalidation of the unit fix, and a live synthesized answer in the browser, are pending the next quota window.

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

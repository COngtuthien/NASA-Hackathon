# SpaceFire AI — Implementation Status

## Phase 2 progress (branch `feature/spacefire-phase2`)
| Priority | Status | Evidence |
|---|---|---|
| P1 GitHub sync | DONE | Checkpoint `ad46fbe` pushed; milestone commits follow |
| P2 BASS-II report curation | DONE (backend + detail page) | `app/curation/bass_report.py` → `processed/curated/*.json` (committed). Table 5.1: 20/20 rows verified vs CSV; Table 7.1: 27/27 BASS-II rows verified + 4 BASS (I) rows kept unlinked; Appendix A: 123/126 verified, 3 genuine report-vs-CSV conflicts (F3, P3a, P22b) flagged `BASS-REPORT-CSV-CONFLICT`; flow direction for 117 tests; 126-vs-129 explained (O20–O22 absent from Appendix A) |
| P3 Citation reliability | DONE | `app/ingest/linking.py`: levels verified_table_row / exact_context / auto_unreviewed; excludes ambiguous tokens (O2=oxygen, F2=SD card), GMT collisions with BASS (I), Table/Figure labels. Links 345 → 205 |
| P4 UI redesign | NOT STARTED | Only detail-page report panel + link badges added |
| P5 Retrieval evaluation | NOT STARTED | |
| P6 Full regression | PARTIAL | backend 126 passed; tsc + eslint clean; E2E not re-run this milestone |


_Last updated: 2026-11-11 (end of session 1). This file is the recovery point across sessions._

## Current milestone
**M7 — End-to-end validation: complete.** All P0 and P1 features are implemented and verified; P2 (FLEX ML) is implemented behind a validation gate.
Nothing has been committed or pushed (not authorized).

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

## Verification results
- Backend: `backend\.venv\Scripts\python -m pytest` → **112 passed**.
- Frontend: `npx tsc --noEmit` clean; `npx eslint .` clean; `npx next build` succeeds (17 routes).
- E2E: `npx playwright test` → **16 passed** (15 desktop journeys + mobile 390 px drawer/no-overflow).
- Smoke: `scripts/smoke_test.py` → all 7 checks pass.
- Browser sweep: 21 routes loaded with zero console errors and zero failed API calls.
- Source integrity: SHA-256 of all original dataset/research/spec files unchanged (only the placeholder root `README.md` was rewritten).

## Known issues / limitations
1. Live LLM synthesis untested here (no key). Set `LLM_API_KEY` in `.env`; the verifier then gates every claim.
2. BASS-II Summary Report tables (5.1, 7.1, Appendix A) are indexed as page text; a manually verified numeric extraction into `processed/curated/` (spec §4.3 step 7) is **not done**.
3. Test-ID ↔ report-page links are regex matches marked `auto_unreviewed`; short IDs (e.g. `T1`) may occasionally match unrelated text.
4. Dense retrieval uses LSA (scikit-learn), not a neural embedding model, to avoid large downloads; labelled as such in the UI.
5. External providers: NTRS can return duplicate records without DOIs (not merged, by design: dedupe is DOI-exact). OpenAlex works without a key on a shared daily budget; set `OPENALEX_API_KEY` for heavier use.
6. Optional Docker Compose not provided.

## Next actions (if continuing)
- Curate BASS-II Table 5.1/7.1 with page-verified values into `processed/curated/` and link them on test pages.
- Run the golden suite with a real LLM key and review answers manually.
- Optional: Docker Compose, Semantic Scholar/arXiv adapters.

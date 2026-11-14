# README Refresh Report

Documentation-only change: rewrite of the root `README.md` and real application screenshots. No application code,
data, configuration or test was changed.

## Git baseline

| Item | Value |
|---|---|
| Source branch | `feature/spacefire-phase16-visual-exploration` (equal to `origin`, HEAD `859115d`, "Phase 16 browser tests and documentation") |
| Documentation branch | `docs/spacefire-final-readme`, created from `859115d` |
| Uncommitted work at start | Only untracked local files (NASA source folders `ACME BRE/`, `ACME CFI-G/`, `ACME Flame Design/`, `FLEX-2/`, `PSI-117/`, `PSI-62/`, `SAME/`; `*.pptx`; `run.txt`). All left untouched and uncommitted. |
| Phase 16 verification | Routes and features checked in the source (`frontend/app/**/page.tsx`, `docs/PHASE16_IMPLEMENTATION_REPORT.md`) and in the running production build |

## README changes

The previous README was a cumulative phase changelog (Phases 1–16, outdated test counts, a stale "current branch"
note). The new README is organized for first-time readers and judges:

1. Hero: title, tagline, one-sentence summary, home screenshot, project metadata table, non-affiliation note
2. The Challenge (microgravity combustion, spacecraft fire safety, fragmented data)
3. Our Solution (pipeline from NASA sources to verified AI)
4. Key Features table with routes (only features verified in the Phase 16 build)
5. Platform Preview gallery (12 screenshots in GitHub-compatible HTML tables)
6. NASA Datasets: ten investigations, five domains, evidence level per investigation
7. Technology Stack (from `frontend/package.json` and `backend/requirements.txt`)
8. System Architecture (Mermaid diagram plus four notes)
9. Installation and Local Demo (Windows CMD first; PowerShell and Linux/macOS in a collapsed section; fresh-clone
   data coverage)
10. Scientific Accuracy and Limitations
11. Project Structure, Credits and Data Sources, Further Documentation

Engineering history stays in `docs/` (phase reports, `IMPLEMENTATION_STATUS.md`).

## Screenshot inventory

Captured from the running application with Playwright (Chrome channel, the same browser setup as the project's
Playwright tests). Viewport 1440 × 900, `colorScheme: dark`, one browser context per capture. No page errors were
reported during any capture. Each image was saved as WebP (quality 90). This matches the existing `frontend/public/media`
convention and reduced the set from 4.6 MB (PNG) to 1.4 MB with text still sharp. Palette-quantized PNG was tried and
rejected because it banded the flame photographs.

| File | Route and state | Size | Dimensions |
|---|---|---|---|
| `home.webp` | `/` hero | 71 KB | 1440 × 900 |
| `research-to-safety.webp` | `/safety-explorer` landing (four scenarios) | 107 KB | 1440 × 900 |
| `research-to-safety-scenario.webp` | `/safety-explorer/gaseous-flames` (observed CFI-G outcomes chart) | 109 KB | 1440 × 900 |
| `combustion-explorer.webp` | `/experiments?dataset=cfig&f_configuration=normal&f_fuel_species=n-butane`, scrolled to the domain cards (82 records) | 133 KB | 1440 × 900 |
| `gaseous-flame-studio.webp` | `/phenomena/gaseous-flames`, guided timeline started, paused, advanced to "Established flame" | 136 KB | 1440 × 900 |
| `smoke-detection-studio.webp` | `/phenomena/smoke-detection`, guided timeline started and paused at "Smoke formation" (Kapton, fresh) | 131 KB | 1440 × 900 |
| `flex-studio.webp` | `/phenomena/flame-extinction`, view "Earth vs Microgravity" | 101 KB | 1440 × 900 |
| `scientific-analysis.webp` | `/phenomena/flame-extinction#map`, extinction map disclosure opened (262 of 274 tests plotted) | 111 KB | 1440 × 900 |
| `research-copilot.webp` | `/copilot`, question "What conditions produced the reported CFI-G cool flames?" in evidence-only mode | 150 KB | 1440 × 900 |
| `guided-demo.webp` | Home → "Start guided demo" → Next × 2 (step 3 of 5 on `/safety-explorer/gaseous-flames`) | 119 KB | 1440 × 900 |
| `find-similar.webp` | `/intelligence/similar`, example link "tests similar to FLEX C01M201" (10 results for `flex:145`) | 123 KB | 1440 × 900 |
| `science-media.webp` | `/evidence/media` (15 of 15 items) | 134 KB | 1440 × 900 |

Total: 12 files, 1,431 KB.

## Capture environment

- Backend: `uvicorn app.main:app --host 127.0.0.1 --port 8010` (local database ingested 2026-11-14; 274 FLEX, 129
  BASS-II, 2 SAFFIRE-I burns, 50 documents, 1,588 KG nodes, 7,223 KG edges).
- Frontend: the existing Phase 16 production build, `NEXT_DIST_DIR=.next-verify`, `BACKEND_URL=http://127.0.0.1:8010`,
  `next start --port 3010`. No rebuild was done.
- Ports 8010 and 3010 were free at the start; no other process was stopped. About 3.3 GB of RAM was free.

## Research Copilot capture (omitted AI answer)

- Two live Gemini requests were made for the Copilot screenshot (question above, `gemini-3.8-flash`). Both returned
  **HTTP 504 Gateway Timeout** from the provider after about 60 s. That is provider overload, not an application fault;
  the app correctly fell back to evidence only.
- To avoid spending more quota and to avoid showing an error banner, the backend was restarted in retrieval-only
  mode (empty `LLM_API_KEY`). The screenshot shows the real **evidence-only** response: the "Evidence only" status, the
  "no AI-written answer" notice, and ten retrieved sources with PDF page citations. The README caption says so.
- No AI-written answer is shown or simulated anywhere. The other screenshots were taken while the Gemini-enabled backend
  was running, so their header shows "AI answers on". The Copilot screenshot shows "AI: evidence-only mode".

## Missing or intentionally omitted captures

- All eight required captures exist. Four optional captures were added (`flex-studio`, `research-to-safety-scenario`,
  `find-similar`, `science-media`).
- Not captured: a live AI-written Copilot answer (see above), NASA document search (`/evidence`), the BASS-II and
  SAFFIRE-I studios, and Light theme variants. These were left out to keep the README a reasonable length.

## Verified dataset coverage

Counts were taken from `processed/spacefire.db` and `GET /api/v1/combustion/domains` / `GET /api/v1/registry`.

| Investigation | Evidence badge in the app | Records used in the README |
|---|---|---|
| FLEX (PSI-69) | Measured test outcomes | 274 |
| FLEX-2 (PSI-68) | No downloaded per-test outcomes | 8 envelope rows (test plan) |
| PSI-117 | Published figure data: series, not tests | 61 series |
| ACME CFI-G (PSI-159) | Measured test outcomes | 333 (179 normal, 154 inverse) + 15 cool-flame events |
| ACME Flame Design (PSI-10) | Experimental conditions only | 327 |
| ACME BRE (PSI-20) | Day-level summary: not individual flame tests | 18 days |
| BASS-II (PSI-25) | Measured runs (report-backed spread rates) | 129 |
| PSI-62 | Metadata only | profile only |
| SAME (PSI-102) | Operational log / report-derived measurements | 47-test flight log, 8 particle-size results |
| SAFFIRE-I (PSI-98) | Measured spacecraft-scale burns | 2 burns, 2 image sets, 12-sheet manifest |

Fresh-clone coverage was verified in the code: `app/ingest/phase13/load.py` loads the committed curated JSON without the
NASA folders, and `app/ingest/run.py` skips missing catalog documents with a warning. Of the 50 indexed documents, 20
(FLEX, BASS-II, SAFFIRE-1) are in Git; 30 come from the seven local-only folders.

## README link and image checks

- Every `docs/assets/screenshots/*.webp` reference in the README resolves to an existing file, and every file in that
  folder is referenced (local script check, see Git delivery).
- Every relative Markdown link to `docs/*.md` resolves to an existing file.
- Every documented route exists as `frontend/app/**/page.tsx`.
- Startup commands were checked against `scripts/setup.ps1`, `scripts/start.ps1`, `frontend/next.config.ts`
  (`NEXT_DIST_DIR`, `BACKEND_URL`), `frontend/playwright.config.ts` (`PW_BASE_URL`, `PW_API_PORT`) and
  `backend/app/core/config.py` (`.env` read from the repository root).
- External NASA PSI links follow the URL template the application itself uses
  (`https://psi.nasa.gov/physci/repo/data/investigations/{id}`).
- No license is claimed (the repository has no license file). NASA affiliation or endorsement is explicitly disclaimed.

## Git commits

See the commit on `docs/spacefire-final-readme` that adds this report; it contains only `README.md`,
`docs/README_REFRESH_REPORT.md` and `docs/assets/screenshots/*.webp`.

## Remaining issues

- A live AI-written Copilot screenshot could be added once the Gemini service is responsive (two 504 responses on
  2026-11-15).
- The screenshots show the dark theme only.

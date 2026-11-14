# Phase 13 — Test Results (2026-11-14)

| Check | Command | Result |
|---|---|---|
| Backend (all) | `pytest` (backend/) | **211 passed, 0 failed** (188 pre-existing + 22 Phase 13 science + 1 Phase 13 retrieval guard) |
| Retrieval benchmark (original 30 queries) | `python -m app.eval.retrieval_eval` | hybrid R@5 0.800, R@10 0.867, MRR 0.662, nDCG 0.560 (not worse than before; guard passes) |
| Retrieval benchmark (Phase 13, 14 queries) | `python -m app.eval.retrieval_eval --phase13` | hybrid R@5 0.500, R@10 0.786, MRR 0.493; BM25 R@10 0.714; LSA R@10 0.500 |
| TypeScript | `npx tsc --noEmit` | clean |
| ESLint | `npx eslint components lib app e2e` | clean |
| Production build | `NEXT_DIST_DIR=.next-verify next build` | OK, 20 routes incl. `/phenomena/gaseous-flames` and `/phenomena/smoke-detection` |
| Phase 13 browser tests | `playwright test e2e/phase13.spec.ts` (dev server, real API on 8010, LLM off) | **10 passed, 0 failed** |
| Full Playwright regression, run 1 (first build) | `playwright test` against the production build | 125 passed, 0 failed, then stopped by a low-memory shutdown |
| Desktop phase7/8/9 re-run (first build) | `playwright test e2e/phase7.spec.ts e2e/phase8.spec.ts e2e/phase9.spec.ts` | 47 passed, **1 failed**: Phase 8 density budget, `/phenomena/flame-extinction` showed 1362 words by default (budget 1100) because the new PSI-117 section was fully expanded |
| Fix | `components/views/Psi117Section.tsx` | Default view keeps the heading, a one-line lead and the visible "Not FLEX rows and not 3D CFD" caveat; the cool-flame explanation, evidence key and the 22-figure chart moved into a closed disclosure `#psi117-explore` ("Explore the PSI-117 charts"). FLEX-2 card shortened (still states "no FLEX-2 measurements in SpaceFire"). `e2e/phase13.spec.ts` opens the disclosure before checking the chart. |
| Desktop phase8 + phase13 (rebuilt) | `playwright test e2e/phase8.spec.ts e2e/phase13.spec.ts --project=desktop` | **21 passed, 0 failed** (density budget passes) |
| Mobile project (rebuilt) | `playwright test --project=mobile` | **12 passed, 0 failed**, incl. the 3 `phase13-mobile.spec.ts` tests (no horizontal scroll at 390 px, studios load, CFI-G charts render) |
| Full desktop regression, run 2 (rebuilt) | `playwright test --project=desktop` (160 tests) | **56 passed, 0 failed** (copilot-errors, journeys, phase10, phase10-unit, phase11-unit, 8 phase11 tests), then the API, frontend server and run were stopped again by a low-memory shutdown |

Coverage summary: every desktop and mobile spec has passed at least once against a Phase 13 production build, and the only
failure found (Phase 8 density) is fixed and re-verified. Not re-run after the PSI-117 restructure: phase2–5, phase7,
phase9, phase9-unit, phase12 and the rest of phase11 (all passed on the first build; the restructure touches only the
PSI-117/FLEX-2 cards on the FLEX page).

Not run: live Gemini evaluation (no quota used by design). To repeat the regression on a machine with more free memory:
`LLM_API_KEY= uvicorn ... --port 8010`, `NEXT_DIST_DIR=.next-verify BACKEND_URL=http://127.0.0.1:8010 npx next build && npx next start --port 3010`,
then `PW_BASE_URL=http://localhost:3010 PW_API_PORT=8010 npx playwright test`.

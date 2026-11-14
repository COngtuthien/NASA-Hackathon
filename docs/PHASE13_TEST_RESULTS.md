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
| Full Playwright regression | `playwright test` against the production build | **INCOMPLETE**: 125 passed, 0 failed when the run was stopped by Claude Code because the machine was critically low on memory (the API and production servers were stopped too). Tests after #126 (phase7 onward in file order, incl. phase8–12, copilot-errors, mobile and `phase13-mobile.spec.ts`) were not executed in this run. |

Not run: live Gemini evaluation (no quota used by design). To finish the regression later:
`LLM_API_KEY= uvicorn ... --port 8010`, `NEXT_DIST_DIR=.next-verify BACKEND_URL=http://127.0.0.1:8010 npx next build && npx next start --port 3010`,
then `PW_BASE_URL=http://localhost:3010 PW_API_PORT=8010 npx playwright test`.

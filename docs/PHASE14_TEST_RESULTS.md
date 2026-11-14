# Phase 14 — Test Results (2026-11-14)

Memory-safe strategy:
- One worker; backend tests, static checks and the production build run separately.
- Browser tests run in batches of 2–4 spec files against one production server (port 3010) and one API (port 8010, LLM
  off).
- Stale servers are stopped before each build. About 3.1–3.3 GB of memory was free throughout.
- No run was killed by low memory in this phase.

## Backend

| Check | Command | Result |
|---|---|---|
| All backend tests | `pytest` (backend/) | **255 passed, 0 failed**: 211 pre-existing + 44 new in `tests/test_phase14.py` |
| Phase 14 golden benchmark | `python -m app.eval.phase14_eval` | 21 questions, every check 100% (tuned set; see `PHASE14_AI_EVALUATION.md`) |
| Held-out benchmark | `python -m app.eval.phase14_eval --holdout` | 8 questions: type 7/8, abstention 8/8, investigation 6/6, structured evidence 6/6 |
| Retrieval, original 30 queries | `python -m app.eval.retrieval_eval` | hybrid R@5 0.800, R@10 0.867 (unchanged) |
| Retrieval, Phase 13 14 queries | `python -m app.eval.retrieval_eval --phase13` | hybrid R@5 0.50, R@10 0.786 (unchanged) |
| Knowledge graph build | `python -m app.ingest.kg` | 1,588 nodes, 7,223 edges, 0 skipped edges |

The 44 Phase 14 tests cover:

| Area | Tests |
|---|---|
| Graph integrity | Edges unique, sourced, pointing to existing nodes; one investigation per experiment; counts equal the source tables; condition values and original units preserved; `documented_text` terms really present; no PSI-117↔FLEX or BRE↔BASS-II links; COMPARED_WITH only within one figure and variable |
| Graph queries | Phenomenon → investigations; fuel or material → experiments (n-butane count recomputed); outcomes under conditions equal an independent recount; missing vs outside-range vs not-recorded; evidence chain to PDF p.46; documented relation; 404/400 handling |
| Ranking | Primary first in all 4 scenarios; score = formula; deterministic; metadata-only and documentation-only labels; unrecorded conditions not penalized; inverse filter rejects exactly the normal tests; out-of-range gives "No matching experimental evidence…"; invalid filters 400/404; BRE never presented as BASS-II spread; no risk, probability or certification wording |
| Explorer API | 4 scenarios; facets from data; deep links to existing routes; CFI-G filters carried into the chart link; evidence sources (Table 3 p.46) |
| Copilot | Classification of 6 questions; graph and curated evidence retrieved; comparison guard; 4 unsupported questions abstain with **0 model calls**; a supported question still uses the model with verified citations and the question type in the message; Explorer handoff resolved from ids; 4 bad handoffs (unknown scenario, investigation outside the scenario, unknown evidence id, injected text) rejected; 503 degrades to evidence-only |
| Benchmark guard | Golden-set thresholds |

## Frontend static checks and build

| Check | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npx eslint` on all changed and new files (views, explorer, e2e specs) | clean |
| Production build (`NEXT_DIST_DIR=.next-verify next build`) | OK. New routes `/safety-explorer` (static) and `/safety-explorer/[scenario]`. `/phenomena/smoke-detection` stays static. `tsconfig.json` restored after each build. |

## Browser tests (Playwright, production build, evidence-only API)

All 17 desktop spec files (168 tests) and all 8 mobile spec files (13 tests) completed. Three production builds were used;
each change between them is listed.

| Batch | Build | Specs | Result |
|---|---|---|---|
| New | 1 | `phase14.spec.ts` | 8 passed |
| 1 | 1 | phase8, phase13, copilot-errors | 31 passed, **1 failed**: phase13 Smoke studio navigation (see fix 1) |
| 2 | 2 | phase2, phase3, phase4, phase5 | 26 passed, 1 skipped (live-LLM test, needs `E2E_LIVE_LLM`) |
| 3 | 2 | phase7, phase9, phase9-unit | 36 passed, **1 failed**: phase7 bounded Copilot request (fix 2) |
| 4 | 2 | phase10, phase10-unit, phase11, phase11-unit | 41 passed |
| 5 | 2 | phase12, journeys | 22 passed, **1 failed**: journeys abstention text (fix 3) |
| Re-run | 3 | phase7, journeys, phase14, copilot-errors | **54 passed** |
| Re-run | 3 | phase4, phase8, phase13 | **28 passed, 1 skipped** |
| Mobile | 3 | all mobile specs incl. `phase14-mobile.spec.ts` | **13 passed** |

Final state: **167 desktop tests passed and 1 skipped (live LLM), 0 failing; 13/13 mobile passed.**
- 83 desktop tests ran on the final build (3).
- 85 tests (phase2, phase3, phase5, phase9, phase9-unit, phase10, phase10-unit, phase11, phase11-unit, phase12) last ran on
  build 2. The only change between builds 2 and 3 is the Copilot request body (fix 2), and these specs do not exercise it.

### Failures found and fixed

1. **phase13 "Smoke Detection Studio … scene switching"** was flaky: 1 of 2, then 3 of 4 repeats failed with "Element is
   not attached to the DOM".
   - Cause, in the test: after a client-side navigation, the unscoped `lite-canvas-host` locator could grab the outgoing
     page's studio just before it detached.
   - Fix: scope the locator to the destination studio (`[data-studio="gas"|"smoke"]`). The fixed test passed 6/6 repeats.
   - Separately, the Smoke page's new `?material=` reading was switched from `useSearchParams` (which had made the page a
     dynamic, client-rendered hole) to a store read with a server snapshot, so the page stays static.
2. **phase7 "Ask AI … sends only bounded context"** expects exactly four request keys. The Copilot had started sending
   `explorer_context: null` on every request. Fix: the key is sent only when the page was opened from the Explorer.
3. **journeys "assistant abstains on an operational safety threshold"** failed a strict-mode check because the abstention
   text appeared three times. Fix: the backend no longer repeats an identical limitation, and the test takes `.first()`;
   the answer intentionally repeats the reason.

## What the Phase 14 browser tests check

- **Entry page.** Four cards, the research-only notice, the ranking explanation and the active navigation item. A card
  opens its workspace.
- **A. Flame spread.**
  - The material and flow filters update the URL and give "N of 129 records meet the selected conditions".
  - PSI-62 is labelled "Supporting context only".
  - The first evidence item is measured and cites Summary Report Table 5.1.
  - BRE carries "not a measured BASS-II flame-spread rate".
  - The score breakdown shows the formula.
  - The chart link opens the BASS-II report tables, and the 3D link opens the Science Studio with `?record=bass2:N`.
- **B. Gaseous flames.**
  - Table 3 events appear with PDF p.46.
  - With the inverse filter, only inverse outcomes are shown and the (normal-only) cool-flame events disappear.
  - The censoring caveat is shown.
  - The chart link sets the CFI-G page's own "Inverse" selector, the test link opens the CFI-G test record, and the studio
    opens.
- **C. Smoke detection.**
  - Kapton Table 1 values (105 nm fresh, 186 nm aged) and the no-detector-sensitivity caveat are shown.
  - The studio opens with `?material=kapton`, and the chart link reaches the size table.
- **D. Droplet extinction.**
  - O₂ 0.9–1 gives exactly "No matching experimental evidence is available for these conditions."
  - PSI-117 is described as "does not record oxygen", and FLEX-2 as "no measurements".
  - The fuel filter leaves only Heptane outcomes.
  - The PSI-117 link opens `#psi117-explore`, and the chart link opens the FLEX map with `fuel=Heptane`.
- **Copilot handoff.**
  - The draft is pre-filled, not sent, and the Explorer context panel is shown.
  - On Ask, the request body carries `explorer_context` (scenario and investigation), and the answer shows the question type
    and the Explorer context source.
- **Unsupported question** through the API: `unsupported`, `insufficient_evidence`, abstention text, 0 model calls.
- **Errors and themes.** An invalid filter shows an error; the Explorer renders in the light theme with no console errors.
- **Mobile, 390 px.** No horizontal scroll on the entry page or a workspace, filters work, and actions are reachable.

## Not run

- **Live Gemini.** No live evaluation or sanity test: no quota used, by design.
- **Full suite in one run.** It was not run as a single job; the batches above together cover every spec file.

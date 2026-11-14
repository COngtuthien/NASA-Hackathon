# Phase 15 — Test Results (2026-11-14)

Memory-safe procedure:
- Backend tests, the build and browser batches were never run at the same time.
- One Playwright worker; 3–4 spec files per batch against one production server (port 3010) and one API (port 8010, AI
  off).
- Server health was checked before each batch; stale servers were stopped before each build.
- About 3.0–3.3 GB stayed free, and no run was interrupted.

## Final build: every suite completed

| Check | Command | Result |
|---|---|---|
| Backend (all) | `pytest` (backend/) | **257 passed, 0 failed** (255 earlier + 2 new in `test_phase15.py`) |
| Scientific data validation | inside pytest: `test_phase13_science.py`, `test_phase14.py` graph-integrity tests | pass (part of the 257) |
| Knowledge graph and ranking | inside pytest: `test_phase14.py` | pass |
| AI benchmark | `python -m app.eval.phase14_eval --phase15` / default / `--holdout` | see `PHASE15_AI_BENCHMARK.md` |
| Retrieval benchmarks | `python -m app.eval.retrieval_eval [--phase13]` | unchanged: 0.800/0.867 and 0.50/0.786 |
| TypeScript | `npx tsc --noEmit` | clean |
| ESLint | changed and new files | clean |
| Production build | `NEXT_DIST_DIR=.next-verify next build` | OK. New route `/demo` (static). `/phenomena/smoke-detection` stays static. `tsconfig.json` restored. |

### Browser (Playwright), all on the final build

| Batch | Specs | Result |
|---|---|---|
| 1 | phase13, phase14, **phase15** | 31 passed |
| 2 | phase2, phase3, phase4, phase5 | 26 passed, 1 skipped (live-LLM test, needs `E2E_LIVE_LLM`) |
| 3 | phase7, phase8, phase9, phase9-unit | 48 passed (incl. the Phase 8 density budget) |
| 4 | phase10, phase10-unit, phase11, phase11-unit | 41 passed |
| 5 | phase12, journeys, copilot-errors | 34 passed |
| Mobile | all 9 mobile specs incl. **phase15-mobile** | 15 passed |

**Total: 196 tests in 27 files; 195 passed, 1 skipped, 0 failed.** All 196 ran on the final build.

## New Phase 15 browser tests (`e2e/phase15.spec.ts`, 13 tests; `e2e/phase15-mobile.spec.ts`, 2 tests)

- **Gaseous Flame and Smoke Detection studios** (one test each):
  - Play/Pause changes the render loop (`always` ↔ `demand`): frames > 10 per 0.9 s while playing, ≤ 2 while paused,
    resume works.
  - Explanation and Evidence toggles remove and restore their panels.
  - Zoom, then Reset camera, returns to the home distance.
  - Hide controls hides the panel and the toolbars, and a floating Show controls restores them.
  - The same in fullscreen, where Exit stays reachable and the paused state survives.
- **Gaseous Flame Reset:** after inverse, cool, a Table 3 event, pause, labels off and zoom, Reset returns to normal/hot, no
  event, playing, labels on.
- **Smoke Detection:**
  - Teflon, aged: the panel shows the API's Table 1 value.
  - Previous and next stage work.
  - While paused the stage does not advance.
  - Reset returns to stage 1, Kapton, fresh, playing.
- **FLEX, BASS-II and SAFFIRE-I studios:** the new Play/Pause really stops and resumes rendering; Hide/Show controls still
  works.
- **CFI-G clip:**
  - Idle until asked (paused, muted, `preload=none`).
  - Play, then the time advances.
  - Pause, seek to 10 s, Replay restarts from the beginning, unmute.
  - A 404 shows the error panel with the NASA link.
- **SAFFIRE-I animation:** play, Replay restarts (`?run=1`), and "Show still frame" stops it.
- **Guided demo:**
  - Start from Home; steps 1→5 open the real routes.
  - Switching the scenario in step 2 is reflected in the card highlight and the following routes.
  - Step 3 notes carry the Kapton values; step 5 is the Copilot draft with the Explorer context.
  - Previous, Skip to Explorer and Restart work, and the scenario is kept.
  - Exit removes the bar, and it stays gone.
  - No `/assistant/ask` request at any time.
- **Default journey A:** the dot jump to step 3, the CFI-G charts link and the gas studio notes.
- **Explorer scenario switcher:** current scenario marked, switching works.
- **Mobile, 390 px:**
  - The demo bar fits and navigates.
  - Studio buttons stay inside the viewport and are touch-sized (≥ 32 px).
  - Hide/Show controls works by tap.
- **Phase 14 handoff test, extended:** the answer shows "Explorer context used: Gaseous Flame Behavior · PSI-159".

## Problems found and fixed during testing

1. **Intermittent `removeChild` error on fast page changes.**
   - Seen once in the first demo run, after a 3D studio page was left during client navigation.
   - Cause: drei's `<Html>` part labels remove their own DOM node in a cleanup; if that node is already detached, the
     browser throws.
   - Fix: a narrow guard in `components/3d/SceneCanvas.tsx`. Removing a node that is not a child is a no-op, the standard
     workaround from React issue #11538. It is installed only with the 3D bundle.
   - Verification: the demo test then passed 4/4 and 5/5 on repeat, and all suites passed.
   - The original error could not be reproduced on demand (the race depends on timing), so the fix is verified by absence
     of recurrence, not by a failing-then-passing test.
2. **Clip error test hung:** a 404 source never settles `play()`. The test now starts playback without awaiting it. The
   app's error panel was already correct.

## Not covered

- **Live Gemini:** no requests, by design.
- **Native video fullscreen:** the browser's own control; not automated.
- **Tablet (768 px) and laptop (1280 px):** checked visually (no horizontal overflow at 768 px with the demo bar). Existing
  Phase 10–12 tests cover tablet layouts of the original studios.

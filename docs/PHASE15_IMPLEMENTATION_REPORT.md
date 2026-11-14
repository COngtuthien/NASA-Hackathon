# Phase 15 — Final Demo Experience, UX Polish & Scientific Validation

Branch `feature/spacefire-phase15-final-demo`, from `10e9d6a` (Phase 14, verified equal to
`origin/feature/spacefire-phase14-safety-explorer`; `33b8478` is its ancestor). Rollback:
`backup/spacefire-before-phase15` = `10e9d6a` (pushed). Earlier rollback branches are kept. Nothing was merged into main
and nothing was deployed.

## What changed

### 1. Unified 3D studio controls

See `PHASE15_STUDIO_CONTROL_AUDIT.md` for the per-studio matrix.

**New studios (Gaseous Flame, Smoke Detection).** `components/studio/LiteStudio.tsx` was extended in place, not replaced.
It adds:
- Hide/Show controls (panel and toolbars), with a floating Show controls button.
- Reset (the page's documented starting state, plus view and camera) and a separate Reset camera.
- Explanation and Evidence toggles.
- Fullscreen in the header and the toolbar; Escape exits the expanded fallback.
- Space toggles Play/Pause.
- One wrapping toolbar that fits phones.

The page side (`SmokeView.tsx`, `gas/GasFlamesView.tsx`) splits each side panel into explanation and evidence and supplies
`onReset`. Smoke adds a "‹ Stage" button next to "Next stage".

**Original studios (FLEX, BASS-II, SAFFIRE-I).** They keep their mature controls. `StudioViewport.tsx` adds a visible
Play/Pause, wired to the existing decorative-motion state, so SAFFIRE-I (no timeline) has one on screen too.

**Verifiable pause.** `components/3d/SceneCanvas.tsx` counts rendered frames (`__spacefireLab.frames`), and it now guards
drei's label cleanup against an intermittent `removeChild` error (see the test report).

### 2. Media

`components/media.tsx`:
- The NASA clip player keeps the native controls and adds a status line, Replay and an error panel with the NASA link.
- The NASA animation player adds Replay and an error panel.
- `MediaPanelBlock` takes a page-specific caveat.
- The Gaseous Flame page now shows the existing NASA CFI-G clip under its studio (real footage, labelled "not tied to a
  data row").

No video files were added or duplicated.

### 3. Guided Demo Mode

| File | Role |
|---|---|
| `lib/demo.ts` | State in sessionStorage; four journeys whose copy uses only figures shown on the linked pages |
| `components/demo/DemoBar.tsx` | The demo bar, mounted in `Shell` |
| `app/demo` + `components/views/DemoView.tsx` | Step 1, "The challenge", with live counts from `/registry` and `/graph/summary` |

- **Entry:** "Start guided demo" on Home and on the Explorer entry page.
- **Steps:** challenge → choose scenario → Explorer evidence → 3D studio → Copilot draft.
- **Controls:** Previous, Next, step dots, Restart, Skip to Explorer, Exit. The scenario is kept throughout.
- **Never sends a question.** The bar sits below fullscreen studios (z-index 70 < 80).

See `PHASE15_DEMO_GUIDE.md`.

### 4. Explorer polish

- A scenario switcher strip on every workspace, with the current scenario highlighted.
- In a demo, the selected scenario card is highlighted, and choosing a card moves the demo to step 3.
- Filters, URL state, ranking, evidence and empty states are unchanged from Phase 14 and re-verified (Phase 14 tests pass).

### 5. Copilot polish

- Answers show "Explorer context used: …" when a handoff was resolved.
- "BRE" in capitals is detected as ACME BRE.
- Everything else (graph evidence, classification, abstention, 503/504 handling, evidence-only fallback, citation checks)
  is unchanged; the tests pass.

### 6. Scientific QA

See `PHASE15_SCIENTIFIC_QA.md`: one missing citation added (cool-flame temperature, CFI-G report p.24) and a review of
every investigation's visible claims.

## Results

| Area | Result | Details |
|---|---|---|
| Backend | 257 passed | `PHASE15_TEST_RESULTS.md` |
| Browser | 196 tests on the final build: 195 passed, 1 skipped (live LLM by design) | `PHASE15_TEST_RESULTS.md` |
| AI benchmark | Phase 15 first run: type 15/16, abstention 16/16, coverage 12/13 → 13/13 after the BRE acronym fix; no regression on the Phase 14 sets; retrieval unchanged | `PHASE15_AI_BENCHMARK.md` |

## Performance and resources

- **3D loading.** Still lazy-loaded (`next/dynamic`, `ssr:false`) with one WebGL canvas per page; disposal counters are
  unchanged and tested.
- **Pausing.** Pause now verifiably stops continuous rendering in all five studios. Off-screen and hidden-tab rendering
  was already stopped.
- **Video.** `preload="none"`, so nothing downloads until play.
- **Demo.** Adds no polling: state is local, and the counts come from two cached-by-page API calls.

## Known limits

- **Original studios' resets.** They keep "Reset camera" plus "Reset parameters" rather than a single Reset.
- **Original studios' explanation and evidence.** They use their existing explainer and evidence modes instead of new
  toggles.
- **Smoke stages.** User-stepped, not timed; no timeline was added, because there is no physical time scale.
- **Classifier.** Rule-based, with two known misclassification patterns.
- **No live Gemini check.**
- **Data gaps unchanged:** SAME telemetry, Flame Design outcomes, BRE per-test data, FLEX-2 and PSI-62 measurements.

# Phase 16 — Scientific Explorer Expansion & Guided Visualization Refinement

Branch `feature/spacefire-phase16-visual-exploration`, from `7f4c5c9` (Phase 15; verified equal to its remote branch;
`10e9d6a` is an ancestor). Rollback: `backup/spacefire-before-phase16` = `7f4c5c9` (pushed). No merge into main, no
deploy, no branch deleted.

## Workstreams

| Workstream | Status | What was done | Details |
|---|---|---|---|
| A. Combustion Explorer | Done | "Combustion & Fire Science Explorer" at the same route. Five domains with verified images; ten investigations at their evidence level (FLEX/BASS-II/SAFFIRE-I tables unchanged; 7 collections via a new `/api/v1/combustion/*`); dataset-specific filters; record pages with provenance; investigation profiles (PSI-62 profile only); comparison only where compatible; six-step guided exploration; two-way links with Research-to-Safety | `PHASE16_COMBUSTION_EXPLORER.md` |
| B. Guided timelines | Done | Gaseous Flame and Smoke Detection studios reuse the FLEX timeline store and bar: Start, Play/Pause, Restart, Prev/Next, slider, speed, stage markers, stage text; the scene follows the stages; the animation Pause pauses the guide | `PHASE16_GUIDED_TIMELINES.md` |
| C. Research-to-Safety UX | Done | Visual hero and four image cards with one sentence each; collapsed ranking method; scenario pages reordered (overview → key evidence chart → ranked → evidence → collapsible filters → interpretation); guided start per scenario and card | `PHASE16_EXPLORER_UX.md` |
| D. Find similar | Done | Local-database-only statement and scope panel; algorithm audited (sound); CFI-G added, scoped to one configuration, starting conditions only | `PHASE16_SIMILARITY_AUDIT.md` |
| E. Science media | Done | Audit (15 verified items, no broken local file); coverage panel for all ten investigations (five without media, stated); no new media added (none verifiable) | `PHASE16_SCIENCE_MEDIA_AUDIT.md` |
| F. Prediction | Done | Retained as "Exploratory FLEX Burn-Time Estimator" under "Advanced research tools", with a visible validation summary; no dataset pooled; no retraining | `PHASE16_PREDICTION_REVIEW.md` |
| G. Consistency | Done | Same design system, light/dark, mobile; demo bar extended with an explore mode instead of a new navigation system | – |

Test results: `PHASE16_TEST_RESULTS.md`.

## Files

**Backend:**
- `app/services/combustion.py` (new)
- `app/services/similarity.py` (CFI-G)
- `app/api/v1/routes.py` (5 endpoints)
- `tests/test_phase16.py`

**Frontend:**
- `components/views/combustion/*` (DomainPicker, CollectionBrowser, InvestigationProfile, RecordView)
- `components/views/RecordRoute.tsx`
- `ExplorerView.tsx`
- `lib/timeline.ts` (GAS_STAGES, SMOKE_STAGES)
- `LiteStudio.tsx`, `LiteViewport.tsx`, `GasFlameScene.tsx` (phase)
- `SmokeView.tsx`, `gas/GasFlamesView.tsx`
- `lib/demo.ts` and `components/demo/DemoBar.tsx` (explore mode)
- `explorer/ExplorerHome.tsx`, `explorer/ExplorerWorkspace.tsx`
- `SimilarView.tsx`, `MlView.tsx`, `MediaGalleryView.tsx`, `Shell.tsx`, `app/modeling/page.tsx`
- e2e: `phase16.spec.ts`, `phase16-mobile.spec.ts`; updated `phase3`, `mobile`, `phase14`, `phase14-mobile`

## Scientific integrity

- No NASA source file, curated record or database value was modified. All new pages read the existing verified records.
- No per-test outcome is created:
  - Flame Design has no outcome columns.
  - BRE stays 18 days (194 flames as a sum, not records).
  - PSI-117 series are not tests.
  - The SAME tables are not joined.
- Comparisons and similarity never cross configurations or investigations.
- Guided timelines are labelled conceptual and have no measured durations. The cool flame appears only for a selected
  Table 3 event.
- No media substituted for missing coverage. The CFI-G frame is never called a cool flame.

## Known limits

- Similarity is not offered for Flame Design (conditions only), BRE, SAME, PSI-117, FLEX-2 or PSI-62; reasons are stated
  on the page.
- Five investigations have no verified NASA media.
- The estimator's median error is about 35 %, and it is shown as exploratory.
- Not covered by new automation: the retrieval benchmarks (no retrieval change, not re-run), live Gemini, and native video
  fullscreen.

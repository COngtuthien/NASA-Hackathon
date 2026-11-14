# Phase 16 — Test Results (2026-11-14)

Memory-safe procedure:
- The backend suite, the build and the browser batches ran one at a time.
- One Playwright worker, 3–4 spec files per batch, against one production server (port 3010) and one API (port 8010, AI
  off).
- About 3.3 GB stayed free, and no run was interrupted.

## Final state: every suite completed

| Check | Result |
|---|---|
| Backend `pytest` | **265 passed, 0 failed** (257 earlier + 8 in `tests/test_phase16.py`) |
| AI benchmark, Phase 15 set (regression) | type 15/16, abstention 16/16, investigation 13/13, structured 13/13, data 7/7: unchanged |
| TypeScript `tsc --noEmit` | clean |
| ESLint `components lib app e2e` | clean |
| Production build | OK |
| Browser, desktop | **191 tests: 190 passed, 1 skipped** (live-LLM test, needs `E2E_LIVE_LLM`) |
| Browser, mobile | **17 passed** |
| **Browser total** | **208 tests in 29 files: 207 passed, 1 skipped, 0 failed**, all on the final build |

The retrieval benchmarks were not re-run in Phase 16: no retrieval, document or Copilot evidence code changed. The last
measured values (Phase 15) are 0.800/0.867 and 0.50/0.786.

### Desktop batches (final build)

| Batch | Specs | Result |
|---|---|---|
| 1 | phase13, phase14, phase15, **phase16** | 41 passed |
| 2 | phase2, 3, 4, 5 | 26 passed, 1 skipped |
| 3 | phase7, 8, 9, 9-unit | 48 passed (incl. the Phase 8 density budget) |
| 4 | phase10, 10-unit, 11, 11-unit | 41 passed |
| 5 | phase12, journeys, copilot-errors | 34 passed |

## New tests

**Backend (`test_phase16.py`, 8 tests):**
- Five domains cover the ten investigations, with the right evidence level and counts.
- CFI-G filters match independent recounts and keep configurations apart; an unknown filter value returns 400.
- Flame Design has no outcome columns.
- BRE has 18 days summing to 194 flames.
- PSI-117 series carry no point rows and cannot be compared; FLEX-2 cannot be compared.
- The SAME log (47 tests) and sizes (8 rows, Kapton 105/186 nm) stay separate.
- Record provenance (CSV row, PDF p.46 graph source, analysis link) and the PSI-62 profile.
- Comparison rules: same-configuration allowed; normal + inverse and cross-collection refused; a single record returns
  400.
- CFI-G similarity: deterministic, configuration-scoped, outcome-free; a condition query requires a configuration.
- The predictor stays FLEX-only.

**Browser (`e2e/phase16.spec.ts`, 10 tests; `e2e/phase16-mobile.spec.ts`, 2 tests):**
- **Domains and collections:**
  - Every collection shows its badge; PSI-62 is a profile.
  - The FLEX (274), BASS-II (129) and SAFFIRE-I (2) tables are unchanged.
- **CFI-G:**
  - Filters: 333 → 154 → propane subset.
  - Compatible comparison; refused normal + inverse.
  - Record provenance, and the link to the analysis-page test lookup.
- **Evidence levels:**
  - Flame Design shows no outcome or burn-time column.
  - BRE "18 days"; PSI-117 "61 series" with comparison unavailable; SAME Kapton 2 rows incl. 186.
  - FLEX-2 is a "test plan".
- **Explorer guided exploration:** six real steps (domain → dataset → filtered records → record 21174C3 → CFI-G charts →
  Copilot draft with the test); no question sent.
- **Two-way links:** Research-to-Safety ↔ Combustion Explorer.
- **Gas guided timeline:**
  - Stages change the scene: no flame at setup, flame label from ignition.
  - The slider seek reaches the transition text with the 30 % n-butane qualifier.
  - At 2× the guide advances; the animation Pause stops it.
  - Restart → 0; Reset → off.
- **Smoke guided timeline (reduced motion):**
  - Idle loop `demand`; Start → `always`, and progress advances.
  - Seek to stage 5; Next → stage 6; a stage button moves the guide.
  - Hide/Show controls hides and restores the guide.
- **Research-to-Safety entry:**
  - Four card images; one sentence under 90 characters each.
  - Card guided start → step 3; summary chart drawn; filters collapsed.
- **Find similar:** the scope panel says "not the internet"; CFI-G inverse condition search and normal uid search each
  report their single-configuration scope.
- **Media coverage:** SAME shows "No verified NASA media"; CFI-G count 1, and the filter shortcut works.
- **Estimator:** exploratory heading; the validation summary includes grouped CV and "no other investigation is pooled".
- **Mobile:** no horizontal scroll on the Explorer domains, a collection table, the Research-to-Safety cards and a guided
  studio timeline.

**Changed existing tests (intentional UX changes):**
- `phase3`: navigation group "Advanced research tools", item "FLEX Burn-Time Estimator".
- `mobile`: the estimator heading.
- `phase14` and `phase14-mobile`: open the collapsed "Refine by experimental conditions" before choosing a filter.

## Problems found and fixed during testing

1. **PSI-62 profile tab did nothing (real bug).** Its collection key was `PSI-62`, while the page expected `psi62`. Fixed
   in `combustion.py`, and the test now asserts the URL.
2. **Test race.** The CFI-G count was read before the filter applied; the test now waits for the count to change.
3. **Test locator.** On the Similar page, the field label wraps its select, so the test uses the field id.

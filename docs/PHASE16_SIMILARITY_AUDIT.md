# Phase 16 — Find Similar Experiments: Audit and CFI-G Extension

## What it searches

The local NASA records already processed into SpaceFire's SQLite database. **It does not search Google or the internet.**
The page now says so in its subtitle ("Find NASA tests with similar starting conditions in the SpaceFire AI database")
and in a "What this searches" panel that lists what is searched, what is not, and why.

## Audit of the existing algorithm (`backend/app/services/similarity.py`)

| Aspect | Finding |
|---|---|
| Distance | Gower-style. Numeric `abs(a−b)/range` clipped to [0, 1] (log for pressure and thickness); categorical mismatch = 1; similarity = 1 − distance |
| Normalization | Range over the collection being searched |
| Missing data | Null-aware: a field is compared only if both records have it; weights are renormalized over the compared fields; the number of fields compared is returned |
| Grouping | Within one investigation only. Optional "same fuel / material class" |
| Outcome leakage | None. Outcomes (FLEX burn time, D_ext, K, test end; BASS-II final gases) are never features and are shown for context only |
| Supported before Phase 16 | FLEX, BASS-II. SAFFIRE-I is refused (n = 2) with a link to the comparison |
| Determinism | Ties broken by experiment id |

The audit found no defect. The existing behaviour was kept.

## CFI-G extension

| Item | Rule |
|---|---|
| Records | 333 `cfig_tests` records, **searched within one configuration only**: 179 normal or 154 inverse. A query must choose one (400 otherwise). Results state "CFI-G normal flames only; the other configuration is never compared." |
| Features (starting conditions) | fuel species (category, weight 3); O₂ mole fraction (3; ambient before ignition for normal, oxidizer supplied for inverse); pressure in bar (2, log); fuel fraction in the bottle (1.5); supply flow (1.5; fuel for normal, O₂ for inverse) |
| Excluded (outcomes and post-test values) | observed outcome, hot ignition, termination, burn time, O₂ after the test, peak burner temperature |
| Tests | Deterministic order; results stay in the source's configuration; excluded fields never appear as features; condition search without a configuration is rejected |

## Not supported, with reasons

| Investigation | Reason |
|---|---|
| ACME Flame Design | Conditions only, without outcomes, so a "similar test" has nothing to compare it against; browse its conditions in the Explorer |
| ACME BRE | Day-level summaries, not tests |
| SAME | Particle sizes are results, not starting conditions; the log has no condition values |
| PSI-117 | Figure-data series, not tests |
| FLEX-2, PSI-62 | No test records |

No similarity is computed across investigations.

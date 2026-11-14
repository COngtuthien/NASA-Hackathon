# Phase 16 — Prediction & Modeling Review

## Final product decision: **Retain, as the "Exploratory FLEX Burn-Time Estimator"**

| Item | Change |
|---|---|
| Page | `/modeling` |
| Heading | "Exploratory FLEX Burn-Time Estimator" |
| Kicker | "Advanced research tool · exploratory" |
| Navigation | Moved under a group renamed "Advanced research tools", as "FLEX Burn-Time Estimator"; no longer named as a headline "Prediction & Modeling" feature |
| Validation summary | Visible at the top of the page |

The model enabled before Phase 16 remains enabled, unchanged. No model was retrained.

## Validation evidence (`processed/ml_flex_model.json`, model card)

| Item | Value |
|---|---|
| Target | log(burn time) of FLEX tests |
| Features | methanol flag, O₂, CO₂, He, log pressure, initial diameter (starting conditions only) |
| Data | n = 204 FLEX tests with a usable burn time; 71 atmosphere groups |
| Method | Ridge regression; **GroupKFold (5)** over fuel + composition + pressure-band groups, so a test's near-duplicates never sit on both sides of a split |
| Baseline (mean only) | MAE(log) 0.694; MAE 5.96 s; median APE 49 % |
| Ridge | MAE(log) **0.487** (30 % better than baseline); MAE **4.76 s**; median APE **35 %** |
| Gradient boosting (depth 2), evaluated | MAE(log) 0.430; not deployed (Ridge kept for interpretability) |
| Interval coverage, out of fold | 0.79 |
| Leakage review | Passed: K, D_ext, burn time and test end are excluded |
| Deployment gate | Ridge must beat the baseline by ≥ 20 % grouped-CV MAE(log) and pass the leakage review: **passed** |
| Extinction classifier | Evaluated only, not deployed (few Completion cases, adaptive design) |
| Input ranges | Recorded per feature; a request outside them is **rejected** (HTTP 422 `out_of_distribution`, `services/ml.py`): no extrapolated estimate is returned |

**Why retain, but only as exploratory.** The grouped validation shows a real but modest improvement over the baseline.
With a median error of about 35 %, the estimate is useful for exploring trends within FLEX conditions, not for
quantitative use. That is how the page now presents it.

## New investigations: not incorporated

| Investigation | Reason it is incompatible with the FLEX burn-time target |
|---|---|
| ACME CFI-G | Gaseous spherical flames on a burner; burn time is set by gas supply and is often censored by flow termination. A different physical system and target. |
| ACME Flame Design | Conditions only, with no outcome to learn |
| ACME BRE | Day-level summaries of emulated condensed-fuel burning; no per-test target |
| SAME | Smoke particle sizes, a different quantity |
| PSI-117 | Digitized figure points and model curves, not independent tests; not joined to FLEX rows |
| FLEX-2 | Test plan only, no outcomes |
| PSI-62 | Metadata only |

Not pooling them is the scientifically correct result. A test (`test_predictor_stays_flex_only`) checks that the deployed
model card lists only FLEX fuels, at most 274 training rows, grouped CV, and passed gates. The page states "Trained on FLEX
only: no other investigation is pooled".

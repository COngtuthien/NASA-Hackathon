# SpaceFire AI — Scientific methods, assumptions and limitations

All numbers below are produced by code (`backend/app/services/analytics.py`, `ml.py`, `similarity.py`) from the original
files at ingestion time; none are copied from the research reports. Values quoted here were observed on 2026-11-10.

## 1. Data semantics adopted

| Item | Treatment | Evidence |
|---|---|---|
| FLEX `CO initial ambient composition` | Interpreted as **CO₂ diluent**; header kept; flag `FLEX-HDR-CO2` | Suppressants studied were CO₂/He/SF₆ (ISA-Tab objective); C-series IDs ↔ column > 0 (108/108); diluent list in 1G17-070HE-0166 p.1 |
| FLEX `Burning rate; mm` | Interpreted as d²-law constant K in **mm²/s**; flag `FLEX-UNIT-K` | d²-law `(D/D0)² = 1 − K t / D0²` (2G11-070HE-0310 PDF p.2); dimensional and numeric consistency (§2) |
| FLEX `Test end = Disruption` | **Unresolved / possibly censored**; never counted as extinction | No definition found in any indexed FLEX document (full-text search) |
| FLEX `Visible flame extinction diameter` | Droplet diameter when the *visible* flame ends; heptane may continue burning as a cool flame | 1G17-070HE-0166; Cool Flames in Space slides |
| FLEX duplicates | `193F001` appears on rows 70 and 73 with different values; canonical key is the source row | CSV |
| BASS-II `GMT` | **Day of year**, not clock time | BASS-II data FAQ |
| BASS-II `Fan display` | Fan voltage ×10 mixed with pot settings; **never a velocity** | BASS-II data FAQ |
| BASS-II `Air display` | Duct probe reading (cm/s, ~1 min response); multi-stage text kept verbatim; single numbers only are exposed numerically | BASS-II data FAQ |
| BASS-II gases | Single before/after readings of the ~250 L chamber; not time series | Summary Report; Procedure |
| SAFFIRE-I rows | 2 burns (S1, S2); F1/F2 rows are image-set descriptors, not burns | CSV; DoD |
| SAFFIRE-I F2 | CSV says pre-test; DoD says post-flow; manifest timing (F2 starts after S2 ends) supports DoD; kept as **disputed** | DoD; workbook timestamps |
| SAFFIRE-I workbook | Image/downlink manifest only; JPEG size is never used as a flame metric | Workbook contents (no `xl/media`) |

## 2. FLEX d²-law consistency (not a prediction)

`t_est = (D0² − D_end²)/K`, `ratio = t_reported / t_est`.
Inclusion: numeric D0, K > 0, exact numeric burn time, Test end ∈ {Extinction (numeric Dext), Completion}, D_end ≤ D0.
Completion with no Dext assumes D_end = 0; Completion with Dext > 0 uses Dext. Disruption and `~` burn times are excluded.
Observed: n = 183 included (91 excluded with reasons), median ratio 1.048 (10–90 %: 0.957–1.141), 8 rows outside 0.6–1.5.
A ratio slightly above 1 is consistent with ignition transients being included in the reported time.

## 3. BASS-II gas balance

`ΔX = final − initial`; O₂ consumed = −ΔO₂; slope through the origin `Σxy / Σx²`.
Excluded: |ΔO₂| > 5 points (5 rows: B2, P22a, P22b, T28a, T28b — physically implausible for this chamber; raw kept).
Observed: slope 0.810 for 66 tests with > 0.2-point O₂ drop (0.808 over all 121), Pearson r = 0.98, versus 5/6 = 0.833 for
complete PMMA combustion `C5H8O2 + 6 O2 → 5 CO2 + 4 H2O`. Limits: resolution 0.1 % for O₂ and CO₂; chained atmospheres between
same-day burns; multi-stage flow integrates over stages; no heat release rate (burn durations not in the CSV).

## 4. Similarity

Gower distance on initial conditions only. FLEX: fuel (w3), diluent (w2), X_O₂ (w3), X_CO₂ (w1.5), X_He (w1.5),
log P (w1.5), D0 (w2). BASS-II: material class (w3), geometry (w1), PI (w1), log thickness (w1.5), diameter (w1.5),
width (w1), initial O₂ (w2), restrictor (w0.5). Missing values drop the field and renormalize weights. Outcomes are excluded.
SAFFIRE-I (n = 2) is not ranked.

## 5. Evidence ranking

BM25 (FTS5, section-weighted) and LSA cosine (TF-IDF → 192-component SVD, fixed seed) are fused by reciprocal rank (k = 60),
multiplied by a document-type weight, a concept-coverage factor `0.4 + 0.6·coverage`, and a penalty for table-of-contents or
very short passages; exact test-ID and exact-phrase matches add small fixed boosts. Labels describe retrieval relevance, not truth.

## 6. Assistant verification

The language model receives only an evidence pack (tool outputs, verbatim passages, external metadata/abstracts) marked as
untrusted data. Each claim must cite existing evidence IDs and every number in it must appear in the cited evidence; failing
claims trigger one corrective retry, then are removed (status `partial` or `insufficient_evidence`). Operational safety
thresholds are explicitly out of scope.

## 7. FLEX ML (P2)

Target log(burn time) for Extinction/Completion rows with exact times (n = 204, 71 atmosphere groups). Features: fuel, X_O₂,
X_CO₂, X_He, log P, D0. GroupKFold(5) by fuel+composition+pressure band. Ridge MAE(log) 0.487 vs dummy 0.694 (−29.8 %), gate
≥ 20 % → exploratory prediction enabled with an 80 % empirical interval and out-of-range refusal. Median absolute error ≈ 35 %:
useful as a sanity check, not as a scientific result. Extinction-vs-Completion classification is evaluated only
(balanced accuracy 0.75 vs 0.50 dummy; 27 Completion cases).

## 8. What the local data cannot support

Flame spread rates, flame area, temperatures or gas time series for SAFFIRE-I; BASS-II spread rates or extinction velocities
(only in report figures); a defensible limiting oxygen index for FLEX; any spacecraft safety threshold.

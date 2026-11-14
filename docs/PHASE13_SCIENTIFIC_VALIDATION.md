# Phase 13 — Scientific Validation

Automated checks are in `backend/tests/test_phase13_science.py` (22 tests),
`backend/tests/test_retrieval_benchmark.py::test_phase13_benchmark_new_investigations` and
`frontend/e2e/phase13.spec.ts` (10 browser tests). Every check below is an assertion on content, not on HTTP status.

## Verification of transcribed values against the original sources

| Table | Source | Rows | Method | Result |
|---|---|---:|---|---|
| CFI-G Table 3 (cool flames) | CFI-G final report PDF p46 | 15 | Each transcribed row must appear, in order, as a contiguous token run in the PDF page text | 15/15 verified |
| CFI-G Tables 1–2 | PDF p21–22 | 23 | Day code, count and atmospheres found in page text; flame total = 280 = report text (p44); fuel per day = CSV fuel per day | 23/23 verified |
| Flame Design Table 1 | FD final report PDF p24 | 23 | Day code and atmosphere found in page text | 23/23 verified; total 326 |
| BRE Table 1 | BRE final report PDF p24 | 18 | Day code found in page text; YYDDD → date checked; total 194 = 62 + 132 (data interpretation p4) | 18/18 verified |
| BRE Table 2 (literature) | PDF p29 | 5 | Material + LHV found in page text | 5/5 verified |
| SAME Table 1 | Final Science Report PDF p27 (= SAE 2009-01-2468 Table 1, PDF p39) | 8 | Contiguous token match per row | 8/8 verified |
| SAME Appendix A | PDF p33 | 51 | The whole page token stream must equal the concatenated transcription | 51/51 verified |
| SAME other sources | PDF p48, p57, p64; ICES 2012 slide 24 | 22 | Text match / exact PPTX table cells | 22/22 verified |

## Mandatory checks (all passing)

**CFI-G**
- 333 rows = 179 normal + 154 inverse; the 861 blank rows are reported, not counted.
- Every record's file of origin matches its configuration.
- Outcome counts per configuration are exact: normal SE 102 / FT 30 / not ignited 46 / no-hot + FT 1; inverse SE 73 /
  FT 58 / flash + SE 8 / not ignited 15.
- `burn_time_censored` is true exactly when termination = FT. The burn-time API aggregates SE only (normal: ethane
  30, propane 34, n-butane 38).
- `#DIV/0!` (21125A4, 21125H3), `#VALUE!` (21242F4, P2) and the 273.15 K artefact (21265H3) are flagged and left empty;
  raw strings are preserved. 29 `limit` colours and 7 PCI-A…G labels are flagged undefined and kept verbatim.
- Units: p in bar; atm derived as bar / 1.01325 (checked per row); flows in mg/s; burn time in s.
- Table 3: 15 events, all verified, `21174D13` absent, `21174D1` has no cool radius and the footnote flag. The condition
  set is asserted for every event (Xf 0.3, 2.03 bar, 0.75–1.5 mg/s, XO₂ 0.38–0.40). The CSV cool-flame tests match the
  7 Table 3 tests.
- Report vs CSV: 280 (report) ≠ 333 (rows); 189 (report radiative extinctions) vs 183 (CSV SE). Both kept, with an
  explanation.

**SAME**
- 8 Table 1 rows: 4 materials × fresh/aged. Kapton fresh (80, 105, 179, 2.08) checked exactly. All diameters in nm.
- Other sources are not reconciled: Teflon fresh mean diameter keeps four source values (205, 158, 223, 111 nm).
- 47 flight-log tests numbered 1–47; by sample: silicone 6, DBP 22, Teflon 7, lamp wick 6, Kapton 6; test 8 = Kapton, GMT
  257.
- Telemetry: 59 workbooks listed only. No sentinel was replaced (none processed); the deferral flag is `unresolved`.

**PSI-117**
- 9 source CSVs inventoried with SHA-256.
- Roles: experiment → `digitized_figure`; model and model-only → `model_prediction`. The excluded series and the
  error-bar columns are never assigned to a figure.
- Units: every unknown unit is shown as "unknown" and flagged.
- Negative physical values are flagged and kept (e.g. Dflame/D0 = −0.158). Pre-ignition negative times and zero
  extinction diameters are kept and flagged.
- No record has a test ID or references a FLEX row. A dataset flag states the 1-D model / not-CFD fact.

**Flame Design**
- 207 normal + 120 inverse records. Evidence class `test_condition`. No outcome-like field exists in any record. 71
  flow markers. p atm → bar checked per row. Final report Table 1 total 326.

**BRE**
- 18 days; 194 flames = round 1 (62) + round 2 (132).
- Date corrections documented: CSV 2020-10-17 → report 20261 = 2020-09-17; CSV 2020-12-05 → report 20279 = 2020-10-05
  (CH₄).
- Both Excel percent artefacts are flagged.

**Registry**
- 10 investigations with ISA-Tab identity. DOIs checked for PSI-159, PSI-10 and PSI-20. PSI-62 is `metadata_only`;
  Flame Design is `conditions_only` with folder `ACME Flame Design`.

**Reproducibility and integrity**
- Processing is re-run from the sources and must equal the committed JSON exactly.
- Every recorded source SHA-256 equals the file on disk.
- `test_source_files_unchanged` (existing) still passes for the original datasets.

**Existing datasets (regression)**
- FLEX, BASS-II and SAFFIRE-I counts (274 / 129 / 2), BASS-II report curation, quality rules, d²-law and the Ridge
  model tests all pass unchanged.
- The overview test now pins the three originals and asserts the seven new investigations have no `experiments` rows.
- The documents test pins the 20 original documents and allows the 30 new ones.

## Claims deliberately not made

- No validated CFD model. The PSI-117 model is 1-D; there are no OpenFOAM outputs.
- No interpolation of CFI-G flame radii outside the Table 3 condition.
- No BRE material flammability classifier and no BRE flame-spread rates.
- No SAME detector-sensitivity ranking and no detection probability.
- No synthetic values: every chart is computed by the backend from curated records.

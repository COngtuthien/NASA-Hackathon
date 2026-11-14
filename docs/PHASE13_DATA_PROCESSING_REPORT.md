# Phase 13 — Data Processing Report

Every count below comes from the executed processing run (`python -m app.ingest.phase13.run`, which writes
`processed/curated/phase13/processing_report.json`) and from the rebuilt database (`python -m app.ingest.run`). No
count is estimated.

## 1. Two layers: downloaded source data vs application-ready data

| Layer | Where | In Git? | What it is |
|---|---|---|---|
| Downloaded NASA source data | `ACME CFI-G/`, `ACME Flame Design/`, `ACME BRE/`, `SAME/`, `PSI-117/`, `FLEX-2/`, `PSI-62/` | **No** (untracked; ~1.2 GB, includes videos and drawings) | Immutable. Read only, never modified (SHA-256 verified before and after). |
| Verified curated derivatives | `processed/curated/phase13/*.json` (14 datasets + processing report, 1.8 MB) | **Yes** | One JSON per dataset. Each has its source files with SHA-256, field specifications (variable, evidence class, units, unit status, transformation), records with provenance (file, table, PDF page, source row), original strings, normalized values, flags and verification status. |
| Application database | `processed/spacefire.db` | No (rebuilt) | `p13_datasets`, `p13_records`, `p13_values` (long format: one row per processed scalar with original value/unit, normalized value/unit, transform, evidence class, verification), `investigation_registry`, plus the new rows in `quality_flags`, `documents`, `document_chunks` and `investigation_publications`. |

**Reproducibility.** `tests/test_phase13_science.py::test_processing_is_reproducible_from_sources` re-runs every
processor against the local sources and requires byte-for-byte equality with the committed JSON. A clean clone (no
source folders) still builds the full application database from the committed JSON; only the RAG document text needs
the local PDFs.

## 2. Required summary table

"Flagged" = records carrying at least one quality flag (any severity / warning or critical). "Excluded" = records not
used in any analysis; nothing is deleted from the curated files.

| Investigation | Source records | Processed records | Excluded records | Flagged records (any / warning) | Quantitative readiness | Limitations |
|---|---:|---:|---:|---:|---|---|
| **ACME CFI-G (PSI-159)**, per-test tables | 333 test points (179 normal + 154 inverse) | 333 | 0 (861 trailing blank CSV rows are not records) | 45 / 7 | **Quantitative**: outcomes, burn times and burner temperatures charted per configuration | FT burn times censored; Tad/Zst method undocumented; `limit` and PCI labels undefined; CSV and report count flames differently |
| CFI-G final report Table 3 (cool flames) | 15 events | 15 (all verified against PDF p46) | 0 | 1 / 0 (footnote 3) | Measured radii at one condition only | Not transferable to other conditions |
| CFI-G Tables 1–2 (flames per test day) | 23 days | 23 (verified p21–22) | 0 | 1 / 0 | Operational log | Atmospheres nominal |
| **ACME Flame Design (PSI-10)**, per-test tables | 327 test points (207 normal + 120 inverse) | 327 | 0 (71 RAMP/RAMPED/LOW O₂ rows are omitted from the condition-space plot, not from processing) | 91 / 1 | **Conditions only**: condition-space charts; no outcome analysis possible | No outcome columns; results only as report statements |
| Flame Design Table 1 (flames per test day) | 23 days | 23 (verified p24) | 0 | 0 / 0 | Operational log | — |
| **ACME BRE (PSI-20)**, Table 1 day log | 18 days | 18 (verified p24) | 0 | 4 / 2 | **Curated report tables**: campaign overview | No per-test data; the PSI CSV has 2 date errors and 2 Excel percent artefacts (kept as conflicts) |
| BRE Table 2 (literature values) | 5 | 5 (verified p29) | 0 | 0 / 0 | Literature reference | Not BRE measurements |
| **SAME (PSI-102)**, Final Science Report Table 1 | 8 | 8 (verified p27) | 0 | 0 / 0 | **Curated report tables**: particle-size charts | Moment-method results (log-normal assumption) |
| SAME, same quantities in other documents | 22 | 22 (12 verified PDF text; 10 verified PPTX table) | 0 | 0 / 0 (1 dataset-level conflict flag) | Provenance comparison | Successive analyses; ICES 2012 includes SAME-2 |
| SAME Appendix A flight log | 51 rows (47 tests + 4 carousel operations) | 51 (verified p33, whole token stream) | 0 | 6 / 0 | Operational log | Record-time units undefined |
| SAME 1 Hz telemetry workbooks | 59 workbooks | 59 inventoried | **59 (values not processed)** | 0 / 0 (1 dataset-level warning) | **Deferred** | See §5 |
| **PSI-117**, figure-data CSVs | 12,891 points in 61 declared series from 9 CSVs | 61 series; 12,819 points plotted (the 10 error-bar points are kept but not plotted) | 72 points (1 series of unclear role) | 35 / 7 series | **Figure data**: experiment vs 1-D model charts | Digitized points; several units inferred or unknown; model is 1-D, not CFD; no FLEX row join |
| **FLEX-2 (PSI-68)** | 8 envelope rows | 8 | 0 | 0 / 0 | **Documentation only** | No measurements downloaded |
| **PSI-62** | ISA-Tab metadata | 1 registry entry, 1 document | — | — | **Metadata only** | No outputs downloaded |
| Investigation registry (all 10) | 10 ISA-Tab files | 10 (identity from ISA-Tab) | 0 | 0 / 0 | Phase 14 foundation | Scope and readiness are SpaceFire's assessment |

Database totals after ingest:
- **Investigations:** 10 (3 + 7).
- **Phase 13 data:** 14 datasets; 963 records; 12,488 long-format values.
- **Documents:** 50 (20 + 30 new, 1,601 new pages).
- **RAG chunks:** 3,019 (was 631).
- **Publications:** 203 (was 74).
- **Quality flags:** 762, including the 203 Phase 13 flags (180 info, 23 warning).

## 3. Transformations

All transformations are declared per field in each JSON's `field_specs` and repeated in `p13_values.transform`.

| Dataset | Transformation | Why |
|---|---|---|
| CFI-G | Test ID spaces removed for matching (`21088 B1` → `21088B1`); original kept | IDs written inconsistently |
| CFI-G | `Yes/yes`, `No/no`, `inverse/Inverse` case-normalized; originals kept | Consistent grouping |
| CFI-G | `butane` → `n-butane` | The final report writes n-C₄H₁₀ (Tables 1–2) |
| CFI-G | Bottle percentage parsed from `30% butane` (neat = 100) | Dilution as a condition |
| CFI-G | p (bar) → atm (÷ 1.01325) as a *second* field | Comparison with Flame Design |
| CFI-G | Outcome = hot ignition × termination (SE / FT / flash + SE / not ignited / no-hot-ignition + FT) | FT is right-censored |
| CFI-G | `#DIV/0!` and `#VALUE!` → empty (flagged, not recomputed); 273.15 K from an empty °C cell → empty (flagged) | Never repair NASA values |
| CFI-G | YYDDD → calendar date | Day lookup |
| Flame Design | p (atm) → bar as a second field; RAMP/RAMPED/LOW O₂ kept as `flow_marker`, numeric fields empty | Conditions only |
| BRE | Report Table 1 values used; CSV row matched by date, or by burner + fuel + count when the CSV date is wrong | Report is authoritative; the conflict is recorded |
| SAME | µm values × 1000 → nm in alternate sources (original value and unit kept) | One unit for display |
| SAME | `Intiial` read as Initial (flagged) | Typo |
| PSI-117 | None to values. Series declared with role, units and unit status (header / documented / inferred / unknown / dimensionless) | Roles and units are not machine-readable in the files |

## 4. Quality decisions

- **Normal vs inverse** are never pooled. Every aggregate groups by configuration.
- **Censoring.** The burn-time box plots use SE rows only. FT rows are drawn separately as "≥" points.
- **Two counts kept.** The report's 280 hot flames, 189 radiative extinctions and 15 cool flames, and the CSV's 333
  rows, 263 hot-ignition yes, 8 flash, 183 SE and 89 FT are kept side by side with the reason they differ (report
  Table 2 footnote 3: momentary flames and reignitions are counted). No count was adjusted.
- **Table 3 test 21174D1.** Text extraction prints "21174D13" (footnote 3). The ID is stored as `21174D1` with the
  footnote recorded. The UI marks it with †, not a superscript 3.
- **Unconfirmed comments.** The CSV comments "direct cool – no hot ignition" at ~0.5 bar conflict with the report (cool
  flames only at 2 bar). They are flagged as `CFIG-DIRECT-COOL-UNCONFIRMED` (disputed) and not counted as cool flames.
- **PSI-117 roles.** Experiment = digitized figure data (evidence class `digitized_figure`); model and model-only =
  `model_prediction`. One block right of "Simulations" is non-monotonic like digitized data, so its role is unclear:
  it is excluded (72 points) and named in the UI. Error-bar columns are kept but never attached to points.
- **PSI-117 units.** Extinction diameter in mm is documented (extinction slides PDF p9). Time on unlabelled
  experimental axes (s) and `Kavg_CF` (mm²/s) are inferred and flagged. The cool-flame diameter (HWFM / peak-to-peak)
  unit is unknown and shown as "unit not stated".
- **No FLEX join.** PSI-117 test numbers (563, 1256, 1268) have no key in the FLEX table. No approximate matching is
  attempted.

## 5. SAME telemetry: complete vs unresolved

| Item | Status |
|---|---|
| Inventory of the 59 workbooks (folder label, file, size, log vs housekeeping) | Complete (`same_telemetry_inventory.json`) |
| Report-derived particle sizes (8) and other-source versions (22) | Complete, verified |
| 47-test flight log | Complete, verified |
| Per-test detector / P-Trak / DustTrak traces | **Deferred.** Unresolved: (1) material must be assigned by log time window, because folder names are unreliable (the "Cotton Lamp wick" GMT256 export also covers a Teflon test); (2) meaning of −10 V, −999 and 500,000 values is undocumented; (3) `Time` mixes Unix epoch and elapsed seconds; (4) `kaptonGMT257*.xls` carries a day-254 TimeString; (5) reading `.xls` needs `xlrd`, which is not a project dependency. |

The website states this deferral on the Smoke & Fire Detection page and never plots raw signals.

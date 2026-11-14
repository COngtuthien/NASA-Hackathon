# ACME Dataset Audit: BRE, CFI-G, Flame Design (Phase 13, 2026-11-14)

> **Rename note (Phase 13 implementation, 2026-11-14):** the folder `AMCE Flame Design` described below was renamed to
> `ACME Flame Design` after verifying its PSI-10 identity; all 14 files kept identical SHA-256 hashes. This audit and
> its inventory CSV keep the original name as historical evidence. See `docs/PHASE13_IMPLEMENTATION_REPORT.md`.

This is an audit only. Nothing has been integrated. No change was made to frontend, backend, database, model, Gemini
configuration or NASA source files. No Gemini or paid API was used, and nothing was downloaded. Page references are
**PDF page indexes** (1-based) unless "printed p." is stated.

Companion files: `docs/ACME_DATASET_INVENTORY.csv` (413 rows; rebuild with
`python -I research/scripts/acme_dataset_inventory.py`), `docs/ACME_DATASET_INTEGRATION_MATRIX.md`,
`docs/ACME_DATASET_DOWNLOAD_GAPS.md`, `docs/ACME_INTEGRATION_ROADMAP_PROPOSAL.md`. Context from the previous audit:
`docs/NEW_NASA_DATASET_AUDIT.md` (PSI-117, SAME/PSI-102, FLEX-2/PSI-68, PSI-62). **None of those four has been
integrated either.**

---

## 1. Executive summary

| Folder (exact name on disk) | Verified identity (ISA-Tab metadata) | What it really contains | Readiness |
|---|---|---|---|
| `ACME BRE` | **PSI-20**: ACME Burning Rate Emulator (ISS) | Rich documentation: 181-page final report, 171-page dissertation, data-interpretation guide, instrument characterization reports. Plus a **day-level** 18-row log (194 flames). **No per-test measurements.** Many files are ACME-wide, not BRE-specific | **RAG/documentation only**; requires per-test data for analysis |
| `ACME CFI-G` | **PSI-159**: ACME Cool Flames Investigation with Gases (ISS) | **Two per-test tables** (179 normal + 154 inverse test points) with conditions **and observed outcomes**: hot ignition, burn time, self-extinction vs flow termination, peak burner temperature, colour, cool-flame flag. 93-page final report with **Table 3: 15 measured cool-flame events with hot/cool flame radii** | **Ready after targeted processing** (the most reusable ACME data) |
| `AMCE Flame Design` (misspelling is real) | **PSI-10**: ACME Flame Design (ISS) | **Two per-test tables of conditions only** (207 normal + 120 inverse), with no outcomes. 109-page final report whose quantitative findings are given only in paper abstracts. SRD, Task Book reports, 4 representative images | **RAG/documentation only** for results; condition tables usable as context |

Answers to the required questions are in §11. In short:
- **CFI-G** has the most reusable data and is the best basis for a gaseous-flame section.
- **BRE** and **Flame Design** are documentation-rich but have no per-test results on disk.
- A new 3D studio is **not** justified yet.
- The minimum defensible integration is RAG ingestion of the three final reports and metadata, plus two small curated
  CFI-G tables.

Problems found that must not be overlooked:
- **4 drawing archives are damaged downloads.** Each is ~1.04 MB shorter than its own directory says, and 71 of their
  123 members cannot be read (§4.3).
- **The BRE PSI CSV has two date errors** compared with the authoritative BRE Table 1 (§6.1).
- **The CFI-G representative image** is named for cool flames but shows a luminous flame (§8).
- **The ACME metadata promises more than was flown.** CFI-G did not fly n-pentane, Flame Design flew no CH4, and BRE
  flew no CH4/N2 mixtures and no O2/CO2 atmospheres (§5).

---

## 2. Folder discovery and identity

Branch `audit/spacefire-acme-datasets` was created from `audit/spacefire-new-nasa-datasets` at `79d08cf`. That branch is
the latest documentation baseline and holds the previous audit. Before the audit the working tree had no tracked
changes. All dataset folders are untracked.

| Folder | Files | Subdirs | Size | Archives | PSI ID | Title (metadata `Study Title`) | Type / platform | PI (metadata) | Dates (metadata) | PSI DOI | Publications listed |
|---|---:|---:|---:|---:|---|---|---|---|---|---|---:|
| `ACME BRE` | 64 | 0 | 437,255,995 B (417.0 MiB) | 19 | PSI-20 | Advanced Combustion via Microgravity Experiments - Burning Rate Emulator | Microgravity Investigation; ISS, CIR + ACME | James G. Quintiere (UMD); Co-I J.L. de Ris; Project Scientists P. Sunderland, D. Stocker | 2010-01-01 → 2025-02-08 | 10.60555/vb93-3y72 | 16 |
| `ACME CFI-G` | 6 | 0 | 11,471,089 B (10.9 MiB) | 1 | PSI-159 | Advanced Combustion via Microgravity Experiments / Cool Flames Investigation with Gases | Microgravity Investigation; ISS, ACME + CIR | Peter B. Sunderland (UMD); Co-Is R. Axelbaum, F. Williams; PS D. Stocker | not given in metadata (final report: March–Oct 2021, p3) | 10.60555/cyt1-kh64 | 2 |
| `AMCE Flame Design` | 14 | 0 | 15,468,350 B (14.8 MiB) | 1 | PSI-10 | Advanced Combustion via Microgravity Experiments / Flame Design | Microgravity Investigation; ISS, ACME + CIR | Richard L. Axelbaum (WUSTL); Co-I P. Sunderland, D. Urban; investigator S. Frolov; PS D. Stocker | 1999-01-14 → 2025-04-30 | 10.60555/w4zy-bt45 | 33 |

Total: **84 files, 464,195,434 B (442.7 MiB), 21 ZIP archives (329 members).**

Identity notes:
- The BRE metadata archive is named `PSI-20_metadata_PSI-96_ACME BRE.zip`, so it carries two numbers. The `Study
  Identifier` is **PSI-20**; "PSI-96" is the archive's internal record number, by the same pattern as the earlier
  `PSI-68_metadata_PSI-132_FLEX-2.zip`.
- The folder name `AMCE Flame Design` is misspelled on disk. It was not renamed. All its files carry the `PSI-10_` prefix.
- **The BRE folder mixes scopes.** Of its 64 files, about 12 are BRE-specific. The rest are ACME-wide (ISRD, SORD,
  engineering, 14 drawing archives, instrument reports), general (ISS Researcher's Guide, CIR IAC 2008 paper, FCF
  brochure), or **another investigation**: `FLEX A Decisive Step Forward in NASAs Combustion Research Program.pdf`,
  whose text layer is font-scrambled and unreadable without OCR. The inventory's `content_scope` column records this.
  No measurement from another investigation was found inside the BRE folder.
- The CFI-G and Flame Design folders contain the same ACME-wide documents (one exact duplicate each, §4.4).

---

## 3. Archives and extraction

All 21 ZIPs were checked for entry list, sizes, path traversal (none), symlinks (none), and compression ratio (≤ 2.63;
no bombs). Free disk was 62 GB.

| Archive | Members | Action |
|---|---:|---|
| 3 × ISA-Tab metadata ZIPs | 2 each | Extracted to `dataset_audit_work/acme/` and read |
| `ACME BRE Data interpretation.zip` | 2 PDFs | Extracted; both are byte-identical to files at the folder root |
| `ACME Gas flow.zip` | 7 | Extracted; every sheet and PDF inspected |
| `ACME Imaging.zip` | 4 | Extracted; PDFs read |
| `ACME Instruments.zip` | 5 | Extracted; PDFs read |
| 14 × `ACME_drawings_*.zip` | 305 PDFs | **Not extracted** (engineering drawings, ~157 MB). CRC-tested; 2 drawings rendered to a temp folder for a visual check |

Total extracted: 25 small files (~21.6 MB), all in `dataset_audit_work/acme/`, which was deleted after the audit.
Original archives were opened read-only.

### 3.1 Damaged downloads (found by CRC test)

| Archive | File size | Sum of member sizes in its directory | Short by | Members readable / unreadable |
|---|---:|---:|---:|---|
| `ACME_drawings_avionics_package.zip` | 29,410,176 | 30,455,226 | 1,045,050 | 5 / 15 |
| `ACME_drawings_burners.zip` | 13,601,550 | 14,640,426 | 1,038,876 | 22 / 40 |
| `ACME_drawings_common_electrical.zip` | 7,160,282 | 8,204,590 | 1,044,308 | 13 / 11 |
| `ACME_drawings_shipping_containers.zip` | 4,415,134 | 5,460,628 | 1,045,494 | 12 / 5 |

Each file is about 1 MB short, which is consistent with a lost download chunk. The other 17 archives pass the CRC test.
Because these are engineering drawings with no science values, **re-downloading is not recommended** (see the gaps
file). The inventory marks each member readable or UNREADABLE.

---

## 4. File inventory

### 4.1 Categories (top-level files, by inspected content)

| Category | BRE | CFI-G | Flame Design |
|---|---:|---:|---:|
| Experimental tables | 2 (PSI CSV; Test_Summary image of Table 1) | 2 | 2 |
| Scientific reports | 8 (final report, 2 SRDs, 2 concept reviews, ISRD, ISRD-RDR, SORD) | 1 | 5 (final report, SRD, Task Book reports, ISRD, SORD) |
| Publications | 10 (dissertation, ACME overview papers and slides, general guides, FLEX article) | 0 | 1 (Task Book publication list) |
| Metadata | 4 (ISA-Tab ZIP, DoD, data-interpretation guide, data-file notes) | 1 | 1 |
| Calibration | 3 archives (gas flow, imaging, instruments) | 0 | 0 |
| Configuration and engineering documentation | 22 (14 drawing ZIPs, 4 drawing PDFs, ERD, engineering, CDR, DOC-010, procedure) | 1 | 1 |
| Images | 3 (outreach poster, pictorial slides, info poster) | 1 | 4 |
| Videos | 3 MP4 | 0 | 0 |
| Other (outreach sheets, brochure) | 6 | 0 | 0 |
| Raw Data / Analyzed Data / Simulation outputs / Source code | **0** | **0** | **0** |

No raw data, no analyzed per-test time series, no simulation output and no source code were downloaded. The Raw Data
collections exist on PSI according to the DoD and data-interpretation documents, and were deliberately not downloaded.
**There is no "Analyzed Data" folder in any of the three downloads.**

### 4.2 Formats

48 PDF, 21 ZIP, 5 CSV, 5 JPG, 3 MP4, 2 DOCX (top-level). Archive members: 312 drawing/engineering PDFs and 17
documentation/calibration files.

### 4.3 Text layers

All 61 non-drawing PDFs (including extracted members) were text-extracted. Image-only or near-empty: 4 drawing PDFs at
the BRE root, 2 outreach posters, the pictorial slides and the radiometer layouts. `FLEX A Decisive Step Forward…` has a
scrambled text layer. Low-text pages exist in the BRE science-concept decks (11 + 5 pages) and a few others.

### 4.4 Duplicates (verified)

| File | Duplicate of | Evidence |
|---|---|---|
| `ACME BRE/ACME_non-imaging_data_file_description.pdf` | member of `ACME BRE Data interpretation.zip` | SHA-256 |
| `ACME BRE/ACME-DOC-010_D.pdf` | member of `ACME BRE Data interpretation.zip` | SHA-256 |
| `ACME BRE/ACME_Science_Operation_Requirements_revA_20111018.pdf` | `AMCE Flame Design/PSI-10_Science Documents_ACME_SORD.pdf` | SHA-256 |
| `ACME CFI-G/PSI-159_Engineering Documents_ACME Engineering Implementation Rpt.pdf` | `AMCE Flame Design/PSI-10_Engineering Documents_…` | SHA-256 |
| `ACME BRE/ACME_Integrated_Science_Requirements_RevB.pdf` | `AMCE Flame Design/PSI-10_Science Documents_ACME_ISRD.pdf` | identical extracted text, 110 pages |
| `ACME BRE/ACME_engineering_20210328.pdf` (95 p) | earlier version of the 102-page Engineering Implementation report | different text |
| `ACME-BRE_Test_Summary.docx` and `ACME-BRE_DoD.docx` | same embedded image (BRE Table 1) | same image bytes |

No ACME file duplicates any file in the existing SpaceFire sources or the four previously audited folders (SHA-256
comparison against all of them). The only matches were the generic ISA-Tab placeholder `s_PSI-*.txt` files.

---

## 5. Scientific content by investigation

### 5.1 BRE (PSI-20): Burning Rate Emulator

- **Concept.** A porous, water-cooled flat burner feeds gaseous fuel (C2H4 or CH4, optionally diluted with N2) at a set
  mass flux. The fuel mixture's heat of combustion stands in for a solid or liquid fuel. The heat of gasification (L) is
  then inferred from the measured surface heat flux. The approach is meant to map which materials (by heat of
  combustion, heat of gasification and surface re-radiation) can burn steadily in quiescent microgravity (metadata
  `Hypothesis`; final report p3–5).
- **Analogy to materials is explicit.** For example, test 19070D1 (34% O2, 8.2 psia, hc 24 kJ/g, L 2.42 kJ/g) "could
  represent PMMA". Table 2 (p29) lists literature LHV and L for PE, PP, Nylon, PMMA and phenolic glass fibres. That table
  holds **literature values, not BRE measurements**.
- **Actually flown.** 25-mm and 50-mm burners. Fuels were 100% C2H4, 50% C2H4/N2 and 100% CH4 (the CH4 tests used the
  25-mm burner only). 18 test days, 194 flames (data interpretation p4: 62 in round 1 and 132 in round 2). Atmospheres
  were 21–40% O2 at several pressures (Table 1, p24). **Not flown:** O2/CO2 atmospheres (Objective 2, "not
  investigated", p40) and CH4/N2 mixtures (the metadata objective lists them; the logs show only 100% CH4).
- **Measured (per the report; not on disk as data).** Burner heat-flux gauges (centre and offset), radiometers (some
  saturated, p27), thermocouples, thin-filament pyrometry (TFP) in round 2, colour, intensified and HiBMs imaging, chamber
  pressure. Flame height comes from images (p28).
- **Findings (author statements).** Quasi-steady burning on a flat 25-mm surface occurs at nominal XO2 ≥ 0.265.
  All flames at 21% O2 / 14.7 psia self-extinguished within 40 s. Pressure had little effect on burning quality but did
  affect radiative loss. Large flames extinguish radiatively, while small flames quench at a second limit (p39–40).
  Flammability maps (L vs mass flux) are in **figures only** (Fig. 14–19, p30–35). TFP temperature histories cover 4
  tests (Fig. 20–23).
- **Tables suitable for extraction.**

| File | Page | Table | Columns | Rows | Difficulty |
|---|---|---|---|---:|---|
| `BRE_final_report_20220201.pdf` (also `BRE_data_interpretation_20220804.pdf` p6) | p24 | Table 1, BRE log of flames ignited | test day (YYDDD), date, burner, fuel bottle, O2 %, flames ignited | 18 | Low (clean text) |
| `BRE_final_report_20220201.pdf` | p29 | Table 2, literature LHV and L | material, LHV kJ/g, L kJ/g | 5 | Low; label as **literature** |
| `BRE_final_report_20220201.pdf` | p71 | Table 2, conditions of 19066D5 and 19070L1 | burner, XO2, p (bar), Xfuel, mass flux g/m²·s | 2 | Low |

- **Data dictionary present.** The 125 Hz per-test file columns (`Time, MFCA1StaticMixerFlow, …, BREHeatFluxCenter,
  BREHeatFluxOffset, …`) are listed in `BRE_data_interpretation_20220804.pdf` p8, with conversions in `ACME-DOC-010_D.pdf`
  §8.1 (p124) and §10.2 (p128). Note: "ACME pressure transducers have not been calibrated in years"; use the CIR chamber
  file instead (p8).
- **Limits as a flammability predictor.** The emulation rests on the authors' hypothesis that gas flames with a matched
  heat of combustion and an inferred L represent a material. Real materials char, melt, soot and spread, and none of that
  is emulated. Results are preliminary ("data analysis … still underway", p1). The flammability maps exist only as
  figures. **BRE is not a validated material flammability predictor.**

### 5.2 CFI-G (PSI-159): Cool Flames Investigation with Gases

- **Concept.** Spherical diffusion flames on a porous spherical burner in the ACME insert. **Normal** flames have fuel
  flowing into an O2/N2 atmosphere. **Inverse** flames have O2/N2 flowing into a fuel/N2 atmosphere (final report p3).
  The report states that CFI-G reused "the spherical porous burners and gas delivery system … used by the Flame Design
  flight experiment" (p4, a planning statement).
- **Actually flown.** Ethane, propane and n-butane (neat and diluted to 30–50% in N2). There were 23 test days from
  March to Oct. 2021 and **280 hot flames** (Tables 1–2, p21–22; 121 + 159). **n-pentane was not tested**, because
  "n-pentane's low vapor pressure" made it infeasible (p24), although the metadata hypotheses name it. The metadata
  design descriptors list "ethane"; the hypotheses list propane, n-butane and n-pentane.
- **Diagnostics.** Intensified camera with a formaldehyde filter, radiometers, PMT-2 (230–700 nm, CH2O*), thermocouples
  (p44, p86).
- **Cool-flame regimes (measured).** 189 hot flames extinguished radiatively. 15 of those reignited as **cool diffusion
  flames**, only for 30% n-butane, 40% O2, normal configuration, 2.03 bar, and 0.75–1.5 mg/s (p44). Some tests showed
  repeated hot↔cool transitions (21291A1, C1). Hot-flame radius was about 2.6 times the cool-flame radius (p23). **Table
  3 (p46)** lists all 15 events: XO2, Xf, p, ṁ, duration (s), r_hf and r_cf (mm), and their ratio.
- **Separate hot and cool identification.** The CSV `Hot ignition` column marks hot flames. `Cool flame?` (normal table
  only) marks 8 rows: 7 "yes, PCI-A…G" and 1 "no, PCI-hot". Comments add "Cool flame!", "direct cool - no hot ignition"
  and "5 transitions from hot to cool". The inverse table has no cool-flame column, and no inverse cool flames were
  reported.
- **Model.** An analytical model combining steady droplet burning with the partial-burning regime is described in the
  abstract (p23). **No model outputs are on disk.**
- **Extractable table.** `PSI-159_Reports_FinalRpt_ACME.CFI-G.pdf` p46, Table 3: 15 rows × 9 columns, low difficulty.
  Text extraction produced `21174D13`, which is test **21174D1 plus footnote 3** ("cool flame radius could not be
  evaluated due to low camera gain"). Do not copy it literally.

### 5.3 Flame Design (PSI-10)

- **Concept.** Spherical normal and inverse diffusion flames on a 0.25-inch porous sintered sphere, designed to separate
  soot formation and extinction from flame temperature and stoichiometric mixture fraction (Zst) (metadata `Objective`
  A–C; final report p3, p24).
- **Actually flown.** Round 1 (April–July 2019): normal C2H4 flames at 21–40% O2. Round 2 (Oct. 2021 – Feb. 2022): one
  normal C3H8 day for TFP calibration, then inverse flames (O2/N2 from the burner into C2H4/N2). Burner serial 1002 was
  replaced by 1003 mid round 1 (p19). **CH4 and CO2-diluent tests were "slated … but not allowed"** (p27), although the
  metadata objectives name CH4. The pressure limit was raised to 3 atm on 2022-01-17 (p19).
- **Findings (stated in paper abstracts in the report, p25–27).** All flames extinguish at a critical temperature of
  **1130 K**, at a fuel mass flux of **0.2 g/m²·s** (normal) and an oxygen mass flux of **0.68 g/m²·s** (inverse). Flames
  grow monotonically until radiative extinction, sometimes after oscillation. Burn times are 28–336 s (2021 paper). These
  are **author results**; the per-test values behind them are **not on disk**.
- **Measurement shortcomings.** TFP array misaligned for 4 test days (p19). Round-1 radiometers were saturated "for
  nearly every test" (p19). Burner asymmetry (p19). MFC flows "not always … steady or at the intended value" (p19). Images
  were processed without colour balance, dark-frame subtraction or hot-pixel removal, and demosaicing harms TFP (p93).
- **Soot and radiative extinction.** These are objectives and author findings, but **no soot-volume-fraction or
  extinction-limit data are in the download**. No table in the final report gives per-test results. The only results
  table is Table 1, flames per test day (p24).

---

## 6. Structured data profiling

All profiling used Python `csv`. Values were never modified. All 5 CSVs are UTF-8 (no BOM), comma-delimited, with
consistent row lengths.

### 6.1 `ACME BRE/PSI-20_Experimental table_ACME BRE.csv` (18 rows × 8 columns)

- **Content.** Day-level summary only: Year, Month (text), Date, Burner Size (mm) {25, 50}, Fuel Bottle (4 spellings:
  `100% C2H4`, `100%C2H4`, `50% C2H4`, `100% CH4`), Oxygen Conc (percent, as a list text such as "21; 26.5; 40"),
  Flames Ignited (0–21; total 194), Notes (2 rows). **No test IDs, no pressures** ("not identified", Notes), and **no
  measurements**.
- **Errors found against the authoritative Table 1.** Table 1 appears as an image in `ACME-BRE_Test_Summary.docx` and as
  text in the final report p24. Its test-day codes were checked against calendar dates.
  - The CSV row "2020 Oct 17, 25 mm, 100% C2H4, 26.5; 34, 13" is **20261 = 2020-09-17**.
  - The CSV row "2020 Dec 5, 100% CH4, 25; 34; 40, 21" is **20279 = 2020-10-05**.
  - `3400%` and `2100%` are Excel percent-format artefacts for 34% and 21%.
  - The rows are out of date order (Dec 5 before Dec 4).

### 6.2 CFI-G per-test tables

| | Normal Flames | Inverse Flames |
|---|---|---|
| Rows | 179 data rows × 18 cols | 154 data rows × 20 cols, **plus 861 trailing blank rows** |
| Test ID | `Test`, unique; spacing inconsistent (`21088A1` vs `21088 B1`) | unique; all with a space |
| Fuels (as written) | ethane 14, propane 20, 30% ethane 27, 30% propane 36, 30% butane 52, 50% butane 30 | ethane 53, propane 43, butane 58 (fuel is in the ambient) |
| Conditions | XO2 before/after (0.180–0.400), approx p (bar) {0.507, 0.944, 1.013, 2.027, 3.040}, Xf (0–1), mHC (mg/s) 0–3.215, Tad (K) 1397–2730, Zst 0.059–0.762 | Xf before/after (0.056–0.429), approx p (bar) 0.495–3.31, XO2 (burner) 0.12–0.85, HC burnrate (mg/s) 0.25–2.5, O2 flow (mg/s) 0.93–9.08, Tad 1567–2978, Zst 0.106–0.784 |
| Outcomes | Hot ignition Yes 132 / No 47; burn time (s) 0–304; `Self-ext or flow term` SE 102 / FT 31 / `-` 46; peak burner T (°C) 32–532 (`-` for 46); Cool flame? (8 rows); Comments (44) | Hot ignition Yes/yes 131, flash 8, No/no 15; burn time 0–152; SE 81 / FT 58 / `-` 15; peak burner T in °C (25.6–651.5) and K; Color (blue, yellow, Yellow-Blue, `limit`, `-`, …); Comments (39) |
| Instrument flag | TFP Yes 18 | TFP Yes 12 |

Anomalies:
- **Spreadsheet errors.** `#DIV/0!` in Tad and Zst for 21125A4 and 21125H3 (Xf = 0, mHC = 0, a no-fuel test).
  `#VALUE!` in peak burner temp (K) for 21242F4 and P2. **273.15 K** for 21265H3, whose °C cell is blank, so the 273.15
  is an artefact of converting an empty cell.
- **Inconsistent categories.** `Flame Type` is 'inverse'/'Inverse'. `Hot ignition` is Yes/yes/No/no/flash. Color has
  mixed case. **`limit` (29 rows) is an undefined colour value.**
- **Header whitespace.** ` XO2 before test`, `XO2  after test`, `Xf  before test`, `Self -ext or flow term`,
  `Peak burner T (C )`.
- **Burn time is censored.** FT means flow terminated (preset time, or "hit burner T limit"). Only SE rows give an
  extinction time. Using all burn times as extinction times would be wrong.
- **Blank burn time** for 21106F2, F5, H1 and H2. F2 and F5 are commented "direct cool - no hot ignition" (50% butane,
  ~0.5 bar). This **conflicts** with the report's statement that cool flames occurred only at 2.03 bar (p23, p44). The
  comment is unverified.
- **Counts do not reconcile exactly** with the report. Report Tables 1–2: 280 hot flames (normal 143, inverse 137).
  CSV: hot ignition yes = 132 normal, 131 inverse (+8 "flash"). Report: 189 radiative extinctions; CSV: SE = 183. The
  report counts "sustained or momentary hot flames ignited (or reignited)", so the definitions differ. Do not present the
  CSV totals as the official counts.
- **Units.** Rates are mg/s, p is bar, T is K or °C, burn time is s. X and Zst are dimensionless, but the
  **calculation method for Tad and Zst is not documented in the CSV**. "approx p" is explicitly approximate.

### 6.3 Flame Design per-test tables (conditions only)

| | Normal Flame | Inverse Flame |
|---|---|---|
| Rows | 207 × 15 | 120 × 14 |
| Fuels | C2H4 187, C3H8 20 (all on day 13, 21301) | C2H4 in ambient (XC2H4 0.080–0.658) |
| Columns | Xfuel, mfuel, mN2, mtot (mg/s), XO2 init/final, pinit/pfinal/pmean (**atm**), mean Zst, Tad (K) | XO2 (burner, 0.212–0.850), mO2, mN2, mtot (mg/s), XC2H4 init/final, p init/final/mean (atm, 0.43–3.03), mean Zst, Tad |
| Markers | `RAMP` 57 / `RAMPED` 3 (flow ramped; no single value) | `RAMP` 9, `LOW O2` 2 |
| Missing | XO2 final, pfinal, pmean blank for all 20 C3H8 rows | none |
| Outcomes | **none** (no ignition, burn time, extinction, size, soot) | **none** |

Anomalies:
- `Day` is 0-based in the normal table (0–13) and 1-based in the inverse table (1–8).
- Inverse test `22042M1` is labelled Day 6, but 22042 would be the 9th test day, and the final report Table 1 ends at
  22035.
- 207 CSV rows vs Table 1's 206 flames. The rows are test points (some ramped), not ignitions.
- **Pressure units differ between investigations:** atm here, bar in CFI-G.

### 6.4 Other structured files

- `ACME Gas flow.zip` workbooks are **conversion templates and calculators**. In `ACMEFlowAndPressuresRawDataConversion.xlsx`
  the RawData sheet says "Copy contents of xxx_data.csv here" and all derived cells show `#VALUE!`; the file has 24,576
  formatted rows but no data. `GasDataTables.xls` and `Inside gas mix calculator.xls` are vendor gas-property and
  correction-factor tables. **No measurements.**
- No TXT or JSON data files exist besides the ISA-Tab metadata.

---

## 7. Scientific variable audit (confirmed only)

| Variable | Investigation | File / column or table | Unit | Kind |
|---|---|---|---|---|
| Fuel identity / dilution | CFI-G | Normal CSV `Fuel`; Inverse CSV `Fuel` | — | condition |
| Ambient O2 mole fraction | CFI-G normal | ` XO2 before test`, `XO2  after test` | — (mole fraction) | condition (measured before/after; vitiates) |
| Burner O2 mole fraction | CFI-G inverse / FD inverse | `XO2` | — | condition |
| Fuel mole fraction | CFI-G, FD | `Xf`, `Xf  before/after test`; `Xfuel`; `XC2H4 initial/final` | — | condition |
| Pressure | CFI-G; FD | `approx p (bar)`; `pinit/pfinal/pmean (atm)` | bar; atm | condition |
| Mass flow rates | CFI-G; FD | `mHC (mg/s)`, `HC burnrate (mg/s)`, `O2 flow rate (mg/s)`; `mfuel`, `mN2`, `mO2`, `mtot (mg/s)` | mg/s | condition |
| Adiabatic flame temperature | CFI-G, FD | `Tad (K)` | K | **calculated** (method not stated in CSV) |
| Stoichiometric mixture fraction | CFI-G, FD | `Zst`, `mean Zst` | — | **calculated** |
| Hot ignition | CFI-G | `Hot ignition` | categorical | observed outcome |
| Burn time | CFI-G | `burn time (sec)` | s | observed; **censored when FT** |
| Termination mode | CFI-G | `Self-ext or flow term` (SE/FT/-) | categorical | observed outcome |
| Peak burner temperature | CFI-G | `Peak burner T (C )`; `Peak burner Temp (C)` / `(K)` | °C / K | measured (thermocouple) |
| Flame colour | CFI-G inverse | `Color` | categorical | observed (operator) |
| Cool-flame occurrence | CFI-G normal | `Cool flame?`, `Comments` | categorical / text | observed |
| Hot / cool flame radius, cool-flame duration | CFI-G | final report **Table 3** (p46) | mm; s | measured (images; radiometers for timing) |
| Flames ignited per day | BRE, CFI-G, FD | BRE CSV and Table 1; CFI-G Tables 1–2; FD Table 1 | count | log |
| Heat of combustion / gasification | BRE | final report figure captions (e.g. Fig. 6–10); Table 2 (literature) | kJ/g | derived (hc set, L inferred) / literature |
| Burner mass flux | BRE | Table 2 (p71), figure captions | g/m²·s | condition |
| Critical extinction temperature / mass flux | FD | final report p25–26 (abstract text) | K; g/m²·s | author result (not per-test) |
| 125 Hz channels (heat flux, radiometers, PMT, TC, MFC, pressure) | BRE (and ACME) | **dictionary only** (data interpretation p8; ACME-DOC-010 §8.1) | per ACME-DOC-010 | not on disk |

**Not found in any downloaded file:** per-test flame diameter (except the 15 cool-flame events), flame temperature
values, soot volume fraction, gas composition measurements, spectroscopy values, radiance values, extinction diameters,
time series of any kind, and simulation outputs.

---

## 8. Images, video and media

- **CFI-G representative image** (364×364 px). The file name says "Observation of non-premixed quasi-steady spherical
  cool flames on porous burners", but the image shows a bright, luminous yellow-white flame. The report's cool flames
  were imaged with an intensified camera, appeared only after a ~1 s non-luminous gap, and are shown converted to blue
  (p44–46, Fig. 2). **Do not present this image as a cool flame without a caption source.**
- **Flame Design images.** "Flame Stages" is a 3×3 composite of spherical flames from blue to sooty yellow. "In Space
  flame" shows a flame near a spherical burner with bright streaks. There is a hardware close-up (spherical porous burner
  and igniter) and an astronaut at the CIR. **None has a caption, conditions or test ID**, so all are illustrative only.
- **BRE videos.** 3 MP4 files (H.264/AAC, 720 px wide; 145.9 s, 45.8 s, 56.2 s). Names `wo662486_ACME_Urban*` (work
  order). **Content not viewed; test identity unknown.**
- No raw ACME images (`.hobj`/`.tif`) or analog video (`.ts`) were downloaded. The report appendices describe them.

---

## 9. Data quality and provenance

| | BRE (PSI-20) | CFI-G (PSI-159) | Flame Design (PSI-10) |
|---|---|---|---|
| Authenticity | PSI export + NASA GRC / UMD documents | PSI export + NASA/UMD final report | PSI export + NASA/WUSTL final report |
| Measured data on disk | none per test (day log only) | per-test outcomes + Table 3 | none (conditions only) |
| Missing units | O2 "percent" as text lists; pressure absent | Tad/Zst method; `limit` colour undefined | Tad/Zst method |
| Unclear abbreviations | — | TFP (Thin Filament Pyrometry, a flag), SE/FT, PCI-A…G (labels with no key in the folder) | RAMP/RAMPED, LOW O2 |
| Conflicting values | 2 CSV dates vs Table 1 | CSV counts vs report counts; "direct cool" comments vs report | 22042M1 day label; CSV rows vs Table 1 |
| Time formats | text month + date; YYDDD codes in reports | YYDDD in test IDs; `Day` index | YYDDD in IDs; 0- vs 1-based `Day` |
| Known measurement limits | radiometer saturation; uncalibrated ACME pressure transducers | intensified-camera gain (Table 3 footnote 3) | TFP misalignment (4 days), radiometer saturation, burner asymmetry, unsteady MFCs, unprocessed images |
| Status of results | "preliminary" (p1, p40) | "analysis … still underway" (p1) | "analysis … still underway"; papers in press (2023) |

**Source restrictions.**
- A full-text search of all 61 text-bearing PDFs found **no ITAR, EAR, SBU, CUI or limited-distribution marking**. Three
  hits were false positives: the author surname "Cui", and "a proprietary process was used for manufacturing the small
  burners" (ISRD p89), which describes manufacture and is not a document marking.
- The 4 drawing PDFs at the BRE root and the 305 drawings in the ZIPs are **image-only**, so their markings cannot be
  machine-checked. Two were rendered (s1101mfa0100 sheet 1, s1101mfd1252) and showed no visible notice, but the previous
  audit found an export-control notice on a CIR drawing. **Keep all drawings local and do not publish them.**
- `Hastings_HFC-D-302_manual.pdf` and `GasDataTables.xls` are **third-party vendor material**, and the dissertation is a
  university work. Cite them; do not redistribute.
- Representative images and videos carry no licence or caption locally. NASA imagery is generally usable with credit,
  but captions must be sourced.

---

## 10. Comparison with SpaceFire datasets

| Pair | Relationship | Classification |
|---|---|---|
| **CFI-G normal vs Flame Design normal** | Same ACME insert and stated shared burner type (CFI-G report p4). Same condition descriptors (X, ṁ, Tad, Zst). Different fuels (C2–C4 alkanes vs C2H4/C3H8) and different aims (cool flames vs soot and extinction) | **Directly valid for condition-space comparison** (after p bar↔atm conversion). **Outcome comparison not possible**, because FD outcomes are not on disk |
| CFI-G normal vs CFI-G inverse | Same apparatus, opposite reactant placement | Valid only when kept as separate groups; never pooled |
| CFI-G vs PSI-117 / FLEX (cool flames) | All observe cool flames in microgravity, but on gas-fed spheres vs liquid droplets. The CFI-G model explicitly borrows steady droplet-burning theory (report p23). FLEX droplet K (mm²/s) and extinction diameters have no CFI-G counterpart | **Qualitatively informative** (shared low-temperature-chemistry concept); quantitative comparison **unsupported** |
| CFI-G vs FLEX-2 | Shared NASA heritage: F.A. Williams is CFI-G Co-I and FLEX-2 PI; ACME instrument reports reuse a FLEX-2 report template (PDF metadata) | Context only |
| BRE vs BASS-II | BRE emulates *steady burning* of a flat material via gas flow; BASS-II measures *flame spread* over real solids (PMMA, SIBAL, …). BRE's "could represent PMMA" (p26) is an emulation analogy | **Qualitatively informative.** Merging BRE "burning" with BASS-II spread rates is **unsupported** |
| BRE vs SAFFIRE-I | Both relate to spacecraft fire safety (BRE tested exploration atmospheres such as 34% O2 at 8.2 psia) | Narrative only |
| BRE / FD vs SAME | SAME concerns pre-flaming smoke; BRE flames "quickly became non-sooty" (p20); FD soot data are absent | Unrelated quantitatively |
| ACME vs PSI-62 | PSI-62 models BASS flame spread | Unrelated |
| Any ACME data into the FLEX Ridge model | Different configuration, fuels, targets and definitions | **Unsupported. Do not do it** |

Shared words that do **not** mean shared quantities:
- "burn time" (CFI-G, censored) vs FLEX "Burn time".
- "burning rate" (BRE mass flux of an emulated fuel) vs FLEX burning-rate constant K (mm²/s).
- "extinction" (radiative extinction of spherical gas flames) vs FLEX droplet extinction diameter.
- "flame diameter" (CFI-G Table 3 radii, mm) vs FLEX flame-diameter histories.

---

## 11. Required final assessment

| Investigation | Actual PSI ID | Structured measurements | Reports | Images/video | Data quality | Integration readiness |
|---|---|---|---|---|---|---|
| ACME BRE | PSI-20 | None per test. 18-row day log (conditions + flame counts; 2 date errors) | Final report (181 p), dissertation (171 p), data interpretation (33 p), SRDs, ISRD/SORD, many ACME-wide docs | 3 outreach images; 3 MP4 (content unverified) | Good documents; log needs correction from Table 1; 4 damaged drawing ZIPs | **RAG/documentation only**; requires per-test data for analysis |
| ACME CFI-G | PSI-159 | **333 test points** with conditions + observed outcomes; **Table 3: 15 cool-flame events with radii** | Final report (93 p), engineering report | 1 image (caption mismatch) | Usable with cleaning: spreadsheet errors, censoring, label inconsistencies, count mismatches | **Ready after targeted processing** |
| ACME Flame Design | PSI-10 | **Conditions only** (327 test points); no outcomes | Final report (109 p), SRD, Task Book reports, ISRD/SORD | 4 uncaptioned images | Clean conditions; known instrument issues; results only in abstracts | **RAG/documentation only** (conditions usable as context); requires additional data for analysis |

1. **Most reusable scientific data:** **CFI-G.** It is the only download with per-test observed outcomes, and its
   Table 3 has measured flame radii.
2. **Best for a new gaseous-flame page:** **CFI-G**, with Flame Design as context (same apparatus, condition space and
   author findings). BRE belongs with fire-safety and flammability content, not on a spherical-flame page.
3. **Strongest evidence for an interactive 3D model:** **CFI-G Table 3.** It measures hot- and cool-flame radii (12.4–17.7
   mm and 5.1–7.6 mm) for one condition set. Flame Design documents the spherical geometry and growth-to-extinction
   physics only in prose. Neither supports a general predictive 3D flame.
4. **Best for Research Copilot:** **BRE** for spacecraft fire-safety questions (largest and most detailed documents).
   **Flame Design** and **CFI-G** final reports for gas-flame physics. All three add value; BRE is the largest corpus.
5. **Direct comparisons:**
   - CFI-G normal vs Flame Design normal **conditions** (with unit conversion).
   - Within CFI-G across fuels, pressures and XO2, keeping normal and inverse separate.
   - BRE days vs Table 1.
6. **Unsafe comparisons:**
   - BRE emulated burning vs BASS-II spread rates or real material data.
   - Any ACME quantity vs FLEX K or extinction diameters.
   - CFI-G burn time as extinction time without separating SE and FT.
   - Pooling normal and inverse flames.
   - Using Flame Design conditions as if they were outcomes.
   - Feeding any ACME data into the FLEX Ridge model.
7. **Worth downloading later:** see `ACME_DATASET_DOWNLOAD_GAPS.md`. In brief: a few representative per-test
   non-imaging CSVs (file pattern `<test>_data.csv`, e.g. `19039A1_data.csv`, which is confirmed in the BRE data
   interpretation p8); Flame Design outcomes (a data-interpretation document or analyzed table, if PSI has one); the
   CFI-G and Flame Design papers.
8. **One shared ACME page or separate pages?** One shared **"Gaseous spherical flames (ACME CFI-G + Flame Design)"**
   section inside the existing Scientific Analysis area, with clearly separated tabs. **BRE should not get its own page
   yet.** Its content goes to RAG plus a fire-safety explainer. The roadmap has details.
9. **Minimum scientifically defensible integration:** ingest the 3 final reports, BRE data interpretation, Flame Design
   SRD and the 3 metadata files into RAG with correct PSI IDs. Add investigation and publication metadata. Curate CFI-G
   Table 3 and the three flames-per-day tables. **No charts, models or 3D in the first step.**
10. **What to prioritize after the previous audit:** a combined RAG/metadata batch first (PSI-117 PDFs, SAME report,
    FLEX-2 SRD and the ACME documents above). Then curated tables (SAME Table 1 / Appendix A, CFI-G Table 3, BRE Table 1).
    Then one analysis page built on the CFI-G per-test table. PSI-117 figure data and SAME telemetry come later. See the
    roadmap.

---

## 12. Limitations

- No OCR. 309 drawings, the outreach posters and the FLEX article were not machine-read.
- 71 drawings are unreadable because 4 archives are damaged downloads.
- Videos were not viewed (headers only). Representative images have no captions.
- The PDF text-search for restriction markings cannot see image-only pages.
- Figures (flammability maps, TFP histories, radiant heat flux) were not digitized.
- Tad/Zst calculation methods, the meaning of `limit` and PCI-A…G, and the CFI-G "direct cool" comments could not be
  verified locally.
- Report-vs-CSV count differences were documented but not resolved.
- No internet was used, so publication availability and PSI file listings were not checked.

## Appendix: method and safety

- Read-only inspection with the project venv (Python 3.13: pymupdf, openpyxl, python-docx) plus `xlrd`/`olefile`
  from a scratch library directory outside the repo. Scripts ran with `python -I` and took paths as arguments.
- Extraction was limited to 25 small files in `dataset_audit_work/acme/`, deleted after the audit. Thumbnails and
  embedded images were written only to the session scratch folder.
- Original files were checked unchanged by SHA-256 before and after (see the roadmap's validation note).
- No server was started, no model was trained, no database was written and no Gemini request was made.

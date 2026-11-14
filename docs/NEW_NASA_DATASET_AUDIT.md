# New NASA Dataset Audit (2026-11-14)

Audit only. Nothing here is integrated into SpaceFire AI. No frontend, backend, database, model or source file was
changed. No Gemini or other paid API was called, and nothing was downloaded.

Companion files:
- `docs/NEW_NASA_DATASET_INVENTORY.csv`: one row per file and per archive member (154 rows), with category,
  inspection status, duplicates and notes. Regenerate with `python -I research/scripts/new_dataset_inventory.py`.
- `docs/NEW_NASA_DATASET_INTEGRATION_MATRIX.md`: datasets × SpaceFire features, with the supporting file for each cell.
- `docs/NEW_NASA_DATASET_DOWNLOAD_GAPS.md`: the few missing files worth downloading later.

Page references use the **PDF page index** (1-based) unless "printed p." is stated.

---

## 1. Executive summary

**The four folders are not the four investigations that were expected.** Two of them are:

| Expected | Found on disk | Verified identity (from the ISA-Tab metadata inside each folder) |
|---|---|---|
| PSI-117 cool-flame CFD | `PSI-117/` | **PSI-117**, as expected |
| PSI-62 flame-spread FGM | `PSI-62/` | **PSI-62**, as expected, but the folder holds **only the 9.7 KB metadata ZIP** |
| PSI-159 ACME CFI-G | *not present* | `FLEX-2/` is **PSI-68, Flame Extinguishment Experiment-2** |
| PSI-10 ACME Flame Design | *not present* | `SAME/` is **PSI-102, Smoke Aerosol Measurement Experiment** |

No ACME data (PSI-159 or PSI-10) exists anywhere in the workspace. Nothing in this audit says anything about ACME.

What each folder can support today:

1. **PSI-117 (cool flames, ground investigation).** This is the most useful folder for SpaceFire. It has 9 small CSVs of
   figure data that put **experimental droplet data next to model predictions**: droplet d², flame diameter, radiance,
   burning rate, hot- and cool-flame extinction diameters, and pressure trends for n-heptane, n-decane and n-dodecane. It
   also has 4 presentations and a 227-page dissertation. It is ready for RAG now. It is ready for scientific analysis
   only if the data are labelled carefully: the experimental points look plot-digitized, some units are implied rather
   than stated, and nothing links them to SpaceFire's FLEX rows. **It contains no CFD fields and no OpenFOAM cases.** The
   model shown in the slides is a 1-D sphero-symmetric droplet model. The PSI metadata describes a 3-D OpenFOAM study,
   but no file in the download confirms it.
2. **SAME (PSI-102, ISS flight experiment, 2007).** This is the largest folder and the best new source of measured
   flight data. Its 59 "Analyzed data" workbooks are mostly **1 Hz housekeeping telemetry exported from the flight
   hardware**: smoke-detector volts, P-Trak particle counts, DustTrak mass concentration, flows, temperatures and heater
   resistance. Analyst averaging sheets sit alongside. The Final Science Report has a **clean 8-row particle-size results
   table** and a **47-test flight log** (Appendix A) that can be transcribed. SAME studies smoke from overheated materials
   **before flaming**, which is a new fire-safety topic for SpaceFire (detection), not flame spread. It needs careful
   processing: the folder names do not reliably give the material, and there are sentinel values, mixed time bases and
   one workbook with an inconsistent date.
3. **FLEX-2 (PSI-68, ISS flight experiment).** Documentation only. It has a science requirements document, a test-matrix
   envelope CSV with condition ranges and no results, hardware drawings, and a hardware presentation. One PDF duplicates
   a file already in SpaceFire. Useful for RAG and for explaining what FLEX-2 changed relative to FLEX. **No
   measurements.**
4. **PSI-62 (flame-spread modeling, ground investigation).** **Metadata only.** It points to BASS/BASS-II and to an
   Olson & Ferkul (2017) paper that SpaceFire already lists under BASS-II. Nothing in it can be analysed yet.

Recommended order: **PSI-117 → SAME → FLEX-2 → PSI-62.** See §12.

---

## 2. Actual datasets found

The search was limited to `D:\NASA Hackathon`. The four untracked top-level folders in the git status are the new
downloads. The existing `FLEX/`, `BASS-II/` and `SAFFIRE-1/` source folders, `download.zip` and
`PSI-98_metadata_PSI-166_SAFFIRE-I.zip` belong to the current app and were only read for comparison.
`NASAChallenge202611.pptx` and `run.txt` are user files and were not opened.

| Folder | PSI ID | Verified title | Type (metadata `Comment[Project Type]`) | Files | Size | Archives |
|---|---|---|---|---:|---:|---:|
| `FLEX-2/` | PSI-68 | Flame Extinguishment Experiment - 2 | Microgravity Investigation (ISS, CIR/MDCA) | 12 | 10,316,095 B (9.8 MiB) | 1 |
| `PSI-117/` | PSI-117 | Effect of External Thermo-Convective Perturbation on Cool Flame Dynamics: A Multidimensional Multi-Physics CFD Analysis | Ground Investigation | 16 | 70,820,870 B (67.5 MiB) | 1 |
| `PSI-62/` | PSI-62 | Concurrent Flame Spread Modeling using Flamelet Generated Manifolds in Microgravity with Comparison to BASS Experiments using Two-Color Tomography | Ground Investigation | 1 | 9,694 B | 1 |
| `SAME/` | PSI-102 | Smoke and Aerosol Measurement Experiment | Microgravity Investigation (ISS, MSG) | 99 | 654,832,475 B (624.5 MiB) | 4 |
| **Total** | | | | **128** | **735,979,134 B (701.9 MiB)** | **7** |

Folder-name differences: `FLEX-2/` and `SAME/` use the acronym, not the PSI number. The metadata ZIP inside each one
names the PSI study (`PSI-68_metadata_PSI-132_FLEX-2.zip`, `PSI-102_metadata_PSI-170_SAME.zip`). The ISA-Tab
`Study Identifier` confirms PSI-68 and PSI-102.

SoFIE was not downloaded and is not required. Raw Data and Calibration collections were deliberately not downloaded.
Their absence is not counted as a defect.

---

## 3. Source verification

Each folder contains a NASA PSI ISA-Tab metadata export (`i_Investigation.txt` plus a placeholder `s_PSI-*.txt` whose
only row is "Do not use this"). Values below are quoted from those files.

| | PSI-68 FLEX-2 | PSI-117 | PSI-62 | PSI-102 SAME |
|---|---|---|---|---|
| PSI DOI | 10.60555/byp8-h018 | 10.60555/gz0q-b577 | 10.60555/e9xp-ex83 | 10.60555/gd4k-8h62 |
| Dates | 2016-08-12 → 2019-09-30 | 2017-02-15 → 2022-02-14 | 2019-05-01 → 2021-04-30 | 2001-03-02 → 2008-02-28 |
| PSI public release | 30-Sep-2019 | 10-Jun-2026 | 14-Nov-2025 | 18-Sep-2024 |
| PI | Forman A. Williams (UCSD) | Tanvir Farouk (Univ. South Carolina) | Paul DesJardin (Univ. at Buffalo; metadata says "New York University, Buffalo") | David Urban (NASA GRC) |
| Project scientist | Michael Hicks (GRC) | Mike Hicks (GRC) | David Urban (GRC) | Claire Fortenberry (GRC) |
| Platform | ISS, CIR + MDCA | none (ground) | none (ground) | ISS, Microgravity Science Glovebox |
| Funding | NNX16AR09A | NNX17AF97A | 80NSSC20K0426 | IH1013215 |
| Publications listed | 51 | 10 (4 with DOI) | 4 | 16 |

Authenticity: all files sit in PSI-style folders with PSI file-name prefixes, and the documents carry consistent NASA
GRC / ZIN Technologies / university authorship. No file was byte-identical to another anywhere in the
four folders or the existing sources (SHA-256 over every file). Hashes are in the inventory CSV.

Provenance gaps:
- `PSI-117/Analyzed data/..._ReadMe_List_of_Data.xlsx` cites two sources that are **not** in the PSI-117 publication
  list: `10.1016/j.proci.2018.09.015` (Three_Stage) and `10.1007/s12217-024-10115-x` (four MST_2024 files). They may
  be real. They are simply not cross-listed in the local metadata and were not checked online (no internet use).
- None of the PSI-117 CSVs records units in a separate row. Units appear only in some headers.

---

## 4. File inventory

The full list is in `docs/NEW_NASA_DATASET_INVENTORY.csv`. Formats across the 128 files: 55 XLS, 38 PDF, 11 CSV, 7 XLSX,
7 ZIP, 4 PPT, 2 PPTX, 2 MP4, 1 DOCX, 1 DOC.

### 4.1 Archives and extraction

| Archive | Entries | Uncompressed | Ratio | Safety checks | Action |
|---|---:|---:|---:|---|---|
| 4 × `*_metadata_*.zip` | 2 each | 9.5–23.9 KB | 1.0 | no traversal, no symlinks | Extracted to `dataset_audit_work/` (8 small TXT files), read, then deleted with the workspace |
| `SAME/SAME OPS images.zip` | 16 JPEG | 25.3 MB | 1.01 | clean | **Not extracted.** Headers read in-stream; 2 images rendered as thumbnails in a temp folder |
| `SAME/TN001.zip` | 1 AVI | 247.6 MB | 1.47 | clean | **Not extracted** (large raw video). AVI header read in-stream |
| `SAME/TN002.zip` | 1 AVI | 230.2 MB | 1.65 | clean | **Not extracted.** AVI header read in-stream |

No nested archives. No 7z/tar files. Originals were opened read-only.

### 4.2 Classification by actual content

The "Analyzed data" label assigned by PSI was checked against what the files actually contain:

| Category | FLEX-2 | PSI-117 | PSI-62 | SAME |
|---|---|---|---|---|
| Raw Data | — | — | — | 52 workbooks with full 98/99-column 1 Hz flight housekeeping exports; 6 flight command/event logs; 1 workbook with both; 2 DV AVI videos (zipped) |
| Analyzed Data | — | 7 figure-data CSVs (experiment + model) | — | analyst "for average" / "for graphing" sheets inside the same workbooks |
| Calibration | — | — | — | `SAME_Wire_Test.xls` (ignitor-wire R vs T; engineering, not instrument calibration) |
| Metadata | ISA-Tab, DoD.docx, test-matrix CSV | ISA-Tab, ReadMe xlsx | ISA-Tab only | ISA-Tab, planned test-matrix CSV |
| Scientific reports | SRD (two exports) | PhD dissertation | — | Final Science Report (+4 papers) |
| Publications / presentations | — | 4 slide decks | — | ICES 2005 paper, 2 PPTX, 3 legacy PPT |
| Figures and images | — | — | — | 16 JPEG (ISS015 crew photos + cue card), 2 MP4 |
| Simulation / CFD output | — | 2 model-only CSVs, plus model series inside the 7 mixed CSVs (1-D model, not CFD fields) | — | — |
| Code / configuration | — | — | — | — (logs name `/config/test_matrices/same_test_N.txt`, but those files are not included) |
| Other (engineering) | 5 drawings, ERD, hardware PPT | — | — | 15 drawings, EIRD, VPERD + matrix, 5 project docs, wire report |

Duplicates (verified):
- `FLEX-2/FLEX-2 Engineering Requirments Document.pdf` has text identical to the existing
  `FLEX/FLEX Engineering Requirements Document.pdf` (37 pages; the bytes differ). SpaceFire's earlier inventory had
  already flagged that FLEX file as really the FLEX-2 ERD.
- `FLEX-2/FLEX-2 SRD Final _ No Hypertext.pdf` is a second export of the SRD with garbled figure text on 16 pages. Use
  `FLEX-2 SRD Final.pdf`.
- `SAME/.../GMT264 Run 21 DBP.xls` and `GMT264 Run 22 DBP.xls` have cell-identical housekeeping sheets with swapped names.
- `Run 2 GMT254 testlog.xlsx` and `... testlog b.xlsx` contain the same 309-row log.
- Several SAME workbooks contain overlapping copies of the same day's export (for example, GMT255 appears in the DBP and
  Silicone folders; GMT257 appears in the DBP and Teflon folders).

Files that could not be fully read:
- 21 engineering drawings (5 FLEX-2, 16 SAME) are image-only one-page PDFs with no text layer. They were not OCRed;
  2 were checked visually.
- Legacy binary `.ppt` (4) and `.doc` (1) were read by OLE string recovery. The text is partial, and tables and figures
  were not recovered.
- The video content of the MP4/AVI files was not viewed. Only container headers were read.

---

## 5. Scientific content

### 5.1 PSI-117: cool-flame dynamics (ground, modeling + reuse of flight data)

- **Question.** How do external thermal and convective perturbations control droplet cool-flame ignition, oscillation,
  transition to hot ignition, and extinction in microgravity? (metadata `Comment[Objective]`, `Comment[Hypothesis]`)
- **Nature.** Ground investigation. Numerical modeling validated against ISS FLEX data. *The model shown in the
  documents* is "Isolated sphero-symmetric droplet combustion model" (dissertation ch. 2, PDF p11). The slides show a
  1-D radial formulation with droplet-surface regression, a fiber sub-model and radiation (Extinction slides p7;
  Oscillatory slides p4; Three-Stage slides p6). The metadata `Comment[Approach]` describes a 3-D OpenFOAM model with
  drift/heat-flux forcing and stability maps. **No 3-D/OpenFOAM output, case, mesh, boundary-condition file or
  stability map is in the download**. A full-text count found zero mentions of "OpenFOAM" or "3-D" in the 5 PDFs. The
  only multidimensional model shown is a 2-D model of a *counterflow* DME cool diffusion flame with and without buoyancy
  (PSI seminar slides p28–29), which is not a droplet configuration.
- **Physical system.** Isolated, fiber-supported n-alkane droplets (n-heptane, n-decane, n-dodecane). Large droplets
  are 2–7 mm (FLEX scale); sub-millimetre droplets are 0.5 mm (model only, ozone-assisted). Gases are air, O2/N2/He and
  O2/N2/O3. Pressure is 0.5–5 atm. Microgravity.
- **Observations present in the files** (see §6): droplet diameter and d², flame diameter, cool-flame diameter (HWFM and
  peak-to-peak), flame radiance (W), average burning rate, hot- and cool-flame extinction diameters vs d0 and pressure.
  Model-only: peak temperature, positions of the temperature and OH peaks, instantaneous burning rate.
- **Link to FLEX.** "FLEX 1268: n-dodecane, 2.75 atm, 21.6% O2, 50.2% N2, 28.2% He" (Three-Stage slides p15–16, p21);
  "FLEX 1256: n-dodecane, 3.00 atm, 21.0% O2, 79.0% N2, Do ~ 4.2 mm" (p21–22); "ISS FLEX 563 test" (methanol with 63%
  xenon; dissertation p15, p65, which also states "No additional data processing for the experimental data is
  performed"). "Models were validated against the FLEX data" (PSI seminar slides p31).
- **Reported values in text** (Extinction slides p9, 1 atm air): Experiment vs Model pairs for d_ext HF/CF and Kavg
  HF/CF. For example, Experiment d_ext HF = 3.41 mm and CF = 1.13 mm, Kavg HF = 0.46 and CF = 0.38 mm²/s. The slide
  does not say which fuel each panel shows, so these values were **not** reconciled with the CSV rows.

### 5.2 SAME (PSI-102): smoke from overheated spacecraft materials (ISS flight)

- **Question.** Does low gravity change the size distribution of smoke particulate from overheated (pre-flaming)
  spacecraft materials, and how do the Space Shuttle (ionization) and ISS (light-scattering) detectors respond?
  (metadata `Comment[Hypothesis]`; Final report abstract, p3)
- **Nature.** ISS flight experiment in the MSG, 2007 (GMT days 252–278; Expedition 15). It was followed by ground
  comparison tests. The 2012/2013 ICES decks cover a later **SAME-2** reflight whose data are **not** in this download.
- **System.** Samples are Teflon, Kapton, silicone rubber, cellulose lamp wick, and dibutyl phthalate (DBP) on a wick.
  Pyrell appears only in SAME-2 material. Each sample is heated by a wire coil with no flaming. Smoke passes through a
  flow duct and aging chamber (piston), then a dilution stage, to the instruments. Instruments: TSI P-Trak (0th moment:
  number), ionization detector (1st moment), two DustTraks with 1 µm and 10 µm cutoffs (3rd moment: mass), the STS and
  ISS smoke detectors, and thermal precipitators for TEM grids. Measured particle size is derived with the
  **moment method**, assuming a log-normal distribution (Final report pp. 15–19).
- **Key results** (Final report Table 1, printed p17 / PDF p27; identical in SAE 2009-01-2468 Table 1, PDF p39). Smoke
  aged 720 s:

  | Material | Geom. mean diam. (nm) | Arithmetic mean diam. (nm) | Diam. of average mass (nm) | σg |
  |---|---:|---:|---:|---:|
  | Kapton | 80 | 105 | 179 | 2.08 |
  | Kapton aged | 155 | 186 | 267 | 1.82 |
  | Lamp wick | 186 | 227 | 341 | 1.89 |
  | Lamp wick aged | 258 | 308 | 438 | 1.81 |
  | Silicone | 189 | 257 | 472 | 2.18 |
  | Silicone aged | 352 | 422 | 606 | 1.83 |
  | Teflon | 170 | 205 | 297 | 1.84 |
  | Teflon aged | 228 | 273 | 392 | 1.82 |

  (Values transcribed for this audit only. They are not added to any database.)
- **The same quantities differ between documents.** Each value must keep its own source:
  - AIAA "Properties of Smoke…" Table 1 (PDF p48): diameters in µm. Silicone moments are "N/A", and DAM for Teflon is
    0.219 µm (Table 1 above: 297 nm).
  - SAE 2008-01-2089 Table 1 (PDF p57): count mean diameter Teflon 158 nm, with DustTrak B/A ratios.
  - AIAA "Spacecraft Fire Detection…" Table 1 (PDF p64): count mean diameter Teflon 223 nm, with "% larger than 1-g"
    (the Teflon cell is blank).
  - ICES 2012 slide 24, "SAME-1&2 Results": for example, Teflon unaged CMD is 0.111 µm, plus Pyrell rows.
  These are successive analyses and different flights. They are not contradictions to "fix".
- **Conclusions as stated:** particle sizes are 100–600 nm and grow with aging and with reduced air flow. For lamp wick
  and silicone, about 40% of the mass is above 1 µm. The ISS detector performed worse for Kapton and Teflon (ICES 2013
  slides 27–28; Final report p28). TEM grids were contaminated (Final report p28).

### 5.3 FLEX-2 (PSI-68): droplet combustion, second campaign (ISS flight; documentation only)

- **Question.** Extend FLEX-1 to bi-component fuels, surrogate and practical fuels, sub-buoyant convective flow, and
  binary droplet arrays. Produce benchmark data for model validation (metadata `Comment[Objective]`; Hardware
  Presentation text).
- **Content.** SRD Rev.1 (68 p): Table 1 fuel properties (p25), Table 2 test-matrix envelope (p33), Table 3 estimated
  tests (p33), Table 4 science data end products (p34), Table 5–6 hardware and diagnostic requirements (p37, p45).
  `FLEX-2 DoD.docx` says the PSI investigation has **40 Experiment Data records**, with Raw Data as `.txt` per test point
  and images as `.zip`. None of these were downloaded.
- **Test-matrix inconsistency.** The PSI test-matrix CSV lists pure iso-octane, n-octane, heptane, decane and ethanol,
  plus propanol/glycerol (95/5 and 80/20) and heptane/iso-octane 50/50. SRD Table 2 lists pure n-decane and ethanol plus
  four mixtures, including n-heptane/n-hexadecane and n-decane/n-propylbenzene. The CSV has the same ranges in every
  row, so it describes an envelope, not executed tests.
- **Drawing note.** `67212MFAN11000-4 FLEX-2 Package Assembly.pdf` is titled "HIBMS PACKAGE ASSEMBLY" (the CIR imaging
  package) and carries an export-control notice. The other drawings were not inspected visually. **Do not publish any
  of the drawings in the app or the repo.**

### 5.4 PSI-62: concurrent flame spread with flamelet generated manifolds (ground; metadata only)

- **Question.** Can an unsteady FGM (UFGM) model reproduce concurrent flame spread in microgravity, including the
  "Goldilocks" flammability zone, using BASS/BASS-II imagery processed by two-color tomography? (metadata `Approach`,
  `Hypothesis`, `Objective`)
- **Geometries named.** Flat sheets, spheres and PMMA rods, plus wax cylinders.
- **Publications.** Olson & Ferkul 2017 (PMMA rods, axial stagnation flow; this DOI is already in SpaceFire under
  PSI-25 BASS-II). Budzinski & DesJardin 2023 (two papers, Combust. Flame). Aphale & DesJardin (two-color pyrometry,
  Combust. Flame 2021).
- **Nothing else downloaded.** No image series, tomography reconstructions, model outputs, validation tables or
  uncertainty data. Per §12 Case D: **metadata only**.

---

## 6. Structured data profiling

Method: Python standard `csv` for the CSVs, with encoding and delimiter detected and BOM noted. Each sheet's column
blocks were split at fully empty separator columns. Spreadsheets were read with `openpyxl` (xlsx) and `xlrd` 2.0.2
(xls), one workbook at a time, from a scratch library path rather than the project venv. Every sheet of every workbook
was profiled. Statistics are over non-empty numeric cells. No value was modified.

### 6.1 PSI-117 CSVs: figure-style data

Shared traits: UTF-8 with BOM (8 files) or ASCII (Kavg), comma-delimited. Each file holds several **independent
side-by-side series** separated by empty columns, with **different lengths**. A "row" therefore has no meaning across
blocks. Series labels such as `EXP`, `Expt`, `Model`, `Sim` and condition notes (`1 atm`, `do 4 mm`) sit inside data
cells. There is no primary key. Conditions (fuel, d0, P, composition) come from the ReadMe, not from the files.

| File (prefix `PSI-117_Analyzed Data_`) | Rows × cols | Series (n points) | Variables and units as written | Issues |
|---|---|---|---|---|
| `MST_2024_Burning_history_Flame_diameter` | 683 × 20 | EXP d² (66), EXP flame diam. (119), EXP Q ×2 (83, 63); Model d²+dflame (409); Model radiance (683) | t (s implied), d² (mm²), dflame (mm), Q (W) | The two EXP `Q (W)` series are unlabeled. EXP dflame time is non-monotonic (digitized). Model time is rounded to 0.01 s, so 36 repeated t values carry different Q. Model dflame starts at 79.7 mm (initial-condition artefact). 15 identical composite rows |
| `MST_2024_Dext` | 9 × 8 | Model (5), Expt (9) | Pressure (atm implied), Dext_cool, Dext_hot (mm implied) | Units absent. Model Dext_cool = 0 at 3 atm (meaning undefined) |
| `MST_2024_Kavg` | 19 × 7 | Expt (19), Model (6) | Pressure, `Kavg_CF` (no unit), `kb (mm2/s)` | Different names for the experimental and model rates (`Kavg_CF` vs `kb`). 2 exact duplicate (P, K) pairs in Expt |
| `MST_2024_Radiance_Flame_Diameter` | 683 × 40 | Expt 0.5 atm (d0 4.46 mm): radiance 39, df 18. Expt 5 atm (d0 4.48 mm): radiance 42, df 65. Sim radiance, Dflame, T_max at 0.5 and 5 atm (328–683) | time (s), Radiance/Q (W), df/Dflame (mm), T_max (K) 426–2775 | Sim Dflame starts at 100.35 mm and T_max at 2400 K (ignition initialization, not physical). One Expt time series is non-monotonic |
| `PROCI_2019_Oscillatory_Cool_Flame` | 640 × 7 | **Model only** | Time(sec) 0–1.03, Diameter(mm) 0.5→0.0047, K(mm²/s) −0.244…0.293, T_max(K) 600–1150, D_Tmax/D_drop, D_OHm/D_drop up to 3292, (D/Do)² | 73 negative K (swelling phase, physically possible). Sub-mm, ozone-assisted: not a FLEX condition |
| `PROCI_2019_Stable_Cool` | 243 × 7 | **Model only** | as above, 0–0.81 s | as above (85 negative K) |
| `PROCI_2023_Alkane_Extinction_Diameter_1atm` | 6 × 29 | C7 Expt 5, Sim 6. C10 Expt 6, Sim 6. C12 Expt 4, Sim 6 | Do, Dext_HF, Dext_CF (mm implied) | Units absent. Zeros in Sim rows (Do = 2–3 mm) and C12 Expt Dext_CF (2 rows) are undefined: they could mean "not observed" or "no extinction" |
| `PROCI_2023_C12_Extinction_Diameter_vs_pressure` | 6 × 17 | Dext_HF Expt/Model (5/5), Dext_CF Expt (6)/Model (5), ErrorBar+ (5), ErrorBar− (5) | P (atm), diameters (mm implied) | Error bars use the **model** pressure grid (1.25 and 3 atm), not the Expt rows (which include P = 1 twice). It is undefined whether they are bounds or deltas. **Do not attach them to points without the paper** |
| `PROCI_C12_2019_Three_Stage` | 571 × 44 | EXPT: (D/Do)² 205, Dflame/Do 137, Dflame 93, Radiance I 363, Radiance II 224, cool-flame diam. HWFM 118 and peak-to-peak 158. Simulation: t, D, K, T_max, … 570. Normalized sim 570. Sim radiance 72 | t/(Do)² (s/mm²), (D/Do)², Dflame (mm), radiance (W), K (mm²/s), T_max (K) | **Digitization artefacts:** negative t/Do² (pre-ignition) and negative diameters (−0.158 Dflame/Do; −0.053 mm; −0.121 cool-flame diameter). Condition per ReadMe: n-dodecane, 4.5 mm, 2.75 atm, XO2 0.21 / XN2 0.50 / XHe 0.29. Slides p15 give 21.6/50.2/28.2% (FLEX 1268) |

`..._ReadMe_List_of_Data.xlsx` has one visible sheet, 16 × 11, and maps file → fuel, d0, P, composition, reference. Its
composition cells are inconsistent. For the two PROCI_2019 rows, XO2 is a fraction (0.21, 0.10), XN2 is 74 and 85
(apparently percent), and the third column is headed `XO3` with the value "Balance". The PSI seminar slide p24 gives
"Do = 0.5 mm XO2 = 10% XO3 = 5% XN2 = Balance". **Left as found.** Interpretation needs the source paper.

### 6.2 SAME workbooks: flight telemetry

59 workbooks with 122 sheets in total (all sheets visible; no hidden sheets), profiled one at a time:

| Material folder | Workbooks | Sheets | Full 98/99-col exports | "for average" | graph/reduced | logs | Rows (all sheets) | GMT days seen |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| Cotton Lamp wick | 8 | 14 | 4 | 2 | 7 | 1 | 31,320 | 256, 264, 272, 273, 278 |
| Dibutyl Phthalate | 29 | 66 | 20 | 17 | 25 | 4 | 142,219 | 253–257, 262–264, 276–278 |
| Kapton | 6 | 10 | 2 | 2 | 6 | 0 | 23,734 | 254*, 263, 271, 272 |
| Silicone | 10 | 21 | 8 | 3 | 8 | 2 | 62,833 | 252, 255, 267, 269, 276 |
| Teflon | 6 | 11 | 3 | 2 | 6 | 0 | 22,585 | 257, 262, 267–269 |

\*See anomaly 3 below.

- **Columns (full export, 98 columns).** `TimeString` (`YYYY/DDD/HH:MM:SS`), `Time`, the five detector channels in volts
  (`ISSDetectorObscuration`, `ISSDetectorScatter`, `STSDetector`, `IonDetectorA`, `IonDetectorB`),
  `PTrakMeasurement(PtPerCC)`, `DustTrakA/B Measurement(MgPerM3)`, DustTrak analog volts, `GasPlumeTemperature(DegC)`,
  `SampleResistance(Ohms)`, MFC flow (LPM), set point, temperature and pressure, LFE flow (SCCM), GN2/vacuum/drive/sample
  pressures (PSIA/PSIG), thermal-precipitator channels, and state flags (`TestNumber`, `SampleNumber`, `RunMode`,
  `TestRunning`, `HeatingInProgress`, …). **Units are written in every header.**
- **Ranges across full exports (n ≈ 114,000 per channel):** detector volts −10.0 to 7.30; P-Trak −999 to 500,000
  pt/cc; DustTrak −0.01 to 194.4 mg/m³; plume temperature 21.6–138.7 °C; MFC flow 0–8.46 LPM; sample resistance
  0–6.19 Ω.
- **Sentinel and suspicious values.** −10.0 V on the detector channels and −999 on P-Trak are probably no-data
  sentinels. 500,000 pt/cc is probably P-Trak saturation. −0.01 mg/m³ on DustTrak is probably an offset. The raw ISS
  scatter channel is ≤ 0 V throughout, and the analyst blocks flip its sign (e.g. −0.192566 → 0.192566 in
  `GMT262 RUN 13 teflon.xls`). The analyst P-Trak column is relabeled `/1000`. **None of these are documented in the
  folder.** They must be confirmed before any statistics are computed.
- **Time base is inconsistent.** In some workbooks `Time` is Unix epoch seconds (1190225648 = 2007-262 18:14:08 UTC,
  matching `TimeString`). In others it is elapsed seconds from 0. `TimeString` is the reliable key.
- **Derived values.** "for average" sheets end in an `average` row and an "Ion V0" baseline row. These are analyst
  windows, and the windows are not documented apart from their timestamps.

Anomalies (details in the inventory notes):
1. **Folders do not reliably identify the material.** `Cotton Lamp wick/GMT256HKP.xls` covers 13:51–15:40. The GMT256
   log shows a **Teflon** test (13:54–14:37) before the lamp-wick test (15:16–15:33). Assign the material by matching the
   time window against the log or Appendix A.
2. **Two test numberings.** The flight log uses test-matrix files (`same_test_4.txt`, `same_test_998.txt`). The Final
   Report Appendix A numbers tests 1–47. A crosswalk is possible from GMT and time, but it is not in the files.
3. `Kapton/kaptonGMT257*.xls` has `TimeString` on day **254**, but its file name and Appendix A (test 8, Kapton, GMT 257,
   "run abort because of high Rt/Ro") say 257. Its values do not match the GMT254 DBP export at the same timestamps.
   **Day assignment unresolved.**
4. Sheet names often disagree with content (`GMT267silicon24hkp.xls` → sheet `GMT267silicon23hkp`, spanning tests 23 and
   24; `GMT264dbptest19and20hkp.xls` → sheet `GMT264dbptest18hkp`). Some exports have trailing rows with empty
   instrument cells.

Logs (6 workbooks, plus one sheet in `GMT254HKPandLOGmultiple runs.xls`) contain timestamped command and event lines,
including "Sample type should be …", heater set point in ohms, and heater duration (e.g. "2250 cycles or 60 secs").
These give the experimental conditions per run.

Other SAME tables:
- `SAME_Wire_Test.xls`: R/R0 per candidate ignitor wire, plus per-wire resistance vs temperature (21–849 °C) with
  polynomial fits. Engineering characterization from 2002.
- `SAME VPRED Matrix PLN-005 Baseline.xls`: 1,091 × 19 requirements matrix. No science data.
- `PSI-102_Experimental table_SAME.csv`: 8 × 5 **planned** matrix. Rows 5–8 say "same conditions as 1–4". It does not
  match the flight log (47 tests, with flows such as 2 and 8 cm/s mentioned in Appendix A comments).

### 6.3 FLEX-2 CSV

`PSI-68_Experimental table_Flex2.csv`: ASCII, 8 rows × 7 columns. Every row repeats the same ranges ("1.5 - 5" mm;
"0.17; 0.21;0.25; 0.3"; "0.5; 1.0; 1.5; 2.0; or 3.0" atm; 25 °C; "0.1 - 5" cm/s). Header cells carry trailing and
leading spaces (`Ambient Gas Mixture `, ` Ambient Temperature (C)`). **No measurements. Not suitable for analysis.**

---

## 7. Document and simulation analysis

| Document | What it is | Experimental vs model vs interpretation | Reuse |
|---|---|---|---|
| PSI-117 dissertation (Alam 2018, 227 p) | Thesis: sphero-symmetric droplet model; FLEX 563 Xe/methanol; drop-tower n-butanol; sub-mm cool flames | Model predictions compared with **published** FLEX and drop-tower data ("no additional data processing", p65) | RAG; context for cool-flame chemistry. 32 tables (keyword count) are candidates but **not** needed |
| PSI-117 Extinction slides (2022, 18 p) | Extinction of n-alkane droplets during cool-flame burning | p9 lists Experiment and Model d_ext and Kavg values per panel | RAG; cross-check against `PROCI_2023_*` |
| PSI-117 Oscillatory slides (ASGSR, 19 p) | Sub-mm oscillatory cool flame; ozone kinetics | Model only (p3: it motivates a "1-D CFD study") | RAG |
| PSI-117 Three-Stage slides (2018, 22 p) | Hot / warm / cool three-stage burning at elevated pressure | FLEX 1268 and FLEX 1256 conditions with "qualitative agreement" (p15–22) | RAG; conditions for `Three_Stage` CSV |
| PSI-117 PSI seminar (2026-03-26, 36 p) | Overview of 10+ years of the programme | Summary claims (p31). Kinetic sensitivity and uncertainty slides (p8–9) | RAG; best "explainer" source |
| FLEX-2 SRD (68 p) | Science requirements and test envelope | Requirements and prior-results figures (FLEX-1 / drop-tower) | RAG; Tables 1–4 are clean candidates for transcription |
| FLEX-2 ERD | Engineering requirements | — | Already in SpaceFire (duplicate) |
| SAME Final Science Report (68 p) | Results + 4 attached papers | Flight measurements (Table 1; Appendix A log) plus authors' interpretation (detector implications) | RAG; Table 1 and Appendix A are reliable to transcribe (clean text layer) |
| SAME EIRD (72 p), VPERD (107 p), Ops Manual, SW docs, Concept, Crew Interface | Requirements and operations | Design intent, not results | RAG (low priority): instrument descriptions and hardware context |
| SAME ICES 2012/2013 PPTX | SAME-2 results | Mixed: SAME-1 and SAME-2 results, theory vs experiment aging curves (images) | RAG with a **SAME-2 label**. Slide 24 table is transcribable |
| SAME legacy PPT/DOC | Status talks, ICES 2005 paper | Background and rationale | Low priority; partial text only |

Simulation reuse (§12 Case C). The PSI-117 model series can be plotted and compared without rerunning anything, but:
1. the model is 1-D, not the 3-D CFD in the metadata;
2. its inputs (mechanism, fiber diameter, radiation model, ignition energy) are only described in slides and the thesis,
   not in machine-readable form;
3. there are no case or configuration files to reproduce it.

**SpaceFire must not claim a validated CFD model** on the basis of these files.

---

## 8. Data-quality and trust findings

Evidence-based classes (no numeric scores):

| Criterion | PSI-117 | SAME | FLEX-2 | PSI-62 |
|---|---|---|---|---|
| Source authenticity | PSI export + named PI documents | PSI export + NASA/ZIN/NIST documents | PSI export + NASA documents | PSI export |
| Completeness for its purpose | Figure data only; no raw FLEX data, no model inputs | 47 flight tests logged; the workbooks cover all 5 materials; SAME-2 absent; TEM data absent | No measurements | Nothing beyond metadata |
| Unit consistency | Partial: some headers carry units, many are implied | Good: units in every header | n/a | n/a |
| Variable definitions | ReadMe gives conditions, not definitions (e.g. `Kavg_CF` vs `kb`) | Header names are self-describing. Sentinels are undocumented | n/a | n/a |
| Missing measurements | Units; error-bar semantics; meaning of zero values | Sentinel meaning; analysis-window rules | All | All |
| Identifier consistency | No test IDs in the CSVs; FLEX numbering differs from SpaceFire's FLEX table | Two test numberings; file/sheet/day mismatches | n/a | n/a |
| Experimental context | Via ReadMe and slides | Via logs and Appendix A | SRD only | Metadata |
| Reproducibility | Plots reproducible; model not reproducible | Statistics reproducible once sentinels and windows are defined | n/a | n/a |
| **Classification** | **Verified simulation output (1-D model) + verified scientific documentation; experimental series = digitized published data (secondary)** | **Verified structured measurements (flight telemetry, needs processing) + verified scientific documentation** | **Verified scientific documentation; metadata only for data** | **Metadata only** |

Missing Raw Data and Calibration: for PSI-117 and FLEX-2 this means the published numbers cannot be traced back to
the flight images. For SAME, the instrument calibration curves behind the moment method are shown only as images
(ICES 2012 slides 44–46), so particle sizes cannot be recomputed from volts. **This limits independent verification. It
is not evidence of poor science.**

---

## 9. Comparison with current SpaceFire data

Current processed data (read-only check of `processed/spacefire.db`): FLEX `flex_tests` has 274 rows, Heptane 117 and
Methanol 157, with identifiers such as `20CAL08` / `N01H101` and FLEX Test # 1–274. BASS-II has 129 tests (PMMA rods,
slabs, films, SIBAL, Nomex, wax). SAFFIRE-I has 2 burns (SIBAL).

| New source | Shared quantities | Key differences | Can it be joined? |
|---|---|---|---|
| PSI-117 → FLEX | d0, droplet d², burning rate K (mm²/s), extinction diameter | Fuels: only **heptane** overlaps (FLEX table has no decane or dodecane). The FLEX table has one "visible flame extinction diameter", while PSI-117 separates hot-flame (HF) and cool-flame (CF) extinction. Cool flames are not visible, so FLEX `dext` most likely corresponds to HF; this is not verified. PSI-117 uses numbers like FLEX 1268 / 1256 / 563 that do not exist in SpaceFire's 1–274 numbering | **No.** No shared key. The 5 C7 1-atm experimental d0 values were matched to FLEX heptane 1-atm air rows within ±0.006 mm: only 1 match (`N01H101`, d0 3.56 mm), and its FLEX dext is "–". Keep the sources separate; compare as published figures only |
| PSI-117 model ↔ FLEX measured | — | Prediction vs measurement | Show only as "model curve vs NASA measurement", never as data |
| FLEX-2 ↔ FLEX | Apparatus (MDCA/CIR), variables (d0, P, XO2, flow) | New fuels and mixtures, droplet arrays, forced flow. No data downloaded | n/a. The duplicated ERD is already in SpaceFire |
| SAME ↔ BASS-II / SAFFIRE-I | "Spacecraft fire safety", material flammability context | **No flame**: pyrolysis smoke and aerosol sizes vs flame spread. Materials do not overlap (Teflon, Kapton, silicone, cellulose, DBP vs PMMA, SIBAL, Nomex). Instruments measure particulate, not flame geometry | **No.** It is a new axis: detection |
| PSI-62 ↔ BASS-II | PMMA rods, concurrent flame spread, "Goldilocks" zone | Model study. The Olson & Ferkul 2017 DOI is already a BASS-II publication in SpaceFire | Only as literature, until outputs exist |

Normalizations a future cross-comparison would need: same fuel, pressure and composition; HF vs CF extinction made
explicit; d0 normalization (t/d0², (d/d0)²); and burning-rate definition (quasi-steady K vs cool-flame Kavg). For SAME,
there is no physical normalization to FLEX/BASS quantities. Show it as its own topic.

---

## 10. Integration opportunities

Full matrix: `docs/NEW_NASA_DATASET_INTEGRATION_MATRIX.md`. Highlights, each tied to a file:

- **Research Copilot / RAG (immediately):** the 5 PSI-117 PDFs; the FLEX-2 SRD; the SAME Final Science Report; the
  2 SAME PPTX (labelled SAME-2); 4 ISA-Tab metadata files (publication lists, objectives, DOIs). New answerable
  questions include "What is a cool flame and why did FLEX see it?", "How do smoke particle sizes change in microgravity
  and with aging?", "What did FLEX-2 add over FLEX?", and "Which materials are hard for the ISS detector to see?"
- **Scientific analysis (after processing):** cool-flame vs hot-flame extinction diameter vs pressure (n-dodecane,
  `PROCI_2023_C12_*`, `MST_2024_Dext`); burning rate vs pressure (`MST_2024_Kavg`); three-stage burning history
  (`Three_Stage`); SAME particle size by material, fresh vs aged (Final report Table 1); SAME detector traces per test
  (housekeeping, after the window and sentinel rules are set).
- **Interactive 3D / education:** source-backed hot-flame stand-off for a cool-flame narrative. In `Three_Stage`
  EXPT, Dflame/Do has median 17.9 (interquartile range 14.9–21.3, n = 137) over t/Do² 0.007–0.43 s/mm², and the series
  ends near 0 at t/Do² ≈ 0.425. This is FLEX 1268 per slides p15, and the figure is digitized. SAME instrument chain as a schematic (fluids
  schematic and cue card, used as reference and **not redistributed**). These are explanations, **not** physics
  simulations.
- **Prediction and modeling:** none is ready. PSI-117 gives model-vs-experiment pairs that could illustrate a
  "simulation-to-experiment" comparison. They are **not training data** for the FLEX Ridge model (different fuels,
  digitized points, no IDs).
- **Scientific reliability:** SAME's multiple published versions of the same quantities are a good case study for
  provenance display ("same quantity, four sources, four values").
- **NASA challenge alignment:** SAME adds evidence-based fire-*detection* insight. PSI-117 adds an interpretation of an
  unexpected phenomenon (cool flames). FLEX-2 and PSI-62 identify research gaps (data not yet obtained or downloaded).

---

## 11. Limitations

- **ACME (PSI-159, PSI-10) was not audited because it is not on disk.** Two of the four expected investigations are
  missing.
- PSI-62 could only be audited from metadata.
- No OCR. 21 drawings and several low-text PDF pages (PSI-117 seminar 3 p; SAME report 8 p; Wire report 7 p) were not
  machine-read. Figures in all PDFs and PPTX were not digitized.
- Legacy `.ppt`/`.doc` text was recovered partially. Their tables and charts were not read.
- Video content (2 MP4, 2 AVI) was not viewed. Only durations and formats were read. What "TN001" and "TN002" show is
  unknown.
- No internet access was used, so the two ReadMe DOIs absent from the PSI-117 metadata were not resolved, and PSI's
  online file listings were not consulted (this limits §13 of the gaps file).
- The SAME sentinel meanings, the sign convention for ISS scatter, the day of `kaptonGMT257`, and the PSI-117 error-bar
  semantics are **unverified**.
- The FLEX numbering crosswalk (PSI-117 "FLEX 1268" ↔ SpaceFire `FLEX Test #`/identifier) could not be established
  from local files.

---

## 12. Recommended priorities

**Priority 1: immediate value (files verified now)**
1. Add the PSI-117 PDFs, the FLEX-2 SRD, the SAME Final Science Report and the 4 ISA-Tab metadata files to the RAG
   corpus as new `documents` with correct investigation IDs and page numbers. Do not include drawings or videos.
2. Add the 4 new PSI publication lists to `investigation_publications` (metadata only).
3. Transcribe SAME Final Report Table 1 (8 rows) and Appendix A (47 rows) as curated JSON in the style of the
   existing `processed/curated/bass2_table_*.json`, with page references.

**Priority 2: additional processing**
1. PSI-117: reshape each CSV block into long format (`series`, `role = experiment|model`, `x`, `y`, `unit`,
   `unit_source = header|ReadMe|implied`). Flag negative digitized values and keep them. Leave error bars unattached.
   Plot experiment vs model with a clear "model" label.
2. SAME: build a per-test window table from the logs and Appendix A (GMT, time span, material, test number). Define
   sentinel rules (−10 V, −999, 500,000) and record them as quality flags. Resolve the time base from `TimeString`. Then
   extract per-test detector and particle-count traces. Exclude `kaptonGMT257` until its day is confirmed.
3. FLEX-2: transcribe SRD Tables 1–3 (fuel properties, envelope, estimated tests) as documentation tables.

**Priority 3: future research**
1. FLEX-2 measurements (PSI "Analyzed"/"Raw Data" `.txt` per test point) before any FLEX-2 analysis page or model work.
2. PSI-62 final report or results and any released tomography reconstructions before any BASS-II imaging claim.
3. SAME-2 data, and SAME calibration curves, before recomputing particle sizes from voltages.
4. ACME (PSI-159 / PSI-10) if gas-flame topics are still wanted. Download them first, then audit.

Ranking by evidence: **PSI-117** (small, clean, directly about FLEX phenomena) > **SAME** (rich flight data, new topic,
heavier processing) > **FLEX-2** (documentation, extends FLEX context) > **PSI-62** (metadata only).

## 13. Next steps

1. Decide whether ACME (PSI-159, PSI-10) is still wanted. If yes, download the metadata and any "Analyzed Data" first,
   then rerun this audit (the inventory script only needs a new entry in `FOLDERS`).
2. Approve Priority 1 (RAG + metadata + two curated SAME tables) as a separate implementation branch.
3. Optionally fetch the small files listed in `docs/NEW_NASA_DATASET_DOWNLOAD_GAPS.md`.
4. Keep the downloaded folders out of git (they are untracked; consider adding them to `.git/info/exclude` locally).

---

## Appendix: audit method and safety

- Branch `audit/spacefire-new-nasa-datasets` was created from `fix/spacefire-copilot-server-error` at `bcd76ce`. No
  uncommitted tracked changes existed. The download folders were untracked and were never staged.
- Tools: the project venv Python 3.13 (pandas and pymupdf already installed; read-only use), plus `xlrd` 2.0.2 and
  `olefile` 0.47 installed into a scratch directory outside the repo (not in the venv). Scripts ran with `python -I`
  and took paths as arguments. No servers were started.
- Extraction: only the four metadata ZIPs (8 TXT files, < 60 KB) were extracted, into `dataset_audit_work/`. That
  folder was deleted after the audit. Large archives were read from their headers only.
- Original files were not modified. SHA-256 for every file is in the inventory.

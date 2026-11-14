# New NASA Datasets: Integration Matrix (audit, 2026-11-14)

Evidence: `docs/NEW_NASA_DATASET_AUDIT.md` (sections in brackets) and `docs/NEW_NASA_DATASET_INVENTORY.csv`. This
matrix records what the files *could* support. Nothing has been integrated.

## 1. Required summary table

| Investigation | Files found | Structured data | Reports | Simulation data | Scientific value | Integration readiness |
|---|---|---|---|---|---|---|
| **PSI-117**: Cool-flame dynamics (ground) | 16 files, 67.5 MiB (`PSI-117/`) | 9 figure-data CSVs + ReadMe (`PSI-117/Analyzed data/*.csv`, `*_ReadMe_List_of_Data.xlsx`). Experimental series are digitized published FLEX/flight points [§6.1] | Dissertation (227 p) + 4 slide decks (`PSI-117/*.pdf`) | **1-D sphero-symmetric model** series (2 model-only CSVs + model blocks in 7). **No 3-D/OpenFOAM output** [§5.1, §7] | High: directly explains FLEX cool flames, extinction and pressure effects | **Ready for RAG/documentation.** **Ready for scientific analysis only with labelled processing** (units, model vs experiment, digitization flags) |
| **SAME** (PSI-102): Smoke aerosol (ISS) | 99 files, 624.5 MiB (`SAME/`) | 59 workbooks / 122 sheets of 1 Hz flight housekeeping + analyst sheets; 6 logs (`SAME/Analyzed data/Reduced Gravity/**`) [§6.2] | Final Science Report + 4 papers; EIRD; VPERD; ops/SW docs; 2 PPTX; 3 PPT; 1 DOC | None (an FDS smoke-transport study is only cited, PDF p64) | High and new: spacecraft fire *detection*; flight particle-size results | **Ready for RAG/documentation**; Table 1 + Appendix A **ready to transcribe**; telemetry **requires processing** (sentinels, windows, material assignment) |
| **FLEX-2** (PSI-68): Droplet combustion 2 (ISS) | 12 files, 9.8 MiB (`FLEX-2/`) | Test-matrix *envelope* CSV only (`PSI-68_Experimental table_Flex2.csv`). No measurements [§6.3] | SRD (68 p), ERD (duplicate of an existing SpaceFire file), DoD, hardware PPT | None | Medium: context for what FLEX-2 tested | **Ready for RAG/documentation.** **Requires additional files** for any analysis |
| **PSI-62**: Flame spread with flamelet generated manifolds (ground) | 1 file, 9.7 KB (`PSI-62/*.zip`) | None | None | None | Low for now: links to BASS/BASS-II only through metadata | **Metadata only** |
| PSI-159 ACME CFI-G (expected) | **0**: not on disk | — | — | — | — | **Not suitable currently** (not downloaded) |
| PSI-10 ACME Flame Design (expected) | **0**: not on disk | — | — | — | — | **Not suitable currently** (not downloaded) |

## 2. Feature matrix

Legend: **Now** = supported by files on disk without new processing beyond ingestion. **After processing** =
supported once the Priority 2 steps in the audit §12 are done. **Blocked** = needs files that are not on disk. **No**
= not a scientifically sound use.

### A. Research Copilot (RAG, citations, new questions)

| | Use | Status | Supporting file(s) |
|---|---|---|---|
| PSI-117 | Cool-flame explanations (two-stage, three-stage, oscillatory, ozone-assisted, extinction) | **Now** | `PSI-117_Presentations_PSI_Users_Group_Cool_Flames_in_Space_03302026.pdf` (p5–24, p31); `..._Three_Stage_Cool_Flame_TFarouk.pdf` (p15–22); `..._Extinction_Characteristics_TFarouk.pdf` (p9); dissertation |
| PSI-117 | Publication list, objectives | **Now** | `PSI-117_metadata_NEWID-13_*.zip` → `i_Investigation.txt` |
| SAME | Smoke particle sizes, aging, detector performance | **Now** | `SAME Final Science report  03 18 10 with papers attached.pdf` (PDF p3, p27–28, p39, p48, p57, p64) |
| SAME | SAME-2 results (must be labelled SAME-2) | **Now** | `SAME ICES 2012 07 15 2012.pptx` (slides 24, 29–30); `SAME ICES  2013 07 15 final as presented.pptx` (slides 27–29) |
| SAME | Hardware and operations context | Now (low priority) | `SAME EIRD Rev 2.00 02-25-05 HIgh Q.pdf`; `SAME_Operations Manual_007.pdf` |
| FLEX-2 | What FLEX-2 changed vs FLEX; science objectives; test envelope | **Now** | `FLEX-2 SRD Final.pdf` (Tables 1–4, p25–34); `FLEX-2 DoD.docx`; metadata ZIP |
| PSI-62 | "What modeling followed BASS?" (publication pointers only) | **Now** (metadata answers only) | `PSI-62_metadata_NEWID-7_*.zip` → `i_Investigation.txt` |

### B. Scientific analysis (charts, variables, comparisons)

| | Use | Status | Supporting file(s) |
|---|---|---|---|
| PSI-117 | Hot vs cool extinction diameter vs pressure (n-dodecane), experiment + model | **After processing** | `PROCI_2023_C12_Extinction_Diameter_vs_pressure.csv`, `MST_2024_Dext.csv` |
| PSI-117 | Cool-flame burning rate vs pressure | **After processing** | `MST_2024_Kavg.csv` (units of `Kavg_CF` implied) |
| PSI-117 | d² / flame-diameter / radiance histories (n-dodecane, 0.5–5 atm) | **After processing** | `MST_2024_Burning_history_Flame_diameter.csv`, `MST_2024_Radiance_Flame_Diameter.csv` |
| PSI-117 | Three-stage burn (FLEX 1268 conditions) | **After processing** | `PROCI_C12_2019_Three_Stage.csv` + Three-Stage slides p15 |
| PSI-117 | Extinction diameter vs d0 by fuel (C7/C10/C12, 1 atm) | **After processing** | `PROCI_2023_Alkane_Extinction_Diameter_1atm.csv` |
| SAME | Particle size by material, fresh vs aged | **Now** (8-row transcription) | Final report Table 1 (printed p17, PDF p27) |
| SAME | Flight test log (47 tests: GMT, material, initial/reheat, carousel, record time) | **Now** (transcription) | Final report Appendix A (PDF p33) |
| SAME | Detector / P-Trak / DustTrak traces per test | **After processing** | `SAME/Analyzed data/Reduced Gravity/**/*.xls*` + logs |
| SAME | DustTrak B/A ratio (mass above 1 µm) per material | **After processing** | housekeeping DustTrak A/B; Table 1, PDF p57 for the published values |
| FLEX-2 | Any measured FLEX-2 variable | **Blocked** | needs PSI-68 Analyzed/Raw `.txt` per test point (see gaps) |
| PSI-62 | Flame geometry / temperature / soot from tomography | **Blocked** | not downloaded |
| PSI-117 ↔ FLEX table | Row-level merge with SpaceFire FLEX tests | **No** | no shared key; 1 of 5 d0 matches (`N01H101`) and its dext is "–" [§9] |
| SAME ↔ BASS-II/SAFFIRE | Merge into flame-spread analyses | **No** | different phenomenon (pre-flaming smoke) and different materials |

### C. Interactive 3D / education

| | Use | Status | Supporting file(s) |
|---|---|---|---|
| PSI-117 | Source-backed hot-flame stand-off and radiance history for a cool-flame explainer (labelled "published figure data") | **After processing** | `PROCI_C12_2019_Three_Stage.csv` (EXPT Dflame/Do median 17.9, n = 137) |
| PSI-117 | Model temperature/OH-position histories as "model prediction" overlays | **After processing** (label as model) | `PROCI_2019_*.csv`, `Three_Stage` simulation block |
| SAME | Smoke-path schematic (sample → aging chamber → diluter → instruments) | **Now** as reference for an original diagram | `60089MFHP0001-C Same Fluids System Schematic.pdf`; OPS cue-card image. Use them as a reference only: do not redistribute the drawings |
| FLEX-2 | Hardware imagery | **No** | the drawings carry export-control markings (`67212MFAN11000-4 ...pdf`) |
| any | "Validated CFD" visualization | **No** | no CFD fields; the model is 1-D [§7] |

### D. Prediction and modeling

| | Use | Status | Supporting file(s) |
|---|---|---|---|
| PSI-117 | Simulation-vs-experiment comparison (as published, no re-fit) | **After processing** | the 7 mixed CSVs |
| PSI-117 | Training or validation data for the FLEX Ridge model | **No** | mostly decane/dodecane, digitized, no test IDs, different targets (HF/CF split) |
| SAME | Predictive model of particle size | **No** (8 aggregate rows; sizes come from a moment-method inversion needing calibration not on disk) | Table 1; ICES 2012 slides 44–46 (calibration shown only as images) |
| FLEX-2, PSI-62 | Anything | **Blocked** | — |

### E. Scientific reliability

| | Use | Status | Supporting file(s) |
|---|---|---|---|
| SAME | "Same quantity, several published values" provenance demo | **Now** | Final report PDF p27, p48, p57, p64; ICES 2012 slide 24 |
| SAME | Unit checks: units in every telemetry header | **After processing** | housekeeping headers |
| SAME | Data-quality flags (sentinels −10 V / −999 / 500,000; day mismatch; folder vs log material) | **After processing** | see audit §6.2 |
| PSI-117 | Digitization flags (negative t/Do², negative diameters), implied units, ambiguous zeros, unattached error bars | **After processing** | audit §6.1 |
| FLEX-2 | Duplicate-source detection (ERD already in SpaceFire) | **Now** | inventory `duplicate_of` |

### F. NASA challenge alignment

| Theme | Best source | Status |
|---|---|---|
| Summarizing combustion findings | PSI-117 seminar + slides; SAME Final Report | Now |
| Ranking relevant research | 4 ISA-Tab publication lists (81 publication entries in total) | Now |
| Interpreting physical phenomena | PSI-117 (cool flames, three-stage burning) | Now (RAG) / after processing (charts) |
| Evidence-based fire-safety insights | SAME (detector response by particle size and material) | Now (report) / after processing (traces) |
| Identifying research gaps | FLEX-2 (data not downloaded), PSI-62 (model outputs absent), PSI-117 (3-D work described but not provided), ACME absent | Now |

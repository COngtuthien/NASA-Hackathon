# New NASA Datasets: Download Gaps Worth Filling (audit, 2026-11-14)

Only small, high-value items are listed. Bulk Raw Data and Calibration collections are **not** recommended. No exact
PSI file name is given unless it appears in a local file. PSI's online listings were not consulted, because the audit
used no internet.

| # | Investigation | File (exact name if known) | Category | Why it is needed | Feature it enables | Essential? | Avoidable with existing files? |
|---|---|---|---|---|---|---|---|
| 1 | **PSI-159 ACME CFI-G** and **PSI-10 ACME Flame Design** | Metadata ZIP (`PSI-159_metadata_*.zip`, `PSI-10_metadata_*.zip`, following the pattern of the other downloads) and the "Experimental table" CSV, then any small Analyzed Data files | Metadata / Analyzed Data | Both were expected but **are not on disk**: `FLEX-2/` and `SAME/` were downloaded in their place | Any ACME page or gas-flame comparison | Essential *if* ACME is still wanted | No |
| 2 | PSI-68 FLEX-2 | Not known locally. `FLEX-2 DoD.docx` says there are 40 Experiment Data records with ".txt files of the experiment's raw data" per test point, under "Raw Data" → "Raw & Analyzed Data" | Analyzed / raw time series (text) | No FLEX-2 measurement exists on disk | FLEX-2 analysis; extending FLEX burning-rate and extinction charts to decane, ethanol and mixtures | Optional (essential for any FLEX-2 analysis) | No. Pick 2–4 test points first (e.g. Quiescent decane and ethanol at 1 atm) to check the format before downloading more |
| 3 | PSI-62 | Not known locally. Look for a final report or "Analyzed Data" entry on the PSI-62 page | Report / Analyzed Data | Only metadata is on disk; no model outputs, tomography or validation tables | PSI-62 RAG content; BASS-II model-vs-experiment discussion | Optional | Partly. Metadata already gives objectives and DOIs |
| 4 | PSI-117 | The two sources cited in `..._ReadMe_List_of_Data.xlsx` but missing from the PSI-117 publication list: DOI `10.1007/s12217-024-10115-x` (MST 2024) and `10.1016/j.proci.2018.09.015` (Three_Stage). Check whether PSI hosts them or they are open access | Publication | Needed to confirm units, the error-bar convention, the meaning of zero values, and the experimental campaign for the MST_2024 CSVs | Turning PSI-117 CSVs from "after processing" into charts that can be cited | Recommended | Partly. Slides give conditions but not those definitions |
| 5 | PSI-102 SAME | Not known locally. SAME-2 data or report, if PSI hosts it (the ICES 2012/2013 decks show SAME-2 results, Pyrell, MPASS) | Report / Analyzed Data | Lets SpaceFire label SAME-1 vs SAME-2 correctly and use the SAME-2 table with a citable source | SAME comparison, flight vs ground | Optional | Yes for SAME-1. The Final Science Report covers it |
| 6 | PSI-102 SAME | Not known locally. Instrument calibration for the P-Trak, ionization and DustTrak moment method (shown as images in ICES 2012 slides 44–46) | Calibration (small tables only) | Needed to turn telemetry volts and counts into particle sizes independently | Recomputing particle sizes per test | Optional (Priority 3) | Yes, if SpaceFire only reports the published sizes |

Not recommended:
- `SAME/TN001.zip`, `TN002.zip` (≈ 300 MB of DV video) are already on disk. Nothing more of that kind is needed, and
  their content is unverified.
- Bulk FLEX-2 images, SAME raw videos, or any full Calibration collection.
- Additional engineering drawings. They carry export-control markings and add no science values.

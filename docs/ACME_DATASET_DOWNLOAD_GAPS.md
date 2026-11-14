# ACME Datasets: Download Gaps Worth Filling (Phase 13 audit, 2026-11-14)

Only small, high-value items are listed. **No bulk Raw Data, Calibration, image or video collections are
recommended.** Exact file names are given only when a local file confirms them. PSI's online listings were not
consulted, because the audit used no internet.

| # | Investigation | File (exact name if confirmed) | Category | Purpose | Essential? | Feature unlocked | Are existing files enough instead? |
|---|---|---|---|---|---|---|---|
| 1 | Flame Design (PSI-10) | Not confirmed. The final report says "Consult the **forthcoming** ACME/Flame Design Data Interpretation document" (p93); check whether PSI now hosts it, or any per-test analyzed results table (extinction time, flame radius, TFP temperature) | Analyzed Data / data dictionary | The download has **conditions only**; every Flame Design result is in paper abstracts | Essential for any Flame Design analysis | Flame Design outcome analysis; condition-to-outcome comparison with CFI-G | No |
| 2 | BRE (PSI-20) | Per-test non-imaging file, pattern `<test>_data.csv`. **`19039A1_data.csv` is confirmed** as an example in `BRE_data_interpretation_20220804.pdf` p8. Suggest 2–3 tests that the final report discusses: `19070K1`, `19070D1`, `19056F1` (named on p25–26); file names follow the same pattern but are not confirmed | Raw Data (small CSV, 125 Hz) | Shows heat flux, radiometer and TC time series behind the report's figures | Optional | A source-backed BRE heat-flux / flame-persistence chart for a few tests | Yes, if SpaceFire only reports the authors' conclusions |
| 3 | CFI-G (PSI-159) | Same `<test>_data.csv` pattern (ACME-wide format per `ACME-DOC-010_D.pdf` §8.1). Suggest the cool-flame tests in Table 3, e.g. `21174C3` and `21291C1`; names not confirmed | Raw Data (small CSV) | Radiometer and PMT traces that show hot→cool transitions (report Fig. 1, p45) | Optional | A real hot/cool transition trace instead of a conceptual one | Yes, if Table 3 is enough |
| 4 | CFI-G / Flame Design | The two CFI-G papers (DOIs in the PSI-159 metadata: 10.1016/j.proci.2022.07.015, 10.1016/j.combustflame.2023.112852) and the 2023 Flame Design papers on critical extinction temperature and steady-state flames (DOIs in the PSI-10 metadata: 10.1016/j.proci.2022.07.049, 10.1016/j.proci.2022.07.043) | Publications | Tables, definitions (Tad, Zst, PCI labels) and model details absent from the final reports | Recommended for RAG depth | Answers about cool-flame kinetics and extinction criteria | Partly. The final reports contain the abstracts |
| 5 | CFI-G | A key to the `PCI-A…G` labels and the `limit` colour value, if PSI provides a data description (no DoD exists in the CFI-G download) | Metadata | Interpret two columns correctly | Optional | Cleaner quality flags | Partly. Table 3 lists the cool-flame tests |
| 6 | BRE | Re-download of `ACME_drawings_avionics_package.zip`, `ACME_drawings_burners.zip`, `ACME_drawings_common_electrical.zip`, `ACME_drawings_shipping_containers.zip` (each ~1 MB short; 71 members unreadable) | Engineering drawings | Only if someone needs complete drawings | **Not recommended** | None for SpaceFire (drawings must not be published) | Yes |

Not recommended:
- Raw DataCam images (`.hobj`/`.tif`) or analog video (`.ts`). They are large, and colour and TFP processing caveats
  apply (Flame Design final report p93).
- Full Calibration collections. The instrument characterization reports are already on disk (`ACME Imaging.zip`,
  `ACME Instruments.zip`).
- More outreach material or videos.

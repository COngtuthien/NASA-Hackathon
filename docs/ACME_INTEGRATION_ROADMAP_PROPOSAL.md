# Integration Roadmap Proposal: ACME + Previously Audited Datasets (2026-11-14)

This is a proposal for review only. Nothing here is implemented. It combines the ACME audit
(`docs/ACME_DATASET_AUDIT.md`) with the earlier audit of PSI-117, SAME (PSI-102), FLEX-2 (PSI-68) and PSI-62
(`docs/NEW_NASA_DATASET_AUDIT.md`). **None of those seven investigations is integrated today.** SpaceFire currently
holds FLEX (PSI-69), BASS-II (PSI-25) and SAFFIRE-I (PSI-98) only.

Guiding rules carried over from both audits:
- Every number shown must come from a file on disk, with its page or column.
- Measured, derived, literature, model and conceptual content are labelled differently.
- Datasets are never merged because column names match.
- Normal and inverse flames are kept apart.
- Censored burn times are never treated as extinction times.
- Nothing is added to the FLEX Ridge model.
- Engineering drawings are never published.

## Phase A: evidence corpus (lowest risk, highest value)

**Goal:** Copilot can answer questions about all seven new investigations, with citations.

| Step | Content | Source files | Notes |
|---|---|---|---|
| A1 | Add 7 investigations to `investigations` with verified IDs, titles and DOIs | ISA-Tab `i_Investigation.txt` from each metadata ZIP | PSI-20, PSI-159, PSI-10, PSI-117, PSI-102, PSI-68, PSI-62 |
| A2 | Add publication lists to `investigation_publications` | same | 16 + 2 + 33 + 10 + 16 + 51 + 4 entries |
| A3 | Ingest primary reports into `documents` / `document_chunks` with page numbers | ACME: `BRE_final_report_20220201.pdf`, `BRE_data_interpretation_20220804.pdf`, `PSI-159_Reports_FinalRpt_ACME.CFI-G.pdf`, `PSI-10_Reports_FinalRpt_ACMEFlameDesign.pdf`, `PSI-10_Science Documents_SRD_ACMEFlameDesign.pdf`, `BRE_SRD_201306.pdf`, the ACME ISRD (one copy). Previous audit: PSI-117 PDFs, SAME Final Science Report, `FLEX-2 SRD Final.pdf` | Skip duplicates, drawings, outreach posters, vendor manuals and the scrambled FLEX article. Optional second wave: BRE dissertation, Flame Design Task Book reports |
| A4 | Retrieval evaluation | add golden questions from `ACME_DATASET_INTEGRATION_MATRIX.md` §A | Reuse the existing retrieval evaluation harness. **No live Gemini needed** to evaluate retrieval |

**Exit criteria:** existing pytest and retrieval-evaluation suites pass; the new golden questions retrieve the cited
pages; no FLEX/BASS-II/SAFFIRE regressions.

## Phase B: curated tables (small, verifiable transcriptions)

Use the same style as the existing `processed/curated/bass2_table_*.json`, with page references and verification status.

| Table | Rows | Source | Caveats to encode |
|---|---:|---|---|
| CFI-G cool-flame events | 15 | CFI-G final report Table 3, p46 | `21174D1` (footnote 3: no cool radius), sub-numbered reignitions |
| CFI-G flames per test day | 23 | CFI-G final report Tables 1–2, p21–22 | atmospheres are nominal (vitiation) |
| BRE flames per test day | 18 | BRE final report Table 1, p24 | use this, not the PSI CSV (2 date errors) |
| Flame Design flames per test day | 23 | FD final report Table 1, p24 | — |
| BRE literature L/LHV | 5 | BRE final report Table 2, p29 | label **literature** |
| SAME particle sizes, flight log | 8, 47 | SAME Final Science Report Table 1 (PDF p27), Appendix A (PDF p33) | from the previous audit |

## Phase C: one gaseous-flame analysis section (ACME CFI-G, with Flame Design context)

**Architecture:** extend the existing Scientific Analysis area with **one shared section, "Gaseous spherical flames
(ACME)"**, containing:
- a **CFI-G** tab;
- a **Flame Design** tab;
- a short "what ACME is" introduction (from ISRD/SORD).

Do not create three separate investigation pages, and do not create a BRE analysis page. This is the simplest
structure the data supports: one apparatus, one condition vocabulary, and only one investigation with per-test outcomes.

CFI-G tab (data: the two per-test CSVs, cleaned into a derived table; sources untouched):
1. Cleaning rules:
   - Drop blank rows.
   - Normalize categories (Yes/yes, Inverse/inverse).
   - Keep the original strings next to the normalized ones.
   - Flag `#DIV/0!`, `#VALUE!`, the 273.15 K artefact, `limit` and `-`.
   - Treat FT as censored.
   - Keep `XO2/Xf after test` as post-test values (not predictors).
   - Show a note on the CSV vs report count differences.
2. Charts (descriptive only):
   - Outcome (hot ignition; SE vs FT) by fuel × pressure × XO2, separately for normal and inverse.
   - Self-extinction burn-time distribution (SE only).
   - Cool-flame event table with hot/cool radii.

Flame Design tab: a condition-space chart (Tad vs Zst; normal vs inverse; RAMP excluded) and the author findings as
cited text. **No outcome charts** until Flame Design results are downloaded (gaps file #1).

Cross-investigation views allowed:
- CFI-G vs Flame Design **condition space**, with p converted between bar and atm.
- A qualitative "cool flames across phases" explainer linking FLEX, PSI-117 and CFI-G, built from report text only.

Not allowed: BRE vs BASS-II numeric overlays; ACME vs FLEX K or extinction overlays.

## Phase D: previously audited structured data (from the first audit, unchanged)

1. PSI-117 figure-data CSVs as published model-vs-experiment plots (long format, digitization flags).
2. SAME telemetry per test, after the window, sentinel and material-assignment rules are set.

These are independent of ACME and can run in parallel with Phase C once Phase A is done.

## Phase E: optional / later

- A small 3D illustration: one spherical hot flame and cool flame at the CFI-G Table 3 condition, with measured radii,
  labelled "illustration at measured condition". Only after Phase C, and only if it adds understanding.
- BRE heat-flux traces for 2–3 tests, if the small per-test CSVs are downloaded (gaps file #2).
- No ML model is proposed. A CFI-G outcome classifier would need grouping by test day and atmosphere (rows are not
  independent) and must exclude post-test columns; revisit only with more data.

## Suggested order

**A (all seven investigations) → B → C (CFI-G first) → D1 (PSI-117) → D2 (SAME) → E.**
- BRE stays RAG-only plus a fire-safety explainer.
- FLEX-2 and PSI-62 stay RAG/metadata-only.
- Flame Design analysis waits for outcome data.

## Validation note (this audit)

- **Originals:** SHA-256 of all 84 ACME files was identical before and after the audit.
- **Workspace:** the temporary `dataset_audit_work/acme/` was deleted.
- **Git:** only documentation and the inventory script were committed. No downloads, extracted files, drawings or
  `.env` were staged.
- **Gemini:** no requests were made.

# ACME Datasets: Integration Matrix (Phase 13 audit, 2026-11-14)

Evidence: `docs/ACME_DATASET_AUDIT.md` (section numbers in brackets) and `docs/ACME_DATASET_INVENTORY.csv`. Nothing is
integrated.

Legend:
- **M** = actual measured NASA data on disk.
- **D** = documented physics or author findings (text in a report).
- **S** = simulation results on disk.
- **C** = conceptual illustration only.
- **—** = not supported.

Status values:
- **Now**: files on disk, no new processing.
- **After processing**: needs cleaning or curation.
- **Blocked**: needs files not on disk.
- **No**: not scientifically sound.

## 1. Readiness rubric (documented, qualitative)

Each dimension is rated **High / Medium / Low** by these criteria. These are audit judgements from the inspected files,
**not official NASA assessments**, and no numeric score is computed.

| Dimension | High | Medium | Low |
|---|---|---|---|
| Scientific relevance | Directly addresses microgravity fire safety or flame physics already in SpaceFire | Related phenomena or context | Tangential |
| Measured data availability | Per-test observed outcomes on disk | Day-level logs or a few curated result tables | Conditions or metadata only |
| Data completeness | Outcomes and conditions for most tests, few gaps | Partial, with documented gaps | Key outcomes absent |
| Unit and metadata clarity | Units in headers, definitions documented | Units present, some definitions missing | Units or definitions largely missing |
| Source reliability | NASA/PI final report and PSI export agree | Minor documented discrepancies | Unresolved conflicts |
| Analytical potential | Supports grouped statistics and comparisons | Descriptive only | None without new data |
| 3D visualization potential | Measured geometry over a range of conditions | Measured geometry at a few conditions | Prose or images only |
| RAG usefulness | Long, text-extractable primary reports | Short reports or slides | Little text |
| Integration complexity (inverse: High = easy) | Small clean files | Cleaning and curation needed | Major processing or new downloads |

| Dimension | BRE (PSI-20) | CFI-G (PSI-159) | Flame Design (PSI-10) |
|---|---|---|---|
| Scientific relevance | High (spacecraft material flammability) | High (cool flames, extinction) | High (soot and extinction limits) |
| Measured data availability | Low (day log only) [§6.1] | **High** (333 test points with outcomes + Table 3) [§6.2] | Low (conditions only) [§6.3] |
| Data completeness | Low | Medium (censoring, count mismatches) | Low |
| Unit and metadata clarity | Medium (data dictionary for raw files) | Medium (Tad/Zst method, `limit`, PCI labels) | Medium |
| Source reliability | Medium (2 CSV date errors) | Medium (CSV vs report counts) | Medium (22042M1 label) |
| Analytical potential | Low | **High** (grouped outcome statistics) | Low (condition maps) |
| 3D visualization potential | Low (figures only) | Medium (radii for 15 events at one condition set) | Low (prose + uncaptioned images) |
| RAG usefulness | **High** (181 + 171 + 33 + 63 pages) | Medium (93 pages) | High (109 + 39 + 45 pages) |
| Integration complexity | Medium (RAG only) | Medium (cleaning) | Medium (RAG only) |
| **Readiness** | **RAG/documentation only**; requires additional data | **Ready after targeted processing** | **RAG/documentation only**; requires additional data |

## 2. Feature matrix

### A. Research Copilot (RAG)

The questions and supporting evidence are below. "Direct" means a report page answers the question. "Needs more"
means the answer requires evidence that is not on disk.

| Question | Investigation | Supporting file and page | Support |
|---|---|---|---|
| What does the Burning Rate Emulator actually emulate? | BRE | `BRE_final_report_20220201.pdf` p3–5, p25–26; `BRE_SRD_201306.pdf` | Direct |
| Can a common plastic burn steadily in proposed spacecraft atmospheres? | BRE | final report p26 (19070D1 "could represent PMMA"), p39–40 | Direct (an author interpretation; label it as such) |
| How does oxygen concentration affect flame persistence? | BRE | final report p18, p39–40 (XO2 ≥ 0.265 quasi-steady; 21% self-extinguished within 40 s) | Direct |
| Why do gaseous diffusion flames behave differently in microgravity? | Flame Design, CFI-G | FD final report p25–27 (growth to radiative extinction); CFI-G final report p5 (diffusion-dominated transport) | Direct |
| What causes cool flames in gas-fuel experiments? | CFI-G | CFI-G final report p23–24, p44–46 | Direct for *where* they occurred. Kinetics explanation needs more (papers not on disk) |
| Under what conditions did CFI-G see cool flames? | CFI-G | final report p44, Table 3 p46 | Direct |
| At what temperature do spherical diffusion flames extinguish? | Flame Design | final report p25–26 (1130 K; 0.2 / 0.68 g/m²·s) | Direct (abstract-level; per-test data not on disk) |
| How does gaseous combustion differ from droplet combustion? | CFI-G + FLEX/PSI-117 | CFI-G p23 (model combining droplet burning and partial burning); FLEX documents | Direct for the conceptual link; quantitative comparison is unsupported |
| What can ACME contribute to spacecraft fire safety? | BRE, FD | BRE final report p39–40; FD final report p25 ("implications for spacecraft fire safety") | Direct |
| Is the soot volume fraction known for these flames? | Flame Design | FD metadata objectives; final report has no values | **Needs more**: say the data are not available |

### B. Scientific analysis

| Use | Status | Data kind | File |
|---|---|---|---|
| Hot-ignition rate and SE-vs-FT outcome by fuel, pressure, XO2 and flow (normal flames) | **After processing** | M | `PSI-159_Experimental table_CFI-G_Normal Flames.csv` |
| Same for inverse flames (separate group) | **After processing** | M | `PSI-159_Experimental table_CFI-G_Inverse Flames.csv` (drop 861 blank rows) |
| Self-extinction time distribution (SE rows only; FT treated as censored) | **After processing** | M | both CFI-G CSVs |
| Cool-flame events: hot/cool radius, ratio, duration | **Now** (15-row transcription) | M | CFI-G final report Table 3, p46 |
| Condition-space map: Tad vs Zst for CFI-G vs Flame Design (normal) | **After processing** (bar↔atm; exclude RAMP) | M conditions | CFI-G Normal CSV + `PSI-10_Experimental table_Flame Design_Normal Flame.csv` |
| Flame Design outcomes (extinction, size, soot) | **Blocked** | — | not on disk |
| BRE flammability map (L vs mass flux) | **Blocked** (figures only) | D | final report Fig. 14–19 |
| BRE test campaign overview | **Now** | M (log) | final report Table 1 p24 (use instead of the CSV) |
| Regression or classification | **No** for now. A logistic model of SE vs conditions on CFI-G is technically possible (n ≈ 180 per configuration), but tests share days and vitiated atmospheres, so the rows are not independent. Not recommended before grouping by day is designed | — | — |

### C. Interactive 3D: possible "Gaseous Flame Dynamics" studio (not to be implemented now)

| Interaction | Evidence kind | Source | Verdict |
|---|---|---|---|
| Fuel selection (ethane/propane/n-butane) | M (categorical outcome rates) | CFI-G CSVs | Show as **observed outcome rates**, not a simulated flame |
| Oxygen concentration | M (XO2 per test) | CFI-G CSVs | Same |
| Flow rate | M (mHC) | CFI-G CSVs | Same |
| Flame geometry (sphere radius) | M for 15 cool-flame events (one condition set) | Table 3 | Too narrow for a general geometry slider; use a fixed-condition illustration |
| Hot vs cool flame explanation | M (radius ratio 2.3–2.9; report says 2.6×) + D | Table 3; report p23, p44 | Supported as an illustration at the measured condition |
| Flame growth to radiative extinction | D | FD final report p25–27 | **Conceptual** animation only, labelled |
| Extinction temperature 1130 K | D | FD p25–26 | Annotation only |
| Soot shell / colour | C | FD images (uncaptioned) | Conceptual only |
| Comparison with NASA imagery | C | Representative images lack captions; CFI-G image caption is doubtful | **Not yet** |
| BRE flat-burner flame vs O2 | D | BRE final report figures | Conceptual only |

**Recommendation:** do **not** build a new 3D studio now. If one is wanted later, a single static spherical-flame
illustration at the CFI-G Table 3 condition, with measured hot and cool radii and clear labels, is the most that the
data defend.

### D. Prediction and modeling

| Check | CFI-G | Flame Design | BRE |
|---|---|---|---|
| Sample size | 179 normal + 154 inverse test points | 207 + 120 (conditions only) | 18 day rows |
| Target variables | hot ignition, SE/FT, burn time (censored) | none | none |
| Missing data | 4 blank burn times; spreadsheet errors; `-` markers | RAMP rows; missing final p/XO2 (C3H8) | pressures absent |
| Independent validation data | none on disk | none | none |
| Leakage risk | High: `XO2 after test` and `Xf after test` are measured *after* the burn, and burn time determines SE/FT | n/a | n/a |
| Grouping | test day / bottle / vitiated atmosphere | test day | day |
| Model-vs-experiment validation | Report mentions an analytical model; no outputs | Report mentions a transient numerical model; no outputs | CFD planned (metadata); none on disk |
| **Verdict** | Descriptive statistics only for now | None | None |

### E. Scientific reliability

| Use | Status | Source |
|---|---|---|
| Correct the BRE CSV log against Table 1 (two dates) and show the correction | **Now** | `ACME-BRE_Test_Summary.docx` image; final report p24 |
| Quality flags for CFI-G (spreadsheet errors, 273.15 K artefact, `limit`, censoring, count mismatch) | **After processing** | audit §6.2 |
| Metadata-vs-flown discrepancies (n-pentane, CH4, O2/CO2) | **Now** | audit §5 |
| Image caption caution (CFI-G representative image) | **Now** | audit §8 |

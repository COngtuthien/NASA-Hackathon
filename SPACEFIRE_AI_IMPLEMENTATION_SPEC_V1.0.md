# SPACEFIRE AI — IMPLEMENTATION SPECIFICATION v1.0

**Status:** APPROVED BASELINE FOR IMPLEMENTATION (proposed defaults; owner may override)  
**Date:** 2026-11-10  
**Project:** SpaceFire AI — Evidence-Grounded Microgravity Combustion Intelligence  
**Challenge:** NASA Space Apps Challenge 2026 — Flame in Freefall: AI-Powered Fire Safety Insights from Microgravity Combustion Data  
**Local workspace:** `D:\NASA Hackathon`  
**Repository:** `https://github.com/COngtuthien/NASA-Hackathon`  
**Primary language:** English UI; Vietnamese in research notes / optional user-query language  
**Implementation strategy:** Full P0 + P1, one verified end-to-end vertical slice at a time; P2 conditional.  
**Mockup:** dark aerospace dashboard already provided in conversation; visual *reference*, never evidence of real measurements.

> **Instruction to coding agents:** This is a BUILD specification, not a request to produce another set of planning documents. Build working code, run tests, and demonstrate real functionality. Source research reports `research/01_DATA_INVENTORY.md` through `research/10_EXECUTIVE_SUMMARY.md` (if accessible) are *research claims*, not a substitute for parsing the original source data. When a report and underlying source disagree, preserve both, flag discrepancy, and do not silently decide that a scientific value is true. Do not modify source datasets or publish commits unless user explicitly authorizes pushing.

---

## 0. Product contract / acceptance in one page

### 0.1 Core promise

Users can **ask, search, explore, compare, analyze, rank evidence and verify** NASA microgravity combustion research. Scientific conclusions must be grounded in experiments, NASA reports, or externally verified scientific literature; uncertainty and unavailable evidence are visible.

### 0.2 The 12 user-facing capabilities

| ID | Feature | Gate | Minimum shippable outcome |
|---|---|---|---|
| F01 | AI Scientific Research Assistant | **P0** | Natural-language answers, internal data tools, source-cited claims, honest abstention |
| F02 | External Scientific Research | **P0** | Search at least **two functional sources** (prefer NASA NTRS + OpenAlex), verify DOI/metadata when available, show external links; other adapters optional |
| F03 | Experiment Explorer & Details | **P0** | 274 FLEX + 129 BASS-II + 2 SAFFIRE burns; filters, sorting, pagination, canonical detail pages |
| F04 | Experiment Comparison | **P0** | Compare 2–5 experiments within same dataset and produce table + chart of compatible fields |
| F05 | Scientific Evidence Explorer & Ranking | **P0** | Hybrid search over extracted reports and external metadata; rank with explainable relevance and page/source |
| F06 | FLEX Physics Lab | **P1** | Oxygen/pressure/fuel filters, extinction map, d²-law consistency, provenance and n |
| F07 | BASS-II Physics Lab | **P1** | Material/O2/CO/CO2 plots, gas delta, curated report evidence, careful fan semantics |
| F08 | SAFFIRE-I Case Study & Timeline | **P1** | S1/S2 comparison; timeline of camera/file metadata and received/corrupt counts, NO fabricated images |
| F09 | Similar Experiment Discovery | **P1** | Within-dataset nearest-neighbor search on compatible **input** variables, explanations of similarity |
| F10 | Data Quality & Scientific Validation | **P1** | Flag real anomalies; provenance, raw vs normalized value, correction source |
| F11 | FLEX ML Prediction | **P2 / gated** | Train/evaluate transparent baseline only if leakage-safe validation and honest uncertainty can be shown |
| F12 | Research Overview & Dashboard | **P0** | Three investigations, summaries/metrics from real database, science insights from curated evidence, quick actions |

**P0 + P1 comprise the required product scope.** P2 is optional and MUST NOT block working P0/P1. If time is constrained, reduce visual polish and nonessential refinements, not the truthfulness of the data.

### 0.3 Non-goals

- No raw video or full spacecraft sensor-data ingestion unless independently available and verified.
- No invented flame-spread rates, thermal signatures, image stills or time-series measurements.
- No predictive claims for operational spacecraft fire safety or human safety certification.
- No combined universal ML predictor across fundamentally different investigations.
- No paywall bypass, unauthorized crawling, copyrighted fulltext caching, or dependence on scraping brittle websites.
- No fake chatbot replies, static fabricated charts, placeholder cards disguised as live functionality.
- No user authentication/multi-tenant collaboration or real-time spacecraft monitoring for MVP.

### 0.4 Defaults to implement without asking the owner

- **UI:** dark aerospace, navy/charcoal background, orange flame accent, cyan data highlights, readable contrast, responsive.
- **Backend:** Python 3.11+ / FastAPI / Pydantic 2 / SQLite (+ FTS5) / pandas / NumPy / SciPy / scikit-learn for optional ML.
- **Frontend:** Next.js App Router + TypeScript + Tailwind + Plotly (or ECharts if integration is demonstrably simpler).
- **Document parsing:** PyMuPDF / pdfplumber / python-docx / python-pptx / openpyxl (for programmatic source ingestion), with PDF page preservation.
- **Retrieval:** SQLite FTS5/BM25 + sentence-transformers embedding (lightweight English model) + local vector search; stable reciprocal rank fusion.
- **LLM:** provider-agnostic adapter with environment-configured API key/model; no hard-coded credentials; retrieval-only fallback if unavailable.
- **External literature:** NASA NTRS + OpenAlex working first; optional Crossref validation, Semantic Scholar and arXiv adapters only after core stable.
- **Deployment:** local-first; reproducible one-command startup script; optional Docker Compose.
- **No request for UI review:** agent chooses sensible defaults and proves functional acceptance through screenshots, E2E tests and documented commands.

---

## 1. Problem, scientific scope and source-of-truth

### 1.1 Challenge interpretation

NASA microgravity combustion evidence is fragmented across experimental CSVs, reports, procedural documents, measurements and image manifests. The product helps users **summarize**, **rank relevant evidence**, and **interpret** experiment results through an interactive AI-powered dashboard. Ranking is **relevance and evidentiary support** for the research question; it is NOT a global material-safety score.

### 1.2 Three investigations

| Dataset | What it really covers | Available local evidence | What not to claim |
|---|---|---|---|
| `FLEX/`, PSI-69 | Liquid droplet flame extinction, methanol & heptane, pressure/gas chemistry | 274 rows × 15 columns; reports, test plan, metadata | Experimental conditions represent all spacecraft fires; all `Disruption` events mean extinction |
| `BASS-II/`, PSI-25 | Solid-fuel burning/spread, multiple shapes and controlled airflow, pre/post gases | 129 rows × 17 columns; 144-page Summary Report, FAQ, procedure, fan calibration/test matrix | `Fan display` is velocity; pre/post gases provide continuous time series |
| `SAFFIRE-1/`, PSI-98 | Large-scale SIBAL fabric experiment on Cygnus | S1/S2 burn rows; F1/F2 image-set rows; 12-sheet image filename/time/receipt manifest, docs | Actual frames, flame area/spread rates, temperature traces exist in local files |

Total **405 principal experimental rows** across three distinct scientific systems; **SAFFIRE CSV has four rows including two image-set references**. Do not turn the total into a statistically homogeneous ML sample count.

### 1.3 Scientific facts vs research-report interpretations

The uploaded 10 reports contain valuable audit results. Some items are confirmed by source-backed reports and should appear with citations; examples:

- FLEX CSV is cp1252; raw `CO initial ambient composition; mole fraction` is interpreted as CO₂ diluent in the audit, but retain original label and the specific documentation/evidence supporting normalization.
- FLEX `Burning rate; mm` appears unit-mislabeled relative to a d²-law rate in mm²/s; display correction separately from source text.
- FLEX `193F001` appears twice; primary key must never rely solely on descriptive test ID.
- BASS-II `GMT` represents day-of-year, not a time-of-day. `Fan display` includes mixed control readings; `Air display` may be an airflow measurement in cm/s, sometimes multi-stage.
- BASS-II O₂/CO₂/CO values are **before and after** tests, not continuous time series. Reused material/sample IDs and same-day atmosphere make naive random-split ML risky.
- SAFFIRE-I `F2` is reported as post-flow visualization in the document/workbook audit despite raw CSV saying pre-test. Record conflicting assertions.
- SAFFIRE-I workbook is an **image manifest**, with filename, timestamp, receive/corruption status and file size; JPEG size is NOT flame area.
- Scientific reports may contain engineering requirements for FLEX-2 distinct from FLEX; preserve scope by document.

### 1.4 Evidence provenance/authority

Every displayed claim or normalized datum must carry provenance:

1. `ORIGINAL_EXPERIMENT`: exact original CSV/XLSX row, file hash and raw column.
2. `SOURCE_DOCUMENT`: filename, document hash, page/section, excerpt, investigation.
3. `COMPUTED`: deterministic calculation, formula/assumptions, record set, n, units.
4. `EXTERNAL_PUBLICATION`: verified metadata (DOI/URL/title/authors/year), abstract/fulltext access status.
5. `HYPOTHESIS`: explicitly marked non-verified interpretation.
6. `UNSUPPORTED`: insufficient evidence; no invented numeric output.

Do not let `DOC` claims override direct measurements silently. Display conflict badges and explanation. A metadata catalog is not proof that a paper's conclusion is known if its full text was not read.

### 1.5 Rules for normalization

- Immutable raw-data directory; never write into `FLEX/`, `BASS-II/`, `SAFFIRE-1/` or source ZIPs.
- Every field stores raw representation and separate parsed value; maintain states `present`, `blank`, `dash`, `none`, `approximate`, `range`, `invalid`, `not_applicable`.
- `0`, `none`, `-1`, `OR`, `over`, `>500`, `~6`, `21.5 - 21.7`, `250>50>250` are NOT interchangeable.
- Preserve BASS-II fan/air **sequences**, do not average stages without a physical justification.
- SAFFIRE-I 2 scientific burn rows + 2 image reference rows are separate entity types.
- Normalize oxygen to percentage only for compatible presentation, preserve original mole-fraction and the measurement/control role.
- Do not pool CO₂ diluent (FLEX input) with CO₂ combustion product (BASS-II output).
- Do not mark uncertain flow conversions as calibrated when no matched calibration exists.
- All percentages, correlations, fits and summary metrics must be recomputed by code from original/curated data, not copied from Markdown reports.

---

## 2. End-user workflow and information architecture

### 2.1 Primary navigation

```text
SpaceFire AI
├── Overview                         /
├── AI Research Assistant            /assistant
├── External Research                /research
├── Experiment Explorer              /experiments
│   └── Experiment Detail            /experiments/{dataset}/{uid}
├── Compare Experiments              /compare
├── Evidence Explorer                /evidence
├── Physics Lab
│   ├── FLEX                          /physics/flex
│   ├── BASS-II                       /physics/bass-ii
│   └── SAFFIRE-I                     /physics/saffire-i
├── Similar Experiments              /similar
├── Data Quality                     /quality
├── ML Prediction (optional)         /ml/flex
└── Methodology & Sources            /methodology
```

### 2.2 Visual/layout specification (based on approved mockup)

- Left sidebar desktop, collapsible mobile drawer; logo *SpaceFire AI*; menu groups aligned with navigation above.
- **Overview center:** top Earth/ISS hero with subtitle and CTA buttons; three dataset summary cards; scientific insights; real Plotly chart; quick action tiles.
- **Right assistant rail desktop:** contextual AI Research Assistant preview with query, cited short answer, evidence list; on mobile convert to sheet/tab, never conceal essential content.
- Dashboard cards use subtle outlines/glows; orange for interaction/calls-to-action, cyan for scientific data, purple for link/secondary signals; color must not be only means of status indication.
- All hero/art imagery is decorative. Never present decorative or AI-generated image as a photograph of a particular experiment.
- Header: global search icon, data state, current import timestamp, active source status if useful.
- On all views: loading skeletons, empty state, API-offline state, retrieval-no-results state, source-unavailable warning, error retry.
- Charts: axis names + units, legend, sample count n, filters applied, scatter hover values and source links; distinguish measured/derived/approximate with legend or markers.
- English UI by default; accept Vietnamese questions in assistant where LLM provider supports; dataset labels retain exact NASA naming.
- WCAG-minded keyboard navigation, focus state, semantic headings, minimum readable contrast.
- No decorative CTA without real navigation/operation.

### 2.3 Global cross-screen actions

- Open any experiment ID from search, chart point, similar-result card, or citation.
- Copy/share a URL containing query filters or experiment identifier (no account required).
- Download a CSV of **currently filtered** rows with provenance columns; distinguish source-original vs normalized export.
- Open source document/DOI via citation; PDF viewer deep-links to page when possible.
- Back navigation retains filters/query.
- Data-source list shows what's local, what's external, source date and known limitations.

---

## 3. Screen / feature acceptance requirements

### F12 — Overview (`/`) [P0]

**UI:** hero, `FLEX 274 / BASS-II 129 / SAFFIRE-I 2`, investigation cards with descriptions, *Key Insights* citations, one interactive FLEX chart and Quick Actions for 6 core tools. **Function:** stats queried from `/api/v1/overview` not hard-coded; clicking insight opens evidence or filtered chart; assistant rail accepts question and opens `/assistant` with context. **Done when:** 3 dataset counts verified against import summary; chart responds to filter; every action works; no fabricated chart series.

### F01 — AI Scientific Research Assistant (`/assistant`) [P0]

**Inputs:** free-text question, internal/external/all source scope, investigation filter, follow-up context. **Processing:** classify intent → structured tools and/or internal hybrid search and external literature search → evidence fusion → LLM structured response → numeric/citation validation. **Outputs:** concise answer + claims with `DOC/COMPUTED/EXTERNAL/HYPOTHESIS`, citation list, derived chart/table if available, links to experiments/papers, limitations and suggested next research question.

**Supported question types:** experimental count/range, specified test details, scientific mechanism from report, comparison under matched filters, relevant studies, exact reference DOI, data-quality anomaly explanation, cannot-answer/unsupported claims.

**Mandatory cases:** if no LLM key configured, user can still use search and retrieved evidence; explicitly show that AI synthesis is unavailable, do not return an AI-generated-looking canned answer. Missing data => abstain; if evidence conflicts, show discrepancy instead of choosing silently. Query, tool calls and citations auditable via structured debug logs (without leaking secrets).

**Done when:** 10 golden questions from different scopes pass factual/citation checks; direct question about `Disruption` label returns its uncertain definition; no raw source-supplied prompt instructions are executed.

### F02 — External Scientific Research (`/research`) [P0]

**Purpose:** find literature beyond the local dataset, especially papers cited by NASA reports or newer work connected with microgravity combustion.

**Source adapters (order):** NASA NTRS and OpenAlex **must work**; Crossref DOI metadata validation if needed; Semantic Scholar/arXiv optional adapters after initial integration. Use official supported APIs/feeds, well-behaved rate limits, timeouts, retries/backoff, caching, and attribution; no unstable scrape or assumed unrestricted full-text access.

**Search UI:** keyword/DOI/title input, date range/year, author, source, open-access flag, sort by relevance/date, pagination, paper detail drawer. Each record: title, authors, year, venue, DOI, canonical URL, source provider, abstract if permitted, access type, ingestion timestamp.

**Related Research:** on `Evidence Detail` or `Experiment Detail`, discover related papers by DOI/citation/title/key concepts; distinguish citation links from semantic similarity. Exact DOI dedupe across providers.

**Answer integration:** optional external retrieval invoked for research/literature/current/latest requests or user-chosen scope; do not send all everyday CSV requests online by default. An external abstract can support *what the abstract states* but not unseen table values, specific experimental metrics, or full-paper claims. Explicitly indicate `abstract only` vs `full text read`.

**Failure behavior:** external providers are down/limited → internal functions remain operational; show 'External sources temporarily unavailable' and cached metadata age, never pretend fresh search succeeded. Respect fair use/license; cache metadata, not unauthorized paywalled bodies.

**Done when:** one paper can be found using NASA NTRS; one using OpenAlex; DOI dedupe and outbound link work; external failure gracefully handled; assistant cites verified external record without inventing the paper's results.

### F03 — Experiment Explorer (`/experiments`) and Detail (`/experiments/{dataset}/{uid}`) [P0]

**Explorer:** dataset switch, global ID search, faceted filters, numerical min/max filter (dataset-specific), sort, pagination (20/50/100), export filtered CSV, reset. FLEX filters: fuel, O₂, P, droplet diameter, outcome. BASS-II: PI, material/geometry, initial O₂, restrictor, available CO/CO₂. SAFFIRE-I: sample ID, flow direction, burn time. Show raw/normalized availability badges.

**Detail:** exact source path, source row index, original header + value, normalized value/unit and correction evidence, quality flags, related report excerpts with page link, related studies, compare/add button, similar tests button. Stable `uid` must survive sorting and filtering; sample labels alone not guaranteed unique.

**Done when:** all 405 main records accessible, `193F001` duplicates have distinct canonical URLs, BASS-II `GMT` shown as day-of-year, SAFFIRE image-set rows do not count as burns.

### F04 — Experiment Comparison (`/compare`) [P0]

**Selection:** 2–5 records from same investigation. **View:** side-by-side table, numeric delta/ratio where mathematically applicable, chart selector for compatible numeric attributes, n, units, source link. **Cross-investigation:** show qualitative evidence comparison and explicit incompatibility warning; no direct numeric normalization of dissimilar burn times or gas roles. **Done when:** comparing FLEX 2 valid experiments yields appropriate plot; mixing FLEX and BASS-II never shows invalid shared-axis plot.

### F05 — Evidence Explorer & Ranking (`/evidence`) [P0]

**UI:** text query, investigation, source type (NASA report/curated table/external abstract), research-year filter, evidence cards with snippets, page/section, clickable source, claim type, explanation for rank. **Ranking:** hybrid BM25 + vector + metadata; transparent features include exact ID match, semantic relevance, direct experiment linkage, source scope, amount of actual supporting text. Do not call heuristic score a calibrated confidence probability.

**Details:** results keyed to `evidence_chunk_id`; a snippet must actually occur in the indexed document; unique citation string. **Done when:** exact `M5`, `BASS-II Table 5.1`, `FLEX d²-law`, and `SIBAL` search find expected relevant documents and preserve page/section.

### F06 — FLEX Physics Lab (`/physics/flex`) [P1]

- Scatter/map: initial droplet diameter (mm) vs initial oxygen (mole fraction or %), symbol/color = recorded outcome, filters by fuel, pressure band and diluent; show n for each category.
- Additional charts: burn time vs D0 under filters; visible flame extinction diameter ratio vs oxygen where both defined.
- Physics check: d²-law `D(t)^2 = D0^2 - K*t`, estimate `t_est=(D0²-Dext²)/K` for valid K>0, D0>=Dext and meaningful endpoint; compare to reported burn time with robust error metrics, **label this consistency analysis, not an independent prediction**.
- Exclude or flag invalid pressure=0, missing diameter, anomalous Dext, approximate burn time; show included/excluded n and reasons.
- Do not assign exact LOI value without defensible calculation & validation.
- **Done when:** chart points map to valid FLEX record; formula tests pass on synthetic known inputs; excluded cases visibly identified.

### F07 — BASS-II Physics Lab (`/physics/bass-ii`) [P1]

- Material/fuel geometry filters and faceted comparisons; raw and normalized material taxonomy.
- Calculate `delta_O2 = final_O2 - initial_O2`, `delta_CO2`, `delta_CO` only where both endpoints numeric and physically interpretable; show units and n.
- Plot oxygen consumption vs CO₂ increase, overlay appropriate report-based theoretical reference only with documented assumptions and subset (e.g. PMMA if relevant); highlight significant outliers as quality flags, not automatically repaired.
- `Fan display` mixed-control sequence and `Air display` multi-stage history shown as text or structured stages; optional calibrated velocity only when calibration provenance matches.
- Link to curated BASS-II Summary Report tables and observation excerpts where IDs match.
- **Done when:** BASS-II chart reproducible from source records, missing `OR`/`over` not parsed as numbers, scientific limitations visible.

### F08 — SAFFIRE-I Case Study & Timeline (`/physics/saffire-i`) [P1]

- S1 vs S2 overview: SIBAL, 20 cm/s nominal airflow, concurrent/opposed, CSV burn time 420 vs 70 s, reported O₂ ranges, ignition settings.
- Build downsampled metadata timeline from 12-sheet XLSX manifest: image-set/camera, UTC timestamp coverage, count, received/corrupted/missing when derivable; export summary CSV; show availability gaps.
- `F1` pre-flow and `F2` post-flow as evidenced in DoD/workbook, preserve CSV discrepancy with visible warning.
- No image thumbnails unless actual image bytes exist; no flame front/speed/heat graph invented from filenames or JPEG file sizes.
- **Done when:** S1/S2 comparisons work and frame timeline derived from manifest; zero simulated scientific sensor data.

### F09 — Similar Experiments (`/similar`) [P1]

- Search restricted **within investigation and comparable experiment family**, not one vector space of all three datasets. FLEX: initial fuel, pressure, O₂ and diluent composition, D0. BASS-II: material, geometry and initial O₂; flow settings only when comparable/calibrated. SAFFIRE-I: explain similarity ranking is not meaningful with n=2, show comparison instead.
- Distance: robust scaled numeric + weighted categorical matching, null-aware weight renormalization; optionally Gower; explain per-field differences and n. Weight defaults documented and configurable server-side.
- No `Test end`, burn time, post-burn CO/CO₂, burning rate, extinction diameter as input features when matching **initial conditions**.
- **Done when:** top k stable deterministic for repeated queries and attributes/weights shown; obvious mismatches are penalized.

### F10 — Data Quality & Scientific Validation (`/quality`) [P1]

- Cards by dataset and severity; filters for missing/invalid/inconsistent/duplicate/document conflict/source warning.
- Required detection suite: FLEX identifier duplication, missing/dash/approximate, pressure=0, Dext>D0, composition sum tolerance; BASS-II mixed fan readings, nonnumeric gases, suspicious final O₂, inconsistent dates/DOY, repeated sample & correlated tests; SAFFIRE S1/S2 only, F2 label discrepancy, length/width ambiguity, metadata timeline availability.
- Every issue: original file, row/column, original representation, rule, derived value if any, status `reported/confirmed/disputed/unresolved`, proposed correction only with citation.
- Never modify raw data as part of fixing flags; preserve ingestion/audit reports.
- **Done when:** user can navigate from quality issue to exact experiment and evidence and export issue list.

### F11 — FLEX Machine Learning Prediction (`/ml/flex`) [P2 conditional]

- Baselines: DummyRegressor/Classifier, Ridge/LogisticRegression, RandomForest or GradientBoosting. Use documented pre-experiment-only features. Groups of related test conditions must not leak between training and test; GroupKFold or conservative held-out composition/fuel groups with explanation.
- Targets (evaluate separately): valid burn time, or carefully defined outcome subset. `Disruption` should be excluded/handled as unresolved or potentially censored; never silently count as extinction.
- Report n, splits, MAE/RMSE or F1/balanced accuracy, baseline comparator, calibration/uncertainty, limits of extrapolation, OOD warning; publish only if beats trivial baseline and passes data leak review.
- If validation fails, feature page becomes "Model Feasibility & Evaluation" and prediction input disabled, with scientifically honest explanation.
- **Done when:** no fake impressive accuracy and artifact+metrics reproducible from versioned script/seed/data hash.

---

## 4. Technical architecture

```text
[Next.js Frontend]
      │ typed REST + optional SSE for LLM progress
      ▼
[FastAPI Application]
  ├── experiment_service (filter, detail, compare)
  ├── analytics_service (FLEX/BASS/SAFFIRE)
  ├── quality_service (validation, provenance)
  ├── literature_service (NTRS/OpenAlex/DOI adapters)
  ├── retrieval_service (FTS5 + vector, citations)
  ├── answer_service (intent route, tools, provider, verify)
  └── similarity_service (+ gated ml_service)
      │
      ├── [SQLite relational + FTS5]
      ├── [Vector index + immutable chunk metadata]
      ├── [Processed deterministic exports]
      └── [Immutable original repo files: FLEX/BASS-II/SAFFIRE-1]
```

**Scope:** single repo with `frontend/`, `backend/`, `scripts/`, `processed/`, `docs/`, `tests/`, `research/`; original folders remain intact. `processed/`, local DB, vector indexes and caches can be regenerated and should usually be gitignored except small static demo fixtures and manifest. Source PDF URL/relative path must not break when moving app code.

### 4.1 Suggested repository layout

```text
NASA Hackathon/
├── FLEX/                   # original; read-only
├── BASS-II/                # original; read-only
├── SAFFIRE-1/              # original; read-only
├── research/               # prior research reports; read-only
├── frontend/
│   ├── app/                # routes
│   ├── components/         # charts, citations, tables, layout
│   ├── lib/api.ts          # typed backend calls
│   └── ...
├── backend/
│   ├── app/api/v1/
│   ├── app/core/            # settings, errors, tracing
│   ├── app/db/              # migrations/models/queries
│   ├── app/ingest/          # csv, document, workbook, metadata
│   ├── app/services/        # experiments/research/RAG/analytics
│   ├── app/providers/       # LLM + NTRS/OpenAlex/other adapters
│   ├── app/schemas/         # Pydantic contracts
│   └── tests/
├── scripts/                 # build_db, build_index, smoke_test
├── processed/               # generated; gitignored as appropriate
├── docs/                    # API, scientific methods, demo
├── .env.example             # NO secrets
├── Makefile or scripts/*.ps1
├── docker-compose.yml       # optional
└── README.md
```

### 4.2 Database entities (minimal normalized design)

| Table | Key fields | Required notes |
|---|---|---|
| `investigations` | `investigation_id PK`, `title`, `psi_id`, `description`, `scale` | 3 known investigations |
| `source_files` | `source_id PK`, `relative_path`, `sha256`, `media_type`, `ingested_at`, `parse_status`, `access_status` | full source provenance |
| `experiments` | `experiment_uid PK`, `investigation_id FK`, `source_id FK`, `source_row`, `display_id`, `experiment_kind` | `experiment_kind=burn` vs `image_set` |
| `observations` | `observation_id PK`, `experiment_uid FK`, `raw_field`, `raw_text`, `numeric_value`, `text_value`, `normalized_name`, `unit_raw`, `unit_normalized`, `value_kind`, `measurement_role` | role: input/output/instrument/identifier |
| `quality_flags` | `flag_id PK`, `experiment_uid nullable`, `observation_id nullable`, `rule_id`, `severity`, `description`, `source_ref`, `status` | disputed allowed |
| `documents` | `document_id PK`, `source_id FK`, `title`, `authors`, `year`, `investigation_id`, `doc_type`, `rights` | original PDF/DOCX/PPTX |
| `document_chunks` | `chunk_id PK`, `document_id FK`, `page_pdf`, `page_printed`, `section`, `text`, `content_hash`, `is_verified` | immutable chunk citation |
| `evidence_links` | `link_id PK`, `experiment_uid FK nullable`, `chunk_id FK`, `relation_type`, `match_method`, `review_status` | `explicit_id`, `material_scope`, etc. |
| `external_papers` | `paper_id PK`, `doi UNIQUE nullable`, `canonical_url`, `title`, `authors_json`, `year`, `venue`, `abstract`, `access_type`, `provider_json`, `last_checked_at` | metadata dedupe |
| `analysis_runs` | `analysis_id PK`, `analysis_type`, `input_filter_json`, `formula`, `result_json`, `n`, `source_hashes_json`, `created_at` | reproducibility |
| `model_runs` | `run_id PK`, `target`, `feature_set_json`, `split_strategy`, `metrics_json`, `artifact_path`, `source_hash` | P2 only |

**Canonical UIDs:** `flex:{source_row_number}`; `bass2:{source_row_number}`; `saffire1:S1`; `saffire1:S2`; image sets `saffire1:images:F1` and `...:F2` if exposed in manifest API. Maintain alias mapping (`display_id`, test `#`, sample `#`) and duplicates explicitly. Do not make format-dependent assumptions about unique IDs.

**Database indexes:** investigation+experiment kind, `(investigation_id, display_id)`, numeric observation search materialization where needed, FTS5 chunk text, DOI unique normalization and source SHA-256 unique/hash lookups.

### 4.3 Ingestion scripts

1. Inventory recursively; verify source file hashes; skip identical duplicate content; preserve inventory JSON with counts and errors.
2. Parse FLEX CSV with encoding cp1252 and CSV quoting; assert 15 columns and 274 rows against snapshot but don't assume unchanged repo silently.
3. Parse BASS-II UTF-8 BOM; preserve 17 raw fields and all 129 rows, mixtures of fan/air strings; normalize using documented FAQ and calibration only where justified.
4. Parse SAFFIRE-I CSV 4 rows; separate 2 burns from F1/F2 image manifest descriptions; do not create 4 burns.
5. Parse XLSX by stream/read-only iteration; 12 sheets; metadata/frame status with UTC derived under verified epoch convention; produce compact downsampled time-series with counts, not physical fire measurements.
6. Extract PDF/DOCX/PPTX/TXT with pagination/section and hash; verify document title/scope; index text chunks with source_page.
7. Curate BASS-II Summary Report Tables 2.1, 5.1, 7.1 and selected Appendix A observations into `processed/curated/` with explicit `source_filename`, `page_pdf`, `row_original`, `verified` flag. Avoid automatically treating unreconciled PDF table extraction as final truth.
8. Run audit flags; emit machine-readable ingestion report and warnings, no silent fix.
9. Build sparse index and optional local dense index; support a partial-index graceful mode if embedding model unavailable.
10. Regeneration is idempotent: same inputs and version produce same record counts/UIDs (ignoring timestamps); add `--force`/`--dry-run` where helpful.

### 4.4 LLM and RAG pipeline

```text
Question → intent classifier / explicit mode
  ├─ factual row/stats/compare → whitelisted SQL/analytics functions
  ├─ mechanisms/explanations → local hybrid evidence search
  ├─ literature/latest/DOI → external scholarly search + local search
  └─ mixed → parallel sources with labeled provenance
→ metadata-aware retrieval → evidence ranking → structured synthesis
→ numeric-verification + citation-verification
→ typed API response → frontend evidence display
```

**Whitelisted tools** (no arbitrary user-issued SQL): `get_experiment`, `search_experiments`, `compare_experiments`, `aggregate_experiments`, `get_document_evidence`, `search_literature`, `get_paper_metadata`, `flex_d2_check`, `bass_gas_deltas`, `get_similar_experiments`, `list_quality_flags`.

**Chunking:** 300–600 tokens target, overlap ~10%; preserve section/table boundaries, formula+caption, PDF page and printed-page map where known, test IDs; page-limited snippet source. Exact ID and formula queries require sparse matching; conceptual queries use dense matching. Reciprocal rank fusion + optional rerank after P0. Separate text index from SQL numeric data.

**Answer JSON contract:**

```json
{
  "question": "...",
  "answer": "Short grounded explanation, with visible citation markers.",
  "status": "answered | partial | insufficient_evidence | retrieval_only",
  "source_scope": "internal | external | both",
  "claims": [
    {
      "text": "...",
      "kind": "DOC | COMPUTED | EXTERNAL | HYPOTHESIS",
      "citation_ids": ["cite-1"],
      "conditions": "Applicable population/filters and limits"
    }
  ],
  "citations": [
    {
      "citation_id": "cite-1",
      "source_type": "local_document | experiment | external_paper",
      "title": "...",
      "url": null,
      "document_id": "...",
      "experiment_uid": null,
      "page_pdf": 12,
      "section": "...",
      "excerpt": "...",
      "access_level": "fulltext | abstract | metadata | experiment"
    }
  ],
  "charts": [],
  "limitations": [],
  "suggested_followups": []
}
```

**Verifier:** every claim with a measurement must cite an actual experiment or a deterministic `analysis_runs` result; validate cited IDs are in retrieved context and unit/value occur in tool results; reject fabricated page numbers or DOI. The LLM is not authoritative for calculations. On validation failure: regenerate once with corrective context or return partial/abstention with raw retrieved evidence. For an external paper where only metadata/abstract is available, no full-text conclusion or exact paper graph may be asserted.

**Prompt-injection protection:** treat all document text, titles and provider results as untrusted source data, NEVER instructions; only allow whitelisted actions, no tool execution from document text; avoid leaking secret keys through prompts or logs.

### 4.5 Evidence ranking design

- Inputs: lexical score, semantic score, experiment ID exact match, investigation-specific match, directness (measured > same test report > general background), abstract/fulltext accessibility, freshness *only for latest-literature requests*, data quality.
- Fuse retrieval ranks; apply explainable source types; use rank labels (`High relevance`, `Related background`, `Metadata-only`) rather than unsupported numeric confidence.
- Show top reasons (e.g. `Exact test M5`, `NASA report p.47`, `Title match: droplet extinction`, `Abstract only`).
- Any re-ranking must not fabricate new documents; every result is an existing source object.

### 4.6 External-source contract

- NASA NTRS: official public search endpoint/access pattern, DOI/citation resolvers; provider adapter own DTO, caches request metadata, respects pagination.
- OpenAlex: official API, normalized work ID, DOI, OA metadata, abstract reconstruction only when provided via API terms.
- Crossref (optional validation): DOI registrant metadata; do not claim every DOI resolves to open-access PDF.
- Semantic Scholar/arXiv (optional): rate-limited adapter and clear metadata provenance.
- Timeouts, network failures, HTTP 429 backoff; no crash of internal search.
- Default cache TTL e.g. 24 h for discovery (configurable), expose `last_checked_at` and `is_stale` in UI, offline results labeled cached.
- Persistent storage of external fulltext only when permitted and correctly attributed; otherwise index accessible abstract/metadata only.

---

## 5. REST API specification (`/api/v1`)

**General:** JSON, ISO-8601 UTC, stable snake_case keys, versioned DTOs, HTTP error envelope (`error.code`, `error.message`, `request_id`), pagination cursor or page/page_size, filter schema validation, safe max limits and parameterized SQL.

| Method | Endpoint | Contract |
|---|---|---|
| GET | `/health` | DB, index, external configuration status (not secrets) |
| GET | `/overview` | investigation counts, curated insights and overview charts source references |
| GET | `/investigations` | all 3 and metadata |
| GET | `/experiments` | filter/query/sort/page dataset-specific, return `total`, `items`, facets |
| GET | `/experiments/{uid}` | raw + normalized fields, flags, evidence links |
| POST | `/experiments/compare` | 2–5 UIDs; returns compatible fields, chart data, warnings |
| GET | `/experiments/{uid}/similar` | top-k within dataset, normalized feature diffs |
| GET | `/evidence/search` | hybrid query, filters, ranked chunks and snippet citations |
| GET | `/evidence/{chunk_id}` | exact chunk and source link/page |
| GET | `/documents` | source documents, filters, metadata |
| GET | `/documents/{document_id}` | metadata/source file URL/page availability |
| GET | `/research/search` | external scholarly search, fields, normalized results |
| GET | `/research/doi/{doi}` | DOI lookup/verification if available |
| GET | `/research/{paper_id}/related` | related studies, provenance |
| POST | `/assistant/ask` | structured grounded answer, typed citations |
| GET | `/analytics/flex/map` | filter, scatter/aggregates, n, exclusions |
| GET | `/analytics/flex/d2` | UID or filter, formula, residual and flags |
| GET | `/analytics/bass/gases` | input filters, O₂/CO₂/CO deltas & distribution |
| GET | `/analytics/saffire/timeline` | series of metadata-counts by camera/time, UTC |
| GET | `/quality/flags` | filters, severity, pagination, source refs |
| GET | `/quality/summary` | counts, rules, affected source rows |
| GET | `/exports/experiments.csv` | filtered, authorized local export, explain provenance |
| GET | `/ml/flex/metrics` | available only if P2 model validated |
| POST | `/ml/flex/predict` | 501/disabled with rationale unless P2 acceptance met |

Example request:

```http
POST /api/v1/assistant/ask
Content-Type: application/json

{
  "question": "What does the NASA data say about methanol extinction below 17.5% oxygen?",
  "source_scope": "both",
  "investigations": ["PSI-69"],
  "context_experiment_uids": []
}
```

Example `GET /experiments/flex:2` response highlights: `uid: flex:2`, `display_id: 20CAL10`, `source_row: 2`, normalized fuel/pressure/oxygen, `raw_fields` exact header strings, `quality_flags`, `citations`; for every derived field include derivation references. Numerical values are populated by code from source, never copied from examples into production.

**Status/error behavior:**

- 400 invalid filter or incomparable dataset combination.
- 404 missing experiment/document.
- 422 invalid request schema.
- 429 provider/backend throttled with retry info.
- 503 LLM or external provider unavailable, while DB-only endpoints remain healthy.
- 200 with `status=insufficient_evidence` for valid research question with no support.

---

## 6. Cross-cutting functional requirements

### 6.1 Search, export and deep links

- Search must support exact IDs, scientific text, normalized field aliases, DOI and readable error messages.
- Filtering/sorting/pagination server-side, not only on partial frontend list.
- URL encodes view state for sharable navigation; citations link to a real on-disk document or resolvable external URL.
- Export does not invent nulls and includes `source_id`/`experiment_uid`/quality indicators.

### 6.2 Performance targets (acceptance goals, not measured facts)

- First local overview load ≤3 s after warm server on typical developer laptop.
- Filtered experiment page ≤1 s median after warm DB and index.
- Local keyword evidence search ≤2 s median; embedding mode may warm up separately.
- Assistant shows loading/progress and timeout message; no indefinite spinner.
- SAFFIRE XLSX heavy parsing occurs offline at ingestion, not on request.
- No requirement for GPU, GPU-specific CUDA, or large model weights.

### 6.3 Security and maintainability

- `.env.example` documents `LLM_API_KEY`, `LLM_PROVIDER`, `LLM_MODEL`, `DATABASE_URL`, `EXTERNAL_SEARCH_ENABLED`, cache TTLs; real `.env` excluded from git.
- Backend restricts CORS to configured UI origins, no unrestricted shell or SQL via LLM; document paths guarded against traversal.
- Typed schemas for all data; centralized errors, request IDs, retry/rate limit on external calls.
- Use service interfaces / dependency injection for providers; ability to swap LLM provider without refactoring web UI.
- Test fixtures isolated from raw datasets; no expensive embedding/model downloads inside ordinary unit test.
- Preserve file hashes and ingestion manifest for reproducibility.

### 6.4 Offline and graceful degradation

| Failure | Product behavior |
|---|---|
| No LLM API key | Experiment Explorer, charts, local evidence and external search still work; assistant explicitly shows retrieval-only |
| No external internet | Local data and RAG remain; external tab shows unavailable/cached with freshness labels |
| Embedding model missing | FTS5/BM25 search works; show lexical-only mode |
| PDF extraction fails | Source file flagged, unavailable page not fabricated, other docs indexed |
| Bad CSV row | Log and flag row, preserve raw; do not silently drop all data |
| SAFFIRE manifest too big | Use precomputed aggregates; ingestion error clear and nonfatal to other datasets |
| ML training inadequate | Prediction disabled and model evaluation available; no fake accuracy |

---

## 7. Validation, tests and definition of done

### 7.1 Automated test layers

**Unit tests**

- FLEX cp1252, en dash vs blank, approximate values, pressure=0; duplicate `193F001` stable UIDs.
- BASS-II `GMT` day-of-year; fan/air multi-stage preservation, `OR`, `over`, `>500` not cast incorrectly; only valid O₂/CO₂/CO deltas.
- SAFFIRE two burns and F1/F2 descriptors, S1/S2 values, UTC conversion and frame manifest aggregation.
- Unit normalization with explicit data-source evidence, no opposite meanings mixed across datasets.
- Formula known-case checks for d²-law and gas calculations, filtered counts/exclusions.
- Source hash/dedup and correct page citations; exact ID retrieval.
- External provider DTO normalization, DOI dedupe, HTTP failures/timeouts, cached-stale label.
- JSON schema validation for AI answers and rejection of nonexistent citation IDs.

**API integration tests**

- Every route tested for valid payload, invalid payload, not-found, pagination, typed response.
- All mandatory `P0 + P1` endpoints return data or explicit supported unsupported states, not 200 placeholders.
- Mock external providers so tests run without internet/API keys.
- 10+ source-grounded answer cases with different question intents.

**Browser E2E smoke tests**

- Overview → select FLEX → filter oxygen → open experiment detail → source evidence.
- Choose 2 BASS-II tests → compare → plot and citation.
- Assistant ask → receives structured answer or explicit no-LLM retrieval fallback.
- External literature query → list with DOI/URL; failure still leaves local app usable.
- Physics Lab FLEX d²-law and BASS-II gas analysis.
- SAFFIRE timeline real manifest aggregates.
- Data-quality flag → exact source record.
- Similar test search → input-feature explanation.
- Mobile nav and disabled ML state (if P2 skipped).

### 7.2 Research golden question suite

Create `tests/golden_questions.jsonl` with >=40 questions and expected evidence types (not frozen exact LLM prose), split among dataset facts, mechanism, comparison, external paper, ID, anomalies and unanswerable cases. Example requests:

1. Count FLEX Methanol vs Heptane test rows.
2. Show FLEX identifier `193F001` and explain duplicate ambiguity.
3. Can the column named `CO` in FLEX be interpreted as CO₂? Cite the basis.
4. What does `Burning rate; mm` mean and what unit is consistent with d²-law?
5. Does `Disruption` definitively mean extinction? (Expected: unknown).
6. How does BASS-II `GMT` differ from ordinary clock time?
7. Compare BASS-II before/after CO₂ for a selected valid test.
8. Which tests contain multistage fan settings and why is a single velocity misleading?
9. What are SAFFIRE-I S1 and S2 nominal burn times and flow directions?
10. Does the SAFFIRE XLSX contain actual flame-front measurements? (Expected: no).
11. Find recent research related to cool flames; separate paper metadata and read full text.
12. What is the exact safe O₂ threshold for an occupied future spacecraft? (Expected: cannot infer).

### 7.3 Gated release criteria

**Gate 0 — Sources:** import logs show 274+129+2 burns, hash manifest, baseline docs index, no raw mutation.

**Gate 1 — P0 functional:** overview, assistant, external literature search (2 providers), experiment explorer/detail, compare, evidence search/ranking; each has working API + UI + test.

**Gate 2 — P1 functional:** both Physics Labs, SAFFIRE case study/timeline, similarity, Data Quality; working API + UI + deterministic math.

**Gate 3 — Scientific QA:** no fake results, existing citations resolvable, 40 golden questions created and representative sample manually verified, schema warnings visible.

**Gate 4 — Delivery:** working frontend/backend commands on Windows PowerShell and Linux shell; `.env.example`; `README.md` (setup, data rights, known issues, demos); OpenAPI docs; `docs/IMPLEMENTATION_STATUS.md` with per-feature DONE/PARTIAL/BLOCKED and real evidence.

**Gate 5 — P2 optionally:** only after above pass; model evaluation transparent, gating successful, prediction enabled with OOD warnings or explicitly disabled with report.

### 7.4 Quantitative / operational acceptance checks

| Check | Pass |
|---|---|
| Data import | 274 FLEX, 129 BASS-II, 2 SAFFIRE burns from current snapshot; exceptions documented if upstream changes |
| Provenance | 100% of source-backed UI measurement claims link to source file & field/row, or document/page |
| External | NTRS and OpenAlex discovery both demonstrated or source-specific documented blocker with working adapter tests |
| Internal evidence | At least one verified exact-page citation each for FLEX and BASS-II, source-document links usable |
| Numerics | Every chart includes units, n, filters and exclusion rules |
| RAG | No fictional DOI, page, numeric value on golden-question validation |
| Responsiveness | No critical overlap on 390px mobile and 1440px desktop |
| Failure resilience | Local experiment browser works without external service keys/network |
| P0/P1 pages | Every route has functional action and passes smoke; no dead buttons or mock science data |
| Owner handoff | One-command or well-documented local start; tests runnable; no repo-source mutations |

---

## 8. Implementation roadmap / Claude Code execution protocol

### 8.1 Priority, dependencies and milestones

| Milestone | Modules | Required demonstration |
|---|---|---|
| M0 — Scan & scaffold | verify source inventory, create frontend/backend skeleton, env examples, architecture README | run API health + UI shell; source hashes verified |
| M1 — Data foundation | CSV parser, SQLite schema, report extraction, SAFFIRE manifest, quality rules | DB has correct counts, direct experiment GET works, unit tests pass |
| M2 — P0 researcher workflow | Overview, Explorer/Detail, Compare, Evidence Search, citation deep links | browser route end-to-end for 3 datasets, report citations |
| M3 — AI + external research | NTRS/OpenAlex, evidence ranking, assistant orchestrator, fallback | one internal question + one external literature question with source links |
| M4 — P1 scientific labs | FLEX/BASS physics, SAFFIRE case/timeline, Similar, Data Quality | each screen computes real data and points to source |
| M5 — hardening | integration/E2E, performance, QA, README/demo, Windows setup | all P0/P1 gates pass; status report with caveats |
| M6 — optional ML | leakage-safe FLEX baseline, evaluation only then prediction | reproducible metrics vs dummy, or documented no-go |

**No time estimate promise:** Milestones are ordered by dependency, not a guarantee of duration. Each milestone should deliver runnable tested code, not only design notes.

### 8.2 Agent work style

- Begin by reading original file tree and 10 research reports. Use them to orient, then verify claims directly where practical.
- Do NOT create a new set of 10 long research reports; use existing reports. Create code and executable tests.
- Maintain `docs/IMPLEMENTATION_STATUS.md`: feature table, milestone, tests, demo verification, known limitations, next task.
- Run unit/integration/E2E checks at each milestone; keep app runnable on `main` working tree; avoid large all-at-once changes.
- Do not spend time on elaborate UI first: implement one end-to-end vertical slice, then apply visual style to all modules.
- When third-party API fails, document provider/HTTP issue and keep internal features working; never fake success.
- Review exact data field semantics before using any new numeric output; all science derived in typed deterministic functions.
- No git push/PR/commit unless explicit user request; local changes can be generated and verified.
- Do not fetch large raw media or pretrain large AI models.
- Stop only on truly blocked external requirements (e.g. missing API key); continue all independent modules and document blockers.

### 8.3 Preflight tasks and commands to generate

- `scripts/setup.ps1` (Windows), `scripts/setup.sh` (Linux/macOS): install project-specific dependencies, create env template if absent, warn missing LLM key without breaking local app.
- `scripts/ingest.py` or `python -m app.ingest`: deterministic ingest and index build.
- `scripts/start.ps1` or documented two-process local run; optional Docker Compose.
- `scripts/smoke_test.py`: API connectivity, counts, retrieval and analytics sanity.
- `README.md`: environment prerequisites, reproducible steps, external API usage/limits, citation/source policy, architecture, feature matrix, demo prompts and known limitations.
- Avoid using placeholder credentials or claiming keyless LLM synthesis works.

---

## 9. Demo narrative (3–4 minutes)

1. **Overview:** NASA datasets (274/129/2), full source transparency, major scientific difference between liquid droplet / solids / large-scale fires.
2. **FLEX:** filter Methanol and O₂, click scatter point to see underlying row, show d²-law consistency and one correction flag (`CO` label or K unit) with evidence.
3. **BASS-II:** select a valid material/test, compare CO₂/O₂ before and after, open exact source page with experiment ID.
4. **External Research:** query NTRS/OpenAlex about cool flames or flame spread, open DOI/canonical publication URL and show abstract-only label when fulltext absent.
5. **AI assistant:** ask a mechanism question; answer includes internal observations + related research with separate citation badges; ask intentionally unsupported spacecraft safety threshold and show proper abstention.
6. **SAFFIRE:** show S1/S2 and actual frame manifest timeline, explicitly acknowledge no raw media available.

**Fallback demo:** if provider API or network fails, local experiments, evidence search, visualizations and cached external results (marked stale) still work; no fake chatbot answer.

---

## 10. Source basis and traceability

The implementation is grounded in the user's `research/01_DATA_INVENTORY.md` through `research/10_EXECUTIVE_SUMMARY.md` and the original local NASA PSI files, not generic internet exemplars. Directly relevant analyses:

- **01:** inventory, duplicates and PDF/DOCX/ZIP accessibility.
- **02:** FLEX field semantics, missing symbols, test distributions, unit/CO₂ interpretations, anomaly flags.
- **03:** BASS-II sample classes, fan/air semantics, 144-page Summary Report, pre/post gas restrictions, duplicate/repeat relationships.
- **04:** SAFFIRE-I two burn rows, workbook 12 sheets and manifest-only semantics, conflicts/timeline.
- **05:** cross-dataset scientific incompatibilities, reliable semantic links, proposed normalized schema.
- **06:** scientific claim provenance and retrieval/LLM validation patterns.
- **07:** physics baselines and scholarly literature notes; external pretrained-model status must be independently verified, not taken as exhaustive.
- **08:** A vs D architecture tradeoff; choose A-core with D high-impact extensions.
- **09:** prioritization, practical engineering stack, demo and science validation.
- **10:** consolidated conclusions, known missing raw data and evidence.

Official data source links: [FLEX PSI-69](https://psi.nasa.gov/physci/repo/data/investigations/PSI-69), [BASS-II PSI-25](https://psi.nasa.gov/physci/repo/data/investigations/PSI-25), [SAFFIRE-I PSI-98](https://psi.nasa.gov/physci/repo/data/investigations/PSI-98). External discovery providers: [NASA NTRS](https://ntrs.nasa.gov/), [OpenAlex](https://openalex.org/), [Crossref](https://www.crossref.org/), [Semantic Scholar](https://www.semanticscholar.org/), [arXiv](https://arxiv.org/).

---

## 11. Final acceptance / handoff checklist

- [ ] P0: Overview counts and cards from data.
- [ ] P0: Experiment Explorer and canonical Detail for all 405 main records.
- [ ] P0: Compare 2–5 same-dataset tests, with warnings for invalid cross-dataset fields.
- [ ] P0: Scientific Evidence Explorer with exact page/snippet citations and ranking reasons.
- [ ] P0: AI Assistant with numeric verification, source provenance, honest fallback.
- [ ] P0: External research via NASA NTRS + OpenAlex, verified metadata and canonical URLs.
- [ ] P1: FLEX Physics Lab, d²-law, valid conditioning and n/exclusion counts.
- [ ] P1: BASS-II gas/material analytics with correct pre/post meaning.
- [ ] P1: SAFFIRE-I S1/S2 case and frame-manifest timeline, no fake media/sensors.
- [ ] P1: Similar experiments within compatible families only.
- [ ] P1: Data Quality viewer and per-record provenance.
- [ ] P0/P1: Tests, setup scripts, API docs, README and implementation status.
- [ ] P2 conditional: honest ML baseline/feasibility; no unsupported prediction.
- [ ] Original NASA assets unchanged and all generated artifacts reproducible.

**Definition of DONE:** every requested P0/P1 user journey demonstrably works via frontend → real API → data/retrieval/analytics → source/citation, including failure modes; no fake placeholder science outputs. A visually complete page without a functioning backend is NOT done.

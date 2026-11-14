# SPACEFIRE AI — PRODUCT & TECHNICAL SPECIFICATION

**Version:** 0.1 — Draft for approval  
**Date:** 2026-11-10  
**Status:** REVIEW ONLY — **KHÔNG phải lệnh bắt đầu triển khai**  
**Challenge:** NASA Space Apps Challenge 2026 — *Flame in Freefall: AI-Powered Fire Safety Insights from Microgravity Combustion Data*  
**Working repository:** `COngtuthien/NASA-Hackathon`, local `D:\NASA Hackathon`  
**Product name (proposed):** SpaceFire AI — *Evidence-Grounded Microgravity Combustion Intelligence*

> **Cách đọc:** `[P0]` phải có ở MVP, `[P1]` làm khi P0 ổn định, `[P2]` là mở rộng. `[DECISION]` là quyết định cần người dùng duyệt. `[SOURCE]` là thực tế rút từ 10 báo cáo Claude Code; `[PROPOSAL]` là thiết kế mới đề xuất, chưa được lập trình hoặc xác thực.

---

## 0. Executive decision sheet

### 0.1 Một câu mô tả

SpaceFire AI là **web-based scientific investigation platform** giúp người dùng khám phá thí nghiệm cháy trong vi trọng lực của NASA, truy xuất báo cáo, so sánh điều kiện thí nghiệm, kiểm chứng các quan hệ vật lý và nhận lời giải thích AI **có truy vết bằng chứng và biết từ chối khi dữ liệu không đủ**.

### 0.2 Phạm vi được đề xuất

- **Must ship [P0]:** ingestion có thể tái lập, normalized database + raw provenance, Experiment Explorer, Experiment Detail, hybrid retrieval, AI Ask có citation chính xác, evidence ranking cơ bản, Data Quality flags hiển thị trên detail, bộ câu hỏi kiểm thử và README khoa học.
- **High impact [P1]:** FLEX flammability map, d²-law diagnostics, BASS-II O₂–CO₂ balance, Similar Experiments trong từng investigation, Data Quality workspace riêng, một số liên kết thí nghiệm ↔ report có duyệt.
- **Optional [P2]:** SAFFIRE-I frame/downlink timeline, FLEX small ML baseline, song ngữ đầy đủ, multi-experiment collection/bookmarks.
- **Out of scope:** tự tải raw video/ảnh hàng GB; segmentation flame spread nếu chưa có ảnh; predictive model dùng chung 3 investigations; live spacecraft hazard scoring; safety-operation recommendations; training foundation model/fine-tune LLM; graph database phức tạp; đăng nhập và multi-user collaboration trong MVP.

### 0.3 Những quyết định phải duyệt trước khi giao code

| ID | Quyết định | Default đề xuất | Có thể thay |
|---|---|---|---|
| D01 | Tên sản phẩm | SpaceFire AI | Có |
| D02 | Strategy | P0 hoàn chỉnh rồi mới bật P1 | Có |
| D03 | UI language | English primary, Vietnamese optional later | Có |
| D04 | Visual design | Dark aerospace / scientific; accessible contrasts | Có |
| D05 | Frontend | Next.js + TypeScript + Tailwind + Plotly | Có |
| D06 | Backend | FastAPI + Python | Có |
| D07 | Data storage | SQLite (+ FTS5) cho MVP, pandas analytics | Có |
| D08 | Dense retrieval | sentence-transformers BGE small + FAISS local | Có |
| D09 | LLM mode | Provider-agnostic API config; degrade to retrieval-only | Phải chọn provider khi chạy |
| D10 | Deployment | Docker Compose / local first; public demo nếu có host | Có |
| D11 | P1 cap | H1 FLEX, H2 d²-law, H3 gas-balance trước similarity | Có |
| D12 | ML feature | Không đưa vào P0; chỉ làm sau QA | Có |
| D13 | Scientific evidence | Không kết luận thiếu nguồn; 4 loại claim | Không nên bỏ |
| D14 | Source preservation | Không sửa file gốc; artifacts generated đặt riêng | Không nên bỏ |

---

## 1. Challenge interpretation và product vision

### 1.1 Vấn đề cốt lõi

NASA có nhiều investigation về combustion trong vi trọng lực, nhưng bảng dữ liệu thí nghiệm, báo cáo, thông số thiết bị và ảnh/video được lưu ở những định dạng khác nhau. Người nghiên cứu mất nhiều thời gian để: xác định bản ghi phù hợp; hiểu tên cột và đơn vị; so sánh thí nghiệm hợp lệ; tìm kết luận trong PDF; truy ngược các tuyên bố khoa học về nguồn; nhận ra lỗi dữ liệu.

**Giải pháp:** giao diện cho *ask → retrieve → analyze → verify*, mỗi kết luận có evidence object, experiment IDs và nguồn dẫn cụ thể. “Rank” nghĩa là xếp hạng **mức liên quan của bằng chứng với câu hỏi**, không phải xếp hạng toàn cục mức an toàn của vật liệu.

### 1.2 Đối tượng người dùng

1. **Researcher/scientist:** tìm test, so sánh điều kiện, kiểm tra quan hệ vật lý, truy cập báo cáo.
2. **Engineering student:** hiểu thí nghiệm microgravity, khám phá dữ liệu và nguồn, học từ phân tích có giải thích.
3. **Fire-safety researcher:** tìm bằng chứng về oxygen limits/extinction/spread, có ghi rõ phạm vi và giới hạn ngoại suy.
4. **Hackathon judge:** có thể thực hiện demo 3 phút và xác minh ngay thông tin.

### 1.3 Job stories

- Khi tôi hỏi “How does oxygen concentration relate to methanol extinction?”, tôi muốn hệ thống lọc dữ liệu FLEX và cung cấp đồ thị với điều kiện kèm theo, thay vì một câu trả lời suy đoán.
- Khi tôi đọc Test `M5`, tôi muốn thấy giá trị O₂/CO₂/CO gốc, cờ chất lượng và báo cáo NASA có nhắc trực tiếp tới test.
- Khi tôi muốn tìm test gần giống, tôi muốn nhìn thấy **vì sao giống**, không chỉ là một similarity score opaque.
- Khi một field bị sai nhãn/đơn vị, tôi muốn biết **giá trị nguồn vẫn nguyên vẹn** và ai/tài liệu nào làm căn cứ cho dạng đã chuẩn hóa.
- Khi hỏi về exact LOI hoặc an toàn cháy cabin thật, tôi muốn hệ thống thừa nhận thiếu bằng chứng, không bịa một số.

### 1.4 Success criteria

**Product:** từ overview đến chi tiết thí nghiệm trong ≤3 thao tác; truy vấn ID cụ thể trả đúng dòng; ít nhất 3 story end-to-end sử dụng NASA data thực; tìm được tài liệu nguồn cho các kết luận được curate.

**Scientific:** 100% con số hiển thị ở analytics gắn dataset, mẫu n, bộ lọc, đơn vị; không có numerical claim của LLM không có reference; kết quả không đủ nguồn hiển thị abstention; không trộn đại lượng khác ngữ nghĩa giữa investigations.

**Operational:** chạy được trên laptop CPU 8–16 GB RAM; không cần raw media; reproducible ingestion; fallback khi LLM API mất mạng; lỗi ingest không làm hỏng dữ liệu gốc.

---

## 2. Dataset baseline & scientific guardrails

### 2.1 Inventory được xác minh theo báo cáo nguồn

| Dataset | Structured records | Other assets | Hạn chế |
|---|---:|---|---|
| FLEX / PSI-69 | 274 rows × 15 columns | reports, RRD, plan, DOI metadata | cp1252, dấu thiếu, pressure=0, duplicate identifier, mixed units |
| BASS-II / PSI-25 | 129 rows × 17 columns | 144-page Summary Report, FAQ, procedure, Test Matrix, fan calibration | multi-stage fan/air strings; measurements pre/post burn |
| SAFFIRE-I / PSI-98 | S1/S2 burns + F1/F2 references in 4-row table | 12-sheet image **manifest** workbook, DoD, Operations | NO raw images, NO physical sensor time series; cannot measure flame spread |

**[SOURCE]** 01–06 và 10. Số đếm chính dựa trên các báo cáo Claude Code; ingestion code bắt buộc tự assert lại.

### 2.2 Những quyết định dữ liệu bắt buộc

- Không thay đổi byte gốc của 3 CSV và tất cả report.
- FLEX CSV: thử UTF-8-SIG, fallback cp1252 có log; preserve `raw_text`, missing_blank/missing_dash/missing_approximate.
- FLEX raw header `CO initial ambient composition; mole fraction`: hiển thị standardized `CO₂ diluent mole fraction` **chỉ khi** bảng evidence về nhãn có sẵn; header nguồn luôn xem được.
- FLEX `Burning rate; mm`: chuẩn hóa đơn vị khoa học thành `mm²/s` với `correction_source`, đồng thời vẫn lưu chuỗi raw header `mm`.
- FLEX `Disruption`: **không tự gán** “extinction”, “failure”, “unsafe”, hay “censored” chắc chắn; outcome remains raw + `outcome_interpretation_status: unresolved`.
- FLEX duplicate `193F001`: `experiment_uid` phải dùng `dataset + row index`, không dùng chỉ `FLEX Identifier` làm primary key.
- BASS-II `GMT` trong CSV là **day of year**, không phải thời gian HH:MM; UI gọi `day_of_year` và gắn note nếu có sai khác.
- BASS-II `Fan display`, `Air display`: lưu **cả chuỗi thay đổi theo giai đoạn**; không lấy số đầu tiên rồi xem như điều kiện cả thí nghiệm.
- BASS-II `O2` và `CO2` measured `initial/final`; FLEX CO₂ input diluent. **Cấm join để tính score thống nhất.**
- BASS-II khí pre/post không phải time series; không vẽ time series giả.
- SAFFIRE CSV chỉ S1 và S2 là burn events; F1/F2 là image-set descriptors. F2 có tài liệu đối chiếu là **post-flow**, không ghi pre-flow như string raw.
- SAFFIRE workbook: filename, timestamps, received/corrupt flags, **không phải ảnh hay đo vật lý**. JPEG file-size là *uncalibrated proxy*, không coi là intensity/flame area.
- SAFFIRE chiều dài/rộng nghi đảo: lưu raw dimensions và corrected interpretation tách biệt, kèm contradiction flag.
- Không ngoại suy về an toàn của tàu thật hay exact LOI khi nguồn không hỗ trợ.

### 2.3 Dataset-specific semantics

| Canonical concept | FLEX | BASS-II | SAFFIRE-I |
|---|---|---|---|
| oxygen | ambient mole fraction setpoint | initial/final % volume measurement | approx. % volume |
| carbon dioxide | suppressant/diluent input | combustion product measurement | sensor specified, raw values unavailable |
| flame end | `Test end` categorical | report event observations, not clean label | no corresponding outcome series |
| time | burn time per droplet | no consistent CSV burn time | S1/S2 CSV burn time, image capture windows longer |
| geometry | droplet diameter mm | film/slab/rod widths/thickness | fabric large-scale dimensions |
| flow | nominally quiescent | variable forced-air settings | forced air 20 cm/s |

### 2.4 Source precedence & ambiguity policy

1. Preserve every source exactly as seen. Do not overwrite contradictory evidence.
2. A report can supply explanation of a CSV field, but does **not** automatically override measured value.
3. Any correction needs `normalized_value`, `raw_value`, `reason`, `source_refs`, `verification_status`.
4. Where sources disagree, present both with `CONTRADICTION` and explanation; no silent resolution.
5. For field with no confirmed measurement interpretation, display “not verified” rather than blank conclusion.

---

## 3. Scope-by-release / feature gates

### 3.1 Release P0 — functional, credible MVP

- F00 Overview landing, basic navigation, dataset cards.
- F01 Experiment Explorer (3 investigations) with filters and pagination.
- F02 Experiment Detail (raw, normalized, quality flags, source links).
- F03 Scientific Search / Evidence Explorer minimal (keyword + semantic).
- F04 AI Ask / Q&A with citations, source snippets, numeric grounding & abstention.
- F05 Data quality badges on tables/details, anomaly records in database.
- F06 Curated experiment/report links (high confidence exact IDs; demo exemplars).
- F07 Reproducible data ingestion + index build + API + tests.

**P0 done:** 3 user journeys succeed without hardcoded fake science; 3 datasets searchable; Ask answers or refuses appropriately; tests pass.

### 3.2 Release P1 — differentiators

- F08 FLEX Flammability Explorer (D₀ vs oxygen and outcome; filter fuel/pressure/diluent).
- F09 FLEX d²-law diagnostic (only valid data subset; residual with caveats).
- F10 BASS-II Gas Balance (ΔO₂/ΔCO₂ by matching tests; compare limited model).
- F11 Similar Experiment Retrieval (within-dataset, interpretable facets).
- F12 Data Quality Workspace (filter anomalies, lineage, contradictions).
- F13 Evidence ranking with explainable relevance factors (can begin basic in P0).

### 3.3 Release P2 — only after P0 & P1 are stable

- F14 SAFFIRE frame/downlink timeline with missing/corrupt statistics and 30 fps notes.
- F15 FLEX regression/classification exploratory baseline **only** with group-split and ML card.
- F16 Dual-language UI/full Vietnamese summaries.
- F17 Export experiment selection / research answer as PDF/CSV (CSV preferred initially).

---

## 4. Information architecture, routes, navigation

### 4.1 Routes

| Route | Screen | Priority |
|---|---|---|
| `/` | Overview / mission | P0 |
| `/ask` | AI Research Assistant | P0 |
| `/experiments` | Explorer (dataset tabs) | P0 |
| `/experiments/[uid]` | Experiment Detail | P0 |
| `/evidence` | Evidence Search + source details | P0 |
| `/datasets` | Dataset catalog and methodology | P0 |
| `/analytics/flex` | FLEX laboratory | P1 |
| `/analytics/bass-ii` | BASS-II laboratory | P1 |
| `/analytics/saffire-i` | SAFFIRE case study / timeline | P1/P2 |
| `/quality` | Data Quality dashboard | P1 |
| `/about/methodology` | Provenance, limitations, disclosure | P0 |

### 4.2 Global navigation & design system

- Desktop: left side navigation (Overview, Ask AI, Experiments, Analytics, Evidence, Quality, Methodology); top bar dataset selection, global search, offline/LLM status.
- Mobile: stacked layout and collapsible nav, charts horizontally scrollable where needed.
- Palette [PROPOSAL]: dark navy background, warm amber/orange for flame accents, cyan for scientific measurements, neutral grey for metadata. **Không dùng đỏ/xanh làm nguồn duy nhất để mã hóa trạng thái.**
- Typography: readable sans, tabular figures for scientific numbers; mono for IDs/units/code.
- Data confidence: small textual labels `Measured`, `Computed`, `Documented`, `Hypothesis`, `Unverified`; distinct border/text; show tooltip meaning.
- Minimum content width for charts 320 px; text contrast WCAG AA aim; keyboard focus, alt text, table access.
- All displayed scientific charts include axes with **units**, sample size `n`, filters, and caption **“observational association; not causal inference”** when appropriate.

### 4.3 Empty/loading/error states

- No results → “No matching experiments under these filters”, button to clear filters.
- AI loading → step labels “Searching data”, “Retrieving reports”, “Verifying evidence”; no made-up progress %.
- LLM unavailable → show raw retrieved evidence and numeric summaries; no fake generated response.
- Missing report/source → show file path and status “Not indexed / needs review”.
- No approved scientific link → “Related source unverified”, not link evidence forcibly.
- Data warning → show raw and normalized versions side by side.

---

## 5. UX screen-level functional requirements

### 5.1 Screen S01: Overview [P0]

**Purpose:** explain the challenge and launch workflows in 1 click.

**Blocks:** hero statement and one-sentence mission; three dataset cards with grounded record counts and investigation scope; `Ask a scientific question` CTA; common questions; ingestion/index stats; 3 featured scientific insights **only if sourced**; limitation link.

**Interactions:** dataset card → filtered Explorer; featured question → `/ask?q=...`; featured experiment → detail; source → citation viewer.

**Acceptance:** counts sourced from DB; at least one click pathway per dataset; if scientific highlights lack evidence, show data stats only.

### 5.2 Screen S02: AI Research Assistant [P0]

**Layout:** left question/search input + conversation history in-memory, central answer with claim cards, right evidence panel (on desktop). Do not save chats to server in MVP.

**User actions:** question, choose investigation scope (All/FLEX/BASS-II/SAFFIRE-I), select `Evidence only` or `AI explanation`, click sample prompts, expand citations, open source page, open experiment row, copy answer with citations.

**Answer structure:** direct answer or abstention; `[DOCUMENTED]`, `[COMPUTED]`, `[HYPOTHESIS]`, `[UNSUPPORTED]` claims; per-claim citations; optional numeric chart/table; caveats; `Evidence used` with top documents and test IDs; explicit `limits`.

**Behavior:** numerical query must invoke structured tool; theoretical query uses hybrid retrieval; cross-dataset query gets separate investigation sections; unsupported exact quantities → abstain; citations resolved from database refs not text hallucination.

**Acceptance:** all visible citation targets exist; links open to source doc page/section; tool results logged; unsupported questions return `answer_status=insufficient_evidence` rather than numeric value.

### 5.3 Screen S03: Experiment Explorer [P0]

**Filters:** investigation; query by exact test ID; material/fuel; oxygen min/max (context-aware unit); outcome only for FLEX; time/date range (where valid); has warnings; numeric completeness; sort; pagination 25/50 rows.

**Table per dataset:**
- FLEX: UID, identifier, date, fuel, pressure mmHg, O₂ fraction, D₀ mm, burn time s, outcome, quality.
- BASS-II: UID/Test #, PI, material, sample #, O₂ initial/final %, CO₂ initial/final %, flow setting summary, quality.
- SAFFIRE-I: S1/S2, material, orientation, air flow, O₂ range, ignition W/s, burn time, quality.

**Rules:** columns depend on investigation; never show a cross-investigation unified numeric comparison table with mismatched semantics; column widths adaptive; persist filters only in URL query params (shareable).

**Interactions:** click row detail; selecting 2–5 same-investigation rows opens comparison drawer (P1 if complex); export filtered CSV with source/quality flags (P2).

### 5.4 Screen S04: Experiment Detail [P0]

**Header:** experiment ID, dataset, raw row index, scientific title, tags, provenance.

**Tabs/sections:** `Conditions`, `Measurements`, `Result / events`, `Related evidence`, `Quality & lineage`, `Raw record`.

**Raw record:** exact column names/string values, original filename, row index (1-based data row), file SHA-256.

**Normalized record:** canonical quantities with unit + role setpoint/measured/derived + transformation status.

**Evidence:** verified direct-id citations first; condition match low confidence as separate unverified suggestion; links to PDF page.

**Quality:** flags with severity/info and evidence; uncertain corrections shown side by side.

**Acceptance:** every normalized measurement links to exact raw field; duplicate FLEX identifier resolves unambiguously via UID.

### 5.5 Screen S05: Evidence Explorer [P0 basic, P1 advanced]

**Query:** free text and exact ID, with filters by investigation/doc type/claim type/year.

**Results:** ranked chunks (snippet, title, page_pdf, page_printed if known, section, match reasons, quality notes), score components optionally disclosed.

**Source viewer:** page/section navigation when PDF available locally/deployed; if browser-side PDF is not hosted, show excerpt and source GitHub/PSI link. Keep filename/page for provenance.

**Ranking:** see §8. Must not create “safe material ranking.”

### 5.6 Screen S06: FLEX Physics Lab [P1]

**Visualizations:**
1. scatter D₀ vs oxygen, color by outcome; filter fuel, pressure band, diluent type/fraction; count n.
2. Dext/D₀ vs oxygen for valid nonzero D₀ and Dext; data points and group medians where n sufficient.
3. d²-law check: `t_pred = (D0² − Dext²) / K` **only under explicit applicability assumptions**, show `t_reported`, `t_pred`, residual, n excluded, reasons; never claim forecast-of-future simply based on after-test variables.

**Quality:** user can include/exclude flagged rows; default excludes critical invalid and marks others; missing values not silently imputed.

### 5.7 Screen S07: BASS-II Physics Lab [P1]

**Visualizations:** ΔO₂ vs ΔCO₂ for usable rows (signed clearly), per PI/material grouping, overlay limited PMMA stoichiometric reference from report when applicable; pre/post CO and CO₂ distributions; sample-size indicators; safety caveat about changed gas atmosphere across sequential tests.

**Rules:** e.g. ΔO₂_consume = O₂_initial − O₂_final; ΔCO₂_prod = CO₂_final − CO₂_initial; do not infer rates without duration; missing and over-range symbols excluded or appropriately censored. Theoretical slope comparison only for qualified PMMA subset.

### 5.8 Screen S08: SAFFIRE Case Study [P1 / P2]

**P1:** side-by-side S1 and S2 scientific conditions, different flow direction, burn time as reported; uncertainty and raw field names; metadata/DoD/source links.

**P2:** per camera sample-frame timeline with received/corrupt flags; accurate note that capture ~605 s differs from CSV burn duration; chart of received fraction; optional JPEG file-size proxy marked nonphysical and uncalibrated.

**Do not show:** flame spread area or thermocouple temperature when raw measurements are missing.

### 5.9 Screen S09: Data Quality [P1]

Summary cards: flagged records by dataset and severity; filter by issue type; anomaly table; raw↔normalized comparison; source disagreement list; link to experiment/source. User can dismiss UI notification locally, but cannot change canonical source value from frontend.

### 5.10 Screen S10: Methodology [P0]

Describe data sources (NASA PSI and repo), methods, how calculations work, what RAG can/cannot know, limitations, source correction policy, model disclaimer, reproducibility commands, licensing/credits as verified. This page is required to prevent overstated scientific conclusions.

---

## 6. Data pipeline & reproducibility

### 6.1 Repository non-destructive layout proposal

```text
NASA-Hackathon/
├─ FLEX/                         # original, untouched
├─ BASS-II/                      # original, untouched
├─ SAFFIRE-1/                    # original, untouched
├─ research/                     # prior reports Claude generated
├─ app/
│  ├─ frontend/                 # Next.js
│  └─ backend/                  # FastAPI
├─ pipeline/
│  ├─ ingest/                   # source readers
│  ├─ transform/                # normalization, quality
│  ├─ curate/                   # reviewed extract tables
│  ├─ index/                    # documents and retrieval
│  └─ tests/
├─ artifacts/                    # generated, rebuildable (gitignored when large)
│  ├─ db/
│  ├─ documents/
│  ├─ indexes/
│  ├─ reports/
│  └─ manifest.json
├─ specs/
│  └─ SPACEFIRE_AI_PRODUCT_TECHNICAL_SPEC_V0.1.md
├─ docker-compose.yml
├─ .env.example
└─ README.md
```

**[DECISION]** File location, naming and whether existing research/ present must be detected dynamically, not created as a duplicate.

### 6.2 Ingestion phases

1. **Inventory:** recursive scan allowlisted source dirs; SHA-256, filename, bytes, type. Detect archive duplicates and do not double index `download.zip`.
2. **Load structured:** CSV via correct encodings; XLSX streaming; skip unused SAFFIRE formula recalculation if cached values are reliable, record parser status.
3. **Normalize:** canonical variables, datatype/units/role, preserve raw, attach quality flags, event-specific semantics.
4. **Curate reports:** extract text and targeted tables with `document_id`, `pdf_page`, `printed_page`, row/source test IDs; human review for critical tables.
5. **Index:** chunk, build sparse FTS5/BM25, dense FAISS; deduplicate based on content hash/structure (while preserving source list).
6. **Validate:** row-count assertions, unique UID, raw/normalized traceability, corpus citation resolution, sample data tests.
7. **Publish artifact manifest:** run timestamp, source hashes, transform version, docs indexed, rows excluded, warning counts.

### 6.3 Explicit ingestion constraints

- Idempotent: repeated run with unchanged sources produces semantically identical DB/index.
- Failed stage must not overwrite last good build; stage in tmp and atomic swap on success.
- No executable content from DOCX/PPTX or spreadsheets; parse data only.
- Missing PDF text: flag `page_extraction_status=image_only` and do **not** claim page was indexed; curated extraction with manual review possible.
- Archive ZIP entries traversal protection; no extraction outside staging dir.
- Very large XLSX SAFFIRE: process streaming; avoid keeping 600k formula cells in memory.
- Never generate citations from an unindexed page.

---

## 7. Data model / database schema (proposed SQLite)

### 7.1 Core entities

```sql
CREATE TABLE investigations (
  investigation_id TEXT PRIMARY KEY, -- FLEX, BASS-II, SAFFIRE-I
  psi_id TEXT NOT NULL,
  title TEXT NOT NULL,
  combustion_system TEXT NOT NULL,
  description TEXT,
  scientific_limitations TEXT
);

CREATE TABLE source_files (
  source_id TEXT PRIMARY KEY,
  rel_path TEXT NOT NULL UNIQUE,
  sha256 TEXT NOT NULL,
  media_type TEXT,
  dataset_id TEXT,
  page_count INTEGER,
  ingest_status TEXT NOT NULL,
  quality_notes TEXT,
  FOREIGN KEY(dataset_id) REFERENCES investigations(investigation_id)
);

CREATE TABLE experiments (
  experiment_uid TEXT PRIMARY KEY, -- e.g. FLEX:000002
  investigation_id TEXT NOT NULL,
  raw_test_id TEXT,
  raw_row_number INTEGER,
  source_id TEXT NOT NULL,
  experiment_type TEXT NOT NULL, -- burn, reference, etc.
  event_date TEXT,
  outcome_raw TEXT,
  normalized_outcome TEXT,
  outcome_status TEXT,
  display_title TEXT,
  raw_json TEXT NOT NULL,
  FOREIGN KEY(investigation_id) REFERENCES investigations(investigation_id),
  FOREIGN KEY(source_id) REFERENCES source_files(source_id)
);

CREATE TABLE observations (
  observation_id TEXT PRIMARY KEY,
  experiment_uid TEXT NOT NULL,
  canonical_variable TEXT NOT NULL,
  raw_column_name TEXT NOT NULL,
  raw_value TEXT,
  value_num REAL,
  value_text TEXT,
  value_min REAL,
  value_max REAL,
  unit TEXT,
  raw_unit TEXT,
  semantic_role TEXT NOT NULL, -- input_setpoint, measured_initial, measured_final, derived, metadata
  stage TEXT, -- initial, final, event, sequence, unknown
  transform_rule TEXT,
  correction_status TEXT,
  source_reference TEXT,
  FOREIGN KEY(experiment_uid) REFERENCES experiments(experiment_uid)
);

CREATE TABLE quality_flags (
  flag_id TEXT PRIMARY KEY,
  experiment_uid TEXT,
  observation_id TEXT,
  source_id TEXT,
  flag_code TEXT NOT NULL,
  severity TEXT NOT NULL, -- info, warning, critical
  description TEXT NOT NULL,
  evidence_refs_json TEXT,
  resolution_status TEXT NOT NULL -- open, reviewed, documented_conflict, etc.
);

CREATE TABLE documents (
  document_id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  investigation_id TEXT,
  title TEXT,
  authors TEXT,
  year INTEGER,
  document_type TEXT,
  extraction_status TEXT,
  FOREIGN KEY(source_id) REFERENCES source_files(source_id)
);

CREATE TABLE evidence_chunks (
  chunk_id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  page_pdf INTEGER,
  page_printed TEXT,
  section_path TEXT,
  chunk_type TEXT,
  text TEXT NOT NULL,
  entities_json TEXT,
  content_sha256 TEXT,
  quality_notes TEXT,
  FOREIGN KEY(document_id) REFERENCES documents(document_id)
);

CREATE TABLE evidence_links (
  link_id TEXT PRIMARY KEY,
  experiment_uid TEXT,
  chunk_id TEXT NOT NULL,
  relation TEXT NOT NULL, -- exact_id, condition_match, material_context, science_background
  link_method TEXT NOT NULL,
  confidence TEXT NOT NULL,
  approved INTEGER NOT NULL DEFAULT 0,
  justification TEXT,
  FOREIGN KEY(chunk_id) REFERENCES evidence_chunks(chunk_id)
);

CREATE TABLE curated_findings (
  finding_id TEXT PRIMARY KEY,
  investigation_id TEXT,
  claim_text TEXT NOT NULL,
  claim_type TEXT NOT NULL, -- DOCUMENTED/COMPUTED/HYPOTHESIS/UNSUPPORTED
  calculation_id TEXT,
  numeric_result_json TEXT,
  caveats_json TEXT,
  approved INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE finding_evidence (
  finding_id TEXT NOT NULL,
  chunk_id TEXT NOT NULL,
  PRIMARY KEY (finding_id, chunk_id)
);
```

**Supporting entities:** `image_sets`, `frame_manifest_summary`, `curated_measurements`, `retrieval_runs`, `schema_versions` can be added only when corresponding feature is implemented.

### 7.2 Canonical identifier and field conventions

- Primary ID `FLEX:000001` based on source order, `BASS-II:B1`, `SAFFIRE-I:S1`; any collisions resolved with stable source row suffix. Keep public/display ID separate from primary UID.
- Numeric values stored in source-compatible units; optional normalized SI units in observation records with transform provenance.
- `raw_json` is immutable snapshot per loaded row; `observations` are derived semantic view.
- All values have a `semantic_role`; generic `CO2` cannot be joined without role matching.
- `source_reference`: `{file_path, sha256, row_number, column_name}` for CSV and `{file_path, page_pdf, table_id, row_identifier}` for curated PDF.
- Apply SQLite indexes: `experiments(investigation_id, raw_test_id)`, `observations(experiment_uid, canonical_variable, semantic_role)`, `quality_flags(experiment_uid,severity)`, FTS5 on evidence text.

### 7.3 Curated tables and linking priority

- BASS-II SR Appendix A: start with handful of demo test IDs, review exact source pages, then expand.
- BASS-II Table 5.1 and 7.1: preserve row IDs and units; do not auto-extract without manual check.
- FLEX slides/papers: only direct ID matching counts as verified; matching conditions alone is *suggested, not approved*.
- SAFFIRE F1/F2 image set semantics from DoD + workbook; corrections explicit.

---

## 8. Scientific RAG architecture

### 8.1 Index construction

- Input: 12 PDF, 4 DOCX, 1 PPTX, study metadata as inventoried (deduplicate content and do not double-count ZIP copies).
- Chunk by headings and tables (target 300–600 tokens; 10–15% overlap only for normal prose; keep table row and caption connected).
- Metadata `doc_id`, `dataset`, `section`, `page_pdf`, `page_printed`, `document_type`, `entities`, `extraction_quality`.
- Sparse: SQLite FTS5 + BM25; exact test ID boosting.
- Dense: local BGE small English embeddings + FAISS, index built offline. Some Vietnamese queries → translate or multilingual embeddings only if evaluation warrants; primary UI English initially.
- Hybrid merging: reciprocal-rank fusion (RRF). Optional reranker P1.

### 8.2 Query intent router

| Intent | Example | Tools |
|---|---|---|
| Definition | “What is cool flame?” | `search_evidence` |
| Exact test | “Explain M5” | `get_experiment`, `get_verified_links`, `search_evidence` |
| Aggregate | “How many methanol tests?” | `count_experiments(filters)` |
| Relation | “O₂ vs extinction diameter” | `get_scatter_data`, `stats_summary` |
| Compare | “Compare B1 and B2” | `compare_experiments` |
| Similar | “Find tests similar to C01M201” | `similar_experiments` (P1) |
| Unsupported | “Exact safe cabin oxygen threshold?” | No unsupported estimate; retrieve context and abstain |
| Mixed datasets | “Compare SIBAL at two scales” | Separate by dataset + explicitly state non-equivalence |

**No free-form LLM-generated SQL execution.** Use defined read-only tools with validated filters, allowlisted columns and bounded outputs.

### 8.3 Explainable evidence ranking

**Goal:** rank **source relevance** for question, not scientific truth or material safety. Proposed normalized scoring approach (weights tunable by golden-set evaluation):

`S = 0.30 lexical_match + 0.30 semantic_similarity + 0.20 direct_entity_match + 0.10 metadata_context + 0.10 evidence_quality`

Where direct exact experiment ID gets priority over a vague topic match. Penalties for unreviewed table extraction, known contradictory metadata, unverifiable condition-only links; never use the score as a probability of scientific truth. UI can show `Exact ID`, `High lexical relevance`, `Topic match`, `Reviewed source` explanations.

### 8.4 LLM answer contract

```json
{
  "answer_status": "answered | partial | insufficient_evidence | error",
  "answer_summary": "string",
  "claims": [
    {
      "claim_id": "c1",
      "type": "DOCUMENTED | COMPUTED | HYPOTHESIS | UNSUPPORTED",
      "text": "string",
      "citation_ids": ["chunk-123"],
      "calculation_ids": ["calc-5"],
      "limitations": ["string"]
    }
  ],
  "used_experiment_uids": ["FLEX:000002"],
  "chart_spec": null,
  "missing_evidence": ["string"],
  "warnings": ["string"]
}
```

- Every DOCUMENTED claim: at least one resolvable citation. Every COMPUTED claim: calculation record with inputs, filters, result, units, n, excluded count.
- HYPOTHESIS explicitly labeled and must not turn into operational safety instructions.
- UNSUPPORTED should normally be surfaced as *why the question cannot be answered*, not a positive assertion.
- Backend **must validate** schema. Client never trusts raw LLM markdown as authoritative citation source.
- Numeric verifier: allowlist numeric facts from retrieved records and reviewed text, tolerate known rounding; track unknown figures as blocked or `unverified`. Beware regex false positives on years, citations, chemical formulas, IDs, and units; add test cases.
- Citation resolver: source document ID + page stored server-side; LLM may only choose from retrieved chunk IDs.
- Prompt injection defense: document content is untrusted; ignore instructions embedded in PDFs/CSV; sanitize markdown rendering; do not allow sources to call tools.
- Query no evidence: graceful refusal + tell which report/data is missing.

### 8.5 Offline/fallback behavior

When API key absent, `/ask` returns evidence snippets and deterministic computed data with `mode: evidence_only`, not an invented LLM response. Search/Explorer/Physics remain functional. Precomputed **real results** for demo questions may be cached with source versions; never fabricate cache contents.

---

## 9. Analytics and similarity specifications

### 9.1 FLEX flammability map

Input filters `fuel`, `pressure_min/max`, `o2_min/max`, `diluent`, `include_flagged`, `outcome`. Return points D₀ vs X_O₂ and grouped counts. Mark outcomes categorical; do not call plot an inferred physical boundary unless proper fit/method verified. Tooltip displays test ID, conditions, outcome, quality flags, link.

### 9.2 d²-law consistency

Equation **for diagnostic, not predictive input:**

`K = -d(D²)/dt` and `t_approx = (D0² - Dext²) / K`.

Only rows with D0, Dext and K numeric, valid (e.g. D0>0, Dext≥0, K>0, Dext≤D0); exclude or flag inconsistent events rather than hiding them. Burn time may not equal idealized extinction time depending on definitions: document error measures and assumptions. Output `valid_n`, `excluded_n`, MAE/median ratio, scatter measured-vs-approx, per-record residual and source refs.

### 9.3 BASS-II gas balance

`delta_o2_consumed = o2_initial - o2_final` (vol percentage points). `delta_co2_produced = co2_final - co2_initial` (vol percentage points). Reference PMMA expected ratio computed from relevant NASA report; only compare qualified PMMA samples; never assert that entire BASS-II including cellulose follows PMMA stoichiometry. Remove nonsensical numbers/over-range; preserve raw.

### 9.4 Similar-experiment retrieval

- Restrict to **same investigation**, optionally same fuel/material family.
- FLEX features: fuel (hard filter preferred), pressure, X_O₂, X_N₂, X_CO₂, X_He, D₀. **Do not use test outcome, burn time, K, Dext in similarity for pre-test conditions.**
- BASS-II features: material family, geometry, thickness/width (when parsed), initial O₂, flow restrictor; use structured airflow only if calibrated/semantic clear; missingness penalties.
- SAFFIRE: n=2 → simple comparison, no kNN recommendation.
- Distance: Gower or standardized numeric distance + categorical mismatch; robustness checks and per-feature differences. Show *matched features* and *unmatched/unknown features*, not an uncalibrated probability.
- Return k≤10, similarity scores interpreted as ranking only.

### 9.5 ML baseline [P2]

- Train only on chosen FLEX target with strict leakage audit and report eligible sample count.
- Inputs setpoint conditions only. Group splitting based on experiment series or gas-mixture grouping; ensure no near duplicates spill across folds.
- Report baseline + group-based evaluation and class balance, uncertainty and out-of-distribution detection.
- Outcome `Disruption` not converted to ordinary `Extinction=0` without authoritative semantics; may exclude from specific task with transparent rationale.
- Show model card, training provenance, validation metrics and limits. UI labels “Experimental research estimate—not certified safety model”.
- If performance not reliable, **do not ship prediction UI**.

---

## 10. Backend API contract (v1, proposed)

**Base:** `/api/v1`; JSON, UTF-8, unit fields explicit. Query input validated with Pydantic. HTTP 400 for bad filter, 404 for unknown experiment/source, 422 for malformed schema, 503 for LLM unavailable but retrieval-only can return 200 with mode notice. All list endpoints bounded.

| Method | Endpoint | P | Notes |
|---|---|---|---|
| GET | `/health` | P0 | app/db/index readiness; no secret |
| GET | `/datasets` | P0 | investigation summaries and counts |
| GET | `/datasets/{id}/schema` | P0 | raw+canonical column dictionary |
| GET | `/experiments` | P0 | filters, sorts, pagination |
| GET | `/experiments/{uid}` | P0 | raw, normalized, flags, evidence |
| POST | `/experiments/compare` | P1 | max 5, same investigation |
| GET | `/quality/summary` | P1 | counts by dataset/severity |
| GET | `/quality/flags` | P1 | filter, pagination, provenance |
| GET | `/evidence/search` | P0 | hybrid retrieval + explainable ranking |
| GET | `/evidence/chunks/{id}` | P0 | excerpt + source refs |
| POST | `/ask` | P0 | structured response; fallback evidence-only |
| POST | `/analytics/flex/map` | P1 | chart-ready data + n/filter |
| GET | `/analytics/flex/d2/{uid}` | P1 | diagnostic |
| POST | `/analytics/bass/gas-balance` | P1 | fixed formula |
| GET | `/experiments/{uid}/similar` | P1 | k bounded, same dataset |
| GET | `/analytics/saffire/timeline` | P2 | manifest aggregate only |
| GET | `/methodology` | P0 | versions/limits |

### 10.1 Sample experiment response

```json
{
  "experiment_uid": "FLEX:000002",
  "investigation_id": "FLEX",
  "display_id": "20CAL10",
  "source": {"path": "FLEX/PSI-69_Experimental table_FLEX.csv", "data_row_number": 2},
  "raw_fields": {"Fuel": "Methanol", "Burn time; s": "5"},
  "observations": [
    {"field": "burn_time", "raw_field": "Burn time; s", "value": 5.0, "unit": "s", "role": "measured", "flags": []}
  ],
  "quality_flags": [],
  "related_evidence": [],
  "disclaimer": "Experimental record; not a spacecraft operational safety recommendation."
}
```

### 10.2 Sample ask request

```json
{
  "question": "Which FLEX methanol experiments investigate low oxygen extinction?",
  "scope": ["FLEX"],
  "mode": "explain",
  "max_evidence": 8
}
```

**Security/basic operations:** CORS allowlist from env; optional anonymous rate limiting on `/ask`, max question length, bounded timeouts, keys backend-only; input escaping; no arbitrary file reads from query params; no filesystem writes from user queries; source file paths are IDs not arbitrary paths.

---

## 11. Frontend component spec

### 11.1 Shared components

- `AppShell`, `SideNav`, `TopBar`, `GlobalDatasetSelector`, `APIStatus`.
- `DatasetCard`, `ExperimentTable`, `ColumnFilter`, `ExperimentDetailSheet`, `RawNormalizedToggle`.
- `SourceCitation`, `EvidenceSnippet`, `ClaimTypeLabel`, `QualityFlagChip`, `MissingDataIndicator`, `CalculationProvenance`.
- `ChartFrame` renders title + filters + n + axis units + data definition; `ChartTooltip` with test link.
- `EmptyState`, `ErrorState`, `Skeleton`, `SearchSuggestions`, `AbstentionNotice`.

### 11.2 UI patterns

- Copy claim includes source references.
- Quality flag always visible in detail; explorer shows aggregated warning badge.
- All analytical figures have downloadable data button (P2) and descriptive summary for accessibility.
- Navigation to a source retains current search context when possible (URL params).
- No fictional KPI (“risk score 87%”) or illustrative results shown as empirical outputs.

### 11.3 Demo-first interaction design

- Landing: 3 clickable datasets + 3 example prompts.
- Ask: one question, one claim with citation + plot linking to exact tests.
- Explorer: search `M5` or `20CAL10` and open details.
- Quality: show anomaly examples with raw values and report citations.
- Limitations: demonstrate correct abstention on exact LOI.

---

## 12. Evaluation, testing, and acceptance criteria

### 12.1 Unit and data tests [P0]

- `test_flex_encoding`: cp1252 en dash intact; no replacement glyph.
- `test_source_preservation`: hashes of source files unchanged before/after.
- `test_flex_rows`: 274 data rows; 15 raw columns; 273 distinct FLEX Identifier; `193F001` repeated twice.
- `test_bass_rows`: 129 rows; 17 columns; `GMT` treated as day-of-year.
- `test_saffire_rows`: 4 raw rows, 2 burn events, 2 image set descriptors.
- `test_semantics`: FLEX CO₂ has role `input_diluent`, BASS CO₂ `measured_*`; prevented from cross-dataset numeric aggregation.
- `test_anomalies`: FLEX P=0 flagged; BASS T28b final O₂=40.4 flagged; SAFFIRE F2 raw metadata conflict flagged.
- `test_raw_lineage`: every normalized data value references original file/column/row.
- `test_index_dedup`: `download.zip` not duplicate-indexed.
- `test_pdf_page`: citation references actual `document_id + page`.
- `test_no_raw_media`: all modules work with available data only.

### 12.2 Analytics tests [P1]

- Analytic functions reproduce independently computed reference examples to accepted tolerance; units correct.
- d²-law uses only valid subsets and returns exclusions; zero K/D0 does not crash.
- BASS gas balance excludes `none`, `OR`, `>500` from naive arithmetic.
- Similar experiments exclude outcome/after-test features; same investigation only.
- Visualization tooltip corresponds to exact test UID.
- Aggregation by oxygen documents its grouping and sample count.

### 12.3 RAG evaluation [P0]

**Golden questions:** 40–60, with gold response categories, expected evidence doc/page/ID, and expected abstention. Suggested initial topics:

1. What does the FLEX column labelled CO mean?
2. What unit does FLEX burning rate use?
3. Which experiment is `20CAL10`?
4. What do we know and not know about `Disruption`?
5. What do oxygen and helium represent in FLEX?
6. Which BASS-II test is `M5`, and why is it notable?
7. Are BASS-II O₂ readings time-series?
8. How is `GMT` encoded in BASS-II?
9. What is the test count discrepancy between report and CSV?
10. Does SAFFIRE-I XLSX include photos?
11. Why does S2 have less image coverage?
12. Can exact methanol LOI be derived confidently from available documents?
13. Can we predict real spacecraft cabin safety from these datasets?
14. How do FLEX and BASS-II use CO₂ differently?
15. How are S1 and S2 related and how do they differ?

**Metrics (targets for internal release gates, not claims about achieved performance):**
- 100% displayed citation IDs resolve in corpus.
- 100% numbers in **COMPUTED** claims derived from an attached calculation object; 0 unsupported numerical claims in the curated demo set.
- ≥90% correct experiment-ID retrieval on golden ID questions; 100% for specifically seeded demo IDs.
- ≥85% correct refusal on golden unanswerable questions; targeted 100% for unsafe-operation questions.
- ≥90% successful golden Q&A flow without crashes; review failures manually.
- All 3 end-to-end demo paths pass reproducible smoke tests.

### 12.4 User acceptance scenarios

**UAT-01 — Find a named test:** search `20CAL10` → unique experiment detail and original record; open source.

**UAT-02 — Query evidence:** ask for FLEX `CO`/`Burning rate` meaning → system gives source-supported explanation or states evidence status; citation click opens exact document.

**UAT-03 — Compare BASS:** select compatible PMMA tests → per-field values/units/flags; plot derived Δ gases only for valid values.

**UAT-04 — SAFFIRE honesty:** ask for flame spread speed → refuse numeric claim; explain only CSV + image manifest available.

**UAT-05 — Offline API:** no LLM key → `/ask` evidence-only and Explorer still functional.

**UAT-06 — Data-quality integrity:** suspicious row flagged, raw value untouched.

---

## 13. Non-functional requirements

### 13.1 Performance targets [targets, not measurements]

- Initial dataset listing <2 s warm local; row detail <1 s; evidence search <3 s local CPU on warmed index where feasible.
- Numerical charts ≤3 s for 405 structured records; no repeated parse XLSX per page request.
- LLM answer server timeout configurable, UI progressive loading; degrade gracefully after timeout.
- Build index only on startup if no artifacts, preferably pre-build; do not download model on every start.

### 13.2 Reliability

- Crash-free navigation for entire demo, retry for transient LLM errors with bounded attempts, structured logging (no API keys or private data), health endpoint, deterministic saved seed examples.
- Store derived artifact version/manifest, tolerate partial docs extraction and report `indexed_pages`/`failed_pages`.

### 13.3 Accessibility/localization

- Responsive >= 360 px; keyboard navigable; distinguish states by text plus color; sensible screenreader labels; English UI main; optional Vietnamese copy for demo via controlled mapping.

### 13.4 Scientific credibility

- Explicit `data_as_of` based on sources; bibliographic citation; include NASA as source, **do not imply NASA endorsement** of the product.
- Avoid “prediction = validated safety recommendation”; uncertainty is first-class.

---

## 14. Implementation plan, dependencies, gates (48-hour hackathon)

### 14.1 Preconditions

- Confirm challenge rules: what pre-event preparation is permitted, what code must be created during official window, exact submission deadlines. Existing research/clean data preparation may require disclosure. Do not assume all prep can be reused undisclosed.
- Ensure repo contains source files and valid licensing statements.
- Obtain LLM API key if desired, never commit secrets.

### 14.2 Phased implementation

| Gate | Approx slot | Deliverable | Ship condition |
|---|---|---|---|
| G0 | Initial | freeze spec and scope; data map; scaffold | decisions approved; no source mutations |
| G1 | Early | loaders+DB+schema+quality+seed tests | counts correct; no corruption |
| G2 | First half | Explorer+Detail+hybrid search+Ask with citation | golden core tests; 3 source flows |
| G3 | Midpoint | stable end-to-end demo | **freeze P0 API/data model** |
| G4 | Second half | FLEX maps+d²-law+BASS gas; quality UI | numeric tests, unit/caveat UI |
| G5 | Optional | similarity; SAFFIRE timeline; ML only if validated | feature flags; rollback possible |
| G6 | Final | deploy/README/demo video/QA | no broken source links, no unsupported claims |

### 14.3 Prioritization if time runs short

Cut in this order: ML Prediction → SAFFIRE timeline → advanced ranking → similarity → secondary BASS plots; **never cut** data provenance, citation validity, raw preservation or evidence-only fallback.

### 14.4 Team roles (flexible)

- Data/science: ingest, normalization, curation, physics checks.
- Backend/RAG: schema, search, Q&A, verifier, tests.
- Frontend/design: UX, charting, source navigation.
- QA/presentation: scientific review, golden set, demo story, README/video.

---

## 15. Deliverables and Git workflow

**Code deliverables:** Next.js frontend; FastAPI backend; ingestion scripts; portable SQLite artifact builder; retrieval index builder; API contract (OpenAPI); Docker Compose/dev run instructions; tests; screenshots/demo; README and scientific limits.

**Documentation:** `DATA_DICTIONARY.md`, `SCIENTIFIC_LIMITATIONS.md`, `DATA_LINEAGE.md`, `MODEL_CARD.md` only if ML exists, `EVALUATION_REPORT.md`, `ACKNOWLEDGMENTS_AND_SOURCES.md`.

**Branch policy [PROPOSAL]:** `feature/data-foundation`, `feature/scientific-rag`, `feature/explorer-ui`, `feature/analytics`, integrate via PR and tested main. No direct deployment without smoke tests. Keep generated indexes/db out of Git unless small and needed for reproducible demo.

**Source integrity:** never delete/rename original dataset folders; add new dirs beside them; avoid committing API keys or proprietary model weights. No silent modification of `research/` reports.

**Claude execution policy after approval:** implement in milestones, provide file-by-file diff summary and commands/tests per gate; do not autonomously broaden scope or download raw media.

---

## 16. Risks, mitigations, and explicitly deferred unknowns

| Risk | Severity | Mitigation |
|---|---|---|
| Incorrect PDF table extraction | High | manually review selected rows, store page/table trace |
| LLM makes up a statistic | Critical | tool computation + numeric verification + abstention |
| Bad citation | High | ID resolver, page existence checks, source viewer |
| Hidden data correction | Critical | raw/normalized separation; flags and correction source |
| False causal inference from observational grouping | High | filters + caveats + explicit n/grouping |
| Mismatched CO₂ semantics | High | variable roles; query validator |
| SAFFIRE data mistaken for flame measurements | High | manifest-only UI, disable unsupported charts |
| Model no network/API | High for demo | retrieval-only mode + prebuilt local index |
| Frontend overscope | High | P0/P1/P2 gating, component reuse |
| Scientific claim unsupported by repo | High | DOC/COMPUTED/HYP/UNSUPPORTED statuses |
| Source file too big for browser | Medium | backend indexed excerpts and optional source link |
| Research docs have inconsistencies | Medium | rely on source data, conflict flags, review queue |

**Open scientific questions:** physical meaning of FLEX `Disruption`; exact burn-time definition; which BASS fan settings have same-day calibration; SAFFIRE thickness and length/width semantics; actual images/sensor series absent; whether specific external NASA paper can supply exact LOI. These are *not* silently answered in implementation.

---

## 17. Three-minute demo script (illustrative, grounded in planned sources)

**0:00–0:20:** “NASA’s microgravity combustion knowledge is scattered across experiments, reports and metadata, making it hard to search and verify.” Show Overview with three datasets.

**0:20–0:55:** Ask “Why is the FLEX burning-rate unit confusing?” → citation+data dictionary+test-driven d²-law check, with note that the published CSV header is inconsistent. If P1 not ready, use just documented citation.

**0:55–1:35:** Explorer FLEX → choose methanol subset and oxygen map → click an experimental row, inspect `raw` vs `normalized`, show sample size and quality flags.

**1:35–2:15:** BASS-II `M5` detail → show O₂/CO₂ changes and NASA Summary Report citation. Optional gas-balance plot. Do not claim post-burn quantities are continuous timeseries.

**2:15–2:40:** Evidence ranking/Quality screen: show `T28b` oxygen anomaly or FLEX duplicated identifier; show that data is preserved, not silently fixed.

**2:40–3:00:** Ask “What is the exact certified safe cabin oxygen limit?” → system refuses unsupported operational claim and lists missing evidence. End line: **“SpaceFire AI: evidence first, insights you can verify.”**

---

## 18. Review checklist / sign-off

Mark one of **Approve / Change / Defer** for each section:

| ID | Review question | Proposed answer | Your decision |
|---|---|---|---|
| R01 | Product scope | A-core, D-scoped Hybrid | ☐ Approve ☐ Change |
| R02 | Source datasets | All 3 + docs; no raw media | ☐ Approve ☐ Change |
| R03 | UX design | dark scientific dashboard | ☐ Approve ☐ Change |
| R04 | Navigation/screens | 5 P0 screen families, P1 analytics | ☐ Approve ☐ Change |
| R05 | Primary language | English, Vietnamese later | ☐ Approve ☐ Change |
| R06 | RAG approach | hybrid search + source citations | ☐ Approve ☐ Change |
| R07 | Evidence rules | DOC/COMPUTED/HYP/UNSUPPORTED + abstention | ☐ Approve ☐ Change |
| R08 | Analytics | FLEX map + d² + BASS gas balance | ☐ Approve ☐ Change |
| R09 | Similarity | within investigation only | ☐ Approve ☐ Change |
| R10 | ML | optional research baseline after QA | ☐ Approve ☐ Change |
| R11 | Tech stack | Next.js/FastAPI/SQLite/FAISS | ☐ Approve ☐ Change |
| R12 | Repo organization | add app/, pipeline/, artifacts/, specs/ | ☐ Approve ☐ Change |
| R13 | Public demo | local first, deploy if practical | ☐ Approve ☐ Change |
| R14 | Git safety | no original source mutations; no auto-push | ☐ Approve ☐ Change |
| R15 | Test gates | scientific + API + E2E golden set | ☐ Approve ☐ Change |

**Approval language:** “Chốt bản spec v0.1 với các thay đổi ...; chuyển sang implementation plan và bắt đầu G0/G1.” Until then Claude must not code from this file autonomously.

---

## 19. Source basis (user-provided research documents)

- `01_DATA_INVENTORY.md` — file/format inventory, duplicates.
- `02_FLEX_ANALYSIS.md` — data dictionary, quality, physics baselines.
- `03_BASS_II_ANALYSIS.md` — material, calibration, report linkability, gas balance.
- `04_SAFFIRE_I_ANALYSIS.md` — burn events and image manifest, limitations.
- `05_CROSS_DATASET_ANALYSIS.md` — semantic interoperability, source links.
- `06_SCIENTIFIC_RAG_ANALYSIS.md` — evidence taxonomy, RAG/verification architecture.
- `07_EXISTING_MODELS_AND_RESEARCH.md` — existing research and model-candidate caveats.
- `08_ARCHITECTURE_EVALUATION.md` — D-scoped recommendation and weighted criteria.
- `09_HACKATHON_ROADMAP.md` — release gates, deployment and 3-minute demo.
- `10_EXECUTIVE_SUMMARY.md` — verified/unsupported conclusions.

**Caution:** These reports are analysis artifacts. The implementation must also read and validate original source documents, rather than treating every conclusion from a generated report as authoritative. External model discovery statements in `07` may be incomplete and are **not** used to assert that no similar project exists.

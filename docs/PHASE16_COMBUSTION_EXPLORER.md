# Phase 16 — Combustion & Fire Science Explorer

Route: `/experiments` (unchanged URL). Heading: "Combustion & Fire Science Explorer". The navigation label stays
"Combustion Explorer".

The FLEX, BASS-II and SAFFIRE-I tables, their filters, search, pagination, detail pages, comparison and quality flags are
**unchanged**. They still use `/api/v1/experiments`, and their earlier-phase tests pass. The seven other investigations
are served by `backend/app/services/combustion.py` from the verified curated records (`p13_records`).

## Five domains

| Domain | Collections (`?dataset=`) | Research-to-Safety scenario |
|---|---|---|
| Liquid Droplet Combustion | `flex`, `psi117`, `flex2` | droplet-extinction |
| Gaseous Flame Dynamics | `cfig`, `flame_design`, `bre` | gaseous-flames |
| Solid Flame Spread | `bass2`, `psi62` (profile) | flame-spread |
| Smoke & Fire Detection | `same_log`, `same_sizes` | smoke-detection |
| Spacecraft Fire Dynamics | `saffire1` | flame-spread |

Each domain card shows a verified NASA image with its credit (FLEX heptane droplet, a frame of the CFI-G NASA video, a
BASS-II flame, the Saffire-I hardware). Smoke has no verified NASA image, so its card shows an original schematic labelled
"Original schematic, not a photo".

## Coverage table

| Investigation | Available evidence | Browsing mode | Filters | Comparison support | Scientific limitations |
|---|---|---|---|---|---|
| FLEX (PSI-69) | 274 measured test rows | Existing experiment table, detail pages | fuel, diluent, pressure band, test end, series, O₂, D₀, pressure (existing) | Existing 2–5 compare | Adaptive matrix; K unit flag |
| BASS-II (PSI-25) | 129 runs; report spread rates | Existing table | PI, material class, geometry, restrictor, O₂, thickness (existing) | Existing | Spread rates only in report tables |
| SAFFIRE-I (PSI-98) | 2 burns | Existing table | flow direction | Existing (S1 vs S2) | Two burns only |
| ACME CFI-G (PSI-159) | 333 test points with observed outcomes (179 normal, 154 inverse) | `cfig` collection, record pages | configuration, fuel, observed outcome, hot ignition; O₂ range, pressure range | 2–5 records **of the same configuration** | FT burn times censored; O₂ means ambient (normal) or supplied (inverse) |
| ACME Flame Design (PSI-10) | 327 condition records (207 normal, 120 inverse) | `flame_design`, badge "Experimental conditions only" | configuration, fuel; O₂, pressure | Same configuration only; no outcome columns exist | No outcomes in the download |
| ACME BRE (PSI-20) | 18 day-level records (194 flames in total) | `bre`, badge "Day-level summary — not individual flame tests" | fuel, burner, round | Day vs day only | No per-flame data; emulation, not material testing |
| SAME (PSI-102) | 51-row flight log (47 tests + 4 operations); Table 1 particle sizes (8 rows) | Two **separate** collections: `same_log`, `same_sizes` | log: sample, entry kind, GMT day; sizes: material, aged | Within a table | Moment-method statistics; telemetry not processed; tables not joined |
| PSI-117 | 61 figure-data series (experiment, model, model-only, excluded) | `psi117`, badge "Published figure data — series, not tests" | fuel, role, y variable, figure | **None**: series are not tests | Digitized points; 1-D model; not joined to FLEX |
| FLEX-2 (PSI-68) | 8-row planned test-matrix envelope | `flex2`, badge "No downloaded per-test outcomes" | fuel | **None**: a plan | No results |
| PSI-62 | Metadata only | Investigation profile (`?dataset=psi62`) | – | – | No measurements, no model output |

## Behaviour

- **Filters.** They are rendered from the collection's own fields (`/combustion/collections/{key}` returns `filters` and
  `facets`); a FLEX filter never appears on another collection.
  - Unknown values return 400.
  - Records without a value for a range filter are excluded, and the number excluded is shown.
- **Records.** `/experiments/{collection}/{record_id}` opens a record page with: identity, every value with its role
  (identity / condition / derived / outcome / log), the evidence badge, raw source cells, provenance (file, table, CSV row
  or PDF page with a link, verification), quality flags, the knowledge-graph sources, and links to charts, the analysis
  page test lookup or 3D.
- **Investigation profile** (all collections; standalone for PSI-62): ISA-Tab title and objective, limitations,
  documented relations, documents in SpaceFire, the NASA publication list, and a link to the scenario.
- **Comparison refusals.** `/combustion/compare` refuses, with a plain reason:
  - different collections (for example a CFI-G test with a BRE day)
  - normal with inverse
  - PSI-117 series and FLEX-2 plan rows

  FLEX/BASS-II/SAFFIRE-I comparisons keep their Phase 2 rules.
- **Guided exploration.** "Start guided exploration" on the Explorer runs six steps over real routes. It reuses the Phase 15
  demo bar (`mode: "explore"`).

  | Step | What it shows |
  |---|---|
  | 1 | Domain |
  | 2 | Dataset |
  | 3 | Filtered records (e.g. CFI-G normal n-butane) |
  | 4 | A record (e.g. 21174C3) |
  | 5 | Chart or 3D |
  | 6 | Copilot draft with the Explorer context (scenario + test id) |

  A domain can be switched at step 1. It never sends a question.
- **Two-way links.**
  - Research-to-Safety → Explorer: "Browse records" on each ranked investigation, and "Open the record" on CFI-G and SAME
    evidence items.
  - Explorer → Research-to-Safety: the domain's "Research-to-Safety scenario" link and the profile's scenario link.

## APIs

| Endpoint | Purpose |
|---|---|
| `GET /api/v1/combustion/domains` | Domains, collections, evidence levels, counts |
| `GET /api/v1/combustion/collections/{key}?f_<field>=&min_<field>=&max_<field>=&q=&sort=&order=&page=&page_size=` | Browse one collection |
| `GET /api/v1/combustion/record/{record_id}` | One record with provenance |
| `GET /api/v1/combustion/investigation/{PSI id}` | Investigation profile |
| `POST /api/v1/combustion/compare {record_ids}` | Comparison, or the reason it is refused |

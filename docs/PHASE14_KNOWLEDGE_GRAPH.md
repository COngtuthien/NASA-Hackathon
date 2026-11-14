# Phase 14 — Scientific Knowledge Graph

A lightweight graph stored in the existing SQLite database (`kg_nodes`, `kg_edges` in `backend/app/db/schema.sql`).
No external graph service is used. It is built from rows that are already loaded and verified, and nothing is typed in by hand
as a value.

- Builder: `backend/app/ingest/kg.py`. It runs at the end of `python -m app.ingest.run`, or on its own against an existing
  database: `python -m app.ingest.kg [--db PATH]`. A rebuild deletes and rewrites both tables, so it is idempotent.
- Queries: `backend/app/services/kg.py`.
- API: `/api/v1/graph/*` (below).

## Schema

| Table | Columns |
|---|---|
| `kg_nodes` | `node_id` (PK), `node_type`, `label`, `investigation_id`, `props_json` |
| `kg_edges` | `edge_id`, `src` → node, `rel`, `dst` → node, `basis`, `source_ref`, `props_json`; **UNIQUE(src, rel, dst)** |

**Duplicate prevention.** The builder keeps one edge per (src, rel, dst). If several source rows support the same edge, the
first source is stored and the extra rows are counted in `supporting_rows`.

**Provenance.** Every edge has a `basis` and a non-empty `source_ref`:

| basis | Meaning | source_ref example | Edges |
|---|---|---|---|
| `source_record` | A NASA CSV row or curated record | `experiments:flex:12`, `p13_records:cfig:normal:21088A1` | 6,359 |
| `report_table` | A verified row of a printed NASA report table | `psi-159-reports-finalrpt-acme-cfi-g#page=46` | 544 |
| `registry_metadata` | ISA-Tab metadata (registry, publication lists) | `investigation_registry:PSI-62.related` | 216 |
| `documented_text` | A phenomenon or instrument named in the investigation's own text | `ISA-Tab title/objective`, `same-isatab` | 54 |
| `document_catalog` | The document index | `documents:bass-ii-summary-report` | 50 |

**`documented_text` rule.** A STUDIES or USES_INSTRUMENT edge is created only if one of its listed terms is found in that
investigation's ISA-Tab title or objective, or in one of its indexed NASA documents. The matching term and where it was found
are stored on the edge. Edges whose terms are not found are skipped and listed in `meta.kg_report`. The final build skipped
none. During development one edge was skipped: SAFFIRE-I has no "flame spread" in its objective. Its objective says "how
rapidly a large scale fire grows", so "fire grows" was added as a documented term.

## Contents (final build)

1,588 nodes and 7,223 edges.

| Node type | n | Built from |
|---|---|---|
| investigation | 10 | `investigation_registry` (ISA-Tab) |
| phenomenon | 10 | Curated vocabulary with definitions; linked only through verified `documented_text` edges |
| experiment | 1,112 | FLEX 274, BASS-II 129, SAFFIRE-I 2, CFI-G 333, Flame Design 327 (conditions only), SAME flight-log tests 47 |
| measurement | 48 | CFI-G Table 3 cool-flame events 15, SAME Table 1 rows 8, PSI-117 experimental figure series 25 |
| model_result | 33 | PSI-117 model series (1-D model) |
| outcome | 11 | FLEX test end, CFI-G outcome classes, cool flame observed, BASS-II spread rate reported, SAFFIRE-I burn duration recorded |
| fuel / material / flow_configuration | 17 / 9 / 5 | Values printed in the records (BASS-II material = base material; geometry stays on the experiment) |
| condition_variable | 6 | O₂ mole fraction, pressure (atm), initial diameter, flow velocity, fuel mass flow, smoke aging |
| document / report / table / figure | 40 / 10 / 13 / 22 | `documents`; tables referenced by verified records; PSI-117 figures |
| publication | 203 | NASA PSI publication lists |
| claim | 12 | Report statements (Flame Design and BRE findings, with pages) |
| test_day / literature_value / instrument | 18 / 5 / 4 | BRE Table 1 days, BRE Table 2 literature rows, SAME instruments |

Relationships: BELONGS_TO 1211, HAS_CONDITION 2610, USES_FUEL 972, HAS_CONFIGURATION 792, HAS_OUTCOME 634, REPORTED_IN 263,
PUBLISHED_AS 203, USES_MATERIAL 188, FOR_FUEL 82, SHOWS 58, DOCUMENTED_IN 50, COMPARED_WITH 35, STUDIES 26, HAS_FIGURE 22,
HAS_MEASUREMENT 15, CONTAINS 13, RELATED_TO 13, REPORTS 12, SUPPORTED_BY 12, MEASURED_FOR 8, USES_INSTRUMENT 4.

### Condition edges keep the original values

Each `HAS_CONDITION` edge stores:
- `value` and `unit` (normalized)
- `original` and `original_unit`
- `transform`, for example `mmHg / 760`, `bar / 1.01325` or `% / 100`

CFI-G O₂ is the ambient value for normal flames and the supplied oxidizer for inverse flames; the edge records which (`role`).

### What is deliberately not in the graph

- **PSI-117 and FLEX.** PSI-117 nodes are never linked to FLEX rows: there is no verified mapping. A test enforces this.
- **BRE and BASS-II.** BRE is never linked to BASS-II experiments: emulation is not flame spread. A test enforces this.
- **FLEX-2.** FLEX-2 has no experiments. Its fuels are investigation-level USES_FUEL edges with
  `status = planned test-matrix envelope (no outcome data)`, and fuel names are kept as printed. "Heptane" in FLEX-2 is not
  merged with FLEX's n-heptane. FLEX's "Heptane" is mapped to n-heptane because the FLEX documents name it so.
- **COMPARED_WITH.** These edges join a model series to an experimental series only when both are in the same PSI-117
  figure and plot the same variable.
- **No inferred links.** No edge is inferred from similarity, and no cross-investigation experiment links exist.

## Supported queries (`services/kg.py`, API)

| # | Query | Function | Endpoint |
|---|---|---|---|
| 1 | Investigations studying a phenomenon | `investigations_studying` | `GET /graph/phenomena/{id}/investigations` |
| 2 | Experiments for a fuel or material | `experiments_for` | `GET /graph/experiments?fuel=&material=&investigation=` |
| 3 | Outcomes under supported conditions | `outcomes_under` | `GET /graph/outcomes?investigation=&fuel=&material=&configuration=&o2_min=&o2_max=&p_min=&p_max=` |
| 4 | Source evidence for a node | `evidence_for` | `GET /graph/evidence/{node_id}` |
| 5 | Related investigations (documented relation + shared phenomena) | `related` | `GET /graph/related/{investigation}` |
| – | Node with neighbours; summary | `neighbors`, `summary` | `GET /graph/node/{id}`, `GET /graph/summary` |

`outcomes_under` keeps four results apart:
- **matches**
- **`missing_condition`**: the record has no value for a constrained variable
- **`outside_range`**
- **`not_recorded`**: the investigation never records the variable, so it is not used to drop records

Errors:
- Unknown nodes return 404.
- Unknown condition variables return 400.
- An unknown fuel or material returns `found: false` with an explanatory message.

## Where the graph is used

- **Explorer** (`services/explorer.py`):
  - facet values and counts
  - condition matching (`match`)
  - ranking inputs: STUDIES edges, evidence profile, documented relations
  - evidence items: spread-rate outcomes, Table 3 measurements, SAME measurements, PSI-117 figures, instruments, claims
- **Copilot** (`services/insight.py`), as the `query_knowledge_graph` tool on every question:
  - investigations studying each phenomenon named in the question
  - evidence profiles of the investigations
  - Table 3 cool-flame records
  - SAME Table 1
  - PSI-117 experiment/model counts
  - report findings
  - a cross-investigation comparison guard: shared phenomena and condition variables
- **Explorer → Copilot handoff**: the evidence ids are resolved through `kg.node` and `kg.evidence_for`.

No graph visualization was built (it was optional, P2).

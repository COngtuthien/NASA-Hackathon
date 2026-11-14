# Phase 14 — Ranking Methodology

The Explorer ranks the NASA investigations in a scenario by **research relevance** to its question. The score is
deterministic and computed from the knowledge graph. It does **not** represent fire danger, safety probability, prediction
confidence or NASA endorsement. The API returns this statement with every response (`disclaimer`) and the UI shows it.

Implementation: `backend/app/services/explorer.py` (`rank`, `match`, `evidence_class`). The constants are returned by
`GET /explorer/scenarios` (`ranking`).

## Three separate measures

### Relevance R (0–100) = topic + environment + role

| Component | Points | Source |
|---|---|---|
| Topic: STUDIES a primary phenomenon of the scenario with primary focus | 60 | `STUDIES` edge (documented_text) |
| Topic: STUDIES a primary phenomenon with secondary focus | 45 | " |
| Topic: STUDIES only a secondary phenomenon of the scenario | 30 | " |
| Topic: only a documented RELATED_TO the primary investigation | 15 | registry relation |
| Environment: flight platform (ISS, Shuttle, Cygnus) in ISA-Tab | 20 | registry `platform`/`hardware` |
| Environment: ground or analysis, or platform not stated | 10 | " |
| Role in the scenario: primary / supporting / context | 20 / 10 / 5 | scenario definition (from the Phase 14 brief) |

### Evidence strength E (0–100): strongest class present in the graph for that investigation

| Class | Points | Rule |
|---|---|---|
| measured per-test outcomes | 100 | Experiments with `HAS_OUTCOME` edges |
| report-backed measurements derived by NASA | 80 | Measurement nodes, no model nodes (SAME Table 1) |
| published figure data with model curves | 60 | Measurement and model_result nodes (PSI-117) |
| report statements and operational logs | 45 | Claims or test days (BRE; Flame Design's findings) |
| test conditions only | 35 | Experiments with no outcomes |
| documentation only | 20 | Documents but no records (FLEX-2) |
| metadata only | 10 | Readiness `metadata_only` (PSI-62) |

**Directness D.** D is 1 when the investigation studies one of the scenario's primary phenomena, and 0.5 otherwise
(indirect evidence, e.g. BASS-II in the smoke scenario). E is shown unchanged; D only reduces its weight in the score.

### Applicability A (0–100, or "not assessed")

The filters are evaluated per investigation:
- Category filters (material, fuel, flow direction, configuration, geometry, smoke age) must match exactly.
- Numeric ranges (O₂ mole fraction, pressure in atm) are applied exactly. No tolerance or "close match" is used, because
  none was justified by the data.

| Situation | A |
|---|---|
| No selected filter is recorded by the investigation | **None** (not assessed, not penalized) |
| At least one record meets every evaluated filter | 100 |
| No record meets all of them | 50 × (filters met individually / filters evaluated) |

How records are classified:
- A record lacking a value for a constrained variable is **incomplete**: excluded and counted separately.
- A record with a different value is **rejected**, e.g. inverse CFI-G tests when "normal" is selected.
- Missing metadata is never treated as a failed experiment.

## Score

```
score = round(0.5·R + 0.3·E·D + 0.2·A)               when A is assessed
score = round((0.5·R + 0.3·E·D) / 0.8)               when A is not assessed
```

Ties are broken by E, then by investigation id, so the order is fully deterministic. A test recomputes the score from the
returned components for every scenario.

## Explanations

Each ranked investigation has a sentence built only from its components. The lead is chosen as follows:
- "Supporting context only" when the role is context, E ≤ 20, or the topic match is only indirect.
- Otherwise "Highly relevant" (score ≥ 75), "Relevant" (≥ 50) or "Supporting context only".

Examples (default filters, final build):

| Scenario | # | Investigation | Score | R / E·D / A | Explanation |
|---|---|---|---|---|---|
| Flame spread | 1 | BASS-II | 100 | 100 / 100 / – | Highly relevant: it studies flame spread over solid materials, and it measured outcomes for 18 tests. |
| | 2 | SAFFIRE-I | 94 | 90 / 100 / – | Highly relevant: … it measured outcomes for 2 tests. |
| | 3 | PSI-62 | 54 | 80 / 10 / – | Supporting context only: … only metadata was downloaded, with no measurements. |
| | 4 | ACME BRE | 43 | 55 / 45×0.5 / – | Supporting context only: it studies a related topic (material flammability) … Indirect evidence. |
| Gaseous flames | 1 | ACME CFI-G | 100 | 100 / 100 / – | Highly relevant … measured outcomes for 333 tests. |
| | 2 | ACME Flame Design | 73 | 90 / 45 / – | Relevant … test conditions for 327 tests and report statements, but no per-test outcomes. |
| | 3 | ACME BRE | 64 | 75 / 45 / – | Relevant: burning-rate emulation of condensed fuels is a secondary topic … |
| Smoke detection | 1 | SAME | 92 | 100 / 80 / – | Highly relevant … 8 report-backed measurement rows. |
| | 2–3 | BASS-II, SAFFIRE-I | 53 | 55 / 100×0.5 / – | Supporting context only … Indirect evidence. |
| Droplet extinction | 1 | FLEX | 100 | 100 / 100 / – | Highly relevant … measured outcomes for 274 tests. |
| | 2 | PSI-117 | 72 | 80 / 60 / – | Relevant … 25 published experimental series and 33 model series. |
| | 3 | FLEX-2 | 64 | 90 / 20 / – | Relevant … only documents and a planned test matrix were downloaded, with no measurements. |

The "18 tests" for BASS-II counts tests with a spread rate in the verified Summary Report table rows. The other 111 BASS-II
rows hold run conditions and gas measurements but no flame-spread outcome in the CSV; they still match filters as
experiments.

## Validation (backend tests, `tests/test_phase14.py`)

- The primary investigation ranks first in all four scenarios.
- The score equals the formula recomputed from its components.
- Results are deterministic: two identical requests give the same order, scores and evidence ids.
- Metadata-only PSI-62 has E = 10 and a "Supporting context only" label.
- Documentation-only FLEX-2 is labelled "no measurements".
- Unrecorded conditions give A = None (PSI-117 with an O₂ filter).
- Incompatible records are rejected: an inverse filter rejects exactly the 179 normal CFI-G tests.
- Out-of-range filters give "No matching experimental evidence is available for these conditions."
- Explanations never contain "risk", "danger", "probability" or "certif…".

## Limits

- **Curated weights.** The role points and phenomenon focus come from the Phase 14 brief and the investigations' own
  descriptions; they are documented and fixed, not learned. The weights (0.5 / 0.3 / 0.2) are a design choice and were not
  calibrated against user judgments.
- **Coarse evidence strength.** E reflects what was downloaded locally, not the scientific quality of the investigation.

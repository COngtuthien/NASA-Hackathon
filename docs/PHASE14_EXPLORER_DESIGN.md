# Phase 14 — Research-to-Safety Explorer Design

The Explorer lets a user start from a research question or a spacecraft fire-safety scenario instead of an investigation
name. It is a research-discovery and evidence-interpretation tool. **It is not a certified fire-risk assessment**: it does
not predict fire probability, certify materials, or decide operational safety. The entry page and every workspace say so.

## Routes

| Route | What it shows |
|---|---|
| `/safety-explorer` | Introduction, four scenario cards, how the ranking works, the research-support notice |
| `/safety-explorer/{scenario}` | The research workspace. Filters are URL query parameters, so every state can be linked |

Navigation: "Research-to-Safety Explorer" sits under *Discover*, directly after Home (icon `compass`).

| API | |
|---|---|
| `GET /api/v1/explorer/scenarios` | Scenario cards and the ranking constants |
| `GET /api/v1/explorer/scenarios/{id}?…` | Workspace: facets, ranked list, matching, evidence, summary, interpretation, links |

Filter parameters: `material`, `flow`, `geometry`, `configuration`, `fuel`, `o2_min`, `o2_max`, `pressure_min`
(atm), `pressure_max`, `aging`, `investigation`, `evidence`. They are validated against the scenario's real values: an
unknown value, a value out of range or min > max returns 400, which the page shows as an error.

## Scenarios (`SCENARIOS` in `services/explorer.py`)

| id | Title | Primary | Supporting / context | Filters |
|---|---|---|---|---|
| `flame-spread` | Flame Spread in Spacecraft Materials | BASS-II (PSI-25) | SAFFIRE-I, PSI-62 (supporting); ACME BRE (context) | material, flow direction, sample geometry |
| `gaseous-flames` | Gaseous Flame Behavior | ACME CFI-G (PSI-159) | Flame Design (PSI-10), BRE (PSI-20) | configuration, fuel, O₂ range, pressure range |
| `smoke-detection` | Early Smoke Detection from Overheated Materials | SAME (PSI-102) | SAFFIRE-I, BASS-II (context) | material, smoke age |
| `droplet-extinction` | Droplet Flame Extinction | FLEX (PSI-69) | PSI-117, FLEX-2 (PSI-68) | fuel, O₂ range, pressure range |

The research questions are those of the Phase 14 brief. Every scenario also has an investigation filter and an evidence-type
filter, which narrow the evidence panel. Filter options are the values present in the graph, with record counts; FLEX-2's
planned fuels are listed with 0 records.

## Workspace layout

1. **Scenario context.** Research question, domain, summary, the research-support notice, and the source availability of
   each investigation (readiness and record count).
2. **Scientific filters.** Selects and min/max inputs whose options come from the data, plus removable filter chips.
3. **Ranked investigations.** Rank, name, PSI id, role, readiness and research-relevance score, with three bars (Relevance,
   Evidence strength, Applicability), the generated explanation, the first two limitations, actions (Explore charts, Open 3D
   Studio, Ask Copilot about this investigation) and a "How this score was computed" breakdown. See
   `PHASE14_RANKING_METHODOLOGY.md`.
4. **Outcome summary** for the selection, by scenario:

   | Scenario | Summary | Rule |
   |---|---|---|
   | Flame spread | BASS-II reported spread rates grouped by material form and flow direction | Listed, never averaged across groups |
   | Gaseous flames | CFI-G outcomes per configuration | Normal and inverse kept apart; censored count shown |
   | Smoke detection | SAME fresh vs aged mean diameters per material | – |
   | Droplet extinction | FLEX test-end counts per fuel | Not probabilities: the matrix was adaptive |

5. **Evidence.** Each item has an evidence-class tag (measured, derived, published figure data, model prediction, report
   statement, literature value, test condition, operational log, NASA document passage, metadata only), the investigation,
   the observation (built from record values), conditions, the source (document and PDF page link, or CSV row), its
   limitations, and links (view test or experiment, open in 3D Studio).
6. **Scientific interpretation.** What the evidence shows (sentences computed from the selection), why it matters, what
   cannot be concluded, and the missing data (registry limitations, unrecorded conditions).
7. **Actions.** Explore charts, Open 3D Studio (with a note that the 3D view is conceptual), View experiment/test, View
   evidence, Ask Research Copilot, and for droplets the PSI-117 model-vs-experiment charts.

## Evidence selection (per scenario)

- **Flame spread.**
  - BASS-II experiments in the selection that have a verified Summary Report spread rate (Table 5.1 rows): value, airflow,
    table, row and page.
  - SAFFIRE-I burns that match.
  - The PSI-62 metadata-only card.
  - One BRE finding, labelled "not a measured BASS-II flame-spread rate".
  - Two BASS-II document passages from the existing hybrid retrieval.
- **Gaseous flames.**
  - Up to four Table 3 cool-flame events among the matching CFI-G tests, with radii and PDF p.46. 21174D1's cool-flame
    radius is shown as not measured, per the table footnote.
  - One representative test per outcome and configuration, with the censoring note.
  - A count of matching Flame Design conditions (conditions only) and Flame Design findings.
  - BRE findings, labelled as emulation.
  - CFI-G passages.
- **Smoke detection.**
  - SAME Table 1 rows matching material and age (p.27).
  - A flight-log summary (Appendix A, p.33).
  - The four instruments named in SAME documents.
  - SAME passages.
- **Droplet extinction.**
  - One representative FLEX test per fuel and test end, with K noted as mm²/s.
  - Up to four PSI-117 figures with experiment and model series counts.
  - The FLEX-2 planned test-matrix card (conditions only).
  - FLEX passages.

When the filters exclude every record of the primary investigation, the page says "No matching experimental evidence is
available for these conditions." and predicts nothing.

## Deep links (all to existing routes)

| Scenario | Charts | 3D Studio | Experiment / test | Other |
|---|---|---|---|---|
| Flame spread | `/phenomena/flame-spread#spread` (opens the report tables) | `/phenomena/flame-spread?record=bass2:N#studio` | `/experiments/bass2/bass2:N` | – |
| Gaseous flames | `/phenomena/gaseous-flames?tab=cfig&cfg=…&fuel=…&o2min=…&o2max=…` | `/phenomena/gaseous-flames#studio` | `/phenomena/gaseous-flames?tab=cfig&test=ID#cfig-lookup` | `#cfig-cool` |
| Smoke detection | `/phenomena/smoke-detection#sizes` | `/phenomena/smoke-detection?material=kapton#studio` | `#log` | `#instruments` |
| Droplet extinction | `/phenomena/flame-extinction?fuel=Heptane&o2_min=…&o2_max=…#map` | `/phenomena/flame-extinction?record=flex:N#studio` | `/experiments/flex/flex:N` | `#psi117-explore`, `#flex2` |

How context is carried:
- Only parameters a page already supports are passed (CFI-G `cfg`, `fuel`, `o2min`, `o2max`, `test`; FLEX `fuel`, `o2_min`,
  `o2_max`; the studio `record`).
- New in Phase 14: the Smoke page accepts `?material=` (a Table 1 material) and preselects it in the charts and the studio.
  Any other value is ignored. It is read without `useSearchParams`, so the page stays statically prerendered.
- Pressure ranges are not forwarded to the CFI-G page, which uses discrete bar levels. A studio link never implies that the
  selection drives measured geometry.

## Copilot handoff

"Ask Research Copilot" opens `/copilot?draft=<research question>&inv=<PSI id>&scenario=<id>&test=<id>&evidence=<node ids>`.
- The question is only **pre-filled**; nothing is sent until the user presses Ask.
- The Copilot shows a "From the Research-to-Safety Explorer" panel listing what will be sent, with a checkbox to turn it off.
- The request carries `explorer_context` with ids only. The server checks every id against the database and builds the
  context evidence item from the scenario definition and the registry limitations. No browser text becomes an instruction.
- Requests that do not come from the Explorer keep their previous shape: no `explorer_context` key.

## Accessibility and layout

- Native selects and number inputs with labels; buttons expose `aria-expanded`; filter chips can be removed by keyboard.
- Desktop: a sticky 300 px filter column. Below 1024 px: one column.
- No horizontal scroll at 390 px (browser test).
- Light and dark themes use the existing tokens; the Explorer is tested in the light theme.

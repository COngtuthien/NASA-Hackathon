# Phase 13 — Scientific Data Integration, Analysis & Interactive 3D

Branch `feature/spacefire-phase13-scientific-expansion`. Rollback reference: `backup/spacefire-before-phase13`
(= `4a3b2bc`, pushed).

## 1. Git baseline

Verified with `git fetch` and `merge-base --is-ancestor`. The history is linear:

`66242ac` (Phase 12 themes) → `bcd76ce` (Copilot 503/504 fix) → `79d08cf` (first dataset audit) → `4a3b2bc` (ACME
audit).

The audit commits only add documentation and scripts, so the Phase 13 branch was created directly from `4a3b2bc`.
This contains Phase 12, the Copilot fixes and both audits; no merge or cherry-pick was needed. No uncommitted tracked
changes existed. The NASA folders, the user's `NASAChallenge202611.pptx` and `run.txt` stayed untracked and untouched.

## 2. Folder rename

| | |
|---|---|
| Old path | `D:\NASA Hackathon\AMCE Flame Design` |
| New path | `D:\NASA Hackathon\ACME Flame Design` |
| Identity check | `PSI-10_metadata_PSI-10-ISA.zip` → `Study Identifier PSI-10`, "Advanced Combustion via Microgravity Experiments / Flame Design" |
| Destination existed? | No |
| Files | 14 before, 14 after; all SHA-256 identical (verified by diff of the two hash lists) |
| Method | `mv -n` (no overwrite); file contents untouched; not staged |
| References updated | `research/scripts/acme_dataset_inventory.py`; the Phase 13 processors use `ACME Flame Design`, and `app.ingest.phase13.run` refuses to run (with a message) if only the misspelled folder exists |
| Historical evidence kept | `docs/ACME_DATASET_AUDIT.md` (a rename note added at the top) and `docs/ACME_DATASET_INVENTORY.csv` keep the original name |

## 3. What was built

### Data (backend)
- `backend/app/ingest/phase13/`: reproducible processors (`cfig.py`, `acme_other.py`, `same.py`, `psi117.py`,
  `registry.py`), shared provenance helpers (`common.py`), runner (`run.py`), DB loader and document catalog
  (`load.py`). Output goes to `processed/curated/phase13/*.json` (committed, 1.8 MB). See
  `PHASE13_DATA_PROCESSING_REPORT.md`.
- Schema: `investigation_registry`, `p13_datasets`, `p13_records`, `p13_values` (long-format evidence schema with
  original/normalized value and unit, transform, evidence class, verification). New flags go into `quality_flags`.
- Main ingest: 7 new investigations, 30 new documents (final reports, SRDs, data-interpretation guides, PSI-117 slides
  and dissertation, SAME final report and ICES decks, ISA-Tab metadata). Drawings, damaged archives, videos, vendor
  manuals and duplicate copies are excluded. 203 publications.
- API (`backend/app/services/phase13.py`, routes in `api/v1/routes.py`):
  - `GET /registry`, `GET /registry/datasets`
  - `GET /gasflames/cfig` (filters: configuration, fuel, p_bar, o2_min, o2_max, outcome; validated)
  - `GET /gasflames/cfig/test/{id}`, `GET /gasflames/flame-design`, `GET /gasflames/bre`
  - `GET /smoke/same`, `GET /flex/psi117?figure=`
- Copilot: investigation detection and validation accept the 7 new IDs (word-boundary patterns, so "the same" does
  not trigger SAME); the system prompt names them. The 503/504 handling and evidence-only fallback are unchanged.

### Scientific analysis (frontend)
- **Gaseous Flame Dynamics** `/phenomena/gaseous-flames`: the studio plus three tabs (`?tab=cfig|flame-design|bre`).
  - **CFI-G**: URL-driven filters for configuration, fuel, pressure and O₂ range. Charts: outcomes by fuel; normal vs
    inverse shares; outcome vs O₂ and pressure; SE burn-time boxes with censored FT points; Table 3 cool-flame
    radii; test lookup with raw cells, provenance and flags; report-vs-table counts; limitations with flag rules.
  - **Flame Design**: conditions-only notice; Tad vs Zst condition space (optional CFI-G overlay); published findings
    with pages; day log.
  - **BRE**: what the emulator is; why it matters; campaign chart; day log showing the CSV differences; reported
    results; literature table labelled literature; emulation caveat.
- **Smoke & Fire Detection** `/phenomena/smoke-detection`: the studio; material selector; fresh vs aged charts and
  table; other-source comparison; flight log with sample filter; moment-method and detector explanation; telemetry
  deferral notice; limitations.
- **FLEX extension** (`/phenomena/flame-extinction#psi117`, `#flex2`): a short visible caveat; behind "Explore the PSI-117 charts" (`#psi117-explore`) the cool-flame explanation and 22 PSI-117 figures
  (experiment markers, model lines, model-only dashed, flagged points drawn separately, units with their status);
  provenance and limits; FLEX-2 context card. The existing FLEX map, d²-law and studio are unchanged.
- Navigation: two new items under *Scientific analysis*. `INV_LABEL`, PSI links, Copilot suggestions and the scope
  list cover the new investigations.

### Interactive 3D
- `components/studio/LiteStudio.tsx` + `LiteViewport.tsx`: shared shell reusing the existing canvas, camera controls
  and fullscreen hook.
- Gaseous Flame Studio (`components/3d/GasFlameScene.tsx`) and Smoke Detection Studio (`components/3d/SmokeScene.tsx`).
  See `PHASE13_3D_EVIDENCE_MAPPING.md`.
- FLEX Studio: the flame component now explains hot vs cool flames and links PSI-117 evidence. The cool regime is
  intentionally not drawn.

## 4. Phase 14 readiness

- `GET /registry`: per investigation, identity (ISA-Tab), `scenario` (one of `material_flame_spread`,
  `gaseous_flame_behavior`, `early_smoke_detection`, `droplet_flame_extinction`), `readiness`, analysis `route`,
  `studio` deep link, `datasets`, supported `conditions`, `completeness` indicators, machine-readable `limitations`
  (code + text), `related` investigations, publication, document and flag counts.
- `GET /registry/datasets`: per dataset counts, sources and SHA-256, notes.
- `p13_values`: long-format evidence rows (variable, original/normalized value and unit, transform, evidence class,
  verification) for a knowledge graph.
- Deep links: `?tab=`, CFI-G filter parameters (`cfg`, `fuel`, `p`, `o2min`, `o2max`, `test`) and section anchors.
- No Explorer, knowledge graph or new ML model was built (out of scope by design).

## 5. Deferred or limited (honest list)

- SAME 1 Hz telemetry plots (P2): deferred; reasons in the processing report §5.
- Flame Design outcomes: absent from the download; only author findings are shown.
- BRE per-test data and flammability maps: absent (figures only in the report).
- PSI-62: metadata only; registry entry and one indexed document, no page.
- FLEX-2: documentation only; context card, no chart.
- Phase 13 retrieval: hybrid R@10 = 0.786, R@5 = 0.50 on 14 strict paraphrase queries. Three questions miss in the top
  10 (three-stage FLEX 1268, FLEX-2 envelope, inverse-flame soot).
- No live Gemini evaluation was run (by design: no quota used).

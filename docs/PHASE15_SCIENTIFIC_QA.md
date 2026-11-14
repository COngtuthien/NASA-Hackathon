# Phase 15 — Scientific QA

Final review of what the application shows, against the curated records and NASA documents in the local database.

## Corrections made in Phase 15

| Item | Before | After | Source |
|---|---|---|---|
| Gaseous Flame Studio, cool-flame explanation | "roughly 500–1000 K", no citation | "peak temperatures of cool diffusion flames are 500–1000 K, CFI-G report p.24", plus a link to p.24 | CFI-G Final Report p.24: "cool diffusion flames (whose peak temperatures are 500 – 1000 K)" |
| CFI-G clip on the Gaseous Flame page | Shown only on the FLEX page, with the caveat "not FLEX data" | Also shown on the Gaseous Flame page, with the caveat "NASA public footage of one CFI-G test; no test number, so not tied to a data row; the 3D studio is not reconstructed from it" | NASA Image and Video Library caption (in the media catalog) |
| Copilot investigation detection | "BRE" alone was not recognised, so a BRE question got no BRE evidence | "BRE" in capitals is recognised; "break" and lower-case words are not | Benchmark p15-05 |

## Checks (visible application)

| Investigation | Check | Result |
|---|---|---|
| ACME CFI-G | Normal and inverse kept apart | Pass: Explorer summary, CFI-G charts and studio arrangement; the inverse filter rejects exactly the 179 normal tests (backend test) |
| | Flow-terminated times not shown as extinction times | Pass: "censored" / "≥" everywhere; the Explorer and demo say "lower bounds" |
| | Cool-flame conditions | Pass: Table 3 events only (n-butane 30 %, normal, 2.03 bar); 21174D1's cool radius is shown as not measured |
| | Measured radii only with matching tests | Pass: radii are drawn only when a Table 3 event is selected (browser test) |
| | 3D not presented as CFD | Pass: conceptual notice and evidence banner stay visible in every state |
| SAME | Units and fresh vs aged | Pass: nm; fresh and aged 720 s; the studio panel follows material and age (browser test against API values) |
| | Telemetry | Pass: "deferred" notice; nothing plotted |
| | Particle animation labelled | Pass: "Educational illustration"; the key says "not to scale" |
| PSI-117 | Experiment vs model separated, digitized points identified, units traced | Pass (Phase 13 charts unchanged) |
| | No FLEX row joins, no 3D CFD claim | Pass: no graph edge (backend test); the FLEX studio does not draw the cool regime |
| Flame Design | Conditions only, not outcomes | Pass: "conditions only" in the ranking, evidence and charts |
| BRE | Not presented as solid flame spread | Pass: limitation on every BRE evidence item in the flame-spread scenario (backend and browser tests) |
| FLEX-2, PSI-62 | Limits visible | Pass: "documentation only" and "metadata only" in the ranking and evidence |
| FLEX, BASS-II, SAFFIRE-I | Descriptions unchanged | Pass: no scientific text changed. Phase 7–12 browser tests pass. |
| Demo copy (`lib/demo.ts`) | Every number is shown on the linked page | Pass: 333/179/154 tests, 15 events, 21174C3 radii, Kapton 105/186 nm, FLEX 274, M1 0.071 mm/s at 9 cm/s. Each was checked against the database during development; browser tests assert the Kapton and CFI-G figures on their pages. |

## Provenance unchanged

- No NASA source file was opened for writing, and no curated value or record was changed.
- Phase 15 added no data processing; the knowledge graph is the Phase 14 build.
- New UI numbers (demo counts) are read live from `/registry` and `/graph/summary`.

## Unresolved limits (unchanged, visible in the app)

- SAME 1 Hz telemetry: not processed.
- Flame Design: no outcomes in the download.
- BRE: no per-test data.
- FLEX-2: documentation only.
- PSI-62: metadata only.
- The question classifier is rule-based (see `PHASE15_AI_BENCHMARK.md`).

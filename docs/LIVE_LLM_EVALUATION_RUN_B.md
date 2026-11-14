# Live LLM evaluation, Run B (golden questions)

Generated 2026-11-11 10:28 UTC by `python -m app.eval.live_llm`. Provider `gemini`, model `gemini-3.8-flash` (served as `gemini-3.8-flash`). Real database, real retrieval, real verifier; nothing mocked.

- Questions run: **5** of 5
- Status: answered 5
- Model requests: 5 (a question uses 2 when its first answer fails verification)
- Model latency per question: median 8.7 s, max 14.5 s
- Structural issues: 0 question(s)

Status meanings: `answered` = every generated statement passed citation and number verification; `partial` = some statements were removed by the verifier; `insufficient_evidence` = the model (or verifier) found the evidence does not support an answer; `retrieval_only` = no synthesis (provider error).

| ID | Category | Status | Claims | Rejected | Calls | Model s | Issues |
|---|---|---|---|---|---|---|---|
| g02 | id | answered | 4 | 0 | 1 | 11.9 | — |
| g27 | comparison | answered | 6 | 0 | 1 | 8.0 | — |
| g22 | mechanism | answered | 4 | 0 | 1 | 8.7 | — |
| g31 | dataset_fact | answered | 2 | 0 | 1 | 5.5 | — |
| g29 | external | answered | 2 | 0 | 1 | 14.5 | — |

## Run B context and manual review (2026-11-11, on top of Phase 5 commit 8b6dea0)

Run B re-tests the questions that failed or did not run in Run A (`docs/LIVE_LLM_EVALUATION.md`): g02 and g27 stated
the FLEX burning rate K as "mm"; g22 and g29 got HTTP 503; g31 was re-run as a dataset-fact control. The table above
merges three harness runs made at 10:20–10:28 UTC:
1. g02 and g27, run first. Both answered on the first attempt, and both now state K in mm²/s.
2. g22, g31 and g29. g29 returned `insufficient_evidence` (details below).
3. g29 again, after the retrieval fix described below. This is the g29 row in the table.

Gemini requests used in this validation: 5 (run 1 and 2) + 1 (g29 re-run) + 2 (browser test: the first answer failed
verification and was regenerated) = **8**, plus one automatic SDK retry after a transient HTTP 503 ("high demand") in the
browser test. No 429 occurred. The harness bypasses the verified-answer cache, so every answer above is a fresh call.

### Unit check (the reason for Run B)
- g02: "burning rate of '0.41' mm²/s (raw header 'Burning rate; mm')" and "'0.56' mm²/s" for rows 70 and 73.
- g27: "d²-law burning rate constant K was 0.52 mm²/s (raw header reads 'Burning rate; mm')".
- No statement in Run B gives K in mm or any other unit. The verifier rejected nothing in these two answers; the
  model followed the column note and the corrected system rule directly.

### Numbers checked against the database (by hand, not by the model)
| Q | Values stated | Source checked | Result |
|---|---|---|---|
| g02 | rows 70/73: d0 4.67/4.64 mm, d_ext 4.6/4.58 mm, K 0.41/0.56 mm²/s, burn 1.6/1.5 s; 761 mmHg; X_O2 0.15; X_N2 0.84; 3/23/2010 7:25:43 | `flex_tests` flex:70, flex:73 | all match |
| g27 | 20CAL08: methanol, d0 1.69 mm, 757.7 mmHg, 0.21/0.79, K 0.52 mm²/s, 4.3 s, Disruption. M5: 3 mm PMMA, two-sided, O2 22.2→19 vol%, 0.071 mm/s at 10 cm/s, 27.2 min, GMT day 51 | `flex_tests` flex:1; `bass2_tests` bass2:31; report Table 5.1 (PDF p.65) | all match |
| g22 | slope 0.8078 (r 0.9815, n 121), 0.8096 (n 66), reference 0.8333; slab 0.8281, clear rod 0.8037, black rod 0.7935, sphere 0.7, thin film 0.4179; test O2 gases 22.2→21.9 %, 0.44→0.59 %, −1→23 ppm | `analytics.bass_gases`; `bass2_tests` bass2:48; Table A.5 (PDF p.118) | all match |
| g31 | Sample 2: S2C1 25.0689 %, S2C2 25.4215 % of 18150 frames, 604.9 s from 2016-06-14T20:56:33.510Z | `saffire_manifest` (4550/18150, 4614/18150) | all match |
| g29 | 3 titles + DOIs (10.1016/j.combustflame.2018.10.012, 10.1016/j.proci.2018.05.168, 10.1016/j.actaastro.2014.11.025); "6 publications" | `investigation_publications` PSI-98 | all match |

Every claim cites at least one citation id from its own evidence pack; no invented ids, pages, DOIs or test ids.

### Scientific reasoning review
- g02: correctly explains the duplicate identifier, keeps both rows addressable, and says the evidence cannot tell a
  re-analysis from a repeated test. Sound.
- g27: refuses a numeric FLEX-vs-BASS-II comparison (different physical systems), describes each test separately, and
  notes that BASS-II "GMT" is a day of year. Minor: it gives M5's width as 2.2 cm (Table 5.1) while also citing the CSV
  row, whose raw text reads "2 cm"; the answer does not point out that difference. Not a fabrication (2.2 is in the cited
  report row), but a missed opportunity to flag a source difference.
- g22: numbers are right. The opening "Yes" is a little stronger than the evidence: the overall slope (0.81 vs 0.83
  reference) supports "nearly stoichiometric", but the thin-film class (0.42, n = 5) does not. The answer lists that
  value without qualifying the "Yes". Recorded as a wording weakness, not an error.
- g31: exact, and correctly says the manifest holds frame counts, not images or flame measurements.
- g29 (first attempt): `insufficient_evidence`. The answer said no listed paper "specifically" covers SAFFIRE
  large-scale flame spread. That was honest about its evidence pack, but the pack was incomplete: it held only
  external search hits, while SpaceFire's own NASA PSI metadata lists 6 SAFFIRE publications, including Urban et al.,
  *Flame spread: Effects of microgravity and scale*.
  **Fix:** literature questions that name an investigation now add NASA PSI's publication list for it as a
  `publication_list` evidence item, in every source scope (`assistant.py`). The system prompt says these titles are
  metadata only, so topics may be inferred from titles alone. Golden g29 now requires that item and the Urban et al.
  title. Re-run: answered, and the answer states that topics are inferred from titles because the papers were not read.

### Live browser test (opt-in)
`E2E_LIVE_LLM=1 npx playwright test -g "live Gemini"`: **1 passed** (31 s) against the production build (`next start`)
and the API with the real key. The test asserts that:
- the streamed progress step "Write answer with the model" appears;
- the status reaches Answered (or Partial);
- the "Written by gemini" label is shown;
- the answer contains clickable citation markers.

Server log for that request (`POST /api/v1/assistant/ask/stream`, 200): the tools ran as get_document_evidence →
synthesize_answer → verify_citations (1 statement rejected) → synthesize_answer → verify_citations, and the result
was `answered` in 28.8 s. The final answer about SIBAL fabric has 4 DOC claims citing 6 NASA document passages: the
75/25 cotton/fiberglass blend, the name from the "Solid Inflammability Boundary at Low Speeds" project, the fiberglass
mesh keeping the sample intact, and flat samples flown in BASS and BASS-II.

### Verdict
Phase 4 live validation passes:
- FLEX K is stated in mm²/s in both previously failing answers;
- all checked numbers and citations are correct;
- the one retrieval gap found (g29) was fixed and re-verified live;
- the live browser path works end to end.

The two wording weaknesses noted above (g22, g27) are recorded, not hidden.

## Answers

### g02: Show FLEX identifier 193F001 and explain the duplicate ambiguity.

Status **answered**.

> FLEX Identifier '193F001' appears twice in the dataset across two different rows with conflicting measurements [cite-1, cite-2, cite-3]. Both tests share the date '3/23/2010', GMT '7:25:43', fuel 'Heptane', ambient pressure '761' mmHg, O2 mole fraction '0.15', and N2 mole fraction '0.84' [cite-1, cite-2]. However, they differ in several measured values: row 70 (UID 'flex:70', Test # '70') records an initial droplet diameter of '4.67' mm, extinction diameter of '4.6' mm, burning rate of '0.41' mm²/s (raw header 'Burning rate; mm'), and burn time of '1.6' s [cite-1]. Row 73 (UID 'flex:73', Test # '73') records an initial diameter of '4.64' mm, extinction diameter of '4.58' mm, burning rate of '0.56' mm²/s (raw header 'Burning rate; mm'), and burn time of '1.5' s [cite-2]. Quality rule FLEX-DUP-ID flags this duplicate, noting canonical UIDs use the source row to maintain addressability [cite-1, cite-2, cite-3].

- [COMPUTED] FLEX Identifier '193F001' occurs twice in the dataset at source rows 70 and 73 with distinct test numbers and differing measured values. (cite-1, cite-2, cite-3) — applies to: FLEX dataset table rows 70 and 73
- [COMPUTED] Row 70 (FLEX Test # 70) reports initial diameter 4.67 mm, visible flame extinction diameter 4.6 mm, burn time 1.6 s, and burning rate 0.41 mm²/s (raw header 'Burning rate; mm'). (cite-1) — applies to: FLEX row 70, Test Date 3/23/2010 7:25:43 GMT
- [COMPUTED] Row 73 (FLEX Test # 73) reports initial diameter 4.64 mm, visible flame extinction diameter 4.58 mm, burn time 1.5 s, and burning rate 0.56 mm²/s (raw header 'Burning rate; mm'). (cite-2) — applies to: FLEX row 73, Test Date 3/23/2010 7:25:43 GMT
- [COMPUTED] Quality rule FLEX-DUP-ID confirms that '193F001' occurs 2 times with different values, requiring canonical UIDs based on source rows to address each record. (cite-3) — applies to: Quality rule FLEX-DUP-ID evaluation

Cited sources: cite-1 experiment: FLEX 193F001 (source row 70); cite-2 experiment: FLEX 193F001 (source row 73); cite-3 quality_flag: Quality rule FLEX-DUP-ID (2 flag(s))

### g27: Compare FLEX test 20CAL08 with BASS test M5.

Status **answered**.

> FLEX test 20CAL08 and BASS-II test M5 represent fundamentally different physical systems and cannot be directly compared numerically [cite-5]. 
> 
> FLEX 20CAL08 studied isolated liquid droplet combustion using Methanol fuel, with an initial droplet diameter of 1.69 mm in an ambient environment of 0.21 mole fraction O2, 0.79 N2, and 757.7 mmHg pressure [cite-1]. Its d²-law burning rate constant K was 0.52 mm²/s (raw header reads 'Burning rate; mm'), burn time was 4.3 s, and the test ended in 'Disruption' [cite-1].
> 
> In contrast, BASS-II test M5 studied solid-phase combustion of a 3-mm-thick PMMA sample burning on two sides (width 2.2 cm) under opposed flow [cite-2, cite-3, cite-4]. It had an initial calibrated O2 of 22.2 vol% (dropping to 19 vol%), a spread rate of 0.071 mm/s at 10 cm/s flow velocity, and a burn time of 27.2 min [cite-3]. Additionally, GMT in BASS-II denotes day of year (51), unlike FLEX time format [cite-1, cite-2].

- [COMPUTED] FLEX and BASS-II belong to different investigations involving distinct physical systems (liquid droplets vs. solid samples) and must not be directly compared numerically. (cite-5) — applies to: Cross-investigation comparison guard
- [COMPUTED] FLEX 20CAL08 used Methanol fuel with an initial droplet diameter of 1.69 mm, ambient pressure of 757.7 mmHg, and initial mole fractions of 0.21 O2 and 0.79 N2. (cite-1) — applies to: FLEX 20CAL08 test record
- [COMPUTED] FLEX 20CAL08 recorded a burn time of 4.3 s, ended in Disruption, and had a burning rate constant of 0.52 mm²/s where the raw column header states 'Burning rate; mm'. (cite-1) — applies to: FLEX 20CAL08 test record and unit interpretation
- [DOC] BASS-II test M5 tested a 3-mm-thick PMMA sample burning on two sides (2.2 cm width) under opposed flow. (cite-2, cite-3, cite-4) — applies to: BASS-II M5 test records and Table 5.1/A.4
- [DOC] BASS-II M5 had an initial calibrated O2 of 22.2 vol%, final calibrated O2 of 19 vol%, spread rate of 0.071 mm/s at 10 cm/s velocity, and a burn time of 27.2 min. (cite-3) — applies to: BASS-II Summary Report Table 5.1
- [COMPUTED] In BASS-II, column GMT represents day of year ('51' for M5), whereas FLEX GMT is formatted as a time of day. (cite-1, cite-2) — applies to: Column notes and experiment tables

Cited sources: cite-1 experiment: FLEX 20CAL08 (source row 1); cite-2 experiment: BASS-II M5 (source row 31); cite-3 report_table: BASS-II Summary Report Table 5.1, row M5 (PDF p.65); cite-4 report_table: BASS-II Summary Report Table A.4, row M5 (PDF p.117); cite-5 analysis: Cross-investigation comparison guard

### g22: Did BASS-II O2 consumption convert nearly stoichiometrically to CO2?

Status **answered**.

> Yes, across BASS-II tests, O2 consumption converted nearly stoichiometrically to CO2. The theoretical PMMA stoichiometric reference slope is 0.8333 [cite-3]. Across 121 fitted tests, the overall slope of CO2 produced per O2 consumed is 0.8078 (Pearson r = 0.9815), and 0.8096 for tests above resolution (n = 66) [cite-3]. By material class, PMMA slab tests showed a slope of 0.8281, PMMA clear rods showed 0.8037, PMMA black rods showed 0.7935, PMMA sphere sections showed 0.7, and PMMA thin films showed 0.4179 [cite-3]. In specific test O2 (a 1/4-inch clear rod), calibrated O2 decreased from 22.2% to 21.9% by volume, while CO2 increased from 0.44% to 0.59% and CO increased from -1 ppm to 23 ppm [cite-1, cite-2].

- [COMPUTED] The theoretical PMMA stoichiometric reference slope for CO2 produced per O2 consumed is 0.8333. (cite-3) — applies to: BASS-II gas analysis summary reference value
- [COMPUTED] The overall slope of CO2 produced per O2 consumed across 121 fitted tests is 0.8078 with a Pearson r of 0.9815, and 0.8096 across 66 tests above resolution. (cite-3) — applies to: BASS-II before/after gas analysis with 5 unphysical tests excluded
- [COMPUTED] The CO2 per O2 slope by material class is 0.8281 for PMMA slabs (n=20), 0.8037 for PMMA clear rods (n=21), 0.7935 for PMMA black rods (n=19), 0.7 for PMMA sphere sections (n=1), and 0.4179 for PMMA thin films (n=5). (cite-3) — applies to: BASS-II material class gas analysis fits
- [DOC] In BASS-II test O2, calibrated initial O2 was 22.2% and final was 21.9%, initial CO2 was 0.44% and final was 0.59%, and CO rose from -1 ppm to 23 ppm. (cite-1, cite-2) — applies to: BASS-II test O2 (Sample #204, 1/4-inch clear rod)

Cited sources: cite-1 experiment: BASS-II O2 (source row 48); cite-2 report_table: BASS-II Summary Report Table A.5, row O2 (PDF p.118); cite-3 analysis: BASS-II before/after gas analysis

### g31: How much of the SAFFIRE Sample 2 imagery was received?

Status **answered**.

> According to the SAFFIRE-I manifest summary, the imagery received for Sample 2 was approximately 25% across its two cameras: 25.0689% was received for camera S2C1 and 25.4215% was received for camera S2C2 [cite-1]. Each camera recorded 18150 frames over a duration of 604.9 seconds starting at 2016-06-14T20:56:33.510Z [cite-1].

- [COMPUTED] For SAFFIRE-I Sample 2 camera S2C1, 25.0689% of the 18150 frames were received over a 604.9 s duration starting at 2016-06-14T20:56:33.510Z. (cite-1) — applies to: SAFFIRE-I manifest records
- [COMPUTED] For SAFFIRE-I Sample 2 camera S2C2, 25.4215% of the 18150 frames were received over a 604.9 s duration starting at 2016-06-14T20:56:33.510Z. (cite-1) — applies to: SAFFIRE-I manifest records

Cited sources: cite-1 analysis: SAFFIRE-I burns and manifest summary

### g29: Which publications cover SAFFIRE large scale flame spread?

Status **answered**.

> According to the NASA PSI publication list for SAFFIRE-I (PSI-98), several listed papers specifically focus on flame spread and scale based on their titles [cite-2]:
> 
> 1. "Flame spread: Effects of microgravity and scale" by David L. Urban et al. (DOI: 10.1016/j.combustflame.2018.10.012) [cite-2].
> 2. "Transient flame growth and spread processes over a large solid fabric in concurrent low-speed flows in microgravity – Model versus experiment" by Chengyao Li et al. (DOI: 10.1016/j.proci.2018.05.168) [cite-2].
> 3. "Fire safety in space – beyond flammability testing of small samples" by Grunde Jomaas et al. (DOI: 10.1016/j.actaastro.2014.11.025) [cite-2].
> 
> Additionally, NASA lists related development and flammability papers by Gary A. Ruff, David L. Urban, J. E. Niehaus, and W. Schoren [cite-2]. Note that the full texts of these publications were not read; topics are inferred solely from their titles in the PSI metadata [cite-2].

- [DOC] NASA PSI lists 6 publications for SAFFIRE-I (PSI-98), including 'Flame spread: Effects of microgravity and scale' and 'Transient flame growth and spread processes over a large solid fabric in concurrent low-speed flows in microgravity – Model versus experiment'. (cite-2) — applies to: Inferred from NASA PSI ISA-Tab metadata publication titles; papers were not read directly.
- [DOC] NASA PSI lists 'Fire safety in space – beyond flammability testing of small samples' by Grunde Jomaas et al. under SAFFIRE-I. (cite-2) — applies to: Metadata-only record from NASA PSI.

Cited sources: cite-2 publication_list: NASA PSI publication list for SAFFIRE-I (PSI-98)

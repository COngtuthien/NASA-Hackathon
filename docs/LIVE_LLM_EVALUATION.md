# Live LLM evaluation (Gemini)

Provider `gemini`, model `gemini-3.8-flash` (served as `gemini-3.8-flash`), Google AI Studio free tier, official
`google-genai` 3.1.0 SDK, thinking level `low`. Real database, real retrieval, real verifier; nothing mocked.
Harness: `cd backend && .venv/Scripts/python -m app.eval.live_llm --ids <ids> --report ../docs/LIVE_LLM_EVALUATION.md`.

**Status: live revalidation DONE in Run B** (`docs/LIVE_LLM_EVALUATION_RUN_B.md`, 2026-11-11 10:20–10:30 UTC): g02 and
g27 state K in mm²/s, g22/g31/g29 answered, and the live browser test passed. All runs below happened on 2026-11-11 before
the unit fix. The free-tier daily quota (20 generation requests per model per project) was used up at about 06:06 UTC. A
single probe at 06:54 UTC (g02) returned HTTP 429 `RESOURCE_EXHAUSTED` with a retry delay of 3,773 s, so no further live
call was made. Not every golden question has been tested live: 15 of 42 have been, and the full set runs on every
`pytest` with a stand-in model.

## Assessment levels

The three levels are assessed separately. Passing the first two does not prove the third.

- **Citations**: every citation id a claim uses exists in the evidence pack (enforced by the verifier), and each cited
  record resolves to a real source: experiment row, NASA document page, curated report row or external record.
  Checked for every claim below against `processed/spacefire.db`; 0 unresolved.
- **Numbers and units**: every number in a claim appears in its cited evidence (enforced by the verifier). Units were
  checked by hand, and retroactively with the unit rule added afterwards (`unit_problems`, rule FLEX-UNIT-K).
- **Scientific reasoning**: a manual review of whether the explanation is logically and physically consistent with the
  sources and answers the question. It is a judgement, recorded with its reasons.

## Run A: 2026-11-11, before the unit fix

g01 ran first, then 13 questions sequentially, 6 s apart. Model requests: 13 successful generation calls (g11 needed a
second generation); g22 and g29 each failed after 2 attempts with HTTP 503.

| ID | Topic | Outcome | Synthesis | Citations | Numbers / units | Reasoning | Fallback | Error |
|---|---|---|---|---|---|---|---|---|
| g01 | FLEX row counts by fuel | answered, 2 claims | yes | valid (1 source) | correct (157 / 117) | defensible | no | none |
| g02 | FLEX duplicate ID 193F001 | answered, 4 claims | yes | valid (3) | values present, **unit wrong**: "burning rate 0.41 mm" (should be mm²/s) | defensible: both rows kept, canonical UID explained | no | none |
| g03 | FLEX "CO" column = CO₂ | answered, 3 claims | yes | valid (1) | correct (108/108, 0.70) | defensible; the quality-rule claims are labelled COMPUTED, a minor label choice | no | none |
| g05 | FLEX "Disruption" ≠ extinction | answered, 2 claims | yes | valid (2) | none stated | defensible | no | none |
| g09 | SAFFIRE-I S1/S2 burn times, flow | answered, 2 claims | yes | valid (3) | correct (420 s concurrent, 70 s opposed, as in the CSV rows) | defensible | no | none |
| g10 | SAFFIRE workbook has no flame data | answered, 2 claims | yes | valid (2) | none stated | defensible | no | none |
| g11 | External: cool-flame droplet papers | answered, 3 claims | yes (2 calls) | valid (3: 1 external, 2 NASA documents) | years only | partly: the 2023 paper is described from its abstract only (labelled EXTERNAL, abstract-only); "recent" is a judgement | no | first draft failed verification |
| g12 | Safe O₂ threshold (must decline) | insufficient_evidence | yes | valid (4) | values quoted are sensor readings, not thresholds | defensible: explicitly refuses to infer a safety value | no | none |
| g13 | Heptane cool flames after visible extinction | answered, 3 claims | yes | valid (2) | none stated | defensible but incomplete: names radiative extinction of the hot flame and low-temperature chemistry, but does not explicitly link them into "the cool flame continues after the visible flame dies" | no | none |
| g22 | BASS-II O₂→CO₂ stoichiometry | retrieval_only | **no** | n/a | n/a | n/a | **yes** | HTTP 503 UNAVAILABLE (model overloaded) |
| g27 | FLEX 20CAL08 vs BASS-II M5 | answered, 3 claims | yes | valid (5) | values present, **unit wrong**: "burning rate 0.52 mm" | defensible: refuses to pool the investigations; one pooling-warning claim labelled DOC while it cites a computed guard | no | none |
| g29 | External: SAFFIRE publications | retrieval_only | **no** | n/a | n/a | n/a | **yes** | HTTP 503 UNAVAILABLE |
| g33 | SIBAL fabric | answered, 3 claims | yes | valid (3) | correct (75/25 cotton/fiberglass) | defensible | no | none |
| g38 | FLEX d²-law vs burn times | answered, 4 claims | yes | valid (2) | correct: matches the deterministic analysis exactly (median 1.0483, n = 183, 167 within 20 %) and states K in mm²/s | defensible; limitations stated (91 excluded, internal-consistency check only) | no | none |

Also live, through the streaming endpoint via the Next.js proxy:

| ID | Topic | Outcome | Synthesis | Citations | Numbers / units | Reasoning | Fallback | Error |
|---|---|---|---|---|---|---|---|---|
| g34 | Why Nomex did not ignite in BASS-II | insufficient_evidence, 2 claims | yes | valid (2 NASA document passages) | none stated | honest: the retrieved passages state the test objective but not the cause, and the model says so instead of guessing. A retrieval gap, not a model error | no | none |

Browser, live (06:06 UTC): the d²-law question in the Research Copilot streamed its tool steps, then the model call
failed with HTTP 429 (daily quota). The UI showed the failed step with the reason and fell back to "Evidence only" with
the retrieved sources. Synthesis was not verified in the browser.

### Summary of run A
- Synthesis succeeded for 13 of 15 questions; 2 fell back to evidence only after HTTP 503.
- Citations: valid for all 35 claims (33 in run A plus 2 for g34); 0 claims rejected for unknown ids or unsupported numbers.
- Numbers: all values present in the cited evidence. **Units: 2 of 12 run-A answers (g02, g27) stated the FLEX burning-rate
  constant K in the raw header unit "mm" instead of mm²/s.** The verifier did not catch it, because 0.41 does appear in
  the evidence, under the wrong header.
- Reasoning, for the 12 run-A answers: 10 defensible, 1 defensible but incomplete (g13), 1 partly defensible (g11).
  g34 was honestly insufficient. No hallucinated values, ids or papers were found.

## Fix applied after run A (verified deterministically, confirmed live in Run B)

1. Experiment evidence now carries the column-level dataset rules for its fields (`column_notes`, e.g.
   `Burning rate; mm` → FLEX-UNIT-K, K in mm²/s). The original CSV header is passed unchanged.
2. The system prompt requires corrected units whenever a column note or quality rule corrects a header.
3. **The verifier now enforces it** (`UNIT_RULES` in `backend/app/services/assistant.py`). A claim or answer sentence
   that gives the burning-rate constant with a unit other than mm²/s is rejected. The model gets one regeneration with
   the rule quoted; if the unit is still wrong, the statement is removed and the prose is withheld. This applies to the
   one-shot and the streamed endpoint (same `ask()`).
4. Regression tests (`backend/tests/test_assistant.py`):
   - the unit rule on the literal g02 and g27 outputs, correct forms and false-positive traps;
   - reject-then-regenerate with a stand-in model;
   - a persistent wrong unit never reaching the user;
   - the same behaviour through `/assistant/ask/stream`;
   - the raw header preserved verbatim.

Applied retroactively to run A, the unit rule flags exactly the g02 and g27 statements and nothing else.

## Live checks planned after run A (all done in Run B with 8 requests; see `LIVE_LLM_EVALUATION_RUN_B.md`)

| Test | Calls | Purpose |
|---|---|---|
| A: g02, g27 | 2–4 | Confirm burning-rate values are stated in mm²/s live |
| B: g22 (BASS-II), g09 or g31 (SAFFIRE-I), g29 (external) | 3–6 | Cover the investigations that failed or were not yet run on the final prompt |
| C: `E2E_LIVE_LLM=1 npx playwright test -g "live Gemini"` | 1–2 | Browser: streamed steps, synthesized answer, citation markers |

That is at most about 12 requests, leaving at least 8 of the daily 20 for manual testing. Command for A and B:
`python -m app.eval.live_llm --ids g02,g27,g22,g31,g29 --pace 8 --report ../docs/LIVE_LLM_EVALUATION_RUN_B.md`.

## Observed provider behaviour
- `gemini-2.5-flash` returns 404 for new users; `gemini-3.8-flash` is the working model.
- The free-tier quota is enforced as `GenerateRequestsPerDayPerProjectPerModel-FreeTier`, value 20, with a
  `google.rpc.RetryInfo` delay. SpaceFire parses that delay and pauses synthesis until then.
- HTTP 503 "overloaded" occurred on 2 of 15 questions even after SDK retries.
- A 429 can take 20–125 s to arrive (measured 21.4 s on an isolated call). The first question after the quota runs out
  is slow; the circuit breaker makes the following ones instant.
- Model latency for successful answers: median about 7 s, maximum 48 s (g13).

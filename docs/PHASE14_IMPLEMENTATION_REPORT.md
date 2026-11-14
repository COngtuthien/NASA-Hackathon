# Phase 14 — Research-to-Safety Explorer, Knowledge Graph & Evidence-Aware Copilot

Branch `feature/spacefire-phase14-safety-explorer`. Rollback reference: `backup/spacefire-before-phase14` (= `33b8478`,
pushed).

## 1. Git baseline

- `git fetch` confirmed `33b8478` ("Keep the FLEX page concise: PSI-117 charts open on request") as the head of
  `origin/feature/spacefire-phase13-scientific-expansion`, with `6b68a3b` (Phase 13 integration) as its ancestor.
- No uncommitted tracked changes existed. The NASA folders, `NASAChallenge202611.pptx` and `run.txt` are untracked and were
  left untouched.
- The Phase 14 branch was created from `33b8478`. Nothing was merged into main and nothing was deployed. No branch was
  deleted.

## 2. What was built

| Area | Files | Details |
|---|---|---|
| Knowledge graph | `backend/app/ingest/kg.py`, `backend/app/services/kg.py`, `kg_nodes`/`kg_edges` in `schema.sql`; wired into `app.ingest.run` | `PHASE14_KNOWLEDGE_GRAPH.md` |
| Ranking and matching | `backend/app/services/explorer.py` | `PHASE14_RANKING_METHODOLOGY.md` |
| Explorer API and UI | `/api/v1/explorer/*`; `frontend/app/safety-explorer/**`, `frontend/components/views/explorer/*` | `PHASE14_EXPLORER_DESIGN.md` |
| Copilot upgrade | `backend/app/services/insight.py`; `assistant.py` (classification, `query_knowledge_graph` tool, abstention, Explorer context); `AskRequest.explorer_context`; `AssistantView.tsx` (context panel, question-type badge, new source labels) | `PHASE14_AI_EVALUATION.md` |
| Evaluation | `backend/app/eval/phase14_eval.py`, `tests/golden_phase14.jsonl` (21), `tests/golden_phase14_holdout.jsonl` (8) | – |
| Tests | `backend/tests/test_phase14.py` (44), `frontend/e2e/phase14.spec.ts` (8), `frontend/e2e/phase14-mobile.spec.ts` (1) | `PHASE14_TEST_RESULTS.md` |
| Small additions | Navigation item and `compass` icon; `EVIDENCE.passage` and `EVIDENCE.metadata` tags; `?material=` on the Smoke page | – |

### New API endpoints

- `GET /graph/summary`
- `GET /graph/node/{id}`
- `GET /graph/phenomena/{id}/investigations`
- `GET /graph/experiments`
- `GET /graph/outcomes`
- `GET /graph/evidence/{id}`
- `GET /graph/related/{inv}`
- `GET /explorer/scenarios`
- `GET /explorer/scenarios/{id}`
- `POST /assistant/ask` and `/assistant/ask/stream` now accept an optional `explorer_context`; responses add
  `question_type` and `explorer_context`.

### New frontend routes

- `/safety-explorer`
- `/safety-explorer/{flame-spread|gaseous-flames|smoke-detection|droplet-extinction}`

## 3. Scientific safeguards

- The score is research relevance, never a risk or safety score. The disclaimer is returned with every workspace and shown
  on every page.
- No numeric tolerance is used in matching: ranges are applied exactly. Missing conditions are kept apart from rejections
  and from conditions an investigation never records.
- No numbers are computed beyond counts, minimum–maximum ranges within a comparable group, and values copied from verified
  records. No continuous prediction, interpolation or extrapolation is made.
- CFI-G: normal and inverse flames are kept apart, FT burn times are flagged as censored, and test points are qualified as
  not being independent hot-flame events.
- BRE is labelled as emulation, not BASS-II flame spread. PSI-117 model curves are labelled as predictions and are not joined
  to FLEX. FLEX-2 and PSI-62 appear as documentation-only and metadata-only.
- The Copilot abstains on certification, prediction, arbitrary-condition and fire-probability questions without calling the
  model.

## 4. Deferred or limited

- No interactive graph visualization (optional P2).
- No live Gemini check (by design: no quota used).
- The question classifier is rule-based. It scores 21/21 on the tuned golden set and 7/8 on the held-out set (one
  availability question was classified as fact).
- The ranking weights are documented design choices, not calibrated against expert judgments.
- Close-match tolerances were not implemented: no tolerance could be justified from the data.
- SAME telemetry, Flame Design outcomes and BRE per-test data are still absent. This is unchanged from Phase 13 and listed
  as missing data in the Explorer.
- The Explorer's pressure filter is not forwarded to the CFI-G page, which uses discrete pressure levels.

## 5. Phase 15 readiness

- Run the full browser suite once more on the final build when more memory is free (85 tests last ran on the previous
  build; see the test report).
- Optionally make one live Gemini sanity request per scenario (4 requests) and review the answers against the evidence
  panel.
- Extend the availability rules ("is … joined/linked to …") and add a second held-out set.
- Presentation: the four scenarios make a demo path: Explorer → evidence → chart or 3D → Copilot.

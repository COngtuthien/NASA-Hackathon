# Research Copilot "server error": diagnosis and repair (2026-11-13)

Branch `fix/spacefire-copilot-server-error`, from `feature/spacefire-phase12-premium-themes` at `66242ac` (working tree
clean apart from the untracked `run.txt`). No secret appears in this document; the API key was never printed.

## 1. Reported error

The Research Copilot showed a server error when the user asked a question after starting the app with
`powershell -ExecutionPolicy Bypass -File "scripts\start.ps1" -Prod` (real Gemini configuration). No screenshot,
browser log or backend console output from that run was available, and the backend keeps no log file, so the exact
message on the user's screen could not be read back.

## 2. Investigation (in order)

| Step | Check | Result |
|---|---|---|
| Environment | Git, ports 3000/8000, processes | Branch Phase 12 `66242ac`, clean; nothing listening (the user's servers were closed) |
| Configuration (sanitized) | `.env` | `LLM_PROVIDER=gemini`, `LLM_MODEL=gemini-3.8-flash`, `LLM_API_KEY` present, `LLM_TIMEOUT_S=60`; `google-genai` 3.1.0 |
| Code history | backend changes since the last verified live run | None since `aca4911` (2026-11-11, live Gemini answers verified); dependencies unchanged |
| A1 backend | `/health` with the model disabled | OK: database, hybrid retrieval, retrieval-only mode |
| A2 stream | `POST /assistant/ask/stream`, model disabled | OK in 2 s: `start`, `tool_start/end get_document_evidence`, `result` (6 NASA document citations) |
| A3 provider construction | real SDK client with a dummy key (no request) | OK |
| A4 pipeline, scripted provider | real app + fake model through the stream: answer, `rate_limit`, `unavailable`, `auth`, `timeout`, and a non-provider exception | Answer verified and rendered; every provider failure returns the evidence with `llm.error`; the quota circuit breaker pauses further calls; only a non-provider exception yields `{"event":"error","code":"internal_error","message":"Unexpected server error."}` (no evidence) |
| A5 proxy | Next 16 rewrite proxy (`httpxy`, `proxyTimeout` 30 s) | It is a socket inactivity timeout; the backend's 15 s NDJSON heartbeat keeps the stream open |
| C live (one request) | the user's exact flow: production build, `next start` on 3000, real backend and `.env` on 8000, question asked in the browser | see section 3 |

All zero-quota checks passed, so the failure had to involve the live provider; one live request was made.

## 3. Live reproduction (the only Gemini request)

Question: "Why do droplet flames become nearly spherical in microgravity?", typed into the Copilot page on
`http://localhost:3000/copilot` (production build), proxied to FastAPI on port 8000 with the real configuration. The
provider was wrapped so that a second model call would be refused locally (it was never needed).

Backend log (sanitized):

```
POST /api/v1/assistant/ask/stream 200
POST .../v1/models/gemini-3.8-flash:generateContent "HTTP/1.1 503 Service Unavailable"
  Retrying ... in 2.67 seconds as it raised ServerError: 503 UNAVAILABLE.
  {'code': 503, 'message': 'This model is currently experiencing high demand. Spikes in demand are usually
   temporary. Please try again later.', 'status': 'UNAVAILABLE'}
POST ... "HTTP/1.1 503 Service Unavailable"   Retrying ... in 4.57 seconds
POST ... "HTTP/1.1 504 Gateway Timeout"       (about 63 s later)
assistant_answer status=llm_error tool_errors=[synthesize_answer: "timeout: Gemini request timed out." ms=70319] ms=72435
```

Browser: after 72 s, "Evidence only", "The language model could not answer (timeout)", 6 NASA sources, no console
error. The provider counted this as **one logical request** (three HTTP attempts by the SDK's built-in retry).

## 4. Root cause

**First failing component: the external AI provider.** `gemini-3.8-flash` on the free tier was overloaded
(HTTP 503 "high demand", then a 504 gateway timeout). Infrastructure, proxy, retrieval, verification and stream
parsing all worked.

The application turned that provider outage into a bad experience, through three defects of its own:

1. **Unbounded wait.** `google-genai` retried 500/502/503/504 *and* client timeouts, three attempts, each with the
   full 60 s timeout, plus an optional second "repair" model call. A single question could take about 3 minutes
   (72 s were observed).
2. **The page gave up first and discarded the evidence.** The Copilot page aborted every request after a fixed 120 s,
   even while the server was still streaming heartbeats, and then showed a generic error ("Request failed") instead of
   the evidence that was about to arrive.
3. **Technical, misleading messages.** Overload surfaced as "timeout" or "Gemini service error (HTTP 503
   UNAVAILABLE)", and an internal error as "Unexpected server error."

The user's "server error" is therefore most likely the provider overload, which surfaced either as the generic
"Request failed" (defect 2) or as "Gemini service error (HTTP 503)" (defect 3). Without the original screen this
cannot be proven for that specific attempt. The only path that produces the literal "Unexpected server error." is a
non-provider exception, which no test, mock or live run reproduced (see limitations).

## 5. Changes

Backend (`backend/app/providers/llm.py`, `backend/app/services/assistant.py`):
- The Gemini adapter owns its retries: only fast overload answers (500, 502, 503) are retried, after 2 s then 4 s,
  inside one time budget (1.5 x `LLM_TIMEOUT_S`, 90 s by default). No attempt starts with less than 20 s left, each
  attempt's timeout is capped to the time left, and a 504 or client timeout is not retried. The SDK's own retries are
  off. 429 is still never retried, and the quota circuit breaker is unchanged.
- A persistent 503 is reported as "Gemini is temporarily overloaded (HTTP 503, high demand) after 3 attempts."
- The optional repair call is skipped when the first answer took more than half of `LLM_TIMEOUT_S`. The first answer is
  kept, statements that failed verification are removed (as before), and a limitation says so.

Frontend (`frontend/components/views/AssistantView.tsx`):
- The request is abandoned after 45 s of stream silence (three missed heartbeats) or a 5-minute cap, not after a fixed
  120 s.
- Evidence-only answers say what happened in plain words (overloaded, timed out, quota used up with the reset time,
  credentials, model configuration, refusal, unusable output), followed by "You can still explore the NASA evidence
  found for your question below; nothing below is AI-written."
- "Try the AI answer again" appears only for transient causes (overload, timeout, unusable output), never for quota or
  configuration problems, and never runs automatically.
- Whole-request errors: internal error ("Something went wrong on the SpaceFire server while answering (an internal
  error, not the AI service)…"), interrupted stream, server silent, backend unreachable; each with Retry.

Unchanged: citation and number verification, FLEX unit rules, literature and NASA publication-list handling,
prompt-injection framing, the evidence-only fallback, the verified-answer cache, the quota circuit breaker, the UI and
themes, `scripts/start.ps1` (it was not involved: the backend started cleanly, and if it fails the header already shows
"API offline").

## 6. Tests

- Backend `pytest`: **188 passed** (181 before, plus 7 new). New provider tests replay the observed sequence with a fake
  SDK client and a fake clock: overload then success; persistent overload (3 attempts, "overloaded"); 504 not retried;
  client timeout not retried; total time within the budget; attempt timeout shrinks to the time left; SDK retries off.
  New assistant test: a slow first answer skips the repair call.
- Frontend: `tsc` clean, `eslint` clean, production build OK.
- Playwright on the production build: `e2e/copilot-errors.spec.ts` (11): the real flow through the Next proxy to FastAPI
  with authentic NASA evidence and usable citations; each provider failure kind shows its message, keeps the evidence
  and offers Retry only when sensible; Retry is one request per click; internal error, backend down, interrupted
  stream; 45 s silence abort (fake clock). `e2e/phase4.spec.ts` updated for the new quota wording. Full suite: see
  `docs/IMPLEMENTATION_STATUS.md`.
- Live: not repeated after the fix (it would spend quota). The provider retry behaviour is verified against the observed
  503/503/504 sequence with fakes.

## 7. Gemini request count

**1** logical generation request (3 HTTP attempts made automatically by the SDK's retry policy at the time: 503, 503,
504). No answer was produced, so no quota-consuming success. No other live request, no live evaluation, no paid model,
no key rotation.

## 8. Remaining limitations

- The provider outage itself cannot be fixed locally: while Google reports high demand, answers are evidence-only (now
  within about 90 s, with a clear message and a manual Retry).
- The exact message the user saw was not recoverable. If it read literally "Unexpected server error.", an exception
  outside the provider occurred. The stream handler logs its full traceback to the backend console ("assistant stream
  failed"); please keep that console output if it happens again.
- The SDK's retry attempts after a 503 count as one logical request; Google may still count them against limits.
- No live verification of a successful AI answer after the fix (provider overloaded; quota preserved).

## 9. Start and verify locally

```powershell
powershell -ExecutionPolicy Bypass -File "scripts\start.ps1" -Prod
```

1. Open `http://127.0.0.1:8000/api/v1/health`: `database.ok` true; `llm.mode` is `synthesis` with a key, or
   `retrieval_only` without.
2. Open `http://localhost:3000/copilot`; the header reads "AI answers on" (or evidence-only mode).
3. Ask "Why do droplet flames become nearly spherical in microgravity?". Within about 90 s you get either an AI answer
   ("Written by gemini-3.8-flash", verified statements, citations) or an evidence-only answer that says why (for
   example "temporarily unavailable (Google reports it as overloaded or unreachable)"), with the NASA sources below.
4. Deterministic checks without spending quota: `pytest` in `backend/` and
   `npx playwright test e2e/copilot-errors.spec.ts` in `frontend/`.

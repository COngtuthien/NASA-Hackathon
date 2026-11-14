# Phase 14 — AI Evaluation (Copilot upgrade)

All evaluation is **offline and deterministic**. The real Copilot pipeline (`assistant.ask`) runs with the language model
switched off, so it measures what SpaceFire retrieves and decides, not text written by a model. **No Gemini request was made
in Phase 14** (no live sanity test; quota preserved).

## What changed in the Copilot

| Capability | Implementation |
|---|---|
| Question classification | `insight.classify`: regex rules for fact, comparison, interpretation, availability and unsupported. Returned as `question_type` and shown as a badge. The model receives the type label in the user message (not the system prompt). |
| Structured evidence | New tool `query_knowledge_graph`: investigations studying each phenomenon in the question, evidence profiles (readiness, strongest evidence, outcome counts, limitations, documented relations), CFI-G Table 3 records (p.46), SAME Table 1 (p.27), PSI-117 experiment/model counts, report findings. New citation source types: `graph`, `curated_record`, `report_statement`, `explorer_context`. |
| Comparison guard | For comparison questions: per investigation, the strongest evidence, phenomena and recorded condition variables, plus shared phenomena and shared variables, with the rule "compare quantitatively only shared variables of the same evidence class". |
| Unsupported questions | Seven rules (certification, predicting untested materials or conditions, exact temperatures, values for arbitrary conditions, BRE "validating" safety, fire probability, safety thresholds). They give `status = insufficient_evidence`, a fixed abstention answer, the reason as a limitation, and the retrieved evidence shown for transparency. **The model is never called** (a test asserts zero model calls). |
| Explorer handoff | `explorer_context` (scenario, investigation, test, evidence ids). Validated (`ExplorerContext` pydantic model plus DB lookups); unknown ids return 400. The context item's text comes from the server. |
| Unchanged | 503/504 handling, timeouts, rate-limit pause, evidence-only fallback, citation and number/unit verification, answer cache. Graph items are appended **after** the existing evidence, so citation numbering for questions without new evidence is unchanged and all 211 earlier backend tests still pass. |

Two detection fixes were found by the benchmark:
- "How many …" questions are no longer classified as interpretation.
- "SAME" in capitals is now detected as the SAME investigation. Lower-case "the same" still does not trigger it, as in Phase 13.

## Golden benchmark (`tests/golden_phase14.jsonl`, `python -m app.eval.phase14_eval`)

21 questions across the four scenarios plus one cross-scenario question: fact 4, comparison 4, interpretation 4,
availability 3, unsupported 6. It includes the four questions given in the brief. They are distinct questions, not
paraphrases.

Checks per question (only where an expectation exists):

| Check | Meaning | First run | Final |
|---|---|---|---|
| type_ok | Classifier returns the expected type | 20/21 | **21/21** |
| abstain_ok | Unsupported questions abstain; no other question does | 21/21 | **21/21** |
| inv_hit | An expected investigation is detected or covered by a graph item | 14/15 | **15/15** |
| doc_hit | A citation comes from an expected NASA document | 7/7 | **7/7** |
| structured_hit | Structured evidence (graph, curated, report, computed) is cited | 14/15 | **15/15** |
| source_type_hit | An expected source type (comparison guard) is present | 3/3 | **3/3** |
| data_ok | Expected strings (e.g. `21174C3`, `n-butane`, `kapton`, `censored`) occur in the cited evidence | 10/10 | **10/10** |

Abstention: 6/6 unsupported questions abstained; 0/15 supported questions were wrongly refused.

**Honest caveat.** The rules were fixed after the first run, on this same set. The two first-run failures were real bugs:
- p14-16 "How many FLEX tests ended in extinction?" was classified as interpretation.
- p14-14 asked about SAME telemetry using the acronym only, so SAME was not detected.

The final numbers are therefore optimistic. A pytest guard (`test_phase14_golden_benchmark`) keeps them from regressing.

### Held-out set (`tests/golden_phase14_holdout.jsonl`, `--holdout`)

8 new questions were written after tuning and run **once**, with no rule changes afterwards:

| Check | Result |
|---|---|
| type_ok | **7/8** |
| abstain_ok | 8/8 (2/2 unsupported abstained, 0/6 wrongly refused) |
| inv_hit | 6/6 |
| structured_hit | 6/6 |

Miss: "Is PSI-117 data joined to FLEX test rows?" was classified as **fact** instead of availability. The availability rules
do not cover "is … joined to …". The evidence returned was still correct: the PSI-117 profile says the data are not mapped
to FLEX. This is left as a known limitation.

## Regression against earlier question sets

| Set | Result |
|---|---|
| Phase 4 golden questions (`tests/golden_questions.jsonl`, inside `test_assistant.py`) | All pass. g39, the certification question, is now classified unsupported; its limitation still contains the original "safety threshold" text. |
| Original retrieval benchmark (30 queries) | hybrid R@5 0.800, R@10 0.867, MRR 0.662, nDCG 0.560: identical to Phase 13 |
| Phase 13 retrieval benchmark (14 queries) | hybrid R@5 0.50, R@10 0.786, MRR 0.493: identical to Phase 13 |

Retrieval code was not changed. The graph adds structured items next to the document passages and does not alter their
ranking.

## Limitations

- The classifier is rule-based. It is transparent and cheap, but it misses phrasings outside its rules (see the held-out
  miss).
- Sample sizes are small: 21 tuned and 8 held-out questions. These numbers show behaviour, not statistical accuracy.
- No answer quality was measured with a live model. When AI synthesis is on, answers still go through the existing
  citation and number verification, which this phase did not change.

# Phase 15 — AI Benchmark

All runs are offline and deterministic. The real Copilot pipeline runs with the language model off (no Gemini request in
Phase 15), so the benchmark measures classification, retrieval, structured evidence and abstention. It does not measure
written-answer quality.

Command: `python -m app.eval.phase14_eval [--holdout | --phase15]` (from `backend/`).

## Question sets

| Set | File | n | Status |
|---|---|---|---|
| Phase 14 tuned | `tests/golden_phase14.jsonl` | 21 | Rules were fixed on this set in Phase 14, so results are optimistic |
| Phase 14 held-out | `tests/golden_phase14_holdout.jsonl` | 8 | Written after tuning; never tuned on |
| **Phase 15 final** | `tests/golden_phase15.jsonl` | 16 | Written before any Phase 15 rule change; first run reported as the headline |

The Phase 15 set covers:
- FLEX, BASS-II, SAFFIRE-I, SAME, CFI-G, PSI-117, BRE and Flame Design.
- All four required categories: fact 6, comparison 3, interpretation 4, unsupported 3.
- 4 questions opened from the Explorer with an `explorer_context` (scenario, investigation, test, evidence ids), i.e. the
  same request the UI handoff sends.

One label was corrected before the first run, not after: p15-15, "How do … affect …", is an interpretation question.

## Results

| Check | Phase 15, **first run** | Phase 15 after the BRE fix | Phase 14 tuned (regression) | Phase 14 held-out (regression) |
|---|---|---|---|---|
| Question type correct | **15/16 (0.94)** | 15/16 | 21/21 | 7/8 |
| Abstention correct (refuses unsupported only) | **16/16** | 16/16 | 21/21 | 8/8 |
| Expected investigation covered | **12/13 (0.92)** | 13/13 | 15/15 | 6/6 |
| Structured evidence cited | **12/13 (0.92)** | 13/13 | 15/15 | 6/6 |
| Expected document cited | – | – | 7/7 | – |
| Expected source type (e.g. Explorer context) | **4/4** | 4/4 | 3/3 | – |
| Expected values in the evidence (e.g. `1130` K, `0.265`, `21174C3`, `0.071`) | **6/7** | 7/7 | 10/10 | – |

Unsupported questions:
- 3/3 abstained in the Phase 15 set, including one opened from the Explorer.
- 0 of 13 supported questions were refused.
- No unsupported question reached the model.

Misses:
- **p15-05**, "Above which oxygen level did the BRE observe quasi-steady flames…": "BRE" on its own was not recognised.
  Fixed (capital-letter acronym only, like SAME). This is the only change made after seeing the set.
- **p15-09**, "Why does an inverse diffusion flame behave differently from a normal one?": classified as comparison
  ("differently") instead of interpretation. The wording is genuinely ambiguous. Left unchanged, and reported.
- **Phase 14 held-out h-04** ("Is PSI-117 data joined to FLEX rows?" classified as fact): unchanged from Phase 14.

## Retrieval and citation regression

| Benchmark | Phase 14 | Phase 15 |
|---|---|---|
| Original 30 queries, hybrid | R@5 0.800, R@10 0.867, MRR 0.662, nDCG 0.560 | identical |
| Phase 13 14 queries, hybrid | R@5 0.50, R@10 0.786, MRR 0.493 | identical |

Citation verification (claims cite only listed ids, numbers must appear in the cited evidence, unit checks) is unchanged
and covered by the existing backend tests, which all pass (257).

## Limits

- **Small samples.** 16 + 8 untuned questions. These describe behaviour; they are not statistically strong accuracy
  estimates.
- **No live model.** Answer prose was not evaluated with a live model.
- **Classifier gaps.** The rule-based classifier has two known misclassification patterns (above).

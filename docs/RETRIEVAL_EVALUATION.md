# Retrieval evaluation (2026-11-11)

Benchmark: `backend/tests/retrieval_benchmark.jsonl`, 30 paraphrased questions over the 20 indexed NASA
documents. A passage is relevant when its text matches the question's answer-phrase pattern (objective,
reproducible; e.g. r01 "total of 126 tests were conducted", r04 the d²-law expression). Run:
`python -m app.eval.retrieval_eval [--neural]` from `backend/`.

| Configuration | Recall@5 | Recall@10 | MRR@10 | nDCG@10 | ms/query |
|---|---|---|---|---|---|
| BM25 only (FTS5) | 0.733 | 0.767 | 0.636 | 0.503 | 0.4 |
| LSA only (TF-IDF + SVD, 192 dims) | 0.700 | 0.700 | 0.491 | 0.388 | 42 |
| Neural only (bge-small-en-v1.5, ONNX) | 0.633 | 0.700 | 0.456 | 0.380 | 11 |
| **Hybrid BM25 + LSA (default)** | **0.767** | **0.800** | **0.658** | **0.555** | 102 |
| Hybrid BM25 + neural | 0.800 | 0.867 | 0.653 | 0.566 | 130 |
| Hybrid BM25 + LSA + neural | 0.800 | 0.833 | 0.633 | 0.559 | 135 |

Findings
- Neural embeddings alone are the weakest option on this technical corpus (exact terms, IDs, units matter).
- Fusing a dense retriever with BM25 helps in every case. BM25 + neural retrieves 1 more question in the top 5
  and 2 more in the top 10 than BM25 + LSA, with slightly lower MRR. On 30 questions this is within noise.
- Decision: keep **BM25 + LSA** as the default (no model download, fully reproducible, faster). Neural fusion is
  available as an opt-in: `pip install -r backend/requirements-neural.txt`,
  `python -m app.services.neural --build`, then set `RETRIEVAL_DENSE=neural` (or `both`) in `.env`.
- Regression guard: `tests/test_retrieval_benchmark.py` checks that the default hybrid is never worse than
  either component on Recall@10 and nDCG@10, and Recall@5 ≥ 0.7.

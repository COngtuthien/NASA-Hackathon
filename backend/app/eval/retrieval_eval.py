"""Retrieval benchmark: `python -m app.eval.retrieval_eval [--neural]` (from backend/).

Relevance is objective: a chunk is relevant to a query when its text matches the
query's answer-phrase regex (tests/retrieval_benchmark.jsonl). Queries are
paraphrases, so pure keyword overlap is not guaranteed. Metrics: Recall@5,
Recall@10, MRR@10, nDCG@10 over the top-10 NASA-document results.
"""
from __future__ import annotations

import argparse
import json
import math
import re
import time
from pathlib import Path

import numpy as np

from ..core.config import get_settings
from ..db.database import connect
from ..services import retrieval
from ..services.vectors import LsaIndex

BENCH = Path(__file__).resolve().parents[2] / "tests" / "retrieval_benchmark.jsonl"
BENCH_PHASE13 = Path(__file__).resolve().parents[2] / "tests" / "retrieval_benchmark_phase13.jsonl"


def load_bench(path: Path = BENCH) -> list[dict]:
    return [json.loads(x) for x in path.read_text(encoding="utf-8").splitlines() if x.strip()]


def relevant_ids(conn, rx: str) -> set[str]:
    r = re.compile(rx, re.I)
    return {row["chunk_id"] for row in conn.execute("SELECT chunk_id, text FROM document_chunks") if r.search(row["text"])}


def metrics(ranked: list[str], rel: set[str]) -> dict:
    top = ranked[:10]
    hits = [1 if c in rel else 0 for c in top]
    mrr = next((1 / (i + 1) for i, h in enumerate(hits) if h), 0.0)
    dcg = sum(h / math.log2(i + 2) for i, h in enumerate(hits))
    ideal = sum(1 / math.log2(i + 2) for i in range(min(len(rel), 10)))
    return {"r5": float(any(hits[:5])), "r10": float(any(hits)), "mrr": mrr, "ndcg": dcg / ideal if ideal else 0.0}


def bm25_only(conn, q: str) -> list[str]:
    terms = retrieval.query_terms(retrieval.normalize_query(q))
    if not terms:
        return []
    rows = conn.execute("SELECT chunk_id FROM chunks_fts WHERE chunks_fts MATCH ? ORDER BY bm25(chunks_fts, 0.0, 0.4, 1.5, 1.0) "
                        "LIMIT 10", (retrieval.fts_query(terms),)).fetchall()
    return [r["chunk_id"] for r in rows]


def dense_only(index, q: str) -> list[str]:
    return [cid for cid, _ in index.search(q, k=10)]


def hybrid(conn, q: str) -> list[str]:
    res = retrieval.search(conn, q, source_type="nasa_document", limit=10)
    return [r["chunk_id"] for r in res["results"]]


def evaluate(fn, bench, rels) -> dict:
    agg = {"r5": 0.0, "r10": 0.0, "mrr": 0.0, "ndcg": 0.0}
    per = {}
    t0 = time.time()
    for b in bench:
        m = metrics(fn(b["q"]), rels[b["id"]])
        per[b["id"]] = m
        for k in agg:
            agg[k] += m[k]
    n = len(bench)
    return {**{k: round(v / n, 3) for k, v in agg.items()}, "ms_per_query": round(1000 * (time.time() - t0) / n, 1),
            "per_query": per}


def run(neural: bool = False, bench_path: Path = BENCH) -> dict:
    s = get_settings()
    conn = connect(s.db_path, readonly=True)
    bench = load_bench(bench_path)
    rels = {b["id"]: relevant_ids(conn, b["rel"]) for b in bench}
    empty = [k for k, v in rels.items() if not v]
    lsa = LsaIndex.load(s.processed_dir)
    out = {"n_queries": len(bench), "relevant_chunks_per_query": {k: len(v) for k, v in rels.items()},
           "queries_without_relevant": empty,
           "bm25": evaluate(lambda q: bm25_only(conn, q), bench, rels),
           "lsa": evaluate(lambda q: dense_only(lsa, q), bench, rels),
           "hybrid_current": evaluate(lambda q: hybrid(conn, q), bench, rels)}
    if neural:
        from ..services.neural import NeuralIndex
        idx = NeuralIndex.load(s.processed_dir)
        if idx is None:
            out["neural"] = {"status": "index missing: run python -m app.services.neural --build"}
        else:
            out["neural"] = evaluate(lambda q: dense_only(idx, q), bench, rels)
    conn.close()
    return out


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--neural", action="store_true")
    ap.add_argument("--full", action="store_true", help="include per-query metrics")
    ap.add_argument("--phase13", action="store_true", help="use the Phase 13 benchmark (new investigations)")
    a = ap.parse_args()
    r = run(a.neural, BENCH_PHASE13 if a.phase13 else BENCH)
    if not a.full:
        for k in ("bm25", "lsa", "hybrid_current", "neural"):
            if isinstance(r.get(k), dict):
                r[k].pop("per_query", None)
    print(json.dumps(r, indent=1))

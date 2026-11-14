"""Retrieval quality regression guard on tests/retrieval_benchmark.jsonl (default BM25 + LSA)."""
from __future__ import annotations

from .conftest import requires_db

pytestmark = requires_db


def test_benchmark_has_objective_relevance(conn):
    from app.eval.retrieval_eval import load_bench, relevant_ids
    bench = load_bench()
    assert len(bench) >= 30
    for b in bench:
        assert relevant_ids(conn, b["rel"]), f"{b['id']} has no relevant passage"


def test_hybrid_not_worse_than_components():
    from app.eval.retrieval_eval import run
    r = run(neural=False)
    h, bm, lsa = r["hybrid_current"], r["bm25"], r["lsa"]
    assert h["r10"] >= max(bm["r10"], lsa["r10"]) - 1e-9
    assert h["ndcg"] >= max(bm["ndcg"], lsa["ndcg"]) - 1e-9
    assert h["r5"] >= 0.7  # measured 0.767 on 2026-11-11


def test_phase13_benchmark_new_investigations():
    """Phase 13 golden questions (ACME, SAME, PSI-117, FLEX-2) retrieve their answer passages."""
    from app.eval.retrieval_eval import BENCH_PHASE13, load_bench, run
    from .conftest import REPO
    if not (REPO / "ACME CFI-G").is_dir():
        import pytest
        pytest.skip("Phase 13 documents are indexed only when the local NASA folders exist")
    assert len(load_bench(BENCH_PHASE13)) >= 14
    r = run(neural=False, bench_path=BENCH_PHASE13)
    assert not r["queries_without_relevant"]
    h, bm, lsa = r["hybrid_current"], r["bm25"], r["lsa"]
    assert h["r10"] >= max(bm["r10"], lsa["r10"]) - 1e-9
    assert h["r10"] >= 0.7  # measured 0.786 on 2026-11-14

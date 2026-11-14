"""Phase 14 golden-question benchmark: `python -m app.eval.phase14_eval [--json]` (from backend/).

Offline and deterministic: every question runs through the real Copilot pipeline (`assistant.ask`) with the language
model switched off, so it measures what the system retrieves and decides, not what a model writes. No Gemini quota.

Per question (tests/golden_phase14.jsonl):
- type_ok         the deterministic classifier returned the expected question type
- abstain_ok      unsupported questions abstain (insufficient_evidence, no generated values); others do not
- inv_hit         an expected investigation is detected or covered by a knowledge-graph evidence item
- doc_hit         a citation comes from one of the expected NASA documents (only where documents are expected)
- structured_hit  structured evidence (graph / curated record / report statement / computed analysis / experiment)
                  is cited (only where expected)
- data_ok         every expected string occurs in the cited evidence (where given)
"""
from __future__ import annotations

import argparse
import json
import os
from collections import defaultdict
from pathlib import Path

GOLDEN = Path(__file__).resolve().parents[2] / "tests" / "golden_phase14.jsonl"
HOLDOUT = Path(__file__).resolve().parents[2] / "tests" / "golden_phase14_holdout.jsonl"  # written after tuning; never tuned on
STRUCTURED = {"graph", "curated_record", "report_statement", "analysis", "report_table", "experiment",
              "explorer_context"}


def load(path: Path = GOLDEN) -> list[dict]:
    return [json.loads(x) for x in path.read_text(encoding="utf-8").splitlines() if x.strip()]


def score_one(res: dict, exp: dict) -> dict:
    cits = res["citations"]
    blob = json.dumps(cits, ensure_ascii=False, default=str)
    covered = set(res["investigations_detected"])
    for c in cits:
        if c["source_type"] == "graph" and isinstance(c.get("data"), dict):
            d = c["data"]
            if d.get("investigation"):
                covered.add(d["investigation"])
            for i in d.get("investigations", []) or []:
                covered.add(i.get("investigation") or i.get("investigation_id"))
    out = {"type_ok": res["question_type"]["type"] == exp["type"]}
    abstained = res["status"] == "insufficient_evidence" and not res["claims"] and \
        (res["answer"] or "").startswith("I can't answer")
    out["abstain_ok"] = abstained == bool(exp.get("abstain"))
    if exp.get("investigations_any"):
        out["inv_hit"] = bool(covered & set(exp["investigations_any"]))
    if exp.get("documents_any"):
        out["doc_hit"] = any(c.get("document_id") in exp["documents_any"] for c in cits)
    if exp.get("structured"):
        out["structured_hit"] = any(c["source_type"] in STRUCTURED for c in cits)
    if exp.get("source_types_any"):
        out["source_type_hit"] = any(c["source_type"] in exp["source_types_any"] for c in cits)
    if exp.get("data_contains"):
        out["data_ok"] = all(s.lower() in blob.lower() for s in exp["data_contains"])
    return out


def run(path: Path = GOLDEN) -> dict:
    os.environ["LLM_API_KEY"] = ""
    from ..core.config import get_settings
    get_settings.cache_clear()
    from ..db.database import connect
    from ..providers.llm import set_llm
    from ..services import assistant
    set_llm(None)
    conn = connect(get_settings().db_path)
    rows = []
    for g in load(path):
        res = assistant.ask(conn, g["question"], "internal")
        rows.append({"id": g["id"], "scenario": g["scenario"], "category": g["category"],
                     "got_type": res["question_type"]["type"], "status": res["status"],
                     "citations": len(res["citations"]), **score_one(res, g["expect"])})
    conn.close()
    metrics: dict[str, dict] = {}
    keys = ["type_ok", "abstain_ok", "inv_hit", "doc_hit", "structured_hit", "source_type_hit", "data_ok"]
    for k in keys:
        vals = [r[k] for r in rows if k in r]
        metrics[k] = {"n": len(vals), "passed": sum(vals), "rate": round(sum(vals) / len(vals), 3) if vals else None}
    by_cat: dict[str, dict] = defaultdict(lambda: {"n": 0, "all_checks_passed": 0})
    for r in rows:
        ok = all(r[k] for k in keys if k in r)
        by_cat[r["category"]]["n"] += 1
        by_cat[r["category"]]["all_checks_passed"] += ok
        r["all_ok"] = ok
    unsup = [r for r in rows if r["category"] == "unsupported"]
    sup = [r for r in rows if r["category"] != "unsupported"]
    return {"n_questions": len(rows), "metrics": metrics, "by_category": dict(by_cat),
            "abstention": {"unsupported_abstained": sum(r["status"] == "insufficient_evidence" for r in unsup),
                           "n_unsupported": len(unsup),
                           "supported_wrongly_abstained": sum(r["got_type"] == "unsupported" for r in sup),
                           "n_supported": len(sup)},
            "rows": rows}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--holdout", action="store_true", help="the held-out set written after the rules were tuned")
    a = ap.parse_args()
    rep = run(HOLDOUT if a.holdout else GOLDEN)
    if a.json:
        print(json.dumps(rep, indent=1))
        return
    print(f"Phase 14 golden questions: {rep['n_questions']}")
    for k, m in rep["metrics"].items():
        if m["n"]:
            print(f"  {k:16s} {m['passed']}/{m['n']}  ({m['rate']:.3f})")
    print("  by category:", {k: f"{v['all_checks_passed']}/{v['n']}" for k, v in rep["by_category"].items()})
    print("  abstention:", rep["abstention"])
    for r in rep["rows"]:
        if not r["all_ok"]:
            print("  FAIL", r)


if __name__ == "__main__":
    main()

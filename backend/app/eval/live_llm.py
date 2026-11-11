"""Live LLM evaluation over the golden questions (real provider, real database, real verifier).

Run from backend/ (uses the key in the project-root .env; it is never printed):
    python -m app.eval.live_llm --ids g01,g13,g33 --pace 8
    python -m app.eval.live_llm --all --pace 8 --report ../docs/LIVE_LLM_EVALUATION.md

Free-tier friendly: questions run sequentially with `--pace` seconds between them, a per-minute 429 waits for the
server's retry delay once, and a daily-quota 429 stops the run (the remaining questions are reported as not run).
Each question costs 1 request, or 2 when the first answer fails verification and is regenerated.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from ..core.config import get_settings
from ..db.database import connect
from ..providers.llm import get_llm, llm_status
from ..services import assistant

GOLDEN = Path(__file__).resolve().parents[2] / "tests" / "golden_questions.jsonl"


def load(ids: list[str] | None) -> list[dict]:
    rows = [json.loads(x) for x in GOLDEN.read_text(encoding="utf-8").splitlines() if x.strip()]
    return [g for g in rows if not ids or g["id"] in ids]


def check(g: dict, res: dict) -> list[str]:
    """Structural checks on a live answer. Scientific review of the prose is done by a human (see report)."""
    issues = []
    ids = {c["citation_id"] for c in res["citations"]}
    st = res["status"]
    if st == "retrieval_only":
        issues.append("no synthesis: " + "; ".join(x for x in res["limitations"] if "AI synthesis" in x)[:200])
    for c in res["claims"]:
        if not c["citation_ids"] and c["kind"] != "HYPOTHESIS":
            issues.append(f"uncited claim: {c['text'][:60]}")
        if any(x not in ids for x in c["citation_ids"]):
            issues.append(f"unknown citation in claim: {c['text'][:60]}")
    for m in re.findall(r"cite-\d+", res.get("answer") or ""):
        if m not in ids:
            issues.append(f"answer cites unknown {m}")
    if g["category"] == "unanswerable" and st == "answered" and g["id"] in ("g12", "g39"):
        issues.append("safety-threshold question was answered without reservation")
    if st in ("answered", "partial") and not res["claims"]:
        issues.append("answered without any verified claim")
    return issues


def run(questions: list[dict], pace: float) -> list[dict]:
    s = get_settings()
    conn = connect(s.db_path)  # external literature writes its cache, as in the app
    out: list[dict] = []
    stop_reason = None
    for i, g in enumerate(questions):
        if stop_reason:
            out.append({"id": g["id"], "question": g["question"], "skipped": stop_reason})
            continue
        if i:
            time.sleep(pace)
        for attempt in range(2):
            t = time.time()
            res = assistant.ask(conn, g["question"], g["scope"])
            err = res["llm"].get("error")
            if err == "rate_limit" and attempt == 0 and not any("daily" in x for x in res["limitations"]):
                wait = min(float(res["llm"].get("retry_after_s") or 30), 75)
                print(f"  {g['id']}: per-minute quota, waiting {wait:.0f} s", flush=True)
                time.sleep(wait + 1)
                continue
            break
        if err == "rate_limit" and any("daily" in x for x in res["limitations"]):
            stop_reason = "daily free-tier quota reached"
        row = {"id": g["id"], "category": g["category"], "scope": g["scope"], "question": g["question"],
               "status": res["status"], "answer": res.get("answer"), "claims": res["claims"],
               "citations": [{k: c[k] for k in ("citation_id", "source_type", "title", "page_pdf", "document_id",
                                                 "doi", "experiment_uid")} for c in res["citations"]],
               "rejected": (res.get("verification") or {}).get("rejected", []), "llm": res["llm"],
               "limitations": res["limitations"], "wall_ms": int((time.time() - t) * 1000)}
        row["issues"] = check(g, res)
        out.append(row)
        print(f"{g['id']:>4} {res['status']:<22} claims={len(res['claims'])} rejected={len(row['rejected'])} "
              f"calls={res['llm'].get('calls', 0)} {row['wall_ms']} ms {'ISSUES: ' + '; '.join(row['issues']) if row['issues'] else ''}",
              flush=True)
    conn.close()
    return out


def report(rows: list[dict], path: Path) -> None:
    done = [r for r in rows if "status" in r]
    st = llm_status()
    by = {}
    for r in done:
        by[r["status"]] = by.get(r["status"], 0) + 1
    lat = sorted(r["llm"].get("latency_ms") or 0 for r in done if r["llm"].get("latency_ms"))
    calls = sum(r["llm"].get("calls", 0) for r in done)
    lines = [
        "# Live LLM evaluation (golden questions)", "",
        f"Generated {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')} by `python -m app.eval.live_llm`. "
        f"Provider `{st['provider']}`, model `{st['model']}`"
        + (f" (served as `{done[0]['llm'].get('model_version')}`)" if done and done[0]["llm"].get("model_version") else "")
        + ". Real database, real retrieval, real verifier; nothing mocked.", "",
        f"- Questions run: **{len(done)}** of {len(rows)}" + (f" (stopped: {rows[-1].get('skipped')})"
                                                             if len(done) < len(rows) else ""),
        f"- Status: " + ", ".join(f"{k} {v}" for k, v in sorted(by.items())),
        f"- Model requests: {calls} (a question uses 2 when its first answer fails verification)",
        f"- Model latency per question: median {lat[len(lat) // 2] / 1000:.1f} s, max {lat[-1] / 1000:.1f} s" if lat else
        "- Model latency: n/a",
        f"- Structural issues: {sum(1 for r in done if r['issues'])} question(s)", "",
        "Status meanings: `answered` = every generated statement passed citation and number verification; `partial` = "
        "some statements were removed by the verifier; `insufficient_evidence` = the model (or verifier) found the "
        "evidence does not support an answer; `retrieval_only` = no synthesis (provider error).", "",
        "| ID | Category | Status | Claims | Rejected | Calls | Model s | Issues |", "|---|---|---|---|---|---|---|---|"]
    for r in rows:
        if "status" not in r:
            lines.append(f"| {r['id']} | | not run | | | | | {r['skipped']} |")
            continue
        lines.append(f"| {r['id']} | {r['category']} | {r['status']} | {len(r['claims'])} | {len(r['rejected'])} | "
                     f"{r['llm'].get('calls', 0)} | {(r['llm'].get('latency_ms') or 0) / 1000:.1f} | "
                     f"{'; '.join(r['issues']) or '—'} |")
    lines += ["", "## Answers", ""]
    for r in done:
        lines += [f"### {r['id']}: {r['question']}", "", f"Status **{r['status']}**.", ""]
        if r["answer"]:
            lines += ["> " + r["answer"].replace("\n", "\n> "), ""]
        for c in r["claims"]:
            lines.append(f"- [{c['kind']}] {c['text']} ({', '.join(c['citation_ids'])})"
                         + (f" — applies to: {c['conditions']}" if c.get("conditions") else ""))
        cmap = {c["citation_id"]: c for c in r["citations"]}
        used = sorted({x for c in r["claims"] for x in c["citation_ids"]}, key=lambda x: int(x.split("-")[1]))
        if used:
            lines += ["", "Cited sources: " + "; ".join(
                f"{x} {cmap[x]['source_type']}: {cmap[x]['title'][:70]}"
                + (f" (PDF p.{cmap[x]['page_pdf']})" if cmap[x].get("page_pdf") else "") for x in used if x in cmap)]
        if r["rejected"]:
            lines += ["", "Removed by the verifier: " + " | ".join(x[:160] for x in r["rejected"])]
        lines.append("")
    path.write_text("\n".join(lines), encoding="utf-8")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--ids", default="")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--pace", type=float, default=8.0)
    ap.add_argument("--report", default="")
    ap.add_argument("--cache", action="store_true", help="allow cached model answers (default: always call the model)")
    ap.add_argument("--json", default=str(get_settings().processed_dir / "live_llm_eval.json"))
    a = ap.parse_args(argv)
    if not a.cache:
        import os
        os.environ["LLM_CACHE_TTL_HOURS"] = "0"
        get_settings.cache_clear()
    if get_llm() is None:
        print("No LLM configured:", llm_status().get("reason"))
        return 2
    ids = [x.strip() for x in a.ids.split(",") if x.strip()] or None
    if not ids and not a.all:
        print("Pass --ids or --all")
        return 2
    rows = run(load(ids), a.pace)
    Path(a.json).write_text(json.dumps(rows, ensure_ascii=False, indent=1), encoding="utf-8")
    if a.report:
        report(rows, Path(a.report))
    bad = [r for r in rows if r.get("issues")]
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())

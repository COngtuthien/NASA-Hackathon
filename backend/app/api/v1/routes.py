"""REST API v1 (spec §5). All handlers are thin; logic lives in services/."""
from __future__ import annotations

import io
import json
import logging
import mimetypes
import queue
import sqlite3
import threading
import zipfile
from pathlib import Path
from typing import Iterator

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import FileResponse, PlainTextResponse, Response, StreamingResponse
from pydantic import BaseModel, Field

from ...core.config import get_settings
from ...core.errors import ApiError, not_found
from ...db.database import connect, jloads
from ...providers.llm import llm_status
from ...services import analytics, assistant, experiments, ml, overview, quality, retrieval, similarity
from ...services.literature import get_literature, investigation_publications

router = APIRouter(prefix="/api/v1")
BACKEND_TESTS = Path(__file__).resolve().parents[3] / "tests"


def get_conn() -> Iterator[sqlite3.Connection]:
    path = get_settings().db_path
    if not path.exists():
        raise ApiError(503, "database_missing", "Database not built. Run: python -m app.ingest.run (from backend/).")
    conn = connect(path)
    try:
        yield conn
    finally:
        conn.close()


def _params(request: Request, skip: set[str]) -> dict[str, str]:
    return {k: v for k, v in request.query_params.items() if k not in skip}


# ------------------------------------------------------------------ health ---
@router.get("/health", tags=["system"])
def health():
    s = get_settings()
    db_ok, counts, ingested = False, {}, None
    if s.db_path.exists():
        try:
            conn = connect(s.db_path, readonly=True)
            rep = jloads(conn.execute("SELECT value FROM meta WHERE key='ingest_report'").fetchone()[0], {})
            counts, ingested = rep.get("counts", {}), rep.get("finished_at")
            db_ok = True
            conn.close()
        except sqlite3.Error:
            db_ok = False
    vec = (s.processed_dir / "lsa_vectors.npz").exists()
    return {"status": "ok" if db_ok else "degraded", "database": {"ok": db_ok, "ingested_at": ingested,
                                                                  "counts": counts},
            "retrieval": {"lexical": db_ok, "semantic_lsa": vec,
                          "mode": "hybrid (BM25 + LSA)" if vec else "lexical-only (BM25)"},
            "llm": llm_status(), "external": s.public_status()}


@router.get("/methodology", tags=["system"])
def methodology(conn=Depends(get_conn)):
    """Live figures for the Methodology page: link confidence, report cross-checks, rules, answer verification."""
    row = conn.execute("SELECT value FROM meta WHERE key='ingest_report'").fetchone()
    rep = jloads(row[0], {}) if row else {}
    links = dict(conn.execute("SELECT review_status, count(*) FROM evidence_links GROUP BY 1").fetchall())
    reviewed = dict(conn.execute("SELECT relation_type, count(*) FROM evidence_links WHERE review_status="
                                 "'manually_reviewed' GROUP BY 1").fetchall())
    rules = conn.execute("SELECT count(DISTINCT rule_id), count(*) FROM quality_flags").fetchone()
    try:
        cached = conn.execute("SELECT count(*) FROM llm_answer_cache").fetchone()[0]
    except sqlite3.Error:
        cached = 0
    rc = rep.get("report_consistency") or {}
    golden = BACKEND_TESTS / "golden_questions.jsonl"
    return {
        "links": {"by_level": links, "manually_reviewed_by_relation": reviewed,
                  "excluded": (rep.get("linking") or {}).get("links_by_level", {}).get("excluded")},
        "report_consistency": rc.get("summary"),
        "quality": {"rules": rules[0], "flags": rules[1]},
        "assistant": {"llm": llm_status(), "cached_answers": cached,
                      "golden_questions": sum(1 for x in golden.read_text(encoding="utf-8").splitlines() if x.strip())
                      if golden.exists() else None},
    }


# ---------------------------------------------------------------- overview ---
@router.get("/overview", tags=["overview"])
def get_overview(conn=Depends(get_conn)):
    return overview.overview(conn)


@router.get("/investigations", tags=["overview"])
def get_investigations(conn=Depends(get_conn)):
    return {"items": overview.investigations(conn)}


# ------------------------------------------------------------- experiments ---
@router.get("/experiments", tags=["experiments"])
def list_experiments(request: Request, dataset: str = "flex", q: str | None = None, sort: str | None = None,
                     order: str = "asc", page: int = 1, page_size: int = 20, conn=Depends(get_conn)):
    filters = _params(request, {"dataset", "q", "sort", "order", "page", "page_size"})
    return experiments.list_experiments(conn, dataset, q, filters, sort, order, page, page_size)


class CompareRequest(BaseModel):
    uids: list[str] = Field(..., min_length=2, max_length=5)


@router.post("/experiments/compare", tags=["experiments"])
def compare_experiments(body: CompareRequest, conn=Depends(get_conn)):
    return experiments.compare(conn, body.uids)


@router.get("/experiments/{uid}/similar", tags=["similarity"])
def similar(uid: str, k: int = 10, same_category: bool = False, conn=Depends(get_conn)):
    return similarity.similar_to(conn, uid, k, same_category)


@router.get("/experiments/{uid}", tags=["experiments"])
def experiment_detail(uid: str, conn=Depends(get_conn)):
    return experiments.get_experiment(conn, uid)


@router.get("/similar/{dataset}/query", tags=["similarity"])
def similar_query(dataset: str, request: Request, k: int = 10, conn=Depends(get_conn)):
    return similarity.similar_to_conditions(conn, dataset, _params(request, {"k"}), k)


@router.get("/exports/experiments.csv", tags=["experiments"])
def export_experiments(request: Request, dataset: str = "flex", q: str | None = None, variant: str = "normalized",
                       conn=Depends(get_conn)):
    filters = _params(request, {"dataset", "q", "variant", "sort", "order", "page", "page_size"})
    text = experiments.export_csv(conn, dataset, q, filters, variant)
    return Response(text, media_type="text/csv", headers={
        "Content-Disposition": f'attachment; filename="spacefire_{dataset}_{variant}.csv"'})


# ---------------------------------------------------------------- evidence ---
@router.get("/evidence/search", tags=["evidence"])
def evidence_search(q: str, investigation: str | None = None, doc_type: str | None = None, source_type: str = "all",
                    year_min: int | None = None, year_max: int | None = None, limit: int = 20, offset: int = 0,
                    conn=Depends(get_conn)):
    return retrieval.search(conn, q, investigation, doc_type, source_type, year_min, year_max, limit, max(0, offset))


@router.get("/evidence/{chunk_id}", tags=["evidence"])
def evidence_chunk(chunk_id: str, conn=Depends(get_conn)):
    return retrieval.get_chunk(conn, chunk_id)


@router.get("/documents", tags=["evidence"])
def documents(investigation: str | None = None, conn=Depends(get_conn)):
    return {"items": retrieval.list_documents(conn, investigation)}


@router.get("/documents/{document_id}", tags=["evidence"])
def document(document_id: str, conn=Depends(get_conn)):
    return retrieval.get_document(conn, document_id)


@router.get("/documents/{document_id}/file", tags=["evidence"])
def document_file(document_id: str, conn=Depends(get_conn)):
    """Serve the original source file. Path comes from the DB (never from the request) and must stay in the repo."""
    row = conn.execute("SELECT relative_path FROM documents WHERE document_id=?", (document_id,)).fetchone()
    if not row:
        raise not_found("Document", document_id)
    root = get_settings().repo_root.resolve()
    rel = row["relative_path"]
    if "::" in rel:
        zpath, member = rel.split("::", 1)
        p = (root / zpath).resolve()
        if root not in p.parents:
            raise ApiError(403, "forbidden", "Path outside repository.")
        with zipfile.ZipFile(p) as z:
            return PlainTextResponse(z.read(member).decode("utf-8", errors="replace"))
    p = (root / rel).resolve()
    if root not in p.parents or not p.is_file():
        raise ApiError(404, "not_found", "Source file unavailable.")
    media = mimetypes.guess_type(p.name)[0] or "application/octet-stream"
    return FileResponse(p, media_type=media, filename=p.name, content_disposition_type="inline")


# ---------------------------------------------------------------- research ---
@router.get("/research/search", tags=["research"])
def research_search(q: str, sources: str = "ntrs,openalex", page: int = 1, size: int = 10, year_min: int | None = None,
                    year_max: int | None = None, author: str | None = None, open_access: bool | None = None,
                    sort: str = "relevance", conn=Depends(get_conn)):
    return get_literature().search(conn, q, [s.strip() for s in sources.split(",")], page, size, year_min, year_max,
                                   author, open_access, sort)


@router.get("/research/doi/{doi:path}", tags=["research"])
def research_doi(doi: str, conn=Depends(get_conn)):
    return get_literature().lookup_doi(conn, doi)


@router.get("/research/publications", tags=["research"])
def research_publications(investigation: str | None = None, conn=Depends(get_conn)):
    return {"items": investigation_publications(conn, investigation)}


@router.get("/research/{paper_id:path}/related", tags=["research"])
def research_related(paper_id: str, conn=Depends(get_conn)):
    return get_literature().related(conn, paper_id)


# --------------------------------------------------------------- assistant ---
class AskRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=1000)
    source_scope: str = Field("internal", pattern="^(internal|external|both)$")
    investigations: list[str] = Field(default_factory=list, max_length=3)
    context_experiment_uids: list[str] = Field(default_factory=list, max_length=5)


@router.post("/assistant/ask", tags=["assistant"])
def assistant_ask(body: AskRequest, conn=Depends(get_conn)):
    return assistant.ask(conn, body.question, body.source_scope, body.investigations or None,
                         body.context_experiment_uids or None)


@router.post("/assistant/ask/stream", tags=["assistant"])
def assistant_ask_stream(body: AskRequest):
    """Same answer as /assistant/ask, streamed as NDJSON: one `start`, then `tool_start`/`tool_end` per tool or
    model call as it happens, then a final `result` (the full answer object) or `error` line."""
    assistant.validate_request(body.question, body.source_scope, body.investigations or None)
    path = get_settings().db_path
    if not path.exists():
        raise ApiError(503, "database_missing", "Database not built. Run: python -m app.ingest.run (from backend/).")
    events: queue.Queue = queue.Queue()
    done = object()

    def work():
        conn = connect(path)  # own connection: it lives and dies in this worker thread
        try:
            res = assistant.ask(conn, body.question, body.source_scope, body.investigations or None,
                                body.context_experiment_uids or None, emit=events.put)
            events.put({"event": "result", "data": res})
        except ApiError as e:
            events.put({"event": "error", "error": {"code": e.code, "message": e.message}})
        except Exception:
            logging.getLogger("spacefire.api").exception("assistant stream failed")
            events.put({"event": "error", "error": {"code": "internal_error", "message": "Unexpected server error."}})
        finally:
            conn.close()
            events.put(done)

    threading.Thread(target=work, name="assistant-stream", daemon=True).start()

    def lines():
        while True:
            try:
                ev = events.get(timeout=15)
            except queue.Empty:
                yield b'{"event":"heartbeat"}\n'  # keeps proxies from closing an idle connection
                continue
            if ev is done:
                return
            yield (json.dumps(ev, ensure_ascii=False, default=str) + "\n").encode("utf-8")

    return StreamingResponse(lines(), media_type="application/x-ndjson",
                             headers={"Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no"})


# --------------------------------------------------------------- analytics ---
@router.get("/analytics/flex/map", tags=["analytics"])
def flex_map(request: Request, conn=Depends(get_conn)):
    return analytics.flex_map(conn, dict(request.query_params))


@router.get("/analytics/flex/d2", tags=["analytics"])
def flex_d2(request: Request, uid: str | None = None, conn=Depends(get_conn)):
    return analytics.flex_d2(conn, _params(request, {"uid"}), uid)


@router.get("/analytics/bass/gases", tags=["analytics"])
def bass_gases(request: Request, conn=Depends(get_conn)):
    return analytics.bass_gases(conn, dict(request.query_params))


@router.get("/analytics/bass/report", tags=["analytics"])
def bass_report_values(conn=Depends(get_conn)):
    return analytics.bass_report(conn)


@router.get("/curated/bass2", tags=["evidence"])
def curated_bass2(table: str | None = None, verification: str | None = None, test_id: str | None = None,
                  conn=Depends(get_conn)):
    sql, args = "SELECT * FROM report_records WHERE 1=1", []
    for col, val in (("table_id", table), ("verification", verification), ("test_id", test_id)):
        if val:
            sql += f" AND {col}=?"
            args.append(val)
    items = []
    for r in conn.execute(sql + " ORDER BY page_pdf, rowid", args):
        d = dict(r)
        for k in ("values_json", "units_json", "raw_json", "checks_json", "notes_json"):
            d[k[:-5]] = jloads(d.pop(k), {})
        items.append(d)
    return {"total": len(items), "items": items}


@router.get("/analytics/saffire/case", tags=["analytics"])
def saffire_case(conn=Depends(get_conn)):
    return analytics.saffire_case(conn)


@router.get("/analytics/saffire/timeline", tags=["analytics"])
def saffire_timeline(bin_s: int = 10, set_label: str | None = None, conn=Depends(get_conn)):
    return analytics.saffire_timeline(conn, bin_s, set_label)


@router.get("/analytics/saffire/timeline.csv", tags=["analytics"])
def saffire_timeline_csv(bin_s: int = 30, conn=Depends(get_conn)):
    data = analytics.saffire_timeline(conn, bin_s)
    buf = io.StringIO()
    buf.write("set_label,camera,bin_start_s,bin_start_utc,frames_listed,jpeg_received,jpeg_corrupt\n")
    for s in data["series"]:
        for b in s["bins"]:
            buf.write(f"{s['set_label']},{s['camera']},{b['bin_start_s']},{b['bin_start_utc']},{b['frames']},"
                      f"{b['received']},{b['corrupt']}\n")
    return Response(buf.getvalue(), media_type="text/csv",
                    headers={"Content-Disposition": 'attachment; filename="saffire1_manifest_timeline.csv"'})


# ----------------------------------------------------------------- quality ---
@router.get("/quality/flags", tags=["quality"])
def quality_flags(investigation: str | None = None, severity: str | None = None, category: str | None = None,
                  rule_id: str | None = None, status: str | None = None, q: str | None = None,
                  experiment_uid: str | None = None, page: int = 1, page_size: int = 50, conn=Depends(get_conn)):
    return quality.list_flags(conn, investigation, severity, category, rule_id, status, q, experiment_uid, page,
                              page_size)


@router.get("/quality/summary", tags=["quality"])
def quality_summary(conn=Depends(get_conn)):
    return quality.summary(conn)


@router.get("/quality/flags.csv", tags=["quality"])
def quality_export(investigation: str | None = None, severity: str | None = None, category: str | None = None,
                   rule_id: str | None = None, status: str | None = None, q: str | None = None,
                   conn=Depends(get_conn)):
    text = quality.export_flags(conn, investigation=investigation, severity=severity, category=category,
                                rule_id=rule_id, status=status, q=q, experiment_uid=None)
    return Response(text, media_type="text/csv",
                    headers={"Content-Disposition": 'attachment; filename="spacefire_quality_flags.csv"'})


# ---------------------------------------------------------------------- ML ---
@router.get("/ml/flex/metrics", tags=["ml"])
def ml_metrics(conn=Depends(get_conn)):
    return ml.metrics(conn)


class PredictRequest(BaseModel):
    fuel: str
    x_o2: float = Field(..., ge=0, le=1)
    x_co2: float = Field(0, ge=0, le=1)
    x_he: float = Field(0, ge=0, le=1)
    pressure_atm: float = Field(..., gt=0, le=5)
    d0_mm: float = Field(..., gt=0, le=10)


@router.post("/ml/flex/predict", tags=["ml"])
def ml_predict(body: PredictRequest, conn=Depends(get_conn)):
    return ml.predict(conn, body.model_dump())


_ = Query, Path

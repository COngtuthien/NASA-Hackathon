"""Data-quality flag queries and export. Flags never modify source data."""
from __future__ import annotations

import csv
import io
import math
import sqlite3

from ..core.errors import bad_request

SEVERITIES = ("critical", "warning", "info")
CATEGORIES = ("missing", "invalid", "inconsistent", "duplicate", "document_conflict", "source_warning", "unit",
              "suspicious")
STATUSES = ("reported", "confirmed", "disputed", "unresolved")


def _where(investigation, severity, category, rule_id, status, q, experiment_uid):
    where, args = [], []
    for col, val, allowed in (("investigation_id", investigation, None), ("severity", severity, SEVERITIES),
                              ("category", category, CATEGORIES), ("status", status, STATUSES),
                              ("rule_id", rule_id, None)):
        if val:
            vals = [v for v in val.split("|") if v]
            if allowed:
                bad = [v for v in vals if v not in allowed]
                if bad:
                    raise bad_request(f"Invalid {col}: {', '.join(bad)}")
            where.append(f"f.{col} IN ({','.join('?' * len(vals))})")
            args += vals
    if experiment_uid:
        where.append("f.experiment_uid = ?")
        args.append(experiment_uid)
    if q:
        where.append("(f.description LIKE ? OR f.raw_value LIKE ? OR e.display_id LIKE ? OR f.rule_id LIKE ?)")
        args += [f"%{q}%"] * 4
    return ("WHERE " + " AND ".join(where)) if where else "", args


def list_flags(conn: sqlite3.Connection, investigation=None, severity=None, category=None, rule_id=None, status=None,
               q=None, experiment_uid=None, page: int = 1, page_size: int = 50) -> dict:
    if page < 1 or not (1 <= page_size <= 500):
        raise bad_request("invalid pagination")
    w, args = _where(investigation, severity, category, rule_id, status, q, experiment_uid)
    base = f"FROM quality_flags f LEFT JOIN experiments e USING(experiment_uid) LEFT JOIN source_files s ON s.source_id=f.source_id {w}"
    total = conn.execute(f"SELECT count(*) {base}", args).fetchone()[0]
    rows = conn.execute(
        f"SELECT f.*, e.display_id, s.relative_path AS source_path {base} ORDER BY CASE f.severity WHEN 'critical' "
        f"THEN 0 WHEN 'warning' THEN 1 ELSE 2 END, f.investigation_id, e.source_row, f.rule_id LIMIT ? OFFSET ?",
        args + [page_size, (page - 1) * page_size]).fetchall()
    return {"total": total, "page": page, "page_size": page_size, "pages": max(1, math.ceil(total / page_size)),
            "items": [dict(r) for r in rows]}


def summary(conn: sqlite3.Connection) -> dict:
    by_sev = {f"{r['investigation_id']}|{r['severity']}": r["n"] for r in conn.execute(
        "SELECT investigation_id, severity, count(*) n FROM quality_flags GROUP BY 1,2")}
    rules = [dict(r) for r in conn.execute(
        "SELECT investigation_id, rule_id, category, severity, status, count(*) AS n, "
        "count(DISTINCT experiment_uid) AS experiments, min(description) AS example FROM quality_flags "
        "GROUP BY 1,2,3,4,5 ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END, n DESC")]
    per_inv = {}
    for r in conn.execute("SELECT investigation_id, count(*) n, count(DISTINCT experiment_uid) ex FROM quality_flags "
                          "GROUP BY 1"):
        per_inv[r["investigation_id"]] = {"flags": r["n"], "experiments_affected": r["ex"]}
    cats = {r["category"]: r["n"] for r in conn.execute("SELECT category, count(*) n FROM quality_flags GROUP BY 1")}
    return {"by_investigation_severity": by_sev, "per_investigation": per_inv, "by_category": cats, "rules": rules,
            "total": sum(cats.values()),
            "policy": "Flags annotate data; original values are never overwritten. Proposed corrections appear only "
                      "with a supporting citation."}


def export_flags(conn: sqlite3.Connection, **filters) -> str:
    data = list_flags(conn, **filters, page=1, page_size=500)
    items = data["items"]
    page = 2
    while len(items) < data["total"]:
        items += list_flags(conn, **filters, page=page, page_size=500)["items"]
        page += 1
    buf = io.StringIO()
    cols = ["flag_id", "investigation_id", "experiment_uid", "display_id", "source_path", "source_row", "raw_field",
            "raw_value", "rule_id", "category", "severity", "status", "description", "derived_value", "evidence_ref",
            "proposed_correction"]
    w = csv.writer(buf)
    w.writerow(cols)
    for it in items:
        w.writerow(["" if it.get(c) is None else it.get(c) for c in cols])
    return buf.getvalue()

"""Experiment search, detail, comparison and CSV export."""
from __future__ import annotations

import csv
import io
import math
import sqlite3
from typing import Any

from ..core.errors import ApiError, bad_request, not_found
from ..db.database import jloads
from .catalog import DATASETS, BY_INVESTIGATION, DatasetDef, dataset_for_uid

MAX_PAGE_SIZE = 200


def _dataset(key: str) -> DatasetDef:
    ds = DATASETS.get(key)
    if not ds:
        raise bad_request(f"Unknown dataset '{key}'. Use one of: {', '.join(DATASETS)}.")
    return ds


def parse_filters(ds: DatasetDef, params: dict[str, str]) -> tuple[list[str], list[Any], dict]:
    """Translate whitelisted query params into SQL. Unknown fields -> 400."""
    where, args, applied = [], [], {}
    for key, value in params.items():
        if value is None or value == "":
            continue
        if key.startswith("min_") or key.startswith("max_"):
            name = key[4:]
            f = ds.field(name)
            if not f or f.kind != "numeric":
                raise bad_request(f"'{name}' is not a numeric filter for {ds.short_name}.")
            try:
                v = float(value)
            except ValueError:
                raise bad_request(f"Filter {key} must be a number.")
            if not math.isfinite(v):
                raise bad_request(f"Filter {key} must be finite.")
            where.append(f"t.{name} {'>=' if key.startswith('min_') else '<='} ?")
            args.append(v)
            applied[key] = v
        elif key.startswith("f_"):
            name = key[2:]
            f = ds.field(name)
            if not f or f.kind not in ("category", "text"):
                raise bad_request(f"'{name}' is not a categorical filter for {ds.short_name}.")
            vals = [v for v in value.split("|") if v != ""]
            if not vals:
                continue
            where.append(f"CAST(t.{name} AS TEXT) IN ({','.join('?' * len(vals))})")
            args += vals
            applied[key] = vals
        elif key == "has":
            # require a numeric value for a field (e.g. has=dext_mm)
            for name in value.split("|"):
                f = ds.field(name)
                if not f or f.kind != "numeric":
                    raise bad_request(f"'{name}' cannot be used with has=.")
                where.append(f"t.{name} IS NOT NULL")
            applied[key] = value.split("|")
        else:
            raise bad_request(f"Unknown filter parameter '{key}'.")
    return where, args, applied


def list_experiments(conn: sqlite3.Connection, dataset: str, q: str | None, filters: dict[str, str],
                     sort: str | None, order: str, page: int, page_size: int) -> dict:
    ds = _dataset(dataset)
    if page < 1:
        raise bad_request("page must be >= 1")
    if not (1 <= page_size <= MAX_PAGE_SIZE):
        raise bad_request(f"page_size must be between 1 and {MAX_PAGE_SIZE}")
    where, args, applied = parse_filters(ds, filters)
    if q:
        qs = q.strip()
        if len(qs) > 200:
            raise bad_request("q is too long")
        like = f"%{qs}%"
        where.append("(" + " OR ".join(f"CAST(t.{c} AS TEXT) LIKE ?" for c in ds.search_cols) + " OR e.experiment_uid = ?)")
        args += [like] * len(ds.search_cols) + [qs]
    sort_col = sort or ds.default_sort
    if sort_col != "experiment_uid" and not ds.field(sort_col) and sort_col not in ds.list_cols:
        raise bad_request(f"Cannot sort {ds.short_name} by '{sort_col}'.")
    direction = "DESC" if order.lower() == "desc" else "ASC"
    where_sql = ("WHERE " + " AND ".join(where)) if where else ""
    base = f"FROM {ds.table} t JOIN experiments e USING(experiment_uid) {where_sql}"
    total = conn.execute(f"SELECT count(*) {base}", args).fetchone()[0]
    sort_expr = "e.source_row" if sort_col == "experiment_uid" else f"t.{sort_col}"
    rows = conn.execute(
        f"SELECT t.*, e.source_row, e.display_id, e.experiment_kind {base} "
        f"ORDER BY ({sort_expr} IS NULL), {sort_expr} {direction}, e.source_row ASC LIMIT ? OFFSET ?",
        args + [page_size, (page - 1) * page_size]).fetchall()
    uids = [r["experiment_uid"] for r in rows]
    flag_counts = _flag_counts(conn, uids)
    items = []
    for r in rows:
        d = dict(r)
        item = {"experiment_uid": d["experiment_uid"], "display_id": d["display_id"], "source_row": d["source_row"],
                "investigation_id": ds.investigation_id, "dataset": ds.key,
                "fields": {c: d.get(c) for c in ds.list_cols}, "flags": flag_counts.get(d["experiment_uid"], {})}
        kinds = {f.name: d.get(f.kind_col) for f in ds.fields if f.kind_col}
        if kinds:
            item["value_kinds"] = kinds
        items.append(item)
    return {"dataset": ds.key, "investigation_id": ds.investigation_id, "total": total, "page": page,
            "page_size": page_size, "pages": max(1, math.ceil(total / page_size)), "sort": sort_col,
            "order": direction.lower(), "filters_applied": applied, "query": q or None, "items": items,
            "facets": facets(conn, ds), "fields": [field_dict(f) for f in ds.fields]}


def field_dict(f) -> dict:
    return {"name": f.name, "label": f.label, "kind": f.kind, "unit": f.unit, "role": f.role,
            "source_header": f.source_header, "note": f.note}


def facets(conn: sqlite3.Connection, ds: DatasetDef) -> dict:
    out: dict[str, Any] = {}
    for f in ds.fields:
        if f.kind == "category":
            rows = conn.execute(f"SELECT CAST({f.name} AS TEXT) v, count(*) n FROM {ds.table} GROUP BY 1 ORDER BY 2 DESC")
            out[f.name] = [{"value": r["v"], "count": r["n"]} for r in rows]
        elif f.kind == "numeric":
            r = conn.execute(f"SELECT min({f.name}) lo, max({f.name}) hi, count({f.name}) n FROM {ds.table}").fetchone()
            out[f.name] = {"min": r["lo"], "max": r["hi"], "n": r["n"]}
    return out


def _flag_counts(conn: sqlite3.Connection, uids: list[str]) -> dict[str, dict[str, int]]:
    if not uids:
        return {}
    out: dict[str, dict[str, int]] = {}
    for r in conn.execute(
            f"SELECT experiment_uid, severity, count(*) n FROM quality_flags WHERE experiment_uid IN "
            f"({','.join('?' * len(uids))}) GROUP BY 1,2", uids):
        out.setdefault(r["experiment_uid"], {})[r["severity"]] = r["n"]
    return out


def source_ref(conn: sqlite3.Connection, source_id: str) -> dict:
    r = conn.execute("SELECT source_id, relative_path, sha256, media_type FROM source_files WHERE source_id=?",
                     (source_id,)).fetchone()
    return dict(r) if r else {}


def get_experiment(conn: sqlite3.Connection, uid: str) -> dict:
    ds = dataset_for_uid(uid)
    e = conn.execute("SELECT * FROM experiments WHERE experiment_uid=?", (uid,)).fetchone()
    if not ds or not e:
        raise not_found("Experiment", uid)
    norm = dict(conn.execute(f"SELECT * FROM {ds.table} WHERE experiment_uid=?", (uid,)).fetchone())
    for k in ("fan_tokens_json", "air_tokens_json"):
        if k in norm:
            norm[k] = jloads(norm[k], [])
    obs = [dict(r) for r in conn.execute(
        "SELECT column_index, raw_field, raw_text, value_kind, numeric_value, numeric_low, numeric_high, text_value, "
        "normalized_name, unit_raw, unit_normalized, measurement_role, derivation_note FROM observations "
        "WHERE experiment_uid=? ORDER BY column_index", (uid,))]
    flags = [dict(r) for r in conn.execute(
        "SELECT * FROM quality_flags WHERE experiment_uid=? ORDER BY CASE severity WHEN 'critical' THEN 0 "
        "WHEN 'warning' THEN 1 ELSE 2 END, rule_id", (uid,))]
    dataset_flags = [dict(r) for r in conn.execute(
        "SELECT * FROM quality_flags WHERE experiment_uid IS NULL AND investigation_id=? AND source_row IS NULL "
        "ORDER BY severity DESC", (ds.investigation_id,))]
    links = [dict(r) for r in conn.execute(
        "SELECT l.relation_type, l.match_method, l.matched_text, l.review_status, c.chunk_id, c.document_id, "
        "c.page_pdf, c.page_printed, c.section, substr(c.text,1,600) AS excerpt, d.title, d.relative_path "
        "FROM evidence_links l JOIN document_chunks c USING(chunk_id) JOIN documents d USING(document_id) "
        "WHERE l.experiment_uid=? ORDER BY d.title, c.page_pdf LIMIT 40", (uid,))]
    for ln in links:
        ln["excerpt"] = _excerpt_around(ln["excerpt"], ln["matched_text"])
    duplicates = []
    if ds.key == "flex":
        duplicates = [dict(r) for r in conn.execute(
            "SELECT experiment_uid, source_row FROM experiments WHERE investigation_id=? AND display_id=? "
            "AND experiment_uid<>?", (ds.investigation_id, e["display_id"], uid))]
    result = {
        "experiment_uid": uid, "dataset": ds.key, "investigation_id": ds.investigation_id,
        "investigation": ds.short_name, "display_id": e["display_id"], "experiment_kind": e["experiment_kind"],
        "source": {**source_ref(conn, e["source_id"]), "source_row": e["source_row"],
                   "csv_line": e["source_row"] + 1},
        "raw_fields": [{"header": h, "value": v} for h, v in jloads(e["raw_json"], [])],
        "observations": obs, "normalized": norm, "fields": [field_dict(f) for f in ds.fields],
        "quality_flags": flags, "dataset_flags": dataset_flags, "evidence_links": links,
        "duplicate_display_ids": duplicates,
    }
    if ds.key == "saffire1":
        result["image_sets"] = [dict(r) for r in conn.execute("SELECT * FROM saffire_image_sets ORDER BY label")]
    return result


def _excerpt_around(text: str, needle: str | None, width: int = 320) -> str:
    if not needle or needle not in text:
        return text[:width]
    i = text.index(needle)
    start = max(0, i - width // 2)
    return ("…" if start else "") + text[start:start + width] + ("…" if start + width < len(text) else "")


# ---------------------------------------------------------------- compare ---

def compare(conn: sqlite3.Connection, uids: list[str]) -> dict:
    uids = list(dict.fromkeys(u.strip() for u in uids if u and u.strip()))
    if not (2 <= len(uids) <= 5):
        raise bad_request("Select between 2 and 5 distinct experiments to compare.")
    dss = []
    for u in uids:
        ds = dataset_for_uid(u)
        if not ds or not conn.execute("SELECT 1 FROM experiments WHERE experiment_uid=?", (u,)).fetchone():
            raise not_found("Experiment", u)
        dss.append(ds)
    investigations = {d.investigation_id for d in dss}
    records = []
    for u, ds in zip(uids, dss):
        e = conn.execute("SELECT display_id, source_row FROM experiments WHERE experiment_uid=?", (u,)).fetchone()
        n = dict(conn.execute(f"SELECT * FROM {ds.table} WHERE experiment_uid=?", (u,)).fetchone())
        records.append({"experiment_uid": u, "dataset": ds.key, "investigation": ds.short_name,
                        "display_id": e["display_id"], "source_row": e["source_row"], "values": n})

    if len(investigations) > 1:
        inv_rows = {r["investigation_id"]: dict(r) for r in conn.execute("SELECT * FROM investigations")}
        return {
            "mode": "cross_investigation_qualitative", "compatible": False, "experiments": records,
            "investigations": [{"investigation_id": i, "title": inv_rows[i]["title"],
                                "fuel_system": inv_rows[i]["fuel_system"], "scale": inv_rows[i]["scale"],
                                "description": inv_rows[i]["description"]} for i in sorted(investigations)],
            "fields": [], "chart": None,
            "warnings": [
                "These experiments belong to different investigations with different physical systems "
                "(liquid droplets vs. solid samples vs. a spacecraft-scale fabric). No shared numeric axis is shown.",
                "Burn times are defined differently per investigation and are not comparable as numbers.",
                "CO2 in FLEX is an initial diluent (input); CO2 in BASS-II is a combustion product measured "
                "before/after (output). They must not be pooled.",
            ],
        }

    ds = dss[0]
    fields = []
    for f in ds.fields:
        if f.kind != "numeric":
            fields.append({**field_dict(f), "values": [r["values"].get(f.name) for r in records],
                           "comparison": "categorical",
                           "same": len({str(r["values"].get(f.name)) for r in records}) == 1})
            continue
        vals = [r["values"].get(f.name) for r in records]
        kinds = [r["values"].get(f.kind_col) for r in records] if f.kind_col else None
        numeric = [v for v in vals if isinstance(v, (int, float))]
        entry = {**field_dict(f), "values": vals, "value_kinds": kinds, "comparison": "numeric", "n": len(numeric)}
        if len(numeric) == len(vals) and len(vals) >= 2:
            ref = vals[0]
            entry["delta_vs_first"] = [None if i == 0 else round(v - ref, 6) for i, v in enumerate(vals)]
            entry["ratio_vs_first"] = [None if i == 0 or ref == 0 else round(v / ref, 6) for i, v in enumerate(vals)]
            entry["range"] = round(max(vals) - min(vals), 6)
            entry["same"] = entry["range"] == 0
        else:
            entry["note"] = "Delta/ratio not computed: at least one value is missing or non-numeric."
        fields.append(entry)
    flags = {}
    for r in conn.execute(f"SELECT experiment_uid, rule_id, severity, description FROM quality_flags WHERE "
                          f"experiment_uid IN ({','.join('?' * len(uids))}) AND severity <> 'info'", uids):
        flags.setdefault(r["experiment_uid"], []).append(dict(r))
    chartable = [f["name"] for f in fields if f.get("comparison") == "numeric" and f.get("n", 0) >= 2]
    warnings = []
    if ds.key == "bass2":
        warnings.append("BASS-II gas values are single before/after readings in a ~250 L chamber, not time series. "
                        "Different PIs used different geometries and flow directions; differences are descriptive.")
    if ds.key == "flex":
        warnings.append("Burn time, extinction diameter and K are outcomes; compare them only alongside the "
                        "initial conditions (fuel, O2, diluent, pressure, D0).")
    if ds.key == "saffire1":
        warnings.append("SAFFIRE-I has only two burns (n=2); differences are descriptive, not statistical.")
    return {"mode": "same_investigation", "compatible": True, "dataset": ds.key, "investigation_id": ds.investigation_id,
            "experiments": records, "fields": fields, "chartable_fields": chartable, "quality_flags": flags,
            "warnings": warnings}


# ---------------------------------------------------------------- export ---

def export_csv(conn: sqlite3.Connection, dataset: str, q: str | None, filters: dict[str, str], variant: str) -> str:
    ds = _dataset(dataset)
    if variant not in ("normalized", "original"):
        raise bad_request("variant must be 'normalized' or 'original'")
    data = list_experiments(conn, dataset, q, filters, None, "asc", 1, MAX_PAGE_SIZE)
    total = data["total"]
    items = data["items"]
    page = 2
    while len(items) < total:
        items += list_experiments(conn, dataset, q, filters, None, "asc", page, MAX_PAGE_SIZE)["items"]
        page += 1
    buf = io.StringIO()
    w = csv.writer(buf)
    uids = [i["experiment_uid"] for i in items]
    src = conn.execute("SELECT s.relative_path, s.sha256 FROM experiments e JOIN source_files s USING(source_id) "
                       "WHERE e.investigation_id=? LIMIT 1", (ds.investigation_id,)).fetchone()
    flags = _flag_counts(conn, uids)
    if variant == "original":
        first = conn.execute("SELECT raw_json FROM experiments WHERE investigation_id=? AND experiment_kind='burn' "
                             "ORDER BY source_row LIMIT 1", (ds.investigation_id,)).fetchone()
        headers = [h for h, _ in jloads(first["raw_json"], [])]
        w.writerow(["experiment_uid", "source_file", "source_sha256", "source_row"] + headers)
        for u in uids:
            e = conn.execute("SELECT source_row, raw_json FROM experiments WHERE experiment_uid=?", (u,)).fetchone()
            w.writerow([u, src["relative_path"], src["sha256"], e["source_row"]] + [v for _, v in jloads(e["raw_json"])])
    else:
        cols = [f.name for f in ds.fields]
        units = {f.name: f.unit for f in ds.fields}
        w.writerow(["experiment_uid", "source_file", "source_sha256", "source_row"] +
                   [f"{c} [{units[c]}]" if units[c] else c for c in cols] +
                   ["flags_critical", "flags_warning", "flags_info"])
        for u in uids:
            row = dict(conn.execute(f"SELECT t.*, e.source_row FROM {ds.table} t JOIN experiments e USING(experiment_uid) "
                                    f"WHERE experiment_uid=?", (u,)).fetchone())
            fc = flags.get(u, {})
            w.writerow([u, src["relative_path"], src["sha256"], row["source_row"]] +
                       ["" if row.get(c) is None else row.get(c) for c in cols] +
                       [fc.get("critical", 0), fc.get("warning", 0), fc.get("info", 0)])
    return buf.getvalue()


def investigation_of(uid: str) -> str:
    ds = dataset_for_uid(uid)
    if not ds:
        raise ApiError(404, "not_found", f"Unknown experiment uid '{uid}'.")
    return ds.investigation_id


_ = BY_INVESTIGATION

"""Phase 16: Combustion & Fire Science Explorer back end for the seven investigations added in Phase 13.

FLEX, BASS-II and SAFFIRE-I keep their existing /experiments API. Everything here reads the verified curated records
(p13_records) and serves each collection at its real evidence level:

  cfig          ACME CFI-G per-test points with observed outcomes (normal and inverse kept apart)
  flame_design  ACME Flame Design test conditions only (no outcomes in the download)
  bre           ACME BRE day-level summaries (not individual flame tests)
  same_log      SAME flight-test log (what was run)          } two separate tables; no row join is claimed
  same_sizes    SAME report-derived particle sizes (Table 1)  }
  psi117        PSI-117 published figure-data series (series, not tests)
  flex2         FLEX-2 planned test-matrix envelope (no per-test outcomes)
  PSI-62        metadata only: an investigation profile, no records

Filters and columns come from the fields each collection actually has; nothing is filled with defaults.
"""
from __future__ import annotations

import math
import re
import sqlite3
from collections import Counter

from ..core.errors import bad_request, not_found
from ..db.database import jloads
from . import kg

# column: (field, label, unit, kind, role)   kind: cat | num | text | bool   role: id | condition | outcome | derived | log
C = tuple
DATASETS: dict[str, dict] = {
    "cfig": {
        "inv": "PSI-159", "p13": "cfig_tests", "domain": "gaseous", "title": "ACME CFI-G test points",
        "level": "measured", "badge": "Measured test outcomes",
        "note": "One row per CSV test point. Normal and inverse flames are separate configurations; flow-terminated (FT) "
                "burn times are lower bounds (censored).",
        "columns": [C(("test_id", "Test", None, "text", "id")), C(("configuration", "Configuration", None, "cat", "condition")),
                    C(("fuel_species", "Fuel", None, "cat", "condition")), C(("bottle_fuel_pct", "Fuel in bottle", "%", "num", "condition")),
                    C(("x_o2", "O₂ mole fraction (ambient before ignition for normal; supplied for inverse)", None, "num", "derived")),
                    C(("p_bar", "Pressure", "bar", "num", "condition")),
                    C(("hot_ignition", "Hot ignition", None, "cat", "outcome")), C(("termination", "Termination", None, "cat", "outcome")),
                    C(("outcome", "Observed outcome", None, "cat", "outcome")), C(("burn_time_s", "Burn time", "s", "num", "outcome")),
                    C(("burn_time_censored", "Burn time censored (FT)", None, "bool", "outcome")),
                    C(("date", "Date", None, "text", "log"))],
        "key": ["test_id", "configuration", "fuel_species", "x_o2", "p_bar", "outcome", "burn_time_s"],
        "filters": {"cats": ["configuration", "fuel_species", "outcome", "hot_ignition"], "nums": ["x_o2", "p_bar"]},
        "compare_within": "configuration",
        "links": [("CFI-G charts", "/phenomena/gaseous-flames?tab=cfig"), ("Gaseous Flame Studio", "/phenomena/gaseous-flames#studio")],
        "record_link": "/phenomena/gaseous-flames?tab=cfig&test={test_id}#cfig-lookup",
    },
    "flame_design": {
        "inv": "PSI-10", "p13": "fd_conditions", "domain": "gaseous", "title": "ACME Flame Design test conditions",
        "level": "conditions", "badge": "Experimental conditions only",
        "note": "Conditions as listed in the PSI-10 tables. Flame outcomes are not in the NASA download, so none are shown.",
        "columns": [C(("test_id", "Test", None, "text", "id")), C(("configuration", "Configuration", None, "cat", "condition")),
                    C(("fuel", "Fuel", None, "cat", "condition")),
                    C(("x_o2", "O₂ mole fraction (ambient for normal; supplied for inverse)", None, "num", "derived")),
                    C(("p_ref_atm", "Pressure", "atm", "num", "condition")), C(("m_total_mg_s", "Total flow", "mg/s", "num", "condition")),
                    C(("zst", "Stoichiometric mixture fraction Zst", None, "num", "derived")), C(("tad_k", "Adiabatic flame temperature", "K", "num", "derived")),
                    C(("flow_marker", "Flow marker (e.g. RAMP)", None, "cat", "condition")), C(("date", "Date", None, "text", "log"))],
        "key": ["test_id", "configuration", "fuel", "x_o2", "p_ref_atm", "m_total_mg_s"],
        "filters": {"cats": ["configuration", "fuel"], "nums": ["x_o2", "p_ref_atm"]},
        "compare_within": "configuration",
        "links": [("Flame Design conditions chart", "/phenomena/gaseous-flames?tab=flame-design")],
    },
    "bre": {
        "inv": "PSI-20", "p13": "bre_test_days", "domain": "gaseous", "title": "ACME BRE test days",
        "level": "day_summary", "badge": "Day-level summary — not individual flame tests",
        "note": "Final report Table 1: one row per test day, with the number of flames ignited that day. The individual "
                "flames are not in the download and are not reconstructed.",
        "columns": [C(("test_id", "Test day", None, "text", "id")), C(("date", "Date", None, "text", "log")), C(("round", "Round", None, "cat", "log")),
                    C(("burner_mm", "Burner", "mm", "cat", "condition")), C(("fuel", "Fuel", None, "cat", "condition")),
                    C(("fuel_bottle", "Fuel bottle", None, "text", "condition")), C(("o2_pct", "Nominal O₂ levels", "%", "text", "condition")),
                    C(("flames_ignited", "Flames ignited that day", None, "num", "log"))],
        "key": ["test_id", "date", "burner_mm", "fuel", "o2_pct", "flames_ignited"],
        "filters": {"cats": ["fuel", "burner_mm", "round"], "nums": []},
        "compare_within": None,
        "links": [("BRE day log and results", "/phenomena/gaseous-flames?tab=bre")],
    },
    "same_log": {
        "inv": "PSI-102", "p13": "same_flight_log", "domain": "smoke", "title": "SAME flight-test log",
        "level": "log", "badge": "Operational log (what was run)",
        "note": "Final Science Report Appendix A (p.33): 47 tests and 4 operations. The log has no per-test particle sizes "
                "and is not joined row-by-row to the size table.",
        "columns": [C(("test_number", "Test", None, "num", "id")), C(("kind", "Entry", None, "cat", "log")), C(("sample", "Sample", None, "cat", "condition")),
                    C(("reheat", "Reheat", None, "bool", "condition")), C(("carousel", "Carousel", None, "cat", "log")), C(("position", "Position", None, "num", "log")),
                    C(("gmt_day", "GMT day", None, "num", "log")), C(("record_time_printed", "Record time (as printed)", None, "text", "log")),
                    C(("comment", "Comment", None, "text", "log"))],
        "key": ["test_number", "kind", "sample", "reheat", "carousel", "gmt_day", "record_time_printed"],
        "filters": {"cats": ["sample", "kind"], "nums": ["gmt_day"]},
        "compare_within": None,
        "links": [("Flight log", "/phenomena/smoke-detection#log")],
    },
    "same_sizes": {
        "inv": "PSI-102", "p13": "same_particle_sizes", "domain": "smoke", "title": "SAME particle sizes (Table 1)",
        "level": "derived", "badge": "Report-derived measurements",
        "note": "Final Science Report Table 1 (p.27): moment-method statistics with a log-normal assumption, fresh and "
                "aged 720 s, for four materials.",
        "columns": [C(("material_label", "Material", None, "text", "id")), C(("material", "Material key", None, "cat", "condition")),
                    C(("aged", "Aged", None, "bool", "condition")), C(("aging_s", "Aging", "s", "num", "condition")),
                    C(("dg_nm", "Geometric mean diameter", "nm", "num", "outcome")), C(("d10_nm", "Arithmetic mean diameter", "nm", "num", "outcome")),
                    C(("d30_nm", "Diameter of average mass", "nm", "num", "outcome")), C(("sigma_g", "Geometric std. deviation", None, "num", "outcome")),
                    C(("flight", "Flight", None, "text", "log"))],
        "key": ["material_label", "aged", "dg_nm", "d10_nm", "d30_nm", "sigma_g"],
        "filters": {"cats": ["material", "aged"], "nums": []},
        "compare_within": None,
        "links": [("Particle-size charts", "/phenomena/smoke-detection#sizes"), ("Smoke Detection Studio", "/phenomena/smoke-detection#studio")],
    },
    "psi117": {
        "inv": "PSI-117", "p13": "psi117_series", "domain": "droplet", "title": "PSI-117 figure-data series",
        "level": "figure", "badge": "Published figure data — series, not tests",
        "note": "Each row is one plotted series from the PSI-117 analysed data: experimental points (digitized) or 1-D "
                "model curves. Points are not independent tests and are not joined to FLEX rows.",
        "columns": [C(("series_id", "Series", None, "text", "id")), C(("figure", "Figure", None, "cat", "id")), C(("role", "Role", None, "cat", "condition")),
                    C(("fuel", "Fuel", None, "cat", "condition")), C(("label", "Label", None, "text", "id")),
                    C(("x_var", "x variable", None, "text", "condition")), C(("x_unit", "x unit", None, "text", "condition")),
                    C(("y_var", "y variable", None, "cat", "outcome")), C(("y_unit", "y unit", None, "text", "outcome")),
                    C(("y_unit_status", "y unit status", None, "cat", "derived")), C(("n", "Points", None, "num", "derived"))],
        "key": ["series_id", "figure", "role", "fuel", "y_var", "y_unit", "n"],
        "filters": {"cats": ["fuel", "role", "y_var", "figure"], "nums": []},
        "compare_within": False,
        "links": [("PSI-117 model vs experiment charts", "/phenomena/flame-extinction#psi117-explore")],
    },
    "flex2": {
        "inv": "PSI-68", "p13": "flex2_envelope", "domain": "droplet", "title": "FLEX-2 planned test matrix",
        "level": "plan", "badge": "No downloaded per-test outcomes",
        "note": "The PSI-68 experimental table lists the planned envelope of each fuel (ranges as printed). It is a test "
                "plan, not results.",
        "columns": [C(("Sample (Fuel Type)", "Fuel", None, "cat", "condition")), C(("Initial Droplet Diameter (mm)", "Initial diameter (mm, as printed)", None, "text", "condition")),
                    C(("Ambient Gas Mixture", "Ambient gas", None, "text", "condition")), C(("Oxygen Mole Fraction", "O₂ mole fraction (as printed)", None, "text", "condition")),
                    C(("Ambient Pressure (atm)", "Pressure (atm, as printed)", None, "text", "condition")),
                    C(("Ambient Temperature (C)", "Temperature (°C)", None, "text", "condition")),
                    C(("Flow Velocity (cm/s)", "Flow velocity (cm/s, as printed)", None, "text", "condition"))],
        "key": ["Sample (Fuel Type)", "Initial Droplet Diameter (mm)", "Oxygen Mole Fraction", "Ambient Pressure (atm)", "Flow Velocity (cm/s)"],
        "filters": {"cats": ["Sample (Fuel Type)"], "nums": []},
        "compare_within": False,
        "links": [("FLEX-2 context on the FLEX page", "/phenomena/flame-extinction#flex2")],
    },
}
ORIGINAL = {"flex": ("PSI-69", "droplet", "FLEX test records", "measured", "Measured test outcomes"),
            "bass2": ("PSI-25", "solid", "BASS-II test records", "measured", "Measured runs (report-backed spread rates)"),
            "saffire1": ("PSI-98", "spacecraft", "SAFFIRE-I burns", "measured", "Measured spacecraft-scale burns")}
DOMAINS = [
    {"id": "droplet", "title": "Liquid Droplet Combustion", "scenario": "droplet-extinction",
     "summary": "Single fuel droplets burning and going out in microgravity.",
     "collections": [("dataset", "flex"), ("dataset", "psi117"), ("dataset", "flex2")]},
    {"id": "gaseous", "title": "Gaseous Flame Dynamics", "scenario": "gaseous-flames",
     "summary": "Spherical gas flames on porous burners: ignition, extinction, cool flames.",
     "collections": [("dataset", "cfig"), ("dataset", "flame_design"), ("dataset", "bre")]},
    {"id": "solid", "title": "Solid Flame Spread", "scenario": "flame-spread",
     "summary": "Flames creeping over PMMA, fabrics and other solids in slow airflow.",
     "collections": [("dataset", "bass2"), ("profile", "psi62")]},
    {"id": "smoke", "title": "Smoke & Fire Detection", "scenario": "smoke-detection",
     "summary": "Smoke particles from overheated spacecraft materials, fresh and aged.",
     "collections": [("dataset", "same_log"), ("dataset", "same_sizes")]},
    {"id": "spacecraft", "title": "Spacecraft Fire Dynamics", "scenario": "flame-spread",
     "summary": "A large fabric fire inside an uncrewed Cygnus spacecraft.",
     "collections": [("dataset", "saffire1")]},
]
PROFILE_INV = {"psi62": "PSI-62"}   # metadata-only investigations shown as a profile (collection key -> PSI id)
LEVEL_LABEL = {"measured": "Measured", "derived": "Report-derived", "conditions": "Conditions only", "day_summary": "Day-level summary",
               "log": "Operational log", "figure": "Figure data", "plan": "Test plan only", "metadata": "Metadata only"}


def _short(conn) -> dict[str, str]:
    return {r[0]: jloads(r[1], {}).get("short_name") or r[0] for r in conn.execute(
        "SELECT investigation_id, registry_json FROM investigation_registry")}


def _values(ds_key: str, v: dict) -> dict:
    """Display values: the record's own fields plus the few derived ones (each documented in the column label)."""
    out = dict(v)
    if ds_key == "cfig":
        out["test_id"] = v.get("test_id_raw", "").replace(" ", "")
        out["x_o2"] = v.get("x_o2_before") if v.get("configuration") == "normal" else v.get("x_o2_supply")
    elif ds_key == "flame_design":
        out["x_o2"] = v.get("x_o2_init") if v.get("configuration") == "normal" else v.get("x_o2_supply")
    elif ds_key == "psi117":
        out["fuel"] = (v.get("conditions") or {}).get("fuel")
        out.pop("x", None)
        out.pop("y", None)
        out.pop("flagged_points", None)
    return out


def _records(conn, ds_key: str) -> list[dict]:
    spec = DATASETS[ds_key]
    rows = []
    for r in conn.execute("SELECT * FROM p13_records WHERE dataset_id=? ORDER BY rowid", (spec["p13"],)):
        v = _values(ds_key, jloads(r["values_json"], {}))
        if r["test_id"] and not v.get("test_id"):
            v["test_id"] = r["test_id"]
        rows.append({"record_id": r["record_id"], "test_id": r["test_id"] or v.get("test_id") or v.get("series_id"),
                     "values": v, "flags": jloads(r["flags_json"], []), "source_file": r["source_file"],
                     "source_table": r["source_table"], "page_pdf": r["page_pdf"], "source_row": r["source_row"],
                     "verification": r["verification"]})
    return rows


def _num(x):
    return x if isinstance(x, (int, float)) and not isinstance(x, bool) and not math.isnan(x) else None


def domains(conn: sqlite3.Connection) -> dict:
    short = _short(conn)
    counts = {k: conn.execute("SELECT count(*) FROM experiments e JOIN investigations i USING(investigation_id) "
                              "WHERE i.key=? AND e.experiment_kind='burn'", (k,)).fetchone()[0] for k in ORIGINAL}
    out = []
    for d in DOMAINS:
        cols = []
        for kind, key in d["collections"]:
            if kind == "profile":
                inv = PROFILE_INV[key]
                cols.append({"kind": "profile", "key": key, "investigation_id": inv, "short_name": short.get(inv, inv),
                             "title": f"{short.get(inv, inv)} investigation profile", "level": "metadata",
                             "level_label": LEVEL_LABEL["metadata"], "badge": "Metadata only", "records": 0})
            elif key in ORIGINAL:
                inv, _, title, level, badge = ORIGINAL[key]
                cols.append({"kind": "dataset", "key": key, "investigation_id": inv, "short_name": short.get(inv, inv), "title": title,
                             "level": level, "level_label": LEVEL_LABEL[level], "badge": badge, "records": counts[key], "original": True})
            else:
                s = DATASETS[key]
                n = conn.execute("SELECT count(*) FROM p13_records WHERE dataset_id=?", (s["p13"],)).fetchone()[0]
                cols.append({"kind": "dataset", "key": key, "investigation_id": s["inv"], "short_name": short.get(s["inv"], s["inv"]),
                             "title": s["title"], "level": s["level"], "level_label": LEVEL_LABEL[s["level"]], "badge": s["badge"],
                             "records": n, "original": False})
        out.append({**{k: d[k] for k in ("id", "title", "scenario", "summary")}, "collections": cols,
                    "investigations": sorted({c["investigation_id"] for c in cols})})
    return {"domains": out, "investigations": len({i for d in out for i in d["investigations"]})}


def _spec(ds_key: str) -> dict:
    if ds_key not in DATASETS:
        raise not_found("Collection", ds_key)
    return DATASETS[ds_key]


def _facets(spec: dict, rows: list[dict]) -> dict:
    f: dict = {}
    for c in spec["filters"]["cats"]:
        cnt = Counter(str(r["values"].get(c)) for r in rows if r["values"].get(c) not in (None, ""))
        f[c] = [{"value": k, "count": n} for k, n in sorted(cnt.items(), key=lambda kv: (-kv[1], kv[0]))]
    for c in spec["filters"]["nums"]:
        vals = [x for r in rows if (x := _num(r["values"].get(c))) is not None]
        f[c] = {"min": min(vals) if vals else None, "max": max(vals) if vals else None, "n": len(vals), "missing": len(rows) - len(vals)}
    return f


def browse(conn: sqlite3.Connection, ds_key: str, params: dict[str, str]) -> dict:
    spec = _spec(ds_key)
    rows = _records(conn, ds_key)
    facets = _facets(spec, rows)
    applied: dict = {}
    for c in spec["filters"]["cats"]:
        v = params.get(f"f_{c}")
        if v:
            allowed = {o["value"] for o in facets[c]}
            if v not in allowed:
                raise bad_request(f"Unknown value '{v}' for {c}. Allowed: {', '.join(sorted(allowed))[:300]}")
            rows = [r for r in rows if str(r["values"].get(c)) == v]
            applied[c] = v
    excluded_missing = 0
    for c in spec["filters"]["nums"]:
        lo, hi = params.get(f"min_{c}"), params.get(f"max_{c}")
        if lo in (None, "") and hi in (None, ""):
            continue
        try:
            lo_f = float(lo) if lo not in (None, "") else None
            hi_f = float(hi) if hi not in (None, "") else None
        except ValueError:
            raise bad_request(f"min_{c}/max_{c} must be numbers")
        before = len(rows)
        has = [r for r in rows if _num(r["values"].get(c)) is not None]
        excluded_missing += before - len(has)       # records without the value are excluded, and counted
        rows = [r for r in has if (lo_f is None or r["values"][c] >= lo_f) and (hi_f is None or r["values"][c] <= hi_f)]
        applied[c] = [lo_f, hi_f]
    q = (params.get("q") or "").strip().lower()
    if q:
        rows = [r for r in rows if q in " ".join(str(v) for k, v in r["values"].items() if isinstance(v, (str, int, float))).lower()
                or q in r["record_id"].lower()]
    sort = params.get("sort")
    if sort and sort in {c[0] for c in spec["columns"]}:
        has = [r for r in rows if r["values"].get(sort) is not None]
        has.sort(key=lambda r: (0, r["values"][sort], "") if _num(r["values"][sort]) is not None else (1, 0, str(r["values"][sort])),
                 reverse=params.get("order") == "desc")
        rows = has + [r for r in rows if r["values"].get(sort) is None]      # missing values always last
    try:
        page = max(1, int(params.get("page") or 1))
        size = min(100, max(5, int(params.get("page_size") or 25)))
    except ValueError:
        raise bad_request("page and page_size must be integers")
    total = len(rows)
    items = rows[(page - 1) * size: page * size]
    return {"key": ds_key, "investigation_id": spec["inv"], "title": spec["title"], "level": spec["level"],
            "level_label": LEVEL_LABEL[spec["level"]], "badge": spec["badge"], "note": spec["note"], "domain": spec["domain"],
            "columns": [{"field": c[0], "label": c[1], "unit": c[2], "kind": c[3], "role": c[4]} for c in spec["columns"]],
            "key_columns": spec["key"], "filters": spec["filters"], "facets": facets, "applied": applied,
            "excluded_missing": excluded_missing, "total": total, "page": page, "pages": max(1, math.ceil(total / size)),
            "items": [{k: r[k] for k in ("record_id", "test_id", "values", "flags", "page_pdf", "source_row")} for r in items],
            "comparison": {"allowed": spec["compare_within"] is not False,
                           "within": spec["compare_within"] if isinstance(spec["compare_within"], str) else None,
                           "reason": None if spec["compare_within"] is not False else
                           ("Figure-data series are not tests: compare them on the PSI-117 charts instead." if ds_key == "psi117"
                            else "This is a test plan, not results: there is nothing measured to compare.")},
            "links": [{"label": a, "href": b} for a, b in spec["links"]]}


def record(conn: sqlite3.Connection, record_id: str) -> dict:
    row = conn.execute("SELECT * FROM p13_records WHERE record_id=?", (record_id,)).fetchone()
    if not row:
        raise not_found("Record", record_id)
    ds_key = next((k for k, s in DATASETS.items() if s["p13"] == row["dataset_id"]), None)
    if not ds_key:
        raise not_found("Record", record_id)
    spec = DATASETS[ds_key]
    v = _values(ds_key, jloads(row["values_json"], {}))
    if row["test_id"] and not v.get("test_id"):
        v["test_id"] = row["test_id"]
    flags = {f["rule_id"]: f for f in (dict(x) for x in conn.execute(
        "SELECT rule_id, severity, description, status FROM quality_flags WHERE investigation_id=?", (spec["inv"],)))}
    doc = conn.execute("SELECT document_id FROM documents WHERE relative_path=?", (row["source_file"],)).fetchone()
    node = conn.execute("SELECT node_id FROM kg_nodes WHERE json_extract(props_json,'$.record_id')=? OR node_id IN (?,?,?)",
                        (record_id, f"exp:{record_id}", f"meas:{record_id}", f"model:{record_id}")).fetchone()
    ev = kg.evidence_for(conn, node[0]) if node else None
    link = spec.get("record_link")
    test_id = (v.get("test_id") or row["test_id"] or "")
    return {
        "record_id": record_id, "dataset": ds_key, "dataset_title": spec["title"], "investigation_id": spec["inv"],
        "level": spec["level"], "level_label": LEVEL_LABEL[spec["level"]], "badge": spec["badge"], "note": spec["note"],
        "test_id": test_id,
        "fields": [{"field": c[0], "label": c[1], "unit": c[2], "role": c[4], "value": v.get(c[0])} for c in spec["columns"]],
        "raw": jloads(row["raw_json"], {}),
        "provenance": {"source_file": row["source_file"], "source_table": row["source_table"], "page_pdf": row["page_pdf"],
                       "source_row": row["source_row"], "verification": row["verification"],
                       "document_id": doc[0] if doc else None},
        "flags": [{"rule_id": f, "severity": flags.get(f, {}).get("severity"), "description": flags.get(f, {}).get("description")}
                  for f in jloads(row["flags_json"], [])],
        "graph": {"node_id": node[0], "sources": ev["sources"][:8]} if ev else None,
        "links": [{"label": a, "href": b} for a, b in spec["links"]] + ([{"label": "Open this test on the analysis page",
                                                                           "href": link.format(test_id=test_id)}] if link and test_id else []),
    }


def compare(conn: sqlite3.Connection, record_ids: list[str]) -> dict:
    """2-5 records of the same collection (and the same configuration where flames are normal/inverse). Anything else is
    refused with the reason: e.g. FLEX burning rate vs CFI-G burn time, BRE days vs BASS-II spread rates."""
    if not 2 <= len(record_ids) <= 5:
        raise bad_request("Select 2 to 5 records to compare.")
    recs = [record(conn, rid) for rid in record_ids]
    keys = {r["dataset"] for r in recs}
    if len(keys) > 1:
        return {"compatible": False, "reason": "These records come from different collections, which measure different "
                "quantities under different definitions. Compare records within one collection."}
    key = keys.pop()
    spec = DATASETS[key]
    if spec["compare_within"] is False:
        return {"compatible": False, "reason": browse(conn, key, {})["comparison"]["reason"]}
    if isinstance(spec["compare_within"], str):
        vals = {next(f["value"] for f in r["fields"] if f["field"] == spec["compare_within"]) for r in recs}
        if len(vals) > 1:
            return {"compatible": False, "reason": "Normal and inverse flames are different configurations (which reactant "
                    "leaves the burner, and what O₂ means). Compare normal with normal, or inverse with inverse."}
    cols = [c for c in spec["columns"]]
    return {"compatible": True, "dataset": key, "level_label": LEVEL_LABEL[spec["level"]],
            "records": [{"record_id": r["record_id"], "test_id": r["test_id"]} for r in recs],
            "rows": [{"field": c[0], "label": c[1], "unit": c[2], "role": c[4],
                      "values": [next(f["value"] for f in r["fields"] if f["field"] == c[0]) for r in recs]} for c in cols],
            "note": spec["note"]}


def profile(conn: sqlite3.Connection, inv: str) -> dict:
    r = conn.execute("SELECT registry_json FROM investigation_registry WHERE investigation_id=?", (inv,)).fetchone()
    if not r:
        raise not_found("Investigation", inv)
    reg = jloads(r[0], {})
    docs = [dict(x) for x in conn.execute("SELECT document_id, title, doc_type, page_count FROM documents WHERE investigation_id=? "
                                          "ORDER BY doc_type='metadata', title", (inv,))]
    pubs = [dict(x) for x in conn.execute("SELECT title, authors, doi, status FROM investigation_publications WHERE investigation_id=? "
                                          "LIMIT 12", (inv,))]
    studies = kg.investigation_profile(conn, inv)["studies"] if kg.available(conn) else []
    rel = list({r["investigation_id"]: r for r in (kg.related(conn, inv)["documented"] if kg.available(conn) else [])}.values())
    cols = [{"key": k, "title": s["title"], "badge": s["badge"]} for k, s in DATASETS.items() if s["inv"] == inv]
    cols += [{"key": k, "title": t, "badge": b} for k, (i, _, t, _, b) in ORIGINAL.items() if i == inv]
    domain = next((d for d in DOMAINS if any(c[1] in [x["key"] for x in cols] or PROFILE_INV.get(c[1]) == inv for c in d["collections"])), None)
    return {"investigation_id": inv, "short_name": reg.get("short_name"), "title": reg.get("title"), "doi": reg.get("doi"),
            "psi_url": reg.get("psi_url"), "platform": reg.get("platform"), "objective": reg.get("objective"),
            "readiness": reg.get("readiness"), "readiness_label": reg.get("readiness_label"),
            "limitations": reg.get("limitations", []), "related": rel, "studies": studies, "documents": docs,
            "publications": pubs, "publication_count": reg.get("publications"), "collections": cols,
            "domain": domain["id"] if domain else None, "scenario": domain["scenario"] if domain else None,
            "route": reg.get("route")}

"""Phase 13 read API: investigation registry, gaseous flames (ACME CFI-G / Flame Design / BRE), SAME smoke detection
and PSI-117 figure data. All numbers come from p13_records (loaded from the verified curated JSON); every aggregate
is computed here from those records, never typed in by hand.
"""
from __future__ import annotations

import sqlite3
import statistics
from collections import Counter, defaultdict

from ..core.errors import not_found
from ..db.database import jloads

OUTCOME_ORDER = ["self_extinguished", "flow_terminated", "flash_self_extinguished", "no_hot_ignition_flow_terminated",
                 "not_ignited"]
OUTCOME_LABEL = {"self_extinguished": "Self-extinguished (SE)", "flow_terminated": "Flow terminated (FT, censored)",
                 "flash_self_extinguished": "Flash, then SE", "no_hot_ignition_flow_terminated": "No hot ignition, FT",
                 "not_ignited": "Not ignited"}
FUEL_ORDER = ["ethane", "propane", "n-butane"]


def _records(conn: sqlite3.Connection, dataset: str) -> list[dict]:
    out = []
    for r in conn.execute("SELECT * FROM p13_records WHERE dataset_id=? ORDER BY rowid", (dataset,)):
        d = dict(r)
        d["values"] = jloads(d.pop("values_json"), {})
        d["raw"] = jloads(d.pop("raw_json"), {})
        d["flags"] = jloads(d.pop("flags_json"), [])
        out.append(d)
    return out


def _meta(conn: sqlite3.Connection, dataset: str) -> dict:
    r = conn.execute("SELECT * FROM p13_datasets WHERE dataset_id=?", (dataset,)).fetchone()
    if not r:
        raise not_found("Dataset", dataset)
    m = jloads(r["meta_json"], {})
    return {"dataset_id": dataset, "title": r["title"], "investigation_id": r["investigation_id"],
            "evidence_class": r["evidence_class"], **m}


def _flags(conn: sqlite3.Connection, investigation: str) -> list[dict]:
    return [dict(r) for r in conn.execute(
        "SELECT rule_id, category, severity, description, raw_field, raw_value, evidence_ref, status FROM quality_flags "
        "WHERE investigation_id=? ORDER BY severity='info', rule_id", (investigation,))]


def _flag_rules(flags: list[dict]) -> list[dict]:
    by: dict[str, dict] = {}
    for f in flags:
        e = by.setdefault(f["rule_id"], {"rule_id": f["rule_id"], "severity": f["severity"], "category": f["category"],
                                         "status": f["status"], "n": 0, "example": f["description"]})
        e["n"] += 1
    return sorted(by.values(), key=lambda e: ({"critical": 0, "warning": 1}.get(e["severity"], 2), -e["n"]))


# ------------------------------------------------------------------------------------------------ registry -------
def registry(conn: sqlite3.Connection) -> dict:
    items = []
    for r in conn.execute("SELECT * FROM investigation_registry"):
        v = jloads(r["registry_json"], {})
        inv = v["investigation_id"]
        v["documents_indexed"] = conn.execute("SELECT count(*) FROM documents WHERE investigation_id=?", (inv,)).fetchone()[0]
        v["publications"] = conn.execute("SELECT count(*) FROM investigation_publications WHERE investigation_id=?",
                                         (inv,)).fetchone()[0]
        v["quality_flags"] = conn.execute("SELECT count(*) FROM quality_flags WHERE investigation_id=?", (inv,)).fetchone()[0]
        exp = conn.execute("SELECT count(*) FROM experiments WHERE investigation_id=?", (inv,)).fetchone()[0]
        p13 = {d: conn.execute("SELECT count(*) FROM p13_records WHERE dataset_id=?", (d,)).fetchone()[0]
               for d in v["datasets"] if d.startswith(("cfig", "fd_", "bre", "same", "psi117", "flex2"))}
        v["completeness"] = {
            "per_test_records": exp or p13.get("cfig_tests", 0),
            "per_test_outcomes": inv in ("PSI-69", "PSI-25", "PSI-98", "PSI-159"),
            "test_conditions": inv in ("PSI-69", "PSI-25", "PSI-98", "PSI-159", "PSI-10", "PSI-68"),
            "curated_report_tables": sum(n for d, n in p13.items() if d in ("cfig_cool_flames", "cfig_test_days",
                                         "fd_test_days", "bre_test_days", "bre_literature", "same_particle_sizes",
                                         "same_flight_log")),
            "figure_series": p13.get("psi117_series", 0),
            "telemetry_processed": False if inv == "PSI-102" else None,
            "dataset_records": p13,
        }
        items.append(v)
    order = ["PSI-69", "PSI-25", "PSI-98", "PSI-159", "PSI-10", "PSI-20", "PSI-102", "PSI-117", "PSI-68", "PSI-62"]
    items.sort(key=lambda x: order.index(x["investigation_id"]) if x["investigation_id"] in order else 99)
    meta = _meta(conn, "investigation_registry") if items else {}
    return {"items": items, "scenarios": meta.get("extra", {}).get("scenarios", {}),
            "readiness": meta.get("extra", {}).get("readiness", {})}


def datasets(conn: sqlite3.Connection) -> dict:
    out = []
    for r in conn.execute("SELECT * FROM p13_datasets ORDER BY investigation_id, dataset_id"):
        m = jloads(r["meta_json"], {})
        out.append({"dataset_id": r["dataset_id"], "investigation_id": r["investigation_id"], "title": r["title"],
                    "evidence_class": r["evidence_class"], "counts": m.get("counts"), "sources": m.get("sources"),
                    "notes": m.get("notes"), "processor_version": m.get("processor_version")})
    return {"items": out}


# --------------------------------------------------------------------------------------------- CFI-G ------------
def _o2(v: dict) -> float | None:
    return v.get("x_o2_before") if v["configuration"] == "normal" else v.get("x_o2_supply")


def _match(v: dict, f: dict) -> bool:
    if f.get("configuration") and v["configuration"] != f["configuration"]:
        return False
    if f.get("fuel") and v["fuel_species"] != f["fuel"]:
        return False
    if f.get("p_bar") is not None and (v["p_bar"] is None or abs(v["p_bar"] - f["p_bar"]) > 0.06):
        return False
    o2 = _o2(v)
    if f.get("o2_min") is not None and (o2 is None or o2 < f["o2_min"]):
        return False
    if f.get("o2_max") is not None and (o2 is None or o2 > f["o2_max"]):
        return False
    if f.get("outcome") and v["outcome"] != f["outcome"]:
        return False
    return True


def _o2_band(x: float | None) -> str:
    if x is None:
        return "unknown"
    for lo, hi, lab in ((0, 0.195, "< 0.195"), (0.195, 0.25, "0.195–0.25"), (0.25, 0.35, "0.25–0.35"),
                        (0.35, 0.5, "0.35–0.5"), (0.5, 1.01, "≥ 0.5")):
        if lo <= x < hi:
            return lab
    return "unknown"


def _q(xs: list[float]) -> dict:
    if not xs:
        return {"n": 0}
    xs = sorted(xs)
    qs = statistics.quantiles(xs, n=4) if len(xs) >= 4 else [xs[0], statistics.median(xs), xs[-1]]
    return {"n": len(xs), "min": xs[0], "q1": qs[0], "median": statistics.median(xs), "q3": qs[-1], "max": xs[-1]}


def cfig(conn: sqlite3.Connection, f: dict) -> dict:
    recs = _records(conn, "cfig_tests")
    rows = [r for r in recs if _match(r["values"], f)]
    by_fuel: dict[tuple, Counter] = defaultdict(Counter)
    by_cond: dict[tuple, Counter] = defaultdict(Counter)
    burn: dict[tuple, list] = defaultdict(list)
    censored: dict[tuple, list] = defaultdict(list)
    for r in rows:
        v = r["values"]
        by_fuel[(v["configuration"], v["fuel_species"])][v["outcome"]] += 1
        by_cond[(v["configuration"], _o2_band(_o2(v)), v["p_bar"])][v["outcome"]] += 1
        if v["outcome"] in ("self_extinguished", "flash_self_extinguished") and v["burn_time_s"] is not None:
            burn[(v["configuration"], v["fuel_species"])].append(v["burn_time_s"])
        if v["outcome"] == "flow_terminated" and v["burn_time_s"] is not None:
            censored[(v["configuration"], v["fuel_species"])].append(v["burn_time_s"])
    facets = {
        "configuration": dict(Counter(r["values"]["configuration"] for r in recs)),
        "fuel": dict(Counter(r["values"]["fuel_species"] for r in recs)),
        "p_bar": sorted({round(r["values"]["p_bar"], 2) for r in recs if r["values"]["p_bar"] is not None}),
        "outcome": dict(Counter(r["values"]["outcome"] for r in recs)),
    }
    tests = [{"record_id": r["record_id"], "test_id": r["test_id"], "configuration": r["values"]["configuration"],
              "fuel": r["values"]["fuel_species"], "fuel_raw": r["values"]["fuel_raw"], "x_o2": _o2(r["values"]),
              "p_bar": r["values"]["p_bar"], "flow_mg_s": r["values"].get("m_fuel_mg_s") or r["values"].get("m_o2_mg_s"),
              "outcome": r["values"]["outcome"], "burn_time_s": r["values"]["burn_time_s"],
              "censored": r["values"]["burn_time_censored"], "cool_flame": r["values"].get("cool_flame"),
              "flags": r["flags"], "date": r["values"]["date"]} for r in rows]
    days = _records(conn, "cfig_test_days")
    cool = _records(conn, "cfig_cool_flames")
    meta = _meta(conn, "cfig_tests")
    days_meta = _meta(conn, "cfig_test_days")
    return {
        "filters": f, "n_total": len(recs), "n_matching": len(rows), "facets": facets,
        "outcome_labels": OUTCOME_LABEL, "outcome_order": OUTCOME_ORDER,
        "outcome_definitions": meta["extra"].get("outcome_definitions", {}),
        "by_fuel": [{"configuration": c, "fuel": fu, "n": sum(cn.values()), "outcomes": dict(cn)}
                    for (c, fu), cn in sorted(by_fuel.items(), key=lambda k: (k[0][0], FUEL_ORDER.index(k[0][1])))],
        "by_condition": [{"configuration": c, "o2_band": b, "p_bar": p, "n": sum(cn.values()), "outcomes": dict(cn)}
                         for (c, b, p), cn in sorted(by_cond.items(), key=lambda k: (k[0][0], k[0][1], k[0][2] or 0))],
        "burn_time_se": [{"configuration": c, "fuel": fu, **_q(xs), "values": sorted(xs)} for (c, fu), xs in
                         sorted(burn.items(), key=lambda k: (k[0][0], FUEL_ORDER.index(k[0][1])))],
        "burn_time_censored": [{"configuration": c, "fuel": fu, **_q(xs), "values": sorted(xs)} for (c, fu), xs in
                               sorted(censored.items(), key=lambda k: (k[0][0], FUEL_ORDER.index(k[0][1])))],
        "tests": tests,
        "cool_flames": [{"record_id": r["record_id"], "test_id": r["test_id"], **r["values"], "page_pdf": r["page_pdf"],
                         "verification": r["verification"], "flags": r["flags"]} for r in cool],
        "cool_flame_cross_check": _meta(conn, "cfig_cool_flames")["extra"].get("cross_check"),
        "test_days": [{**r["values"], "page_pdf": r["page_pdf"], "verification": r["verification"]} for r in days],
        "report_totals": days_meta["extra"].get("report_totals"),
        "notes": meta["notes"], "field_specs": meta["field_specs"], "sources": meta["sources"],
        "flag_rules": _flag_rules(_flags(conn, "PSI-159")),
        "report_document": {"document_id": "psi-159-reports-finalrpt-acme-cfi-g",
                            "pages": {"table1": 21, "table2": 22, "findings": 44, "table3": 46}},
    }


def cfig_test(conn: sqlite3.Connection, test_id: str) -> dict:
    rows = [dict(r) for r in conn.execute("SELECT * FROM p13_records WHERE dataset_id IN ('cfig_tests','cfig_cool_flames') "
                                          "AND test_id=?", (test_id.replace(" ", ""),))]
    if not rows:
        raise not_found("CFI-G test", test_id)
    out = []
    flags = {f["rule_id"]: f for f in _flags(conn, "PSI-159")}
    for r in rows:
        out.append({"record_id": r["record_id"], "dataset_id": r["dataset_id"], "source_file": r["source_file"],
                    "source_table": r["source_table"], "page_pdf": r["page_pdf"], "source_row": r["source_row"],
                    "verification": r["verification"], "values": jloads(r["values_json"], {}),
                    "raw": jloads(r["raw_json"], {}),
                    "flags": [{"rule_id": x, "severity": flags.get(x, {}).get("severity")} for x in jloads(r["flags_json"], [])]})
    return {"test_id": test_id.replace(" ", ""), "records": out}


# -------------------------------------------------------------------------------------------- Flame Design -------
def flame_design(conn: sqlite3.Connection) -> dict:
    recs = _records(conn, "fd_conditions")
    pts, excluded = [], Counter()
    for r in recs:
        v = r["values"]
        if v["flow_marker"]:
            excluded[v["flow_marker"]] += 1
            continue
        if v["zst"] is None or v["tad_k"] is None:
            excluded["missing Zst/Tad"] += 1
            continue
        pts.append({"test_id": r["test_id"], "configuration": v["configuration"], "fuel": v["fuel"], "zst": v["zst"],
                    "tad_k": v["tad_k"], "p_atm": v["p_ref_atm"],
                    "x_o2": v.get("x_o2_init") if v["configuration"] == "normal" else v.get("x_o2_supply"),
                    "m_total_mg_s": v["m_total_mg_s"], "date": v["date"]})
    cf = []
    for r in _records(conn, "cfig_tests"):
        v = r["values"]
        if v["zst"] is None or v["tad_k"] is None:
            continue
        cf.append({"test_id": r["test_id"], "configuration": v["configuration"], "fuel": v["fuel_species"], "zst": v["zst"],
                   "tad_k": v["tad_k"], "p_atm": v["p_atm"], "x_o2": _o2(v)})
    days = _records(conn, "fd_test_days")
    dm = _meta(conn, "fd_test_days")
    meta = _meta(conn, "fd_conditions")
    return {"n_total": len(recs), "n_plotted": len(pts), "excluded": dict(excluded), "points": pts,
            "cfig_points": cf, "facets": {"configuration": dict(Counter(r["values"]["configuration"] for r in recs)),
                                          "fuel": dict(Counter(r["values"]["fuel"] for r in recs))},
            "test_days": [{**r["values"], "page_pdf": r["page_pdf"], "verification": r["verification"]} for r in days],
            "totals": dm["extra"].get("totals"), "findings": dm["extra"].get("findings", []),
            "notes": meta["notes"], "sources": meta["sources"], "flag_rules": _flag_rules(_flags(conn, "PSI-10")),
            "report_document": {"document_id": "psi-10-reports-finalrpt-acmeflamedesign"}}


# --------------------------------------------------------------------------------------------------- BRE ---------
def bre(conn: sqlite3.Connection) -> dict:
    days = _records(conn, "bre_test_days")
    lit = _records(conn, "bre_literature")
    dm = _meta(conn, "bre_test_days")
    flags = _flags(conn, "PSI-20")
    return {"test_days": [{**r["values"], "page_pdf": r["page_pdf"], "verification": r["verification"], "flags": r["flags"],
                           "csv": r["raw"].get("csv")} for r in days],
            "totals": dm["extra"].get("totals"), "findings": dm["extra"].get("findings", []),
            "literature": [{**r["values"], "page_pdf": r["page_pdf"], "verification": r["verification"]} for r in lit],
            "conflicts": [f for f in flags if f["rule_id"].startswith("BRE-CSV")], "notes": dm["notes"],
            "sources": dm["sources"], "report_document": {"document_id": "bre-final-report-20220201"}}


# --------------------------------------------------------------------------------------------------- SAME --------
def same(conn: sqlite3.Connection) -> dict:
    sizes = _records(conn, "same_particle_sizes")
    alt = _records(conn, "same_particle_sizes_other_sources")
    log = _records(conn, "same_flight_log")
    lm = _meta(conn, "same_flight_log")
    tm = _meta(conn, "same_telemetry_inventory")
    tele = _records(conn, "same_telemetry_inventory")
    return {"particle_sizes": [{**r["values"], "record_id": r["record_id"], "page_pdf": r["page_pdf"],
                                "verification": r["verification"]} for r in sizes],
            "other_sources": [{**r["values"], "record_id": r["record_id"], "page_pdf": r["page_pdf"],
                               "source_table": r["source_table"], "source_file": r["source_file"],
                               "verification": r["verification"]} for r in alt],
            "flight_log": [{**r["values"], "page_pdf": r["page_pdf"], "verification": r["verification"], "flags": r["flags"]}
                           for r in log],
            "log_summary": lm["extra"].get("summary"),
            "telemetry": {"workbooks": len(tele), "by_folder": dict(Counter(r["values"]["folder_label"] for r in tele)),
                          "status": "deferred", "reason": next((f["description"] for f in _flags(conn, "PSI-102")
                                                               if f["rule_id"] == "SAME-TELEMETRY-DEFERRED"), None),
                          "description": tm["description"]},
            "notes": _meta(conn, "same_particle_sizes")["notes"] + lm["notes"],
            "flag_rules": _flag_rules(_flags(conn, "PSI-102")),
            "report_document": {"document_id": "same-final-science-report-03-18-10-with-papers-attached",
                                "pages": {"table1": 27, "appendix_a": 33, "moment_method": 15, "conclusions": 28}}}


# -------------------------------------------------------------------------------------------------- PSI-117 ------
def psi117(conn: sqlite3.Connection, figure: str | None) -> dict:
    meta = _meta(conn, "psi117_series")
    figures = meta["extra"]["figures"]
    recs = _records(conn, "psi117_series")
    counts = Counter(r["values"]["figure"] for r in recs if r["values"]["figure"])
    figs = [{"id": k, **v, "n_series": counts.get(k, 0)} for k, v in figures.items()]
    if figure and figure not in figures:
        raise not_found("PSI-117 figure", figure)
    series = []
    if figure:
        for r in recs:
            v = r["values"]
            if v["figure"] != figure:
                continue
            series.append({"series_id": v["series_id"], "role": v["role"], "evidence_class": v["evidence_class"],
                           "label": v["label"], "x_var": v["x_var"], "x_unit": v["x_unit"], "x_unit_status": v["x_unit_status"],
                           "y_var": v["y_var"], "y_unit": v["y_unit"], "y_unit_status": v["y_unit_status"],
                           "y_unit_note": v["y_unit_note"], "x_unit_note": v["x_unit_note"], "note": v["note"],
                           "conditions": v["conditions"], "x": v["x"], "y": v["y"], "n": v["n"],
                           "flagged_points": v["flagged_points"], "source_file": r["source_file"],
                           "source_columns": r["source_table"], "flags": r["flags"], "role_basis": v["role_basis"]})
    excluded = [{"series_id": r["values"]["series_id"], "role": r["values"]["role"], "label": r["values"]["label"],
                 "reason": r["values"]["role_basis"] or r["values"]["note"], "n": r["values"]["n"]}
                for r in recs if not r["values"]["figure"]]
    return {"figures": figs, "figure": figure, "series": series, "excluded_series": excluded,
            "roles": meta["extra"]["roles"], "counts": meta["counts"], "notes": meta.get("notes", []),
            "flag_rules": _flag_rules(_flags(conn, "PSI-117"))}

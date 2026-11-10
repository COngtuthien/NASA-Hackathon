"""Deterministic scientific analytics. Every result reports n, filters, exclusions,
formula and assumptions; nothing is copied from the Markdown research reports.
"""
from __future__ import annotations

import hashlib
import json
import math
import sqlite3
import statistics as st
from typing import Any

from ..core.errors import bad_request, not_found
from .catalog import FLEX, BASS2

# ------------------------------------------------------------------ helpers --


def pearson(xs: list[float], ys: list[float]) -> float | None:
    n = len(xs)
    if n < 3:
        return None
    mx, my = sum(xs) / n, sum(ys) / n
    sxx = sum((x - mx) ** 2 for x in xs)
    syy = sum((y - my) ** 2 for y in ys)
    if sxx == 0 or syy == 0:
        return None
    return sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / math.sqrt(sxx * syy)


def slope_through_origin(xs: list[float], ys: list[float]) -> float | None:
    sxx = sum(x * x for x in xs)
    if sxx == 0:
        return None
    return sum(x * y for x, y in zip(xs, ys)) / sxx


def quantile(vals: list[float], q: float) -> float | None:
    if not vals:
        return None
    s = sorted(vals)
    pos = (len(s) - 1) * q
    lo, hi = math.floor(pos), math.ceil(pos)
    return s[lo] + (s[hi] - s[lo]) * (pos - lo)


def r4(v: float | None) -> float | None:
    return None if v is None else round(v, 4)


def record_run(conn: sqlite3.Connection, analysis_type: str, filters: dict, formula: str, result: dict, n: int) -> str:
    src = {r["relative_path"]: r["sha256"] for r in conn.execute(
        "SELECT relative_path, sha256 FROM source_files WHERE role='experiment_table' OR role='manifest'")}
    payload = json.dumps({"t": analysis_type, "f": filters, "s": src}, sort_keys=True)
    aid = f"{analysis_type}:{hashlib.sha256(payload.encode()).hexdigest()[:16]}"
    try:
        conn.execute("INSERT OR REPLACE INTO analysis_runs VALUES (?,?,?,?,?,?,?,datetime('now'))",
                     (aid, analysis_type, json.dumps(filters, sort_keys=True), formula,
                      json.dumps(result.get("summary", {}), default=str), n, json.dumps(src)))
        conn.commit()
    except sqlite3.OperationalError:
        pass  # read-only DB: analysis is still returned, just not persisted
    return aid


FLEX_FILTERS = ("fuel", "diluent", "pressure_band", "test_end")


def _flex_where(params: dict[str, str | None]) -> tuple[str, list, dict]:
    where, args, applied = [], [], {}
    for k in FLEX_FILTERS:
        v = params.get(k)
        if v:
            vals = [x for x in v.split("|") if x]
            where.append(f"{k} IN ({','.join('?' * len(vals))})")
            args += vals
            applied[k] = vals
    for k, col in (("o2_min", "x_o2"), ("o2_max", "x_o2")):
        v = params.get(k)
        if v not in (None, ""):
            try:
                fv = float(v)
            except ValueError:
                raise bad_request(f"{k} must be a number (mole fraction)")
            where.append(f"{col} {'>=' if k.endswith('min') else '<='} ?")
            args.append(fv)
            applied[k] = fv
    return ("WHERE " + " AND ".join(where)) if where else "", args, applied


# ------------------------------------------------------------------- FLEX ----


def flex_map(conn: sqlite3.Connection, params: dict[str, str | None]) -> dict:
    where, args, applied = _flex_where(params)
    rows = [dict(r) for r in conn.execute(f"SELECT * FROM flex_tests {where} ORDER BY test_number", args)]
    points, excluded = [], []
    for r in rows:
        if r["d0_mm"] is None:
            excluded.append({"experiment_uid": r["experiment_uid"], "identifier": r["identifier"],
                             "reason": f"D0 not numeric ({r['d0_kind']})"})
            continue
        ratio = None
        if r["dext_mm"] is not None and r["d0_mm"] > 0:
            ratio = r["dext_mm"] / r["d0_mm"]
        points.append({
            "experiment_uid": r["experiment_uid"], "identifier": r["identifier"], "fuel": r["fuel"],
            "diluent": r["diluent"], "pressure_atm": r["pressure_atm"], "pressure_band": r["pressure_band"],
            "x_o2": r["x_o2"], "o2_percent": r4(r["x_o2"] * 100) if r["x_o2"] is not None else None,
            "x_co2": r["x_co2"], "x_he": r["x_he"], "d0_mm": r["d0_mm"], "dext_mm": r["dext_mm"],
            "dext_over_d0": r4(ratio), "k_mm2_s": r["k_mm2_s"], "burn_time_s": r["burn_time_s"],
            "burn_time_kind": r["burn_time_kind"], "test_end": r["test_end"],
        })
    counts: dict[str, dict[str, int]] = {}
    for p in points:
        counts.setdefault(p["fuel"], {}).setdefault(p["test_end"], 0)
        counts[p["fuel"]][p["test_end"]] += 1
    # outcome by O2 band (descriptive table)
    bands = [("X_O2 < 0.175", None, 0.175), ("0.175 <= X_O2 < 0.215", 0.175, 0.215), ("X_O2 >= 0.215", 0.215, None)]
    by_band = []
    for fuel in sorted({r["fuel"] for r in rows}):
        for name, lo, hi in bands:
            sel = [r for r in rows if r["fuel"] == fuel and r["x_o2"] is not None
                   and (lo is None or r["x_o2"] >= lo) and (hi is None or r["x_o2"] < hi)]
            c: dict[str, int] = {}
            for r in sel:
                c[r["test_end"]] = c.get(r["test_end"], 0) + 1
            by_band.append({"fuel": fuel, "o2_band": name, "n": len(sel), "outcomes": c})
    # K vs O2 correlation per fuel (outputs vs inputs; descriptive)
    corr = []
    for fuel in sorted({r["fuel"] for r in rows}):
        sel = [r for r in rows if r["fuel"] == fuel and r["k_mm2_s"] is not None and r["x_o2"] is not None]
        corr.append({"fuel": fuel, "x": "x_o2", "y": "k_mm2_s", "n": len(sel),
                     "pearson_r": r4(pearson([r["x_o2"] for r in sel], [r["k_mm2_s"] for r in sel]))})
    result = {
        "analysis": "flex_extinction_map", "filters_applied": applied, "n_total": len(rows), "n_plotted": len(points),
        "points": points, "excluded": excluded, "outcome_counts": counts, "outcome_by_o2_band": by_band,
        "correlations": corr,
        "axes": {"x": {"field": "x_o2", "label": "Initial O2", "unit": "mole fraction"},
                 "y": {"field": "d0_mm", "label": "Initial droplet diameter D0", "unit": "mm"}},
        "notes": [
            "Each point is one FLEX row with a numeric D0; color = recorded 'Test end'.",
            "'Disruption' is undefined in local documents and may be censored; it is not extinction.",
            "Adaptive test design (conditions chosen near extinction boundaries) means this is not a random sample.",
            "No limiting oxygen index (LOI) value is asserted: deriving one needs a validated method.",
        ],
        "summary": {"n_plotted": len(points), "n_excluded": len(excluded)},
    }
    result["analysis_id"] = record_run(conn, "flex_map", applied, "scatter X_O2 vs D0 by Test end", result, len(points))
    return result


D2_FORMULA = "t_est = (D0^2 - D_end^2) / K ;  ratio = t_reported / t_est   [K in mm^2/s, D in mm, t in s]"


def d2_record(r: dict) -> dict:
    """d^2-law consistency for one FLEX row. Returns inclusion decision and math."""
    out: dict[str, Any] = {"experiment_uid": r["experiment_uid"], "identifier": r["identifier"], "fuel": r["fuel"],
                           "diluent": r["diluent"], "test_end": r["test_end"], "d0_mm": r["d0_mm"],
                           "dext_mm": r["dext_mm"], "k_mm2_s": r["k_mm2_s"], "burn_time_s": r["burn_time_s"],
                           "x_o2": r["x_o2"], "included": False, "reasons": [], "assumptions": []}
    d0, dext, k, t = r["d0_mm"], r["dext_mm"], r["k_mm2_s"], r["burn_time_s"]
    if d0 is None:
        out["reasons"].append(f"D0 not numeric ({r['d0_kind']})")
    if k is None:
        out["reasons"].append(f"K not numeric ({r['k_kind']})")
    elif k <= 0:
        out["reasons"].append("K <= 0")
    if t is None:
        out["reasons"].append(f"burn time not numeric ({r['burn_time_kind']})")
    elif r["burn_time_kind"] == "approximate":
        out["reasons"].append("burn time is approximate (~)")
    if r["test_end"] == "Disruption":
        out["reasons"].append("Test end 'Disruption' (undefined; possibly censored)")
    d_end = None
    if r["test_end"] == "Extinction":
        if dext is None:
            out["reasons"].append(f"Extinction without numeric Dext ({r['dext_kind']})")
        else:
            d_end = dext
    elif r["test_end"] == "Completion":
        if dext is not None and dext > 0:
            d_end = dext
            out["assumptions"].append("Completion with Dext > 0: endpoint taken as the visible-flame extinction diameter")
        else:
            d_end = 0.0
            out["assumptions"].append("Completion: endpoint diameter assumed 0 (droplet consumed)")
    if d0 is not None and d_end is not None and d_end > d0:
        out["reasons"].append("D_end > D0 (unphysical)")
    if d0 is not None and d_end is not None and d0 == d_end:
        out["reasons"].append("D_end == D0 (no measurable regression)")
    if out["reasons"]:
        return out
    t_est = (d0 ** 2 - d_end ** 2) / k
    out.update(included=True, d_end_mm=d_end, t_est_s=r4(t_est), ratio=r4(t / t_est), residual_s=r4(t - t_est),
               abs_pct_error=r4(abs(t - t_est) / t * 100) if t else None)
    out["outlier"] = not (0.6 <= t / t_est <= 1.5)
    return out


def flex_d2(conn: sqlite3.Connection, params: dict[str, str | None], uid: str | None = None) -> dict:
    if uid:
        r = conn.execute("SELECT * FROM flex_tests WHERE experiment_uid=?", (uid,)).fetchone()
        if not r:
            raise not_found("FLEX experiment", uid)
        rec = d2_record(dict(r))
        return {"analysis": "flex_d2_consistency", "formula": D2_FORMULA, "record": rec,
                "label": "Consistency check of reported values, not an independent prediction."}
    where, args, applied = _flex_where(params)
    rows = [dict(r) for r in conn.execute(f"SELECT * FROM flex_tests {where} ORDER BY test_number", args)]
    recs = [d2_record(r) for r in rows]
    inc = [x for x in recs if x["included"]]
    ratios = [x["ratio"] for x in inc]
    ape = [x["abs_pct_error"] for x in inc if x["abs_pct_error"] is not None]
    reasons: dict[str, int] = {}
    for x in recs:
        for rs in x["reasons"]:
            key = rs.split(" (")[0]
            reasons[key] = reasons.get(key, 0) + 1
    by_fuel = []
    for fuel in sorted({x["fuel"] for x in inc}):
        rr = [x["ratio"] for x in inc if x["fuel"] == fuel]
        by_fuel.append({"fuel": fuel, "n": len(rr), "median_ratio": r4(st.median(rr)) if rr else None,
                        "q10": r4(quantile(rr, 0.1)), "q90": r4(quantile(rr, 0.9))})
    summary = {
        "n_total": len(recs), "n_included": len(inc), "n_excluded": len(recs) - len(inc),
        "median_ratio": r4(st.median(ratios)) if ratios else None,
        "q10_ratio": r4(quantile(ratios, 0.1)), "q25_ratio": r4(quantile(ratios, 0.25)),
        "q75_ratio": r4(quantile(ratios, 0.75)), "q90_ratio": r4(quantile(ratios, 0.9)),
        "median_abs_pct_error": r4(st.median(ape)) if ape else None,
        "within_20pct": sum(1 for x in inc if 0.8 <= x["ratio"] <= 1.2),
        "outliers": sum(1 for x in inc if x["outlier"]),
    }
    result = {
        "analysis": "flex_d2_consistency", "formula": D2_FORMULA, "filters_applied": applied, "summary": summary,
        "by_fuel": by_fuel, "exclusion_reasons": reasons, "records": recs,
        "label": "Consistency analysis of reported K, D0, Dext and burn time - NOT an independent prediction.",
        "assumptions": [
            "K ('Burning rate; mm' column) is the d^2-law constant in mm^2/s (header unit corrected; flag FLEX-UNIT-K).",
            "Reported burn time is treated as ignition-to-visible-flame-end duration; its exact definition is not documented locally.",
            "Disruption rows are excluded as potentially censored; approximate (~) burn times are excluded.",
            "A ratio slightly above 1 is expected if the reported time includes ignition transients.",
        ],
        "evidence": [{"document_id": "2g11-070he-0310", "page_pdf": 2,
                      "note": "d^2-law (D/D0)^2 = 1 - K t / D0^2 (classical droplet theory)"}],
    }
    result["analysis_id"] = record_run(conn, "flex_d2", applied, D2_FORMULA, result, len(inc))
    return result


# ---------------------------------------------------------------- BASS-II ----

PMMA_STOICH = 5.0 / 6.0  # C5H8O2 + 6 O2 -> 5 CO2 + 4 H2O (moles CO2 per mole O2)
O2_UNPHYSICAL = 5.0       # |delta O2| > 5 %-points flagged unphysical
O2_RESOLUTION = 0.1       # %O2 sensor resolution
CO2_RESOLUTION = 0.1      # %CO2 nominal resolution


def bass_gases(conn: sqlite3.Connection, params: dict[str, str | None]) -> dict:
    where, args, applied = [], [], {}
    for k in ("pi", "material_class", "geometry"):
        v = params.get(k)
        if v:
            vals = [x for x in v.split("|") if x]
            where.append(f"{k} IN ({','.join('?' * len(vals))})")
            args += vals
            applied[k] = vals
    w = ("WHERE " + " AND ".join(where)) if where else ""
    rows = [dict(r) for r in conn.execute(f"SELECT t.*, e.source_row, e.raw_json FROM bass2_tests t JOIN experiments e "
                                          f"USING(experiment_uid) {w} ORDER BY e.source_row", args)]
    from ..ingest.bass2 import GAS_COLS
    header_of = {name: h for h, (name, _, _) in GAS_COLS.items()}
    recs = []
    for r in rows:
        raw_cells = dict(json.loads(r.pop("raw_json")))
        rec = {"experiment_uid": r["experiment_uid"], "test_id": r["test_id"], "pi": r["pi"],
               "material_class": r["material_class"], "geometry": r["geometry"], "source_row": r["source_row"],
               "o2_initial": r["o2_initial"], "o2_final": r["o2_final"], "co2_initial": r["co2_initial"],
               "co2_final": r["co2_final"], "co_initial": r["co_initial"], "co_final": r["co_final"],
               "fan_raw": r["fan_raw"], "air_raw": r["air_raw"], "air_tokens": json.loads(r["air_tokens_json"] or "[]"),
               "flow_restrictor": r["flow_restrictor"],
               "raw": {k: raw_cells.get(header_of[k], "") for k in header_of},  # verbatim NASA cells
               "kinds": {k: r[k + "_kind"] for k in header_of},
               "flags": []}
        ok_o2 = r["o2_initial"] is not None and r["o2_final"] is not None
        ok_co2 = r["co2_initial"] is not None and r["co2_final"] is not None
        ok_co = r["co_initial"] is not None and r["co_final"] is not None
        rec["delta_o2"] = r4(r["o2_final"] - r["o2_initial"]) if ok_o2 else None
        rec["delta_co2"] = r4(r["co2_final"] - r["co2_initial"]) if ok_co2 else None
        rec["delta_co"] = r4(r["co_final"] - r["co_initial"]) if ok_co else None
        if ok_o2 and abs(rec["delta_o2"]) > O2_UNPHYSICAL:
            rec["flags"].append("o2_unphysical")
        if ok_o2 and abs(rec["delta_o2"]) <= O2_RESOLUTION:
            rec["flags"].append("delta_o2_at_or_below_resolution")
        if ok_co2 and abs(rec["delta_co2"]) < CO2_RESOLUTION:
            rec["flags"].append("delta_co2_below_resolution")
        if not ok_o2:
            rec["flags"].append("o2_endpoint_missing")
        if not ok_co2:
            rec["flags"].append("co2_endpoint_missing")
        if not ok_co:
            rec["flags"].append("co_not_numeric (" + ",".join(
                k for k in ("co_initial", "co_final") if r[k] is None) + ")")
        recs.append(rec)
    fit = [x for x in recs if x["delta_o2"] is not None and x["delta_co2"] is not None
           and "o2_unphysical" not in x["flags"]]
    fit_res = [x for x in fit if -x["delta_o2"] > 0.2]  # consumption above ~2x resolution
    xs = [-x["delta_o2"] for x in fit]
    ys = [x["delta_co2"] for x in fit]
    by_class = []
    for cls in sorted({x["material_class"] for x in fit_res}):
        sel = [x for x in fit_res if x["material_class"] == cls]
        by_class.append({"material_class": cls, "n": len(sel),
                         "slope_co2_per_o2": r4(slope_through_origin([-x["delta_o2"] for x in sel],
                                                                     [x["delta_co2"] for x in sel])),
                         "median_o2_consumed": r4(st.median([-x["delta_o2"] for x in sel]))})
    summary = {
        "n_total": len(recs), "n_with_o2_and_co2": len(fit) + sum(1 for x in recs if "o2_unphysical" in x["flags"]),
        "n_fit": len(fit), "n_excluded_unphysical": sum(1 for x in recs if "o2_unphysical" in x["flags"]),
        "pearson_r": r4(pearson(xs, ys)), "slope_co2_per_o2_all": r4(slope_through_origin(xs, ys)),
        "n_fit_above_resolution": len(fit_res),
        "slope_co2_per_o2_above_resolution": r4(slope_through_origin(
            [-x["delta_o2"] for x in fit_res], [x["delta_co2"] for x in fit_res])),
        "pmma_stoichiometric_reference": r4(PMMA_STOICH),
    }
    result = {
        "analysis": "bass2_gas_deltas", "filters_applied": applied, "summary": summary, "by_material_class": by_class,
        "records": recs,
        "formula": "delta_X = final_X - initial_X ; O2 consumed = -delta_O2 ; slope = sum(x*y)/sum(x^2) (through origin)",
        "reference": {"label": "PMMA complete combustion C5H8O2 + 6 O2 -> 5 CO2 + 4 H2O", "ratio": r4(PMMA_STOICH),
                      "applies_to": "PMMA samples only (films, slabs, rods, spheres)",
                      "evidence": {"document_id": "bass-ii-summary-report",
                                   "note": "Report discusses near-stoichiometric O2-to-CO2 conversion (Eq. 1.1)."}},
        "limitations": [
            "Gas values are single before/after readings of the well-mixed ~250 L glovebox volume, not time series.",
            "Multi-stage flow tests integrate all stages; a delta cannot be attributed to a single velocity.",
            "Chamber atmosphere carried over between same-day burns until purge (tests not independent).",
            f"|delta O2| > {O2_UNPHYSICAL} points is treated as a recording error and excluded from fits (raw kept).",
            "Heat release rate is not computed: burn durations are not in the CSV.",
            "Equal-volume %-points of O2 and CO2 are compared as mole ratios (ideal-gas assumption).",
        ],
    }
    result["analysis_id"] = record_run(conn, "bass2_gases", applied, result["formula"], result, len(fit))
    return result


def bass_report(conn: sqlite3.Connection) -> dict:
    """Values curated from the BASS-II Summary Report (verified against the CSV at ingestion)."""
    rows = []
    for r in conn.execute("SELECT * FROM report_records ORDER BY table_id, page_pdf, rowid"):
        d = dict(r)
        for k in ("values_json", "units_json", "raw_json", "checks_json", "notes_json"):
            d[k[:-5]] = json.loads(d.pop(k))
        rows.append(d)
    t51 = [r for r in rows if r["table_id"] == "5.1"]
    stages = []
    for r in t51:
        if r["verification"] != "verified":
            continue
        v = r["values"]
        pairs = [{"velocity_cm_s": a, "spread_rate_mm_s": b} for a, b in
                 zip(v.get("velocity_cm_s", []), v.get("spread_rate_mm_s", []))]             if len(v.get("velocity_cm_s", [])) == len(v.get("spread_rate_mm_s", [])) else []
        for k, p in enumerate(pairs):
            stages.append({"experiment_uid": r["experiment_uid"], "test_id": r["test_id"], "stage": k + 1,
                           "thickness_mm": v.get("thickness_mm"), "width_cm": v.get("width_cm"),
                           "sides_burning": v.get("sides_burning"), "page_pdf": r["page_pdf"], **p})
    t71 = [r for r in rows if r["table_id"] == "7.1"]
    unpaired = [r["test_id"] for r in t51 if not (len(r["values"].get("velocity_cm_s", [])) ==
                                                len(r["values"].get("spread_rate_mm_s", [])) and r["values"].get("velocity_cm_s"))]
    return {
        "source": {"document_id": "bass-ii-summary-report", "title": "BASS-II Summary Report (NASA/TM-20210011385)"},
        "table_5_1": {"rows": t51, "stages": stages, "n_tests": len(t51), "n_stages": len(stages),
                      "unpaired_tests": unpaired, "page_pdf": 65,
                      "note": "Stage pairs are formed only when the printed velocity and spread-rate lists have the same "
                              "length; their order is the printed order. 'Not tracked' spread rates are never filled in."},
        "table_7_1": {"rows": t71, "page_pdf": 104},
        "appendix_a": {"verified": sum(1 for r in rows if r["table_id"].startswith("A") and r["verification"] == "verified"),
                       "needs_review": [r["test_id"] for r in rows if r["table_id"].startswith("A")
                                        and r["verification"] == "needs_review"],
                       "flow_direction_counts": _count([r["values"].get("flow_direction") for r in rows
                                                        if r["table_id"].startswith("A") and r["verification"] == "verified"])},
        "method": "PyMuPDF table detection + character-level cell reconstruction; each row cross-checked against the "
                  "independent BASS-II CSV (test ID and gas readings). Disagreements are kept and flagged.",
    }


def _count(vals: list) -> dict:
    out: dict = {}
    for v in vals:
        out[str(v)] = out.get(str(v), 0) + 1
    return out


# --------------------------------------------------------------- SAFFIRE-I ---

def saffire_case(conn: sqlite3.Connection) -> dict:
    burns = [dict(r) for r in conn.execute(
        "SELECT b.*, e.source_row FROM saffire_burns b JOIN experiments e USING(experiment_uid) ORDER BY sample")]
    sets = [dict(r) for r in conn.execute("SELECT * FROM saffire_image_sets ORDER BY label")]
    manifest = [dict(r) for r in conn.execute("SELECT * FROM saffire_manifest ORDER BY start_utc, camera")]
    for m in manifest:
        m["received_pct"] = r4(100 * m["jpeg_received"] / m["frames"]) if m["frames"] else None
    flags = [dict(r) for r in conn.execute(
        "SELECT * FROM quality_flags WHERE investigation_id='PSI-98' ORDER BY severity DESC")]
    pubs = [dict(r) for r in conn.execute(
        "SELECT title, authors, doi FROM investigation_publications WHERE investigation_id='PSI-98'")]
    comparison = []
    if len(burns) == 2:
        a, b = burns
        for key, label, unit in (("flow_direction", "Flow direction", None), ("air_flow_cm_s", "Air flow", "cm/s"),
                                 ("o2_raw", "Percent O2 (as recorded)", "%"), ("ignition_power_w", "Ignition power", "W"),
                                 ("ignition_time_s", "Ignition time", "s"), ("burn_time_s", "Burn time (CSV)", "s"),
                                 ("material", "Material", None), ("thickness_cm", "Thickness", "cm"),
                                 ("length_cm", "Length (CSV; likely swapped)", "cm"),
                                 ("width_cm", "Width (CSV; likely swapped)", "cm")):
            comparison.append({"field": key, "label": label, "unit": unit, "S1": a.get(key), "S2": b.get(key),
                               "same": a.get(key) == b.get(key)})
    return {
        "burns": burns, "image_sets": sets, "comparison": comparison, "manifest": manifest, "quality_flags": flags,
        "publications": pubs,
        "campaign_window": {"start_utc": min((m["start_utc"] for m in manifest), default=None),
                            "end_utc": max((m["end_utc"] for m in manifest), default=None)},
        "statements": [
            {"kind": "ORIGINAL_EXPERIMENT", "text": "Two burn rows (S1 concurrent, S2 opposed) and two image-set rows "
                                                    "(F1, F2) exist in the CSV; image-set rows are not burns."},
            {"kind": "COMPUTED", "text": "Frame timeline and receipt percentages are computed from the manifest "
                                         "workbook's file names (epoch ms) and received/corrupt lists."},
            {"kind": "UNSUPPORTED", "text": "Flame spread rates, flame area, temperatures and gas histories are not "
                                            "available in the local files and are not shown."},
        ],
    }


def saffire_timeline(conn: sqlite3.Connection, bin_s: int = 10, set_label: str | None = None) -> dict:
    if bin_s not in (10, 30, 60):
        raise bad_request("bin_s must be 10, 30 or 60")
    where, args = "", []
    if set_label:
        where, args = "WHERE set_label=?", [set_label]
    rows = [dict(r) for r in conn.execute(
        f"SELECT * FROM saffire_timeline {where} ORDER BY set_label, camera, bin_start_s", args)]
    series: dict[str, dict] = {}
    for r in rows:
        key = f"{r['set_label']}/{r['camera']}"
        s = series.setdefault(key, {"set_label": r["set_label"], "camera": r["camera"], "bins": {}})
        b = (r["bin_start_s"] // bin_s) * bin_s
        cur = s["bins"].setdefault(b, {"bin_start_s": b, "bin_start_utc": r["bin_start_utc"], "frames": 0,
                                       "received": 0, "corrupt": 0})
        cur["frames"] += r["frames"]
        cur["received"] += r["received"]
        cur["corrupt"] += r["corrupt"]
    out = []
    for key, s in series.items():
        bins = sorted(s["bins"].values(), key=lambda x: x["bin_start_s"])
        out.append({"key": key, "set_label": s["set_label"], "camera": s["camera"], "bins": bins,
                    "missing": [b["bin_start_s"] for b in bins if b["received"] == 0]})
    return {"bin_s": bin_s, "series": out,
            "units": {"frames": "count of listed JPEG frames per bin", "received": "count marked received",
                      "corrupt": "count marked received-corrupt"},
            "note": "Metadata only: counts of image files listed in the downlink manifest. Not a physical measurement."}


_ = (FLEX, BASS2)

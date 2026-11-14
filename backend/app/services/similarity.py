"""Within-investigation nearest-neighbour search on INITIAL CONDITIONS only.

Distance: Gower-style. Numeric fields: |a-b| / range (range over the dataset),
clipped to [0, 1]; categorical: 0 if equal else 1. Per-field weights
(documented, server-side) are renormalized over fields present in BOTH records
(null-aware). similarity = 1 - distance. Outcome variables (burn time, Dext, K,
test end, final gases) are never features -> no outcome leakage.
"""
from __future__ import annotations

import math
import sqlite3

from ..core.errors import bad_request, not_found
from .catalog import dataset_for_uid

FEATURES = {
    "flex": [
        # name, kind, weight, transform
        ("fuel", "category", 3.0, None),
        ("diluent", "category", 2.0, None),
        ("x_o2", "numeric", 3.0, None),
        ("x_co2", "numeric", 1.5, None),
        ("x_he", "numeric", 1.5, None),
        ("pressure_atm", "numeric", 1.5, "log"),
        ("d0_mm", "numeric", 2.0, None),
    ],
    "bass2": [
        ("material_class", "category", 3.0, None),
        ("geometry", "category", 1.0, None),
        ("pi", "category", 1.0, None),
        ("thickness_mm", "numeric", 1.5, "log"),
        ("diameter_mm", "numeric", 1.5, None),
        ("width_cm", "numeric", 1.0, None),
        ("o2_initial", "numeric", 2.0, None),
        ("flow_restrictor", "category", 0.5, None),
    ],
}
# Phase 16: ACME CFI-G (PSI-159), starting conditions only. Candidates are always restricted to the same configuration
# (normal or inverse): O2 means the ambient before ignition for normal flames and the supplied oxidizer for inverse
# flames, and the supply flow is fuel (normal) or O2 (inverse), so the two are not on a common axis.
FEATURES["cfig"] = [
    ("fuel_species", "category", 3.0, None),
    ("x_o2", "numeric", 3.0, None),
    ("p_bar", "numeric", 2.0, "log"),
    ("bottle_fuel_pct", "numeric", 1.5, None),
    ("supply_flow_mg_s", "numeric", 1.5, None),
]
EXCLUDED_OUTCOMES = {
    "flex": ["burn_time_s", "dext_mm", "k_mm2_s", "test_end"],
    "bass2": ["o2_final", "co2_final", "co_final", "fan/air stage history (multi-stage, not comparable)"],
    "cfig": ["outcome", "hot_ignition", "termination", "burn_time_s", "x_o2_after", "peak_burner_t_c"],
}
CFIG_CONFIGS = ("normal", "inverse")
TABLE = {"flex": "flex_tests", "bass2": "bass2_tests"}
DISPLAY = {"flex": "identifier", "bass2": "test_id", "cfig": "test_id"}


def _transform(v, t):
    if v is None:
        return None
    if t == "log":
        return math.log(v) if v > 0 else None
    return v


def _cfig_rows(conn, configuration: str) -> list[dict]:
    import json
    out = []
    for rid, vj in conn.execute("SELECT record_id, values_json FROM p13_records WHERE dataset_id='cfig_tests' ORDER BY rowid"):
        v = json.loads(vj)
        if v.get("configuration") != configuration:
            continue
        normal = configuration == "normal"
        out.append({"experiment_uid": rid, "test_id": (v.get("test_id_raw") or "").replace(" ", ""), "configuration": configuration,
                    "fuel_species": v.get("fuel_species"), "x_o2": v.get("x_o2_before") if normal else v.get("x_o2_supply"),
                    "p_bar": v.get("p_bar"), "bottle_fuel_pct": v.get("bottle_fuel_pct"),
                    "supply_flow_mg_s": v.get("m_fuel_mg_s") if normal else v.get("m_o2_mg_s"),
                    **{o: v.get(o) for o in EXCLUDED_OUTCOMES["cfig"]}})
    return out


def _load(conn, key, configuration: str | None = None):
    rows = _cfig_rows(conn, configuration or "normal") if key == "cfig" else [dict(r) for r in conn.execute(f"SELECT * FROM {TABLE[key]}")]
    if key == "flex":
        for r in rows:  # pressure 0 is a known invalid entry -> treat as missing
            if r["pressure_atm"] is None or (r["pressure_mmhg"] or 0) <= 0:
                r["pressure_atm"] = None
    ranges = {}
    for name, kind, _, t in FEATURES[key]:
        if kind == "numeric":
            vals = [_transform(r[name], t) for r in rows]
            vals = [v for v in vals if v is not None]
            ranges[name] = (max(vals) - min(vals)) if len(vals) > 1 else 0.0
    return rows, ranges


def distance(a: dict, b: dict, key: str, ranges: dict) -> tuple[float | None, list[dict]]:
    parts, wsum, dsum = [], 0.0, 0.0
    for name, kind, w, t in FEATURES[key]:
        va, vb = a.get(name), b.get(name)
        if kind == "numeric":
            ta, tb = _transform(va, t), _transform(vb, t)
            if ta is None or tb is None or not ranges.get(name):
                parts.append({"field": name, "a": va, "b": vb, "weight": w, "distance": None, "used": False})
                continue
            d = min(1.0, abs(ta - tb) / ranges[name])
        else:
            if va is None or vb is None:
                parts.append({"field": name, "a": va, "b": vb, "weight": w, "distance": None, "used": False})
                continue
            d = 0.0 if str(va) == str(vb) else 1.0
        wsum += w
        dsum += w * d
        parts.append({"field": name, "a": va, "b": vb, "weight": w, "distance": round(d, 4), "used": True})
    if wsum == 0:
        return None, parts
    total = dsum / wsum
    for p in parts:
        if p["used"]:
            p["contribution"] = round(p["weight"] * p["distance"] / wsum, 4)
    return total, parts


def similar_to(conn: sqlite3.Connection, uid: str, k: int = 10, same_category: bool = False) -> dict:
    if uid.startswith("cfig:"):
        cfgn = uid.split(":")[1] if uid.count(":") >= 2 else ""
        if cfgn not in CFIG_CONFIGS:
            raise not_found("CFI-G test", uid)
        if not (1 <= k <= 50):
            raise bad_request("k must be between 1 and 50")
        rows, ranges = _load(conn, "cfig", cfgn)
        target = next((r for r in rows if r["experiment_uid"] == uid), None)
        if not target:
            raise not_found("CFI-G test", uid)
        res = _rank(conn, "cfig", target, rows, ranges, k, same_category, exclude_uid=uid)
        res["scope"] = f"CFI-G {cfgn} flames only ({len(rows)} tests); the other configuration is never compared."
        return res
    ds = dataset_for_uid(uid)
    if not ds:
        raise not_found("Experiment", uid)
    if ds.key == "saffire1":
        return {"experiment_uid": uid, "dataset": ds.key, "supported": False, "results": [],
                "explanation": "SAFFIRE-I has only two burns (S1 concurrent, S2 opposed). A similarity ranking over "
                               "n=2 is not meaningful; use the side-by-side comparison instead.",
                "compare_url": "/compare?uids=saffire1:S1,saffire1:S2"}
    if not (1 <= k <= 50):
        raise bad_request("k must be between 1 and 50")
    rows, ranges = _load(conn, ds.key)
    target = next((r for r in rows if r["experiment_uid"] == uid), None)
    if not target:
        raise not_found("Experiment", uid)
    return _rank(conn, ds.key, target, rows, ranges, k, same_category, exclude_uid=uid)


def similar_to_conditions(conn: sqlite3.Connection, dataset: str, conditions: dict, k: int = 10) -> dict:
    if dataset not in FEATURES:
        raise bad_request("Condition search is available for flex, bass2 and cfig only.")
    conditions = dict(conditions)
    configuration = None
    if dataset == "cfig":
        configuration = conditions.pop("configuration", None)
        if configuration not in CFIG_CONFIGS:
            raise bad_request("For CFI-G, choose configuration=normal or configuration=inverse (they are never pooled).")
    allowed = {f[0]: f[1] for f in FEATURES[dataset]}
    target = {}
    for name, value in conditions.items():
        if name not in allowed:
            raise bad_request(f"'{name}' is not an initial-condition feature for {dataset}. "
                              f"Allowed: {', '.join(allowed)}")
        if value in (None, ""):
            continue
        if allowed[name] == "numeric":
            try:
                target[name] = float(value)
            except (TypeError, ValueError):
                raise bad_request(f"{name} must be numeric")
        else:
            target[name] = str(value)
    if not target:
        raise bad_request("Provide at least one condition.")
    rows, ranges = _load(conn, dataset, configuration)
    target["experiment_uid"] = "query"
    res = _rank(conn, dataset, target, rows, ranges, k, False, exclude_uid=None)
    if configuration:
        res["scope"] = f"CFI-G {configuration} flames only ({len(rows)} tests); the other configuration is never compared."
    return res


def _rank(conn, key, target, rows, ranges, k, same_category, exclude_uid):
    scored = []
    for r in rows:
        if r["experiment_uid"] == exclude_uid:
            continue
        if same_category:
            cat = {"flex": "fuel", "bass2": "material_class", "cfig": "fuel_species"}[key]
            if r.get(cat) != target.get(cat):
                continue
        d, parts = distance(target, r, key, ranges)
        if d is None:
            continue
        scored.append((round(d, 6), r, parts))
    scored.sort(key=lambda x: (x[0], x[1]["experiment_uid"]))  # deterministic tie-break
    results = []
    for d, r, parts in scored[:k]:
        used = [p for p in parts if p["used"]]
        diffs = sorted([p for p in used if p["distance"]], key=lambda p: -p["contribution"])
        explanation = ("Identical on all compared initial conditions." if not diffs else
                       "Largest differences: " + "; ".join(f"{p['field']} ({p['a']} vs {p['b']})" for p in diffs[:3]))
        results.append({
            "experiment_uid": r["experiment_uid"], "display_id": r[DISPLAY[key]],
            "similarity": round(1 - d, 4), "distance": d, "fields_compared": len(used),
            "parts": parts, "explanation": explanation,
            "outcome_preview": {o: r.get(o) for o in EXCLUDED_OUTCOMES[key] if o in r},
        })
    return {
        "experiment_uid": target["experiment_uid"], "dataset": key, "supported": True, "k": k,
        "query_values": {f[0]: target.get(f[0]) for f in FEATURES[key]},
        "method": "Gower distance on initial conditions; numeric |a-b|/range (log for pressure/thickness), "
                  "categorical mismatch = 1; weights renormalized over fields present in both records.",
        "features": [{"field": n, "kind": kd, "weight": w, "transform": t, "range": round(ranges.get(n, 0), 6)
                      if kd == "numeric" else None} for n, kd, w, t in FEATURES[key]],
        "excluded_outcomes": EXCLUDED_OUTCOMES[key],
        "note": "Outcomes are shown for context only and were not used to compute similarity.",
        "results": results,
    }

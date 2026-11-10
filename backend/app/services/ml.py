"""P2 FLEX ML feasibility study (gated).

Targets (evaluated separately):
  A. log(burn time) regression on Extinction/Completion rows with exact numeric time.
  B. Extinction vs Completion classification (Disruption excluded: undefined/censored).
Features: ONLY pre-test conditions -> fuel, X_O2, X_CO2, X_He, log(P), D0.
Never used: K, Dext, burn time, Test end (outcomes; K/Dext/t are algebraically linked).
Validation: GroupKFold over atmosphere groups (fuel + composition + pressure band) so
repeat tests of one atmosphere never sit in both train and test.
Gate: deploy (prediction enabled) only if Ridge beats the Dummy baseline by >= 20 %
in grouped-CV error AND the leakage review (fixed feature list) passes. Deployed model is
Ridge (coefficients stored as JSON; no pickle) with an empirical 80 % residual interval.
"""
from __future__ import annotations

import datetime as dt
import hashlib
import json
import math
import sqlite3
from pathlib import Path

import numpy as np

from ..core.config import get_settings
from ..core.errors import ApiError, bad_request

FEATURES = ["is_methanol", "x_o2", "x_co2", "x_he", "log_p_atm", "d0_mm"]
FORBIDDEN = ["k_mm2_s", "dext_mm", "burn_time_s", "test_end"]
SEED = 20261110
N_SPLITS = 5
GATE_IMPROVEMENT = 0.20
MODEL_FILE = "ml_flex_model.json"


def _rows(conn):
    return [dict(r) for r in conn.execute(
        "SELECT * FROM flex_tests WHERE d0_mm IS NOT NULL AND pressure_atm IS NOT NULL AND x_o2 IS NOT NULL")]


def _x(r):
    return [1.0 if r["fuel"] == "Methanol" else 0.0, r["x_o2"], r["x_co2"] or 0.0, r["x_he"] or 0.0,
            math.log(r["pressure_atm"]), r["d0_mm"]]


def _group(r):
    return f"{r['fuel']}|{r['x_o2']:.2f}|{(r['x_co2'] or 0):.2f}|{(r['x_he'] or 0):.2f}|{r['pressure_band']}"


def _data_hash(conn) -> str:
    rows = conn.execute("SELECT sha256 FROM source_files WHERE relative_path LIKE 'FLEX/%Experimental%'").fetchone()
    return rows[0] if rows else "unknown"


def train_and_evaluate(db_path: Path, out_dir: Path) -> dict:
    from sklearn.dummy import DummyClassifier, DummyRegressor
    from sklearn.ensemble import GradientBoostingRegressor
    from sklearn.linear_model import LogisticRegression, Ridge
    from sklearn.metrics import balanced_accuracy_score, f1_score, mean_absolute_error
    from sklearn.model_selection import GroupKFold
    from sklearn.pipeline import make_pipeline
    from sklearn.preprocessing import StandardScaler

    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    rows = _rows(conn)
    src_hash = _data_hash(conn)

    # ---- Target A: burn time regression
    reg = [r for r in rows if r["test_end"] in ("Extinction", "Completion") and r["burn_time_s"] is not None
           and r["burn_time_kind"] == "present" and r["burn_time_s"] > 0]
    X = np.array([_x(r) for r in reg])
    y = np.log(np.array([r["burn_time_s"] for r in reg]))
    groups = np.array([_group(r) for r in reg])
    gkf = GroupKFold(n_splits=N_SPLITS)
    models = {
        "dummy_mean": lambda: DummyRegressor(strategy="mean"),
        "ridge": lambda: make_pipeline(StandardScaler(), Ridge(alpha=1.0)),
        "gbr_depth2": lambda: GradientBoostingRegressor(max_depth=2, n_estimators=150, learning_rate=0.05,
                                                        subsample=0.8, random_state=SEED),
    }
    reg_metrics = {}
    oof_ridge = np.zeros_like(y)
    for name, mk in models.items():
        pred = np.zeros_like(y)
        for tr, te in gkf.split(X, y, groups):
            m = mk().fit(X[tr], y[tr])
            pred[te] = m.predict(X[te])
        if name == "ridge":
            oof_ridge = pred
        t_true, t_pred = np.exp(y), np.exp(pred)
        reg_metrics[name] = {
            "mae_log": round(float(mean_absolute_error(y, pred)), 4),
            "mae_s": round(float(mean_absolute_error(t_true, t_pred)), 3),
            "median_ape_pct": round(float(np.median(np.abs(t_pred - t_true) / t_true) * 100), 2),
            "rmse_log": round(float(np.sqrt(np.mean((y - pred) ** 2))), 4),
        }
    improvement = 1 - reg_metrics["ridge"]["mae_log"] / reg_metrics["dummy_mean"]["mae_log"]
    resid = y - oof_ridge
    q_lo, q_hi = float(np.quantile(resid, 0.10)), float(np.quantile(resid, 0.90))
    coverage = float(np.mean((resid >= q_lo) & (resid <= q_hi)))

    # ---- Target B: Extinction vs Completion
    cls = [r for r in rows if r["test_end"] in ("Extinction", "Completion")]
    Xc = np.array([_x(r) for r in cls])
    yc = np.array([1 if r["test_end"] == "Extinction" else 0 for r in cls])
    gc = np.array([_group(r) for r in cls])
    cls_metrics = {}
    for name, mk in {"dummy_prior": lambda: DummyClassifier(strategy="prior"),
                     "logistic_balanced": lambda: make_pipeline(StandardScaler(),
                                                                LogisticRegression(class_weight="balanced",
                                                                                   max_iter=2000))}.items():
        pred = np.zeros_like(yc)
        for tr, te in GroupKFold(n_splits=N_SPLITS).split(Xc, yc, gc):
            pred[te] = mk().fit(Xc[tr], yc[tr]).predict(Xc[te])
        cls_metrics[name] = {"balanced_accuracy": round(float(balanced_accuracy_score(yc, pred)), 4),
                             "macro_f1": round(float(f1_score(yc, pred, average="macro")), 4)}
    rule = np.array([1 if r["x_o2"] < 0.175 else 0 for r in cls])
    cls_metrics["rule_xo2_lt_0.175"] = {"balanced_accuracy": round(float(balanced_accuracy_score(yc, rule)), 4),
                                        "macro_f1": round(float(f1_score(yc, rule, average="macro")), 4)}

    leakage_review = {"features": FEATURES, "forbidden_outcomes_excluded": FORBIDDEN,
                      "passed": not any(f in FEATURES for f in FORBIDDEN),
                      "group_split": "GroupKFold over fuel+composition+pressure band"}
    deploy = improvement >= GATE_IMPROVEMENT and leakage_review["passed"]
    final = make_pipeline(StandardScaler(), Ridge(alpha=1.0)).fit(X, y)
    scaler, ridge = final.named_steps["standardscaler"], final.named_steps["ridge"]
    ranges = {f: [float(X[:, i].min()), float(X[:, i].max())] for i, f in enumerate(FEATURES)}
    created = dt.datetime.now(dt.UTC).replace(microsecond=0).isoformat()
    artifact = {
        "target": "log(burn_time_s)", "features": FEATURES, "mean": scaler.mean_.tolist(),
        "scale": scaler.scale_.tolist(), "coef": ridge.coef_.tolist(), "intercept": float(ridge.intercept_),
        "residual_interval_log": [q_lo, q_hi], "interval_coverage_oof": round(coverage, 3),
        "training_ranges": ranges, "n_train": int(len(y)), "fuels": sorted({r["fuel"] for r in reg}),
        "source_sha256": src_hash, "seed": SEED, "created_at": created,
    }
    metrics = {
        "regression": {"target": "log(burn time) [s]", "n": int(len(y)), "groups": int(len(set(groups))),
                       "cv": f"GroupKFold(n_splits={N_SPLITS})", "models": reg_metrics,
                       "ridge_improvement_vs_dummy": round(float(improvement), 4)},
        "classification": {"target": "Extinction (1) vs Completion (0)", "n": int(len(yc)),
                           "class_counts": {"Extinction": int(yc.sum()), "Completion": int(len(yc) - yc.sum())},
                           "cv": f"GroupKFold(n_splits={N_SPLITS})", "models": cls_metrics,
                           "decision": "evaluation only (not deployed): few Completion cases and an adaptive design"},
        "leakage_review": leakage_review,
        "gate": {"rule": f"Ridge must beat dummy by >= {int(GATE_IMPROVEMENT * 100)} % grouped-CV MAE(log) and pass "
                         "leakage review", "passed": bool(deploy)},
    }
    run_id = "flex-ml-" + hashlib.sha256(json.dumps([src_hash, SEED, FEATURES]).encode()).hexdigest()[:12]
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / MODEL_FILE).write_text(json.dumps({"run_id": run_id, "deployed": bool(deploy), "artifact": artifact,
                                                  "metrics": metrics}, indent=2), encoding="utf-8")
    conn.execute("DELETE FROM model_runs WHERE run_id=?", (run_id,))
    conn.execute("INSERT INTO model_runs VALUES (?,?,?,?,?,?,?,?,?)",
                 (run_id, "log(burn_time_s)", json.dumps(FEATURES), metrics["regression"]["cv"], json.dumps(metrics),
                  str(out_dir / MODEL_FILE), src_hash, "deployed" if deploy else "not_deployed", created))
    conn.commit()
    conn.close()
    return {"run_id": run_id, "deployed": bool(deploy), "improvement": round(float(improvement), 4)}


def _load():
    p = get_settings().processed_dir / MODEL_FILE
    if not p.exists():
        return None
    return json.loads(p.read_text(encoding="utf-8"))


def metrics(conn: sqlite3.Connection) -> dict:
    m = _load()
    if not m:
        raise ApiError(404, "not_evaluated", "FLEX ML evaluation has not been run (run the ingest pipeline).")
    a = m["artifact"]
    return {"run_id": m["run_id"], "prediction_enabled": m["deployed"], "metrics": m["metrics"],
            "features": a["features"], "training_ranges": a["training_ranges"], "n_train": a["n_train"],
            "source_sha256": a["source_sha256"], "seed": a["seed"], "created_at": a["created_at"],
            "interval": {"level": "80 % empirical (out-of-fold residual quantiles)",
                         "oof_coverage": a["interval_coverage_oof"]},
            "status_label": "Exploratory model - not a validated scientific or safety result.",
            "limitations": [
                "Trained on an adaptive design concentrated near extinction boundaries; not a random sample.",
                "Predicts reported burn time for Extinction/Completion-type tests only; Disruption rows excluded.",
                "Free vs fiber-supported droplets and chamber temperature are not recorded and may confound results.",
                "Valid only inside the training ranges; out-of-distribution inputs are refused.",
                "Not applicable to spacecraft fire safety decisions.",
            ]}


def predict(conn: sqlite3.Connection, inp: dict) -> dict:
    m = _load()
    if not m or not m["deployed"]:
        raise ApiError(501, "prediction_disabled", "FLEX prediction is disabled: the model did not pass the "
                       "validation gate (see /api/v1/ml/flex/metrics).")
    a = m["artifact"]
    if inp["fuel"] not in ("Methanol", "Heptane"):
        raise bad_request("fuel must be Methanol or Heptane")
    if inp["x_co2"] > 0 and inp["x_he"] > 0:
        raise bad_request("No FLEX test combines CO2 and He diluents; this input is out of distribution.")
    if inp["x_o2"] + inp["x_co2"] + inp["x_he"] > 1.0 + 1e-6:
        raise bad_request("Mole fractions of O2 + CO2 + He exceed 1.")
    x = [1.0 if inp["fuel"] == "Methanol" else 0.0, inp["x_o2"], inp["x_co2"], inp["x_he"],
         math.log(inp["pressure_atm"]), inp["d0_mm"]]
    ood = [f for f, v in zip(a["features"], x) if not (a["training_ranges"][f][0] <= v <= a["training_ranges"][f][1])]
    if ood:
        raise ApiError(422, "out_of_distribution", "Input outside the training range for: " + ", ".join(ood),
                       {"training_ranges": a["training_ranges"]})
    z = [(v - mu) / sd for v, mu, sd in zip(x, a["mean"], a["scale"])]
    ylog = a["intercept"] + sum(c * v for c, v in zip(a["coef"], z))
    lo, hi = a["residual_interval_log"]
    return {"prediction_s": round(math.exp(ylog), 2), "interval_80_s": [round(math.exp(ylog + lo), 2),
                                                                        round(math.exp(ylog + hi), 2)],
            "kind": "EXPLORATORY_PREDICTION", "run_id": m["run_id"], "inputs": inp,
            "warning": "Exploratory statistical estimate from FLEX conditions; not a measurement and not validated "
                       "for safety use."}

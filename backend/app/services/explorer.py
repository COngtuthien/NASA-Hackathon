"""Phase 14 Research-to-Safety Explorer: four research scenarios, graph-backed filters, a deterministic and explainable
investigation ranking, condition matching, evidence selection and interpretation.

This is research discovery. Scores rank how closely a NASA investigation matches a research question; they are not
fire danger, safety probability, prediction confidence or NASA endorsement. Every number shown comes from the graph
(kg_nodes / kg_edges, built from the NASA rows) or from the Phase 13 curated records.

Ranking (see docs/PHASE14_RANKING_METHODOLOGY.md)
  Relevance R (0-100)    = topic (0-60) + environment (0-20) + role in the scenario (0-20)
  Evidence strength E    = strongest evidence class the investigation provides (0-100, fixed table EVIDENCE_POINTS)
  Applicability A        = 100 if at least one record meets every selected condition the investigation records;
                           50 x (conditions met individually / conditions evaluated) otherwise; None when no selected
                           condition is recorded by the investigation (not penalized)
  Directness D           = 1 when the investigation studies one of the scenario's primary phenomena, else 0.5
                           (indirect evidence counts half; E itself is shown unchanged)
  Ranking score          = round(0.5 R + 0.3 E D + 0.2 A), or round((0.5 R + 0.3 E D) / 0.8) when A is None
"""
from __future__ import annotations

import re
import sqlite3
from collections import Counter, defaultdict
from urllib.parse import urlencode

from ..core.errors import bad_request, not_found
from ..db.database import jloads
from . import kg, retrieval

WEIGHTS = {"relevance": 0.5, "evidence": 0.3, "applicability": 0.2}
TOPIC_POINTS = {"primary_focus": 60, "secondary_focus": 45, "related_phenomenon": 30, "documented_relation": 15, "none": 0}
ROLE_POINTS = {"primary": 20, "supporting": 10, "context": 5}
ENV_POINTS = {"flight": 20, "ground_or_analysis": 10}
EVIDENCE_POINTS = {  # strongest class available -> points
    "measured_outcomes": (100, "measured per-test outcomes"),
    "derived_measurements": (80, "report-backed measurements derived by NASA"),
    "figure_and_model": (60, "published figure data with model curves"),
    "report_statements": (45, "report statements and operational logs"),
    "conditions_only": (35, "test conditions only"),
    "documentation_only": (20, "documentation only"),
    "metadata_only": (10, "metadata only"),
}
DISCLAIMER = ("Research support only. Rankings show how closely NASA investigations match a research question. They "
              "are not fire-risk scores, safety certifications or predictions.")
NO_MATCH = "No matching experimental evidence is available for these conditions."
BAR_PER_ATM = 1.01325

SCENARIOS: dict[str, dict] = {
    "flame-spread": {
        "title": "Flame Spread in Spacecraft Materials",
        "question": "How do material properties and airflow conditions affect flame spread in microgravity?",
        "domain": "Solid-material combustion", "icon": "solid",
        "phenomena": {"primary": ["flame_spread_solids"],
                      "secondary": ["material_flammability", "large_scale_spacecraft_fire", "flame_extinction"]},
        "roles": {"PSI-25": "primary", "PSI-98": "supporting", "PSI-62": "supporting", "PSI-20": "context"},
        "filters": ["material", "flow", "geometry"],
        "member_types": {"PSI-25": ("experiment",), "PSI-98": ("experiment",)},
        "summary": "Flames creeping over PMMA, fabrics and other solids in controlled airflow (BASS-II), with a "
                   "large-scale spacecraft burn (SAFFIRE-I) for context.",
    },
    "gaseous-flames": {
        "title": "Gaseous Flame Behavior",
        "question": "Under which experimental conditions do gaseous microgravity flames ignite, persist, transition, or "
                    "extinguish?",
        "domain": "Gaseous diffusion flames", "icon": "sphere",
        "phenomena": {"primary": ["gaseous_diffusion_flames", "cool_flames"],
                      "secondary": ["flame_extinction", "burning_rate_emulation"]},
        "roles": {"PSI-159": "primary", "PSI-10": "supporting", "PSI-20": "supporting"},
        "filters": ["configuration", "fuel", "o2", "pressure"],
        "member_types": {"PSI-159": ("experiment",), "PSI-10": ("experiment",)},
        "summary": "Spherical gas flames on porous burners: ignition, self-extinction, flow termination and cool "
                   "flames (ACME CFI-G), with Flame Design conditions and BRE results for context.",
    },
    "smoke-detection": {
        "title": "Early Smoke Detection from Overheated Materials",
        "question": "How do smoke particle characteristics and detector observations vary among overheated spacecraft "
                    "materials?",
        "domain": "Pre-flaming smoke and detection", "icon": "smoke",
        "phenomena": {"primary": ["smoke_particle_formation", "smoke_detection"],
                      "secondary": ["material_flammability", "large_scale_spacecraft_fire"]},
        "roles": {"PSI-102": "primary", "PSI-98": "context", "PSI-25": "context"},
        "filters": ["material", "aging"],
        "member_types": {"PSI-102": ("measurement", "experiment")},
        "summary": "Particle sizes of smoke from overheated spacecraft materials, fresh and aged, and the instruments "
                   "and detectors used to measure it (SAME).",
    },
    "droplet-extinction": {
        "title": "Droplet Flame Extinction",
        "question": "How do fuel properties and experimental conditions affect droplet burning and flame extinction in "
                    "microgravity?",
        "domain": "Liquid-fuel droplet combustion", "icon": "droplet",
        "phenomena": {"primary": ["droplet_combustion", "flame_extinction"], "secondary": ["cool_flames"]},
        "roles": {"PSI-69": "primary", "PSI-117": "supporting", "PSI-68": "supporting"},
        "filters": ["fuel", "o2", "pressure"],
        "member_types": {"PSI-69": ("experiment",), "PSI-117": ("measurement", "model_result")},
        "summary": "Isolated droplets burning in the ISS (FLEX): burning rate, extinction and cool flames, with "
                   "PSI-117 model-vs-experiment figure data and the FLEX-2 test plan.",
    },
}
FILTER_LABEL = {"material": "Material", "flow": "Flow direction", "geometry": "Sample geometry",
                "configuration": "Flame configuration", "fuel": "Fuel", "o2": "Oxygen (mole fraction)",
                "pressure": "Pressure (atm)", "aging": "Smoke age", "investigation": "Investigation",
                "evidence": "Evidence type"}
EVIDENCE_TYPES = ["measured", "derived", "digitized", "model", "report", "literature", "condition", "log", "passage",
                  "metadata"]


def _short(conn: sqlite3.Connection) -> dict[str, str]:
    return {r[0][4:]: r[1] for r in conn.execute("SELECT node_id, label FROM kg_nodes WHERE node_type='investigation'")}


def _scenario(sid: str) -> dict:
    if sid not in SCENARIOS:
        raise not_found("Scenario", sid)
    return SCENARIOS[sid]


# --- filters ------------------------------------------------------------------------------------------------------
def _members(conn, sc: dict, inv: str) -> list[dict]:
    types = sc["member_types"].get(inv)
    return kg.members(conn, inv, types) if types else []


def _cat_rel(dim: str) -> tuple[str, ...]:
    return {"material": ("USES_MATERIAL", "MEASURED_FOR"), "fuel": ("USES_FUEL", "FOR_FUEL"),
            "flow": ("HAS_CONFIGURATION",), "configuration": ("HAS_CONFIGURATION",)}[dim]


def facets(conn: sqlite3.Connection, sid: str) -> dict:
    """Filter options that exist in the scenario's data, with record counts (no option without records)."""
    sc = _scenario(sid)
    out: dict[str, dict] = {}
    invs = list(sc["roles"])
    ids_by_inv = {inv: [m["node_id"] for m in _members(conn, sc, inv)] for inv in invs}
    all_ids = [i for ids in ids_by_inv.values() for i in ids]
    for dim in sc["filters"]:
        if dim in ("material", "fuel", "flow", "configuration"):
            cnt: Counter = Counter()
            by_inv: dict[str, set] = defaultdict(set)
            for rel in _cat_rel(dim):
                for inv, ids in ids_by_inv.items():
                    for src, dsts in kg.edge_targets(conn, ids, rel).items():
                        for d in dsts:
                            if dim == "flow" and not d.startswith("flow:") or dim == "flow" and d in ("flow:normal", "flow:inverse"):
                                continue
                            if dim == "configuration" and d not in ("flow:normal", "flow:inverse"):
                                continue
                            cnt[d] += 1
                            by_inv[d].add(inv)
            if dim == "fuel":   # planned fuels documented at investigation level only (FLEX-2): listed, 0 records
                for inv in invs:
                    if ids_by_inv[inv]:
                        continue
                    for r in conn.execute("SELECT dst FROM kg_edges WHERE rel='USES_FUEL' AND src=?", (f"inv:{inv}",)):
                        by_inv[r[0]].add(inv)
                        cnt.setdefault(r[0], 0)
            labels = kg.nodes(conn, list(cnt))
            out[dim] = {"label": FILTER_LABEL[dim], "kind": "category", "options": [
                {"value": k, "label": labels[k]["label"], "records": cnt[k], "investigations": sorted(by_inv[k])}
                for k in sorted(cnt, key=lambda k: (-cnt[k], labels[k]["label"]))]}
        elif dim == "geometry":
            cnt = Counter(m["props"].get("geometry") for inv in invs for m in _members(conn, sc, inv)
                          if m["props"].get("geometry"))
            out[dim] = {"label": FILTER_LABEL[dim], "kind": "category", "options": [
                {"value": k, "label": k, "records": n, "investigations": ["PSI-25"]} for k, n in cnt.most_common()]}
        elif dim == "aging":
            cnt = Counter("aged" if m["props"].get("aged") else "fresh" for m in _members(conn, sc, "PSI-102")
                          if m["node_type"] == "measurement")
            out[dim] = {"label": FILTER_LABEL[dim], "kind": "category", "options": [
                {"value": k, "label": "Fresh smoke" if k == "fresh" else "Aged smoke (720 s)", "records": cnt[k],
                 "investigations": ["PSI-102"]} for k in ("fresh", "aged") if cnt[k]]}
        elif dim in ("o2", "pressure"):
            var = kg.CONDITION_VARS["o2" if dim == "o2" else "pressure_atm"]
            vals = [c["value"] for i, cs in kg.conditions_of(conn, all_ids).items() for v, c in cs.items()
                    if v == var and c.get("value") is not None]
            out[dim] = {"label": FILTER_LABEL[dim], "kind": "range",
                        "min": round(min(vals), 3) if vals else None, "max": round(max(vals), 3) if vals else None,
                        "records": len(vals), "unit": "mole fraction" if dim == "o2" else "atm"}
    out["investigation"] = {"label": FILTER_LABEL["investigation"], "kind": "category", "options": [
        {"value": i, "label": _short(conn).get(i, i), "records": len(ids_by_inv[i]), "investigations": [i]} for i in invs]}
    out["evidence"] = {"label": FILTER_LABEL["evidence"], "kind": "category",
                       "options": [{"value": e, "label": e} for e in EVIDENCE_TYPES]}
    return out


def parse_filters(conn: sqlite3.Connection, sid: str, raw: dict[str, str | None]) -> dict:
    """Validate query parameters against the scenario's real facet values. Unknown values are rejected (400)."""
    sc = _scenario(sid)
    fx = facets(conn, sid)
    f: dict = {}
    for dim in sc["filters"] + ["investigation", "evidence"]:
        if dim in ("o2", "pressure"):
            lo, hi = raw.get(f"{dim}_min"), raw.get(f"{dim}_max")
            bounds = (0.0, 1.0) if dim == "o2" else (0.0, 10.0)
            vals = []
            for name, v in ((f"{dim}_min", lo), (f"{dim}_max", hi)):
                if v in (None, ""):
                    vals.append(None)
                    continue
                try:
                    x = float(v)
                except ValueError:
                    raise bad_request(f"{name} must be a number")
                if not bounds[0] <= x <= bounds[1]:
                    raise bad_request(f"{name} must be between {bounds[0]} and {bounds[1]}")
                vals.append(x)
            if vals[0] is not None and vals[1] is not None and vals[0] > vals[1]:
                raise bad_request(f"{dim}_min is larger than {dim}_max")
            if vals != [None, None]:
                f[dim] = tuple(vals)
            continue
        v = raw.get(dim)
        if not v:
            continue
        allowed = {o["value"] for o in fx[dim]["options"]}
        if v not in allowed:
            raise bad_request(f"Unknown {FILTER_LABEL[dim].lower()} '{v}' for this scenario. Allowed: "
                              + ", ".join(sorted(allowed))[:400])
        f[dim] = v
    return f


# --- matching -----------------------------------------------------------------------------------------------------
def match(conn: sqlite3.Connection, sid: str, inv: str, f: dict) -> dict:
    """Condition matching for one investigation. Categories must match exactly; numeric ranges are applied exactly
    (no tolerance); records without a value for a constrained variable are counted as incomplete, never as matches;
    a dimension the investigation does not record is `not_recorded` (not penalized)."""
    sc = _scenario(sid)
    members = _members(conn, sc, inv)
    ids = [m["node_id"] for m in members]
    dims = [d for d in sc["filters"] if d in f]
    res = {"investigation_id": inv, "n_total": len(members), "evaluated": [], "not_recorded": [], "per_dim": {},
           "rejected": {}, "incomplete": {}, "matched": members}
    if not members:
        res["not_recorded"] = dims
        res["matched"] = []
        return res
    keep = set(ids)
    for d in dims:
        if d in ("material", "fuel", "flow", "configuration"):
            tgt: dict[str, set] = defaultdict(set)
            for rel in _cat_rel(d):
                for s, ds in kg.edge_targets(conn, ids, rel).items():
                    tgt[s] |= ds
            if d == "flow":
                recorded = any(x.startswith("flow:") and x not in ("flow:normal", "flow:inverse") for s in tgt.values() for x in s)
            elif d == "configuration":
                recorded = any(x in ("flow:normal", "flow:inverse") for s in tgt.values() for x in s)
            else:
                recorded = any(any(x.startswith("mat:" if d == "material" else "fuel:") for x in s) for s in tgt.values())
            if not recorded:
                res["not_recorded"].append(d)
                continue
            ok = {i for i in ids if f[d] in tgt.get(i, set())}
            if d in ("flow",):   # experiments with no recorded flow direction are incomplete, not rejected
                unk = {i for i in ids if not any(x.startswith("flow:") for x in tgt.get(i, set()))}
                res["incomplete"][d] = len(unk & keep)
            else:
                unk = set()
            res["per_dim"][d] = len(ok)
            res["rejected"][d] = len((keep - ok) - unk)
            keep &= ok
        elif d == "geometry":
            vals = {m["node_id"]: m["props"].get("geometry") for m in members}
            if not any(vals.values()):
                res["not_recorded"].append(d)
                continue
            ok = {i for i, g in vals.items() if g == f[d]}
            res["per_dim"][d], res["rejected"][d] = len(ok), len(keep - ok)
            keep &= ok
        elif d == "aging":
            ms = {m["node_id"]: m for m in members if m["node_type"] == "measurement"}
            if not ms:
                res["not_recorded"].append(d)
                continue
            ok = {i for i, m in ms.items() if bool(m["props"].get("aged")) == (f[d] == "aged")}
            ok |= {i for i in ids if i not in ms}          # flight-log tests are not fresh/aged records: kept as context
            res["per_dim"][d], res["rejected"][d] = len(ok & set(ms)), len((keep & set(ms)) - ok)
            keep &= ok
        elif d in ("o2", "pressure"):
            var = kg.CONDITION_VARS["o2" if d == "o2" else "pressure_atm"]
            conds = kg.conditions_of(conn, ids)
            have = {i: c[var]["value"] for i, c in conds.items() if var in c and c[var].get("value") is not None}
            if not have:
                res["not_recorded"].append(d)
                continue
            lo, hi = f[d]
            ok = {i for i, v in have.items() if (lo is None or v >= lo) and (hi is None or v <= hi)}
            res["per_dim"][d] = len(ok)
            res["incomplete"][d] = len((keep - set(have)))
            res["rejected"][d] = len((keep & set(have)) - ok)
            keep &= ok
        res["evaluated"].append(d)
    if dims:
        res["matched"] = [m for m in members if m["node_id"] in keep]
    return res


# --- ranking ------------------------------------------------------------------------------------------------------
def evidence_class(profile: dict) -> str:
    """Strongest evidence class from what the graph actually holds for the investigation."""
    t = profile["member_types"]
    readiness = profile["props"].get("readiness")
    if profile["measured_outcomes"] > 0 and t.get("experiment"):
        return "measured_outcomes"
    if t.get("measurement") and not t.get("model_result"):
        return "derived_measurements"
    if t.get("measurement") and t.get("model_result"):
        return "figure_and_model"
    if profile["claims"] or t.get("test_day"):
        return "report_statements"
    if t.get("experiment"):
        return "conditions_only"
    if readiness == "metadata_only":
        return "metadata_only"
    return "documentation_only" if profile["documents"] > 1 else "metadata_only"


def rank(conn: sqlite3.Connection, sid: str, f: dict, matches: dict[str, dict] | None = None) -> list[dict]:
    sc = _scenario(sid)
    prim, sec = set(sc["phenomena"]["primary"]), set(sc["phenomena"]["secondary"])
    primary_inv = next(i for i, r in sc["roles"].items() if r == "primary")
    phen_labels = {n["node_id"][5:]: n["label"] for n in kg.nodes(conn, [f"phen:{p}" for p in prim | sec]).values()}
    out = []
    for inv, role in sc["roles"].items():
        p = kg.investigation_profile(conn, inv)
        st = {s["phenomenon"]: s for s in p["studies"]}
        hits_primary = [s for k, s in st.items() if k in prim]
        if any(s["focus"] == "primary" for s in hits_primary):
            topic, tkey = TOPIC_POINTS["primary_focus"], "primary_focus"
        elif hits_primary:
            topic, tkey = TOPIC_POINTS["secondary_focus"], "secondary_focus"
        elif any(k in sec for k in st):
            topic, tkey = TOPIC_POINTS["related_phenomenon"], "related_phenomenon"
        elif inv != primary_inv and any(r["investigation_id"] == primary_inv for r in kg.related(conn, inv)["documented"]):
            topic, tkey = TOPIC_POINTS["documented_relation"], "documented_relation"
        else:
            topic, tkey = 0, "none"
        env_key = "flight" if p["props"].get("flight_platform") else "ground_or_analysis"
        R = topic + ENV_POINTS[env_key] + ROLE_POINTS[role]
        ekey = evidence_class(p)
        E = EVIDENCE_POINTS[ekey][0]
        D = 1.0 if hits_primary else 0.5
        m = (matches or {}).get(inv) or match(conn, sid, inv, f)
        ev = m["evaluated"]
        if not ev:
            A, akey = None, "not_assessed"
        elif m["matched"]:
            A, akey = 100, "all_conditions_met"
        else:
            met = sum(1 for d in ev if m["per_dim"].get(d, 0) > 0)
            A, akey = round(50 * met / len(ev)), "partial" if met else "none_met"
        score = round(WEIGHTS["relevance"] * R + WEIGHTS["evidence"] * E * D + WEIGHTS["applicability"] * A) if A is not None \
            else round((WEIGHTS["relevance"] * R + WEIGHTS["evidence"] * E * D) / (WEIGHTS["relevance"] + WEIGHTS["evidence"]))
        studied = [phen_labels[k] for k in st if k in prim | sec]
        out.append({
            "investigation_id": inv, "short_name": p["label"], "title": p["props"].get("title"), "role": role,
            "readiness": p["props"].get("readiness"), "score": score,
            "components": {
                "relevance": {"value": R, "topic": topic, "topic_basis": tkey, "environment": ENV_POINTS[env_key],
                              "environment_basis": env_key, "role": ROLE_POINTS[role],
                              "studies": [{"phenomenon": k, "label": phen_labels.get(k, k), "focus": s["focus"],
                                           "source_ref": s["source_ref"]} for k, s in st.items() if k in prim | sec]},
                "evidence": {"value": E, "class": ekey, "label": EVIDENCE_POINTS[ekey][1], "directness": D},
                "applicability": {"value": A, "basis": akey, "evaluated": ev, "not_recorded": m["not_recorded"],
                                  "n_match": len(m["matched"]) if ev else None, "n_total": m["n_total"],
                                  "rejected": m["rejected"], "incomplete": m["incomplete"]},
            },
            "explanation": _explain(p["label"], role, tkey, studied, ekey, p, m, score, E),
            "limitations": p["props"].get("limitations", []),
            "related_count": m["n_total"],
            "links": {"analysis": p["props"].get("route"), "studio": p["props"].get("studio")},
        })
    out.sort(key=lambda r: (-r["score"], -r["components"]["evidence"]["value"], r["investigation_id"]))
    for i, r in enumerate(out, 1):
        r["rank"] = i
    return out


def _explain(name: str, role: str, tkey: str, studied: list[str], ekey: str, p: dict, m: dict, score: int,
             E: int) -> str:
    if role == "context" or E <= EVIDENCE_POINTS["documentation_only"][0] or tkey in ("related_phenomenon", "documented_relation", "none"):
        lead = "Supporting context only"
    else:
        lead = "Highly relevant" if score >= 75 else "Relevant" if score >= 50 else "Supporting context only"
    t = p["member_types"]
    if ekey == "measured_outcomes":
        ev = f"it measured outcomes for {p['measured_outcomes']} tests"
    elif ekey == "derived_measurements":
        ev = f"it reports {t.get('measurement', 0)} report-backed measurement rows"
    elif ekey == "figure_and_model":
        ev = f"it provides {t.get('measurement', 0)} published experimental series and {t.get('model_result', 0)} model series (figure data)"
    elif ekey == "report_statements" and t.get("experiment"):
        ev = f"it gives test conditions for {t['experiment']} tests and report statements, but no per-test outcomes"
    elif ekey == "report_statements":
        ev = "it offers report statements and operational logs, not per-test measurements"
    elif ekey == "conditions_only":
        ev = f"it lists conditions for {t.get('experiment', 0)} tests, but no outcomes are in the download"
    elif ekey == "documentation_only":
        ev = "only documents and a planned test matrix were downloaded, with no measurements"
    else:
        ev = "only metadata was downloaded, with no measurements"
    topic = {"primary_focus": f"it studies {studied[0].lower()}" if studied else "it studies the topic",
             "secondary_focus": f"{studied[0].lower()} is a secondary topic" if studied else "secondary topic",
             "related_phenomenon": f"it studies a related topic ({', '.join(s.lower() for s in studied)})",
             "documented_relation": "it has a documented relation to the primary investigation",
             "none": "it is not linked to this topic in the graph"}[tkey]
    s = f"{lead}: {topic}, and {ev}."
    if m["evaluated"]:
        if m["matched"]:
            s += f" {len(m['matched'])} of {m['n_total']} records meet the selected conditions."
        else:
            s += " No record meets all the selected conditions."
    if m["not_recorded"]:
        s += f" It does not record {', '.join(FILTER_LABEL[d].lower() for d in m['not_recorded'])}, so that is not scored."
    if role == "context":
        s += " Indirect evidence: use for context only."
    return s


# --- evidence -----------------------------------------------------------------------------------------------------
def _doc_ref(source_ref: str) -> dict:
    m = re.match(r"^([\w.\-]+)#page=(\d+)$", source_ref or "")
    if m:
        return {"document_id": m.group(1), "page": int(m.group(2)), "ref": source_ref}
    return {"document_id": None, "page": None, "ref": source_ref}


def _item(conn, id_, inv, kind, title, observation, conditions, source, limitations=(), links=(), **extra) -> dict:
    return {"id": id_, "investigation_id": inv, "evidence_class": kind, "title": title, "observation": observation,
            "conditions": {k: v for k, v in conditions.items() if v not in (None, "", [])}, "source": source,
            "limitations": list(limitations), "links": [l for l in links if l and l.get("href")], **extra}


def _fmt(x, nd=3):
    if x is None:
        return None
    if isinstance(x, float):
        return f"{x:.{nd}g}"
    return str(x)


def _passages(conn, q: str, inv: str, n: int = 2) -> list[dict]:
    try:
        res = retrieval.search(conn, q[:480], investigation=inv, source_type="nasa_document", limit=n)
    except Exception:   # retrieval failure must not break the Explorer
        return []
    return [_item(conn, r["chunk_id"], inv, "passage", r["title"], r["snippet"], {"Section": r.get("section")},
                  {"label": f"{r['title']}, PDF p.{r['page_pdf']}" if r.get("page_pdf") else r["title"],
                   "document_id": r["document_id"], "page": r.get("page_pdf"), "ref": r["chunk_id"]},
                  links=[{"label": "Open source page", "href": r.get("source_url")}]) for r in res["results"]]


def _claims(conn, inv: str) -> list[dict]:
    out = []
    for r in conn.execute("SELECT n.* FROM kg_edges e JOIN kg_nodes n ON n.node_id=e.dst WHERE e.rel='REPORTS' AND e.src=?",
                          (f"inv:{inv}",)):
        p = jloads(r["props_json"], {})
        out.append(_item(conn, r["node_id"], inv, "report", "Reported finding", r["label"], {},
                         {"label": f"Final report, PDF p.{p.get('page_pdf')}", "document_id": p.get("document_id"),
                          "page": p.get("page_pdf"), "ref": r["node_id"]},
                         links=[{"label": "Open report page", "href": f"/api/v1/documents/{p.get('document_id')}/file#page={p.get('page_pdf')}"}]))
    return out


def _evidence_flame_spread(conn, sid, f, M) -> tuple[list[dict], dict]:
    items = []
    m = M["PSI-25"]
    ids = [x["node_id"] for x in m["matched"]]
    outs = kg.outcomes_of(conn, ids)
    byid = {x["node_id"]: x for x in m["matched"]}
    groups: dict[tuple, list[float]] = defaultdict(list)
    for i in ids:
        for o in outs.get(i, []):
            if o["outcome"] != "out:psi-25:spread-rate-reported":
                continue
            p = byid[i]["props"]
            rates = [r for r in (o.get("spread_rate_mm_s") or []) if isinstance(r, (int, float))]
            groups[(p.get("material_class"), p.get("flow_direction") or "not recorded")] += rates
            src = _doc_ref(o["source_ref"])
            if len(items) < 8:
                items.append(_item(
                    conn, i, "PSI-25", "measured", f"BASS-II {p.get('display_id')}: flame spread rate",
                    f"Spread rate {', '.join(_fmt(r) for r in rates)} mm/s at airflow "
                    f"{', '.join(_fmt(v) for v in (o.get('velocity_cm_s') or [])) or 'n/a'} cm/s "
                    f"({o.get('status') or 'reported'}).",
                    {"Material": p.get("material_class"), "Geometry": p.get("geometry"),
                     "Flow": p.get("flow_direction"), "Initial O₂ (mole fraction)": _fmt(p.get("x_o2"))},
                    {"label": f"BASS-II Summary Report Table {o.get('table')}, row {o.get('row')}, PDF p.{src['page']}",
                     **src},
                    links=[{"label": "View experiment", "href": f"/experiments/bass2/{p.get('uid')}"},
                           {"label": "Open in 3D Studio", "href": f"/phenomena/flame-spread?record={p.get('uid')}#studio"}]))
    for x in M["PSI-98"]["matched"]:
        p = x["props"]
        items.append(_item(conn, x["node_id"], "PSI-98", "measured", f"SAFFIRE-I burn {p.get('display_id')}",
                           f"Large-scale burn of {p.get('material')} in {str(p.get('flow_direction') or '').lower()} flow"
                           f"{', burn time ' + _fmt(p.get('burn_time_s')) + ' s' if p.get('burn_time_s') else ''}.",
                           {"Air flow (cm/s)": _fmt(p.get("air_cm_s")), "O₂ (% vol, as printed)": p.get("o2_raw")},
                           {"label": "SAFFIRE-I burn table (CSV row)", "document_id": None, "page": None,
                            "ref": f"experiments:{p.get('uid')}"},
                           ["One spacecraft-scale burn per flow direction: not a parametric study."],
                           [{"label": "View experiment", "href": f"/experiments/saffire1/{p.get('uid')}"},
                            {"label": "Open in 3D Studio", "href": "/phenomena/spacecraft-fire#studio"}]))
    items.append(_item(conn, "inv:PSI-62", "PSI-62", "metadata", "PSI-62: concurrent flame-spread modelling",
                       "Develops flamelet-generated-manifold models of concurrent flame spread benchmarked on BASS/BASS-II. "
                       "Only the ISA-Tab metadata was downloaded: no model output is available.", {},
                       {"label": "PSI-62 ISA-Tab metadata", "document_id": "psi-62-isatab", "page": None,
                        "ref": "investigation_registry:PSI-62"},
                       ["Metadata only: no measurements, no model results."],
                       [{"label": "PSI-62 at NASA PSI", "href": "https://psi.nasa.gov/physci/repo/data/investigations/PSI-62"}]))
    for c in _claims(conn, "PSI-20")[:1]:
        c["limitations"] = ["Burning-rate emulation on a gas burner: not a measured BASS-II flame-spread rate."]
        items.append(c)
    q = SCENARIOS[sid]["question"] + " " + " ".join(str(v) for k, v in f.items() if k in ("geometry",))
    items += _passages(conn, q, "PSI-25")
    summary = {"kind": "spread_rates", "title": "Reported BASS-II spread rates for the matching tests",
               "note": "Grouped by material form and flow direction only. Groups differ in thickness, width and airflow, "
                       "so rates are listed, not averaged or compared across groups.",
               "groups": [{"material": k[0], "flow": k[1], "n": len(v), "min": min(v), "max": max(v)}
                          for k, v in sorted(groups.items(), key=lambda kv: (str(kv[0][0]), kv[0][1])) if v],
               "n_tests": len(ids)}
    return items, summary


def _evidence_gaseous(conn, sid, f, M) -> tuple[list[dict], dict]:
    items = []
    m = M["PSI-159"]
    ids = [x["node_id"] for x in m["matched"]]
    outs = kg.outcomes_of(conn, ids)
    byid = {x["node_id"]: x for x in m["matched"]}
    meas = kg.edge_targets(conn, ids, "HAS_MEASUREMENT")
    cool_nodes = kg.nodes(conn, sorted({d for s in meas.values() for d in s}))
    for nid, n in sorted(cool_nodes.items())[:4]:
        p = n["props"]
        fl = p.get("flags") or []
        parts = []
        if p.get("r_hot_mm") is not None:
            parts.append(f"hot-flame radius {_fmt(p['r_hot_mm'])} mm before the cool flame")
        parts.append(f"cool-flame radius {_fmt(p['r_cool_mm'])} mm" if p.get("r_cool_mm") is not None
                     else "cool-flame radius not measured (Table 3 footnote)")
        if p.get("duration_s") is not None:
            parts.append(f"duration {_fmt(p['duration_s'])} s")
        items.append(_item(conn, nid, "PSI-159", "measured", n["label"],
                           "Cool flame observed: " + ", ".join(parts) + ".",
                           {"Fuel": p.get("fuel"), "Configuration": p.get("configuration"),
                            "O₂ (mole fraction)": _fmt(p.get("x_o2")), "Pressure (bar)": _fmt(p.get("p_bar"))},
                           {"label": "CFI-G Final Report Table 3, PDF p.46", "document_id": "psi-159-reports-finalrpt-acme-cfi-g",
                            "page": 46, "ref": nid},
                           ["Cool-flame radii apply to this condition only; they are not transferable."] + fl,
                           [{"label": "View test", "href": f"/phenomena/gaseous-flames?{urlencode({'tab': 'cfig', 'test': p.get('test_id')})}#cfig-lookup"},
                            {"label": "Open in 3D Studio", "href": "/phenomena/gaseous-flames#studio"}]))
    seen = set()
    for i in ids:   # one representative test per outcome and configuration, in source order
        p = byid[i]["props"]
        key = (p.get("outcome"), p.get("configuration"))
        if key in seen or not p.get("outcome"):
            continue
        seen.add(key)
        o = (outs.get(i) or [{}])[0]
        bt = p.get("burn_time_s")
        bt_txt = ("" if bt is None else f" Burn time {_fmt(bt)} s" + (" (censored: the run was stopped, so the flame "
                                                                     "lasted at least this long)." if o.get("censored") else "."))
        items.append(_item(conn, i, "PSI-159", "measured", f"CFI-G test {p.get('test_id')}",
                           f"Outcome: {o.get('label', p.get('outcome'))}.{bt_txt}",
                           {"Fuel": p.get("fuel"), "Configuration": p.get("configuration"),
                            "O₂ (mole fraction)": _fmt(p.get("x_o2")), "Pressure (bar)": _fmt(p.get("p_bar"))},
                           {"label": "PSI-159 experimental table (CSV)", "document_id": None, "page": None, "ref": i},
                           ["One test point: not an independent hot-flame event count (CSV and report count flames "
                            "differently)."],
                           [{"label": "View test", "href": f"/phenomena/gaseous-flames?{urlencode({'tab': 'cfig', 'test': p.get('test_id')})}#cfig-lookup"}]))
        if len(seen) >= 4:
            break
    if len(cool_nodes) > 4:
        items.append(_item(conn, "cfig:table3", "PSI-159", "measured", "More cool-flame events in Table 3",
                           f"{len(cool_nodes) - 4} more cool-flame event(s) in the selection are listed in Table 3.", {},
                           {"label": "CFI-G Final Report Table 3, PDF p.46",
                            "document_id": "psi-159-reports-finalrpt-acme-cfi-g", "page": 46, "ref": "cfig_cool_flames"},
                           links=[{"label": "Open the cool-flame table", "href": "/phenomena/gaseous-flames?tab=cfig#cfig-cool"}]))
    fdm = M["PSI-10"]
    if fdm["evaluated"] or fdm["matched"]:
        items.append(_item(conn, "inv:PSI-10", "PSI-10", "condition", "ACME Flame Design: matching test conditions",
                           f"{len(fdm['matched'])} of {fdm['n_total']} Flame Design tests have conditions in the "
                           "selected range. Their outcomes are not in the NASA download.",
                           {}, {"label": "PSI-10 experimental tables (CSV)", "document_id": None, "page": None,
                                "ref": "p13_datasets:fd_conditions"},
                           ["Conditions only: no measured outcomes."],
                           [{"label": "Explore Flame Design conditions", "href": "/phenomena/gaseous-flames?tab=flame-design"}]))
    items += _claims(conn, "PSI-10")[:2]
    for c in _claims(conn, "PSI-20")[:2]:
        c["limitations"] = ["BRE emulates condensed-fuel burning on a gas burner; its results are not CFI-G outcomes."]
        items.append(c)
    items += _passages(conn, "cool flame conditions normal inverse diffusion flame extinction", "PSI-159")
    dist = {cfg: Counter() for cfg in ("normal", "inverse")}
    censored = Counter()
    for i in ids:
        p = byid[i]["props"]
        for o in outs.get(i, []):
            if o["outcome"].endswith("cool-flame-observed"):
                continue
            dist[p.get("configuration")][o["label"]] += 1
            censored[p.get("configuration")] += bool(o.get("censored"))
    summary = {"kind": "outcomes", "title": "Observed CFI-G outcomes for the matching tests",
               "note": "Normal and inverse flames are counted separately. Flow-terminated (FT) burn times are censored. "
                       "Counts are test points, not independent hot-flame events.",
               "by_configuration": {k: dict(v.most_common()) for k, v in dist.items() if v},
               "censored": dict(censored), "cool_flame_events": len(cool_nodes), "n_tests": len(ids)}
    return items, summary


def _evidence_smoke(conn, sid, f, M) -> tuple[list[dict], dict]:
    items = []
    m = M["PSI-102"]
    rows = [x for x in m["matched"] if x["node_type"] == "measurement"]
    for x in rows:
        p = x["props"]
        items.append(_item(conn, x["node_id"], "PSI-102", "derived", x["label"],
                           f"Geometric mean diameter {p.get('dg_nm')} nm, arithmetic mean {p.get('d10_nm')} nm, diameter of "
                           f"average mass {p.get('d30_nm')} nm, geometric standard deviation {p.get('sigma_g')}.",
                           {"Smoke age (s)": p.get("aging_s"), "Flight": p.get("flight")},
                           {"label": "SAME Final Science Report Table 1, PDF p.27",
                            "document_id": "same-final-science-report-03-18-10-with-papers-attached", "page": 27,
                            "ref": x["node_id"]},
                           ["Moment-method statistics assume a log-normal size distribution."],
                           [{"label": "Explore the size charts", "href": "/phenomena/smoke-detection#sizes"},
                            {"label": "Open in 3D Studio", "href": f"/phenomena/smoke-detection?{urlencode({'material': p.get('material')})}#studio"}]))
    tests = [x for x in m["matched"] if x["node_type"] == "experiment"]
    if tests:
        mats = Counter(x["props"].get("sample") for x in tests)
        items.append(_item(conn, "same:flight-log", "PSI-102", "log", "SAME flight-test log",
                           f"{len(tests)} logged tests: " + ", ".join(f"{k} {v}" for k, v in mats.most_common()) + ".",
                           {}, {"label": "SAME Final Science Report Appendix A, PDF p.33",
                                "document_id": "same-final-science-report-03-18-10-with-papers-attached", "page": 33,
                                "ref": "p13_datasets:same_flight_log"},
                           ["Log of what was run; the 1 Hz telemetry is not processed (deferred)."],
                           [{"label": "Open the flight log", "href": "/phenomena/smoke-detection#log"}]))
    for r in conn.execute("SELECT n.*, e.source_ref FROM kg_edges e JOIN kg_nodes n ON n.node_id=e.dst "
                          "WHERE e.rel='USES_INSTRUMENT' AND e.src='inv:PSI-102'"):
        p = jloads(r["props_json"], {})
        src = _doc_ref(r["source_ref"])
        items.append(_item(conn, r["node_id"], "PSI-102", "report", r["label"], f"Role in SAME: {p.get('role')}.", {},
                           {"label": "SAME documents" + (f", PDF p.{src['page']}" if src["page"] else ""), **src},
                           ["Instrument description, not a detector sensitivity value."],
                           [{"label": "How the detectors work", "href": "/phenomena/smoke-detection#instruments"}]))
    items += _passages(conn, "smoke particle size detector response aging " + (f.get("material") or "").replace("mat:", ""),
                       "PSI-102")
    by_mat: dict[str, dict] = defaultdict(dict)
    for x in [x for x in M["PSI-102"]["matched"] if x["node_type"] == "measurement"]:
        p = x["props"]
        by_mat[p.get("material")]["aged" if p.get("aged") else "fresh"] = {"d10_nm": p.get("d10_nm"), "dg_nm": p.get("dg_nm"),
                                                                            "d30_nm": p.get("d30_nm")}
    summary = {"kind": "sizes", "title": "SAME particle sizes for the selection",
               "note": "Same instrument set and method for every material, so fresh and aged values of one material can be "
                       "compared. Sizes do not give detector alarm thresholds.",
               "by_material": dict(by_mat), "n_rows": len(rows), "n_tests": len(tests)}
    return items, summary


def _evidence_droplet(conn, sid, f, M) -> tuple[list[dict], dict]:
    items = []
    m = M["PSI-69"]
    ids = [x["node_id"] for x in m["matched"]]
    outs = kg.outcomes_of(conn, ids)
    seen: set = set()
    for x in m["matched"]:
        p = x["props"]
        key = (p.get("fuel"), p.get("test_end"))
        if key in seen:
            continue
        seen.add(key)
        items.append(_item(conn, x["node_id"], "PSI-69", "measured", f"FLEX test {p.get('display_id')}",
                           f"Test end: {p.get('test_end')}. Initial diameter {_fmt(p.get('d0_mm'))} mm"
                           + (f", burning-rate constant K {_fmt(p.get('k_mm2_s'))} mm²/s" if p.get("k_mm2_s") is not None else "")
                           + (f", extinction diameter {_fmt(p.get('dext_mm'))} mm" if p.get("dext_mm") is not None else "") + ".",
                           {"Fuel": p.get("fuel"), "Diluent": p.get("diluent"), "O₂ (mole fraction)": _fmt(p.get("x_o2")),
                            "Pressure (atm)": _fmt(p.get("pressure_atm"))},
                           {"label": "FLEX experiment table (CSV row)", "document_id": None, "page": None,
                            "ref": f"experiments:{p.get('uid')}"},
                           ["The CSV header 'Burning rate; mm' is K in mm²/s (quality rule K-UNIT)."] if p.get("k_mm2_s") else [],
                           [{"label": "View experiment", "href": f"/experiments/flex/{p.get('uid')}"},
                            {"label": "Open in 3D Studio", "href": f"/phenomena/flame-extinction?record={p.get('uid')}#studio"}]))
        if len(seen) >= 6:
            break
    pm = M["PSI-117"]
    figs: dict[str, Counter] = defaultdict(Counter)
    for x in pm["matched"]:
        figs[x["props"].get("figure")][x["node_type"]] += 1
    for fig, c in sorted(figs.items())[:4]:
        node = kg.nodes(conn, [f"fig:psi117:{fig}"]).get(f"fig:psi117:{fig}")
        items.append(_item(conn, f"fig:psi117:{fig}", "PSI-117", "digitized" if c.get("measurement") else "model",
                           f"PSI-117 figure: {node['label'] if node else fig}",
                           f"{c.get('measurement', 0)} experimental series (published figure data) and "
                           f"{c.get('model_result', 0)} model series (1-D sphero-symmetric model).",
                           {}, {"label": f"PSI-117 analysed data ({node['props'].get('file') if node else fig})",
                                "document_id": None, "page": None, "ref": f"fig:psi117:{fig}"},
                           ["Model curves are predictions, not measurements.", "Not joined to FLEX rows (no verified mapping)."],
                           [{"label": "Explore PSI-117 charts", "href": "/phenomena/flame-extinction#psi117-explore"}]))
    items.append(_item(conn, "inv:PSI-68", "PSI-68", "condition", "FLEX-2: planned test matrix",
                       "FLEX-2 planned mixed and surrogate fuels at 0.5–3 atm and O₂ mole fractions 0.17–0.30. Only the "
                       "test-matrix envelope and documents were downloaded: no FLEX-2 outcome data.", {},
                       {"label": "FLEX-2 Science Requirements Document, PDF p.33", "document_id": "flex-2-srd-final",
                        "page": 33, "ref": "p13_datasets:flex2_envelope"},
                       ["Conditions only: no measurements."],
                       [{"label": "FLEX-2 context", "href": "/phenomena/flame-extinction#flex2"}]))
    items += _passages(conn, "droplet flame extinction burning rate oxygen " + (f.get("fuel") or "").replace("fuel:", ""),
                       "PSI-69")
    dist: dict[str, Counter] = defaultdict(Counter)
    for x in m["matched"]:
        dist[x["props"].get("fuel")][x["props"].get("test_end")] += 1
    summary = {"kind": "test_end", "title": "How the matching FLEX tests ended",
               "note": "Counts of FLEX tests by recorded test end. The test matrix was adaptive, so counts are not "
                       "probabilities of extinction.",
               "by_fuel": {k: dict(v.most_common()) for k, v in dist.items()}, "n_tests": len(ids),
               "psi117_series": sum(sum(c.values()) for c in figs.values())}
    return items, summary


EVIDENCE_BUILDERS = {"flame-spread": _evidence_flame_spread, "gaseous-flames": _evidence_gaseous,
                     "smoke-detection": _evidence_smoke, "droplet-extinction": _evidence_droplet}


# --- interpretation -----------------------------------------------------------------------------------------------
def _interpret(sid: str, summary: dict, ranked: list[dict], f: dict, primary_match: dict) -> dict:
    shows: list[str] = []
    if sid == "flame-spread":
        n = summary["n_tests"]
        g = summary["groups"]
        shows.append(f"{n} BASS-II tests are in the selection; {sum(x['n'] for x in g)} spread-rate values reported in the "
                     f"Summary Report cover {len(g)} material/flow group(s)." if n else NO_MATCH)
        for x in g[:3]:
            shows.append(f"{x['material']}, {x['flow']} flow: {x['n']} value(s) between {x['min']:.3g} and {x['max']:.3g} mm/s.")
        matters = ("Flame spread in low airflow is how a small fire grows on cabin materials; BASS-II measured it in the "
                   "flow regime a spacecraft ventilation system produces.")
        cannot = ["Spread rates do not certify a material as safe or unsafe.",
                  "Values from different thicknesses, geometries or airflows are not interchangeable.",
                  "BRE burning-rate emulation is not a BASS-II flame-spread measurement."]
    elif sid == "gaseous-flames":
        bc = summary["by_configuration"]
        if summary["n_tests"]:
            for cfg, d in bc.items():
                tot = sum(d.values())
                shows.append(f"{cfg.capitalize()} flames: {tot} tests in the selection; " +
                             ", ".join(f"{k} {v}" for k, v in d.items()) + ".")
            shows.append(f"{summary['cool_flame_events']} cool-flame event(s) from Table 3 fall in the selection.")
        else:
            shows.append(NO_MATCH)
        matters = ("Which conditions let a gas flame persist, go out by itself or turn into a cool flame bounds how a "
                   "leak-fed flame could behave in a spacecraft atmosphere.")
        cannot = ["No continuous flame prediction is made between or beyond the tested conditions.",
                  "Flow-terminated burn times are lower bounds, not burn durations.",
                  "Test points are not independent hot-flame events; the CSV and report count flames differently."]
    elif sid == "smoke-detection":
        bm = summary["by_material"]
        for mat, d in bm.items():
            if "fresh" in d and "aged" in d and d["fresh"]["d10_nm"] and d["aged"]["d10_nm"]:
                shows.append(f"{mat}: arithmetic mean diameter {d['fresh']['d10_nm']} nm fresh, {d['aged']['d10_nm']} nm "
                             "after aging (Table 1).")
            elif d:
                k = next(iter(d))
                shows.append(f"{mat}: {k} smoke, arithmetic mean diameter {d[k]['d10_nm']} nm.")
        if not bm:
            shows.append(NO_MATCH if f else "No particle-size rows selected.")
        matters = ("Detectors respond differently to small and large particles; knowing the sizes overheated materials "
                   "produce, and how aging grows them, tells detector designers what they must sense.")
        cannot = ["No detector sensitivity, alarm time or early-warning capability is computed.",
                  "Sizes are moment-method statistics, not full measured size distributions."]
    else:
        bf = summary["by_fuel"]
        for fuel, d in bf.items():
            shows.append(f"{fuel}: {sum(d.values())} FLEX tests in the selection; " + ", ".join(f"{k} {v}" for k, v in d.items()) + ".")
        if not bf:
            shows.append(NO_MATCH)
        if summary["psi117_series"]:
            shows.append(f"PSI-117 provides {summary['psi117_series']} figure-data series for the selected fuel(s), "
                         "separated into experiment and model.")
        matters = ("Droplets are the simplest burning geometry; how they burn and go out in microgravity tests combustion "
                   "models used for liquid-fuel fires.")
        cannot = ["Test-end counts are not extinction probabilities (the test matrix was adaptive).",
                  "PSI-117 tests are not mapped to FLEX rows; model curves are not measurements.",
                  "FLEX-2 has no outcome data in the download."]
    missing = []
    for r in ranked:
        for l in r["limitations"]:
            missing.append(f"{r['short_name']}: {l['text']}")
    if primary_match["not_recorded"]:
        missing.append("Not recorded by the primary investigation: "
                       + ", ".join(FILTER_LABEL[d].lower() for d in primary_match["not_recorded"]) + ".")
    return {"shows": shows, "why_it_matters": matters, "cannot_conclude": cannot, "missing": missing[:8]}


# --- links --------------------------------------------------------------------------------------------------------
def _links(sid: str, f: dict, M: dict, items: list[dict], conn) -> dict:
    labels = {n["node_id"]: n["label"] for n in kg.nodes(conn, [v for v in f.values() if isinstance(v, str)]).values()}
    if sid == "flame-spread":
        spread = next((i["id"][4:] for i in items if i["investigation_id"] == "PSI-25" and i["evidence_class"] == "measured"), None)
        first = next((x for x in M["PSI-25"]["matched"]), None)
        uid = spread or (first["props"].get("uid") if first else None)
        return {"charts": {"label": "Explore BASS-II charts", "href": "/phenomena/flame-spread#spread"},
                "studio": {"label": "Open the BASS-II 3D Studio",
                           "href": f"/phenomena/flame-spread?record={uid}#studio" if uid else "/phenomena/flame-spread#studio",
                           "note": "The studio shows the selected test's evidence; the flame shape is conceptual."},
                "experiment": {"label": "View experiment", "href": f"/experiments/bass2/{uid}"} if uid else None}
    if sid == "gaseous-flames":
        q = {"tab": "cfig"}
        if f.get("configuration"):
            q["cfg"] = f["configuration"].split(":")[1]
        if f.get("fuel") and f["fuel"] in ("fuel:ethane", "fuel:propane", "fuel:n-butane"):
            q["fuel"] = f["fuel"].split(":")[1]
        if f.get("o2"):
            if f["o2"][0] is not None:
                q["o2min"] = f["o2"][0]
            if f["o2"][1] is not None:
                q["o2max"] = f["o2"][1]
        first = next((x for x in M["PSI-159"]["matched"]), None)
        tid = first["props"].get("test_id") if first else None
        return {"charts": {"label": "Explore Gaseous Flame Dynamics charts", "href": f"/phenomena/gaseous-flames?{urlencode(q)}"},
                "studio": {"label": "Open the Gaseous Flame 3D Studio", "href": "/phenomena/gaseous-flames#studio",
                           "note": "Conceptual 3D; measured radii are drawn only for the Table 3 event you pick there."},
                "experiment": {"label": f"View CFI-G test {tid}",
                               "href": f"/phenomena/gaseous-flames?{urlencode({'tab': 'cfig', 'test': tid})}#cfig-lookup"} if tid else None}
    if sid == "smoke-detection":
        mat = next((x["props"].get("material") for x in M["PSI-102"]["matched"] if x["node_type"] == "measurement"), None)
        return {"charts": {"label": "Explore SAME particle-size charts", "href": "/phenomena/smoke-detection#sizes"},
                "studio": {"label": "Open the Smoke Detection 3D Studio",
                           "href": f"/phenomena/smoke-detection?{urlencode({'material': mat})}#studio" if mat and f.get("material")
                           else "/phenomena/smoke-detection#studio",
                           "note": "Original simplified schematic; particle dots are not drawn to measured sizes."},
                "experiment": {"label": "Open the flight log", "href": "/phenomena/smoke-detection#log"}}
    q = {}
    if f.get("fuel") in ("fuel:n-heptane", "fuel:methanol"):
        q["fuel"] = "Heptane" if f["fuel"] == "fuel:n-heptane" else "Methanol"
    if f.get("o2"):
        if f["o2"][0] is not None:
            q["o2_min"] = f["o2"][0]
        if f["o2"][1] is not None:
            q["o2_max"] = f["o2"][1]
    first = next((x for x in M["PSI-69"]["matched"]), None)
    uid = first["props"].get("uid") if first else None
    return {"charts": {"label": "Explore FLEX charts", "href": f"/phenomena/flame-extinction{'?' + urlencode(q) if q else ''}#map"},
            "studio": {"label": "Open the FLEX 3D Studio",
                       "href": f"/phenomena/flame-extinction?record={uid}#studio" if uid else "/phenomena/flame-extinction#studio",
                       "note": "The studio shows the selected test's measured values; the flame drawing is conceptual."},
            "experiment": {"label": "View experiment", "href": f"/experiments/flex/{uid}"} if uid else None,
            "psi117": {"label": "PSI-117 model vs experiment", "href": "/phenomena/flame-extinction#psi117-explore"}}


def copilot_link(sid: str, inv: str, test: str | None, evidence: list[str]) -> str:
    q = {"draft": SCENARIOS[sid]["question"], "inv": inv, "scenario": sid}
    if test:
        q["test"] = test
    if evidence:
        q["evidence"] = ",".join(evidence[:5])
    return "/copilot?" + urlencode(q)


# --- public API ---------------------------------------------------------------------------------------------------
def scenarios(conn: sqlite3.Connection) -> dict:
    out = []
    short = _short(conn)
    for sid, sc in SCENARIOS.items():
        prim = next(i for i, r in sc["roles"].items() if r == "primary")
        out.append({"id": sid, "title": sc["title"], "question": sc["question"], "domain": sc["domain"],
                    "icon": sc["icon"], "summary": sc["summary"], "primary": {"investigation_id": prim, "short_name": short.get(prim)},
                    "supporting": [{"investigation_id": i, "short_name": short.get(i), "role": r}
                                   for i, r in sc["roles"].items() if r != "primary"],
                    "records": sum(len(_members(conn, sc, i)) for i in sc["roles"])})
    return {"scenarios": out, "disclaimer": DISCLAIMER,
            "ranking": {"weights": WEIGHTS, "topic_points": TOPIC_POINTS, "role_points": ROLE_POINTS,
                        "environment_points": ENV_POINTS,
                        "evidence_points": {k: {"points": v[0], "label": v[1]} for k, v in EVIDENCE_POINTS.items()}}}


def workspace(conn: sqlite3.Connection, sid: str, raw: dict[str, str | None]) -> dict:
    if not kg.available(conn):
        raise bad_request("The knowledge graph is not built. Run: python -m app.ingest.kg")
    sc = _scenario(sid)
    f = parse_filters(conn, sid, raw)
    M = {inv: match(conn, sid, inv, f) for inv in sc["roles"]}
    ranked = rank(conn, sid, f, M)
    items, summary = EVIDENCE_BUILDERS[sid](conn, sid, f, M)
    if f.get("investigation"):
        items = [i for i in items if i["investigation_id"] == f["investigation"]]
    if f.get("evidence"):
        items = [i for i in items if i["evidence_class"] == f["evidence"]]
    prim = next(i for i, r in sc["roles"].items() if r == "primary")
    links = _links(sid, f, M, items, conn)
    first_test = None
    if M[prim]["matched"]:
        p0 = M[prim]["matched"][0]
        first_test = p0["props"].get("uid") or p0["props"].get("test_id")
    ev_ids = [i["id"] for i in items if i["evidence_class"] in ("measured", "derived", "digitized")][:3]
    for r in ranked:
        r["links"]["copilot"] = copilot_link(sid, r["investigation_id"], first_test if r["investigation_id"] == prim else None,
                                             [e for e in ev_ids if any(x["id"] == e and x["investigation_id"] == r["investigation_id"] for x in items)])
    links["copilot"] = {"label": "Ask Research Copilot", "href": copilot_link(sid, f.get("investigation") or prim,
                                                                             first_test, ev_ids)}
    no_match = bool(M[prim]["evaluated"]) and not M[prim]["matched"]
    return {
        "scenario": {"id": sid, "title": sc["title"], "question": sc["question"], "domain": sc["domain"],
                     "summary": sc["summary"], "phenomena": sc["phenomena"]},
        "filters": {k: (list(v) if isinstance(v, tuple) else v) for k, v in f.items()},
        "facets": facets(conn, sid),
        "ranked": ranked,
        "matching": {inv: {k: m[k] for k in ("n_total", "evaluated", "not_recorded", "per_dim", "rejected", "incomplete")}
                     | {"n_match": len(m["matched"])} for inv, m in M.items()},
        "no_match": no_match, "no_match_message": NO_MATCH if no_match else None,
        "evidence": items, "summary": summary,
        "interpretation": _interpret(sid, summary, ranked, f, M[prim]),
        "links": links, "disclaimer": DISCLAIMER,
    }

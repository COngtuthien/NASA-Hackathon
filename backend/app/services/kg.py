"""Phase 14 knowledge-graph queries over kg_nodes / kg_edges (SQLite). Used by the Explorer, the Copilot and /graph.

Supported queries
1. investigations_studying(phenomenon)            Investigation -STUDIES-> Phenomenon
2. experiments_for(fuel | material, investigation) Experiment -USES_FUEL/USES_MATERIAL-> Fuel/Material
3. outcomes_under(investigation, filters)          Experiment -HAS_CONDITION-> var (value in range) and -HAS_OUTCOME->
4. evidence_for(node)                              REPORTED_IN / SUPPORTED_BY / BELONGS_TO / DOCUMENTED_IN chains
5. related(investigation)                          Investigation -RELATED_TO-> Investigation (documented relation)
Unknown ids raise 404; a condition that an investigation does not record is reported as `not_recorded`, never as a
failed experiment.
"""
from __future__ import annotations

import sqlite3
from collections import Counter, defaultdict

from ..core.errors import bad_request, not_found
from ..db.database import jloads

CONDITION_VARS = {"o2": "var:o2_mole_fraction", "pressure_atm": "var:pressure_atm",
                  "d0_mm": "var:initial_diameter_mm", "flow_cm_s": "var:flow_velocity_cm_s",
                  "fuel_flow_mg_s": "var:fuel_mass_flow_mg_s", "aging_s": "var:aging_s"}


def available(conn: sqlite3.Connection) -> bool:
    try:
        return conn.execute("SELECT count(*) FROM kg_nodes").fetchone()[0] > 0
    except sqlite3.OperationalError:
        return False


def _node(r) -> dict:
    return {"node_id": r["node_id"], "node_type": r["node_type"], "label": r["label"],
            "investigation_id": r["investigation_id"], "props": jloads(r["props_json"], {})}


def _edge(r) -> dict:
    return {"src": r["src"], "rel": r["rel"], "dst": r["dst"], "basis": r["basis"], "source_ref": r["source_ref"],
            "props": jloads(r["props_json"], {})}


def node(conn: sqlite3.Connection, node_id: str) -> dict:
    r = conn.execute("SELECT * FROM kg_nodes WHERE node_id=?", (node_id,)).fetchone()
    if not r:
        raise not_found("Graph node", node_id)
    return _node(r)


def nodes(conn: sqlite3.Connection, ids: list[str]) -> dict[str, dict]:
    if not ids:
        return {}
    out = {}
    for i in range(0, len(ids), 500):
        chunk = ids[i:i + 500]
        for r in conn.execute(f"SELECT * FROM kg_nodes WHERE node_id IN ({','.join('?' * len(chunk))})", chunk):
            out[r["node_id"]] = _node(r)
    return out


def summary(conn: sqlite3.Connection) -> dict:
    return {"nodes": conn.execute("SELECT count(*) FROM kg_nodes").fetchone()[0],
            "edges": conn.execute("SELECT count(*) FROM kg_edges").fetchone()[0],
            "node_types": {r[0]: r[1] for r in conn.execute("SELECT node_type, count(*) FROM kg_nodes GROUP BY 1")},
            "edge_types": {r[0]: r[1] for r in conn.execute("SELECT rel, count(*) FROM kg_edges GROUP BY 1")},
            "bases": {r[0]: r[1] for r in conn.execute("SELECT basis, count(*) FROM kg_edges GROUP BY 1")},
            "phenomena": [_node(r) for r in conn.execute("SELECT * FROM kg_nodes WHERE node_type='phenomenon'")]}


def neighbors(conn: sqlite3.Connection, node_id: str, rel: str | None = None, limit: int = 200) -> dict:
    n = node(conn, node_id)
    q = "SELECT * FROM kg_edges WHERE (src=? OR dst=?)" + (" AND rel=?" if rel else "") + " ORDER BY rel, edge_id LIMIT ?"
    args = [node_id, node_id] + ([rel] if rel else []) + [limit]
    edges = [_edge(r) for r in conn.execute(q, args)]
    other = nodes(conn, list({e["dst"] if e["src"] == node_id else e["src"] for e in edges}))
    return {"node": n, "edges": [{**e, "other": other.get(e["dst"] if e["src"] == node_id else e["src"])} for e in edges]}


# 1 ---------------------------------------------------------------------------------------------------------------
def investigations_studying(conn: sqlite3.Connection, phenomenon: str) -> dict:
    pid = phenomenon if phenomenon.startswith("phen:") else f"phen:{phenomenon}"
    p = node(conn, pid)
    rows = conn.execute("SELECT e.*, n.label, n.props_json AS nprops FROM kg_edges e JOIN kg_nodes n ON n.node_id=e.src "
                        "WHERE e.rel='STUDIES' AND e.dst=? ORDER BY e.props_json LIKE '%primary%' DESC, e.src", (pid,))
    return {"phenomenon": p, "investigations": [
        {"investigation_id": r["src"][4:], "label": r["label"], "focus": jloads(r["props_json"], {}).get("focus"),
         "readiness": jloads(r["nprops"], {}).get("readiness"), "basis": r["basis"], "source_ref": r["source_ref"],
         "term": jloads(r["props_json"], {}).get("term")} for r in rows]}


# 2 ---------------------------------------------------------------------------------------------------------------
def experiments_for(conn: sqlite3.Connection, fuel: str | None = None, material: str | None = None,
                    investigation: str | None = None, limit: int = 500) -> dict:
    if not fuel and not material:
        raise bad_request("Give a fuel or a material.")
    target = fuel or material
    tid = target if target.startswith(("fuel:", "mat:")) else None
    if not tid:
        typ = "fuel" if fuel else "material"
        r = conn.execute("SELECT node_id FROM kg_nodes WHERE node_type=? AND (lower(label)=lower(?) OR "
                         "lower(json_extract(props_json,'$.canonical'))=lower(?))", (typ, target, target)).fetchone()
        if not r:
            return {"target": target, "found": False, "experiments": [], "by_investigation": {},
                    "message": f"No {typ} named '{target}' in the graph."}
        tid = r[0]
    rels = ("USES_FUEL", "USES_MATERIAL", "FOR_FUEL")
    q = (f"SELECT n.* FROM kg_edges e JOIN kg_nodes n ON n.node_id=e.src WHERE e.dst=? AND e.rel IN ({','.join('?' * 3)})"
         " AND n.node_type IN ('experiment','measurement','model_result','test_day')")
    args: list = [tid, *rels]
    if investigation:
        q += " AND n.investigation_id=?"
        args.append(investigation)
    rows = [_node(r) for r in conn.execute(q + " ORDER BY n.investigation_id, n.rowid", args)]
    return {"target": node(conn, tid), "found": True, "n": len(rows), "experiments": rows[:limit],
            "by_investigation": dict(Counter(r["investigation_id"] for r in rows))}


# 3 ---------------------------------------------------------------------------------------------------------------
def conditions_of(conn: sqlite3.Connection, ids: list[str]) -> dict[str, dict[str, dict]]:
    out: dict[str, dict[str, dict]] = defaultdict(dict)
    for i in range(0, len(ids), 500):
        chunk = ids[i:i + 500]
        for r in conn.execute(f"SELECT src, dst, props_json, source_ref FROM kg_edges WHERE rel='HAS_CONDITION' AND "
                              f"src IN ({','.join('?' * len(chunk))})", chunk):
            out[r[0]][r[1]] = {**jloads(r[2], {}), "source_ref": r[3]}
    return out


def outcomes_of(conn: sqlite3.Connection, ids: list[str]) -> dict[str, list[dict]]:
    out: dict[str, list[dict]] = defaultdict(list)
    for i in range(0, len(ids), 500):
        chunk = ids[i:i + 500]
        for r in conn.execute(f"SELECT e.src, e.dst, e.props_json, e.source_ref, e.basis, n.label FROM kg_edges e "
                              f"JOIN kg_nodes n ON n.node_id=e.dst WHERE e.rel='HAS_OUTCOME' AND "
                              f"e.src IN ({','.join('?' * len(chunk))})", chunk):
            out[r[0]].append({"outcome": r[1], "label": r[5], **jloads(r[2], {}), "source_ref": r[3], "basis": r[4]})
    return out


def edge_targets(conn: sqlite3.Connection, ids: list[str], rel: str) -> dict[str, set[str]]:
    out: dict[str, set[str]] = defaultdict(set)
    for i in range(0, len(ids), 500):
        chunk = ids[i:i + 500]
        for r in conn.execute(f"SELECT src, dst FROM kg_edges WHERE rel=? AND src IN ({','.join('?' * len(chunk))})",
                              [rel, *chunk]):
            out[r[0]].add(r[1])
    return out


def members(conn: sqlite3.Connection, investigation: str, types=("experiment",)) -> list[dict]:
    return [_node(r) for r in conn.execute(
        f"SELECT n.* FROM kg_edges e JOIN kg_nodes n ON n.node_id=e.src WHERE e.rel='BELONGS_TO' AND e.dst=? "
        f"AND n.node_type IN ({','.join('?' * len(types))}) ORDER BY n.rowid", (f"inv:{investigation}", *types))]


def outcomes_under(conn: sqlite3.Connection, investigation: str, ranges: dict[str, tuple[float | None, float | None]],
                   categorical: dict[str, str] | None = None) -> dict:
    """Outcome distribution of an investigation's experiments whose recorded conditions fall inside `ranges`
    ({o2|pressure_atm|d0_mm|flow_cm_s|fuel_flow_mg_s: (lo, hi)}) and whose categorical edges match `categorical`
    ({fuel|material|configuration: node_id}). Experiments that do not record a constrained variable are counted as
    `missing_condition`, separately from experiments whose value is outside the range (`outside_range`)."""
    node(conn, f"inv:{investigation}")
    for k in ranges:
        if k not in CONDITION_VARS:
            raise bad_request(f"Unsupported condition '{k}'. Supported: {', '.join(CONDITION_VARS)}")
    exps = members(conn, investigation)
    ids = [e["node_id"] for e in exps]
    conds = conditions_of(conn, ids)
    outs = outcomes_of(conn, ids)
    cat_edges = {"fuel": edge_targets(conn, ids, "USES_FUEL"), "material": edge_targets(conn, ids, "USES_MATERIAL"),
                 "configuration": edge_targets(conn, ids, "HAS_CONFIGURATION")}
    recorded = {k for k in ranges if any(CONDITION_VARS[k] in conds.get(i, {}) for i in ids)}
    has_dim = {k: any(v for v in cat_edges[k].values()) for k in cat_edges}
    kept, missing, outside, cat_rejected = [], Counter(), Counter(), Counter()
    for e in exps:
        i = e["node_id"]
        ok = True
        for k, want in (categorical or {}).items():
            if not want:
                continue
            if not has_dim.get(k):     # the investigation never records this dimension: not a rejection
                continue
            if want not in cat_edges[k].get(i, set()):
                cat_rejected[k] += 1
                ok = False
                break
        if not ok:
            continue
        for k, (lo, hi) in ranges.items():
            if k not in recorded or (lo is None and hi is None):
                continue
            c = conds.get(i, {}).get(CONDITION_VARS[k])
            if c is None or c.get("value") is None:
                missing[k] += 1
                ok = False
                break
            if (lo is not None and c["value"] < lo) or (hi is not None and c["value"] > hi):
                outside[k] += 1
                ok = False
                break
        if ok:
            kept.append(e)
    dist = Counter()
    censored = 0
    for e in kept:
        for o in outs.get(e["node_id"], []):
            dist[o["label"]] += 1
            censored += bool(o.get("censored"))
    return {"investigation_id": investigation, "n_total": len(exps), "n_match": len(kept),
            "not_recorded": sorted(set(ranges) - recorded), "missing_condition": dict(missing),
            "outside_range": dict(outside), "rejected_by_category": dict(cat_rejected),
            "outcomes": dict(dist.most_common()), "censored_outcomes": censored,
            "experiments": kept, "conditions": {e["node_id"]: conds.get(e["node_id"], {}) for e in kept},
            "outcome_records": {e["node_id"]: outs.get(e["node_id"], []) for e in kept}}


# 4 ---------------------------------------------------------------------------------------------------------------
EVIDENCE_RELS = ("REPORTED_IN", "SUPPORTED_BY", "BELONGS_TO", "HAS_MEASUREMENT", "SHOWS", "COMPARED_WITH",
                 "DOCUMENTED_IN", "CONTAINS")


def evidence_for(conn: sqlite3.Connection, node_id: str) -> dict:
    """Source chain for a node: the edges that support it, their sources and the documents/tables they point to."""
    n = node(conn, node_id)
    chain = []
    for r in conn.execute(f"SELECT * FROM kg_edges WHERE (src=? OR dst=?) AND rel IN ({','.join('?' * len(EVIDENCE_RELS))})"
                          " ORDER BY rel LIMIT 60", (node_id, node_id, *EVIDENCE_RELS)):
        chain.append(_edge(r))
    for r in conn.execute("SELECT * FROM kg_edges WHERE src=? AND rel IN ('HAS_OUTCOME','HAS_CONDITION') LIMIT 20",
                          (node_id,)):
        chain.append(_edge(r))
    docs = sorted({e["source_ref"].split("#")[0] for e in chain if "#page=" in e["source_ref"]})
    return {"node": n, "edges": chain, "documents": docs,
            "sources": sorted({e["source_ref"] for e in chain})[:40]}


# 5 ---------------------------------------------------------------------------------------------------------------
def related(conn: sqlite3.Connection, investigation: str) -> dict:
    node(conn, f"inv:{investigation}")
    out = []
    for r in conn.execute("SELECT e.*, a.label AS la, b.label AS lb FROM kg_edges e JOIN kg_nodes a ON a.node_id=e.src "
                          "JOIN kg_nodes b ON b.node_id=e.dst WHERE e.rel='RELATED_TO' AND (e.src=? OR e.dst=?)",
                          (f"inv:{investigation}", f"inv:{investigation}")):
        other = r["dst"] if r["src"] == f"inv:{investigation}" else r["src"]
        out.append({"investigation_id": other[4:], "label": r["lb"] if other == r["dst"] else r["la"],
                    "relation": jloads(r["props_json"], {}).get("relation"),
                    "direction": "outgoing" if other == r["dst"] else "incoming", "source_ref": r["source_ref"]})
    shared = [{"phenomenon": r[0], "label": r[1], "investigations": r[2].split(",")} for r in conn.execute(
        "SELECT p.node_id, p.label, group_concat(substr(e2.src,5)) FROM kg_edges e1 JOIN kg_edges e2 ON e1.dst=e2.dst "
        "AND e2.rel='STUDIES' AND e2.src<>e1.src JOIN kg_nodes p ON p.node_id=e1.dst WHERE e1.rel='STUDIES' AND e1.src=? "
        "GROUP BY p.node_id", (f"inv:{investigation}",))]
    return {"investigation_id": investigation, "documented": out, "shared_phenomena": shared}


def investigation_profile(conn: sqlite3.Connection, investigation: str) -> dict:
    """Everything the ranking needs about one investigation, read from the graph."""
    n = node(conn, f"inv:{investigation}")
    studies = [{"phenomenon": r[0][5:], "focus": jloads(r[1], {}).get("focus"), "source_ref": r[2]} for r in conn.execute(
        "SELECT dst, props_json, source_ref FROM kg_edges WHERE rel='STUDIES' AND src=?", (f"inv:{investigation}",))]
    types = {r[0]: r[1] for r in conn.execute(
        "SELECT n.node_type, count(*) FROM kg_edges e JOIN kg_nodes n ON n.node_id=e.src WHERE e.rel='BELONGS_TO' AND "
        "e.dst=? GROUP BY 1", (f"inv:{investigation}",))}
    measured_outcomes = conn.execute(
        "SELECT count(DISTINCT e.src) FROM kg_edges e JOIN kg_edges b ON b.src=e.src AND b.rel='BELONGS_TO' AND b.dst=? "
        "WHERE e.rel='HAS_OUTCOME'", (f"inv:{investigation}",)).fetchone()[0]
    claims = conn.execute("SELECT count(*) FROM kg_edges WHERE rel='REPORTS' AND src=?",
                          (f"inv:{investigation}",)).fetchone()[0]
    docs = conn.execute("SELECT count(*) FROM kg_edges WHERE rel='DOCUMENTED_IN' AND src=?",
                        (f"inv:{investigation}",)).fetchone()[0]
    return {**n, "studies": studies, "member_types": types, "measured_outcomes": measured_outcomes,
            "claims": claims, "documents": docs}

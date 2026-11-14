"""Phase 14 Copilot upgrade: deterministic question classification, knowledge-graph evidence and Explorer context.

- classify(question)           fact / comparison / interpretation / availability / unsupported (regex rules, no model)
- graph_evidence(conn, q, ...) evidence items read from the knowledge graph and the curated Phase 13 records
- explorer_context(conn, ctx)  validates an Explorer handoff (ids only) and turns it into evidence read from the DB;
                               no text supplied by the browser reaches the model as an instruction
"""
from __future__ import annotations

import re
import sqlite3
from collections import Counter

from ..core.errors import bad_request
from ..db.database import jloads
from . import kg

QUESTION_TYPES = {
    "fact": "Fact retrieval",
    "comparison": "Cross-investigation comparison",
    "interpretation": "Scientific interpretation",
    "availability": "Evidence availability",
    "unsupported": "Unsupported or unanswerable",
}

# Requests SpaceFire must decline: certification, prediction for untested materials/conditions, arbitrary-condition
# calculations, and safety validation. Each rule has the reason shown to the user.
UNSUPPORTED_RULES: list[tuple[re.Pattern, str]] = [
    (re.compile(r"\b(certif\w*|guarantee\w*|approve\w*)\b.*\b(safe|safety|flammab\w*|spacecraft|cabin|crew)\b|"
                r"\b(safe|safety)\b.*\b(certif\w*|guarantee\w*)\b", re.I),
     "SpaceFire cannot certify or guarantee material or operational safety. NASA material acceptance relies on "
     "standardized flammability testing and engineering review, not on these research datasets."),
    (re.compile(r"\b(predict|forecast|tell me|determine)\b.*\b(whether|if)\b.*\b(untested|new|arbitrary|unknown|any)\b.*"
                r"\b(ignite|burn|catch fire|be safe|extinguish)\b|\buntested\b.*\b(ignite|burn|catch fire|safe)\b", re.I),
     "There is no measured evidence for an untested material or condition, and SpaceFire does not extrapolate the NASA "
     "data to predict ignition or burning."),
    (re.compile(r"\b(exact|precise)\b.*\b(flame )?temperature\b|\btemperature\b.*\b(not measured|unmeasured|untested)\b", re.I),
     "Flame temperatures were not measured for arbitrary conditions in these datasets; SpaceFire does not invent values."),
    (re.compile(r"\b(calculate|compute|estimate|give)\b.*\b(radius|radii|spread rate|burn(ing)? time|temperature)\b.*"
                r"\b(any|arbitrary|every|all)\b.*\b(oxygen|o2|pressure|condition)", re.I),
     "Values exist only at the tested conditions; SpaceFire does not interpolate or extrapolate them to arbitrary "
     "conditions."),
    (re.compile(r"\b(bre|burning rate emulator)\b.*\b(validat\w*|prove\w*|show\w*|confirm\w*)\b.*\b(safe|safety)\b", re.I),
     "The Burning Rate Emulator emulates condensed-fuel burning on a gas burner; it does not validate the safety of any "
     "material."),
    (re.compile(r"\b(probability|likelihood|chance|risk)\b.*\b(of )?(a )?(spacecraft )?fire\b|\bfire[- ]risk score\b", re.I),
     "SpaceFire does not compute fire probabilities or risk scores; the NASA data describe experiments, not mission risk."),
    (re.compile(r"\b(safe|safety|allowable|permissible)\b.*\b(threshold|limit|level|value)\b.*\b(spacecraft|crew|occupied|"
                r"habitat|human|cabin)\b", re.I),
     None),   # reason filled in below with THRESHOLD_TEXT (the wording the Copilot has always used)
]
THRESHOLD_TEXT = ("The question asks for an operational safety threshold or certification value. The local NASA "
                  "experiments do not establish such a value, and SpaceFire does not infer one.")
UNSUPPORTED_RULES[-1] = (UNSUPPORTED_RULES[-1][0], THRESHOLD_TEXT)
COMPARISON_RE = re.compile(r"\b(compare\w*|comparison|versus|vs\.?|differ\w*|difference|similarit\w*|contrast)\b", re.I)
AVAILABILITY_RE = re.compile(r"\b(is there|are there|do (we|you) have|availab\w*|what data|which data|downloaded|missing|"
                             r"included|does .{0,40} (include|contain|have)|any (data|measurements?)|evidence (for|of))\b", re.I)
INTERPRET_RE = re.compile(r"^why\b|^how\b(?!\s+(many|much|long|large|often|big|far)\b)|"
                          r"\b(why|explain|what does .{0,40} mean|implication\w*|matter\w*|significan\w*|"
                          r"how (do|does|can)|role of)\b", re.I)

PHENOMENON_WORDS = [  # (regex, phenomenon id) -> graph query investigations_studying()
    (re.compile(r"\bcool[- ]flames?\b", re.I), "cool_flames"),
    (re.compile(r"\bflame spread\w*|\bspread(ing)? rate", re.I), "flame_spread_solids"),
    (re.compile(r"\bsmoke\b|\bparticle", re.I), "smoke_particle_formation"),
    (re.compile(r"\bdetect\w*", re.I), "smoke_detection"),
    (re.compile(r"\bdroplets?\b", re.I), "droplet_combustion"),
    (re.compile(r"\bextinction|extinguish\w*", re.I), "flame_extinction"),
    (re.compile(r"\b(gaseous|gas[- ]fed|diffusion flames?|gas flames?|spherical flames?)\b", re.I), "gaseous_diffusion_flames"),
    (re.compile(r"\bemulat\w*", re.I), "burning_rate_emulation"),
    (re.compile(r"\b(spacecraft fire|large[- ]scale)\b", re.I), "large_scale_spacecraft_fire"),
    (re.compile(r"\bflammab\w*", re.I), "material_flammability"),
]


def classify(question: str, investigations: list[str] | None = None) -> dict:
    for rx, reason in UNSUPPORTED_RULES:
        if rx.search(question):
            return {"type": "unsupported", "label": QUESTION_TYPES["unsupported"], "reason": reason}
    if COMPARISON_RE.search(question) or (len(investigations or []) >= 2 and re.search(r"\band\b", question)):
        t = "comparison"
    elif AVAILABILITY_RE.search(question):
        t = "availability"
    elif INTERPRET_RE.search(question):
        t = "interpretation"
    else:
        t = "fact"
    return {"type": t, "label": QUESTION_TYPES[t], "reason": None}


def phenomena_in(question: str) -> list[str]:
    return list(dict.fromkeys(p for rx, p in PHENOMENON_WORDS if rx.search(question)))


def _profile_item(conn, inv: str) -> dict | None:
    try:
        p = kg.investigation_profile(conn, inv)
    except Exception:
        return None
    from .explorer import EVIDENCE_POINTS, evidence_class
    ek = evidence_class(p)
    rel = kg.related(conn, inv)
    return {"source_type": "graph", "title": f"Knowledge graph: {p['label']} ({inv}) evidence profile",
            "content": {"investigation": inv, "name": p["label"], "readiness": p["props"].get("readiness"),
                        "studies": [{"phenomenon": s["phenomenon"], "focus": s["focus"], "basis": s["source_ref"]}
                                    for s in p["studies"]],
                        "strongest_evidence": EVIDENCE_POINTS[ek][1],
                        "records_in_graph": p["member_types"], "tests_with_recorded_outcomes": p["measured_outcomes"],
                        "limitations": [l["text"] for l in p["props"].get("limitations", [])],
                        "documented_relations": [{"to": r["investigation_id"], "relation": r["relation"]}
                                                 for r in rel["documented"]]},
            "meta": {"access_level": "computed", "url": p["props"].get("route")}}


def _cool_flame_item(conn) -> dict | None:
    rows = [n for n in kg.members(conn, "PSI-159", ("measurement",))]
    if not rows:
        return None
    conds = Counter((n["props"].get("fuel"), n["props"].get("configuration"), n["props"].get("x_o2"),
                     n["props"].get("p_bar")) for n in rows)
    radii = [n["props"]["r_cool_mm"] for n in rows if n["props"].get("r_cool_mm") is not None]
    return {"source_type": "curated_record", "title": "ACME CFI-G Final Report Table 3: cool-flame events",
            "content": {"events": len(rows), "conditions": [
                {"fuel": k[0], "configuration": k[1], "x_o2": k[2], "p_bar": k[3], "events": v} for k, v in conds.items()],
                "cool_flame_radius_mm": {"min": min(radii), "max": max(radii)} if radii else None,
                "events": [{"test": n["props"].get("test_id"), "r_hot_mm": n["props"].get("r_hot_mm"),
                            "r_cool_mm": n["props"].get("r_cool_mm"), "duration_s": n["props"].get("duration_s")} for n in rows],
                "note": "Measured at one condition family only; radii are not transferable to other conditions. "
                        "Test 21174D1: cool-flame radius not measured (Table 3 footnote 3)."},
            "meta": {"document_id": "psi-159-reports-finalrpt-acme-cfi-g", "page_pdf": 46, "section": "Table 3",
                     "access_level": "fulltext", "url": "/phenomena/gaseous-flames?tab=cfig#cfig-cool"}}


def _same_item(conn) -> dict | None:
    rows = [n for n in kg.members(conn, "PSI-102", ("measurement",))]
    if not rows:
        return None
    return {"source_type": "curated_record", "title": "SAME Final Science Report Table 1: smoke particle sizes",
            "content": {"rows": [{"material": n["props"].get("material"), "aged_s": n["props"].get("aging_s"),
                                  "dg_nm": n["props"].get("dg_nm"), "d10_nm": n["props"].get("d10_nm"),
                                  "d30_nm": n["props"].get("d30_nm"), "sigma_g": n["props"].get("sigma_g")} for n in rows],
                        "method": "moment method with a log-normal assumption (instruments: P-Trak, ionization, DustTrak)",
                        "note": "Derived statistics, not full measured size distributions; no detector alarm thresholds."},
            "meta": {"document_id": "same-final-science-report-03-18-10-with-papers-attached", "page_pdf": 27,
                     "section": "Table 1", "access_level": "fulltext", "url": "/phenomena/smoke-detection#sizes"}}


def _psi117_item(conn) -> dict | None:
    figs = Counter()
    for n in kg.members(conn, "PSI-117", ("measurement", "model_result")):
        figs[(n["props"].get("figure"), n["node_type"])] += 1
    if not figs:
        return None
    pairs = conn.execute("SELECT count(*) FROM kg_edges WHERE rel='COMPARED_WITH' AND src LIKE 'model:psi117%'").fetchone()[0]
    return {"source_type": "graph", "title": "Knowledge graph: PSI-117 published figure data (experiment vs model)",
            "content": {"experimental_series": sum(v for (f, t), v in figs.items() if t == "measurement"),
                        "model_series": sum(v for (f, t), v in figs.items() if t == "model_result"),
                        "model_vs_experiment_pairs": pairs,
                        "note": "Experimental points are digitized figure data; model curves come from a 1-D "
                                "sphero-symmetric model. PSI-117 test numbers are not mapped to FLEX rows."},
            "meta": {"access_level": "computed", "url": "/phenomena/flame-extinction#psi117-explore"}}


def _claims_item(conn, inv: str) -> dict | None:
    rows = conn.execute("SELECT n.label, n.props_json FROM kg_edges e JOIN kg_nodes n ON n.node_id=e.dst WHERE "
                        "e.rel='REPORTS' AND e.src=?", (f"inv:{inv}",)).fetchall()
    if not rows:
        return None
    p0 = jloads(rows[0][1], {})
    return {"source_type": "report_statement", "title": f"{inv} final report: reported findings",
            "content": [{"finding": r[0], "page_pdf": jloads(r[1], {}).get("page_pdf")} for r in rows],
            "meta": {"document_id": p0.get("document_id"), "page_pdf": p0.get("page_pdf"), "access_level": "fulltext"}}


def _comparison_item(conn, invs: list[str]) -> dict | None:
    if len(invs) < 2:
        return None
    from .explorer import EVIDENCE_POINTS, evidence_class
    rows = []
    var_by: dict[str, set] = {}
    for inv in invs[:3]:
        try:
            p = kg.investigation_profile(conn, inv)
        except Exception:
            continue
        ids = [m["node_id"] for m in kg.members(conn, inv, ("experiment", "measurement"))][:2000]
        vars_ = {v for cs in kg.conditions_of(conn, ids).values() for v in cs}
        var_by[inv] = vars_
        rows.append({"investigation": inv, "name": p["label"], "strongest_evidence": EVIDENCE_POINTS[evidence_class(p)][1],
                     "phenomena": [s["phenomenon"] for s in p["studies"]],
                     "condition_variables": sorted(v[4:] for v in vars_)})
    if len(rows) < 2:
        return None
    shared_ph = set.intersection(*[set(r["phenomena"]) for r in rows])
    shared_vars = set.intersection(*var_by.values()) if var_by else set()
    return {"source_type": "analysis", "title": "Cross-investigation comparison guard (knowledge graph)",
            "content": {"investigations": rows, "shared_phenomena": sorted(shared_ph),
                        "shared_condition_variables": sorted(v[4:] for v in shared_vars),
                        "rule": "Compare quantitatively only variables both investigations record, with the same "
                                "evidence class; otherwise compare qualitatively. Model results are not measurements."},
            "meta": {"access_level": "computed"}}


def graph_evidence(conn: sqlite3.Connection, question: str, invs: list[str], qtype: str) -> tuple[list[dict], list[str]]:
    """Evidence items (dicts with source_type/title/content/meta) and the investigations they cover."""
    if not kg.available(conn):
        return [], invs
    items: list[dict] = []
    targets = list(invs)
    for ph in phenomena_in(question)[:3]:
        try:
            st = kg.investigations_studying(conn, ph)
        except Exception:
            continue
        items.append({"source_type": "graph", "title": f"Knowledge graph: investigations studying {st['phenomenon']['label'].lower()}",
                      "content": {"phenomenon": st["phenomenon"]["label"], "definition": st["phenomenon"]["props"].get("definition"),
                                  "investigations": [{k: i[k] for k in ("investigation_id", "label", "focus", "readiness", "source_ref")}
                                                     for i in st["investigations"]]},
                      "meta": {"access_level": "computed"}})
        if not invs or qtype == "comparison":   # comparisons need the investigations behind each named phenomenon
            targets += [i["investigation_id"] for i in st["investigations"] if i["focus"] == "primary"]
    targets = list(dict.fromkeys(targets))[:4]
    for inv in targets[:3]:
        it = _profile_item(conn, inv)
        if it:
            items.append(it)
    ql = question.lower()
    if "PSI-159" in targets and re.search(r"cool", ql):
        it = _cool_flame_item(conn)
        if it:
            items.append(it)
    if "PSI-102" in targets and re.search(r"particle|size|smoke|detect", ql):
        it = _same_item(conn)
        if it:
            items.append(it)
    if "PSI-117" in targets:
        it = _psi117_item(conn)
        if it:
            items.append(it)
    for inv in ("PSI-10", "PSI-20"):
        if inv in targets:
            it = _claims_item(conn, inv)
            if it:
                items.append(it)
    if qtype == "comparison":
        it = _comparison_item(conn, targets)
        if it:
            items.append(it)
    return items, targets


# --- Explorer handoff --------------------------------------------------------------------------------------------
ID_RE = re.compile(r"^[\w:.\-()%]{1,80}$")


def explorer_context(conn: sqlite3.Connection, ctx: dict | None) -> tuple[list[dict], list[str], dict | None]:
    """Validate an Explorer handoff. Returns (evidence items, experiment uids for the existing tools, summary).
    Only ids are accepted; every text shown to the model is read from the database or the scenario definition."""
    if not ctx:
        return [], [], None
    from .explorer import SCENARIOS
    sid = ctx.get("scenario")
    if sid not in SCENARIOS:
        raise bad_request(f"Unknown Explorer scenario '{sid}'.")
    sc = SCENARIOS[sid]
    inv = ctx.get("investigation")
    if inv and inv not in sc["roles"]:
        raise bad_request(f"{inv} is not part of the '{sid}' scenario.")
    items: list[dict] = []
    uids: list[str] = []
    test = ctx.get("test")
    if test:
        if not ID_RE.match(test):
            raise bad_request("Invalid test id.")
        if re.match(r"^(flex|bass2|saffire1):", test):
            if not conn.execute("SELECT 1 FROM experiments WHERE experiment_uid=?", (test,)).fetchone():
                raise bad_request(f"Unknown experiment '{test}'.")
            uids.append(test)
        else:
            r = conn.execute("SELECT node_id FROM kg_nodes WHERE node_type='experiment' AND "
                             "json_extract(props_json,'$.test_id')=? LIMIT 1", (test,)).fetchone()
            if not r:
                raise bad_request(f"Unknown test '{test}'.")
            ctx.setdefault("evidence", [])
            ctx["evidence"] = [r[0]] + [e for e in ctx["evidence"] if e != r[0]]
    ev_nodes = []
    for e in (ctx.get("evidence") or [])[:5]:
        if not ID_RE.match(e):
            raise bad_request("Invalid evidence id.")
        try:
            ev_nodes.append(kg.node(conn, e))
        except Exception:
            raise bad_request(f"Unknown evidence id '{e}'.")
    limitations = []
    if inv:
        limitations = [l["text"] for l in kg.node(conn, f"inv:{inv}")["props"].get("limitations", [])]
    items.append({"source_type": "explorer_context", "title": f"Research-to-Safety Explorer: {sc['title']}",
                  "content": {"scenario": sc["title"], "research_question": sc["question"], "investigation": inv,
                              "test": test, "limitations": limitations},
                  "meta": {"access_level": "computed", "url": f"/safety-explorer/{sid}"}})
    for n in ev_nodes:
        if n["node_type"] == "experiment" and n["props"].get("uid"):
            uids.append(n["props"]["uid"])
            continue
        props = {k: v for k, v in n["props"].items() if k not in ("x", "y")}
        ev = kg.evidence_for(conn, n["node_id"])
        page = next((int(s.split("#page=")[1]) for s in ev["sources"] if "#page=" in s), None)
        items.append({"source_type": "curated_record", "title": f"Selected evidence: {n['label']}",
                      "content": {"record": props, "investigation": n["investigation_id"], "sources": ev["sources"][:5]},
                      "meta": {"access_level": "fulltext" if page else "computed",
                               "document_id": ev["documents"][0] if ev["documents"] else None, "page_pdf": page}})
    summary = {"scenario": sid, "title": sc["title"], "investigation": inv, "test": test,
               "evidence": [n["node_id"] for n in ev_nodes], "limitations": limitations}
    return items, list(dict.fromkeys(uids)), summary


def abstention(reason: str, invs: list[str]) -> str:
    return (f"I can't answer this from the NASA evidence. {reason} "
            "The sources below show what was actually measured, so you can see what the data can and cannot support.")

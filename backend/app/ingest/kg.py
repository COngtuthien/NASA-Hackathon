"""Phase 14: build the lightweight scientific knowledge graph (kg_nodes / kg_edges) from the loaded database.

Rules
- Nodes and edges are derived from rows that already exist (experiments, flex/bass2/saffire tables, p13_records,
  report_records, documents, investigation_publications, investigation_registry). Nothing is typed in as a value.
- Every edge carries `basis` and `source_ref`. Bases:
    source_record     a row of a NASA CSV / curated record (source_ref = table:key)
    report_table      a verified row of a printed NASA report table (source_ref = document#page)
    document_catalog  the document index (documents table)
    registry_metadata ISA-Tab metadata of the investigation (registry_json)
    documented_text   a phenomenon or instrument named in the investigation's own text; the builder only creates the
                      edge if at least one of the listed terms is found in the ISA-Tab title/objective or in an indexed
                      document of that investigation (the matching term and where it was found are stored)
- Experiment-level edges come only from experiment-level records. No edge is inferred across investigations except
  RELATED_TO, which copies the documented relation in the registry.

Run on an existing database without a full re-ingest:  python -m app.ingest.kg
"""
from __future__ import annotations

import argparse
import json
import re
import sqlite3
from collections import Counter

from ..core.config import get_settings
from ..db.database import connect, jdumps, jloads, transaction

# --- vocabularies -----------------------------------------------------------------------------------------------
# Phenomena: (id, label, definition, {investigation: (focus, [terms that must appear in its own text])})
PHENOMENA = [
    ("flame_spread_solids", "Flame spread over solid materials",
     "A flame advancing over a solid fuel surface, against (opposed) or with (concurrent) the airflow.",
     {"PSI-25": ("primary", ["flame spread"]), "PSI-98": ("primary", ["flame spread", "fire grows"]),
      "PSI-62": ("primary", ["concurrent flame spread"])}),
    ("material_flammability", "Material flammability",
     "Whether and how readily a material burns under given oxygen, pressure and flow conditions.",
     {"PSI-25": ("secondary", ["flammability"]), "PSI-98": ("secondary", ["flammability"]),
      "PSI-20": ("secondary", ["flammability"]), "PSI-62": ("secondary", ["flammability"])}),
    ("large_scale_spacecraft_fire", "Large-scale fire in a spacecraft",
     "Fire growth over a large sample inside an uncrewed spacecraft (Cygnus).",
     {"PSI-98": ("primary", ["spacecraft fire", "large-scale", "cygnus"])}),
    ("burning_rate_emulation", "Burning-rate emulation of condensed fuels",
     "Gas-fed burners that emulate the burning of solid or liquid fuels to measure flammability boundaries.",
     {"PSI-20": ("primary", ["burning rate emulator", "emulat"])}),
    ("gaseous_diffusion_flames", "Spherical gaseous diffusion flames",
     "Flames around a porous burner that feeds a gaseous fuel (normal) or oxidizer (inverse) into a quiescent ambient.",
     {"PSI-159": ("primary", ["diffusion flame"]), "PSI-10": ("primary", ["diffusion flame", "spherical flame"]),
      "PSI-20": ("secondary", ["diffusion flame"])}),
    ("flame_extinction", "Flame extinction",
     "The flame going out: radiative or kinetic extinction, self-extinction.",
     {"PSI-69": ("primary", ["extinction"]), "PSI-117": ("primary", ["extinction"]),
      "PSI-159": ("secondary", ["extinction", "extinguish"]), "PSI-10": ("secondary", ["extinction"]),
      "PSI-68": ("secondary", ["extinction"]), "PSI-25": ("secondary", ["extinction", "extinguish"])}),
    ("cool_flames", "Cool flames",
     "Low-temperature combustion that can persist after the hot flame goes out.",
     {"PSI-159": ("primary", ["cool flame"]), "PSI-117": ("primary", ["cool flame", "cool-flame"]),
      "PSI-69": ("secondary", ["cool flame", "cool-flame"])}),
    ("droplet_combustion", "Droplet combustion",
     "Burning of an isolated fuel droplet: burning rate, flame standoff, d²-law behaviour.",
     {"PSI-69": ("primary", ["droplet"]), "PSI-117": ("primary", ["droplet"]), "PSI-68": ("primary", ["droplet"])}),
    ("smoke_particle_formation", "Smoke particle formation and aging",
     "Particles released by overheated (pre-flaming) materials, and how their size changes as smoke ages.",
     {"PSI-102": ("primary", ["smoke", "particle"])}),
    ("smoke_detection", "Smoke detection",
     "How spacecraft smoke detectors respond to the particles produced by overheated materials.",
     {"PSI-102": ("primary", ["smoke detect", "detector"])}),
]

# Instruments named in the SAME report (moment method, Final Science Report pp.15-19; ICES decks).
INSTRUMENTS = [
    ("inst:p-trak", "P-Trak condensation particle counter", "0th moment (number concentration)", ["p-trak"]),
    ("inst:ionization", "Ionization chamber", "1st moment (diameter concentration)", ["ionization"]),
    ("inst:dusttrak", "DustTrak photometer", "3rd moment (mass concentration)", ["dusttrak"]),
    ("inst:iss-detector", "ISS light-scattering smoke detector", "spacecraft smoke detector",
     ["light scattering", "light-scattering"]),
]

# Fuel aliases that are verified: FLEX 'Heptane' is n-heptane (FLEX documents use 'n-heptane', checked at build time).
FUEL_CANON = {"heptane@PSI-69": "n-heptane", "methanol@PSI-69": "methanol", "c2h4": "ethylene", "c3h8": "propane",
              "ch4": "methane", "ethane": "ethane", "propane": "propane", "n-butane": "n-butane",
              "n-heptane": "n-heptane", "n-decane": "n-decane", "n-dodecane": "n-dodecane"}
FUEL_LABEL = {"ethylene": "Ethylene (C2H4)", "propane": "Propane (C3H8)", "methane": "Methane (CH4)"}

VARS = {
    "o2_mole_fraction": ("Oxygen mole fraction", "mole fraction"),
    "pressure_atm": ("Ambient pressure", "atm"),
    "initial_diameter_mm": ("Initial droplet diameter", "mm"),
    "flow_velocity_cm_s": ("Imposed flow velocity", "cm/s"),
    "fuel_mass_flow_mg_s": ("Fuel mass flow rate", "mg/s"),
    "aging_s": ("Smoke aging time", "s"),
}
BAR_PER_ATM = 1.01325
PLATFORM_FLIGHT = re.compile(r"\b(ISS|International Space Station|Space Shuttle|Cygnus)\b", re.I)


def base_material(material_class: str) -> str:
    """BASS-II material_class (material + geometry) -> base material; geometry is kept on the experiment node."""
    m = material_class.lower()
    if m.startswith("pmma"):
        return "PMMA"
    if m.startswith("nomex"):
        return "Nomex III fabric"
    if m.startswith("sibal"):
        return "SIBAL fabric"
    if "wax" in m:
        return "Japan wax"
    return material_class


def slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


class Graph:
    def __init__(self, conn: sqlite3.Connection):
        self.conn = conn
        self.nodes: dict[str, tuple] = {}
        self.edges: dict[tuple, tuple] = {}
        self.skipped: list[dict] = []

    def node(self, node_id: str, node_type: str, label: str, inv: str | None = None, **props) -> str:
        if node_id not in self.nodes:
            self.nodes[node_id] = (node_id, node_type, label, inv, jdumps(props))
        return node_id

    def edge(self, src: str, rel: str, dst: str, basis: str, source_ref: str, **props) -> None:
        assert src in self.nodes and dst in self.nodes, (src, rel, dst)
        key = (src, rel, dst)
        if key not in self.edges:   # duplicate prevention: first supporting source wins, later ones are counted
            self.edges[key] = [src, rel, dst, basis, source_ref, props, 1]
        else:
            self.edges[key][6] += 1

    def cond(self, exp: str, var: str, value, unit: str, original, original_unit: str | None, source_ref: str,
             basis: str = "source_record", **extra) -> None:
        if value is None:
            return
        label, _ = VARS[var]
        v = self.node(f"var:{var}", "condition_variable", label, unit=VARS[var][1])
        self.edge(exp, "HAS_CONDITION", v, basis, source_ref, value=value, unit=unit, original=original,
                  original_unit=original_unit, **extra)


def _text_of(conn: sqlite3.Connection, inv: str, reg: dict) -> tuple[str, str]:
    isa = f"{reg.get('title') or ''}\n{reg.get('objective') or ''}".lower()
    return isa, inv


def _term_hit(conn: sqlite3.Connection, inv: str, isa_text: str, terms: list[str]) -> tuple[str, str] | None:
    for t in terms:
        if t in isa_text:
            return t, "ISA-Tab title/objective"
    for t in terms:
        r = conn.execute("SELECT c.document_id, c.page_pdf FROM document_chunks c JOIN documents d USING(document_id) "
                         "WHERE d.investigation_id=? AND lower(c.text) LIKE ? ORDER BY d.doc_type='metadata' DESC, "
                         "c.ordinal LIMIT 1", (inv, f"%{t}%")).fetchone()
        if r:
            return t, f"{r[0]}#page={r[1]}" if r[1] else r[0]
    return None


def build(conn: sqlite3.Connection) -> dict:
    g = Graph(conn)
    regs = {r["investigation_id"]: jloads(r["registry_json"], {}) for r in conn.execute(
        "SELECT investigation_id, registry_json FROM investigation_registry")}
    docs = {r["document_id"]: dict(r) for r in conn.execute(
        "SELECT document_id, investigation_id, title, doc_type, relative_path FROM documents")}
    doc_by_path = {d["relative_path"]: k for k, d in docs.items()}

    # investigations
    for inv, reg in regs.items():
        flight = bool(PLATFORM_FLIGHT.search(f"{reg.get('platform') or ''} {reg.get('hardware') or ''}"))
        g.node(f"inv:{inv}", "investigation", reg.get("short_name") or inv, inv, title=reg.get("title"),
               readiness=reg.get("readiness"), scenario=reg.get("scenario"), platform=reg.get("platform"),
               flight_platform=flight, doi=reg.get("doi"), route=reg.get("route"), studio=reg.get("studio"),
               limitations=reg.get("limitations", []))
    for inv, reg in regs.items():
        for rel in reg.get("related", []):
            if f"inv:{rel['investigation_id']}" in g.nodes:
                g.edge(f"inv:{inv}", "RELATED_TO", f"inv:{rel['investigation_id']}", "registry_metadata",
                       f"investigation_registry:{inv}.related", relation=rel.get("relation"))

    # phenomena (documented_text edges, verified against the investigation's own text)
    for pid, label, definition, by_inv in PHENOMENA:
        g.node(f"phen:{pid}", "phenomenon", label, definition=definition)
        for inv, (focus, terms) in by_inv.items():
            if inv not in regs:
                continue
            hit = _term_hit(conn, inv, _text_of(conn, inv, regs[inv])[0], terms)
            if not hit:
                g.skipped.append({"edge": f"{inv} STUDIES {pid}", "reason": f"none of {terms} found"})
                continue
            g.edge(f"inv:{inv}", "STUDIES", f"phen:{pid}", "documented_text", hit[1], focus=focus, term=hit[0])

    # documents, tables, publications
    for did, d in docs.items():
        if not d["investigation_id"] or f"inv:{d['investigation_id']}" not in g.nodes:
            continue
        g.node(f"doc:{did}", "report" if d["doc_type"] in ("nasa_report", "thesis", "paper") else "document",
               d["title"], d["investigation_id"], doc_type=d["doc_type"], document_id=did)
        g.edge(f"inv:{d['investigation_id']}", "DOCUMENTED_IN", f"doc:{did}", "document_catalog", f"documents:{did}")
    for r in conn.execute("SELECT pub_id, investigation_id, title, doi, status FROM investigation_publications"):
        if f"inv:{r['investigation_id']}" not in g.nodes:
            continue
        pid = g.node(f"pub:{r['pub_id']}", "publication", r["title"], r["investigation_id"], doi=r["doi"],
                     status=r["status"])
        g.edge(f"inv:{r['investigation_id']}", "PUBLISHED_AS", pid, "registry_metadata",
               f"investigation_publications:{r['pub_id']}")

    def table_node(doc_id: str, table: str, page: int | None, inv: str) -> str:
        tid = g.node(f"tbl:{doc_id}:{slug(table)}", "table", table, inv, document_id=doc_id, page_pdf=page)
        if f"doc:{doc_id}" in g.nodes:
            g.edge(f"doc:{doc_id}", "CONTAINS", tid, "report_table", f"{doc_id}#page={page}")
        return tid

    # fuels / materials / flow configurations
    def fuel(raw: str, inv: str, ref: str, exp: str | None = None, rel: str = "USES_FUEL", **props) -> str:
        key = raw.strip().lower()
        canon = FUEL_CANON.get(f"{key}@{inv}") or FUEL_CANON.get(key) or f"{key} (as printed)"
        fid = g.node(f"fuel:{slug(canon)}", "fuel", FUEL_LABEL.get(canon, canon), canonical=canon)
        g.edge(f"inv:{inv}", "USES_FUEL", fid, "source_record", ref, printed=raw, **props)
        if exp:
            g.edge(exp, rel, fid, "source_record", ref, printed=raw)
        return fid

    def material(label: str, inv: str, ref: str, exp: str | None = None, **props) -> str:
        mid = g.node(f"mat:{slug(label)}", "material", label)
        g.edge(f"inv:{inv}", "USES_MATERIAL", mid, "source_record", ref, **props)
        if exp:
            g.edge(exp, "USES_MATERIAL", mid, "source_record", ref)
        return mid

    def flow(kind: str, inv: str, ref: str, exp: str, basis: str = "source_record") -> None:
        fid = g.node(f"flow:{slug(kind)}", "flow_configuration", kind.capitalize() + (" flow" if kind.lower() in (
            "concurrent", "opposed", "stagnation") else " flame"))
        g.edge(f"inv:{inv}", "HAS_CONFIGURATION", fid, basis, ref)
        g.edge(exp, "HAS_CONFIGURATION", fid, basis, ref)

    def outcome(exp: str, inv: str, kind: str, label: str, ref: str, basis: str = "source_record", **props) -> None:
        oid = g.node(f"out:{slug(inv)}:{kind}", "outcome", label, inv, outcome=kind)
        g.edge(exp, "HAS_OUTCOME", oid, basis, ref, **props)

    # ---- FLEX (PSI-69): 274 rows, flex_tests -----------------------------------------------------------------
    for r in conn.execute("SELECT f.*, e.display_id, e.source_row FROM flex_tests f JOIN experiments e USING(experiment_uid)"):
        uid, ref = r["experiment_uid"], f"experiments:{r['experiment_uid']}"
        x = g.node(f"exp:{uid}", "experiment", f"FLEX {r['display_id']}", "PSI-69", uid=uid, display_id=r["display_id"],
                   evidence="measured", dataset="flex", fuel=r["fuel"], diluent=r["diluent"],
                   pressure_band=r["pressure_band"], x_o2=r["x_o2"], pressure_atm=r["pressure_atm"], d0_mm=r["d0_mm"],
                   test_end=r["test_end"], burn_time_s=r["burn_time_s"], k_mm2_s=r["k_mm2_s"], dext_mm=r["dext_mm"])
        g.edge(x, "BELONGS_TO", "inv:PSI-69", "source_record", ref)
        fuel(r["fuel"], "PSI-69", ref, x)
        g.cond(x, "o2_mole_fraction", r["x_o2"], "mole fraction", r["x_o2"], "mole fraction", ref)
        g.cond(x, "pressure_atm", r["pressure_atm"], "atm", r["pressure_mmhg"], "mmHg", ref,
               transform="mmHg / 760" if r["pressure_mmhg"] is not None else None)
        g.cond(x, "initial_diameter_mm", r["d0_mm"], "mm", r["d0_mm"], "mm", ref, kind=r["d0_kind"])
        if r["test_end"]:
            outcome(x, "PSI-69", slug(r["test_end"]), f"FLEX test end: {r['test_end']}", ref,
                    burn_time_s=r["burn_time_s"], dext_mm=r["dext_mm"])

    # ---- BASS-II (PSI-25): 129 rows + verified report tables -------------------------------------------------
    for r in conn.execute("SELECT b.*, e.display_id FROM bass2_tests b JOIN experiments e USING(experiment_uid)"):
        uid, ref = r["experiment_uid"], f"experiments:{r['experiment_uid']}"
        x = g.node(f"exp:{uid}", "experiment", f"BASS-II {r['test_id']}", "PSI-25", uid=uid, display_id=r["display_id"],
                   evidence="measured", dataset="bass2", material=base_material(r["material_class"]),
                   material_class=r["material_class"], material_raw=r["material_raw"], geometry=r["geometry"],
                   flow_direction=r["flow_direction"], x_o2=(r["o2_initial"] / 100 if r["o2_initial"] is not None else None),
                   air_cm_s=r["air_single_cm_s"], thickness_mm=r["thickness_mm"])
        g.edge(x, "BELONGS_TO", "inv:PSI-25", "source_record", ref)
        material(base_material(r["material_class"]), "PSI-25", ref, x)
        if r["flow_direction"]:
            flow(r["flow_direction"], "PSI-25", r["flow_direction_source"] or ref, x, "report_table")
        g.cond(x, "o2_mole_fraction", r["o2_initial"] / 100 if r["o2_initial"] is not None else None, "mole fraction",
               r["o2_initial"], "% vol", ref, transform="% / 100")
        g.cond(x, "flow_velocity_cm_s", r["air_single_cm_s"], "cm/s", r["air_raw"], "cm/s", ref)
    for r in conn.execute("SELECT * FROM report_records WHERE verification='verified' AND experiment_uid IS NOT NULL"):
        x = f"exp:{r['experiment_uid']}"
        if x not in g.nodes:
            continue
        tid = table_node(r["document_id"], f"Summary Report Table {r['table_id']}", r["page_pdf"], "PSI-25")
        ref = f"{r['document_id']}#page={r['page_pdf']}"
        g.edge(x, "REPORTED_IN", tid, "report_table", ref, row=r["row_key"])
        vals = jloads(r["values_json"], {})
        rates = vals.get("spread_rate_mm_s")
        if rates:
            outcome(x, "PSI-25", "spread-rate-reported", "Flame spread rate reported (Summary Report)", ref, "report_table",
                    spread_rate_mm_s=rates, velocity_cm_s=vals.get("velocity_cm_s"), status=vals.get("spread_rate_status"),
                    table=r["table_id"], row=r["row_key"])

    # ---- SAFFIRE-I (PSI-98): 2 burns ----------------------------------------------------------------------------
    for r in conn.execute("SELECT s.*, e.display_id FROM saffire_burns s JOIN experiments e USING(experiment_uid)"):
        uid, ref = r["experiment_uid"], f"experiments:{r['experiment_uid']}"
        x = g.node(f"exp:{uid}", "experiment", f"SAFFIRE-I {r['sample']}", "PSI-98", uid=uid, display_id=r["display_id"],
                   evidence="measured", dataset="saffire1", material=r["material"], flow_direction=r["flow_direction"],
                   o2_raw=r["o2_raw"], air_cm_s=r["air_flow_cm_s"], burn_time_s=r["burn_time_s"])
        g.edge(x, "BELONGS_TO", "inv:PSI-98", "source_record", ref)
        if r["material"]:
            material("SIBAL fabric" if r["material"].lower().startswith("sibal") else r["material"], "PSI-98", ref, x)
        if r["flow_direction"]:
            flow(r["flow_direction"], "PSI-98", ref, x)
        g.cond(x, "flow_velocity_cm_s", r["air_flow_cm_s"], "cm/s", r["air_flow_cm_s"], "cm/s", ref)
        if r["burn_time_s"] is not None:
            outcome(x, "PSI-98", "burn-time-recorded", "Burn duration recorded (SAFFIRE-I burn table)", ref,
                    burn_time_s=r["burn_time_s"])
        if r["o2_low"] is not None:
            g.cond(x, "o2_mole_fraction", round((r["o2_low"] + (r["o2_high"] or r["o2_low"])) / 200, 4), "mole fraction",
                   r["o2_raw"], "% vol", ref, transform="midpoint of printed range / 100", kind=r["o2_kind"])

    # ---- Phase 13 curated records ------------------------------------------------------------------------------
    def recs(ds: str):
        for r in conn.execute("SELECT * FROM p13_records WHERE dataset_id=? ORDER BY rowid", (ds,)):
            yield r, jloads(r["values_json"], {})

    def rec_table(r) -> str | None:
        did = doc_by_path.get(r["source_file"])
        if did and r["page_pdf"]:
            return table_node(did, r["source_table"], r["page_pdf"], r["investigation_id"])
        return None

    cfig_cfg = {}
    for r, v in recs("cfig_tests"):
        ref = f"p13_records:{r['record_id']}"
        x = g.node(f"exp:{r['record_id']}", "experiment", f"CFI-G {r['test_id']}", "PSI-159", test_id=r["test_id"],
                   evidence="measured", dataset="cfig", configuration=v["configuration"], fuel=v["fuel_species"],
                   bottle_fuel_pct=v.get("bottle_fuel_pct"), p_bar=v.get("p_bar"),
                   x_o2=v.get("x_o2_before") if v["configuration"] == "normal" else v.get("x_o2_supply"),
                   outcome=v.get("outcome"), burn_time_s=v.get("burn_time_s"),
                   burn_time_censored=v.get("burn_time_censored"))
        cfig_cfg[r["test_id"]] = v["configuration"]
        g.edge(x, "BELONGS_TO", "inv:PSI-159", "source_record", ref)
        fuel(v["fuel_species"], "PSI-159", ref, x)
        flow(v["configuration"], "PSI-159", ref, x)
        o2 = v.get("x_o2_before") if v["configuration"] == "normal" else v.get("x_o2_supply")
        g.cond(x, "o2_mole_fraction", o2, "mole fraction", o2, "mole fraction", ref,
               role="ambient before ignition" if v["configuration"] == "normal" else "oxidizer supplied through burner")
        if v.get("p_bar") is not None:
            g.cond(x, "pressure_atm", round(v["p_bar"] / BAR_PER_ATM, 4), "atm", v["p_bar"], "bar", ref,
                   transform="bar / 1.01325")
        g.cond(x, "fuel_mass_flow_mg_s", v.get("m_fuel_mg_s"), "mg/s", v.get("m_fuel_mg_s"), "mg/s", ref)
        if v.get("outcome"):
            outcome(x, "PSI-159", v["outcome"], v["outcome"].replace("_", " "), ref, burn_time_s=v.get("burn_time_s"),
                    censored=bool(v.get("burn_time_censored")))
    for r, v in recs("cfig_cool_flames"):
        ref = f"{doc_by_path.get(r['source_file'])}#page={r['page_pdf']}"
        tid = rec_table(r)
        x = f"exp:{v.get('csv_record_id')}" if v.get("csv_record_id") and f"exp:{v.get('csv_record_id')}" in g.nodes else None
        m = g.node(f"meas:{r['record_id']}", "measurement", f"Cool-flame event {r['test_id']}"
                   + (f" ({v['sub_event']})" if v.get("sub_event") else ""), "PSI-159", record_id=r["record_id"],
                   evidence="measured", test_id=r["test_id"], r_hot_mm=v.get("r_hot_mm"), r_cool_mm=v.get("r_cool_mm"),
                   duration_s=v.get("cool_flame_duration_s"), x_o2=v.get("x_o2"), p_bar=v.get("p_bar"),
                   fuel=v.get("fuel_species"), configuration=v.get("configuration"), flags=jloads(r["flags_json"], []))
        if tid:
            g.edge(m, "REPORTED_IN", tid, "report_table", ref)
        g.edge(m, "BELONGS_TO", "inv:PSI-159", "report_table", ref)
        if x:
            g.edge(x, "HAS_MEASUREMENT", m, "report_table", ref)
            outcome(x, "PSI-159", "cool-flame-observed", "Cool flame observed (Table 3)", ref, "report_table")
    for r, v in recs("fd_conditions"):
        ref = f"p13_records:{r['record_id']}"
        x = g.node(f"exp:{r['record_id']}", "experiment", f"Flame Design {r['test_id']}", "PSI-10", test_id=r["test_id"],
                   evidence="conditions_only", dataset="flame_design", configuration=v["configuration"], fuel=v["fuel"],
                   p_atm=v.get("p_ref_atm"), x_o2=v.get("x_o2_init") if v["configuration"] == "normal" else v.get("x_o2_supply"),
                   flow_marker=v.get("flow_marker"))
        g.edge(x, "BELONGS_TO", "inv:PSI-10", "source_record", ref)
        fuel(v["fuel"], "PSI-10", ref, x)
        flow(v["configuration"], "PSI-10", ref, x)
        o2 = v.get("x_o2_init") if v["configuration"] == "normal" else v.get("x_o2_supply")
        g.cond(x, "o2_mole_fraction", o2, "mole fraction", o2, "mole fraction", ref)
        g.cond(x, "pressure_atm", v.get("p_ref_atm"), "atm", v.get("p_ref_atm"), "atm", ref)
        g.cond(x, "fuel_mass_flow_mg_s", v.get("m_fuel_mg_s"), "mg/s", v.get("m_fuel_mg_s"), "mg/s", ref)
    for r, v in recs("bre_test_days"):
        ref = f"{doc_by_path.get(r['source_file'])}#page={r['page_pdf']}"
        tid = rec_table(r)
        x = g.node(f"exp:{r['record_id']}", "test_day", f"BRE test day {r['test_id']}", "PSI-20", test_id=r["test_id"],
                   evidence="operational_log", flames_ignited=v.get("flames_ignited"), fuel=v.get("fuel"),
                   o2_pct=v.get("o2_pct"), burner_mm=v.get("burner_mm"))
        g.edge(x, "BELONGS_TO", "inv:PSI-20", "report_table", ref)
        if tid:
            g.edge(x, "REPORTED_IN", tid, "report_table", ref)
        if v.get("fuel"):
            fuel(v["fuel"], "PSI-20", ref, x)
    for r, v in recs("bre_literature"):
        tid = rec_table(r)
        if tid:
            m = g.node(f"lit:{r['record_id']}", "literature_value", f"BRE literature row ({r['record_id']})", "PSI-20",
                       evidence="literature", values=v)
            g.edge(m, "REPORTED_IN", tid, "report_table", f"{doc_by_path.get(r['source_file'])}#page={r['page_pdf']}")
    for r, v in recs("same_particle_sizes"):
        ref = f"{doc_by_path.get(r['source_file'])}#page={r['page_pdf']}"
        tid = rec_table(r)
        mid = material(v["material_label"], "PSI-102", ref)
        m = g.node(f"meas:{r['record_id']}", "measurement", f"{v['material_label']}, {'aged ' + str(v['aging_s']) + ' s' if v['aged'] else 'fresh'} smoke",
                   "PSI-102", record_id=r["record_id"], evidence="derived", material=v["material"],
                   aged=v["aged"], aging_s=v["aging_s"], dg_nm=v.get("dg_nm"), d10_nm=v.get("d10_nm"),
                   d30_nm=v.get("d30_nm"), sigma_g=v.get("sigma_g"), flight=v.get("flight"))
        g.edge(m, "BELONGS_TO", "inv:PSI-102", "report_table", ref)
        g.edge(m, "MEASURED_FOR", mid, "report_table", ref)
        g.cond(m, "aging_s", v["aging_s"], "s", v["aging_s"], "s", ref, basis="report_table")
        if tid:
            g.edge(m, "REPORTED_IN", tid, "report_table", ref)
    same_labels = {v["material"]: v["material_label"] for _, v in recs("same_particle_sizes")}
    for r, v in recs("same_flight_log"):
        if v.get("kind") != "test" or not v.get("sample"):
            continue
        ref = f"{doc_by_path.get(r['source_file'])}#page={r['page_pdf']}"
        label = same_labels.get(v["sample"]) or v.get("sample_printed") or v["sample"]
        x = g.node(f"exp:{r['record_id']}", "experiment", f"SAME test {r['test_id']}", "PSI-102", test_id=r["test_id"],
                   evidence="operational_log", sample=v["sample"], reheat=v.get("reheat"), carousel=v.get("carousel"))
        g.edge(x, "BELONGS_TO", "inv:PSI-102", "report_table", ref)
        material(label, "PSI-102", ref, x)
        tid = rec_table(r)
        if tid:
            g.edge(x, "REPORTED_IN", tid, "report_table", ref)
    for iid, label, role, terms in INSTRUMENTS:
        hit = _term_hit(conn, "PSI-102", "", terms)
        if not hit:
            g.skipped.append({"edge": f"PSI-102 USES_INSTRUMENT {iid}", "reason": f"none of {terms} found"})
            continue
        g.node(iid, "instrument", label, "PSI-102", role=role)
        g.edge("inv:PSI-102", "USES_INSTRUMENT", iid, "documented_text", hit[1], term=hit[0])

    # ---- PSI-117 figure data: figures, measurement series, model series ------------------------------------------
    meta = conn.execute("SELECT meta_json FROM p13_datasets WHERE dataset_id='psi117_series'").fetchone()
    figures = jloads(meta[0], {}).get("extra", {}).get("figures", {}) if meta else {}
    for fid, f in figures.items():
        g.node(f"fig:psi117:{fid}", "figure", f.get("title") or fid, "PSI-117", figure=fid, file=f.get("file"))
        g.edge("inv:PSI-117", "HAS_FIGURE", f"fig:psi117:{fid}", "source_record", f"PSI-117/{f.get('file')}")
    by_fig: dict[str, dict[str, list[str]]] = {}
    for r, v in recs("psi117_series"):
        if not v.get("figure") or v["role"] == "excluded":
            continue
        ref = f"p13_records:{r['record_id']}"
        typ = "model_result" if v["role"] in ("model", "model_only_quantity") else "measurement"
        n = g.node(f"{'model' if typ == 'model_result' else 'meas'}:{r['record_id']}", typ,
                   f"{v['label']}: {v['y_var']}", "PSI-117", series_id=v["series_id"], role=v["role"],
                   evidence=v["evidence_class"], figure=v["figure"], conditions=v.get("conditions"), n=v.get("n"),
                   y_var=v["y_var"], y_unit=v["y_unit"], x_var=v["x_var"], x_unit=v["x_unit"])
        g.edge(f"fig:psi117:{v['figure']}", "SHOWS", n, "source_record", ref)
        g.edge(n, "BELONGS_TO", "inv:PSI-117", "source_record", ref)
        for fu in re.split(r",\s*", (v.get("conditions") or {}).get("fuel") or ""):
            if fu:
                fuel(fu, "PSI-117", ref, n, rel="FOR_FUEL")
        by_fig.setdefault(v["figure"], {}).setdefault(v["role"], []).append(n)
    for fig, roles in by_fig.items():
        for m in roles.get("model", []):
            for e in roles.get("experiment", []):
                if g.nodes[m][4] and json.loads(g.nodes[m][4]).get("y_var") == json.loads(g.nodes[e][4]).get("y_var"):
                    g.edge(m, "COMPARED_WITH", e, "source_record", f"PSI-117 figure {fig}",
                           note="same figure and same plotted variable")

    # ---- FLEX-2 (PSI-68): planned conditions only ---------------------------------------------------------------
    for r, v in recs("flex2_envelope"):
        ref = f"p13_records:{r['record_id']}"
        name = re.sub(r"\s*\((pure|mixture)\)\s*$", "", v.get("Sample (Fuel Type)", "")).strip()
        if name:
            fuel(name, "PSI-68", ref, status="planned test-matrix envelope (no outcome data)")

    # ---- findings (report statements) as claims ------------------------------------------------------------------
    for ds, inv, doc_id in (("fd_test_days", "PSI-10", "psi-10-reports-finalrpt-acmeflamedesign"),
                            ("bre_test_days", "PSI-20", "bre-final-report-20220201")):
        row = conn.execute("SELECT meta_json FROM p13_datasets WHERE dataset_id=?", (ds,)).fetchone()
        for f in (jloads(row[0], {}).get("extra", {}).get("findings", []) if row else []):
            cid = g.node(f"claim:{f['id']}", "claim", f["text"], inv, page_pdf=f.get("page_pdf"), kind=f.get("kind"),
                         values=f.get("values", []), evidence="report_statement", document_id=doc_id)
            g.edge(cid, "SUPPORTED_BY", f"doc:{doc_id}", "documented_text",
                   f"{doc_id}#page={f.get('page_pdf')}", page_pdf=f.get("page_pdf"))
            g.edge(f"inv:{inv}", "REPORTS", cid, "documented_text", f"{doc_id}#page={f.get('page_pdf')}")

    # ---- write -------------------------------------------------------------------------------------------------
    with transaction(conn):
        conn.execute("DELETE FROM kg_edges")
        conn.execute("DELETE FROM kg_nodes")
        conn.executemany("INSERT INTO kg_nodes(node_id, node_type, label, investigation_id, props_json) VALUES (?,?,?,?,?)",
                         list(g.nodes.values()))
        conn.executemany("INSERT INTO kg_edges(src, rel, dst, basis, source_ref, props_json) VALUES (?,?,?,?,?,?)",
                         [(s, r, d, b, ref, jdumps({**p, **({"supporting_rows": n} if n > 1 else {})}))
                          for s, r, d, b, ref, p, n in g.edges.values()])
    report = {"nodes": len(g.nodes), "edges": len(g.edges),
              "node_types": dict(Counter(n[1] for n in g.nodes.values())),
              "edge_types": dict(Counter(k[1] for k in g.edges)),
              "bases": dict(Counter(e[3] for e in g.edges.values())), "skipped": g.skipped}
    conn.execute("INSERT OR REPLACE INTO meta VALUES ('kg_report', ?)", (jdumps(report),))
    conn.commit()
    return report


def main() -> None:
    ap = argparse.ArgumentParser(description="Build the Phase 14 knowledge graph inside the existing database.")
    ap.add_argument("--db", default=None)
    a = ap.parse_args()
    path = __import__("pathlib").Path(a.db) if a.db else get_settings().db_path
    conn = connect(path)
    conn.executescript((__import__("pathlib").Path(__file__).resolve().parents[1] / "db" / "schema.sql").read_text(
        encoding="utf-8"))
    rep = build(conn)
    print(json.dumps(rep, indent=1))


if __name__ == "__main__":
    main()

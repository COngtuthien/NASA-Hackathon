"""Overview dashboard data: counts and insights computed live from the database."""
from __future__ import annotations

import sqlite3

from ..db.database import jloads
from . import analytics


def investigations(conn: sqlite3.Connection) -> list[dict]:
    out = []
    for r in conn.execute("SELECT * FROM investigations ORDER BY investigation_id DESC"):
        d = dict(r)
        meta = jloads(d.pop("metadata_json"), {})
        d["objective"] = (meta.get("Comment[Objective]") or "")[:900] or None
        d["hardware"] = meta.get("Comment[Experiment Hardware]") or None
        d["burns"] = conn.execute("SELECT count(*) FROM experiments WHERE investigation_id=? AND experiment_kind='burn'",
                                  (d["investigation_id"],)).fetchone()[0]
        d["documents"] = conn.execute("SELECT count(*) FROM documents WHERE investigation_id=?",
                                      (d["investigation_id"],)).fetchone()[0]
        d["publications_listed"] = conn.execute(
            "SELECT count(*) FROM investigation_publications WHERE investigation_id=?", (d["investigation_id"],)).fetchone()[0]
        d["quality_flags"] = conn.execute("SELECT count(*) FROM quality_flags WHERE investigation_id=?",
                                          (d["investigation_id"],)).fetchone()[0]
        out.append(d)
    return out


def _first_chunk(conn, document_id: str, phrase: str) -> dict | None:
    r = conn.execute("SELECT chunk_id, page_pdf, page_printed FROM document_chunks WHERE document_id=? AND "
                     "instr(lower(text), lower(?)) > 0 ORDER BY ordinal LIMIT 1", (document_id, phrase)).fetchone()
    return dict(r) if r else None


def insights(conn: sqlite3.Connection) -> list[dict]:
    out = []
    # 1. FLEX methanol low-O2 outcomes
    rows = conn.execute("SELECT test_end, count(*) n FROM flex_tests WHERE fuel='Methanol' AND x_o2 < 0.175 "
                        "GROUP BY 1").fetchall()
    c = {r["test_end"]: r["n"] for r in rows}
    n = sum(c.values())
    if n:
        out.append({
            "id": "flex-methanol-low-o2", "investigation_id": "PSI-69", "kind": "COMPUTED",
            "title": "Methanol droplets below 17.5 % O2",
            "text": f"{c.get('Extinction', 0)} of {n} methanol tests with initial X_O2 < 0.175 ended in recorded "
                    f"'Extinction' (Disruption {c.get('Disruption', 0)}, Completion {c.get('Completion', 0)}).",
            "n": n, "filters": {"fuel": "Methanol", "x_o2": "< 0.175"},
            "caveat": "Descriptive count from an adaptive test design; not a flammability limit.",
            "link": "/physics/flex?fuel=Methanol&o2_max=0.1749",
            "citations": [{"type": "experiment_set", "label": "FLEX CSV, Fuel=Methanol, X_O2<0.175"}],
        })
    # 2. FLEX d2-law consistency
    d2 = analytics.flex_d2(conn, {})
    s = d2["summary"]
    if s["n_included"]:
        out.append({
            "id": "flex-d2", "investigation_id": "PSI-69", "kind": "COMPUTED",
            "title": "Reported K behaves like a d²-law constant in mm²/s",
            "text": f"Across {s['n_included']} eligible tests, reported burn time / (D0² − D_end²)/K has median "
                    f"{s['median_ratio']} (10th–90th pct {s['q10_ratio']}–{s['q90_ratio']}), supporting the "
                    f"'mm²/s' reading of the 'Burning rate; mm' column.",
            "n": s["n_included"], "filters": {"excluded": s["n_excluded"]},
            "caveat": "A consistency check of reported values, not an independent prediction.",
            "link": "/physics/flex#d2",
            "citations": [{"type": "document", "document_id": "2g11-070he-0310", "page_pdf": 2,
                           "label": "d²-law definition, 2G11-070HE-0310 PDF p.2"}],
        })
    # 3. BASS-II stoichiometry
    g = analytics.bass_gases(conn, {})
    gs = g["summary"]
    ch = _first_chunk(conn, "bass-ii-summary-report", "stoichiometric")
    out.append({
        "id": "bass-co2-o2", "investigation_id": "PSI-25", "kind": "COMPUTED",
        "title": "O2 consumed vs CO2 produced (BASS-II)",
        "text": f"Before/after gas readings give ΔCO2/(−ΔO2) slope {gs['slope_co2_per_o2_above_resolution']} "
                f"(n={gs['n_fit_above_resolution']} tests with >0.2 point O2 drop; r={gs['pearson_r']} over "
                f"n={gs['n_fit']}), close to 5/6 = {gs['pmma_stoichiometric_reference']} for complete PMMA combustion.",
        "n": gs["n_fit_above_resolution"], "filters": {"excluded_unphysical": gs["n_excluded_unphysical"]},
        "caveat": "Single before/after readings of a 250 L volume; stoichiometric reference applies to PMMA only.",
        "link": "/physics/bass-ii",
        "citations": ([{"type": "document", "document_id": "bass-ii-summary-report", "page_pdf": ch["page_pdf"],
                        "chunk_id": ch["chunk_id"], "label": f"BASS-II Summary Report PDF p.{ch['page_pdf']}"}]
                      if ch else []),
    })
    # 4. SAFFIRE downlink
    m = {r["camera"]: dict(r) for r in conn.execute("SELECT * FROM saffire_manifest WHERE set_label='Sample2'")}
    if m:
        pct = [100 * v["jpeg_received"] / v["frames"] for v in m.values()]
        out.append({
            "id": "saffire-s2-downlink", "investigation_id": "PSI-98", "kind": "COMPUTED",
            "title": "SAFFIRE-I opposed burn imagery is mostly missing",
            "text": f"For Sample 2 (opposed flow), only {min(pct):.1f}–{max(pct):.1f} % of listed JPEG frames are "
                    f"marked received in the manifest, versus ~80 % for Sample 1.",
            "n": sum(v["frames"] for v in m.values()), "filters": {"set": "Sample2"},
            "caveat": "Manifest metadata only; no images or flame measurements exist locally.",
            "link": "/physics/saffire-i#timeline",
            "citations": [{"type": "source_file", "label": "SAFFIRE-1_MergeResult-jpeg_Update_Final_v2.xlsx"}],
        })
    # 5. Disruption undefined
    n_disr = conn.execute("SELECT count(*) FROM flex_tests WHERE test_end='Disruption'").fetchone()[0]
    out.append({
        "id": "flex-disruption", "investigation_id": "PSI-69", "kind": "DOC",
        "title": "'Disruption' is not defined in the local documents",
        "text": f"{n_disr} FLEX rows end in 'Disruption'. A full-text search of all indexed FLEX documents finds no definition, so "
                "SpaceFire treats it as unresolved and possibly censored — never as extinction.",
        "n": None, "filters": {},
        "caveat": "A formal definition may exist in NASA/TP-2015-216046, which is not in the repository.",
        "link": "/quality?rule_id=FLEX-DISRUPTION",
        "citations": [{"type": "quality_rule", "label": "Quality rule FLEX-DISRUPTION"}],
    })
    return out


def overview(conn: sqlite3.Connection) -> dict:
    inv = investigations(conn)
    report = jloads(conn.execute("SELECT value FROM meta WHERE key='ingest_report'").fetchone()[0], {})
    counts = report.get("counts", {})
    return {
        "investigations": inv,
        "counts": {
            "flex_burns": counts.get("flex_burns"), "bass2_burns": counts.get("bass2_burns"),
            "saffire1_burns": counts.get("saffire1_burns"), "saffire1_image_sets": counts.get("saffire1_image_sets"),
            "total_burn_rows": sum(i["burns"] for i in inv), "documents": counts.get("documents"),
            "chunks": counts.get("chunks"), "quality_flags": counts.get("quality_flags"),
            "publications_listed": counts.get("publications"), "report_records": counts.get("report_records"),
            "evidence_links": counts.get("evidence_links"),
        },
        "ingested_at": report.get("finished_at"),
        "insights": insights(conn),
        "caveat": "Investigations measure different physical systems; totals are not a homogeneous sample.",
    }

"""Load Phase 13 curated JSON into the database (called by app.ingest.run) and declare the new RAG documents.

Works without the NASA source folders (the curated JSON is committed); documents are indexed only when their
source file exists locally.
"""
from __future__ import annotations

import json
from pathlib import Path

from ...db.database import jdumps
from .common import OUT_SUBDIR

NEW_DIRS = {"PSI-117": "PSI-117", "SAME": "PSI-102", "FLEX-2": "PSI-68", "PSI-62": "PSI-62",
            "ACME CFI-G": "PSI-159", "ACME Flame Design": "PSI-10", "ACME BRE": "PSI-20"}

# investigations-table rows for the seven new investigations (title/DOI verified against ISA-Tab in the registry)
NEW_INVESTIGATIONS = [
    dict(investigation_id="PSI-117", key="psi117", short_name="PSI-117",
         title="Effect of External Thermo-Convective Perturbation on Cool Flame Dynamics (PSI-117)",
         description="Ground investigation modelling n-alkane droplet cool flames and validating against ISS FLEX data. "
                     "Local data: published figure series (experiment and 1-D model), presentations and a dissertation.",
         scale="millimetre droplets", fuel_system="liquid droplet (modelling)", doi="10.60555/gz0q-b577"),
    dict(investigation_id="PSI-102", key="same", short_name="SAME", title="Smoke Aerosol Measurement Experiment (SAME)",
         description="ISS Microgravity Science Glovebox experiment (2007) measuring smoke particle sizes from overheated "
                     "spacecraft materials and the response of spacecraft smoke detectors.",
         scale="centimetre samples, smoke aerosol", fuel_system="overheated solid/liquid (pre-flaming)",
         doi="10.60555/gd4k-8h62"),
    dict(investigation_id="PSI-68", key="flex2", short_name="FLEX-2", title="Flame Extinguishment Experiment - 2 (FLEX-2)",
         description="Follow-on ISS droplet campaign (bi-component and surrogate fuels, flow, droplet arrays). Local "
                     "files: science requirements, test-matrix envelope, metadata. No measurements downloaded.",
         scale="millimetre droplets", fuel_system="liquid droplet", doi="10.60555/byp8-h018"),
    dict(investigation_id="PSI-62", key="psi62", short_name="PSI-62",
         title="Concurrent Flame Spread Modeling using Flamelet Generated Manifolds (PSI-62)",
         description="Ground modelling investigation of BASS/BASS-II concurrent flame spread. Metadata only locally.",
         scale="centimetre solid samples (modelling)", fuel_system="solid material (modelling)", doi="10.60555/e9xp-ex83"),
    dict(investigation_id="PSI-159", key="cfig", short_name="ACME CFI-G",
         title="ACME Cool Flames Investigation with Gases (CFI-G)",
         description="ISS spherical porous-burner diffusion flames of ethane, propane and n-butane, normal and inverse, "
                     "2021; first spherical gas-fed cool diffusion flames.",
         scale="centimetre spherical flames", fuel_system="gaseous fuel", doi="10.60555/cyt1-kh64"),
    dict(investigation_id="PSI-10", key="flame_design", short_name="ACME Flame Design", title="ACME Flame Design",
         description="ISS spherical normal and inverse diffusion flames of ethylene (and one propane day), 2019-2022, "
                     "for soot-inception and radiative-extinction limits. Local tables: conditions only.",
         scale="centimetre spherical flames", fuel_system="gaseous fuel", doi="10.60555/w4zy-bt45"),
    dict(investigation_id="PSI-20", key="bre", short_name="ACME BRE", title="ACME Burning Rate Emulator (BRE)",
         description="ISS porous flat-burner flames of C2H4 and CH4 that emulate the burning of condensed fuels in "
                     "quiescent microgravity, 2019-2021. Local data: day log and reports.",
         scale="25-50 mm flat burner", fuel_system="gaseous fuel emulating condensed fuels", doi="10.60555/vb93-3y72"),
]
PSI_URL = "https://psi.nasa.gov/physci/repo/data/investigations/{}"


def _d(title, doc_type, inv, year=None, authors=None, scope=None):
    return dict(title=title, doc_type=doc_type, inv=inv, year=year, authors=authors, scope=scope)


# Verified by reading each document's first pages during the audits. Duplicate copies are not catalogued.
CATALOG = {
    "PSI-117/PSI-117_metadata_NEWID-13_Effect of External T.zip::i_Investigation.txt":
        _d("PSI-117 ISA-Tab investigation metadata", "metadata", "PSI-117", 2024,
           scope="States a 3-D OpenFOAM approach; no CFD output is in the download."),
    "PSI-117/PSI-117_Reports_Dissertation_Combustion Behavior Of Sub-Millimeter Sized Oxygenated And N-Alka.pdf":
        _d("Combustion Behavior of Sub-Millimeter Sized Oxygenated and n-Alkane Fuel Droplets (PhD dissertation)",
           "thesis", "PSI-117", 2018, "M. F. E. Alam (Univ. of South Carolina)",
           "Sphero-symmetric droplet model; FLEX 563 methanol/xenon; drop-tower n-butanol; sub-mm cool flames."),
    "PSI-117/PSI-117_Presentations_Extinction_Characteristics_TFarouk.pdf":
        _d("Extinction characteristics of isolated n-alkane droplets during cool-flame burning in air (slides)", "slides",
           "PSI-117", 2022, "T. Farouk, F. Dryer"),
    "PSI-117/PSI-117_Presentations_Oscillatory_Cool Flame_TFarouk.pdf":
        _d("Oscillatory cool flame of sub-millimeter n-alkane droplets under near-limit conditions (slides)", "slides",
           "PSI-117", 2018, "F. E. Alam, F. Dryer, T. Farouk", "Model-only study (ozone-assisted)."),
    "PSI-117/PSI-117_Presentations_Three_Stage_Cool_Flame_TFarouk.pdf":
        _d("Three-stage cool-flame droplet burning of n-alkanes at elevated pressure (slides)", "slides", "PSI-117", 2018,
           "T. Farouk, D. Dietrich, F. Dryer", "Compares with FLEX 1268 and FLEX 1256 observations."),
    "PSI-117/PSI-117_Presentations_PSI_Users_Group_Cool_Flames_in_Space_03302026.pdf":
        _d("Cool Flames in Space (PSI seminar)", "slides", "PSI-117", 2026, "T. Farouk"),
    "SAME/PSI-102_metadata_PSI-170_SAME.zip::i_Investigation.txt":
        _d("PSI-102 SAME ISA-Tab investigation metadata", "metadata", "PSI-102", 2024),
    "SAME/SAME Final Science report  03 18 10 with papers attached.pdf":
        _d("Smoke Aerosol Measurement Experiment (SAME) Final Science Report, with four attached papers", "nasa_report",
           "PSI-102", 2010, "D. L. Urban, G. A. Ruff, W. Sheredy, T. Cleary, J. Yang, G. Mulholland, Z.-G. Yuan",
           "Table 1 (PDF p27) and Appendix A flight log (PDF p33) are curated. Attached papers print differing values."),
    "SAME/SAME EIRD Rev 2.00 02-25-05 HIgh Q.pdf":
        _d("SAME Exploration Investigation Requirements Document Rev 2.0", "requirements", "PSI-102", 2005, "D. Urban et al."),
    "SAME/SAME ICES 2012 07 15 2012.pptx":
        _d("Particle Morphology and Size Results from SAME-2 (ICES 2012)", "slides", "PSI-102", 2012, "D. Urban et al.",
           "Covers the SAME-2 reflight, whose data are not in the local download."),
    "SAME/SAME ICES  2013 07 15 final as presented.pptx":
        _d("SAME-2: Comparison of Flight Experiment Results with Ground Test Results (ICES 2013)", "slides", "PSI-102",
           2013, "D. Urban et al.", "Covers SAME-2."),
    "FLEX-2/PSI-68_metadata_PSI-132_FLEX-2.zip::i_Investigation.txt":
        _d("PSI-68 FLEX-2 ISA-Tab investigation metadata", "metadata", "PSI-68", 2019),
    "FLEX-2/FLEX-2 SRD Final.pdf":
        _d("FLEX-2 Science Requirements Document", "requirements", "PSI-68", 2010, "F. A. Williams et al.",
           "Requirements and planned test envelope; no FLEX-2 results."),
    "FLEX-2/FLEX-2 DoD.docx": _d("FLEX-2 Description of Data", "data_description", "PSI-68"),
    "PSI-62/PSI-62_metadata_NEWID-7_Concurrent Flame Spr.zip::i_Investigation.txt":
        _d("PSI-62 ISA-Tab investigation metadata", "metadata", "PSI-62", 2021, scope="Only file downloaded for PSI-62."),
    "ACME CFI-G/PSI-159_metadata_PSI-159-ISA.zip::i_Investigation.txt":
        _d("PSI-159 ACME CFI-G ISA-Tab investigation metadata", "metadata", "PSI-159", 2025),
    "ACME CFI-G/PSI-159_Reports_FinalRpt_ACME.CFI-G.pdf":
        _d("ACME Cool Flames Investigation with Gases (CFI-G) Final Report", "nasa_report", "PSI-159", 2022,
           "D. P. Stocker, P. B. Sunderland, R. L. Axelbaum, F. A. Williams",
           "Tables 1-3 curated (PDF p21, p22, p46)."),
    "ACME CFI-G/PSI-159_Engineering Documents_ACME Engineering Implementation Rpt.pdf":
        _d("ACME Engineering Implementation (applies to all ACME experiments)", "engineering", "PSI-159", 2022,
           scope="ACME-wide document; an identical copy is in the Flame Design folder."),
    "ACME Flame Design/PSI-10_metadata_PSI-10-ISA.zip::i_Investigation.txt":
        _d("PSI-10 ACME Flame Design ISA-Tab investigation metadata", "metadata", "PSI-10", 2025),
    "ACME Flame Design/PSI-10_Reports_FinalRpt_ACMEFlameDesign.pdf":
        _d("ACME Flame Design Final Report", "nasa_report", "PSI-10", 2023, "D. P. Stocker, R. L. Axelbaum, P. B. Sunderland",
           "Table 1 curated (PDF p24); key results are paper abstracts (PDF p25-27)."),
    "ACME Flame Design/PSI-10_Science Documents_SRD_ACMEFlameDesign.pdf":
        _d("Flame Design Science Requirements Document", "requirements", "PSI-10", 2010, "R. L. Axelbaum et al."),
    "ACME Flame Design/PSI-10_Reports_TaskbookRpts.pdf":
        _d("Flame Design NASA Task Book reports", "nasa_report", "PSI-10", 2024, "R. L. Axelbaum et al."),
    "ACME Flame Design/PSI-10_Science Documents_ACME_ISRD.pdf":
        _d("ACME Integrated Science Requirements Document Rev B", "requirements", "PSI-10", 2013,
           scope="ACME-wide; objectives and success criteria for all ACME experiments. A text-identical copy is in the "
                 "BRE folder."),
    "ACME BRE/ACME_Science_Operation_Requirements_revA_20111018.pdf":
        _d("ACME Science Operations Requirements Document Rev A", "requirements", "PSI-20", 2011, "D. P. Stocker",
           "ACME-wide; identical copy in the Flame Design folder."),
    "ACME BRE/PSI-20_metadata_PSI-96_ACME BRE.zip::i_Investigation.txt":
        _d("PSI-20 ACME BRE ISA-Tab investigation metadata", "metadata", "PSI-20", 2022),
    "ACME BRE/BRE_final_report_20220201.pdf":
        _d("ACME Burning Rate Emulator (BRE) Final Report", "nasa_report", "PSI-20", 2022,
           "D. P. Stocker, J. G. Quintiere, P. B. Sunderland, J. L. de Ris, P. Dehghani",
           "Table 1 (PDF p24) curated; flammability maps are figures only. Results described as preliminary."),
    "ACME BRE/BRE_data_interpretation_20220804.pdf":
        _d("ACME/BRE Data Interpretation", "data_description", "PSI-20", 2022, "D. P. Stocker",
           "Raw per-test file layout (125 Hz), test numbering, camera formats."),
    "ACME BRE/BRE_SRD_201306.pdf": _d("BRE Science Requirements Document (June 2013)", "requirements", "PSI-20", 2013,
                                      "J. G. Quintiere et al."),
    "ACME BRE/ACME-BRE_DoD.docx": _d("ACME BRE Description of Data", "data_description", "PSI-20"),
    "ACME BRE/Dissertation-PD-revised_.pdf":
        _d("Burning Emulations of Condensed Phase Fuels Aboard the International Space Station (PhD dissertation)",
           "thesis", "PSI-20", 2022, "P. Dehghani (Univ. of Maryland)", "University dissertation; indexed locally only."),
}


def load(conn, processed_dir: Path, src_by_path: dict[str, dict], report: dict) -> dict:
    """Insert registry, datasets, records, long-format values and quality flags. Returns counts."""
    base = processed_dir / OUT_SUBDIR
    if not base.is_dir():
        report.setdefault("warnings", []).append("phase13 curated JSON missing: run python -m app.ingest.phase13.run")
        return {}
    counts = {"datasets": 0, "records": 0, "values": 0, "flags": 0}
    for f in sorted(base.glob("*.json")):
        if f.name == "processing_report.json":
            continue
        d = json.loads(f.read_text(encoding="utf-8"))
        meta = {k: d[k] for k in ("description", "processor_version", "sources", "field_specs", "counts", "notes", "extra")}
        conn.execute("INSERT INTO p13_datasets VALUES (?,?,?,?,?)",
                     (d["dataset_id"], d["investigation_id"], d["title"], d["evidence_class"], jdumps(meta)))
        counts["datasets"] += 1
        specs = {s["field"]: s for s in d["field_specs"]}
        for r in d["records"]:
            pv = r["provenance"]
            inv = r["values"].get("investigation_id") if d["investigation_id"] == "ALL" else d["investigation_id"]
            conn.execute("INSERT INTO p13_records VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                         (r["record_id"], d["dataset_id"], inv, r.get("test_id"), pv["source_file"], pv.get("source_table"),
                          pv.get("page_pdf"), pv.get("source_row"), r["verification"], jdumps(r["values"]),
                          jdumps(r.get("raw", {})), jdumps(r.get("flags", []))))
            counts["records"] += 1
            rows = []
            for fld, sp in specs.items():
                if fld not in r["values"]:
                    continue
                v = r["values"][fld]
                if isinstance(v, (list, dict)):
                    continue
                raw_col = sp.get("raw_column")
                orig = r.get("raw", {}).get(raw_col) if raw_col else None
                num = float(v) if isinstance(v, (int, float)) and not isinstance(v, bool) else None
                rows.append((r["record_id"], d["dataset_id"], inv, r.get("test_id"), fld, sp["variable"], raw_col,
                             None if orig is None else str(orig), sp.get("unit_raw"), num,
                             None if num is not None or v is None else str(v), sp.get("unit"), sp.get("unit_status"),
                             sp.get("transform"), sp["evidence_class"], r["verification"]))
            conn.executemany("INSERT INTO p13_values VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", rows)
            counts["values"] += len(rows)
        if d["dataset_id"] == "investigation_registry":
            for r in d["records"]:
                v = r["values"]
                conn.execute("INSERT INTO investigation_registry VALUES (?,?,?,?,?)",
                             (v["investigation_id"], v["key"], v["scenario"], v["readiness"], jdumps(v)))
        # quality flags (shared Data Reliability table); experiment_uid stays NULL: these are not 'experiments' rows
        src0 = next((src_by_path.get(s["path"]) for s in d["sources"] if src_by_path.get(s["path"])), None)
        for i, fl in enumerate(d["flags"], start=1):
            inv = d["investigation_id"] if d["investigation_id"] != "ALL" else "ALL"
            conn.execute("INSERT INTO quality_flags VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                         (f"{fl['rule_id']}:{fl.get('record_id') or d['dataset_id']}:{i}", inv, None,
                          src0["source_id"] if src0 else None, fl.get("source_row"), fl.get("raw_field"),
                          fl.get("raw_value"), fl["rule_id"], _category(fl["category"]), fl["severity"],
                          fl["description"] + (f" [{fl['test_id']}]" if fl.get("test_id") else ""),
                          None, "; ".join(x for x in (fl.get("evidence_ref"), fl.get("record_id") and f"record {fl['record_id']}")
                                          if x) or None, None, fl.get("status", "reported")))
            counts["flags"] += 1
    return counts


def _category(c: str) -> str:
    return {"undefined": "inconsistent", "info": "source_warning"}.get(c, c)

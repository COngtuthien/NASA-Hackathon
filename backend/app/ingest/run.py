"""Deterministic ingestion: `python -m app.ingest.run [--dry-run]` (run from backend/).

Reads the immutable NASA source folders, writes ONLY to processed/.
Same inputs -> same record counts and UIDs (timestamps aside).
"""
from __future__ import annotations

import argparse
import json
import logging
import re
import sys
import time
from collections import Counter, defaultdict
from pathlib import Path

from ..core.config import get_settings
from ..db.database import connect, init_schema, jdumps, transaction
from . import bass2, documents, flex, saffire
from .common import Flag, now_iso, sha256_file

log = logging.getLogger("spacefire.ingest")

SOURCE_DIRS = ("FLEX", "BASS-II", "SAFFIRE-1")
ROOT_FILES = ("download.zip", "PSI-98_metadata_PSI-166_SAFFIRE-I.zip")

INVESTIGATIONS = [
    dict(investigation_id="PSI-69", key="flex", short_name="FLEX",
         title="Flame Extinguishment Experiment (FLEX)",
         description="Isolated liquid-fuel droplet combustion and flame extinction in microgravity (ISS CIR/MDCA). "
                     "Methanol and n-heptane droplets burned in O2/N2 atmospheres diluted with CO2 or He at "
                     "~0.7-3 atm to map extinction limits.",
         scale="millimetre droplets", fuel_system="liquid droplet",
         doi="10.60555/mbq8-0451", official_url="https://psi.nasa.gov/physci/repo/data/investigations/PSI-69"),
    dict(investigation_id="PSI-25", key="bass2", short_name="BASS-II",
         title="Burning and Suppression of Solids II (BASS-II)",
         description="Small solid samples (PMMA films, slabs, rods, spheres; SIBAL and Nomex fabrics; a wax candle) "
                     "burned in a small flow duct in the ISS Microgravity Science Glovebox under controlled low-speed "
                     "airflow and reduced oxygen. Gas composition read before and after each burn.",
         scale="centimetre solid samples", fuel_system="solid material",
         doi="10.60555/4qc4-de67", official_url="https://psi.nasa.gov/physci/repo/data/investigations/PSI-25"),
    dict(investigation_id="PSI-98", key="saffire1", short_name="SAFFIRE-I",
         title="Spacecraft Fire Experiment I (SAFFIRE-I)",
         description="Large-scale fire on a ~0.4 m x 0.94 m SIBAL cotton/fiberglass fabric aboard an uncrewed "
                     "Cygnus vehicle after ISS departure (2016), at a nominal 20 cm/s airflow; concurrent (S1) and "
                     "opposed (S2) flame spread burns.",
         scale="spacecraft-scale fabric sheet", fuel_system="solid fabric",
         doi="10.60555/0t15-1z43", official_url="https://psi.nasa.gov/physci/repo/data/investigations/PSI-98"),
]

MEDIA = {".csv": "text/csv", ".pdf": "application/pdf", ".zip": "application/zip", ".txt": "text/plain",
         ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
         ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
         ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}
INV_BY_DIR = {"FLEX": "PSI-69", "BASS-II": "PSI-25", "SAFFIRE-1": "PSI-98"}


def role_for(rel: str) -> str:
    if rel.endswith(".csv"):
        return "experiment_table"
    if rel.endswith(".zip"):
        return "archive"
    if "MergeResult" in rel:
        return "manifest"
    if "calibration" in rel.lower():
        return "calibration"
    if rel.endswith(".xlsx"):
        return "data_table"
    if "i_Investigation" in rel or "s_PSI" in rel:
        return "metadata"
    return "document"


def inventory(repo_root: Path) -> list[dict]:
    files: list[Path] = []
    for d in SOURCE_DIRS:
        files += [p for p in (repo_root / d).rglob("*") if p.is_file()]
    files += [repo_root / f for f in ROOT_FILES if (repo_root / f).exists()]
    entries = []
    for p in sorted(files, key=lambda x: x.relative_to(repo_root).as_posix()):
        rel = p.relative_to(repo_root).as_posix()
        entries.append({
            "relative_path": rel, "sha256": sha256_file(p), "size_bytes": p.stat().st_size,
            "media_type": MEDIA.get(p.suffix.lower(), "application/octet-stream"),
            "investigation_id": INV_BY_DIR.get(rel.split("/")[0], "PSI-69" if rel == "download.zip" else "PSI-98"),
            "role": role_for(rel),
        })
    # duplicates: canonical = first path in sorted order that lives in a dataset folder
    by_hash: dict[str, list[dict]] = defaultdict(list)
    for e in entries:
        by_hash[e["sha256"]].append(e)
    for group in by_hash.values():
        group.sort(key=lambda e: (e["relative_path"].split("/")[0] not in SOURCE_DIRS, e["relative_path"]))
        for e in group[1:]:
            e["duplicate_of"] = group[0]["relative_path"]
    for e in entries:
        e["source_id"] = e["sha256"][:12] if not e.get("duplicate_of") else e["sha256"][:12] + "-" + \
            re.sub(r"[^a-z0-9]", "", e["relative_path"].lower())[-6:]
    # download.zip: verify every member is a byte-identical copy of FLEX/
    return entries


def _write_records(conn, records, investigation_id, source_id, table, columns):
    for r in records:
        conn.execute(
            "INSERT INTO experiments(experiment_uid, investigation_id, source_id, source_row, display_id, "
            "experiment_kind, raw_json) VALUES (?,?,?,?,?,?,?)",
            (r.experiment_uid, investigation_id, source_id, r.source_row, r.display_id, r.experiment_kind,
             jdumps(r.raw_pairs)))
        conn.executemany(
            "INSERT INTO observations(experiment_uid, column_index, raw_field, raw_text, value_kind, numeric_value, "
            "numeric_low, numeric_high, text_value, normalized_name, unit_raw, unit_normalized, measurement_role, "
            "derivation_note) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            [(r.experiment_uid, o.column_index, o.raw_field, o.raw_text, o.value_kind, o.numeric_value,
              o.numeric_low, o.numeric_high, o.text_value, o.normalized_name, o.unit_raw, o.unit_normalized,
              o.measurement_role, o.derivation_note) for o in r.observations])
        vals = []
        for c in columns:
            v = r.normalized.get(c)
            vals.append(jdumps(v) if isinstance(v, (list, dict)) else v)
        conn.execute(f"INSERT INTO {table}({', '.join(columns)}) VALUES ({', '.join('?' * len(columns))})", vals)


FLEX_COLS = ["experiment_uid", "test_number", "identifier", "series", "mixture_code", "test_date", "test_gmt", "fuel",
             "pressure_mmhg", "pressure_atm", "pressure_band", "x_o2", "x_n2", "x_co2", "x_he", "mole_sum", "diluent",
             "d0_mm", "d0_kind", "dext_mm", "dext_kind", "k_mm2_s", "k_kind", "burn_time_s", "burn_time_kind",
             "test_end"]
BASS_COLS = ["experiment_uid", "pi", "test_id", "date_raw", "date_iso", "date_doy", "gmt_doy", "sample_id",
             "material_raw", "material_class", "material_color", "geometry", "thickness_mm", "diameter_mm", "width_cm",
             "sides", "material_note", "flow_restrictor", "fan_raw", "fan_kind", "fan_tokens_json", "air_raw",
             "air_kind", "air_tokens_json", "air_single_cm_s", "radiometer_gain_raw", "frames_raw",
             "o2_initial", "o2_initial_kind", "o2_final", "o2_final_kind", "co2_initial", "co2_initial_kind",
             "co2_final", "co2_final_kind", "co_initial", "co_initial_kind", "co_final", "co_final_kind"]
SAF_COLS = ["experiment_uid", "sample", "material", "thickness_cm", "length_cm", "width_cm", "air_flow_cm_s", "o2_raw",
            "o2_kind", "o2_low", "o2_high", "ignition_power_w", "ignition_time_s", "burn_time_s", "flow_direction",
            "camera_1", "camera_2"]

FLEX_ID_RE = re.compile(r"\b(\d{2,3}CAL\d{2}|\d{3}[FR]\d{3}|[CHN]\d{2}[MH]\d{3})\b")
FLEX_NUM_RE = re.compile(r"\bFLEX-(\d{3})\b")  # 3 digits: 'FLEX-2' is the follow-on experiment, not test #2
SAF_RE = re.compile(r"\b(S[12])(?:C[12])?\b")


def link_evidence(conn, chunks_by_inv: dict[str, list[dict]]) -> int:
    n = 0
    flex_ids = defaultdict(list)
    flex_nums = {}
    for r in conn.execute("SELECT experiment_uid, identifier, test_number FROM flex_tests"):
        flex_ids[r["identifier"]].append(r["experiment_uid"])
        flex_nums[r["test_number"]] = r["experiment_uid"]
    bass_ids = {r["test_id"]: r["experiment_uid"] for r in conn.execute("SELECT experiment_uid, test_id FROM bass2_tests")}
    bass_re = re.compile(r"(?<![A-Za-z.\-])(" + "|".join(sorted(map(re.escape, bass_ids), key=len, reverse=True)) +
                         r")(?![A-Za-z0-9])")
    rows = []
    for ch in chunks_by_inv.get("PSI-69", []):
        for m in set(FLEX_ID_RE.findall(ch["text"])):
            for uid in flex_ids.get(m, []):
                rows.append((uid, ch["chunk_id"], "explicit_id", "flex_identifier_regex", m))
        for m in set(FLEX_NUM_RE.findall(ch["text"])):
            uid = flex_nums.get(int(m))
            if uid:
                rows.append((uid, ch["chunk_id"], "explicit_id", "flex_test_number_regex", f"FLEX-{m}"))
    for ch in chunks_by_inv.get("PSI-25", []):
        text = ch["text"]
        found = set()
        for m in bass_re.finditer(text):
            pre = text[max(0, m.start() - 9): m.start()].lower()
            if re.search(r"(table|figure|fig\.|appendix|eq\.)\s*$", pre):
                continue
            found.add(m.group(1))
        for tid in found:
            rows.append((bass_ids[tid], ch["chunk_id"], "explicit_id", "bass_test_id_regex", tid))
    for ch in chunks_by_inv.get("PSI-98", []):
        for s in set(SAF_RE.findall(ch["text"])):
            rows.append((f"saffire1:{s}", ch["chunk_id"], "explicit_id", "saffire_sample_regex", s))
    conn.executemany("INSERT INTO evidence_links(experiment_uid, chunk_id, relation_type, match_method, matched_text, "
                     "review_status) VALUES (?,?,?,?,?,'auto_unreviewed')", rows)
    n += len(rows)
    return n


def write_flags(conn, flags: list[Flag], investigation_id: str, source_id_by_uid: dict, default_source: str):
    counters: Counter = Counter()
    rows = []
    for f in flags:
        key = f"{f.rule_id}:{f.experiment_uid or 'dataset'}"
        counters[key] += 1
        flag_id = f"{key}:{counters[key]}"
        rows.append((flag_id, investigation_id, f.experiment_uid, source_id_by_uid.get(f.experiment_uid, default_source),
                     f.source_row, f.raw_field, f.raw_value, f.rule_id, f.category, f.severity, f.description,
                     f.derived_value, f.evidence_ref, f.proposed_correction, f.status))
    conn.executemany("INSERT INTO quality_flags VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", rows)
    return len(rows)


def run(dry_run: bool = False) -> dict:
    settings = get_settings()
    repo = settings.repo_root
    t0 = time.time()
    report: dict = {"started_at": now_iso(), "repo_root": str(repo), "datasets": {}, "documents": {}, "warnings": []}

    inv = inventory(repo)
    src = {e["relative_path"]: e for e in inv}
    report["inventory"] = {"files": len(inv), "duplicates": sum(1 for e in inv if e.get("duplicate_of"))}

    fx_records, fx_flags, fx_rep = flex.ingest(repo)
    b2_records, b2_flags, b2_rep = bass2.ingest(repo)
    sa_burns, sa_sets, sa_flags, sa_rep = saffire.ingest(repo)
    report["datasets"] = {"flex": fx_rep, "bass2": b2_rep, "saffire1": sa_rep}
    log.info("parsed FLEX=%d BASS-II=%d SAFFIRE burns=%d image sets=%d", len(fx_records), len(b2_records),
             len(sa_burns), len(sa_sets))
    try:
        manifest, timeline, man_rep = saffire.ingest_manifest(repo)
        report["datasets"]["saffire1_manifest"] = man_rep
    except Exception as exc:  # nonfatal per spec §6.4
        manifest, timeline = [], []
        report["warnings"].append(f"SAFFIRE manifest failed: {exc!r}")
    sa_flags += saffire.manifest_flags(manifest, sa_sets)

    # documents
    doc_rows, chunk_rows, pubs, isa_meta = [], [], [], {}
    for key, meta in documents.CATALOG.items():
        file_key = key.split("::")[0]
        if file_key not in src:
            report["warnings"].append(f"catalog document missing on disk: {key}")
            continue
        doc_id = documents.slugify(key)
        try:
            if key.endswith("i_Investigation.txt"):
                ex, p, m = documents.extract_isatab(repo, key)
                pubs += [dict(x, investigation_id=meta["inv"], source_id=src[file_key]["source_id"]) for x in p]
                isa_meta[meta["inv"]] = m
            else:
                ex = documents.extract(repo, key)
        except Exception as exc:
            report["warnings"].append(f"extraction failed {key}: {exc!r}")
            doc_rows.append((doc_id, src[file_key]["source_id"], key, meta["title"], meta.get("authors"),
                             meta.get("year"), meta["inv"], meta["doc_type"], meta.get("scope"), None,
                             meta.get("offset"), "NASA public data/document; see source site", "failed", "[]"))
            continue
        chunks = documents.chunk_document(doc_id, meta["title"], ex, meta.get("offset"))
        for c in chunks:
            c["investigation_id"] = meta["inv"]
        chunk_rows += chunks
        doc_rows.append((doc_id, src[file_key]["source_id"], key, meta["title"], meta.get("authors"), meta.get("year"),
                         meta["inv"], meta["doc_type"], meta.get("scope"), ex.page_count, meta.get("offset"),
                         "NASA public data/document; see source site", ex.status, json.dumps(ex.low_text_pages)))
        report["documents"][doc_id] = {"pages": ex.page_count, "chunks": len(chunks),
                                       "low_text_pages": len(ex.low_text_pages)}

    # dedupe chunks with identical text across documents (e.g. Test Plan pages inside the RRD)
    seen: dict[str, str] = {}
    dup_chunks = 0
    for c in chunk_rows:
        if c["content_hash"] in seen:
            c["duplicate_of"] = seen[c["content_hash"]]
            dup_chunks += 1
        else:
            seen[c["content_hash"]] = c["chunk_id"]
    report["chunks"] = {"total": len(chunk_rows), "duplicate_text": dup_chunks}

    if dry_run:
        report["dry_run"] = True
        return report

    db_path = settings.db_path
    tmp = db_path.with_suffix(".building.db")
    if tmp.exists():
        tmp.unlink()
    conn = connect(tmp)
    init_schema(conn)
    with transaction(conn):
        for i in INVESTIGATIONS:
            meta = isa_meta.get(i["investigation_id"], {})
            conn.execute("INSERT INTO investigations VALUES (?,?,?,?,?,?,?,?,?,?)",
                         (i["investigation_id"], i["key"], i["short_name"], i["title"], i["description"], i["scale"],
                          i["fuel_system"], i["doi"], i["official_url"], jdumps(meta)))
        ingested_at = now_iso()
        for e in inv:
            parsed = e["relative_path"] in (flex.REL_PATH, bass2.REL_PATH, saffire.REL_PATH, saffire.XLSX_PATH) or \
                any(k.split("::")[0] == e["relative_path"] for k in documents.CATALOG)
            status = "skipped_duplicate" if e.get("duplicate_of") else ("parsed" if parsed else "not_parsed")
            conn.execute("INSERT INTO source_files VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                         (e["source_id"], e["relative_path"], e["sha256"], e["size_bytes"], e["media_type"],
                          e["investigation_id"], e["role"], e.get("duplicate_of"), ingested_at, status, "local", None))
        _write_records(conn, fx_records, flex.INVESTIGATION_ID, src[flex.REL_PATH]["source_id"], "flex_tests", FLEX_COLS)
        _write_records(conn, b2_records, bass2.INVESTIGATION_ID, src[bass2.REL_PATH]["source_id"], "bass2_tests",
                       BASS_COLS)
        sa_src = src[saffire.REL_PATH]["source_id"]
        _write_records(conn, sa_burns, saffire.INVESTIGATION_ID, sa_src, "saffire_burns", SAF_COLS)
        for s in sa_sets:
            conn.execute("INSERT INTO saffire_image_sets VALUES (?,?,?,?,?,?,?,?,?)",
                         (s["image_set_uid"], s["label"], sa_src, s["source_row"], s["raw_label"], s["csv_description"],
                          s["csv_role"], s["documented_role"], s["manifest_set"]))
        conn.executemany("INSERT INTO saffire_manifest VALUES (:set_label,:camera,:frames,:start_utc,:end_utc,"
                         ":duration_s,:median_dt_ms,:max_gap_ms,:jpeg_received,:jpeg_corrupt,:zips_listed,"
                         ":zips_received)", manifest)
        conn.executemany("INSERT INTO saffire_timeline VALUES (:set_label,:camera,:bin_start_s,:bin_start_utc,:frames,"
                         ":received,:corrupt)", timeline)
        nflags = 0
        nflags += write_flags(conn, fx_flags, "PSI-69", {}, src[flex.REL_PATH]["source_id"])
        nflags += write_flags(conn, b2_flags, "PSI-25", {}, src[bass2.REL_PATH]["source_id"])
        nflags += write_flags(conn, sa_flags, "PSI-98", {}, sa_src)
        conn.executemany("INSERT INTO documents VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)", doc_rows)
        canonical = [c for c in chunk_rows if not c.get("duplicate_of")]
        conn.executemany(
            "INSERT INTO document_chunks(chunk_id, document_id, ordinal, page_pdf, page_printed, section, text, "
            "content_hash, is_verified) VALUES (:chunk_id,:document_id,:ordinal,:page_pdf,:page_printed,:section,:text,"
            ":content_hash,1)", canonical)
        conn.executemany("INSERT INTO chunks_fts(chunk_id, title, section, text) VALUES (?,?,?,?)",
                         [(c["chunk_id"], c["title"], c["section"] or "", c["text"]) for c in canonical])
        conn.executemany("INSERT INTO investigation_publications(investigation_id, title, authors, doi, status, "
                         "source_id) VALUES (:investigation_id,:title,:authors,:doi,:status,:source_id)", pubs)
        by_inv: dict[str, list[dict]] = defaultdict(list)
        for c in canonical:
            by_inv[c["investigation_id"]].append(c)
        nlinks = link_evidence(conn, by_inv)
        counts = {
            "flex_burns": len(fx_records), "bass2_burns": len(b2_records), "saffire1_burns": len(sa_burns),
            "saffire1_image_sets": len(sa_sets), "quality_flags": nflags, "documents": len(doc_rows),
            "chunks": len(canonical), "evidence_links": nlinks, "publications": len(pubs),
            "manifest_camera_sets": len(manifest),
        }
        report["counts"] = counts
        report["finished_at"] = now_iso()
        report["elapsed_s"] = round(time.time() - t0, 2)
        report["source_hashes"] = {e["relative_path"]: e["sha256"] for e in inv}
        conn.execute("INSERT INTO meta VALUES ('ingest_report', ?)", (jdumps(report),))
        conn.execute("INSERT INTO meta VALUES ('ingested_at', ?)", (report["finished_at"],))
    conn.close()

    # build retrieval vectors before swapping the DB in
    from ..services.vectors import build_vector_index
    vec = build_vector_index(tmp, settings.processed_dir)
    report["vectors"] = vec
    from ..services.ml import train_and_evaluate
    try:
        report["ml_flex"] = train_and_evaluate(tmp, settings.processed_dir)
    except Exception as exc:  # P2 must never block P0/P1 data
        report["warnings"].append(f"FLEX ML evaluation failed: {exc!r}")
    conn = connect(tmp)
    with transaction(conn):
        conn.execute("UPDATE meta SET value=? WHERE key='ingest_report'", (jdumps(report),))
    conn.close()
    if db_path.exists():
        db_path.unlink()
    tmp.replace(db_path)
    (settings.processed_dir / "ingest_report.json").write_text(json.dumps(report, indent=2, ensure_ascii=False),
                                                               encoding="utf-8")
    (settings.processed_dir / "source_manifest.json").write_text(
        json.dumps(inv, indent=2, ensure_ascii=False), encoding="utf-8")
    return report


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    ap = argparse.ArgumentParser(description="Build the SpaceFire AI database from the original NASA files.")
    ap.add_argument("--dry-run", action="store_true", help="parse and validate only; write nothing")
    args = ap.parse_args()
    rep = run(dry_run=args.dry_run)
    summary = {k: rep.get(k) for k in ("counts", "inventory", "chunks", "warnings", "elapsed_s", "vectors")}
    sys.stdout.write(json.dumps(summary, indent=2) + "\n")


if __name__ == "__main__":
    main()

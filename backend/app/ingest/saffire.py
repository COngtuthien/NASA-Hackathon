"""SAFFIRE-I (PSI-98) ingestion: 2 burn rows, 2 image-set rows, and the JPEG manifest.

The XLSX workbook is an image/downlink MANIFEST (file names with epoch-ms
timestamps, received/corrupt status, JPEG byte sizes). It contains no images and
no physical measurements; JPEG size is never presented as a flame quantity.
"""
from __future__ import annotations

import collections
import csv
import datetime as dt
import io
import re
import statistics as st
import zipfile
from pathlib import Path
import defusedxml.ElementTree as ET  # hardened against entity-expansion / XXE

from .common import ExperimentRecord, Flag, Observation
from .values import PRESENT, TEXT, BLANK, parse_number_cell

REL_PATH = "SAFFIRE-1/PSI-98_Experimental table_SAFFIRE-1.csv"
XLSX_PATH = "SAFFIRE-1/SAFFIRE-1_MergeResult-jpeg_Update_Final_v2.xlsx"
DOD = "SAFFIRE-1/SAFFIRE-I and SAFFIRE-III DoD.docx"
OPS = "SAFFIRE-1/SAFFIRE-I Operations.pdf"
INVESTIGATION_ID = "PSI-98"

UNITS = {
    "Sample Thickness (cm)": "cm", "Sample Length (cm)": "cm", "Sample Width (cm)": "cm",
    "Air Flow (cm/s)": "cm/s", "Percent O2": "%", "Ignition Power (W)": "W",
    "Ignition Time (s)": "s", "Burn Time (s)": "s",
}
NAMES = {
    "Sample Number": "sample", "Material": "material", "Sample Thickness (cm)": "thickness_cm",
    "Sample Length (cm)": "length_cm", "Sample Width (cm)": "width_cm", "Air Flow (cm/s)": "air_flow_cm_s",
    "Percent O2": "o2_percent", "Ignition Power (W)": "ignition_power_w", "Ignition Time (s)": "ignition_time_s",
    "Burn Time (s)": "burn_time_s", "Flow Direction": "flow_direction", "Camera 1": "camera_1", "Camera 2": "camera_2",
}
ROLES = {"sample": "identifier", "camera_1": "context", "camera_2": "context", "burn_time_s": "output"}

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
RNS = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
PKG_RNS = "{http://schemas.openxmlformats.org/package/2006/relationships}"
MANIFEST_SHEETS = {  # sheet name -> set label, filename col, size col, zip col
    "BIT - jpeg": ("BIT", "E", "F", "I"),
    "PreFlowVis - jpeg": ("PreFlowVis", "E", "H", "K"),
    "PostFlowVis - jpeg": ("PostFlowVis", "E", "H", "K"),
    "Sample1 - jpeg": ("Sample1", "E", "H", "K"),
    "Sample2 - jpeg": ("Sample2", "E", "H", "K"),
}
BIN_S = 10


def ingest(repo_root: Path) -> tuple[list[ExperimentRecord], list[dict], list[Flag], dict]:
    text = (repo_root / REL_PATH).read_bytes().decode("utf-8-sig")
    rows = [r for r in csv.reader(io.StringIO(text, newline="")) if any(c.strip() for c in r)]
    header, data = rows[0], rows[1:]
    clean = [h.strip() for h in header]
    report = {"file": REL_PATH, "columns": len(header), "rows": len(data), "warnings": []}
    burns: list[ExperimentRecord] = []
    image_sets: list[dict] = []
    flags: list[Flag] = []

    for i, row in enumerate(data, start=1):
        row = (row + [""] * len(header))[: len(header)]
        label = row[0].strip()
        if re.match(r"^S\d+$", label):
            uid = f"saffire1:{label}"
            rec = ExperimentRecord(uid, i, label, "burn", list(zip(header, row)))
            norm = {"experiment_uid": uid}
            for ci, (h, hc, raw) in enumerate(zip(header, clean, row)):
                name = NAMES.get(hc, hc)
                unit = UNITS.get(hc)
                if unit:
                    pv = parse_number_cell(raw)
                    rec.observations.append(Observation(ci, h, raw, pv.kind, name, ROLES.get(name, "input"), pv.value,
                                                        pv.low, pv.high, pv.text, unit, unit))
                    if name == "o2_percent":
                        norm.update(o2_raw=raw.strip(), o2_kind=pv.kind, o2_low=pv.low, o2_high=pv.high)
                    else:
                        norm[name] = pv.value if pv.kind == PRESENT else None
                else:
                    rec.observations.append(Observation(ci, h, raw, TEXT if raw.strip() else BLANK, name,
                                                        ROLES.get(name, "input"), text_value=raw.strip() or None))
                    norm[name] = raw.strip() or None
            rec.normalized = norm
            burns.append(rec)
            if norm.get("o2_kind") != PRESENT:
                flags.append(Flag("SAF-O2-TEXT", "missing", "info",
                                  f"Percent O2 is recorded as '{norm['o2_raw']}' ({norm['o2_kind']}), not a single value.",
                                  uid, i, "Percent O2", norm["o2_raw"]))
            flags.append(Flag("SAF-LENGTH-WIDTH", "document_conflict", "warning",
                              f"CSV gives Length {norm.get('length_cm')} cm and Width {norm.get('width_cm')} cm, but "
                              "the Operations document describes the sample as ~0.4 m wide by 0.94 m tall: the two "
                              "columns appear swapped.", uid, i, "Sample Length (cm)", row[clean.index('Sample Length (cm)')],
                              evidence_ref=f"{OPS} p.1", status="disputed"))
            flags.append(Flag("SAF-CSV-ONLY", "source_warning", "info",
                              "Thickness, ignition power/time and burn time have no corroborating local document; "
                              "values are shown exactly as recorded in the CSV.", uid, i))
        elif re.match(r"^F\d", label):
            set_label = label.split("C")[0]  # 'F1C1/F1C2' -> 'F1'
            desc = row[1].strip()
            documented = "pre-test flow visualization" if set_label == "F1" else "post-test flow visualization"
            image_sets.append({
                "image_set_uid": f"saffire1:images:{set_label}", "label": set_label, "source_row": i,
                "raw_label": label, "csv_description": desc,
                "csv_role": "pre-test flow visualization" if desc.lower().startswith("pre") else desc,
                "documented_role": documented,
                "manifest_set": "PreFlowVis" if set_label == "F1" else "PostFlowVis",
            })
        else:
            report["warnings"].append(f"row {i}: unrecognized label {label!r}")

    report["burns"] = [b.display_id for b in burns]
    report["image_sets"] = [s["label"] for s in image_sets]
    return burns, image_sets, flags, report


# ---------------------------------------------------------------- manifest ---

def _sheet_paths(z: zipfile.ZipFile) -> dict[str, str]:
    wb = ET.fromstring(z.read("xl/workbook.xml"))
    rels = ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
    target = {r.get("Id"): r.get("Target") for r in rels.findall(PKG_RNS + "Relationship")}
    out = {}
    for s in wb.iter(NS + "sheet"):
        t = target[s.get(RNS + "id")]
        out[s.get("name")] = "xl/" + t.lstrip("/").removeprefix("xl/")
    return out


def _rows(z: zipfile.ZipFile, path: str, ss: list[str]):
    with z.open(path) as f:
        for _, el in ET.iterparse(f, events=("end",)):
            if el.tag == NS + "row":
                rr = {}
                for c in el.findall(NS + "c"):
                    col = re.match(r"[A-Z]+", c.get("r")).group()
                    v = c.find(NS + "v")
                    if v is not None and v.text is not None:
                        rr[col] = ss[int(v.text)] if c.get("t") == "s" else v.text
                    else:
                        is_ = c.find(NS + "is")
                        if is_ is not None:
                            rr[col] = "".join(t.text or "" for t in is_.iter(NS + "t"))
                yield rr
                el.clear()


def _utc(ms: int) -> str:
    return dt.datetime.fromtimestamp(ms / 1000, dt.UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def ingest_manifest(repo_root: Path) -> tuple[list[dict], list[dict], dict]:
    path = repo_root / XLSX_PATH
    z = zipfile.ZipFile(path)
    ss = [
        "".join(t.text or "" for t in si.iter(NS + "t"))
        for si in ET.fromstring(z.read("xl/sharedStrings.xml")).findall(NS + "si")
    ]
    sheets = _sheet_paths(z)
    report = {"file": XLSX_PATH, "sheets": list(sheets), "sheet_count": len(sheets),
              "has_embedded_media": any(n.startswith("xl/media/") for n in z.namelist()),
              "epoch_convention": "Unix epoch milliseconds in file names; workbook converts with DATE(1970,1,1)."}

    def collect(name: str) -> dict[str, set]:
        out = collections.defaultdict(set)
        if name not in sheets:
            return out
        for k, rr in enumerate(_rows(z, sheets[name], ss)):
            if k == 0:
                continue
            for v in rr.values():
                if isinstance(v, str) and len(v) >= 4:
                    out[v[:4]].add(v)
        return out

    received = collect("Received - jpeg")
    corrupt = collect("Received - jpeg Corrupted")
    zips_rcv = collect("Received - jpeg Zips")

    summary, timeline = [], []
    for sheet, (label, fcol, scol, zcol) in MANIFEST_SHEETS.items():
        if sheet not in sheets:
            report.setdefault("warnings", []).append(f"missing sheet {sheet}")
            continue
        per = collections.defaultdict(list)
        zips = collections.defaultdict(list)
        for k, rr in enumerate(_rows(z, sheets[sheet], ss)):
            if k == 0:
                continue
            fn = rr.get(fcol)
            if not fn or "-" not in fn:
                continue
            cam = fn[:4]
            m = re.search(r"-(\d{10,})", fn)
            if not m:
                continue
            per[cam].append((int(m.group(1)), fn))
            zf = rr.get(zcol)
            if zf:
                zips[cam].append(zf)
        for cam, items in sorted(per.items()):
            items.sort()
            t0, t1 = items[0][0], items[-1][0]
            gaps = [b[0] - a[0] for a, b in zip(items, items[1:])]
            rcv = sum(1 for _, f in items if f in received[cam])
            cor = sum(1 for _, f in items if f in corrupt[cam])
            summary.append({
                "set_label": label, "camera": cam, "frames": len(items),
                "start_utc": _utc(t0), "end_utc": _utc(t1), "duration_s": round((t1 - t0) / 1000, 1),
                "median_dt_ms": st.median(gaps) if gaps else None, "max_gap_ms": max(gaps) if gaps else None,
                "jpeg_received": rcv, "jpeg_corrupt": cor,
                "zips_listed": len(zips[cam]), "zips_received": sum(1 for f in zips[cam] if f in zips_rcv[cam]),
            })
            bins = collections.defaultdict(lambda: [0, 0, 0])
            for ts, f in items:
                b = (ts - t0) // (BIN_S * 1000)
                bins[b][0] += 1
                bins[b][1] += f in received[cam]
                bins[b][2] += f in corrupt[cam]
            for b, (nf, nr, nc) in sorted(bins.items()):
                timeline.append({"set_label": label, "camera": cam, "bin_start_s": int(b * BIN_S),
                                 "bin_start_utc": _utc(t0 + b * BIN_S * 1000),
                                 "frames": nf, "received": nr, "corrupt": nc})
    report["camera_sets"] = len(summary)
    report["total_frames"] = sum(s["frames"] for s in summary)
    return summary, timeline, report


def manifest_flags(summary: list[dict], image_sets: list[dict]) -> list[Flag]:
    flags: list[Flag] = []
    by = {(s["set_label"], s["camera"]): s for s in summary}
    s2_end = max((s["end_utc"] for s in summary if s["set_label"] == "Sample2"), default=None)
    f2_start = min((s["start_utc"] for s in summary if s["set_label"] == "PostFlowVis"), default=None)
    for s in image_sets:
        if s["label"] == "F2":
            timing = (f" Workbook timing: F2 frames start {f2_start}, after the last Sample 2 frame {s2_end}."
                      if s2_end and f2_start else "")
            flags.append(Flag(
                "SAF-F2-LABEL", "document_conflict", "warning",
                f"CSV describes F2 as '{s['csv_description']}', but the DoD names F1 pre-flow and F2 post-flow "
                f"visualization.{timing}", None, s["source_row"], "Material", s["csv_description"],
                derived_value="post-test flow visualization", evidence_ref=f"{DOD}; {XLSX_PATH}",
                proposed_correction="Treat F2 as post-test flow visualization (documented).", status="disputed"))
    for (label, cam), s in by.items():
        if s["frames"] and s["jpeg_received"] / s["frames"] < 0.5 and label != "BIT":
            flags.append(Flag(
                "SAF-DOWNLINK-GAP", "source_warning", "warning",
                f"{label}/{cam}: only {s['jpeg_received']} of {s['frames']} listed JPEGs "
                f"({100 * s['jpeg_received'] / s['frames']:.1f} %) are marked received in the manifest.",
                None, None, None, None, evidence_ref=XLSX_PATH))
    flags.append(Flag(
        "SAF-NO-MEDIA", "source_warning", "info",
        "The SAFFIRE-I workbook is a manifest only: no embedded images and no calibrated physical measurements "
        "(no flame position, spread rate, temperature or gas time series). JPEG byte size is not a flame metric.",
        evidence_ref=XLSX_PATH, status="confirmed"))
    flags.append(Flag(
        "SAF-METADATA-CONFLICT", "document_conflict", "info",
        "ISA-Tab metadata lists investigation dates 2001-03-02 to 2008-02-28, flight platform ISS and a smoke-"
        "characterization proposal title, which conflict with the operations document (Cygnus, after ISS "
        "departure) and the 2016-06-14 image timestamps.",
        evidence_ref="SAFFIRE-1/PSI-98_metadata_PSI-166_SAFFIRE-I (1).zip i_Investigation.txt; " + OPS,
        status="unresolved"))
    return flags

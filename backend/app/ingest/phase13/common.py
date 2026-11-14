"""Shared helpers for Phase 13 processing: provenance, flags, numeric parsing, PDF text verification, output."""
from __future__ import annotations

import csv
import io
import json
import math
import re
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

from ..common import sha256_file

OUT_SUBDIR = Path("curated") / "phase13"
PROCESSOR_VERSION = "phase13-1"

# Evidence classes (Phase 13 schema). "measured" is never applied wholesale: each field declares its class.
EVIDENCE_CLASSES = {
    "direct_measurement": "Value measured by an instrument or observed by the experiment team for this test",
    "derived_experimental": "Value calculated from experimental quantities (by NASA/PI or by SpaceFire, stated per field)",
    "digitized_figure": "Published figure data supplied as a table (digitized points; precision limited)",
    "model_prediction": "Output of a numerical or analytical model, not a measurement",
    "literature_value": "Value quoted from the literature in a NASA report",
    "test_condition": "Experimental setting or condition (an input, not an outcome)",
    "report_statement": "Statement or summary value printed in a NASA report",
    "operational_log": "Operational log entry (what was run, when)",
    "conceptual": "Conceptual visualization; not data",
}


@dataclass
class Flag:
    rule_id: str
    category: str          # missing / invalid / inconsistent / suspicious / undefined / document_conflict / unit / info
    severity: str          # info / warning / critical
    description: str
    record_id: str | None = None
    test_id: str | None = None
    raw_field: str | None = None
    raw_value: str | None = None
    source_row: int | None = None
    evidence_ref: str | None = None
    status: str = "reported"   # reported / confirmed / disputed / unresolved

    def to_dict(self) -> dict:
        return {k: v for k, v in asdict(self).items() if v is not None}


@dataclass
class Dataset:
    dataset_id: str
    investigation_id: str
    title: str
    evidence_class: str
    description: str
    sources: list[dict] = field(default_factory=list)
    field_specs: list[dict] = field(default_factory=list)
    records: list[dict] = field(default_factory=list)
    flags: list[Flag] = field(default_factory=list)
    counts: dict = field(default_factory=dict)
    notes: list[str] = field(default_factory=list)
    extra: dict = field(default_factory=dict)

    def flag(self, f: Flag) -> None:
        self.flags.append(f)
        if f.record_id:
            for r in self.records:
                if r["record_id"] == f.record_id and f.rule_id not in r["flags"]:
                    r["flags"].append(f.rule_id)

    def finalize(self, source_records: int, excluded: int = 0, excluded_reasons: dict | None = None) -> None:
        flagged = sum(1 for r in self.records if r.get("flags"))
        sev = {f.rule_id: f.severity for f in self.flags}
        warn = sum(1 for r in self.records if any(sev.get(x) in ("warning", "critical") for x in r.get("flags", [])))
        self.counts = {"source_records": source_records, "processed_records": len(self.records),
                       "excluded_records": excluded, "flagged_records": flagged, "flagged_records_warning": warn,
                       "flags": len(self.flags), "dataset_level_flags": sum(1 for f in self.flags if not f.record_id),
                       "excluded_reasons": excluded_reasons or {}}

    def to_json(self) -> dict:
        return {"dataset_id": self.dataset_id, "investigation_id": self.investigation_id, "title": self.title,
                "evidence_class": self.evidence_class, "description": self.description,
                "processor_version": PROCESSOR_VERSION, "sources": self.sources, "field_specs": self.field_specs,
                "counts": self.counts, "notes": self.notes, "extra": self.extra, "records": self.records,
                "flags": [f.to_dict() for f in self.flags]}


def spec(field_name: str, variable: str, evidence_class: str, *, raw_column: str | None = None,
         unit_raw: str | None = None, unit: str | None = None, unit_status: str = "header",
         transform: str = "none", note: str | None = None) -> dict:
    """Declare one processed field. unit_status: header / documented / inferred / unknown / dimensionless / n/a."""
    assert evidence_class in EVIDENCE_CLASSES, evidence_class
    return {k: v for k, v in dict(field=field_name, variable=variable, evidence_class=evidence_class,
                                  raw_column=raw_column, unit_raw=unit_raw, unit=unit, unit_status=unit_status,
                                  transform=transform, note=note).items() if v is not None}


def source_entry(repo: Path, rel: str, role: str) -> dict:
    p = repo / rel
    return {"path": rel, "sha256": sha256_file(p), "size_bytes": p.stat().st_size, "role": role}


def new_record(record_id: str, *, test_id: str | None, source_file: str, source_table: str | None,
               page_pdf: int | None = None, source_row: int | None = None, verification: str,
               values: dict, raw: dict | None = None) -> dict:
    return {"record_id": record_id, "test_id": test_id,
            "provenance": {k: v for k, v in dict(source_file=source_file, source_table=source_table,
                                                  page_pdf=page_pdf, source_row=source_row).items() if v is not None},
            "verification": verification, "values": values, "raw": raw or {}, "flags": []}


# ------------------------------------------------------------------------------------------------ parsing ------
SPREADSHEET_ERRORS = ("#DIV/0!", "#VALUE!", "#REF!", "#N/A", "#NAME?", "#NUM!")


def parse_num(s: str | None) -> tuple[float | None, str]:
    """Return (value, kind). kind: number / blank / spreadsheet_error / dash / text."""
    t = (s or "").strip()
    if not t:
        return None, "blank"
    if t in SPREADSHEET_ERRORS:
        return None, "spreadsheet_error"
    if t in ("-", "–", "—"):
        return None, "dash"
    try:
        v = float(t)
    except ValueError:
        return None, "text"
    return (v, "number") if math.isfinite(v) else (None, "text")


def read_csv_rows(path: Path) -> tuple[list[str], list[tuple[int, list[str]]], dict]:
    """Rows with their 1-based data-row number (header excluded). Blank rows are reported, not returned."""
    raw = path.read_bytes()
    enc = "utf-8-sig" if raw.startswith(b"\xef\xbb\xbf") else "utf-8"
    text = raw.decode(enc)
    rows = list(csv.reader(io.StringIO(text)))
    header, body = rows[0], rows[1:]
    keep, blank = [], 0
    for i, r in enumerate(body, start=1):
        if any(c.strip() for c in r):
            keep.append((i, r + [""] * (len(header) - len(r))))
        else:
            blank += 1
    return header, keep, {"encoding": enc, "blank_rows": blank, "total_rows": len(body)}


# ----------------------------------------------------------------------------------------------- PDF text -------
def pdf_page_text(path: Path, page_pdf: int) -> str:
    import pymupdf

    with pymupdf.open(path) as d:
        return d[page_pdf - 1].get_text("text")


def tokens(s: str) -> list[str]:
    return re.sub(r"\s+", " ", s.replace(" ", " ")).strip().split(" ")


def contains_sequence(haystack: list[str], needle: list[str], start: int = 0) -> int:
    """Index after the first occurrence of `needle` as a contiguous token run at or after `start`, else -1."""
    n = len(needle)
    for i in range(start, len(haystack) - n + 1):
        if haystack[i:i + n] == needle:
            return i + n
    return -1


def verify_rows_in_page(page_text: str, rows_tokens: list[list[str]]) -> list[bool]:
    """Each transcribed row must appear, in order, as a contiguous token run in the page text."""
    hay = tokens(page_text)
    pos, out = 0, []
    for rt in rows_tokens:
        nxt = contains_sequence(hay, rt, pos)
        out.append(nxt >= 0)
        if nxt >= 0:
            pos = nxt
    return out


def write_json(path: Path, obj: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")

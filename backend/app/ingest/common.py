"""Shared ingestion helpers: hashing, date parsing, record containers."""
from __future__ import annotations

import datetime as dt
import hashlib
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def sha256_text(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


DATE_RE = re.compile(r"^\s*(\d{1,2})/(\d{1,2})/(\d{2}|\d{4})\s*$")


def parse_us_date(raw: str) -> tuple[str | None, bool]:
    """Parse m/d/yy or m/d/yyyy -> (ISO date, two_digit_year)."""
    m = DATE_RE.match(raw or "")
    if not m:
        return None, False
    mo, d, y = int(m.group(1)), int(m.group(2)), m.group(3)
    two = len(y) == 2
    year = 2000 + int(y) if two else int(y)
    try:
        return dt.date(year, mo, d).isoformat(), two
    except ValueError:
        return None, two


def day_of_year(iso: str | None) -> int | None:
    if not iso:
        return None
    return dt.date.fromisoformat(iso).timetuple().tm_yday


@dataclass
class Observation:
    column_index: int
    raw_field: str
    raw_text: str
    value_kind: str
    normalized_name: str
    measurement_role: str
    numeric_value: float | None = None
    numeric_low: float | None = None
    numeric_high: float | None = None
    text_value: str | None = None
    unit_raw: str | None = None
    unit_normalized: str | None = None
    derivation_note: str | None = None


@dataclass
class Flag:
    rule_id: str
    category: str
    severity: str
    description: str
    experiment_uid: str | None = None
    source_row: int | None = None
    raw_field: str | None = None
    raw_value: str | None = None
    derived_value: str | None = None
    evidence_ref: str | None = None
    proposed_correction: str | None = None
    status: str = "reported"


@dataclass
class ExperimentRecord:
    experiment_uid: str
    source_row: int
    display_id: str
    experiment_kind: str
    raw_pairs: list[tuple[str, str]]
    observations: list[Observation] = field(default_factory=list)
    normalized: dict[str, Any] = field(default_factory=dict)


def now_iso() -> str:
    return dt.datetime.now(dt.UTC).replace(microsecond=0).isoformat()

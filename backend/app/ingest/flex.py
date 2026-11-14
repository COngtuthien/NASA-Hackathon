"""FLEX (PSI-69) experimental table ingestion.

Source: FLEX/PSI-69_Experimental table_FLEX.csv (cp1252, 15 columns, 274 rows).
Header strings are preserved exactly; header interpretation (CO -> CO2,
`Burning rate; mm` -> mm^2/s) is stored as a separate normalized name with a
derivation note and a dataset-level quality flag, never by renaming the source.
"""
from __future__ import annotations

import csv
import io
import re
from collections import Counter
from pathlib import Path

from .common import ExperimentRecord, Flag, Observation, parse_us_date
from .values import (
    APPROXIMATE, BLANK, DASH, PRESENT, parse_number_cell,
)

REL_PATH = "FLEX/PSI-69_Experimental table_FLEX.csv"
INVESTIGATION_ID = "PSI-69"
EXPECTED_COLUMNS = 15
EXPECTED_ROWS = 274

H_TESTNO = "FLEX Test #"
H_ID = "FLEX Identifier"
H_DATE = "Test Date"
H_GMT = "Test GMT"
H_FUEL = "Fuel"
H_P = "Ambient pressure; mmHg"
H_O = "O initial ambient composition; mole fraction"
H_N = "N initial ambient composition; mole fraction"
H_CO = "CO initial ambient composition; mole fraction"
H_HE = "He initial ambient composition; mole fraction"
H_D0 = "Droplet initial diameter; mm"
H_DEXT = "Visible flame extinction diameter; mm"
H_K = "Burning rate; mm"
H_T = "Burn time; s"
H_END = "Test end"

# normalized_name, role, unit_raw, unit_normalized, derivation note
COLUMN_SPEC = {
    H_TESTNO: ("test_number", "identifier", None, None, None),
    H_ID: ("identifier", "identifier", None, None, "Not unique: see duplicate_identifier flag. Canonical key is the source row."),
    H_DATE: ("test_date", "context", None, None, "Parsed from m/d/yyyy or m/d/yy."),
    H_GMT: ("test_gmt", "context", None, None, None),
    H_FUEL: ("fuel", "input", None, None, None),
    H_P: ("pressure", "input", "mmHg", "mmHg", "atm = mmHg / 760 (derived)."),
    H_O: ("x_o2_initial", "input", "mole fraction", "mole fraction", None),
    H_N: ("x_n2_initial", "input", "mole fraction", "mole fraction", None),
    H_CO: ("x_co2_initial", "input", "mole fraction", "mole fraction",
           "Header reads 'CO'. Interpreted as CO2 diluent (suppressant); original label retained. "
           "See dataset flag FLEX-HDR-CO2 for evidence."),
    H_HE: ("x_he_initial", "input", "mole fraction", "mole fraction", None),
    H_D0: ("d0", "input", "mm", "mm", "Initial droplet diameter (pre-ignition condition)."),
    H_DEXT: ("dext_visible", "output", "mm", "mm",
             "Droplet diameter when the VISIBLE flame extinguished; for heptane a cool flame may continue."),
    H_K: ("burning_rate_k", "output", "mm", "mm^2/s",
          "Header unit 'mm' is dimensionally inconsistent with a d^2-law constant; interpreted as mm^2/s. "
          "See dataset flag FLEX-UNIT-K."),
    H_T: ("burn_time", "output", "s", "s", "Exact definition not documented in the local repository."),
    H_END: ("test_end", "output", None, None,
            "'Disruption' has no definition in the local documents; treated as unresolved/possibly censored."),
}

ID_PATTERNS = [
    (re.compile(r"^(\d+)CAL(\d+)$"), "CAL"),
    (re.compile(r"^(\d{3})F(\d{3})$"), "F"),
    (re.compile(r"^(\d{3})R(\d{3})$"), "R"),
]
SERIES_RE = re.compile(r"^([CHN])(\d{2})([MH])(\d{3})$")


def decode_series(identifier: str) -> tuple[str, str | None]:
    for rx, name in ID_PATTERNS:
        if rx.match(identifier):
            return name, None
    m = SERIES_RE.match(identifier)
    if m:
        return m.group(1), f"{m.group(1)}{m.group(2)}"
    return "unknown", None


def pressure_band(p_mmhg: float | None) -> str | None:
    if p_mmhg is None:
        return None
    if p_mmhg <= 0:
        return "invalid (0)"
    atm = p_mmhg / 760.0
    if atm < 0.85:
        return "~0.7 atm"
    if atm < 1.5:
        return "~1.0 atm"
    if atm < 2.4:
        return "~2.0 atm"
    return "2.7-3.1 atm"


def read_rows(path: Path) -> tuple[list[str], list[list[str]]]:
    text = path.read_bytes().decode("cp1252")
    rows = list(csv.reader(io.StringIO(text, newline="")))
    rows = [r for r in rows if any(c.strip() for c in r)]
    return rows[0], rows[1:]


def ingest(repo_root: Path) -> tuple[list[ExperimentRecord], list[Flag], dict]:
    header, rows = read_rows(repo_root / REL_PATH)
    report = {"file": REL_PATH, "encoding": "cp1252", "columns": len(header), "rows": len(rows), "warnings": []}
    if len(header) != EXPECTED_COLUMNS:
        report["warnings"].append(f"expected {EXPECTED_COLUMNS} columns, found {len(header)}")
    if len(rows) != EXPECTED_ROWS:
        report["warnings"].append(f"expected {EXPECTED_ROWS} rows (2026-11-10 snapshot), found {len(rows)}")
    for h in COLUMN_SPEC:
        if h not in header:
            raise ValueError(f"FLEX header missing: {h!r}")

    records: list[ExperimentRecord] = []
    flags: list[Flag] = []
    id_counts = Counter(r[header.index(H_ID)].strip() for r in rows)

    for i, row in enumerate(rows, start=1):
        if len(row) != len(header):
            report["warnings"].append(f"row {i}: {len(row)} cells")
            row = (row + [""] * len(header))[: len(header)]
        cells = dict(zip(header, row))
        uid = f"flex:{i}"
        identifier = cells[H_ID].strip()
        rec = ExperimentRecord(uid, i, identifier, "burn", list(zip(header, row)))

        parsed = {}
        for ci, h in enumerate(header):
            name, role, unit_raw, unit_norm, note = COLUMN_SPEC.get(h, (h, "context", None, None, None))
            raw = cells[h]
            if h in (H_ID, H_FUEL, H_END, H_GMT, H_DATE):
                kind = BLANK if raw.strip() == "" else "text"
                obs = Observation(ci, h, raw, kind, name, role, text_value=raw.strip() or None,
                                  unit_raw=unit_raw, unit_normalized=unit_norm, derivation_note=note)
            else:
                pv = parse_number_cell(raw)
                parsed[h] = pv
                obs = Observation(ci, h, raw, pv.kind, name, role, numeric_value=pv.value,
                                  numeric_low=pv.low, numeric_high=pv.high, text_value=pv.text,
                                  unit_raw=unit_raw, unit_normalized=unit_norm, derivation_note=note)
            rec.observations.append(obs)

        def num(h: str) -> float | None:
            pv = parsed.get(h)
            return pv.value if pv is not None and pv.kind in (PRESENT, APPROXIMATE) else None

        def kind(h: str) -> str:
            return parsed[h].kind

        date_iso, two_digit = parse_us_date(cells[H_DATE])
        series, mixture = decode_series(identifier)
        p = num(H_P)
        xo2, xn2, xco2, xhe = num(H_O), num(H_N), num(H_CO), num(H_HE)
        diluent = "CO2" if (xco2 or 0) > 0 else ("He" if (xhe or 0) > 0 else "N2-only")
        mole_sum = None
        if None not in (xo2, xn2, xco2, xhe):
            mole_sum = round(xo2 + xn2 + xco2 + xhe, 6)

        rec.normalized = {
            "experiment_uid": uid,
            "test_number": int(num(H_TESTNO)) if num(H_TESTNO) is not None else None,
            "identifier": identifier,
            "series": series,
            "mixture_code": mixture,
            "test_date": date_iso,
            "test_gmt": cells[H_GMT].strip() or None,
            "fuel": cells[H_FUEL].strip(),
            "pressure_mmhg": p,
            "pressure_atm": round(p / 760.0, 4) if p is not None and p > 0 else None,
            "pressure_band": pressure_band(p),
            "x_o2": xo2, "x_n2": xn2, "x_co2": xco2, "x_he": xhe,
            "mole_sum": mole_sum,
            "diluent": diluent,
            "d0_mm": num(H_D0), "d0_kind": kind(H_D0),
            "dext_mm": num(H_DEXT), "dext_kind": kind(H_DEXT),
            "k_mm2_s": num(H_K), "k_kind": kind(H_K),
            "burn_time_s": num(H_T), "burn_time_kind": kind(H_T),
            "test_end": cells[H_END].strip(),
        }
        n = rec.normalized
        records.append(rec)

        # ---- row-level quality rules ----
        def add(rule, cat, sev, desc, field=None, raw=None, derived=None, evidence=None, status="reported", correction=None):
            flags.append(Flag(rule, cat, sev, desc, uid, i, field, raw, derived, evidence, correction, status))

        if id_counts[identifier] > 1:
            add("FLEX-DUP-ID", "duplicate", "warning",
                f"FLEX Identifier '{identifier}' occurs {id_counts[identifier]} times; rows have different values. "
                "Canonical UID uses the source row, so both rows stay addressable.",
                H_ID, identifier, status="confirmed")
        if p is not None and p <= 0:
            add("FLEX-P-ZERO", "invalid", "critical",
                "Ambient pressure recorded as 0 mmHg. Tests with the same mixture code ran at ~0.7 atm, so 0 is "
                "most likely a placeholder/entry error, not vacuum. Excluded from pressure-dependent analyses.",
                H_P, cells[H_P], status="unresolved")
        if mole_sum is not None and abs(mole_sum - 1.0) >= 0.015:
            add("FLEX-MOLE-SUM", "inconsistent", "warning",
                f"Initial composition mole fractions sum to {mole_sum:.3f} (flagged when |sum - 1| >= 0.015; smaller deviations are 2-decimal rounding).",
                None, None, derived=f"{mole_sum:.3f}", status="unresolved")
        d0, dext = n["d0_mm"], n["dext_mm"]
        if d0 is not None and dext is not None:
            if dext > d0:
                add("FLEX-DEXT-GT-D0", "invalid", "critical",
                    f"Visible-flame extinction diameter ({dext} mm) exceeds initial diameter ({d0} mm): physically "
                    "impossible for an evaporating droplet. Excluded from d^2-law checks.",
                    H_DEXT, cells[H_DEXT], derived=f"Dext/D0 = {dext / d0:.3f}", status="unresolved")
            elif dext == 0:
                add("FLEX-DEXT-ZERO", "suspicious", "warning",
                    "Extinction diameter recorded as 0 mm. Likely means 'no extinction at finite diameter', "
                    "not a 0 mm measurement (undocumented).", H_DEXT, cells[H_DEXT], status="unresolved")
        for h in (H_D0, H_DEXT, H_K, H_T):
            k = kind(h)
            if k in (BLANK, DASH):
                add("FLEX-MISSING-" + ("DASH" if k == DASH else "BLANK"), "missing", "info",
                    f"'{h}' is {'an en dash (–)' if k == DASH else 'blank'}; the two missing-value markers are kept "
                    "distinct because their meaning is undocumented.", h, cells[h])
            elif k == APPROXIMATE:
                add("FLEX-APPROX", "missing", "info",
                    f"'{h}' is approximate ('{cells[h].strip()}'); excluded from exact numeric checks.", h, cells[h])
        if n["test_end"] == "Disruption":
            add("FLEX-DISRUPTION", "source_warning", "info",
                "Test end 'Disruption' is undefined in the local documents; burn time may be censored. Not treated "
                "as extinction.", H_END, "Disruption", status="unresolved")
        if series == "CAL":
            add("FLEX-CAL-SERIES", "source_warning", "info",
                "Identifier pattern ##CAL## (early 2009, air at 1 atm) is likely a checkout/calibration series "
                "(hypothesis; FLEX DoD lists a Calibration data category).", H_ID, identifier)
        if two_digit:
            add("FLEX-DATE-2DIGIT", "inconsistent", "info",
                "Test Date uses a 2-digit year (mixed m/d/yy and m/d/yyyy formats in this column).",
                H_DATE, cells[H_DATE], derived=date_iso)

    # ---- dataset-level flags (header semantics) ----
    flags.append(Flag(
        "FLEX-HDR-CO2", "unit", "warning",
        "Column 'CO initial ambient composition; mole fraction' is interpreted as CO2 diluent: the suppressants "
        "studied were CO2, He and SF6; C-series identifiers align 108/108 with this column > 0; values up to 0.70 "
        "match the XCO2 test matrix; CO at 5-70% would be a fuel, not a suppressant. Original header retained.",
        evidence_ref="FLEX/PSI-69_metadata_PSI-133_FLEX/i_Investigation.txt (Objective); FLEX/FLEX_Test_Plan.pdf; "
                     "FLEX/1G17-070HE-0166.pdf p.1",
        raw_field=H_CO, proposed_correction="Display as X_CO2 (initial)", status="confirmed"))
    flags.append(Flag(
        "FLEX-UNIT-K", "unit", "warning",
        "Column 'Burning rate; mm' holds the d^2-law burning-rate constant K, whose unit is length^2/time (mm^2/s). "
        "The d^2-law consistency analysis (/physics/flex) reproduces reported burn times with K in mm^2/s.",
        evidence_ref="FLEX/2G11-070HE-0310.pdf p.2 (d^2-law definition)",
        raw_field=H_K, proposed_correction="Display unit as mm^2/s", status="confirmed"))
    report["identifiers_duplicated"] = sorted(k for k, v in id_counts.items() if v > 1)
    report["fuel_counts"] = dict(Counter(r.normalized["fuel"] for r in records))
    report["test_end_counts"] = dict(Counter(r.normalized["test_end"] for r in records))
    return records, flags, report

"""BASS-II (PSI-25) experimental table ingestion.

Source: BASS-II/PSI-25_Experimental table_BASS-II.csv (UTF-8 BOM, 17 columns, 129 rows).
Column semantics follow `BASS-II data FAQ.docx`: GMT is a day-of-year, Fan display is
fan voltage x10 (sometimes mixed with control-box pot settings), Air display is a
duct velocity reading in cm/s with ~1 min response. Gas values are single
before/after readings, never a time series.
"""
from __future__ import annotations

import csv
import io
import re
from collections import Counter, defaultdict
from pathlib import Path

from .common import ExperimentRecord, Flag, Observation, day_of_year, parse_us_date
from .values import (
    BLANK, DASH, INVALID, LOWER_BOUND, NONE, OVER_RANGE, PRESENT, SEQUENCE, TEXT,
    parse_number_cell, parse_sequence_cell,
)

REL_PATH = "BASS-II/PSI-25_Experimental table_BASS-II.csv"
INVESTIGATION_ID = "PSI-25"
EXPECTED_COLUMNS = 17
EXPECTED_ROWS = 129
SR = "BASS-II/BASS-II Summary Report.pdf"

H_PI, H_TEST, H_DATE, H_GMT, H_SAMPLE, H_MAT, H_RESTR, H_FAN, H_AIR, H_RAD, H_FRAMES = (
    "PI", "Test #", "Date", "GMT", "Sample #", "Fuel Sample Material", "Flow restrictor",
    "Fan display", "Air display", "Radiometer gain   (1000   250   50   10)", "Total Frames Shot",
)
H_O2I = "Calibrated  initial O2 % by vol "
H_O2F = "Calibrated final O2 % by vol"
H_CO2I = "Initial CO2 % by vol"
H_CO2F = "Final CO2 % by vol"
H_COI = "Initial CO (ppm)"
H_COF = "Final CO (ppm)"

GAS_COLS = {
    H_O2I: ("o2_initial", "%vol", "Calibrated with a constant daily offset (MCA); resolution 0.1 %O2."),
    H_O2F: ("o2_final", "%vol", "Calibrated with a constant daily offset (MCA); resolution 0.1 %O2."),
    H_CO2I: ("co2_initial", "%vol", "CDM sensor, 0-5 %, nominal resolution 0.1 %."),
    H_CO2F: ("co2_final", "%vol", "CDM sensor, 0-5 %, nominal resolution 0.1 %."),
    H_COI: ("co_initial", "ppm", "CSA-CP sensor 0-1000 ppm; 'OR' = over range (>1000 ppm)."),
    H_COF: ("co_final", "ppm", "CSA-CP sensor 0-1000 ppm; 'OR' = over range (>1000 ppm)."),
}

COLUMN_SPEC = {
    H_PI: ("pi", "context"), H_TEST: ("test_id", "identifier"), H_DATE: ("date", "context"),
    H_GMT: ("gmt_day_of_year", "context"), H_SAMPLE: ("sample_id", "identifier"),
    H_MAT: ("material_raw", "input"), H_RESTR: ("flow_restrictor", "input"),
    H_FAN: ("fan_display", "instrument"), H_AIR: ("air_display", "instrument"),
    H_RAD: ("radiometer_gain", "instrument"), H_FRAMES: ("frames_shot", "instrument"),
}

ROD_DIAMETERS_MM = {"1/4": 6.35, "3/8": 9.525, "1/2": 12.7, "0.5": 12.7}


def classify_material(raw: str, pi: str) -> dict:
    """Rule-based taxonomy. Original string is always kept alongside."""
    s = " ".join(raw.split())
    low = s.lower()
    out = {"material_class": "unclassified", "material_color": None, "geometry": "unknown",
           "thickness_mm": None, "diameter_mm": None, "width_cm": None, "sides": None, "material_note": None}
    width = re.search(r"(\d+(?:\.\d+)?)\s*cm(?:\s+wide|\b)", low)
    if "sibal" in low:
        out.update(material_class="SIBAL fabric", geometry="fabric strip")
        if width:
            out["width_cm"] = float(width.group(1))
        note = re.sub(r"(?i)\d+\s*cm|sibal", "", s).strip()
        out["material_note"] = note or None
        return out
    if "nomex" in low:
        out.update(material_class="Nomex III fabric", geometry="fabric")
        return out
    if "wax" in low or "candle" in low:
        out.update(material_class="Japan wax candle", geometry="candle")
        return out
    if "spherical" in low:
        out.update(material_class="PMMA sphere section", geometry="spherical section", diameter_mm=40.0)
        return out
    if "rod" in low:
        color = "black" if re.search(r"\bblac?k?\b|black|blac\b", low) else ("clear" if "clear" in low else None)
        d = None
        m = re.search(r"(1/4|3/8|1/2|0\.5)", low)
        if m:
            d = ROD_DIAMETERS_MM[m.group(1)]
        out.update(material_class=f"PMMA rod ({color or 'unspecified'})", material_color=color,
                   geometry="cylindrical rod", diameter_mm=d)
        return out
    micron = re.search(r"(\d+)\s*micron", low)
    mm = re.search(r"(\d+(?:\.\d+)?)\s*mm", low)
    thickness = float(micron.group(1)) / 1000.0 if micron else (float(mm.group(1)) if mm else None)
    sides = "1 sided" if re.search(r"1\s*sided", low) else ("2 sided" if re.search(r"2\s*(?:sided|side|ide)", low) else None)
    if width:
        out["width_cm"] = float(width.group(1))
    if "thick" in low and "2 cm thick" in low and width:
        out["material_note"] = "Source text says '2 cm thick'; context indicates sample width (2 cm)."
    if thickness is not None and thickness < 0.5 or "film" in low:
        out.update(material_class="PMMA thin film", geometry="thin film", thickness_mm=thickness, sides=sides)
    else:
        out.update(material_class="PMMA slab", geometry="slab", thickness_mm=thickness, sides=sides)
    return out


def flow_mode_hint(pi: str) -> str:
    """Flow configuration per PI program as summarized in the data FAQ / report (context only)."""
    return {
        "Bhattacharjee": "opposed", "Miller": "opposed", "Fernandez-Pello": "opposed",
        "Olson": "concurrent/stagnation", "T'ien": "concurrent (flat) / stagnation (sphere)",
        "Ferkul": "concurrent/stagnation",
    }.get(pi, "unknown")


def read_rows(path: Path) -> tuple[list[str], list[list[str]]]:
    text = path.read_bytes().decode("utf-8-sig")
    rows = [r for r in csv.reader(io.StringIO(text, newline="")) if any(c.strip() for c in r)]
    return rows[0], rows[1:]


def ingest(repo_root: Path) -> tuple[list[ExperimentRecord], list[Flag], dict]:
    header, rows = read_rows(repo_root / REL_PATH)
    report = {"file": REL_PATH, "encoding": "utf-8-sig", "columns": len(header), "rows": len(rows), "warnings": []}
    if len(header) != EXPECTED_COLUMNS:
        report["warnings"].append(f"expected {EXPECTED_COLUMNS} columns, found {len(header)}")
    if len(rows) != EXPECTED_ROWS:
        report["warnings"].append(f"expected {EXPECTED_ROWS} rows (2026-11-10 snapshot), found {len(rows)}")
    for h in list(COLUMN_SPEC) + list(GAS_COLS):
        if h not in header:
            raise ValueError(f"BASS-II header missing: {h!r}")

    records: list[ExperimentRecord] = []
    flags: list[Flag] = []
    sample_counts = Counter(r[header.index(H_SAMPLE)].strip() for r in rows)
    final_co_by_date: dict[str, list[tuple[str, float]]] = defaultdict(list)

    for i, row in enumerate(rows, start=1):
        row = (row + [""] * len(header))[: len(header)]
        c = dict(zip(header, row))
        uid = f"bass2:{i}"
        test_id = c[H_TEST].strip()
        rec = ExperimentRecord(uid, i, test_id, "burn", list(zip(header, row)))
        gas = {}
        seq = {}
        for ci, h in enumerate(header):
            raw = c[h]
            if h in GAS_COLS:
                name, unit, note = GAS_COLS[h]
                pv = parse_number_cell(raw)
                gas[name] = pv
                rec.observations.append(Observation(ci, h, raw, pv.kind, name, "output" if "final" in name else "input",
                                                    pv.value, pv.low, pv.high, pv.text, unit, unit, note))
            elif h in (H_FAN, H_AIR, H_RAD, H_FRAMES):
                pv = parse_sequence_cell(raw)
                seq[h] = pv
                name, role = COLUMN_SPEC[h]
                unit = {H_FAN: "V x10 / pot (mixed)", H_AIR: "cm/s", H_RAD: "gain", H_FRAMES: "count"}[h]
                note = {
                    H_FAN: "Fan voltage x10 shown on video; sometimes control-box pot settings (0-10). Multi-stage; never a velocity.",
                    H_AIR: "Duct probe velocity reading, cm/s, ~1 min response. Multi-stage values keep their order.",
                    H_RAD: "Uncalibrated radiometer gain; '>' marks gain changes during the test.",
                    H_FRAMES: "Nikon still count (may include post-burn images).",
                }[h]
                rec.observations.append(Observation(ci, h, raw, pv.kind, name, role, pv.value, pv.low, pv.high,
                                                    pv.text, unit, unit if pv.kind == PRESENT else None, note))
            elif h == H_RESTR or h == H_GMT:
                pv = parse_number_cell(raw)
                name, role = COLUMN_SPEC[h]
                note = "Day-of-year (NOT a clock time) per BASS-II data FAQ." if h == H_GMT else "0 = highest flow, 2 = lowest."
                rec.observations.append(Observation(ci, h, raw, pv.kind, name, role, pv.value, pv.low, pv.high,
                                                    pv.text, "day of year" if h == H_GMT else "count",
                                                    "day of year" if h == H_GMT else "count", note))
            else:
                name, role = COLUMN_SPEC[h]
                rec.observations.append(Observation(ci, h, raw, BLANK if not raw.strip() else TEXT, name, role,
                                                    text_value=raw.strip() or None))

        pi = c[H_PI].strip()
        date_iso, _ = parse_us_date(c[H_DATE])
        gmt = parse_number_cell(c[H_GMT])
        gmt_doy = int(gmt.value) if gmt.is_numeric else None
        mat = classify_material(c[H_MAT], pi)
        restr = parse_number_cell(c[H_RESTR])
        air = seq[H_AIR]

        def gv(name):
            pv = gas[name]
            return pv.value if pv.kind == PRESENT else None

        rec.normalized = {
            "experiment_uid": uid, "pi": pi, "test_id": test_id,
            "date_raw": c[H_DATE].strip(), "date_iso": date_iso, "date_doy": day_of_year(date_iso),
            "gmt_doy": gmt_doy, "sample_id": c[H_SAMPLE].strip(),
            "material_raw": c[H_MAT], **mat,
            "flow_restrictor": int(restr.value) if restr.is_numeric else None,
            "fan_raw": c[H_FAN], "fan_kind": seq[H_FAN].kind, "fan_tokens_json": seq[H_FAN].tokens,
            "air_raw": c[H_AIR], "air_kind": air.kind, "air_tokens_json": air.tokens,
            "air_single_cm_s": air.value if air.kind == PRESENT else None,
            "radiometer_gain_raw": c[H_RAD], "frames_raw": c[H_FRAMES],
        }
        for name in ("o2_initial", "o2_final", "co2_initial", "co2_final", "co_initial", "co_final"):
            rec.normalized[name] = gv(name)
            rec.normalized[name + "_kind"] = gas[name].kind
        records.append(rec)
        n = rec.normalized
        if n["co_final"] is not None and date_iso:
            final_co_by_date[date_iso].append((test_id, n["co_final"]))

        def add(rule, cat, sev, desc, field=None, raw=None, derived=None, evidence=None, status="reported", correction=None):
            flags.append(Flag(rule, cat, sev, desc, uid, i, field, raw, derived, evidence, correction, status))

        if n["date_doy"] is not None and gmt_doy is not None and n["date_doy"] != gmt_doy:
            add("BASS-GMT-DOY-MISMATCH", "inconsistent", "warning",
                f"'GMT' (day-of-year {gmt_doy}) does not match the day-of-year of Date {n['date_raw']} "
                f"({n['date_doy']}).", H_GMT, c[H_GMT], derived=f"date DOY = {n['date_doy']}", status="unresolved")
        if date_iso and date_iso[:4] not in ("2014", "2016"):
            add("BASS-DATE-YEAR", "inconsistent", "warning",
                f"Date year {date_iso[:4]} is outside the BASS-II campaign years (2014; last 3 tests 2016). "
                "Likely a typo for 2014 (GMT day-of-year is consistent with 2014).", H_DATE, c[H_DATE],
                status="unresolved")
        o2i, o2f = n["o2_initial"], n["o2_final"]
        if o2i is not None and o2f is not None and abs(o2f - o2i) > 5.0:
            add("BASS-O2-UNPHYSICAL", "suspicious", "critical",
                f"Final O2 {o2f} % vs initial {o2i} % (change {o2f - o2i:+.1f} points). A small sample burning in "
                "the ~250 L MSG volume cannot change O2 by more than a few points; final value is likely a "
                "recording error. Excluded from gas-delta analyses; raw value preserved.",
                H_O2F, c[H_O2F], derived=f"delta O2 = {o2f - o2i:+.1f}", status="unresolved")
        for h, name in ((H_COI, "co_initial"), (H_COF, "co_final")):
            pv = gas[name]
            if pv.kind == PRESENT and pv.value is not None and pv.value < 0:
                add("BASS-CO-NEGATIVE", "suspicious", "info",
                    f"Negative CO reading ({pv.raw.strip()} ppm): consistent with sensor zero drift. Kept as recorded, "
                    "not clipped to 0.", h, pv.raw)
            if pv.kind in (OVER_RANGE, LOWER_BOUND):
                add("BASS-CO-OVER-RANGE", "missing", "info",
                    f"CO reading '{pv.raw.strip()}' is over range / a bound, not a number; delta CO not computed.",
                    h, pv.raw)
        for h, name in ((H_O2I, "o2_initial"), (H_O2F, "o2_final"), (H_CO2I, "co2_initial"), (H_CO2F, "co2_final"),
                        (H_COI, "co_initial"), (H_COF, "co_final")):
            k = gas[name].kind
            if k in (BLANK, NONE, DASH, INVALID):
                add("BASS-GAS-MISSING", "missing", "info",
                    f"'{h.strip()}' is {('blank' if k == BLANK else repr(gas[name].raw.strip()))}; no reading recorded.",
                    h, gas[name].raw)
        fan, airv = seq[H_FAN], seq[H_AIR]
        if fan.kind in (SEQUENCE, TEXT) or airv.kind in (SEQUENCE, TEXT):
            add("BASS-MULTISTAGE-FLOW", "source_warning", "info",
                "Fan/Air display is free text or a multi-stage sequence; flow changed during the test. A single "
                "velocity would be misleading and gas deltas integrate over all stages. Stage timing is not in the CSV.",
                H_AIR if airv.kind in (SEQUENCE, TEXT) else H_FAN,
                (c[H_AIR] if airv.kind in (SEQUENCE, TEXT) else c[H_FAN]))
        if fan.kind != BLANK and ("pot" in c[H_FAN].lower() or "(" in c[H_FAN]) :
            add("BASS-FAN-MIXED-SCALE", "unit", "info",
                "Fan display mixes two scales (fan voltage x10 and control-box pot 0-10).", H_FAN, c[H_FAN])
        if sample_counts[n["sample_id"]] > 1:
            add("BASS-SAMPLE-REUSED", "duplicate", "info",
                f"Sample # '{n['sample_id']}' appears in {sample_counts[n['sample_id']]} rows (re-burned / a-b runs). "
                "Tests are not independent.", H_SAMPLE, n["sample_id"])
        frames = seq[H_FRAMES]
        if frames.kind != PRESENT:
            add("BASS-FRAMES-TEXT", "missing", "info",
                f"Total Frames Shot is not a single number ('{c[H_FRAMES].strip()}').", H_FRAMES, c[H_FRAMES])

    # chained atmosphere: initial CO equals some final CO of another test on the same day
    by_uid = {r.experiment_uid: r for r in records}
    for r in records:
        n = r.normalized
        coi = n["co_initial"]
        if coi is None or coi <= 2 or not n["date_iso"]:
            continue
        matches = [t for t, v in final_co_by_date.get(n["date_iso"], []) if v == coi and t != n["test_id"]]
        if matches:
            flags.append(Flag("BASS-CHAINED-ATMOSPHERE", "source_warning", "info",
                              f"Initial CO ({coi:g} ppm) equals the final CO of {', '.join(matches)} on the same day: "
                              "the chamber atmosphere carried over between burns (tests not independent).",
                              r.experiment_uid, r.source_row, H_COI, str(coi)))
    _ = by_uid

    flags.append(Flag("BASS-GMT-SEMANTICS", "unit", "info",
                      "Column 'GMT' is a day-of-year, not a time of day (BASS-II data FAQ).",
                      raw_field=H_GMT, evidence_ref="BASS-II/BASS-II data FAQ.docx", status="confirmed"))
    flags.append(Flag("BASS-TEST-COUNT", "document_conflict", "info",
                      "Summary Report states 126 tests were conducted; the CSV has 129 rows. The difference is "
                      "unexplained locally (a/b re-runs or non-ignitions may be counted differently).",
                      evidence_ref=f"{SR} (Executive summary/introduction)", status="unresolved"))
    flags.append(Flag("BASS-ID-COLLISION-BASS1", "source_warning", "info",
                      "Summary Report Table 7.1 lists four earlier BASS (I) tests also named T7, T8, T10, T11. "
                      "Test # alone is not a unique key across investigations.",
                      evidence_ref=f"{SR} Table 7.1", status="reported"))
    report["pi_counts"] = dict(Counter(r.normalized["pi"] for r in records))
    report["material_class_counts"] = dict(Counter(r.normalized["material_class"] for r in records))
    return records, flags, report

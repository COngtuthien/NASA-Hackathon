"""Smoke Aerosol Measurement Experiment (SAME, PSI-102).

Verified curated outputs:
  * Final Science Report Table 1 (PDF p27): 8 rows of particle-size statistics (fresh and aged, 4 materials).
  * The same quantities as printed in three attached papers and the ICES 2012 deck (kept source-specific; never
    reconciled into one value).
  * Appendix A (PDF p33): the 47-test flight log, plus the 4 un-numbered carousel operation rows.
Telemetry (59 workbooks of 1 Hz housekeeping) is inventoried only; per-test traces are deferred (see the Phase 13
data-processing report): sentinel semantics, material-by-time-window assignment and one workbook's date are unresolved.
"""
from __future__ import annotations

import re
from pathlib import Path

from .common import Dataset, Flag, new_record, pdf_page_text, source_entry, spec, tokens, verify_rows_in_page

INV = "PSI-102"
DIR = "SAME"
REPORT = f"{DIR}/SAME Final Science report  03 18 10 with papers attached.pdf"
ICES2012 = f"{DIR}/SAME ICES 2012 07 15 2012.pptx"

# Table 1 "Results of SAME flight tests" (PDF p27; identical in SAE 2009-01-2468 Table 1, PDF p39, which states
# "baseline runs (no aging) and 720 second aging").
TABLE1 = [
    ("Kapton", False, 80, 105, 179, 2.08), ("Kapton", True, 155, 186, 267, 1.82),
    ("Lamp wick", False, 186, 227, 341, 1.89), ("Lamp wick", True, 258, 308, 438, 1.81),
    ("Silicone", False, 189, 257, 472, 2.18), ("Silicone", True, 352, 422, 606, 1.83),
    ("Teflon", False, 170, 205, 297, 1.84), ("Teflon", True, 228, 273, 392, 1.82),
]
MATERIAL_ID = {"Kapton": "kapton", "Lamp wick": "lampwick", "Lampwick": "lampwick", "Silicone": "silicone",
               "Silicone Rubber": "silicone", "Teflon": "teflon", "Pyrell": "pyrell"}
MATERIAL_NOTE = {"kapton": "Kapton (polyimide film)", "lampwick": "Lamp wick (cellulose)", "silicone": "Silicone rubber",
                 "teflon": "Teflon (PTFE)", "pyrell": "Pyrell (polyurethane foam; SAME-2 only)"}


def particle_sizes(repo: Path) -> Dataset:
    ds = Dataset("same_particle_sizes", INV, "SAME particle-size results (Final Science Report Table 1)",
                 "derived_experimental",
                 "Moment-method particle-size statistics of smoke from overheated materials, fresh (no aging) and aged "
                 "720 s. Derived by the SAME team from 0th, 1st and 3rd moment instruments assuming a log-normal "
                 "distribution; not raw instrument signals.",
                 sources=[source_entry(repo, REPORT, "final_report")],
                 field_specs=[
                     spec("dg_nm", "Geometric mean diameter", "derived_experimental", raw_column="Geom.Mean Diam. (nm)",
                          unit_raw="nm", unit="nm"),
                     spec("d10_nm", "Arithmetic (count) mean diameter", "derived_experimental",
                          raw_column="Arithmetic Mean Diam. (nm)", unit_raw="nm", unit="nm"),
                     spec("d30_nm", "Diameter of average mass", "derived_experimental",
                          raw_column="Diam. of Average Mass (nm)", unit_raw="nm", unit="nm"),
                     spec("sigma_g", "Geometric standard deviation", "derived_experimental", raw_column="σg", unit="-",
                          unit_status="dimensionless"),
                     spec("aged", "Aged smoke (720 s aging) vs fresh", "test_condition", unit_status="n/a",
                          note="Aging duration stated in SAE 2009-01-2468 (PDF p39)."),
                 ])
    text = pdf_page_text(repo / REPORT, 27)
    rows_tok = [tokens(m) + (["aged"] if aged else []) + [str(a), str(b), str(c), f"{s:.2f}"]
                for m, aged, a, b, c, s in TABLE1]
    ok = verify_rows_in_page(text, rows_tok)
    for i, ((mat, aged, dg, d10, d30, sg), verified) in enumerate(zip(TABLE1, ok), start=1):
        mid = MATERIAL_ID[mat]
        rid = f"same:size:{mid}:{'aged' if aged else 'fresh'}"
        ds.records.append(new_record(rid, test_id=None, source_file=REPORT, source_table="Final Science Report Table 1",
                                     page_pdf=27, source_row=i,
                                     verification="verified_against_pdf_text" if verified else "transcribed_unverified",
                                     values={"material": mid, "material_label": MATERIAL_NOTE[mid], "material_printed": mat,
                                             "aged": aged, "aging_s": 720 if aged else 0, "dg_nm": dg, "d10_nm": d10,
                                             "d30_nm": d30, "sigma_g": sg, "flight": "SAME-1 (2007)"},
                                     raw={"printed": " ".join(rows_tok[i - 1])}))
    ds.finalize(len(TABLE1))
    ds.notes = ["Dibutyl phthalate (DBP) was flown but has no row in Table 1.",
                "Values come from the moment method (0th: P-Trak number; 1st: ionization; 3rd: DustTrak mass) with an "
                "assumed log-normal distribution (Final Science Report PDF pp15-19); they are not direct sizings."]
    return ds


# Same quantities as printed elsewhere (kept separate; NOT reconciled).
OTHER = [
    # source, page/slide, table label, flight, units, rows: (material, aged, {field: value})
    ("AIAA 'Properties of Smoke from Overheated Materials in Low-Gravity' (attached paper)", 48,
     "Table 1: Diameter results from baseline runs", "SAME-1", "µm",
     [("Kapton", False, {"dg": 0.080, "d10": 0.105, "d30": 0.172}),
      ("Lamp wick", False, {"dg": 0.186, "d10": 0.227, "d30": 0.420}),
      ("Silicone", False, {"dg": 0.189, "d10": None, "d30": None}),
      ("Teflon", False, {"dg": 0.159, "d10": 0.205, "d30": 0.219})],
     ["Kapton 0.080 0.105 0.172", "Lamp wick 0.186 0.227 0.420", "Silicone 0.189 N/A N/A", "Teflon 0.159 0.205 0.219"]),
    ("SAE 2008-01-2089 'Measurement of Smoke Particle Size under Low-Gravity Conditions' (attached)", 57,
     "Table 1: Average Count Mean Diameters and ratios of the Dust Trak instruments", "SAME-1", "nm",
     [("Silicone Rubber", False, {"d10": 227, "dusttrak_b_over_a": 1.92}),
      ("Teflon", False, {"d10": 158, "dusttrak_b_over_a": 1.22}),
      ("Lamp wick", False, {"d10": 172, "dusttrak_b_over_a": 1.79}),
      ("Kapton", False, {"d10": 128, "dusttrak_b_over_a": 1.26})],
     ["Rubber 227 1.92", "158 1.22", "Lamp wick 172 1.79", "128 1.26"]),
    ("AIAA 'Spacecraft Fire Detection: Smoke Properties and Transport in Low-Gravity' (attached)", 64,
     "Table 1: Count Mean Diameters for Baseline Runs with comparison to 1-g tests", "SAME-1", "nm",
     [("Silicone Rubber", False, {"d10": 263, "pct_larger_than_1g": 53}),
      ("Teflon", False, {"d10": 223, "pct_larger_than_1g": None}),
      ("Lamp wick", False, {"d10": 248, "pct_larger_than_1g": 65}),
      ("Kapton", False, {"d10": 114, "pct_larger_than_1g": 58})],
     ["263 53", "223", "Lamp wick 248 65", "114 58"]),
]
ICES_ROWS = [("Kapton", False, 0.047, 0.062, 0.106, 2.072), ("Kapton", True, 0.102, 0.121, 0.169, 1.790),
             ("Lampwick", False, 0.103, 0.142, 0.271, 2.232), ("Lampwick", True, 0.269, 0.308, 0.401, 1.673),
             ("Silicone", False, 0.152, 0.221, 0.468, 2.382), ("Silicone", True, 0.320, 0.400, 0.628, 1.956),
             ("Teflon", False, 0.093, 0.111, 0.173, 2.081), ("Teflon", True, 0.080, 0.115, 0.237, 2.342),
             ("Pyrell", False, 0.177, 0.227, 0.377, 2.032), ("Pyrell", True, 0.348, 0.400, 0.529, 1.697)]


def other_sources(repo: Path) -> Dataset:
    ds = Dataset("same_particle_sizes_other_sources", INV, "SAME particle sizes as printed in other SAME documents",
                 "derived_experimental",
                 "The same quantities as printed by three attached papers and the ICES 2012 deck (SAME-1 & SAME-2). "
                 "Kept source-specific to show the provenance spread; never averaged or reconciled.",
                 sources=[source_entry(repo, REPORT, "final_report"), source_entry(repo, ICES2012, "presentation")],
                 field_specs=[spec("d10", "Count (arithmetic) mean diameter", "derived_experimental", unit="nm",
                                   transform="µm values x 1000 into d10_nm; original value and unit kept"),
                              spec("dg", "Geometric mean diameter", "derived_experimental", unit="nm",
                                   transform="µm x 1000"),
                              spec("d30", "Diameter of average mass", "derived_experimental", unit="nm", transform="µm x 1000"),
                              spec("dusttrak_b_over_a", "DustTrak B (10 µm cutoff) / A (1 µm cutoff) ratio",
                                   "derived_experimental", unit="-", unit_status="dimensionless"),
                              spec("pct_larger_than_1g", "Count mean diameter, % larger than a comparable 1-g test",
                                   "derived_experimental", unit="%")])
    n = 0
    for src, page, table, flight, unit, rows, checks in OTHER:
        text = " ".join(tokens(pdf_page_text(repo / REPORT, page))).replace("™", "")
        for (mat, aged, vals), chk in zip(rows, checks):
            n += 1
            mid = MATERIAL_ID[mat]
            k = 1000 if unit == "µm" else 1
            norm = {f"{f}_nm": (v * k if v is not None else None) for f, v in vals.items() if f in ("dg", "d10", "d30")}
            norm.update({f: v for f, v in vals.items() if f not in ("dg", "d10", "d30")})
            ok = chk in text
            ds.records.append(new_record(f"same:size-alt:p{page}:{mid}", test_id=None, source_file=REPORT, source_table=table,
                                         page_pdf=page, source_row=n,
                                         verification="verified_against_pdf_text" if ok else "transcribed_unverified",
                                         values={"material": mid, "aged": aged, "source_label": src, "flight": flight,
                                                 "original_unit": unit, **norm},
                                         raw={"original": vals, "check": chk}))
    from pptx import Presentation
    tbl = next(sh.table for sh in Presentation(str(repo / ICES2012)).slides[23].shapes if sh.has_table)
    cells = [[c.text.strip() for c in r.cells] for r in tbl.rows]
    for i, (mat, aged, dg, d10, d30, sg) in enumerate(ICES_ROWS, start=1):
        n += 1
        printed = cells[i][2:6]
        ok = printed == [f"{dg:.3f}", f"{d10:.3f}", f"{d30:.3f}", f"{sg:.3f}"]
        mid = MATERIAL_ID[mat]
        ds.records.append(new_record(f"same:size-alt:ices2012:{mid}:{'aged' if aged else 'fresh'}", test_id=None,
                                     source_file=ICES2012, source_table="Slide 24 'SAME-1&2 Results'", source_row=i,
                                     verification="verified_against_source_table" if ok else "transcribed_unverified",
                                     values={"material": mid, "aged": aged, "aging_s": 720 if aged else 0,
                                             "source_label": "ICES 2012 presentation, slide 24 (SAME-1 & SAME-2 results)",
                                             "flight": "SAME-1 & SAME-2", "original_unit": "µm", "dg_nm": round(dg * 1000, 3),
                                             "d10_nm": round(d10 * 1000, 3), "d30_nm": round(d30 * 1000, 3), "sigma_g": sg},
                                     raw={"printed": printed}))
    ds.flags.append(Flag("SAME-SIZE-SOURCES-DIFFER", "document_conflict", "info",
                         "Particle-size statistics for the same material differ between the Final Science Report, the "
                         "attached papers and the ICES 2012 deck (successive analyses; ICES 2012 also includes SAME-2). "
                         "All versions are kept with their source; none is preferred silently.", status="confirmed"))
    ds.finalize(n)
    return ds


# Appendix A "Log of SAME flight tests" (PDF p33). (test number, GMT, sample, reheat/initial as printed, carousel,
# position, record time as printed, comment). Un-numbered operation rows have test number None.
LOG = [
    (1, "252", "Silicone", "Initial", "1", "1", "11:50 - 13:20", None),
    (2, "254", "DBP", "Initial", "1", "5", "5:50 - 7:01", None),
    (3, "254", "DBP", "Reheat", "1", "5", "4:48 - 6:10", None),
    (4, "255", "DBP", "Reheat", "1", "5", "37:42 - 38:51", None),
    (5, "255", "Silicone", "Initial", "1", "6", "39:99 - 41:15", None),
    (6, "256", "Teflon", "Initial", "1", "2", None, None),
    (7, "256", "Lampwick", "Initial", "1", "3", "18:54 - 20.25", None),
    (8, "257", "Kapton", "Initial", "1", "4", "1:13 - 1:46", "run abort because of high Rt/Ro, finished manually"),
    (9, "257", "DBP", "Reheat", "1", "5", "1:13 - 2:50", None),
    (None, "257", None, None, None, None, "3:40 -3:50", "engage carousel"),
    (10, "257", "Teflon", "Reheat", "1", "2", "6:35 - 8:17", None),
    (None, "257", None, None, None, None, "8:30 - 8:39", "disengage carousel"),
    (11, "262", "DBP", "Initial", "2", "4", "1:39 - 3:07", None),
    (12, "262", "DBP", "Reheat", "2", "4", "5:37 - 7:05", None),
    (13, "262", "Teflon", "Initial", "2", "1", "9:36 - 10:59", None),
    (14, "263", "Kapton", "Initial", "2", "3", "33:05 - 34:18", None),
    (15, "263", "DBP", "Initial", "2", "5", "38:29 - 40:03", None),
    (16, "263", "DBP", "Reheat", "2", "4", "35:42 - 36:48", None),
    (17, "264", "Lampwick", "Initial", "2", "2", "14:05 - 15: 50", None),
    (None, "264", None, None, None, None, "16:31 - 17:30", "rotate carousel"),
    (18, "264", "DBP", "Initial", "2", "6", "<6.:39", None),
    (19, "264", "DBP", "Reheat", "2", "6", "6:39 - 8:00", None),
    (20, "264", "DBP", "Reheat", "2", "6", "8:00 - 11:00", None),
    (21, "264", "DBP", "Reheat", "2", "6", "19:32 - 21:10", None),
    (22, "264", "DBP", "Reheat", "2", "6", "22:30 - 24:16", None),
    (23, "267", "Silicone", "Initial", "3", "1", "12:28 - 13:48", None),
    (24, "267", "Silicone", "Initial", "3", "2", "17:40 - 19:10", None),
    (25, "268", "Teflon", "Initial", "3", "4", "17:58 - 19:12", None),
    (26, "268", "Teflon", "Initial", "3", "5", "20:33 - 21:58", None),
    (27, "269", "Silicone", "Initial", "3", "3", "1:48 - 3:09", None),
    (28, "269", "Teflon", "Initial", "3", "6", "4:35 - 5:36", None),
    (29, "271", "Kapton", "Initial", "4", "4", "1:22 - 2:23", None),
    (30, "272", "Kapton", "Initial", "4", "5", "1:00 - 2.30", None),
    (31, "272", "Lampwick", "Initial", "4", "1", "2:50 - 4:20", None),
    (32, "272", "Lampwick", "Initial", "4", "2", "8:35 - 9:57", None),
    (33, "273", "Kapton", "Initial", "4", "6", "9:58 - 10:59", "missed first part of heating, using 2 cm/s"),
    (34, "273", "Lampwick", "Initial", "4", "3", "14:38 - 15:48", "using 2 cm/s"),
    (None, None, None, None, None, None, "16: 18 - 16:27", "disengage carousel"),
    (35, "276", "Silicone", "Initial", "5", "1", "10:10 - 11:05", None),
    (36, "276", "DBP", "Initial", "5", "6", "12:08 - 13:32", None),
    (37, "276", "DBP", "Reheat", "5", "6", "14:46 - 15:45", "8 cm/s"),
    (38, "276", "DBP", "Reheat", "5", "6", "18:46 - 20:18", None),
    (39, "276", "DBP", "Reheat", "5", "6", "20:25 -21:55", None),
    (40, "276", "DBP", "Reheat", "5", "6", "22:58 - 23:58", None),
    (41, "277", "Teflon", "Initial", "5", "2", "3:57 - 5:15", None),
    (42, "277", "DBP", "Initial", "5", "5", "00:53 - 2.21", None),
    (43, "277", "DBP", "Reheat", "5", "5", "6:19 - 7:55", None),
    (44, "277", "DBP", "Reheat", "5", "5", "8:05 - 9:42", "30 minute aging, 75 second heating"),
    (45, "278", "DBP", "Reheat", "5", "5", "10:58 - 12:17", None),
    (46, "278", "Lampwick", "Initial", "5", "3", "13:34 - 14:29", None),
    (47, "278", "Kapton", "Intiial", "5", "4", "15: 59 - 17:06", None),
]
SAMPLE_ID = {"Silicone": "silicone", "DBP": "dbp", "Teflon": "teflon", "Lampwick": "lampwick", "Kapton": "kapton"}
TIME_RE = re.compile(r"^\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}$")


def flight_log(repo: Path) -> Dataset:
    ds = Dataset("same_flight_log", INV, "SAME flight-test log (Final Science Report Appendix A)", "operational_log",
                 "The 47 SAME-1 flight tests (2007, GMT days 252-278) with sample type, initial/reheat, carousel and "
                 "position, plus 4 un-numbered carousel operation rows.",
                 sources=[source_entry(repo, REPORT, "final_report")],
                 field_specs=[spec("gmt_day", "GMT day of year (2007)", "operational_log", unit="day of year", unit_status="n/a"),
                              spec("sample", "Sample type", "test_condition", unit_status="n/a",
                                   note="DBP = dibutyl phthalate on a porous wick."),
                              spec("reheat", "Initial heating or reheat of the same sample", "test_condition", unit_status="n/a",
                                   transform="'Intiial' (test 47) read as Initial; original kept"),
                              spec("record_time", "Record time window as printed", "operational_log",
                                   unit_status="unknown", note="Units/clock reference not defined in the report.")])
    page = pdf_page_text(repo / REPORT, 33)
    row_tokens = []
    for t, g, s, ri, car, pos, rt, cm in LOG:
        toks = [str(x) for x in (t, g, s, ri, car, pos) if x is not None]
        toks += tokens(rt) if rt else []
        toks += tokens(cm) if cm else []
        row_tokens.append(toks)
    ok = verify_rows_in_page(page, row_tokens)
    for i, (row, verified) in enumerate(zip(LOG, ok), start=1):
        t, g, s, ri, car, pos, rt, cm = row
        rid = f"same:log:{t}" if t is not None else f"same:log:op{i}"
        v = {"test_number": t, "gmt_day": int(g) if g else None, "sample": SAMPLE_ID.get(s) if s else None,
             "sample_printed": s, "reheat": None if ri is None else ri.strip().lower().startswith("reheat"),
             "initial_reheat_printed": ri, "carousel": int(car) if car else None, "position": int(pos) if pos else None,
             "record_time_printed": rt, "comment": cm, "kind": "test" if t is not None else "carousel_operation"}
        rec = new_record(rid, test_id=str(t) if t is not None else None, source_file=REPORT, source_table="Appendix A",
                         page_pdf=33, source_row=i,
                         verification="verified_against_pdf_text" if verified else "transcribed_unverified", values=v)
        ds.records.append(rec)
        if rt and not TIME_RE.match(rt.replace(" ", "")):
            ds.flag(Flag("SAME-LOG-TIME-FORMAT", "invalid", "info", f"Record time '{rt}' is not a clean mm:ss range "
                         "(typo or partial); kept as printed.", rid, v["test_number"] and str(t), "Record Time", rt, i,
                         f"{REPORT} PDF p33"))
        elif rt and re.search(r":[6-9]\d", rt):
            ds.flag(Flag("SAME-LOG-TIME-INVALID", "invalid", "info", f"Record time '{rt}' contains a seconds value ≥ 60.",
                         rid, str(t), "Record Time", rt, i, f"{REPORT} PDF p33"))
        if ri == "Intiial":
            ds.flag(Flag("SAME-LOG-TYPO", "info", "info", "'Intiial' read as Initial.", rid, str(t), "Reheat/Initial", ri, i))
    tests = [r for r in ds.records if r["values"]["kind"] == "test"]
    ds.extra["summary"] = {"tests": len(tests), "operation_rows": len(ds.records) - len(tests),
                           "by_sample": {k: sum(1 for r in tests if r["values"]["sample"] == k) for k in SAMPLE_ID.values()},
                           "gmt_days": sorted({r["values"]["gmt_day"] for r in tests})}
    ds.finalize(len(LOG))
    ds.notes = ["The report's test numbers (1-47) differ from the flight software's test-matrix file numbers "
                "(same_test_N.txt in the workbook logs); no crosswalk is asserted.",
                "Record-time units and clock reference are not defined in the report; times are kept as printed."]
    return ds


def telemetry_inventory(repo: Path) -> Dataset:
    """List the 59 'Analyzed data' workbooks by folder label (no values parsed; see module docstring)."""
    base = repo / DIR / "Analyzed data" / "Reduced Gravity"
    ds = Dataset("same_telemetry_inventory", INV, "SAME 1 Hz housekeeping workbooks (inventory only)", "direct_measurement",
                 "Inventory of the 59 PSI 'Analyzed data' workbooks. They hold 1 Hz flight housekeeping exports "
                 "(detector volts, P-Trak counts, DustTrak mg/m3) plus analyst sheets. Values are not processed in "
                 "Phase 13.")
    files = sorted(p for p in base.rglob("*") if p.is_file())
    for i, p in enumerate(files, start=1):
        rel = p.relative_to(repo).as_posix()
        ds.records.append(new_record(f"same:wb:{i}", test_id=None, source_file=rel, source_table=None, source_row=i,
                                     verification="listed_only",
                                     values={"folder_label": p.parent.name, "file": p.name, "size_bytes": p.stat().st_size,
                                             "kind": "log" if "log" in p.name.lower() else "housekeeping"}))
    ds.flags.append(Flag("SAME-TELEMETRY-DEFERRED", "missing", "warning",
                         "Per-test telemetry traces are deferred: the folder name does not reliably give the sample "
                         "material (assignment needs the log time windows), -10 V / -999 / 500000 sentinel meanings are "
                         "undocumented, time columns mix Unix epoch and elapsed seconds, and kaptonGMT257*.xls carries a "
                         "day-254 TimeString.", status="unresolved"))
    ds.finalize(len(files), len(files), {"telemetry values not processed in Phase 13": len(files)})
    return ds


def build(repo: Path) -> list[Dataset]:
    return [particle_sizes(repo), other_sources(repo), flight_log(repo), telemetry_inventory(repo)]

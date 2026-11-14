"""ACME Flame Design (PSI-10) and ACME Burning Rate Emulator (BRE, PSI-20).

Flame Design: the two PSI-10 experimental tables are CONDITIONS ONLY (no ignition, burn time, size, soot or
extinction outcome). They are processed as test conditions; author findings stay report statements.
BRE: the final report's Table 1 (PDF p24) is the authoritative day log; the PSI-20 CSV is kept as provenance and
its two date errors and two Excel percent artefacts are recorded as conflicts, never silently rewritten.
"""
from __future__ import annotations

import datetime as dt
from pathlib import Path

from .common import Dataset, Flag, new_record, parse_num, pdf_page_text, read_csv_rows, source_entry, spec, tokens

ATM_TO_BAR = 1.01325

# ============================================================================ Flame Design (PSI-10) =============
FD_INV = "PSI-10"
FD_DIR = "ACME Flame Design"           # renamed from the misspelled 'AMCE Flame Design' in Phase 13
FD_NORMAL = f"{FD_DIR}/PSI-10_Experimental table_Flame Design_Normal Flame.csv"
FD_INVERSE = f"{FD_DIR}/PSI-10_Experimental table_Flame Design_Inverse Flame.csv"
FD_REPORT = f"{FD_DIR}/PSI-10_Reports_FinalRpt_ACMEFlameDesign.pdf"
MARKERS = ("RAMP", "RAMPED", "LOW O2")

FD_SPECS = [
    spec("configuration", "Flame configuration", "test_condition", raw_column="Flame Type", unit_status="n/a"),
    spec("fuel", "Fuel (normal flames from burner; inverse: C2H4 in the ambient)", "test_condition", raw_column="Fuel",
         unit_status="n/a"),
    spec("x_fuel", "Fuel mole fraction in burner supply (normal)", "test_condition", raw_column="Xfuel",
         unit="mole fraction", unit_status="dimensionless"),
    spec("m_fuel_mg_s", "Fuel mass flow (normal)", "test_condition", raw_column="mfuel (mg/s)", unit_raw="mg/s", unit="mg/s"),
    spec("m_o2_mg_s", "O2 mass flow (inverse)", "test_condition", raw_column="mO2 (mg/s)", unit_raw="mg/s", unit="mg/s"),
    spec("m_n2_mg_s", "N2 mass flow from burner", "test_condition", raw_column="mN2 (mg/s)", unit_raw="mg/s", unit="mg/s"),
    spec("m_total_mg_s", "Total burner mass flow", "test_condition", raw_column="mtot (mg/s)", unit_raw="mg/s", unit="mg/s"),
    spec("x_o2_init", "Ambient O2 mole fraction, initial (normal)", "test_condition", raw_column="XO2 (init)",
         unit="mole fraction", unit_status="dimensionless"),
    spec("x_o2_final", "Ambient O2 mole fraction, final (normal; post-test)", "derived_experimental",
         raw_column="XO2 (final)", unit="mole fraction", unit_status="dimensionless"),
    spec("x_o2_supply", "O2 mole fraction in burner supply (inverse)", "test_condition", raw_column="XO2",
         unit="mole fraction", unit_status="dimensionless"),
    spec("x_c2h4_init", "Ambient C2H4 mole fraction, initial (inverse)", "test_condition", raw_column="XC2H4 initial",
         unit="mole fraction", unit_status="dimensionless"),
    spec("x_c2h4_final", "Ambient C2H4 mole fraction, final (inverse; post-test)", "derived_experimental",
         raw_column="XC2H4 final", unit="mole fraction", unit_status="dimensionless"),
    spec("p_init_atm", "Chamber pressure, initial", "test_condition", raw_column="pinit (atm)", unit_raw="atm", unit="atm"),
    spec("p_final_atm", "Chamber pressure, final (post-test)", "derived_experimental", raw_column="pfinal (atm)",
         unit_raw="atm", unit="atm"),
    spec("p_mean_atm", "Chamber pressure, mean", "derived_experimental", raw_column="pmean (atm)", unit_raw="atm", unit="atm"),
    spec("p_mean_bar", "Mean pressure converted for comparison with CFI-G", "derived_experimental",
         raw_column="pmean (atm)", unit="bar", transform="atm x 1.01325"),
    spec("zst", "Mean stoichiometric mixture fraction (investigator-calculated)", "derived_experimental",
         raw_column="mean Zst", unit="-", unit_status="dimensionless"),
    spec("tad_k", "Adiabatic flame temperature (investigator-calculated)", "derived_experimental", raw_column="Tad (K)",
         unit_raw="K", unit="K"),
    spec("flow_marker", "RAMP / RAMPED / LOW O2 marker (no single flow value)", "test_condition", unit_status="n/a"),
]


def _date_of(code: str) -> str:
    return (dt.date(2000 + int(code[:2]), 1, 1) + dt.timedelta(days=int(code[2:5]) - 1)).isoformat()


def flame_design_conditions(repo: Path) -> Dataset:
    ds = Dataset("fd_conditions", FD_INV, "Flame Design per-test conditions (conditions only)", "test_condition",
                 "Every test point in the two PSI-10 experimental tables. These tables record conditions only: no "
                 "ignition, burn time, flame size, soot or extinction outcome is present, and none is inferred.",
                 sources=[source_entry(repo, FD_NORMAL, "experiment_table"), source_entry(repo, FD_INVERSE, "experiment_table")],
                 field_specs=FD_SPECS)
    total = 0
    for rel, config in ((FD_NORMAL, "normal"), (FD_INVERSE, "inverse")):
        header, rows, meta = read_csv_rows(repo / rel)
        H = {h: i for i, h in enumerate(header)}
        col = lambda r, name: r[H[name]].strip() if name in H else ""   # noqa: E731
        for row_no, r in rows:
            total += 1
            tid = col(r, "Test")
            rid = f"fd:{config}:{tid}"
            raw = {h: r[i] for i, h in enumerate(header)}
            marker = next((col(r, c) for c in ("Xfuel", "XO2", "mfuel (mg/s)", "mO2 (mg/s)") if col(r, c) in MARKERS), None)

            def num(name):
                return parse_num(col(r, name))[0]
            v = {"configuration": config, "test_day": tid[:5], "date": _date_of(tid[:5]), "day_index": num("Day"),
                 "fuel": col(r, "Fuel") or "C2H4", "flow_marker": marker,
                 "m_n2_mg_s": num("mN2 (mg/s)"), "m_total_mg_s": num("mtot (mg/s)"),
                 "p_init_atm": num("pinit (atm)"), "p_final_atm": num("pfinal (atm)"), "p_mean_atm": num("pmean (atm)"),
                 "zst": num("mean Zst"), "tad_k": num("Tad (K)")}
            v["p_mean_bar"] = round(v["p_mean_atm"] * ATM_TO_BAR, 5) if v["p_mean_atm"] is not None else None
            v["p_ref_atm"] = v["p_mean_atm"] if v["p_mean_atm"] is not None else v["p_init_atm"]
            if config == "normal":
                v.update(x_fuel=num("Xfuel"), m_fuel_mg_s=num("mfuel (mg/s)"), x_o2_init=num("XO2 (init)"),
                         x_o2_final=num("XO2 (final)"))
            else:
                v.update(x_o2_supply=num("XO2"), m_o2_mg_s=num("mO2 (mg/s)"), x_c2h4_init=num("XC2H4 initial"),
                         x_c2h4_final=num("XC2H4 final"))
            rec = new_record(rid, test_id=tid, source_file=rel, source_table=f"PSI-10 experimental table ({config})",
                             source_row=row_no, verification="parsed_from_source_csv", values=v, raw=raw)
            ds.records.append(rec)
            if marker:
                ds.flag(Flag("FD-RAMP-MARKER", "missing", "info", f"Flow marked '{marker}': flows and Tad/Zst have no "
                             "single value for this test point. Excluded from condition-space plots.", rid, tid,
                             raw_value=marker, source_row=row_no))
            if config == "normal" and v["fuel"] == "C3H8" and v["p_mean_atm"] is None:
                ds.flag(Flag("FD-C3H8-NO-FINAL", "missing", "info", "Propane TFP-calibration day: XO2 final, p final "
                             "and p mean are blank. Initial pressure used as the reference pressure.", rid, tid,
                             source_row=row_no))
    # 22042M1: labelled Day 6 though 22042 would be the 9th inverse test day; not in final report Table 1
    for r in ds.records:
        if r["test_id"].startswith("22042"):
            ds.flag(Flag("FD-22042-DAY", "inconsistent", "warning", "Test day 22042 is labelled Day 6 (Day 6 is 22024) "
                         "and does not appear in final report Table 1 (last inverse day 22035). Kept as recorded.",
                         r["record_id"], r["test_id"], "Day", str(r["values"]["day_index"]),
                         evidence_ref=f"{FD_REPORT} PDF p24", status="unresolved"))
    ds.flags.append(Flag("FD-DAY-INDEX", "info", "info", "The 'Day' column is 0-based in the normal table (0-13) and "
                         "1-based in the inverse table (1-8); test-day codes (YYDDD) are used instead.", raw_field="Day"))
    ds.flags.append(Flag("FD-CONDITIONS-ONLY", "missing", "warning", "No outcome columns exist in either Flame Design "
                         "table (no ignition, burn time, flame size, soot or extinction). Outcomes are reported only as "
                         "author findings in the final report.", evidence_ref=f"{FD_REPORT} PDF p25-27", status="confirmed"))
    ds.finalize(total)
    ds.notes = ["Pressure is in atm here and in bar in CFI-G; comparisons convert explicitly (1 atm = 1.01325 bar).",
                "Rows marked RAMP/RAMPED/LOW O2 have no single flow value and are excluded from condition-space plots, "
                "not deleted."]
    return ds


# Final report Table 1 (PDF p24): flames ignited per test day.
FD_DAYS = [
    ("19115", 1, "normal", "serial number 1002", "100% C2H4", "21% O2", 11),
    ("19123", 1, "normal", None, None, "21% O2", 19),
    ("19137", 1, "normal", None, None, "21% O2", 20),
    ("19142", 1, "normal", None, None, "40% O2", 8),
    ("19150", 1, "normal", None, None, "30%, 40% O2", 15),
    ("19156", 1, "normal", None, None, "40% O2", 13),
    ("19161", 1, "normal", None, None, "40% O2", 0),
    ("19171", 1, "normal", "serial number 1003", None, "40% O2", 12),
    ("19175", 1, "normal", None, None, "40% O2", 14),
    ("19182", 1, "normal", None, None, "40% O2", 15),
    ("19189", 1, "normal", None, None, "40% O2", 15),
    ("19196", 1, "normal", None, None, "40% O2", 13),
    ("19200", 1, "normal", None, None, "30%, 40% O2", 12),
    ("19206", 1, "normal", None, None, "21% O2", 21),
    ("21301", 2, "normal", "serial number 1003", "100% C3H8", "40% O2", 18),
    ("21328", 2, "inverse", None, "85% O2", "27%, 8% C2H4", 9),
    ("21340", 2, "inverse", None, None, "17%, 12% C2H4", 13),
    ("21349", 2, "inverse", None, None, "65%, 27.5% C2H4", 15),
    ("21361", 2, "inverse", None, None, "20% C2H4", 20),
    ("22018", 2, "inverse", None, None, "17%, 10% C2H4", 12),
    ("22024", 2, "inverse", None, None, "19% C2H4", 20),
    ("22027", 2, "inverse", None, None, "10% C2H4", 16),
    ("22035", 2, "inverse", None, None, "17%, 10% C2H4", 15),
]


def flame_design_days(repo: Path, cond: Dataset) -> Dataset:
    ds = Dataset("fd_test_days", FD_INV, "Flame Design flames ignited per test day (final report Table 1)",
                 "operational_log", "Day-level log of flames ignited; atmospheres approximate, vitiation neglected.",
                 sources=[source_entry(repo, FD_REPORT, "final_report")],
                 field_specs=[spec("flames_ignited", "Flames ignited that day", "operational_log", unit="count",
                                   unit_status="n/a")])
    text = " ".join(tokens(pdf_page_text(repo / FD_REPORT, 24)))
    per_day: dict[str, int] = {}
    for r in cond.records:
        per_day[r["values"]["test_day"]] = per_day.get(r["values"]["test_day"], 0) + 1
    for i, (code, rnd, config, burner, bottle, atm, n) in enumerate(FD_DAYS, start=1):
        ok = code in text and atm.split(" ")[0] in text
        ds.records.append(new_record(f"fd:day:{code}", test_id=code, source_file=FD_REPORT, source_table="Final report Table 1",
                                     page_pdf=24, source_row=i,
                                     verification="verified_against_pdf_text" if ok else "transcribed_unverified",
                                     values={"test_day": code, "date": _date_of(code), "round": rnd, "configuration": config,
                                             "burner_printed": burner, "reactant_bottle_printed": bottle,
                                             "atmosphere": atm, "flames_ignited": n,
                                             "csv_test_points": per_day.get(code, 0)}))
    ds.extra["totals"] = {"table1_flames": sum(d[6] for d in FD_DAYS),
                          "table1_round1": sum(d[6] for d in FD_DAYS if d[1] == 1),
                          "table1_round2": sum(d[6] for d in FD_DAYS if d[1] == 2),
                          "csv_test_points": len(cond.records)}
    ds.finalize(len(FD_DAYS))
    return ds


# Report-backed findings (stated as author results; per-test values are not in the download).
FD_FINDINGS = [
    {"id": "fd-critical-temperature", "text": "All ISS flames observed by the project extinguish at a critical "
     "extinction temperature of 1130 K, at a fuel mass flux of 0.2 g/m2-s for normal flames and an oxygen mass flux of "
     "0.68 g/m2-s for inverse flames.", "page_pdf": 26, "kind": "report_statement",
     "values": [{"variable": "critical extinction temperature", "value": 1130, "unit": "K"},
                {"variable": "critical fuel mass flux (normal)", "value": 0.2, "unit": "g/m2-s"},
                {"variable": "critical oxygen mass flux (inverse)", "value": 0.68, "unit": "g/m2-s"}]},
    {"id": "fd-growth", "text": "Microgravity spherical diffusion flames grow monotonically after ignition; radiative "
     "extinction occurs when, at constant reactant flow rate, the flame expands until radiation heat loss approaches "
     "the chemical heat release; an oscillatory mode can precede extinction.", "page_pdf": 26, "kind": "report_statement"},
    {"id": "fd-burn-times", "text": "Burn times in the 2021 long-duration study ranged from 28 to 336 s.", "page_pdf": 26,
     "kind": "report_statement", "values": [{"variable": "burn time range (2021 study)", "value": [28, 336], "unit": "s"}]},
    {"id": "fd-steady-time", "text": "In the spherical, infinite-domain configuration the characteristic time to reach "
     "steady state is on the order of 10^5 s.", "page_pdf": 27, "kind": "report_statement"},
    {"id": "fd-limits", "text": "For safety, O2 was limited to 40% for normal tests and C2H4 to 65% for inverse flames; CH4 "
     "and CO2-diluent tests were slated but not allowed.", "page_pdf": 27, "kind": "report_statement"},
    {"id": "fd-shortcomings", "text": "TFP fibre array misaligned for four test days; round-1 radiometers saturated for "
     "nearly every test; burner asymmetry; MFC flows not always steady.", "page_pdf": 19, "kind": "report_statement"},
]


# ===================================================================================== BRE (PSI-20) ==============
BRE_INV = "PSI-20"
BRE_DIR = "ACME BRE"
BRE_CSV = f"{BRE_DIR}/PSI-20_Experimental table_ACME BRE.csv"
BRE_REPORT = f"{BRE_DIR}/BRE_final_report_20220201.pdf"
# Final report Table 1, PDF p24 (same table in BRE_data_interpretation_20220804.pdf p6 and as an image in
# ACME-BRE_Test_Summary.docx). Test day YYDDD; burner diameter mm; fuel bottle; O2 % (as printed); flames ignited.
BRE_DAYS = [
    ("19039", 25, "100% C2H4", [21, 26.5, 40], 10), ("19051", 25, "100% C2H4", [26.5, 34], 8),
    ("19056", 25, "50% C2H4", [21, 26.5, 34, 40], 8), ("19063", 25, "50% C2H4", [26.5, 40], 6),
    ("19066", 25, "50% C2H4", [34], 6), ("19070", 25, "50% C2H4", [26.5, 34], 7),
    ("19087", 25, "100% C2H4", [26.5, 34], 8), ("19091", 25, "100% C2H4", [21], 0),
    ("19094", 25, "100% C2H4", [21, 26.5, 34], 9),
    ("20247", 50, "100% C2H4", [25, 34, 40], 13), ("20261", 25, "100% C2H4", [26.5, 34], 13),
    ("20279", 25, "100% CH4", [25, 34, 40], 21), ("20339", 25, "100% CH4", [25, 40], 18),
    ("20346", 25, "50% C2H4", [25, 40], 12), ("20352", 25, "100% C2H4", [34, 40], 10),
    ("20358", 25, "100% C2H4", [25, 34, 40], 17), ("21020", 25, "100% C2H4", [21, 26.5, 34], 15),
    ("21028", 50, "100% C2H4", [25, 34, 40], 13),
]
MONTHS = {"Jan": 1, "Feb": 2, "March": 3, "April": 4, "Sept": 9, "Oct": 10, "Dec": 12}


def bre_days(repo: Path) -> Dataset:
    ds = Dataset("bre_test_days", BRE_INV, "BRE flames ignited per test day (final report Table 1, authoritative)",
                 "operational_log", "Day-level BRE log. Report Table 1 values are used; the PSI CSV's differing cells "
                 "are kept beside them as provenance.",
                 sources=[source_entry(repo, BRE_REPORT, "final_report"), source_entry(repo, BRE_CSV, "experiment_table")],
                 field_specs=[spec("burner_mm", "Burner outlet diameter", "test_condition", unit_raw="mm", unit="mm"),
                              spec("fuel_bottle", "Fuel bottle (balance N2)", "test_condition", unit_status="n/a"),
                              spec("o2_pct", "Approximate O2 concentrations for tests that ignited", "test_condition",
                                   unit_raw="%", unit="% (volume)"),
                              spec("flames_ignited", "Flames ignited that day", "operational_log", unit="count",
                                   unit_status="n/a")])
    page = " ".join(tokens(pdf_page_text(repo / BRE_REPORT, 24)))
    header, rows, _ = read_csv_rows(repo / BRE_CSV)
    H = {h: i for i, h in enumerate(header)}
    csv_rows = []
    for row_no, r in rows:
        y, mo, d = int(r[H["Year"]]), MONTHS[r[H["Month"]].strip()], int(r[H["Date"]])
        csv_rows.append({"row": row_no, "date": dt.date(y, mo, d).isoformat(), "burner": r[H["Burner Size (mm)"]],
                         "fuel": r[H["Fuel Bottle"]], "o2": r[H["Oxygen Conc (percent)"]], "n": int(r[H["Flames Ignited"]])})
    used = set()
    for i, (code, burner, fuel, o2, n) in enumerate(BRE_DAYS, start=1):
        date = _date_of(code)
        ok = code in page
        # match the CSV row by date; if none, by identical (burner, fuel, count) among unused rows
        m = next((c for c in csv_rows if c["date"] == date and c["row"] not in used), None)
        how = "date"
        if m is None:
            m = next((c for c in csv_rows if c["row"] not in used and c["n"] == n and c["burner"] == str(burner)
                      and c["fuel"].replace(" ", "") == fuel.replace(" ", "")), None)
            how = "burner+fuel+count (CSV date differs)"
        if m:
            used.add(m["row"])
        rid = f"bre:day:{code}"
        rec = new_record(rid, test_id=code, source_file=BRE_REPORT, source_table="Final report Table 1", page_pdf=24,
                         source_row=i, verification="verified_against_pdf_text" if ok else "transcribed_unverified",
                         values={"test_day": code, "date": date, "round": 1 if code.startswith("19") else 2,
                                 "burner_mm": burner, "fuel_bottle": fuel, "fuel": "CH4" if "CH4" in fuel else "C2H4",
                                 "fuel_pct": 50 if fuel.startswith("50") else 100, "o2_pct": o2, "flames_ignited": n,
                                 "csv_row": m["row"] if m else None, "csv_match": how if m else None},
                         raw={"csv": m} if m else {})
        ds.records.append(rec)
        if m and m["date"] != date:
            ds.flag(Flag("BRE-CSV-DATE", "document_conflict", "warning",
                         f"PSI CSV row {m['row']} gives {m['date']}; final report Table 1 test day {code} is {date}. "
                         "Report value used; CSV value kept.", rid, code, "Year/Month/Date", m["date"], m["row"],
                         f"{BRE_REPORT} PDF p24", "confirmed"))
        if m and m["o2"].endswith("00%"):
            ds.flag(Flag("BRE-CSV-PERCENT-FORMAT", "invalid", "info",
                         f"CSV oxygen cell '{m['o2']}' is an Excel percent-format artefact; Table 1 prints "
                         f"{', '.join(f'{x:g}%' for x in o2)}.", rid, code, "Oxygen Conc (percent)", m["o2"], m["row"],
                         f"{BRE_REPORT} PDF p24", "confirmed"))
    ds.extra["totals"] = {"table1_flames": sum(d[4] for d in BRE_DAYS),
                          "round1": sum(d[4] for d in BRE_DAYS if d[0].startswith("19")),
                          "round2": sum(d[4] for d in BRE_DAYS if not d[0].startswith("19")),
                          "csv_flames": sum(c["n"] for c in csv_rows), "csv_rows": len(csv_rows),
                          "report_statement": "62 and 132 flames in rounds 1 and 2, 194 in total "
                                              "(BRE_data_interpretation_20220804.pdf p4)"}
    ds.finalize(len(BRE_DAYS))
    ds.notes = ["Chamber pressures were varied but are not identified in Table 1 or the CSV.",
                "19091 (1 April 2019): no flames; the hot-wire igniter tip had failed (data interpretation p5)."]
    return ds


BRE_FINDINGS = [
    {"id": "bre-quasi-steady", "text": "Quasi-steady flames on the flat 25-mm burner were observed for nominal ambient "
     "oxygen mole fractions of 0.265 and above; pressure had a weak effect on burning quality.", "page_pdf": 39,
     "kind": "report_statement"},
    {"id": "bre-21pct", "text": "All flames ignited in a normal atmosphere (21% O2, 14.7 psia) self-extinguished within "
     "40 s; at 27% O2/10.2 psia and 34% O2/8.2 psia flames generally persisted for 3 minutes or more.", "page_pdf": 18,
     "kind": "report_statement"},
    {"id": "bre-pmma", "text": "Test 19070D1 (34% O2, 8.2 psia, hc 24 kJ/g, L = 2.42 kJ/g) reached a steady state; the "
     "authors note this emulation could represent PMMA (an emulation analogy, not a PMMA test).", "page_pdf": 26,
     "kind": "report_statement"},
    {"id": "bre-limits", "text": "Large flames extinguished due to radiative heat loss, while small flames quenched at a "
     "second limit.", "page_pdf": 40, "kind": "report_statement"},
    {"id": "bre-methane", "text": "Methane was hard to ignite compared with ethylene and its flames tended to "
     "self-extinguish faster even at high oxygen concentration.", "page_pdf": 33, "kind": "report_statement"},
    {"id": "bre-not-done", "text": "O2/CO2 atmospheres (objective 2) were not investigated.", "page_pdf": 40,
     "kind": "report_statement"},
]
# Final report Table 2 (PDF p29): literature values, NOT BRE measurements.
BRE_LITERATURE = [("PE", 43.4, "1.9"), ("PP", 44.0, "2.0"), ("Nylon", 28.8, "1.5, 2.4"), ("PMMA", 24.2, "1.6, 2.3"),
                  ("Phenolic glass fibers", 22.0, "7.3")]


def bre_literature(repo: Path) -> Dataset:
    ds = Dataset("bre_literature", BRE_INV, "Materials near BRE heats of combustion (final report Table 2: literature)",
                 "literature_value", "Literature lower heating value (LHV) and heat of gasification (L) quoted by the BRE "
                 "report. These are not BRE measurements.",
                 sources=[source_entry(repo, BRE_REPORT, "final_report")],
                 field_specs=[spec("lhv_kj_g", "Lower heating value", "literature_value", unit_raw="kJ/g", unit="kJ/g"),
                              spec("l_kj_g", "Heat of gasification (as printed; some cells list two values)",
                                   "literature_value", unit_raw="kJ/g", unit="kJ/g")])
    page = " ".join(tokens(pdf_page_text(repo / BRE_REPORT, 29)))
    for i, (mat, lhv, l_raw) in enumerate(BRE_LITERATURE, start=1):
        ok = f"{mat} {lhv:g}" in page or f"{mat} {lhv}" in page
        ds.records.append(new_record(f"bre:lit:{mat}", test_id=None, source_file=BRE_REPORT, source_table="Final report Table 2",
                                     page_pdf=29, source_row=i,
                                     verification="verified_against_pdf_text" if ok else "transcribed_unverified",
                                     values={"material": mat, "lhv_kj_g": lhv,
                                             "l_kj_g": [float(x) for x in l_raw.split(",")]},
                                     raw={"l_printed": l_raw}))
    ds.finalize(len(BRE_LITERATURE))
    return ds


def build(repo: Path) -> list[Dataset]:
    cond = flame_design_conditions(repo)
    fd_days = flame_design_days(repo, cond)
    fd_days.extra["findings"] = FD_FINDINGS
    days = bre_days(repo)
    days.extra["findings"] = BRE_FINDINGS
    return [cond, fd_days, days, bre_literature(repo)]

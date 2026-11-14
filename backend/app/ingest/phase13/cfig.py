"""ACME Cool Flames Investigation with Gases (CFI-G, PSI-159).

Sources (local, read-only):
  ACME CFI-G/PSI-159_Experimental table_CFI-G_Normal Flames.csv   (179 test points)
  ACME CFI-G/PSI-159_Experimental table_CFI-G_Inverse Flames.csv  (154 test points + 861 blank rows)
  ACME CFI-G/PSI-159_Reports_FinalRpt_ACME.CFI-G.pdf              (Tables 1-3, findings)

Rules (Phase 13): normal and inverse are never pooled; FT (flow terminated) burn times are right-censored; spreadsheet
errors and undefined labels are flagged, never repaired; original strings are kept beside every normalized value.
"""
from __future__ import annotations

import datetime as dt
import re
from pathlib import Path

from .common import Dataset, Flag, new_record, parse_num, pdf_page_text, read_csv_rows, source_entry, spec, tokens, \
    verify_rows_in_page

INV = "PSI-159"
DIR = "ACME CFI-G"
NORMAL = f"{DIR}/PSI-159_Experimental table_CFI-G_Normal Flames.csv"
INVERSE = f"{DIR}/PSI-159_Experimental table_CFI-G_Inverse Flames.csv"
REPORT = f"{DIR}/PSI-159_Reports_FinalRpt_ACME.CFI-G.pdf"
REPORT_DOC_ID = "psi-159-reports-finalrpt-acme-cfi-g"
BAR_PER_ATM = 1.01325

# Fuel names as written -> species (the report's Tables 1-2 write C2H6, C3H8 and n-C4H10; p21-22).
SPECIES = {"ethane": "ethane", "propane": "propane", "butane": "n-butane"}
# Stoichiometric O2/fuel mass ratio, used only to check the CSV's derived 'HC burnrate' column (inverse flames).
STOICH_O2_PER_FUEL = {"ethane": 3.5 * 31.998 / 30.069, "propane": 5 * 31.998 / 44.096, "n-butane": 6.5 * 31.998 / 58.122}

OUTCOMES = {
    "self_extinguished": "Hot flame ignited and self-extinguished (SE). Burn time is the observed time to extinction.",
    "flow_terminated": "Hot flame ignited; the run ended when the flow was stopped (FT). Burn time is right-censored: "
                       "the flame was still burning.",
    "flash_self_extinguished": "Inverse table 'flash' (momentary) followed by SE.",
    "not_ignited": "No hot ignition ('-' in the termination column).",
    "no_hot_ignition_flow_terminated": "No hot ignition recorded, yet FT recorded (one normal test).",
}


def _test_id(raw: str) -> str:
    return raw.replace(" ", "").strip()


def _species_and_dilution(fuel_raw: str) -> tuple[str, float | None]:
    m = re.match(r"^\s*(\d+)%\s*(\w+)\s*$", fuel_raw)
    if m:
        return SPECIES[m.group(2).lower()], float(m.group(1))
    return SPECIES[fuel_raw.strip().lower()], 100.0


def _date_of(code: str) -> str:
    y, d = 2000 + int(code[:2]), int(code[2:5])
    return (dt.date(y, 1, 1) + dt.timedelta(days=d - 1)).isoformat()


def _outcome(hot: str, term: str) -> str:
    if term == "SE":
        return "flash_self_extinguished" if hot == "flash" else "self_extinguished"
    if term == "FT":
        return "flow_terminated" if hot == "yes" else "no_hot_ignition_flow_terminated"
    return "not_ignited"


FIELD_SPECS = [
    spec("configuration", "Flame configuration (normal: fuel from burner; inverse: oxidizer from burner)", "test_condition",
         raw_column="Flame Type", unit_status="n/a", transform="case-normalized; file of origin also recorded"),
    spec("test_day", "Test day (YYDDD) and ISO date", "test_condition", raw_column="Test", unit_status="n/a",
         transform="first five digits of the test ID; YYDDD -> calendar date"),
    spec("fuel_species", "Hydrocarbon fuel species", "test_condition", raw_column="Fuel", unit_status="n/a",
         transform="'butane' -> 'n-butane' per final report Tables 1-2 (n-C4H10)"),
    spec("bottle_fuel_pct", "Fuel percentage in the fuel bottle (balance N2), from the fuel label", "test_condition",
         raw_column="Fuel", unit="%", unit_status="header", transform="parsed from '30% butane'; neat fuel = 100"),
    spec("x_o2_before", "Ambient O2 mole fraction before the test (normal flames)", "test_condition",
         raw_column=" XO2 before test", unit="mole fraction", unit_status="dimensionless"),
    spec("x_o2_after", "Ambient O2 mole fraction after the test (normal flames; post-test value, not a predictor)",
         "derived_experimental", raw_column="XO2  after test", unit="mole fraction", unit_status="dimensionless"),
    spec("x_f_supply", "Fuel mole fraction in the burner supply (normal flames)", "test_condition", raw_column="Xf",
         unit="mole fraction", unit_status="dimensionless"),
    spec("m_fuel_mg_s", "Hydrocarbon mass flow from the burner (normal flames)", "test_condition", raw_column="mHC (mg/s)",
         unit_raw="mg/s", unit="mg/s"),
    spec("x_f_ambient_before", "Ambient fuel mole fraction before the test (inverse flames)", "test_condition",
         raw_column="Xf  before test", unit="mole fraction", unit_status="dimensionless"),
    spec("x_f_ambient_after", "Ambient fuel mole fraction after the test (inverse flames; post-test value)",
         "derived_experimental", raw_column="Xf  after test", unit="mole fraction", unit_status="dimensionless"),
    spec("x_o2_supply", "O2 mole fraction in the burner supply (inverse flames)", "test_condition", raw_column="XO2",
         unit="mole fraction", unit_status="dimensionless"),
    spec("m_o2_mg_s", "O2 mass flow from the burner (inverse flames)", "test_condition", raw_column="O2 flow rate (mg/s)",
         unit_raw="mg/s", unit="mg/s"),
    spec("hc_burnrate_mg_s", "'HC burnrate' (inverse flames): equals O2 flow / stoichiometric O2-to-fuel mass ratio",
         "derived_experimental", raw_column="HC burnrate (mg/s)", unit_raw="mg/s", unit="mg/s",
         note="Checked by SpaceFire: ratio O2 flow / HC burnrate matches the stoichiometric mass ratio for every row. "
              "It is a stoichiometric-equivalent rate, not a measured fuel consumption."),
    spec("p_bar", "Chamber pressure (approximate, as labelled)", "test_condition", raw_column="approx p (bar)",
         unit_raw="bar", unit="bar", note="Header says 'approx'."),
    spec("p_atm", "Chamber pressure converted for comparison with Flame Design", "test_condition",
         raw_column="approx p (bar)", unit="atm", transform="bar / 1.01325"),
    spec("tad_k", "Adiabatic flame temperature (calculated by the investigators; method not documented in the CSV)",
         "derived_experimental", raw_column="Tad (K)", unit_raw="K", unit="K"),
    spec("zst", "Stoichiometric mixture fraction (calculated by the investigators; method not documented in the CSV)",
         "derived_experimental", raw_column="Zst", unit="-", unit_status="dimensionless"),
    spec("tfp", "Thin-filament pyrometry fibres used (instrument flag, not a measurement)", "test_condition",
         raw_column="TFP", unit_status="n/a"),
    spec("hot_ignition", "Hot ignition observed", "direct_measurement", raw_column="Hot ignition", unit_status="n/a",
         transform="Yes/yes -> yes; No/no -> no; 'flash' kept"),
    spec("termination", "How the run ended: SE (self-extinguished) or FT (flow terminated)", "direct_measurement",
         raw_column="Self-ext or flow term", unit_status="n/a"),
    spec("outcome", "Outcome category derived from hot ignition + termination", "derived_experimental",
         unit_status="n/a", transform="see OUTCOMES"),
    spec("burn_time_s", "Burn time", "direct_measurement", raw_column="burn time (sec)", unit_raw="sec", unit="s",
         note="Uncensored only when termination is SE; right-censored when FT."),
    spec("burn_time_censored", "Burn time is right-censored (FT)", "derived_experimental", unit_status="n/a"),
    spec("peak_burner_t_c", "Peak burner temperature", "direct_measurement", raw_column="Peak burner T (C ) / Peak burner Temp (C)",
         unit_raw="C", unit="degC"),
    spec("peak_burner_t_k_csv", "Peak burner temperature in K as given in the inverse CSV", "derived_experimental",
         raw_column="Peak burner temp (K)", unit_raw="K", unit="K"),
    spec("color", "Flame colour as recorded by the team (inverse flames)", "direct_measurement", raw_column="Color",
         unit_status="n/a", transform="lower-cased; 'limit' kept and flagged as undefined"),
    spec("cool_flame", "Cool-flame annotation (normal table column 'Cool flame?')", "direct_measurement",
         raw_column="Cool flame?", unit_status="n/a"),
    spec("pci_label", "PCI-A ... PCI-G label in the 'Cool flame?' column (meaning not documented locally)",
         "report_statement", raw_column="Cool flame?", unit_status="n/a"),
]


def _tests(repo: Path) -> Dataset:
    ds = Dataset("cfig_tests", INV, "CFI-G per-test conditions and observed outcomes", "direct_measurement",
                 "Every test point in the two PSI-159 experimental tables, normal and inverse kept separate. Conditions "
                 "are inputs; hot ignition, termination mode, burn time, peak burner temperature and colour are "
                 "observations.",
                 sources=[source_entry(repo, NORMAL, "experiment_table"), source_entry(repo, INVERSE, "experiment_table")],
                 field_specs=FIELD_SPECS)
    excluded_blank = 0
    total = 0
    spaced = case_fixed = 0
    for rel, config in ((NORMAL, "normal"), (INVERSE, "inverse")):
        header, rows, meta = read_csv_rows(repo / rel)
        excluded_blank += meta["blank_rows"]
        H = {h: i for i, h in enumerate(header)}
        col = lambda r, name: r[H[name]] if name in H else ""   # noqa: E731
        for row_no, r in rows:
            total += 1
            raw = {h: r[i] for i, h in enumerate(header)}
            tid_raw = col(r, "Test")
            tid = _test_id(tid_raw)
            rid = f"cfig:{config}:{tid}"
            fuel_raw = col(r, "Fuel")
            species, pct = _species_and_dilution(fuel_raw)
            hot_raw = col(r, "Hot ignition").strip()
            hot = hot_raw.lower()
            term = (col(r, "Self-ext or flow term") or col(r, "Self -ext or flow term")).strip()
            bt, bt_kind = parse_num(col(r, "burn time (sec)"))
            p, _ = parse_num(col(r, "approx p (bar)"))
            v: dict = {"configuration": config, "test_id_raw": tid_raw, "test_day": tid[:5], "date": _date_of(tid[:5]),
                       "day_index": parse_num(col(r, "Day"))[0], "fuel_raw": fuel_raw, "fuel_species": species,
                       "bottle_fuel_pct": pct, "p_bar": p, "p_atm": round(p / BAR_PER_ATM, 5) if p is not None else None,
                       "tfp": col(r, "TFP").strip().lower() == "yes", "hot_ignition": hot, "termination": term or None,
                       "outcome": _outcome(hot, term), "burn_time_s": bt,
                       "burn_time_censored": term == "FT", "comments": col(r, "Comments").strip() or None}
            if config == "normal":
                v.update(x_o2_before=parse_num(col(r, " XO2 before test"))[0], x_o2_after=parse_num(col(r, "XO2  after test"))[0],
                         x_f_supply=parse_num(col(r, "Xf"))[0], m_fuel_mg_s=parse_num(col(r, "mHC (mg/s)"))[0])
                tc, tc_kind = parse_num(col(r, "Peak burner T (C )"))
                v["peak_burner_t_c"] = tc
                cf = col(r, "Cool flame?").strip()
                v["cool_flame"] = None if not cf else ("yes" if cf.lower().startswith("yes") else "no")
                m = re.search(r"PCI-([A-Z]|hot)", cf)
                v["pci_label"] = m.group(0) if m else None
            else:
                v.update(x_f_ambient_before=parse_num(col(r, "Xf  before test"))[0],
                         x_f_ambient_after=parse_num(col(r, "Xf  after test"))[0],
                         x_o2_supply=parse_num(col(r, "XO2"))[0], hc_burnrate_mg_s=parse_num(col(r, "HC burnrate (mg/s)"))[0],
                         m_o2_mg_s=parse_num(col(r, "O2 flow rate (mg/s)"))[0])
                tc, tc_kind = parse_num(col(r, "Peak burner Temp (C)"))
                v["peak_burner_t_c"] = tc
                tk, tk_kind = parse_num(col(r, "Peak burner temp (K)"))
                v["peak_burner_t_k_csv"] = tk
                color = col(r, "Color").strip().lower()
                v["color"] = None if color in ("", "-") else color
            tad, tad_kind = parse_num(col(r, "Tad (K)"))
            zst, zst_kind = parse_num(col(r, "Zst"))
            v["tad_k"], v["zst"] = tad, zst
            rec = new_record(rid, test_id=tid, source_file=rel, source_table=f"PSI-159 experimental table ({config})",
                             source_row=row_no, verification="parsed_from_source_csv", values=v, raw=raw)
            ds.records.append(rec)

            def flag(rule, cat, sev, desc, fld=None, val=None, status="reported"):
                ds.flag(Flag(rule, cat, sev, desc, rid, tid, fld, val, row_no, f"{rel} row {row_no}", status))

            if tid_raw != tid:
                spaced += 1
            if tad_kind == "spreadsheet_error" or zst_kind == "spreadsheet_error":
                flag("CFIG-SPREADSHEET-ERROR", "invalid", "warning",
                     f"Spreadsheet error in Tad/Zst ({col(r, 'Tad (K)')}, {col(r, 'Zst')}); value left empty, not "
                     "recomputed. The row records zero fuel flow.", "Tad (K)", col(r, "Tad (K)"))
            if config == "inverse":
                if tk_kind == "spreadsheet_error":
                    flag("CFIG-SPREADSHEET-ERROR", "invalid", "warning", "Peak burner temperature (K) is a spreadsheet "
                         "error (#VALUE!); the °C cell is '-'. Left empty.", "Peak burner temp (K)", col(r, "Peak burner temp (K)"))
                if tc is None and tk is not None and abs(tk - 273.15) < 1e-9:
                    flag("CFIG-273K-ARTIFACT", "suspicious", "warning", "Peak burner temperature 273.15 K with an empty "
                         "°C cell: the K value is an artefact of converting an empty cell (0 °C), not a measurement. "
                         "Excluded from temperature statistics.", "Peak burner temp (K)", "273.15")
                    v["peak_burner_t_k_csv"] = None
                if v.get("color") == "limit":
                    flag("CFIG-COLOR-LIMIT-UNDEFINED", "undefined", "info", "Colour value 'limit' is not defined in "
                         "any local document; kept as recorded, not interpreted.", "Color", "limit", "unresolved")
                if v["hc_burnrate_mg_s"] and v["m_o2_mg_s"]:
                    ratio = v["m_o2_mg_s"] / v["hc_burnrate_mg_s"]
                    if abs(ratio - STOICH_O2_PER_FUEL[species]) / STOICH_O2_PER_FUEL[species] > 0.01:
                        flag("CFIG-HC-RATE-RATIO", "inconsistent", "info",
                             f"O2 flow / HC burnrate = {ratio:.3f}, not the stoichiometric {STOICH_O2_PER_FUEL[species]:.3f}.",
                             "HC burnrate (mg/s)", col(r, "HC burnrate (mg/s)"))
            if v.get("pci_label") and v["pci_label"] != "PCI-hot":
                flag("CFIG-PCI-LABEL-UNDEFINED", "undefined", "info", f"'{v['pci_label']}' label: meaning not documented "
                     "locally; not interpreted. The cool-flame 'yes' itself is consistent with final report Table 3.",
                     "Cool flame?", col(r, "Cool flame?"), "unresolved")
            if bt_kind == "blank":
                flag("CFIG-BURN-TIME-BLANK", "missing", "info", "Burn time cell is empty.", "burn time (sec)", "")
            if "direct cool" in (v["comments"] or "").lower():
                flag("CFIG-DIRECT-COOL-UNCONFIRMED", "document_conflict", "warning",
                     "Comment says 'direct cool - no hot ignition' at ~0.5 bar, but the final report states cool "
                     "diffusion flames were obtained only at 2 bar (PDF p23, p44) and lists none for this test in Table 3. "
                     "Kept as an unconfirmed comment.", "Comments", v["comments"], "disputed")
            if hot_raw and hot_raw != hot_raw.capitalize() and hot != "flash":
                case_fixed += 1
    ds.flags.append(Flag("CFIG-ID-SPACING", "info", "info", f"{spaced} test IDs are written with a space (e.g. "
                         "'21088 B1'); they are matched without it. Original strings kept.", raw_field="Test"))
    ds.flags.append(Flag("CFIG-CASE", "info", "info", f"{case_fixed} 'Hot ignition' values in lower case and "
                         "'inverse'/'Inverse' in Flame Type were case-normalized. Original strings kept.",
                         raw_field="Hot ignition"))
    ds.finalize(total, 0, {"blank CSV rows (not records)": excluded_blank})
    ds.notes = [
        "Normal (179) and inverse (154) test points are separate groups: the reactant placement is reversed.",
        "Burn time is an extinction time only for SE rows; FT rows are right-censored and must not be read as "
        "extinction times.",
        "Tad and Zst were calculated by the investigators; their calculation method is not documented in the CSV.",
        "Post-test columns (XO2 after, Xf after) describe the vitiated atmosphere after the burn; they are not inputs.",
        f"The inverse CSV contains {excluded_blank} trailing blank rows; they are not test records.",
    ]
    ds.extra["outcome_definitions"] = OUTCOMES
    return ds


# ------------------------------------------------------------------------------- final report Table 3 (p46) ------
# Transcribed from PSI-159_Reports_FinalRpt_ACME.CFI-G.pdf, PDF page 46. Columns: test point, XO2, Xf, p (bar),
# hydrocarbon mass flow (mg/s), flame duration (s), hot-flame radius rhf (mm), cool-flame radius rcf (mm), rhf/rcf.
# Footnote 1: sub-numbers after a dash = sequential reignited hot flame / following cool flame within one test.
# Footnote 3 (on 21174D1): cool-flame radius could not be evaluated due to low camera gain. In text extraction the
# footnote digit joins the ID ("21174D13"); the test is 21174D1.
TABLE3 = [
    ("21174C3", None, 0.395, 0.300, 2.03, 1.50, 13.9, 17.6, 7.6, 2.3),
    ("21174C4", None, 0.394, 0.300, 2.03, 1.00, 13.8, 14.6, 5.3, 2.8),
    ("21174C6", None, 0.385, 0.300, 2.03, 0.75, 14.3, 12.4, 5.1, 2.4),
    ("21174D1", None, 0.392, 0.300, 2.03, 1.00, None, 13.9, None, None),
    ("21174F1", None, 0.390, 0.300, 2.03, 1.50, 13.8, 17.4, 7.5, 2.3),
    ("21291A1", 1, 0.399, 0.300, 2.03, 1.50, 10.9, 17.2, 7.1, 2.4),
    ("21291A1", 2, 0.399, 0.300, 2.03, 1.50, 3.4, 17.3, 6.5, 2.7),
    ("21291A1", 3, 0.399, 0.300, 2.03, 1.50, 3.8, 17.6, 6.3, 2.8),
    ("21291A1", 4, 0.399, 0.300, 2.03, 1.50, 4, 17.6, 6.2, 2.8),
    ("21291A1", 5, 0.399, 0.300, 2.03, 1.50, 3.7, 17.7, 6.2, 2.9),
    ("21291C1", 1, 0.394, 0.300, 2.03, 1.00, 6.2, 14.4, 5.1, 2.8),
    ("21291C1", 2, 0.394, 0.300, 2.03, 1.00, 5.8, 14.9, 5.5, 2.7),
    ("21291C1", 3, 0.394, 0.300, 2.03, 1.00, 5.5, 14.7, 5.7, 2.6),
    ("21291C1", 4, 0.394, 0.300, 2.03, 1.00, 5.4, 14.9, 5.7, 2.6),
    ("21291C1", 5, 0.394, 0.300, 2.03, 1.00, 5.3, 14.4, 5.5, 2.6),
]


def _fmt(v, nd: int) -> str:
    return "-" if v is None else (f"{v:.{nd}f}" if isinstance(v, float) and nd else str(v))


def _printed_tokens(row) -> list[str]:
    tid, sub, xo2, xf, p, m, dur, rhf, rcf, ratio = row
    t = tid + ("" if sub is None else f"-{sub}")
    if tid == "21174D1":
        t = "21174D13"           # footnote 3 joined by text extraction (verified against the page)
    out = [t, f"{xo2:.3f}", f"{xf:.3f}", f"{p:.2f}", f"{m:.2f}"]
    out.append("-" if dur is None else (str(int(dur)) if float(dur).is_integer() and dur == 4 else f"{dur}"))
    out.append(f"{rhf}")
    out += (["-", "-"] if rcf is None else [f"{rcf}", f"{ratio}"])
    return out


def _cool_flames(repo: Path, tests: Dataset) -> Dataset:
    ds = Dataset("cfig_cool_flames", INV, "CFI-G cool diffusion flame events (final report Table 3)", "direct_measurement",
                 "All 15 cool-flame events reported in the CFI-G final report, with hot- and cool-flame radii measured "
                 "from images. Valid only at the reported condition: 30% n-butane, normal flames, ~2.03 bar, XO2 ~0.39.",
                 sources=[source_entry(repo, REPORT, "final_report")],
                 field_specs=[
                     spec("x_o2", "Ambient O2 mole fraction", "test_condition", raw_column="XO2", unit="mole fraction",
                          unit_status="dimensionless"),
                     spec("x_f", "Fuel mole fraction in burner supply", "test_condition", raw_column="Xf", unit="mole fraction",
                          unit_status="dimensionless"),
                     spec("p_bar", "Pressure", "test_condition", raw_column="p (bar)", unit_raw="bar", unit="bar"),
                     spec("m_fuel_mg_s", "Hydrocarbon mass flow rate (footnote 2)", "test_condition", raw_column="ṁ (mg/s)",
                          unit_raw="mg/s", unit="mg/s"),
                     spec("cool_flame_duration_s", "Cool flame duration", "direct_measurement",
                          raw_column="flame duration (sec)", unit_raw="sec", unit="s"),
                     spec("r_hot_mm", "Hot-flame radius", "direct_measurement", raw_column="rhf (mm)", unit_raw="mm", unit="mm"),
                     spec("r_cool_mm", "Cool-flame radius", "direct_measurement", raw_column="rcf (mm)", unit_raw="mm", unit="mm"),
                     spec("radius_ratio", "Hot/cool radius ratio as printed", "derived_experimental",
                          raw_column="rhf/rcf", unit="-", unit_status="dimensionless"),
                 ])
    page_text = pdf_page_text(repo / REPORT, 46)
    ok = verify_rows_in_page(page_text, [_printed_tokens(r) for r in TABLE3])
    by_tid = {r["test_id"]: r for r in tests.records if r["values"]["configuration"] == "normal"}
    for i, (row, verified) in enumerate(zip(TABLE3, ok), start=1):
        tid, sub, xo2, xf, p, m, dur, rhf, rcf, ratio = row
        rid = f"cfig:coolflame:{tid}" + (f"-{sub}" if sub else "")
        rec = new_record(rid, test_id=tid, source_file=REPORT, source_table="Final report Table 3", page_pdf=46,
                         source_row=i, verification="verified_against_pdf_text" if verified else "transcribed_unverified",
                         values={"sub_event": sub, "x_o2": xo2, "x_f": xf, "p_bar": p, "m_fuel_mg_s": m,
                                 "cool_flame_duration_s": dur, "r_hot_mm": rhf, "r_cool_mm": rcf, "radius_ratio": ratio,
                                 "configuration": "normal", "fuel_species": "n-butane", "bottle_fuel_pct": 30.0,
                                 "csv_record_id": by_tid[tid]["record_id"] if tid in by_tid else None},
                         raw={"printed_tokens": _printed_tokens(row)})
        ds.records.append(rec)
        if not verified:
            ds.flag(Flag("CFIG-T3-UNVERIFIED", "inconsistent", "critical", "Transcribed Table 3 row not found in the PDF "
                         "page text.", rid, tid, evidence_ref=f"{REPORT} PDF p46"))
        if tid == "21174D1":
            ds.flag(Flag("CFIG-T3-FOOTNOTE3", "missing", "info", "Footnote 3: the cool-flame radius could not be "
                         "evaluated due to low camera gain (duration and radius ratio also blank). Printed ID '21174D1' "
                         "plus footnote marker 3; not a test called 21174D13.", rid, tid, evidence_ref=f"{REPORT} PDF p46",
                         status="confirmed"))
        if rcf is not None and ratio is not None and abs(rhf / rcf - ratio) > 0.051:
            ds.flag(Flag("CFIG-T3-RATIO", "inconsistent", "info", f"Printed ratio {ratio} vs rhf/rcf = {rhf / rcf:.2f}.",
                         rid, tid, evidence_ref=f"{REPORT} PDF p46"))
    # cross-check: every Table 3 test has a CSV row marked cool flame 'yes' (and the report condition matches the CSV)
    csv_yes = sorted(r["test_id"] for r in tests.records if r["values"].get("cool_flame") == "yes")
    t3_tests = sorted({r[0] for r in TABLE3})
    ds.extra["cross_check"] = {"table3_tests": t3_tests, "csv_cool_flame_yes_tests": csv_yes,
                               "match": csv_yes == t3_tests,
                               "events": len(TABLE3), "tests": len(t3_tests)}
    ds.finalize(len(TABLE3))
    ds.notes = ["Radii are valid only for this narrow condition set; they are never interpolated to other conditions.",
                "Report text (PDF p44): cool flames observed only with 30 vol% n-butane, 40 vol% O2, normal flames, "
                "2.03 bar and 0.75-1.5 mg/s; 15 of the 189 radiatively extinguished hot flames reignited as cool flames."]
    return ds


# ------------------------------------------------------------- final report Tables 1-2 (flames per test day) ------
# PDF pages 21 (Table 1, normal) and 22 (Table 2, inverse + one added normal day). "Hot flames ignited" counts
# "sustained or momentary hot flames ignited (or reignited)". Atmospheres are nominal (vitiation not included).
DAYS = [
    # code, round, configuration, atmospheres as printed, bottle as printed (None = merged cell above), hot flames
    ("21088", 1, "normal", ["~40% O2, 13.7 psia", "~21% O2, 14.7 psia", "~18% O2, 14.7 psia"], "100% C2H6", 14),
    ("21102", 1, "normal", ["~40% O2, 14.7 psia", "~21% O2, 14.7 psia"], "50% n-C4H10 with N2", 9),
    ("21106", 1, "normal", ["~40% O2, 7.35 psia", "~21% O2, 7.35 psia"], None, 10),
    ("21112", 1, "normal", ["~40% O2, 13.7 psia", "~21% O2, 14.7 psia"], "100% C3H8", 13),
    ("21125", 1, "normal", ["~40% O2, 14.7 psia", "~21% O2, 14.7 psia"], "30% n-C4H10 with N2", 6),
    ("21130", 1, "normal", ["~21% O2, 29.4 psia", "~21% O2, 44.1 psia"], "30% C3H8 with N2", 15),
    ("21137", 1, "normal", ["~40% O2, 14.7 psia", "~21% O2, 14.7 psia"], None, 12),
    ("21153", 1, "normal", ["~40% O2, 7.35 psia", "~40% O2, 29.4 psia"], "g30% C2H6 with N2", 14),
    ("21162", 1, "normal", ["~40% O2, 14.7 psia", "~21% O2, 14.7 psia"], None, 12),
    ("21174", 1, "normal", ["~40% O2, 7.35 psia", "~40% O2, 29.4 psia"], "30% n-C4H10 with N2", 16),
    ("21196", 2, "inverse", ["~30% C2H6, 14.7 psia", "~30% C2H6, 7.35 psia"], "85% O2 with N2", 13),
    ("21202", 2, "inverse", ["~6% C2H6, 29.4 psia", "~12% C2H6, 29.4 psia", "~12% C2H6, 14.7 psia"], None, 11),
    ("21209", 2, "inverse", ["~24% C2H6, 7.35 psia"], None, 11),
    ("21216", 2, "inverse", ["~10% C2H6, 44.1 psia", "~10% C2H6, 14.7 psia"], None, 12),
    ("21222", 2, "inverse", ["~8% C3H8, 44.1 psia"], None, 9),
    ("21228", 2, "inverse", ["~9% C3H8, 29.4 psia", "~9% C3H8, 14.7 psia"], None, 17),
    ("21235", 2, "inverse", ["~21% C3H8, 14.7 psia", "~21% C3H8, 7.35 psia"], None, 9),
    ("21242", 2, "inverse", ["~43% C3H8, 7.35 psia"], None, 2),
    ("21256", 2, "inverse", ["~9% n-C4H10, 29.4 psia", "~7% n-C4H10, 29.4 psia"], None, 17),
    ("21265", 2, "inverse", ["~6% n-C4H10, 44.1 psia"], None, 15),
    ("21270", 2, "inverse", ["~17% n-C4H10, 14.7 psia", "~14% n-C4H10, 14.7 psia"], None, 10),
    ("21277", 2, "inverse", ["~36% n-C4H10, 7.35 psia", "~25% n-C4H10, 7.35 psia", "~18% n-C4H10, 7.35 psia",
                             "~14% n-C4H10, 7.35 psia"], None, 11),
    ("21291", 2, "normal", ["~40% O2, 29.4 psia", "~40% O2, 14.7 psia"], "30% n-C4H10 with N2", 22),
]


def _days(repo: Path, tests: Dataset) -> Dataset:
    ds = Dataset("cfig_test_days", INV, "CFI-G flames ignited per test day (final report Tables 1-2)", "operational_log",
                 "Day-level log of hot flames ignited, nominal atmospheres and fuel bottles.",
                 sources=[source_entry(repo, REPORT, "final_report")],
                 field_specs=[spec("hot_flames_ignited", "Sustained or momentary hot flames ignited (or reignited)",
                                   "operational_log", raw_column="Hot flames ignited", unit="count", unit_status="n/a"),
                              spec("atmospheres", "Nominal atmospheres (N2-diluted; vitiation not included)", "test_condition",
                                   raw_column="Atmosphere", unit_status="n/a")])
    p21, p22 = pdf_page_text(repo / REPORT, 21), pdf_page_text(repo / REPORT, 22)
    csv_days: dict[str, list[dict]] = {}
    for r in tests.records:
        csv_days.setdefault(r["values"]["test_day"], []).append(r["values"])
    for i, (code, rnd, config, atm, bottle, n) in enumerate(DAYS, start=1):
        page = 21 if rnd == 1 else 22
        text = tokens(p21 if page == 21 else p22)
        ok = code in text and str(n) in text and all(a.split(",")[0].split(" ")[-1] in " ".join(text) for a in atm)
        rows = csv_days.get(code, [])
        v = {"test_day": code, "date": _date_of(code), "round": rnd, "configuration": config, "atmospheres": atm,
             "bottle_printed": bottle, "hot_flames_ignited": n, "csv_test_points": len(rows),
             "csv_hot_ignition_yes": sum(1 for x in rows if x["hot_ignition"] == "yes"),
             "csv_fuels": sorted({x["fuel_raw"] for x in rows})}
        rec = new_record(f"cfig:day:{code}", test_id=code, source_file=REPORT, source_table=f"Final report Table {rnd}",
                         page_pdf=page, source_row=i, verification="verified_against_pdf_text" if ok else "transcribed_unverified",
                         values=v)
        ds.records.append(rec)
        if bottle and bottle.startswith("g"):
            ds.flag(Flag("CFIG-T1-PRINT", "info", "info", "Printed bottle reads 'g30% C2H6 with N2' (stray character "
                         "in the PDF text); CSV fuel for this day is '30% ethane'.", rec["record_id"], code,
                         raw_value=bottle, evidence_ref=f"{REPORT} PDF p21"))
    total = sum(d[5] for d in DAYS)
    ds.extra["report_totals"] = {
        "hot_flames_tables_1_2": total,
        "report_text_hot_flames": 280, "report_text_radiative_extinctions": 189, "report_text_cool_flames": 15,
        "report_text_ref": f"{REPORT} PDF p44 ('A total of 280 hot diffusion flames were observed. Among them, 189 "
                           "flames experienced radiative extinction ... 15 subsequently reignited as cool diffusion flames')",
        "csv_rows": len(tests.records),
        "csv_hot_ignition_yes": sum(1 for r in tests.records if r["values"]["hot_ignition"] == "yes"),
        "csv_flash": sum(1 for r in tests.records if r["values"]["hot_ignition"] == "flash"),
        "csv_self_extinguished": sum(1 for r in tests.records if r["values"]["termination"] == "SE"),
        "csv_flow_terminated": sum(1 for r in tests.records if r["values"]["termination"] == "FT"),
        "why_counts_differ": "The report counts sustained or momentary hot flames, including reignitions within one "
                             "test point (Table 2 footnote 3); the CSV has one row per test point. 'Radiative "
                             "extinction' (report) and 'SE' (CSV) are not defined as the same quantity locally. Both "
                             "source-specific counts are kept; neither is adjusted.",
    }
    ds.finalize(len(DAYS))
    return ds


def build(repo: Path) -> list[Dataset]:
    tests = _tests(repo)
    cool = _cool_flames(repo, tests)
    days = _days(repo, tests)
    if not cool.extra["cross_check"]["match"]:
        cool.flag(Flag("CFIG-T3-CSV-MISMATCH", "document_conflict", "warning",
                       "Tests with a CSV cool-flame 'yes' differ from the Table 3 tests.", evidence_ref=f"{REPORT} PDF p46"))
    return [tests, cool, days]

"""PSI-117 cool-flame dynamics (ground investigation; FLEX-based modeling).

The nine 'Analyzed data' CSVs hold side-by-side figure series. Each series is declared explicitly below (columns,
role, variable, units and how each unit is known) because block position alone does not reliably identify the role.
Experimental series are published figure data (digitized points); model series are outputs of the authors'
1-D sphero-symmetric droplet model (not 3-D CFD; no OpenFOAM output is in the download). Nothing is joined to
SpaceFire's FLEX rows: PSI-117 cites FLEX test numbers (e.g. FLEX 1268) that have no key in the FLEX table.
"""
from __future__ import annotations

from pathlib import Path

from .common import Dataset, Flag, new_record, parse_num, read_csv_rows, source_entry, spec

INV = "PSI-117"
DIR = "PSI-117/Analyzed data"
P = "PSI-117_Analyzed Data_"
FILES = {
    "A": f"{P}MST_2024_Burning_history_Flame_diameter.csv",
    "B": f"{P}MST_2024_Dext.csv",
    "C": f"{P}MST_2024_Kavg.csv",
    "D": f"{P}MST_2024_Radiance_Flame_Diameter.csv",
    "E": f"{P}PROCI_2019_Oscillatory_Cool_Flame.csv",
    "F": f"{P}PROCI_2019_Stable_Cool.csv",
    "G": f"{P}PROCI_2023_Alkane_Extinction_Diameter_1atm.csv",
    "H": f"{P}PROCI_2023_C12_Extinction_Diameter_vs_pressure.csv",
    "I": f"{P}PROCI_C12_2019_Three_Stage.csv",
}
README = f"{DIR}/{P}ReadMe_List_of_Data.xlsx"
SLIDES_EXT = "PSI-117/PSI-117_Presentations_Extinction_Characteristics_TFarouk.pdf"
SLIDES_3S = "PSI-117/PSI-117_Presentations_Three_Stage_Cool_Flame_TFarouk.pdf"
SLIDES_SEM = "PSI-117/PSI-117_Presentations_PSI_Users_Group_Cool_Flames_in_Space_03302026.pdf"

# Conditions and references per file, from the ReadMe workbook (Sheet1), kept as printed.
CONDITIONS = {
    "A": dict(fuel="n-dodecane", d0="4 mm", p="1 atm", gas="XO2 0.21, XN2 0.79", ref="10.1007/s12217-024-10115-x"),
    "B": dict(fuel="n-dodecane", d0="4 mm", p="0.5 - 1.5 atm (ReadMe); model points to 3 atm", gas="XO2 0.21, XN2 0.79",
              ref="10.1007/s12217-024-10115-x"),
    "C": dict(fuel="n-dodecane", d0="4.5 mm", p="0.5 - 5.0 atm", gas="XO2 0.21, XN2 0.79", ref="10.1007/s12217-024-10115-x"),
    "D": dict(fuel="n-dodecane", d0="~4.5 mm (4.46 / 4.48 mm in the file)", p="0.5 and 5.0 atm", gas="XO2 0.21, XN2 0.79",
              ref="10.1007/s12217-024-10115-x"),
    "E": dict(fuel="n-heptane", d0="0.5 mm", p="1 atm", gas="ReadMe: XO2 0.1, XN2 85, XO3 'Balance' (see flag)",
              ref="10.1016/j.proci.2018.05.151"),
    "F": dict(fuel="n-heptane", d0="0.5 mm", p="1 atm", gas="ReadMe: XO2 0.21, XN2 74, XO3 'Balance' (see flag)",
              ref="10.1016/j.proci.2018.05.151"),
    "G": dict(fuel="n-heptane, n-decane, n-dodecane", d0="2.0 - 7.0 mm", p="1 atm", gas="XO2 0.21, XN2 0.79",
              ref="10.1016/j.proci.2022.07.094"),
    "H": dict(fuel="n-dodecane", d0="4 mm", p="0.5 - 3.0 atm", gas="XO2 0.21, XN2 0.79", ref="10.1016/j.proci.2022.07.094"),
    "I": dict(fuel="n-dodecane", d0="4.5 mm", p="2.75 atm", gas="ReadMe: XO2 0.21, XN2 0.5, XHe 0.29; slides: FLEX 1268, "
              "21.6% O2, 50.2% N2, 28.2% He", ref="10.1016/j.proci.2018.09.015"),
}
ISA_DOIS = {"10.1016/j.proci.2022.07.094", "10.1016/j.proci.2020.06.200", "10.1016/j.combustflame.2020.06.012",
            "10.1016/j.proci.2018.05.151", "10.1016/j.pecs.2019.100787"}

EXP, MOD, MOD_ONLY, UNC, EXCL = "experiment", "model", "model_only_quantity", "uncertainty_undocumented", "excluded"
U_T = ("s", "inferred", "Header 't'/'time' has no unit; seconds inferred from the model columns ('time (s)', 'Time(sec)').")
U_P = ("atm", "documented", "ReadMe 'P (atm)'.")
U_DEXT = ("mm", "documented", "Extinction diameters are given in mm in the PSI-117 extinction slides (PDF p9).")
U_DEXT_MST = ("mm", "inferred", "Not stated in the MST_2024 file; same quantity as the PROCI 2023 files (mm).")
U_K_INF = ("mm²/s", "inferred", "Experimental Kavg_CF has no unit; the adjacent model column is 'kb (mm2/s)' and the "
           "extinction slides (PDF p9) give Kavg in mm²/s.")
U_TDO2 = ("s/mm²", "inferred", "Header 't/(Do)2' without unit in this block; other blocks of the file give s/mm2.")


def S(sid, f, xc, yc, role, label, xv, xu, yv, yu, figure, *, basis="block label", note=None):
    return dict(series_id=sid, file=f, x_col=xc, y_col=yc, role=role, label=label, x_var=xv, x_unit=xu[0],
                x_unit_status=xu[1], x_unit_note=xu[2], y_var=yv, y_unit=yu[0], y_unit_status=yu[1],
                y_unit_note=yu[2], figure=figure, role_basis=basis, note=note)


H = lambda u: (u, "header", "Unit in the column header.")  # noqa: E731
DL = ("-", "dimensionless", "Ratio.")
UNK = ("unknown", "unknown", "No unit in the file, ReadMe or the local slides.")

SERIES = [
    S("A-exp-d2", "A", 1, 2, EXP, "Experiment (EXP)", "time", U_T, "droplet diameter squared", H("mm²"), "burn-d2"),
    S("A-exp-df", "A", 4, 5, EXP, "Experiment (EXP)", "time", U_T, "flame diameter", H("mm"), "burn-df"),
    S("A-exp-q1", "A", 7, 8, EXP, "Experiment radiance, series 1 (unlabelled)", "time", U_T, "flame radiance", H("W"), "burn-q",
      note="Two experimental radiance series are present without labels."),
    S("A-exp-q2", "A", 9, 10, EXP, "Experiment radiance, series 2 (unlabelled)", "time", U_T, "flame radiance", H("W"), "burn-q"),
    S("A-mod-d2", "A", 13, 14, MOD, "Model (1 atm, d0 4 mm)", "time", U_T, "droplet diameter squared", H("mm²"), "burn-d2"),
    S("A-mod-df", "A", 13, 15, MOD, "Model (1 atm, d0 4 mm)", "time", U_T, "flame diameter", H("mm"), "burn-df",
      note="Starts at 79.7 mm (ignition/initialization), not a physical flame size."),
    S("A-mod-q", "A", 18, 19, MOD, "Model radiance (1 atm, d0 4 mm)", "time", U_T, "flame radiance", H("W"), "burn-q"),
    S("B-mod-cf", "B", 1, 2, MOD, "Model, cool flame", "pressure", U_P, "cool-flame extinction diameter", U_DEXT_MST, "mst-dext"),
    S("B-mod-hf", "B", 1, 3, MOD, "Model, hot flame", "pressure", U_P, "hot-flame extinction diameter", U_DEXT_MST, "mst-dext"),
    S("B-exp-cf", "B", 6, 7, EXP, "Experiment, cool flame", "pressure", U_P, "cool-flame extinction diameter", U_DEXT_MST, "mst-dext"),
    S("C-exp", "C", 1, 2, EXP, "Experiment (cool-flame average burning rate, Kavg_CF)", "pressure", U_P,
      "cool-flame average burning rate", U_K_INF, "kavg"),
    S("C-mod", "C", 5, 6, MOD, "Model (kb)", "pressure", U_P, "burning rate constant", H("mm²/s"), "kavg",
      note="Model column is 'kb'; experiment column is 'Kavg_CF'. Names differ; not assumed identical definitions."),
    S("D-exp-q-05", "D", 1, 2, EXP, "Experiment 0.5 atm (d0 4.46 mm)", "time", U_T, "flame radiance", H("W"), "p-radiance"),
    S("D-exp-df-05", "D", 3, 4, EXP, "Experiment 0.5 atm (d0 4.46 mm)", "time", U_T, "flame diameter", H("mm"), "p-flame"),
    S("D-exp-q-5", "D", 8, 9, EXP, "Experiment 5 atm (d0 4.48 mm)", "time", U_T, "flame radiance", H("W"), "p-radiance"),
    S("D-exp-df-5", "D", 10, 11, EXP, "Experiment 5 atm (d0 4.48 mm)", "time", U_T, "flame diameter", H("mm"), "p-flame"),
    S("D-mod-q-05", "D", 16, 17, MOD, "Model 0.5 atm", "time", H("s"), "flame radiance", H("W"), "p-radiance"),
    S("D-mod-q-5", "D", 20, 21, MOD, "Model 5 atm", "time", H("s"), "flame radiance", H("W"), "p-radiance"),
    S("D-mod-df-05", "D", 25, 26, MOD, "Model 0.5 atm", "time", H("s"), "flame diameter", H("mm"), "p-flame",
      note="Starts at 100.3 mm (initialization)."),
    S("D-mod-df-5", "D", 29, 30, MOD, "Model 5 atm", "time", H("s"), "flame diameter", H("mm"), "p-flame",
      note="Starts at 100.3 mm (initialization)."),
    S("D-mod-tmax-05", "D", 34, 35, MOD_ONLY, "Model 0.5 atm", "time", H("s"), "peak gas temperature", H("K"), "p-tmax",
      note="Model-only quantity: no measured temperature exists in PSI-117. Starts at 2400 K (ignition source)."),
    S("D-mod-tmax-5", "D", 38, 39, MOD_ONLY, "Model 5 atm", "time", H("s"), "peak gas temperature", H("K"), "p-tmax"),
]
for key, tag in (("E", "oscillatory"), ("F", "stable")):
    lab = "Model, oscillatory cool flame" if key == "E" else "Model, stable cool flame"
    SERIES += [
        S(f"{key}-d2", key, 0, 6, MOD, lab, "time", H("s"), "(D/D0)²", DL, "submm-d2"),
        S(f"{key}-tmax", key, 0, 3, MOD_ONLY, lab, "time", H("s"), "peak gas temperature", H("K"), "submm-tmax"),
        S(f"{key}-k", key, 0, 2, MOD_ONLY, lab, "time", H("s"), "instantaneous burning rate", H("mm²/s"), "submm-k"),
        S(f"{key}-sto", key, 0, 4, MOD_ONLY, lab, "time", H("s"), "peak-temperature radius / droplet radius", DL, "submm-sto"),
    ]
for fuel, c_exp, c_sim in (("n-heptane", 0, 5), ("n-decane", 10, 15), ("n-dodecane", 20, 25)):
    short = {"n-heptane": "C7", "n-decane": "C10", "n-dodecane": "C12"}[fuel]
    SERIES += [
        S(f"G-{short}-exp-hf", "G", c_exp + 1, c_exp + 2, EXP, f"{short} experiment, hot flame", "initial droplet diameter",
          U_DEXT, "hot-flame extinction diameter", U_DEXT, "ext-vs-d0"),
        S(f"G-{short}-exp-cf", "G", c_exp + 1, c_exp + 3, EXP, f"{short} experiment, cool flame", "initial droplet diameter",
          U_DEXT, "cool-flame extinction diameter", U_DEXT, "ext-vs-d0"),
        S(f"G-{short}-sim-hf", "G", c_sim + 1, c_sim + 2, MOD, f"{short} simulation, hot flame", "initial droplet diameter",
          U_DEXT, "hot-flame extinction diameter", U_DEXT, "ext-vs-d0"),
        S(f"G-{short}-sim-cf", "G", c_sim + 1, c_sim + 3, MOD, f"{short} simulation, cool flame", "initial droplet diameter",
          U_DEXT, "cool-flame extinction diameter", U_DEXT, "ext-vs-d0"),
    ]
SERIES += [
    S("H-exp-hf", "H", 0, 1, EXP, "Experiment, hot flame", "pressure", H("atm"), "hot-flame extinction diameter", U_DEXT, "ext-vs-p"),
    S("H-mod-hf", "H", 3, 4, MOD, "Model, hot flame", "pressure", H("atm"), "hot-flame extinction diameter", U_DEXT, "ext-vs-p"),
    S("H-exp-cf", "H", 6, 7, EXP, "Experiment, cool flame", "pressure", H("atm"), "cool-flame extinction diameter", U_DEXT, "ext-vs-p"),
    S("H-mod-cf", "H", 9, 10, MOD, "Model, cool flame", "pressure", H("atm"), "cool-flame extinction diameter", U_DEXT, "ext-vs-p"),
    S("H-err-plus", "H", 12, 13, UNC, "Dext_CF_ErrorBar+", "pressure", H("atm"), "error bar (+)", UNK, None,
      note="Not attached to any point: bounds-vs-offsets undefined and the pressure grid follows the model rows."),
    S("H-err-minus", "H", 15, 16, UNC, "Dext_CF_ErrorBar-", "pressure", H("atm"), "error bar (-)", UNK, None),
    S("I-exp-d2", "I", 1, 2, EXP, "Experiment (EXPT, FLEX 1268)", "t/D0²", H("s/mm²"), "(D/D0)²", DL, "3s-d2"),
    S("I-exp-dfr", "I", 5, 6, EXP, "Experiment (EXPT)", "t/D0²", H("s/mm²"), "flame diameter / D0", DL, "3s-dfr"),
    S("I-exp-df", "I", 8, 9, EXP, "Experiment (EXPT)", "t/D0²", H("s/mm²"), "flame diameter", H("mm"), "3s-df"),
    S("I-exp-q1", "I", 12, 13, EXP, "Experiment, flame radiance I", "t/D0²", U_TDO2, "flame radiance", H("W"), "3s-q",
      basis="left of the 'Simulations' block; non-monotonic digitized time axis"),
    S("I-exp-q2", "I", 16, 17, EXP, "Experiment, flame radiance II", "t/D0²", U_TDO2, "flame radiance", H("W"), "3s-q",
      basis="left of the 'Simulations' block; non-monotonic digitized time axis"),
    S("I-exp-cf-hwfm", "I", 20, 21, EXP, "Experiment, cool-flame diameter (HWFM)", "t/D0²", U_TDO2, "cool-flame diameter",
      UNK, "3s-cf", basis="left of the 'Simulations' block"),
    S("I-exp-cf-pp", "I", 23, 24, EXP, "Experiment, cool-flame diameter (peak-peak)", "t/D0²", U_TDO2, "cool-flame diameter",
      UNK, "3s-cf", basis="left of the 'Simulations' block"),
    S("I-mod-d", "I", 28, 29, MOD, "Model (Simulations)", "time", H("s"), "droplet diameter", H("mm"), "3s-model-d"),
    S("I-mod-k", "I", 28, 30, MOD_ONLY, "Model (Simulations)", "time", H("s"), "instantaneous burning rate", H("mm²/s"), "3s-model-k"),
    S("I-mod-tmax", "I", 28, 31, MOD_ONLY, "Model (Simulations)", "time", H("s"), "peak gas temperature", H("K"), "3s-model-tmax"),
    S("I-mod-d2", "I", 35, 36, MOD, "Model, normalized (inferred)", "t/D0²", H("s/mm²"), "(D/D0)²", DL, "3s-d2",
      basis="same length (570) and monotonic time as the 'Simulations' block"),
    S("I-mod-df", "I", 35, 37, MOD, "Model, normalized (inferred)", "t/D0²", H("s/mm²"), "flame diameter", H("mm"), "3s-df",
      basis="same length (570) and monotonic time as the 'Simulations' block", note="Starts at 81 mm (initialization)."),
    S("I-unk-q", "I", 39, 40, EXCL, "Radiance block after the simulations (role unclear)", "t/D0²", H("s/mm²"),
      "flame radiance", H("W"), None, basis="EXCLUDED: right of 'Simulations' but non-monotonic like digitized data"),
]

FIGURES = {
    "ext-vs-p": dict(title="Hot- and cool-flame extinction diameter vs pressure (n-dodecane, ~4 mm, air)", file="H",
                     note="Error bars in the source file are not drawn: their meaning (bounds or offsets) is undocumented."),
    "ext-vs-d0": dict(title="Extinction diameter vs initial droplet diameter at 1 atm (n-heptane, n-decane, n-dodecane)", file="G"),
    "mst-dext": dict(title="Extinction diameter vs pressure, MST 2024 (n-dodecane, 4 mm)", file="B"),
    "kavg": dict(title="Cool-flame burning rate vs pressure (n-dodecane, 4.5 mm)", file="C"),
    "burn-d2": dict(title="Droplet diameter² history (n-dodecane, 4 mm, 1 atm)", file="A"),
    "burn-df": dict(title="Flame diameter history (n-dodecane, 4 mm, 1 atm)", file="A"),
    "burn-q": dict(title="Flame radiance history (n-dodecane, 4 mm, 1 atm)", file="A"),
    "p-radiance": dict(title="Flame radiance at 0.5 and 5 atm (n-dodecane, ~4.5 mm)", file="D"),
    "p-flame": dict(title="Flame diameter at 0.5 and 5 atm (n-dodecane, ~4.5 mm)", file="D"),
    "p-tmax": dict(title="Model peak gas temperature at 0.5 and 5 atm (model only)", file="D"),
    "3s-d2": dict(title="Three-stage burning: (D/D0)² (n-dodecane, 2.75 atm, FLEX 1268 conditions)", file="I"),
    "3s-df": dict(title="Three-stage burning: flame diameter", file="I"),
    "3s-dfr": dict(title="Three-stage burning: flame diameter / D0 (experiment)", file="I"),
    "3s-q": dict(title="Three-stage burning: flame radiance (experiment)", file="I"),
    "3s-cf": dict(title="Three-stage burning: cool-flame diameter (experiment; unit not stated)", file="I"),
    "3s-model-d": dict(title="Three-stage model: droplet diameter", file="I"),
    "3s-model-k": dict(title="Three-stage model: instantaneous burning rate (model only)", file="I"),
    "3s-model-tmax": dict(title="Three-stage model: peak gas temperature (model only)", file="I"),
    "submm-d2": dict(title="Sub-millimetre n-heptane droplet, ozone-assisted: (D/D0)² (model only)", file="E"),
    "submm-tmax": dict(title="Sub-millimetre droplet: peak gas temperature (model only)", file="E"),
    "submm-k": dict(title="Sub-millimetre droplet: instantaneous burning rate (model only)", file="E"),
    "submm-sto": dict(title="Sub-millimetre droplet: peak-temperature radius / droplet radius (model only)", file="E"),
}
PHYSICAL_NONNEG = {"droplet diameter squared", "flame diameter", "(D/D0)²", "flame diameter / D0", "cool-flame diameter",
                   "droplet diameter", "flame radiance", "hot-flame extinction diameter", "cool-flame extinction diameter",
                   "cool-flame average burning rate", "burning rate constant"}


def build(repo: Path) -> list[Dataset]:
    ds = Dataset("psi117_series", INV, "PSI-117 published figure data: experiment vs model series", "digitized_figure",
                 "Series from the nine PSI-117 'Analyzed data' CSVs, each declared with its role (experiment = published "
                 "figure data; model = 1-D sphero-symmetric droplet model output), variable, unit and unit status.",
                 sources=[source_entry(repo, f"{DIR}/{f}", "figure_data") for f in FILES.values()]
                 + [source_entry(repo, README, "data_dictionary")],
                 field_specs=[spec("x", "Independent variable (per series)", "digitized_figure", unit_status="per series"),
                              spec("y", "Dependent variable (per series); experiment = digitized figure data, "
                                        "model = model prediction", "digitized_figure", unit_status="per series")])
    files = {k: read_csv_rows(repo / DIR / f) for k, f in FILES.items()}
    used_pairs = 0
    excluded_points = 0
    for s in SERIES:
        header, rows, _ = files[s["file"]]
        xs, ys, neg_x, neg_y, zeros, nonnum = [], [], [], [], [], 0
        for row_no, r in rows:
            xv, xk = parse_num(r[s["x_col"]])
            yv, yk = parse_num(r[s["y_col"]])
            if xk == "blank" and yk == "blank":
                continue
            if xv is None or yv is None:
                nonnum += 1
                continue
            i = len(xs)
            xs.append(xv)
            ys.append(yv)
            if xv < 0:
                neg_x.append(i)
            if yv < 0 and s["y_var"] in PHYSICAL_NONNEG:
                neg_y.append(i)
            if yv == 0 and "extinction" in s["y_var"]:
                zeros.append(i)
        role = s["role"]
        ev = {EXP: "digitized_figure", MOD: "model_prediction", MOD_ONLY: "model_prediction",
              UNC: "digitized_figure", EXCL: "digitized_figure"}[role]
        rid = f"psi117:{s['series_id']}"
        v = {k: s[k] for k in ("series_id", "role", "label", "x_var", "x_unit", "x_unit_status", "x_unit_note", "y_var",
                               "y_unit", "y_unit_status", "y_unit_note", "figure", "role_basis", "note")}
        v.update(evidence_class=ev, file_key=s["file"], conditions=CONDITIONS[s["file"]], x=xs, y=ys, n=len(xs),
                 flagged_points={"negative_x": neg_x, "negative_y": neg_y, "zero_y": zeros})
        rec = new_record(rid, test_id=None, source_file=f"{DIR}/{FILES[s['file']]}",
                         source_table=f"columns {s['x_col']} ('{header[s['x_col']].strip()}') and {s['y_col']} "
                                      f"('{header[s['y_col']].strip()}')",
                         verification="parsed_from_source_csv", values=v,
                         raw={"x_header": header[s["x_col"]], "y_header": header[s["y_col"]]})
        ds.records.append(rec)
        if role == EXCL:
            excluded_points += len(xs)
            ds.flag(Flag("PSI117-ROLE-UNCLEAR", "undefined", "warning", f"Series excluded: {s['role_basis']}. "
                         f"{len(xs)} points kept in the source but not shown.", rid, raw_field=header[s["y_col"]]))
        else:
            used_pairs += len(xs)
        if role == UNC:
            ds.flag(Flag("PSI117-ERRORBAR-UNDEFINED", "undefined", "warning", "Error-bar column: whether values are "
                         "absolute bounds or offsets is not documented, and its pressure grid matches the model rows, not "
                         "the experimental rows. Not attached to any point.", rid, raw_field=header[s["y_col"]],
                         status="unresolved"))
        if neg_y:
            ds.flag(Flag("PSI117-NEGATIVE-PHYSICAL", "suspicious", "warning", f"{len(neg_y)} negative value(s) of a "
                         f"non-negative quantity ({s['y_var']}): digitization artefacts. Kept and marked; not plotted as "
                         "data.", rid, raw_field=header[s["y_col"]]))
        if neg_x:
            ds.flag(Flag("PSI117-NEGATIVE-TIME", "info", "info", f"{len(neg_x)} point(s) with negative x "
                         f"({s['x_var']}): before the time origin (pre-ignition) or digitization offset. Kept.", rid,
                         raw_field=header[s["x_col"]]))
        if zeros:
            ds.flag(Flag("PSI117-ZERO-UNDEFINED", "undefined", "info", f"{len(zeros)} zero value(s) of an extinction "
                         "diameter: meaning (no extinction, not observed, or 0 mm) is not documented. Kept; shown as "
                         "hollow markers.", rid, raw_field=header[s["y_col"]], status="unresolved"))
        if s["y_unit_status"] == "unknown":
            ds.flag(Flag("PSI117-UNIT-UNKNOWN", "unit", "warning", f"No unit for '{header[s['y_col']].strip()}' in the "
                         "file, ReadMe or local slides; plotted with 'unit not stated'.", rid, raw_field=header[s["y_col"]],
                         status="unresolved"))
        elif s["y_unit_status"] == "inferred" or s["x_unit_status"] == "inferred":
            ds.flag(Flag("PSI117-UNIT-INFERRED", "unit", "info", f"Unit inferred, not stated: "
                         f"{s['y_unit_note'] if s['y_unit_status'] == 'inferred' else s['x_unit_note']}", rid))
        if nonnum:
            ds.flag(Flag("PSI117-NONNUMERIC", "invalid", "info", f"{nonnum} row(s) with a non-numeric cell skipped in this "
                         "series.", rid))
        if s.get("note") and ("initialization" in s["note"] or "ignition" in s["note"]):
            ds.flag(Flag("PSI117-MODEL-INIT", "info", "info", s["note"], rid))
    ds.flags.append(Flag("PSI117-README-COMPOSITION", "inconsistent", "warning",
                         "ReadMe composition for the PROCI_2019 files mixes a mole fraction (XO2 0.1/0.21) with apparent "
                         "percents (XN2 85/74) under an 'XO3: Balance' header; the PSI seminar (PDF p24) gives XO2 10%, "
                         "XO3 5%, XN2 balance. Kept as printed.", raw_field="ReadMe Sheet1", evidence_ref=f"{SLIDES_SEM} PDF p24",
                         status="unresolved"))
    missing = sorted({c["ref"] for c in CONDITIONS.values()} - ISA_DOIS)
    ds.flags.append(Flag("PSI117-REF-NOT-IN-ISA", "info", "info", f"ReadMe cites {', '.join(missing)}, which are not in "
                         "the PSI-117 ISA-Tab publication list.", status="reported"))
    ds.flags.append(Flag("PSI117-NO-FLEX-JOIN", "info", "info", "PSI-117 refers to FLEX tests by numbers such as 1268, "
                         "1256 and 563; SpaceFire's FLEX table (PSI-69) uses FLEX Test # 1-274 and identifiers such as "
                         "N01H101. No crosswalk exists, so no PSI-117 series is joined to a FLEX row.", status="confirmed",
                         evidence_ref=f"{SLIDES_3S} PDF p15-22"))
    ds.flags.append(Flag("PSI117-NOT-3D-CFD", "info", "info", "Model series come from a 1-D sphero-symmetric droplet model "
                         "(slides; dissertation ch. 2). The PSI metadata describes 3-D OpenFOAM work, but no 3-D/CFD output is "
                         "in the download. Not presented as validated CFD.", status="confirmed"))
    total_points = sum(r["values"]["n"] for r in ds.records)
    ds.finalize(total_points, excluded_points, {"series with unclear role (I-unk-q)": excluded_points})
    ds.counts.update(series=len(ds.records), files=len(FILES), plotted_points=used_pairs)
    ds.extra["figures"] = FIGURES
    ds.extra["roles"] = {EXP: "Published figure data (digitized experimental points)",
                         MOD: "Model prediction (1-D sphero-symmetric droplet model)",
                         MOD_ONLY: "Model-only quantity (no corresponding measurement exists)",
                         UNC: "Uncertainty column with undefined meaning (not plotted)", EXCL: "Excluded: role unclear"}
    # 'flagged records' for PSI-117 are counted per series (a series with any warning flag)
    return [ds]

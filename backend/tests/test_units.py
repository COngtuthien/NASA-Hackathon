"""Unit tests on synthetic inputs (isolated from the raw NASA files)."""
from __future__ import annotations

import math
from pathlib import Path

import pytest

from app.ingest import bass2, flex
from app.ingest.values import (APPROXIMATE, BLANK, DASH, LOWER_BOUND, NONE, OVER_RANGE, PRESENT, RANGE, SEQUENCE,
                               UPPER_BOUND, parse_number_cell, parse_sequence_cell)
from app.services import analytics
from app.services.similarity import distance


# ------------------------------------------------------------ value parser --
@pytest.mark.parametrize("raw,kind,value,low,high", [
    ("12.5", PRESENT, 12.5, 12.5, 12.5), ("", BLANK, None, None, None), ("–", DASH, None, None, None),
    ("none", NONE, None, None, None), ("OR", OVER_RANGE, None, None, None), ("over", OVER_RANGE, None, None, None),
    (">500", LOWER_BOUND, None, 500, None), ("<1", UPPER_BOUND, None, None, 1), ("~6", APPROXIMATE, 6, 6, 6),
    ("~ 21.5", APPROXIMATE, 21.5, 21.5, 21.5), ("21.5 - 21.7", RANGE, None, 21.5, 21.7), ("-1", PRESENT, -1, -1, -1),
    ("0", PRESENT, 0, 0, 0),
])
def test_parse_number_cell(raw, kind, value, low, high):
    pv = parse_number_cell(raw)
    assert pv.kind == kind and pv.value == value and pv.low == low and pv.high == high
    assert pv.raw == raw  # raw text is always preserved


def test_missing_markers_are_distinct():
    kinds = {parse_number_cell(x).kind for x in ("", "–", "none", "0", "-1", "OR", "over", ">500", "~6")}
    # blank, dash, none, present ('0','-1'), over_range ('OR','over'), lower_bound, approximate
    assert len(kinds) == 7


def test_sequence_preserved_not_averaged():
    pv = parse_sequence_cell("1.7 (52)   1.25   0.9   0.6")
    assert pv.kind == SEQUENCE and pv.value is None
    assert pv.tokens == ["1.7 (52)", "1.25", "0.9", "0.6"]
    assert parse_sequence_cell("250>50>250").kind != PRESENT
    assert parse_sequence_cell("62").value == 62


# ------------------------------------------------------ synthetic FLEX CSV --
FLEX_HEADER = ("FLEX Test #,FLEX Identifier,Test Date,Test GMT,Fuel,Ambient pressure; mmHg,"
               "O initial ambient composition; mole fraction,N initial ambient composition; mole fraction,"
               "CO initial ambient composition; mole fraction,He initial ambient composition; mole fraction,"
               "Droplet initial diameter; mm,Visible flame extinction diameter; mm,Burning rate; mm,Burn time; s,"
               "Test end")


def _write_flex(tmp: Path, rows: list[str]) -> Path:
    p = tmp / "FLEX"
    p.mkdir(parents=True)
    (p / "PSI-69_Experimental table_FLEX.csv").write_bytes(("\r\n".join([FLEX_HEADER] + rows) + "\r\n").encode("cp1252"))
    return tmp


def test_flex_cp1252_dash_blank_approx_and_duplicates(tmp_path):
    rows = [
        "1,193F001,7/12/09,12:00:00,Methanol,760,0.21,0.79,0,0,3.0,1.5,0.5,13.5,Extinction",
        "2,193F001,7/12/2009,12:00:00,Methanol,760,0.21,0.79,0,0,3.1,–,0.5,~6,Disruption",
        "3,C11M201,1/1/2011,1:00:00,Heptane,0,0.18,0.70,0.10,0,2.0,,0.6,5,Completion",
        "4,C13H102,1/1/2011,1:00:00,Heptane,540,0.15,0.6,0.25,0,3.33,3.34,0.33,0.55,Extinction",
    ]
    recs, flags, rep = flex.ingest(_write_flex(tmp_path, rows))
    assert [r.experiment_uid for r in recs] == ["flex:1", "flex:2", "flex:3", "flex:4"]
    assert recs[0].display_id == recs[1].display_id == "193F001"  # duplicate id, distinct uid
    assert recs[1].normalized["dext_kind"] == DASH and recs[2].normalized["dext_kind"] == BLANK
    assert recs[1].normalized["burn_time_kind"] == APPROXIMATE
    assert recs[2].normalized["diluent"] == "CO2" and recs[2].normalized["x_co2"] == 0.10
    rules = [(f.rule_id, f.experiment_uid) for f in flags]
    assert ("FLEX-DUP-ID", "flex:1") in rules and ("FLEX-DUP-ID", "flex:2") in rules
    assert ("FLEX-P-ZERO", "flex:3") in rules
    assert ("FLEX-DEXT-GT-D0", "flex:4") in rules
    assert ("FLEX-MOLE-SUM", "flex:3") in rules  # 0.98
    assert ("FLEX-DATE-2DIGIT", "flex:1") in rules
    assert any(f.rule_id == "FLEX-HDR-CO2" for f in flags) and any(f.rule_id == "FLEX-UNIT-K" for f in flags)
    # raw header strings and raw cells are retained exactly
    assert recs[1].raw_pairs[11] == ("Visible flame extinction diameter; mm", "–")
    co_obs = [o for o in recs[2].observations if o.raw_field.startswith("CO initial")][0]
    assert co_obs.normalized_name == "x_co2_initial" and "CO2" in co_obs.derivation_note
    k_obs = [o for o in recs[0].observations if o.raw_field == "Burning rate; mm"][0]
    assert k_obs.unit_raw == "mm" and k_obs.unit_normalized == "mm^2/s"


# ----------------------------------------------------- synthetic BASS CSV --
BASS_HEADER = list(bass2.COLUMN_SPEC) + list(bass2.GAS_COLS)


def test_bass_gmt_doy_fan_and_gases(tmp_path):
    import csv
    import io
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(BASS_HEADER)
    w.writerow(["Olson", "O10", "7/22/2014", "213", "210m", '1/4" clear rod', "2", "49  44  41   122 (1.3   0.7)",
                "5  2   0   max", "250", "172", "16.7", "16.1", "1.61", "2.1", "94", "OR"])
    w.writerow(["Miller", "M5", "2/20/2014", "51", "167", "3 mm thick PMMA   2 sided   2 cm thick", "0", "",
                "20  13  10  8  5", "50", "300+   +102", "22.2", "19", "0.44", "3.22", "9", ">500"])
    w.writerow(["Bhattacharjee", "B2", "2/19/2014", "50", "155", "200 micron PMMA film   2 cm wide", "2", "62", "5",
                "50", "none", "22.2", "1.6", "0.44", "", "6", ""])
    d = tmp_path / "BASS-II"
    d.mkdir()
    (d / "PSI-25_Experimental table_BASS-II.csv").write_text(buf.getvalue(), encoding="utf-8-sig")
    recs, flags, _ = bass2.ingest(tmp_path)
    o10, m5, b2 = (r.normalized for r in recs)
    assert o10["gmt_doy"] == 213 and o10["date_doy"] == 203  # GMT is a day-of-year, mismatching the date
    assert o10["fan_kind"] == SEQUENCE and o10["air_single_cm_s"] is None
    assert o10["co_final"] is None and o10["co_final_kind"] == OVER_RANGE
    assert m5["co_final_kind"] == LOWER_BOUND and m5["material_class"] == "PMMA slab"
    assert m5["thickness_mm"] == 3.0 and m5["sides"] == "2 sided" and m5["width_cm"] == 2.0
    assert b2["material_class"] == "PMMA thin film" and b2["thickness_mm"] == 0.2
    assert b2["air_single_cm_s"] == 5.0
    rules = {(f.rule_id, f.experiment_uid) for f in flags}
    assert ("BASS-GMT-DOY-MISMATCH", "bass2:1") in rules
    assert ("BASS-O2-UNPHYSICAL", "bass2:3") in rules and ("BASS-O2-UNPHYSICAL", "bass2:2") not in rules
    assert ("BASS-CO-OVER-RANGE", "bass2:1") in rules


# ----------------------------------------------------------- d2-law maths --
def _row(**kw):
    base = dict(experiment_uid="flex:x", identifier="X", fuel="Methanol", diluent="N2-only", test_end="Extinction",
                d0_mm=3.0, d0_kind="present", dext_mm=1.0, dext_kind="present", k_mm2_s=0.5, k_kind="present",
                burn_time_s=16.0, burn_time_kind="present", x_o2=0.21)
    base.update(kw)
    return base


def test_d2_known_case():
    r = analytics.d2_record(_row())
    assert r["included"] and r["t_est_s"] == pytest.approx((9 - 1) / 0.5)  # 16 s
    assert r["ratio"] == pytest.approx(1.0) and r["outlier"] is False


def test_d2_completion_assumes_zero_endpoint():
    r = analytics.d2_record(_row(test_end="Completion", dext_mm=None, dext_kind="blank", burn_time_s=18.0))
    assert r["included"] and r["d_end_mm"] == 0.0 and r["t_est_s"] == pytest.approx(18.0)
    assert any("assumed 0" in a for a in r["assumptions"])


@pytest.mark.parametrize("kw,reason", [
    (dict(test_end="Disruption"), "Disruption"), (dict(dext_mm=3.4), "D_end > D0"),
    (dict(burn_time_kind="approximate"), "approximate"), (dict(k_mm2_s=None, k_kind="blank"), "K not numeric"),
    (dict(dext_mm=None, dext_kind="dash"), "Extinction without numeric Dext"), (dict(k_mm2_s=0.0), "K <= 0"),
])
def test_d2_exclusions(kw, reason):
    r = analytics.d2_record(_row(**kw))
    assert not r["included"] and any(reason in x for x in r["reasons"])


def test_gas_math_helpers():
    assert analytics.slope_through_origin([1, 2, 3], [0.8, 1.6, 2.4]) == pytest.approx(0.8)
    assert analytics.pearson([1, 2, 3, 4], [2, 4, 6, 8]) == pytest.approx(1.0)
    assert analytics.pearson([1, 2], [1, 2]) is None
    assert analytics.PMMA_STOICH == pytest.approx(5 / 6)


# --------------------------------------------------------------- similarity --
def test_similarity_null_aware_and_no_outcomes():
    ranges = {"x_o2": 0.2, "x_co2": 0.7, "x_he": 0.45, "pressure_atm": math.log(3 / 0.7), "d0_mm": 3.5}
    a = dict(fuel="Methanol", diluent="CO2", x_o2=0.2, x_co2=0.05, x_he=0, pressure_atm=1.0, d0_mm=3.0, burn_time_s=1)
    b = dict(fuel="Methanol", diluent="CO2", x_o2=0.2, x_co2=0.05, x_he=0, pressure_atm=1.0, d0_mm=3.0, burn_time_s=99)
    d, parts = distance(a, b, "flex", ranges)
    assert d == 0  # outcome (burn time) differs but is not a feature
    assert "burn_time_s" not in {p["field"] for p in parts}
    c = dict(b, fuel="Heptane", d0_mm=None)
    d2, parts2 = distance(a, c, "flex", ranges)
    assert d2 > 0 and [p for p in parts2 if p["field"] == "d0_mm"][0]["used"] is False

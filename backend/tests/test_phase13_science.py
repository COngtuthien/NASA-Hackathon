"""Phase 13 scientific validation: counts, provenance, units, censoring, discrepancies and integrity rules for the
seven new investigations. Content checks, not just HTTP 200.

Curated-JSON tests always run (the derivatives are committed). Tests that re-read the NASA source folders are
skipped when those folders are absent (a clean clone).
"""
from __future__ import annotations

import json
from collections import Counter
from pathlib import Path

import pytest

from .conftest import REPO, requires_db

CUR = REPO / "processed" / "curated" / "phase13"
HAS_SOURCES = all((REPO / d).is_dir() for d in ("ACME CFI-G", "ACME Flame Design", "ACME BRE", "SAME", "PSI-117"))
requires_sources = pytest.mark.skipif(not HAS_SOURCES, reason="local NASA source folders not present")


def ds(name: str) -> dict:
    return json.loads((CUR / f"{name}.json").read_text(encoding="utf-8"))


def vals(name: str) -> list[dict]:
    return [r["values"] for r in ds(name)["records"]]


# ------------------------------------------------------------------------------------------------- CFI-G -------
def test_cfig_row_counts_and_separation():
    d = ds("cfig_tests")
    assert d["counts"]["source_records"] == 333 and d["counts"]["processed_records"] == 333
    assert d["counts"]["excluded_reasons"] == {"blank CSV rows (not records)": 861}
    cfg = Counter(v["configuration"] for v in vals("cfig_tests"))
    assert cfg == {"normal": 179, "inverse": 154}
    # every record keeps its file of origin, which matches its configuration
    for r in d["records"]:
        assert r["values"]["configuration"] in r["provenance"]["source_file"].lower().replace("flames", "")
        assert r["provenance"]["source_row"] >= 1 and r["raw"]["Test"]


def test_cfig_outcomes_and_censoring():
    v = vals("cfig_tests")
    out = Counter((x["configuration"], x["outcome"]) for x in v)
    assert out[("normal", "self_extinguished")] == 102 and out[("normal", "flow_terminated")] == 30
    assert out[("normal", "not_ignited")] == 46 and out[("normal", "no_hot_ignition_flow_terminated")] == 1
    assert out[("inverse", "self_extinguished")] == 73 and out[("inverse", "flow_terminated")] == 58
    assert out[("inverse", "flash_self_extinguished")] == 8 and out[("inverse", "not_ignited")] == 15
    for x in v:
        assert x["burn_time_censored"] == (x["termination"] == "FT")
        if x["outcome"] == "not_ignited":
            assert x["burn_time_s"] in (0.0, None)


def test_cfig_spreadsheet_errors_and_artifacts_flagged_not_repaired():
    d = ds("cfig_tests")
    by = {r["test_id"]: r for r in d["records"]}
    for tid in ("21125A4", "21125H3"):           # #DIV/0! in Tad/Zst (zero fuel flow)
        assert by[tid]["raw"]["Tad (K)"] == "#DIV/0!" and by[tid]["values"]["tad_k"] is None
        assert "CFIG-SPREADSHEET-ERROR" in by[tid]["flags"]
    for tid in ("21242F4", "21242P2"):           # #VALUE! in peak burner temperature (K)
        assert by[tid]["raw"]["Peak burner temp (K)"] == "#VALUE!" and by[tid]["values"]["peak_burner_t_k_csv"] is None
    t = by["21265H3"]                             # 273.15 K from an empty °C cell
    assert t["raw"]["Peak burner temp (K)"] == "273.15" and t["values"]["peak_burner_t_k_csv"] is None
    assert "CFIG-273K-ARTIFACT" in t["flags"]
    limit = [r for r in d["records"] if r["values"].get("color") == "limit"]
    assert len(limit) == 29 and all("CFIG-COLOR-LIMIT-UNDEFINED" in r["flags"] for r in limit)
    pci = [r for r in d["records"] if r["values"].get("pci_label") not in (None, "PCI-hot")]
    assert len(pci) == 7 and all("CFIG-PCI-LABEL-UNDEFINED" in r["flags"] for r in pci)
    # undefined labels are kept verbatim, never interpreted
    assert {r["values"]["pci_label"] for r in pci} == {f"PCI-{c}" for c in "ABCDEFG"}


def test_cfig_units_and_ids():
    d = ds("cfig_tests")
    spec = {s["field"]: s for s in d["field_specs"]}
    assert spec["p_bar"]["unit"] == "bar" and spec["p_atm"]["transform"] == "bar / 1.01325"
    assert spec["m_fuel_mg_s"]["unit"] == "mg/s" and spec["burn_time_s"]["unit"] == "s"
    for r in d["records"]:
        v = r["values"]
        if v["p_bar"] is not None:
            assert abs(v["p_atm"] * 1.01325 - v["p_bar"]) < 1e-4
        assert r["test_id"] == v["test_id_raw"].replace(" ", "")      # identity preserved, spacing only
    assert len({r["record_id"] for r in d["records"]}) == 333


def test_cfig_cool_flames_table3():
    d = ds("cfig_cool_flames")
    assert d["counts"]["processed_records"] == 15
    assert all(r["verification"] == "verified_against_pdf_text" and r["provenance"]["page_pdf"] == 46 for r in d["records"])
    tids = [r["test_id"] for r in d["records"]]
    assert "21174D13" not in tids and "21174D1" in tids
    d1 = next(r for r in d["records"] if r["test_id"] == "21174D1")
    assert d1["values"]["r_cool_mm"] is None and d1["values"]["r_hot_mm"] == 13.9 and "CFIG-T3-FOOTNOTE3" in d1["flags"]
    for r in d["records"]:                        # the narrow condition set is preserved
        v = r["values"]
        assert v["x_f"] == 0.3 and v["p_bar"] == 2.03 and 0.75 <= v["m_fuel_mg_s"] <= 1.5 and 0.38 <= v["x_o2"] <= 0.4
    assert d["extra"]["cross_check"]["match"] is True and d["extra"]["cross_check"]["tests"] == 7


def test_cfig_report_vs_csv_counts_kept_separately():
    t = ds("cfig_test_days")
    assert t["counts"]["processed_records"] == 23
    rt = t["extra"]["report_totals"]
    assert rt["hot_flames_tables_1_2"] == 280 == rt["report_text_hot_flames"]
    assert rt["report_text_radiative_extinctions"] == 189 and rt["csv_self_extinguished"] == 183
    assert rt["csv_rows"] == 333 and rt["csv_rows"] != rt["report_text_hot_flames"]
    assert "neither is adjusted" in rt["why_counts_differ"]


# -------------------------------------------------------------------------------------------------- SAME -------
def test_same_particle_sizes():
    d = ds("same_particle_sizes")
    assert d["counts"]["processed_records"] == 8
    v = vals("same_particle_sizes")
    assert Counter(x["material"] for x in v) == {"kapton": 2, "lampwick": 2, "silicone": 2, "teflon": 2}
    assert Counter(x["aged"] for x in v) == {True: 4, False: 4}
    spec = {s["field"]: s for s in d["field_specs"]}
    assert spec["dg_nm"]["unit"] == spec["d10_nm"]["unit"] == spec["d30_nm"]["unit"] == "nm"
    k = next(x for x in v if x["material"] == "kapton" and not x["aged"])
    assert (k["dg_nm"], k["d10_nm"], k["d30_nm"], k["sigma_g"]) == (80, 105, 179, 2.08)
    assert all(r["verification"] == "verified_against_pdf_text" for r in d["records"])


def test_same_other_sources_not_reconciled():
    o = ds("same_particle_sizes_other_sources")
    teflon_d10 = {r["provenance"]["source_table"]: r["values"].get("d10_nm") for r in o["records"] if r["values"]["material"] == "teflon"
                  and not r["values"]["aged"]}
    # Table 1 says 205 nm; other documents print 205, 158, 223 and 111 (µm values x 1000): all kept, none merged
    assert sorted(x for x in teflon_d10.values() if x is not None) == [111.0, 158, 205.0, 223]
    assert any(f["rule_id"] == "SAME-SIZE-SOURCES-DIFFER" for f in o["flags"])


def test_same_flight_log():
    d = ds("same_flight_log")
    tests = [r for r in d["records"] if r["values"]["kind"] == "test"]
    assert len(tests) == 47 and [r["values"]["test_number"] for r in tests] == list(range(1, 48))
    assert d["extra"]["summary"]["by_sample"] == {"silicone": 6, "dbp": 22, "teflon": 7, "lampwick": 6, "kapton": 6}
    assert all(r["verification"] == "verified_against_pdf_text" for r in d["records"])
    t8 = next(r for r in tests if r["values"]["test_number"] == 8)
    assert t8["values"]["sample"] == "kapton" and t8["values"]["gmt_day"] == 257


def test_same_no_silent_sentinel_handling():
    t = ds("same_telemetry_inventory")
    assert t["counts"]["source_records"] == 59 and t["counts"]["excluded_records"] == 59
    assert all(r["verification"] == "listed_only" and set(r["values"]) >= {"folder_label", "file"} for r in t["records"])
    assert any(f["rule_id"] == "SAME-TELEMETRY-DEFERRED" and f["status"] == "unresolved" for f in t["flags"])


# ------------------------------------------------------------------------------------------------- PSI-117 ------
def test_psi117_files_roles_units():
    d = ds("psi117_series")
    assert d["counts"]["files"] == 9 and len([s for s in d["sources"] if s["role"] == "figure_data"]) == 9
    roles = Counter(r["values"]["role"] for r in d["records"])
    assert roles["experiment"] > 0 and roles["model"] > 0 and roles["excluded"] == 1 and roles["uncertainty_undocumented"] == 2
    for r in d["records"]:
        v = r["values"]
        assert v["y_unit_status"] in ("header", "documented", "inferred", "unknown", "dimensionless")
        if v["y_unit_status"] == "unknown":
            assert v["y_unit"] == "unknown" and "PSI117-UNIT-UNKNOWN" in r["flags"]
        if v["role"] == "experiment":
            assert v["evidence_class"] == "digitized_figure"
        if v["role"] in ("model", "model_only_quantity"):
            assert v["evidence_class"] == "model_prediction"
        if v["role"] in ("excluded", "uncertainty_undocumented"):
            assert v["figure"] is None                      # never drawn


def test_psi117_negative_values_flagged_and_kept():
    d = ds("psi117_series")
    by = {r["values"]["series_id"]: r for r in d["records"]}
    dfr = by["I-exp-dfr"]["values"]
    i = dfr["flagged_points"]["negative_y"][0]
    assert dfr["y"][i] < 0 and "PSI117-NEGATIVE-PHYSICAL" in by["I-exp-dfr"]["flags"]
    assert by["I-exp-d2"]["values"]["flagged_points"]["negative_x"]          # pre-ignition times kept
    assert by["G-C12-exp-cf"]["values"]["flagged_points"]["zero_y"]          # zeros kept, flagged undefined


def test_psi117_no_flex_join_and_no_cfd_claim():
    d = ds("psi117_series")
    rules = {f["rule_id"]: f for f in d["flags"]}
    assert "PSI117-NO-FLEX-JOIN" in rules and "PSI117-NOT-3D-CFD" in rules
    for r in d["records"]:
        assert r["test_id"] is None and "flex:" not in json.dumps(r["values"])


# -------------------------------------------------------------------------------------------- Flame Design ------
def test_flame_design_conditions_only():
    d = ds("fd_conditions")
    v = vals("fd_conditions")
    assert Counter(x["configuration"] for x in v) == {"normal": 207, "inverse": 120}
    assert d["evidence_class"] == "test_condition"
    forbidden = {"burn_time_s", "outcome", "hot_ignition", "extinction", "flame_radius", "soot"}
    assert all(not (forbidden & set(x)) for x in v)
    assert any(f["rule_id"] == "FD-CONDITIONS-ONLY" for f in d["flags"])
    for x in v:
        if x["p_mean_atm"] is not None:
            assert abs(x["p_mean_bar"] - x["p_mean_atm"] * 1.01325) < 1e-4
    assert sum(1 for x in v if x["flow_marker"]) == 71


def test_flame_design_days():
    d = ds("fd_test_days")
    assert d["counts"]["processed_records"] == 23 and d["extra"]["totals"]["table1_flames"] == 326
    assert all(r["verification"] == "verified_against_pdf_text" for r in d["records"])


# --------------------------------------------------------------------------------------------------- BRE -------
def test_bre_days_and_corrections():
    d = ds("bre_test_days")
    assert d["counts"]["processed_records"] == 18
    assert d["extra"]["totals"]["table1_flames"] == 194 == d["extra"]["totals"]["round1"] + d["extra"]["totals"]["round2"]
    conflicts = [f for f in d["flags"] if f["rule_id"] == "BRE-CSV-DATE"]
    assert {c["test_id"] for c in conflicts} == {"20261", "20279"}
    assert {c["raw_value"] for c in conflicts} == {"2020-10-17", "2020-12-05"}
    by = {r["test_id"]: r["values"] for r in d["records"]}
    assert by["20261"]["date"] == "2020-09-17" and by["20279"]["date"] == "2020-10-05"
    assert by["20279"]["fuel"] == "CH4"
    assert len([f for f in d["flags"] if f["rule_id"] == "BRE-CSV-PERCENT-FORMAT"]) == 2


def test_registry_identities():
    reg = {v["investigation_id"]: v for v in vals("investigation_registry")}
    assert set(reg) == {"PSI-69", "PSI-25", "PSI-98", "PSI-117", "PSI-102", "PSI-68", "PSI-62", "PSI-159", "PSI-10", "PSI-20"}
    assert reg["PSI-159"]["doi"] == "10.60555/cyt1-kh64" and reg["PSI-10"]["doi"] == "10.60555/w4zy-bt45"
    assert reg["PSI-20"]["doi"] == "10.60555/vb93-3y72" and reg["PSI-62"]["readiness"] == "metadata_only"
    assert reg["PSI-10"]["folder"] == "ACME Flame Design" and reg["PSI-10"]["readiness"] == "conditions_only"
    for v in reg.values():
        assert v["route"].startswith("/phenomena/") and v["limitations"] and v["scenario"]


# --------------------------------------------------------------------------------- reproducibility vs sources --
@requires_sources
def test_processing_is_reproducible_from_sources():
    from app.ingest.phase13 import acme_other, cfig, psi117, same
    repo = REPO
    fresh = {d.dataset_id: d.to_json() for d in cfig.build(repo) + acme_other.build(repo) + same.build(repo)
             + psi117.build(repo)}
    for name, d in fresh.items():
        assert json.loads(json.dumps(d)) == ds(name), f"{name} differs from the committed curated JSON"


@requires_sources
def test_source_hashes_recorded():
    from app.ingest.common import sha256_file
    for f in CUR.glob("*.json"):
        if f.name == "processing_report.json":
            continue
        for s in json.loads(f.read_text(encoding="utf-8"))["sources"]:
            assert sha256_file(REPO / s["path"]) == s["sha256"], s["path"]


# ------------------------------------------------------------------------------------------------- API -------
@requires_db
def test_api_cfig_aggregates(client):
    j = client.get("/api/v1/gasflames/cfig", params={"configuration": "normal"}).json()
    assert j["n_matching"] == 179 and sum(b["n"] for b in j["by_fuel"]) == 179
    se = {b["fuel"]: b for b in j["burn_time_se"]}
    # SE burn times only (censored FT rows are reported separately)
    assert se["ethane"]["n"] == 30 and se["propane"]["n"] == 34 and se["n-butane"]["n"] == 38
    assert all(b["configuration"] == "normal" for b in j["burn_time_censored"])
    assert len(j["cool_flames"]) == 15 and j["report_totals"]["report_text_hot_flames"] == 280
    j2 = client.get("/api/v1/gasflames/cfig", params={"configuration": "inverse", "fuel": "n-butane"}).json()
    assert j2["n_matching"] == 58 and all(t["configuration"] == "inverse" for t in j2["tests"])
    assert client.get("/api/v1/gasflames/cfig", params={"fuel": "hydrogen"}).status_code == 422
    t = client.get("/api/v1/gasflames/cfig/test/21174 C3").json()
    assert {r["dataset_id"] for r in t["records"]} == {"cfig_tests", "cfig_cool_flames"}


@requires_db
def test_api_other_sections(client):
    fd = client.get("/api/v1/gasflames/flame-design").json()
    assert fd["n_total"] == 327 and fd["n_plotted"] + sum(fd["excluded"].values()) == 327
    assert all("outcome" not in p for p in fd["points"])
    bre = client.get("/api/v1/gasflames/bre").json()
    assert bre["totals"]["table1_flames"] == 194 and len(bre["test_days"]) == 18
    s = client.get("/api/v1/smoke/same").json()
    assert len(s["particle_sizes"]) == 8 and s["log_summary"]["tests"] == 47 and s["telemetry"]["status"] == "deferred"
    p = client.get("/api/v1/flex/psi117", params={"figure": "ext-vs-p"}).json()
    assert {x["role"] for x in p["series"]} == {"experiment", "model"} and len(p["series"]) == 4
    assert client.get("/api/v1/flex/psi117", params={"figure": "nope"}).status_code == 404
    reg = client.get("/api/v1/registry").json()
    assert len(reg["items"]) == 10 and set(reg["scenarios"]) == {"material_flame_spread", "gaseous_flame_behavior",
                                                                 "early_smoke_detection", "droplet_flame_extinction"}


@requires_db
def test_new_documents_retrievable(client):
    docs = {d["document_id"]: d for d in client.get("/api/v1/documents").json()["items"]}
    if "psi-159-reports-finalrpt-acme-cfi-g" not in docs:
        pytest.skip("Phase 13 documents not indexed (source folders absent at ingest)")
    for q, doc in [("spherical cool diffusion flames n-butane 2 bar", "psi-159-reports-finalrpt-acme-cfi-g"),
                   ("critical extinction temperature 1130 K spherical diffusion flames", "psi-10-reports-finalrpt-acmeflamedesign"),
                   ("Burning Rate Emulator quasi-steady burning oxygen 0.265", "bre-final-report-20220201"),
                   ("smoke particle size aging Kapton Teflon moment method", "same-final-science-report-03-18-10-with-papers-attached")]:
        res = client.get("/api/v1/evidence/search", params={"q": q, "limit": 10}).json()["results"]
        assert any(r.get("document_id") == doc for r in res), (q, [r.get("document_id") for r in res])

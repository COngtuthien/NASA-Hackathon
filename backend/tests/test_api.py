"""API integration tests against a temp copy of the generated DB (external HTTP mocked)."""
from __future__ import annotations

import csv
import io
import json

import pytest

from .conftest import REPO, requires_db

pytestmark = requires_db


# ------------------------------------------------------- Gate 0: sources ---
def test_snapshot_counts(client):
    h = client.get("/api/v1/health").json()
    c = h["database"]["counts"]
    assert (c["flex_burns"], c["bass2_burns"], c["saffire1_burns"], c["saffire1_image_sets"]) == (274, 129, 2, 2)
    assert h["llm"]["mode"] == "retrieval_only"
    import app.providers.llm as llm_mod
    llm_mod._override_set = False  # real configuration path: no key in the test environment
    try:
        st = llm_mod.llm_status()
        assert st["configured"] is False and "LLM_API_KEY" in st["reason"] and llm_mod.get_llm() is None
    finally:
        llm_mod.set_llm(None)
    o = client.get("/api/v1/overview").json()
    assert o["counts"]["total_burn_rows"] == 405
    assert {i["short_name"]: i["burns"] for i in o["investigations"]} == {"FLEX": 274, "BASS-II": 129, "SAFFIRE-I": 2}


def test_source_files_unchanged():
    """Raw NASA files must hash exactly as recorded at ingestion (no mutation)."""
    from app.ingest.common import sha256_file
    manifest = json.loads((REPO / "processed" / "source_manifest.json").read_text(encoding="utf-8"))
    for e in manifest:
        assert sha256_file(REPO / e["relative_path"]) == e["sha256"], e["relative_path"]


# ----------------------------------------------------------- experiments ---
def test_list_filter_sort_paginate(client):
    r = client.get("/api/v1/experiments", params={"dataset": "flex", "f_fuel": "Methanol", "max_x_o2": 0.1749,
                                                  "sort": "x_o2", "order": "desc", "page_size": 20})
    j = r.json()
    assert r.status_code == 200 and j["total"] == 54 and len(j["items"]) == 20 and j["pages"] == 3
    xs = [i["fields"]["x_o2"] for i in j["items"]]
    assert xs == sorted(xs, reverse=True) and max(xs) < 0.175
    p3 = client.get("/api/v1/experiments", params={"dataset": "flex", "f_fuel": "Methanol", "max_x_o2": 0.1749,
                                                   "page": 3, "page_size": 20}).json()
    assert len(p3["items"]) == 14
    assert "fuel" in j["facets"] and j["facets"]["x_o2"]["n"] == 274


@pytest.mark.parametrize("params,code", [
    ({"dataset": "nope"}, 400), ({"dataset": "flex", "bogus": "1"}, 400), ({"dataset": "flex", "min_fuel": "1"}, 400),
    ({"dataset": "flex", "min_x_o2": "abc"}, 400), ({"dataset": "flex", "page_size": "1000"}, 400),
    ({"dataset": "flex", "sort": "drop table"}, 400), ({"dataset": "flex", "page": "x"}, 422),
])
def test_list_invalid(client, params, code):
    r = client.get("/api/v1/experiments", params=params)
    assert r.status_code == code and "error" in r.json() and r.json()["error"]["request_id"]


def test_duplicate_identifier_distinct_urls(client):
    a, b = client.get("/api/v1/experiments/flex:70").json(), client.get("/api/v1/experiments/flex:73").json()
    assert a["display_id"] == b["display_id"] == "193F001"
    assert a["normalized"]["k_mm2_s"] != b["normalized"]["k_mm2_s"]
    assert a["duplicate_display_ids"][0]["experiment_uid"] == "flex:73"
    assert a["source"]["source_row"] == 70 and a["source"]["csv_line"] == 71
    assert any(f["rule_id"] == "FLEX-DUP-ID" for f in a["quality_flags"])


def test_detail_raw_and_normalized(client):
    d = client.get("/api/v1/experiments/bass2:59").json()  # O10
    raw = {f["header"]: f["value"] for f in d["raw_fields"]}
    assert raw["GMT"] == "213" and d["normalized"]["gmt_doy"] == 213 and d["normalized"]["date_doy"] == 203
    gmt = [o for o in d["observations"] if o["raw_field"] == "GMT"][0]
    assert gmt["unit_normalized"] == "day of year"
    assert "Calibrated  initial O2 % by vol " in raw  # exact original header with spaces
    assert client.get("/api/v1/experiments/flex:9999").status_code == 404
    assert client.get("/api/v1/experiments/unknown:1").status_code == 404


def test_saffire_image_sets_not_burns(client):
    j = client.get("/api/v1/experiments", params={"dataset": "saffire1"}).json()
    assert j["total"] == 2 and {i["display_id"] for i in j["items"]} == {"S1", "S2"}
    d = client.get("/api/v1/experiments/saffire1:S1").json()
    assert {s["label"] for s in d["image_sets"]} == {"F1", "F2"}
    f2 = [s for s in d["image_sets"] if s["label"] == "F2"][0]
    assert f2["csv_role"].startswith("pre-test") and f2["documented_role"].startswith("post-test")


def test_compare_same_and_cross(client):
    j = client.post("/api/v1/experiments/compare", json={"uids": ["bass2:31", "bass2:30"]}).json()
    assert j["compatible"] and "co2_final" in j["chartable_fields"]
    co2 = [f for f in j["fields"] if f["name"] == "co2_final"][0]
    assert co2["values"] == [3.22, 2.15] and co2["delta_vs_first"][1] == pytest.approx(-1.07)
    x = client.post("/api/v1/experiments/compare", json={"uids": ["flex:1", "bass2:31"]}).json()
    assert x["mode"] == "cross_investigation_qualitative" and x["chart"] is None and x["fields"] == []
    assert client.post("/api/v1/experiments/compare", json={"uids": ["flex:1"]}).status_code == 422
    assert client.post("/api/v1/experiments/compare", json={"uids": ["flex:1", "flex:1"]}).status_code == 400
    assert client.post("/api/v1/experiments/compare", json={"uids": ["flex:1", "flex:99999"]}).status_code == 404


def test_export_csv(client):
    r = client.get("/api/v1/exports/experiments.csv", params={"dataset": "bass2", "f_pi": "Miller",
                                                               "variant": "original"})
    rows = list(csv.reader(io.StringIO(r.text)))
    assert r.status_code == 200 and len(rows) == 21 and rows[0][:4] == ["experiment_uid", "source_file",
                                                                        "source_sha256", "source_row"]
    assert "Calibrated  initial O2 % by vol " in rows[0]
    n = client.get("/api/v1/exports/experiments.csv", params={"dataset": "flex", "f_fuel": "Heptane"}).text
    assert len(list(csv.reader(io.StringIO(n)))) == 118 and "k_mm2_s [mm^2/s]" in n.splitlines()[0]


# -------------------------------------------------------------- evidence ---
@pytest.mark.parametrize("q,doc,page", [
    ("M5", "bass-ii-summary-report", None), ("BASS-II Table 5.1", "bass-ii-summary-report", 65),
    ("SIBAL", "bass-ii-summary-report", None), ("FLEX d²-law", None, None),
])
def test_evidence_acceptance_queries(client, q, doc, page):
    j = client.get("/api/v1/evidence/search", params={"q": q, "limit": 5}).json()
    assert j["results"], q
    top = j["results"]
    if doc:
        assert any(r["document_id"] == doc for r in top)
    if page:
        assert any(r["page_pdf"] == page for r in top)
    for r in top:
        chunk = client.get(f"/api/v1/evidence/{r['chunk_id']}").json()
        assert r["snippet"] in chunk["text"]  # snippet is verbatim
        assert r["reasons"] and r["rank_label"] in ("High relevance", "Related background")
    if q == "FLEX d²-law":
        assert any(r["investigation_id"] == "PSI-69" for r in top)


def test_evidence_errors_and_doc_file(client):
    assert client.get("/api/v1/evidence/search", params={"q": ""}).status_code == 400
    assert client.get("/api/v1/evidence/nope:p1:0").status_code == 404
    docs = client.get("/api/v1/documents").json()["items"]
    assert len(docs) == 20
    pdf = client.get("/api/v1/documents/saffire-i-operations/file")
    assert pdf.status_code == 200 and pdf.content[:4] == b"%PDF"
    assert client.get("/api/v1/documents/../../etc/passwd/file").status_code == 404
    meta = client.get("/api/v1/documents/bass-ii-summary-report").json()
    assert meta["printed_page_offset"] == 8 and 65 in meta["pages_indexed"]


# ------------------------------------------------------------- analytics ---
def test_flex_analytics(client):
    m = client.get("/api/v1/analytics/flex/map", params={"fuel": "Methanol"}).json()
    assert m["n_total"] == 157 and m["n_plotted"] + len(m["excluded"]) == 157
    assert all(p["fuel"] == "Methanol" for p in m["points"])
    d = client.get("/api/v1/analytics/flex/d2").json()
    s = d["summary"]
    assert s["n_included"] + s["n_excluded"] == 274 and 0.95 < s["median_ratio"] < 1.15
    assert "NOT an independent prediction" in d["label"]
    one = client.get("/api/v1/analytics/flex/d2", params={"uid": "flex:129"}).json()["record"]
    assert not one["included"] and any("D_end > D0" in r for r in one["reasons"])


def test_bass_and_saffire_analytics(client):
    g = client.get("/api/v1/analytics/bass/gases").json()
    s = g["summary"]
    assert s["n_excluded_unphysical"] == 5 and s["pearson_r"] > 0.95
    assert 0.7 < s["slope_co2_per_o2_above_resolution"] < 0.9
    m5 = [r for r in g["records"] if r["test_id"] == "M5"][0]
    assert m5["delta_co"] is None and m5["raw"]["co_final"] == ">500" and m5["kinds"]["co_final"] == "lower_bound"  # '>500' not parsed as number
    case = client.get("/api/v1/analytics/saffire/case").json()
    s1 = [m for m in case["manifest"] if m["set_label"] == "Sample1" and m["camera"] == "S1C1"][0]
    assert s1["frames"] == 18124 and s1["jpeg_received"] == 14388
    t = client.get("/api/v1/analytics/saffire/timeline", params={"bin_s": 60}).json()
    assert t["series"] and "not a physical measurement" in t["note"].lower()
    assert client.get("/api/v1/analytics/saffire/timeline", params={"bin_s": 7}).status_code == 400


# ---------------------------------------------------- similarity, quality ---
def test_similarity_deterministic(client):
    a = client.get("/api/v1/experiments/flex:145/similar", params={"k": 5}).json()
    b = client.get("/api/v1/experiments/flex:145/similar", params={"k": 5}).json()
    assert [r["experiment_uid"] for r in a["results"]] == [r["experiment_uid"] for r in b["results"]]
    assert "burn_time_s" in a["excluded_outcomes"] and a["results"][0]["similarity"] <= 1
    assert all(r["experiment_uid"] != "flex:145" for r in a["results"])
    assert client.get("/api/v1/experiments/saffire1:S1/similar").json()["supported"] is False
    q = client.get("/api/v1/similar/flex/query", params={"fuel": "Heptane", "x_o2": 0.15}).json()
    assert q["results"][0]["parts"][0]["field"] == "fuel"
    assert client.get("/api/v1/similar/flex/query", params={"burn_time_s": 5}).status_code == 400


def test_quality(client):
    s = client.get("/api/v1/quality/summary").json()
    assert s["total"] > 100 and "never overwritten" in s["policy"]
    crit = client.get("/api/v1/quality/flags", params={"severity": "critical"}).json()
    assert {i["rule_id"] for i in crit["items"]} >= {"FLEX-P-ZERO", "FLEX-DEXT-GT-D0", "BASS-O2-UNPHYSICAL"}
    f = [i for i in crit["items"] if i["rule_id"] == "FLEX-P-ZERO"][0]
    assert f["experiment_uid"] == "flex:114" and f["raw_value"] == "0" and f["source_row"] == 114
    assert client.get("/api/v1/quality/flags", params={"severity": "bad"}).status_code == 400
    csv_text = client.get("/api/v1/quality/flags.csv", params={"rule_id": "BASS-O2-UNPHYSICAL"}).text
    assert len(csv_text.strip().splitlines()) == 6


# --------------------------------------------------------------- research ---
def test_research_search_and_failures(client, mock_http):
    j = client.get("/api/v1/research/search", params={"q": "cool flame droplet"}).json()
    assert j["providers"]["ntrs"]["status"] == "ok" and j["providers"]["openalex"]["status"] == "ok"
    merged = [r for r in j["results"] if r["doi"] == "10.1016/j.combustflame.2014.99.001"]
    assert len(merged) == 1 and merged[0]["found_in"] == ["ntrs", "openalex"]
    assert all(r["fulltext_read"] is False for r in j["results"])
    assert client.get("/api/v1/research/search", params={"q": "x", "sources": "scholar"}).status_code == 400
    mock_http("down")
    down = client.get("/api/v1/research/search", params={"q": "brand new offline query"}).json()
    assert down["external_available"] is False and down["results"] == []
    assert client.get("/api/v1/experiments", params={"dataset": "flex"}).status_code == 200  # local still works


def test_research_doi_and_related(client):
    j = client.get("/api/v1/research/doi/10.1016/j.combustflame.2018.10.012").json()
    assert j["verified"] and j["paper"]["title"].startswith("Flame spread")
    assert j["listed_in_nasa_psi_metadata"]  # DOI is listed in SAFFIRE PSI metadata
    assert client.get("/api/v1/research/doi/notadoi").status_code == 400
    pubs = client.get("/api/v1/research/publications", params={"investigation": "PSI-98"}).json()["items"]
    assert pubs and all("content not read" in p["source"] for p in pubs)
    client.get("/api/v1/research/search", params={"q": "cool flame related probe"})
    rel = client.get("/api/v1/research/doi:10.1016/j.combustflame.2014.99.001/related").json()
    assert "related" in rel and "NOT a citation link" in rel["relation_semantics"]["related"]
    assert client.get("/api/v1/research/doi:10.9999/none/related").status_code == 404


# --------------------------------------------------------------------- ML ---
def test_ml_gate(client):
    m = client.get("/api/v1/ml/flex/metrics").json()
    reg = m["metrics"]["regression"]["models"]
    assert m["metrics"]["leakage_review"]["passed"]
    assert set(m["features"]).isdisjoint({"k_mm2_s", "dext_mm", "burn_time_s", "test_end"})
    assert m["prediction_enabled"] == (reg["ridge"]["mae_log"] <= 0.8 * reg["dummy_mean"]["mae_log"])
    body = {"fuel": "Methanol", "x_o2": 0.21, "x_co2": 0, "x_he": 0, "pressure_atm": 1.0, "d0_mm": 3.0}
    p = client.post("/api/v1/ml/flex/predict", json=body)
    if m["prediction_enabled"]:
        assert p.status_code == 200 and p.json()["kind"] == "EXPLORATORY_PREDICTION"
        lo, hi = p.json()["interval_80_s"]
        assert lo < p.json()["prediction_s"] < hi
        ood = client.post("/api/v1/ml/flex/predict", json=dict(body, d0_mm=9.0))
        assert ood.status_code == 422 and ood.json()["error"]["code"] == "out_of_distribution"
        mix = client.post("/api/v1/ml/flex/predict", json=dict(body, x_co2=0.2, x_he=0.2))
        assert mix.status_code == 400
    else:
        assert p.status_code == 501


def test_methodology_endpoint(client):
    m = client.get("/api/v1/methodology").json()
    assert m["links"]["by_level"]["manually_reviewed"] == 28 and "auto_unreviewed" not in m["links"]["by_level"]
    assert m["report_consistency"]["thickness_agree"] == 20 and m["quality"]["rules"] > 30
    assert m["assistant"]["golden_questions"] >= 42 and "llm_api_key" not in str(m).lower()

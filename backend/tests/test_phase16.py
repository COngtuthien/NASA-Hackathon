"""Phase 16: Combustion & Fire Science Explorer collections (evidence levels, dataset-specific filters, provenance,
comparison rules), CFI-G similarity (configuration-scoped, no outcome leakage), and the predictor's FLEX-only scope.
Counts are recomputed from p13_records, never copied from the service."""
from __future__ import annotations

import json
from collections import Counter

import pytest

from app.db.database import jloads

from .conftest import REPO, requires_db

pytestmark = requires_db


def vals(conn, ds):
    return [jloads(v) for (v,) in conn.execute("SELECT values_json FROM p13_records WHERE dataset_id=?", (ds,))]


def test_five_domains_cover_all_ten_investigations_at_their_evidence_level(client):
    d = client.get("/api/v1/combustion/domains").json()
    assert [x["id"] for x in d["domains"]] == ["droplet", "gaseous", "solid", "smoke", "spacecraft"]
    invs = {i for x in d["domains"] for i in x["investigations"]}
    assert invs == {"PSI-69", "PSI-117", "PSI-68", "PSI-159", "PSI-10", "PSI-20", "PSI-25", "PSI-62", "PSI-102", "PSI-98"}
    level = {c["key"]: (c["level"], c["records"]) for x in d["domains"] for c in x["collections"]}
    assert level["flex"] == ("measured", 274) and level["bass2"] == ("measured", 129) and level["saffire1"] == ("measured", 2)
    assert level["cfig"] == ("measured", 333) and level["flame_design"] == ("conditions", 327)
    assert level["bre"] == ("day_summary", 18) and level["psi117"] == ("figure", 61) and level["flex2"] == ("plan", 8)
    assert level["same_log"] == ("log", 51) and level["same_sizes"] == ("derived", 8) and level["psi62"] == ("metadata", 0)


def test_cfig_filters_match_an_independent_count_and_keep_configurations_apart(client, conn):
    j = client.get("/api/v1/combustion/collections/cfig", params={"f_configuration": "inverse", "f_fuel_species": "propane"}).json()
    expect = sum(1 for v in vals(conn, "cfig_tests") if v["configuration"] == "inverse" and v["fuel_species"] == "propane")
    assert j["total"] == expect and all(i["values"]["configuration"] == "inverse" for i in j["items"])
    assert j["badge"] == "Measured test outcomes"
    # O2 range: normal uses ambient-before, inverse the supplied oxidizer; records without a value are excluded and counted
    j = client.get("/api/v1/combustion/collections/cfig", params={"f_configuration": "normal", "min_x_o2": "0.3", "max_x_o2": "0.45"}).json()
    expect = sum(1 for v in vals(conn, "cfig_tests") if v["configuration"] == "normal" and v["x_o2_before"] is not None and 0.3 <= v["x_o2_before"] <= 0.45)
    assert j["total"] == expect
    assert client.get("/api/v1/combustion/collections/cfig", params={"f_fuel_species": "hydrogen"}).status_code == 400


def test_conditions_only_day_level_and_figure_collections_carry_no_invented_outcomes(client):
    fd = client.get("/api/v1/combustion/collections/flame_design").json()
    assert fd["badge"] == "Experimental conditions only"
    assert not any(c["role"] == "outcome" for c in fd["columns"])
    bre = client.get("/api/v1/combustion/collections/bre").json()
    assert bre["total"] == 18 and bre["badge"].startswith("Day-level summary")
    assert sum(i["values"]["flames_ignited"] for i in client.get("/api/v1/combustion/collections/bre", params={"page_size": 50}).json()["items"]) == 194
    p117 = client.get("/api/v1/combustion/collections/psi117").json()
    assert p117["total"] == 61 and p117["comparison"]["allowed"] is False and "not tests" in p117["comparison"]["reason"]
    assert all("x" not in i["values"] and "y" not in i["values"] for i in p117["items"])     # series, not point rows
    f2 = client.get("/api/v1/combustion/collections/flex2").json()
    assert f2["badge"] == "No downloaded per-test outcomes" and f2["comparison"]["allowed"] is False


def test_same_log_and_size_table_stay_separate(client, conn):
    log = client.get("/api/v1/combustion/collections/same_log", params={"f_kind": "test", "page_size": 100}).json()
    assert log["total"] == sum(1 for v in vals(conn, "same_flight_log") if v.get("kind") == "test") == 47
    sizes = client.get("/api/v1/combustion/collections/same_sizes").json()
    assert sizes["total"] == 8 and "not joined" in client.get("/api/v1/combustion/collections/same_log").json()["note"]
    kap = client.get("/api/v1/combustion/collections/same_sizes", params={"f_material": "kapton"}).json()
    assert sorted(i["values"]["d10_nm"] for i in kap["items"]) == [105, 186]


def test_record_detail_has_provenance_flags_and_links(client):
    r = client.get("/api/v1/combustion/record/cfig:normal:21174C3").json()
    assert r["test_id"] == "21174C3" and r["provenance"]["source_row"] and r["provenance"]["source_file"].endswith("Normal Flames.csv")
    assert "psi-159-reports-finalrpt-acme-cfi-g#page=46" in r["graph"]["sources"]
    assert any(l["href"] == "/phenomena/gaseous-flames?tab=cfig&test=21174C3#cfig-lookup" for l in r["links"])
    s = client.get("/api/v1/combustion/record/same:size:kapton:aged").json()
    assert s["provenance"]["page_pdf"] == 27 and s["provenance"]["document_id"]
    assert client.get("/api/v1/combustion/record/nope:1").status_code == 404
    p = client.get("/api/v1/combustion/investigation/PSI-62").json()
    assert p["readiness"] == "metadata_only" and p["publications"] and any(r["investigation_id"] == "PSI-25" for r in p["related"])


def test_comparison_rules(client):
    ok = client.post("/api/v1/combustion/compare", json={"record_ids": ["cfig:normal:21088A1", "cfig:normal:21174C3"]}).json()
    assert ok["compatible"] and any(r["field"] == "burn_time_s" and r["role"] == "outcome" for r in ok["rows"])
    inv = client.get("/api/v1/combustion/collections/cfig", params={"f_configuration": "inverse"}).json()["items"][0]["record_id"]
    bad = client.post("/api/v1/combustion/compare", json={"record_ids": ["cfig:normal:21088A1", inv]}).json()
    assert not bad["compatible"] and "Normal and inverse" in bad["reason"]
    cross = client.post("/api/v1/combustion/compare", json={"record_ids": ["cfig:normal:21088A1", "bre:day:19039"]}).json()
    assert not cross["compatible"] and "different collections" in cross["reason"]
    assert client.post("/api/v1/combustion/compare", json={"record_ids": ["cfig:normal:21088A1"]}).status_code == 400


def test_cfig_similarity_is_scoped_deterministic_and_outcome_free(client):
    a = client.get("/api/v1/experiments/cfig:normal:21174C3/similar", params={"k": 8}).json()
    b = client.get("/api/v1/experiments/cfig:normal:21174C3/similar", params={"k": 8}).json()
    assert [r["experiment_uid"] for r in a["results"]] == [r["experiment_uid"] for r in b["results"]]
    assert all(r["experiment_uid"].startswith("cfig:normal:") for r in a["results"])
    assert "never compared" in a["scope"]
    feats = {f["field"] for f in a["features"]}
    assert feats.isdisjoint({"outcome", "hot_ignition", "termination", "burn_time_s", "x_o2_after", "peak_burner_t_c"})
    assert set(a["excluded_outcomes"]) >= {"outcome", "burn_time_s"}
    q = client.get("/api/v1/similar/cfig/query", params={"configuration": "inverse", "fuel_species": "propane", "x_o2": 0.5, "k": 5}).json()
    assert all(r["experiment_uid"].startswith("cfig:inverse:") for r in q["results"])
    assert client.get("/api/v1/similar/cfig/query", params={"fuel_species": "propane"}).status_code == 400   # configuration required


def test_predictor_stays_flex_only():
    card = json.loads((REPO / "processed" / "ml_flex_model.json").read_text(encoding="utf-8"))
    assert card["artifact"]["fuels"] == ["Heptane", "Methanol"]
    assert card["artifact"]["n_train"] <= 274
    assert card["metrics"]["leakage_review"]["passed"] and card["metrics"]["gate"]["passed"]
    assert card["metrics"]["regression"]["cv"].startswith("GroupKFold")

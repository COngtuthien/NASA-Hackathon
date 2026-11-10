"""Scientific validation of curated BASS-II report tables and ID->citation linking."""
from __future__ import annotations

import json

import pytest

from app.ingest.linking import classify_bass_mention

from .conftest import REPO, requires_db

CUR = REPO / "processed" / "curated"
GMT = {"T10": 175, "T8": None, "O2": 49, "B11": 188, "M17": 196, "T9": 175, "F2": 209}


def _load(name):
    return json.loads((CUR / name).read_text(encoding="utf-8"))


# ------------------------------------------------------------- linking rules --
@pytest.mark.parametrize("text,ident,level,reason", [
    ("the O2 concentration fell", "O2", "excluded", "ambiguous_token"),
    ("in test O2 the rod ignited", "O2", "exact_context", "preceded"),
    ("see Table B1 for details", "B1", "excluded", "label_reference"),
    ("Figure 5.3 shows M17 still images", "M17", "auto_unreviewed", "bare"),
    ("GMT131-T10 1.2 11 21 BASS", "T10", "excluded", "collision"),
    ("GMT175-T10 2.2 5 16.4 No ignition", "T10", "exact_context", "matches"),
    ("(b) BASS‑II B11; 200 um thick", "B11", "exact_context", "preceded"),
    ("Cont 7 57 F2 1,000", "F2", "excluded", "ambiguous_token"),
])
def test_classify_mentions(text, ident, level, reason):
    i = text.index(ident)
    lv, why = classify_bass_mention(text, i, i + len(ident), ident, GMT)
    assert lv == level and reason in why


# ---------------------------------------------------------- curated tables ---
pytestmark_curated = pytest.mark.skipif(not (CUR / "bass2_table_5_1.json").exists(), reason="run ingestion first")


@pytestmark_curated
def test_table_5_1_values_and_verification():
    t = _load("bass2_table_5_1.json")
    assert t["page_pdf"] == 65 and len(t["rows"]) == 20
    assert all(r["verification"] == "verified" for r in t["rows"])
    m = {r["test_id"]: r for r in t["rows"]}
    m7 = m["M7"]["values"]
    assert m7["velocity_cm_s"] == [10, 6, 5, 3] and m7["spread_rate_mm_s"] == [0.106, 0.099, 0.083, 0.07]
    assert m["M7"]["raw"]["Spread rate, mm/s"] == "0.106, 0.099, 0.083, and 0.07"  # verbatim printed text
    assert m["M1"]["values"]["initial_o2_vol_pct"] == 22.2 and m["M1"]["values"]["final_o2_vol_pct"] == 21.9
    assert m["M6"]["values"]["spread_rate_status"] == "not tracked" and m["M6"]["paired_stages"] == []
    assert m["M5"]["values"]["burn_time_min"] == 27.2


@pytestmark_curated
def test_table_7_1_outcomes_and_bass1_collision():
    t = _load("bass2_table_7_1.json")
    rows = {r["row_key"]: r for r in t["rows"]}
    assert len(rows) == 31
    assert rows["GMT175-T9"]["values"]["outcome"] == "no_ignition" and rows["GMT175-T9"]["verification"] == "verified"
    assert rows["GMT45-T1"]["values"]["o2_footnote"] == "b" and rows["GMT45-T1"]["values"]["o2_vol_pct"] == 18.5
    bass1 = [r for r in t["rows"] if r["investigation"] == "BASS (I)"]
    assert {r["row_key"] for r in bass1} == {"GMT96-T8", "GMT96-T7", "GMT131-T10", "GMT222-T11"}
    assert all(r["experiment_uid"] is None for r in bass1)  # never linked to the same-named BASS-II test
    assert rows["GMT45-T15"]["values"]["flow_cm_s"] == [10, 29]


@pytestmark_curated
def test_appendix_a_coverage_and_conflicts():
    a = _load("bass2_appendix_a.json")
    rows = {r["test_id"]: r for r in a["rows"]}
    assert len(rows) == 126 and not a["unmapped_cells"]
    assert {"O20", "O21", "O22"}.isdisjoint(rows)  # the 2016 runs are not in Appendix A
    assert rows["B1"]["values"]["flow_direction"] == "Opposed" and rows["F1"]["values"]["flow_direction"] == "Concurrent"
    assert "self-extinguished at 8 cm/s" in rows["M10"]["values"]["observations"]
    review = {k for k, r in rows.items() if r["verification"] == "needs_review"}
    assert review == {"F3", "P3a", "P22b"}
    assert any("236" in n and "239" in n for n in rows["P22b"]["notes"])


@pytestmark_curated
def test_committed_curation_is_reproducible(tmp_path):
    from app.curation.bass_report import build
    build(REPO, tmp_path)
    for f in ("bass2_table_5_1.json", "bass2_table_7_1.json", "bass2_appendix_a.json"):
        assert json.loads((tmp_path / f).read_text(encoding="utf-8")) == _load(f), f


# ---------------------------------------------------------------- database ---
@requires_db
def test_links_are_not_ambiguous(conn):
    o2 = conn.execute("SELECT review_status FROM evidence_links WHERE experiment_uid='bass2:48'").fetchall()
    assert all(r[0] in ("verified_table_row", "exact_context") for r in o2)  # never the oxygen token
    levels = {r[0] for r in conn.execute("SELECT DISTINCT review_status FROM evidence_links")}
    assert levels <= {"verified_table_row", "exact_context", "auto_unreviewed"}
    # every verified link points at the report page of a verified row for that very test
    bad = conn.execute(
        "SELECT count(*) FROM evidence_links l JOIN document_chunks c USING(chunk_id) WHERE l.review_status="
        "'verified_table_row' AND NOT EXISTS (SELECT 1 FROM report_records r WHERE r.experiment_uid=l.experiment_uid "
        "AND r.page_pdf=c.page_pdf AND r.verification='verified')").fetchone()[0]
    assert bad == 0


@requires_db
def test_api_report_integration(client):
    d = client.get("/api/v1/experiments/bass2:33").json()  # M7
    t51 = [r for r in d["report_records"] if r["table_id"] == "5.1"][0]
    assert t51["verification"] == "verified" and t51["page_pdf"] == 65 and t51["values"]["burn_time_min"] == 18.4
    assert d["normalized"]["flow_direction"] == "Opposed"
    assert d["normalized"]["flow_direction_source"].startswith("Summary Report Table A.4, PDF p.")
    assert d["evidence_links"][0]["review_status"] == "verified_table_row"
    rep = client.get("/api/v1/analytics/bass/report").json()
    assert rep["table_5_1"]["n_stages"] > 20 and "M6" in rep["table_5_1"]["unpaired_tests"]
    flags = client.get("/api/v1/quality/flags", params={"rule_id": "BASS-REPORT-CSV-CONFLICT"}).json()
    assert {f["display_id"] for f in flags["items"]} == {"F3", "P3a", "P22b"}
    tc = client.get("/api/v1/quality/flags", params={"rule_id": "BASS-TEST-COUNT"}).json()["items"][0]
    assert tc["status"] == "confirmed" and "O20" in tc["description"]
    lst = client.get("/api/v1/experiments", params={"dataset": "bass2", "f_flow_direction": "Concurrent"}).json()
    assert lst["total"] > 0 and all(i["fields"]["flow_direction"] == "Concurrent" for i in lst["items"])
    cur = client.get("/api/v1/curated/bass2", params={"table": "7.1"}).json()
    assert cur["total"] == 31

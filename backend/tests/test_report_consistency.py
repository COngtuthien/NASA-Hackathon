"""Report-only BASS-II values cross-checked against each other (Tables 5.1/7.1, Appendix A, CSV material text)."""
from __future__ import annotations

import json

from app.curation.report_consistency import check, thickness_mm, width_cm

from .conftest import requires_db


def test_parsers():
    assert thickness_mm("3-mm-thick PMMA one- sided, 2 cm wide") == 3.0
    assert thickness_mm("2-cm, 0.4- mm thick film") == 0.4
    assert thickness_mm("100 micron PMMA film   2 cm wide") == 0.1
    assert width_cm("1-cm-wide PMMA, 2 mm thick") == 1.0 and width_cm("SIBAL 2 cm") == 2.0


def _tables(width=2.2, material="1 cm SIBAL", air="10, 1"):
    return {"5.1": {"rows": []},
            "7.1": {"rows": [{"test_id": "T9", "page_pdf": 104, "verification": "verified",
                              "values": {"sample_width_cm": width, "flow_cm_s": [10.0, 2.2]}}]},
            "A": {"rows": [{"test_id": "T9", "page_pdf": 120, "values": {"flow_direction": None},
                            "raw": {"material": material, "air_display": air, "flow_direction": "1"}}]}}


def test_width_conflict_velocity_gap_and_direction_fill():
    res = check(_tables(), {"T9": "1 cm SIBAL"})
    assert res["conflicts"] and res["conflicts"][0]["field"] == "width_cm"
    assert "CSV material text says 1 cm" in res["conflicts"][0]["detail"]
    assert res["velocity"][0]["not_in_display"] == [2.2] and res["summary"]["low_flow_examples"]
    assert res["direction_from_table_7_1"][0]["test_id"] == "T9"
    ok = check(_tables(width=1.2), {"T9": "1 cm SIBAL"})
    assert not ok["conflicts"] and ok["summary"]["width_agree"] == 1


@requires_db
def test_ingested_consistency_findings(conn):
    rc = json.loads(conn.execute("SELECT value FROM meta WHERE key='ingest_report'").fetchone()[0])["report_consistency"]
    sm = rc["summary"]
    assert sm["thickness_checked"] == sm["thickness_agree"] == 20
    assert sm["width_checked"] == 47 and sm["width_agree"] == 46
    assert [c["test_id"] for c in rc["conflicts"]] == ["T24"]
    assert [x["test_id"] for x in sm["display_near_zero"]] == ["M12"]
    assert {d["test_id"] for d in rc["direction_from_table_7_1"]} == {"T1", "T2", "T4", "T15"}
    flags = {r[0]: r[1] for r in conn.execute(
        "SELECT rule_id, count(*) FROM quality_flags WHERE rule_id LIKE 'BASS-%-VELOCITY' OR "
        "rule_id='BASS-REPORT-INTERNAL-CONFLICT' GROUP BY 1")}
    assert flags == {"BASS-AIR-DISPLAY-NOT-VELOCITY": 1, "BASS-REPORT-INTERNAL-CONFLICT": 1}
    rows = dict(conn.execute("SELECT test_id, flow_direction FROM bass2_tests WHERE test_id IN ('T1','T24','O1')"))
    assert rows == {"T1": "Concurrent", "T24": "Concurrent", "O1": None}  # O1 stays unknown: no documented basis


@requires_db
def test_report_api_exposes_consistency(client):
    rep = client.get("/api/v1/analytics/bass/report").json()
    assert rep["consistency"]["summary"]["conflicts"] == 1 and "Air display" in rep["consistency"]["method"]

"""Broken-citation check: every citation target the UI can show must resolve to a real source location."""
from __future__ import annotations

import pymupdf

from .conftest import REPO, requires_db

pytestmark = requires_db


def test_every_document_file_resolves(client):
    for d in client.get("/api/v1/documents").json()["items"]:
        r = client.get(f"/api/v1/documents/{d['document_id']}/file")
        assert r.status_code == 200, d["document_id"]
        if d["relative_path"].endswith(".pdf"):
            assert r.content[:4] == b"%PDF"


def test_chunk_and_report_pages_exist(conn):
    pages = {}
    for d in conn.execute("SELECT document_id, relative_path, page_count FROM documents"):
        if d["relative_path"].endswith(".pdf"):
            with pymupdf.open(REPO / d["relative_path"]) as doc:
                pages[d["document_id"]] = doc.page_count
                assert doc.page_count == d["page_count"]
    for c in conn.execute("SELECT chunk_id, document_id, page_pdf FROM document_chunks WHERE page_pdf IS NOT NULL"):
        assert c["document_id"] in pages, f"{c['chunk_id']}: page number on a non-PDF document"
        assert 1 <= c["page_pdf"] <= pages[c["document_id"]], c["chunk_id"]
    for r in conn.execute("SELECT record_id, document_id, page_pdf FROM report_records"):
        assert 1 <= r["page_pdf"] <= pages[r["document_id"]], r["record_id"]
        hit = conn.execute("SELECT 1 FROM document_chunks WHERE document_id=? AND page_pdf=?",
                           (r["document_id"], r["page_pdf"])).fetchone()
        assert hit, f"{r['record_id']}: cited page has no indexed text"


def test_evidence_links_and_insight_citations_resolve(client, conn):
    orphan = conn.execute("SELECT count(*) FROM evidence_links l LEFT JOIN document_chunks c USING(chunk_id) "
                          "WHERE c.chunk_id IS NULL").fetchone()[0]
    assert orphan == 0
    orphan_exp = conn.execute("SELECT count(*) FROM evidence_links l LEFT JOIN experiments e USING(experiment_uid) "
                              "WHERE e.experiment_uid IS NULL").fetchone()[0]
    assert orphan_exp == 0
    for ins in client.get("/api/v1/overview").json()["insights"]:
        for c in ins["citations"]:
            if c.get("document_id"):
                assert conn.execute("SELECT 1 FROM document_chunks WHERE document_id=? AND page_pdf=?",
                                    (c["document_id"], c["page_pdf"])).fetchone(), c

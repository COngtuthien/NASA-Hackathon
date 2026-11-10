"""External provider adapters with mocked HTTP (no internet, no keys)."""
from __future__ import annotations

import httpx
import pytest

from app.providers.scholarly import (CrossrefAdapter, HttpClient, NtrsAdapter, OpenAlexAdapter, ProviderError,
                                     normalize_doi, reconstruct_abstract)
from app.services.literature import dedupe

from .conftest import make_handler, requires_db


def _http(mode="ok"):
    return HttpClient(timeout_s=2, retries=0, transport=httpx.MockTransport(make_handler(mode)))


def test_normalize_doi():
    assert normalize_doi("https://doi.org/10.1016/J.Combustflame.2018.10.012") == "10.1016/j.combustflame.2018.10.012"
    assert normalize_doi("doi:10.2514/6.2012-1252.") == "10.2514/6.2012-1252"
    assert normalize_doi("not a doi") is None


def test_ntrs_mapping():
    total, items = NtrsAdapter(_http()).search("cool flame")
    assert total == 2 and items[0].provider == "ntrs"
    assert items[0].authors == ["Nayagam, Vedha", "Dietrich, Daniel L."]  # sorted by sequence
    assert items[0].year == 2014 and items[0].doi == "10.1016/j.combustflame.2014.99.001"
    assert items[0].canonical_url == "https://ntrs.nasa.gov/citations/20140006750"
    assert items[0].access_type == "abstract" and items[1].access_type == "metadata"
    assert items[0].to_dict()["fulltext_read"] is False


def test_openalex_mapping_and_abstract():
    total, items = OpenAlexAdapter(_http()).search("cool flame")
    w = items[0]
    assert w.provider_id == "W2082694575" and w.doi == "10.1016/j.combustflame.2014.99.001"
    assert w.abstract == "Cool flames persist" and w.venue == "Combustion and Flame"
    assert reconstruct_abstract(None) is None


def test_crossref_mapping():
    p = CrossrefAdapter(_http()).get_by_doi("10.1016/j.combustflame.2018.10.012")
    assert p.title.startswith("Flame spread") and p.year == 2019 and p.authors == ["David Urban"]


@pytest.mark.parametrize("mode,status", [("down", None), ("429", 429)])
def test_provider_failures(mode, status):
    with pytest.raises(ProviderError) as e:
        NtrsAdapter(_http(mode)).search("x")
    assert e.value.status == status


def test_timeout_is_provider_error():
    def handler(request):
        raise httpx.ReadTimeout("slow", request=request)
    http = HttpClient(timeout_s=0.1, retries=0, transport=httpx.MockTransport(handler))
    with pytest.raises(ProviderError, match="timed out"):
        OpenAlexAdapter(http).search("x")


def test_doi_dedupe_across_providers():
    _, n = NtrsAdapter(_http()).search("x")
    _, o = OpenAlexAdapter(_http()).search("x")
    merged = dedupe([("ntrs", 1, n[0].to_dict()), ("ntrs", 2, n[1].to_dict()), ("openalex", 1, o[0].to_dict())])
    assert len(merged) == 2
    first = merged[0]
    assert first["paper_id"] == "doi:10.1016/j.combustflame.2014.99.001"
    assert first["found_in"] == ["ntrs", "openalex"] and len(first["authors"]) == 3


@requires_db
def test_search_offline_then_stale_cache(conn, mock_http):
    from app.services.literature import get_literature
    mock_http("ok")
    ok = get_literature().search(conn, "unique stale cache probe")
    assert ok["providers"]["ntrs"]["status"] == "ok" and ok["total"] >= 1
    conn.execute("UPDATE external_cache SET fetched_at='2000-01-01T00:00:00+00:00'")
    conn.commit()
    mock_http("down")
    stale = get_literature().search(conn, "unique stale cache probe")
    assert stale["providers"]["ntrs"]["status"] == "stale_cache" and stale["providers"]["ntrs"]["is_stale"]
    fresh_q = get_literature().search(conn, "never cached query xyz")
    assert fresh_q["external_available"] is False and fresh_q["results"] == []
    assert "temporarily unavailable" in fresh_q["message"]

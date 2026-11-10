"""Test configuration.

* API/integration tests run against a TEMPORARY COPY of the generated database, so
  tests that write caches never touch processed/spacefire.db and never touch raw data.
* External HTTP is always mocked (no internet, no API keys).
* The LLM is forced off unless a test injects a fake provider.
"""
from __future__ import annotations

import json
import os
import shutil
import tempfile
from pathlib import Path

import httpx
import pytest

BACKEND = Path(__file__).resolve().parents[1]
REPO = BACKEND.parent
REAL_DB = REPO / "processed" / "spacefire.db"
_TMP = Path(tempfile.mkdtemp(prefix="spacefire-test-"))
TEST_DB = _TMP / "spacefire.db"
if REAL_DB.exists():
    shutil.copy2(REAL_DB, TEST_DB)
os.environ["DATABASE_PATH"] = str(TEST_DB)
os.environ["LLM_API_KEY"] = ""
os.environ["EXTERNAL_SEARCH_ENABLED"] = "true"

from app.core.config import get_settings  # noqa: E402

get_settings.cache_clear()

from app.providers.llm import set_llm  # noqa: E402
from app.providers.scholarly import HttpClient  # noqa: E402
from app.services import literature as lit_mod  # noqa: E402

requires_db = pytest.mark.skipif(not REAL_DB.exists(), reason="run `python -m app.ingest.run` first")

NTRS_FIXTURE = {
    "stats": {"total": 2},
    "results": [
        {"id": 20140006750, "title": "Cool-flame Extinction During N-Alkane Droplet Combustion in Microgravity",
         "abstract": "Recent droplet combustion experiments onboard the ISS have revealed cool flames.",
         "authorAffiliations": [{"sequence": 1, "meta": {"author": {"name": "Dietrich, Daniel L."}}},
                                {"sequence": 0, "meta": {"author": {"name": "Nayagam, Vedha"}}}],
         "publications": [{"publicationDate": "2014-03-15T00:00:00", "doi": "10.1016/j.combustflame.2014.99.001"}],
         "downloads": [{"links": {"pdf": "/api/citations/20140006750/downloads/20140006750.pdf"}}],
         "downloadsAvailable": True, "distribution": "PUBLIC", "stiTypeDetails": "Conference Paper",
         "keywords": ["microgravity combustion"]},
        {"id": 20150023456, "title": "Detailed Results from the Flame Extinguishment (FLEX) Experiment",
         "abstract": None, "authorAffiliations": [], "publications": [{"publicationDate": "2015-12-01T00:00:00"}],
         "downloads": [], "downloadsAvailable": False, "distribution": "PUBLIC"},
    ],
}
OPENALEX_FIXTURE = {
    "meta": {"count": 1},
    "results": [{
        "id": "https://openalex.org/W2082694575", "doi": "https://doi.org/10.1016/J.COMBUSTFLAME.2014.99.001",
        "title": "Cool-flame Extinction During N-Alkane Droplet Combustion in Microgravity",
        "publication_year": 2014, "authorships": [{"author": {"display_name": "Vedha Nayagam"}},
                                                  {"author": {"display_name": "Daniel L. Dietrich"}},
                                                  {"author": {"display_name": "Forman A. Williams"}}],
        "primary_location": {"source": {"display_name": "Combustion and Flame"}},
        "open_access": {"is_oa": False}, "abstract_inverted_index": {"Cool": [0], "flames": [1], "persist": [2]},
        "cited_by_count": 42, "type": "article", "referenced_works": ["https://openalex.org/W1"],
        "related_works": ["https://openalex.org/W2"]}],
}
CROSSREF_FIXTURE = {"message": {"DOI": "10.1016/j.combustflame.2018.10.012", "title": ["Flame spread: Effects of "
                                "microgravity and scale"], "author": [{"given": "David", "family": "Urban"}],
                                "container-title": ["Combustion and Flame"],
                                "issued": {"date-parts": [[2019, 1]]}, "URL": "https://doi.org/10.1016/j.cf",
                                "type": "journal-article"}}


def make_handler(mode: str = "ok", calls: list | None = None):
    def handler(request: httpx.Request) -> httpx.Response:
        if calls is not None:
            calls.append(str(request.url))
        if mode == "down":
            raise httpx.ConnectError("offline", request=request)
        if mode == "429":
            return httpx.Response(429, headers={"retry-after": "0"})
        host = request.url.host
        if host == "ntrs.nasa.gov":
            return httpx.Response(200, json=NTRS_FIXTURE)
        if host == "api.openalex.org":
            if "/works/doi:" in request.url.path:
                return httpx.Response(200, json=OPENALEX_FIXTURE["results"][0])
            return httpx.Response(200, json=OPENALEX_FIXTURE)
        if host == "api.crossref.org":
            if "not-a-real" in request.url.path:
                return httpx.Response(404, json={})
            return httpx.Response(200, json=CROSSREF_FIXTURE)
        return httpx.Response(404)
    return handler


@pytest.fixture
def mock_http():
    calls: list[str] = []

    def install(mode: str = "ok"):
        client = HttpClient(timeout_s=2, retries=0, transport=httpx.MockTransport(make_handler(mode, calls)))
        lit_mod.set_literature(lit_mod.Literature(http=client))
        return calls
    yield install
    lit_mod.set_literature(None)


@pytest.fixture(autouse=True)
def no_llm():
    set_llm(None)
    yield
    set_llm(None)


@pytest.fixture
def client(mock_http):
    if not TEST_DB.exists():
        pytest.skip("database not built")
    mock_http("ok")
    from fastapi.testclient import TestClient
    from app.main import app
    with TestClient(app) as c:
        yield c


@pytest.fixture
def conn():
    if not TEST_DB.exists():
        pytest.skip("database not built")
    from app.db.database import connect
    c = connect(TEST_DB)
    yield c
    c.close()


def load_golden() -> list[dict]:
    p = BACKEND / "tests" / "golden_questions.jsonl"
    return [json.loads(line) for line in p.read_text(encoding="utf-8").splitlines() if line.strip()]

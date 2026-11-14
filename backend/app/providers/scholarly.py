"""External scholarly metadata adapters: NASA NTRS, OpenAlex, Crossref.

Official public JSON APIs only. Each adapter maps the provider response to a
common `PaperDTO`; nothing about a paper's results is ever inferred from
metadata. Abstracts are kept only when the API itself returns them.
"""
from __future__ import annotations

import logging
import re
import time
from dataclasses import asdict, dataclass, field
from typing import Any
from urllib.parse import quote

import httpx

log = logging.getLogger("spacefire.providers")
USER_AGENT = "SpaceFireAI/0.1 (NASA Space Apps research prototype)"
DOI_RE = re.compile(r"10\.\d{4,9}/[^\s\"<>]+", re.I)


class ProviderError(Exception):
    def __init__(self, provider: str, message: str, status: int | None = None, retry_after: float | None = None):
        super().__init__(f"{provider}: {message}")
        self.provider = provider
        self.status = status
        self.retry_after = retry_after


@dataclass
class PaperDTO:
    provider: str
    provider_id: str
    title: str
    authors: list[str] = field(default_factory=list)
    year: int | None = None
    venue: str | None = None
    doi: str | None = None
    canonical_url: str | None = None
    abstract: str | None = None
    is_open_access: bool | None = None
    fulltext_url: str | None = None
    doc_type: str | None = None
    cited_by_count: int | None = None
    keywords: list[str] = field(default_factory=list)
    related_ids: list[str] = field(default_factory=list)
    referenced_ids: list[str] = field(default_factory=list)

    @property
    def access_type(self) -> str:
        return "abstract" if self.abstract else "metadata"

    def to_dict(self) -> dict:
        d = asdict(self)
        d["access_type"] = self.access_type
        d["fulltext_read"] = False  # SpaceFire never analyzes external full text
        return d


def normalize_doi(value: str | None) -> str | None:
    if not value:
        return None
    m = DOI_RE.search(value.strip())
    if not m:
        return None
    return m.group(0).rstrip(".,;)").lower()


def _clean_text(s: str | None) -> str | None:
    if not s:
        return None
    s = re.sub(r"<[^>]+>", " ", s)  # strip JATS/HTML tags from abstracts
    s = " ".join(s.split())
    return s or None


class HttpClient:
    """Small sync client with timeout, retry with backoff on 429/5xx, and no secrets in logs."""

    def __init__(self, timeout_s: float = 15.0, retries: int = 2, transport: httpx.BaseTransport | None = None):
        self.timeout_s = timeout_s
        self.retries = retries
        self._client = httpx.Client(timeout=timeout_s, headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
                                    follow_redirects=True, transport=transport)

    def get_json(self, provider: str, url: str, params: dict | None = None) -> Any:
        delay = 1.0
        for attempt in range(self.retries + 1):
            try:
                r = self._client.get(url, params=params)
            except httpx.TimeoutException:
                if attempt < self.retries:
                    time.sleep(delay)
                    delay *= 2
                    continue
                raise ProviderError(provider, "request timed out")
            except httpx.HTTPError as exc:
                raise ProviderError(provider, f"network error: {type(exc).__name__}")
            if r.status_code == 429 or r.status_code >= 500:
                retry_after = None
                try:
                    retry_after = float(r.headers.get("retry-after", "")) if r.headers.get("retry-after") else None
                except ValueError:
                    retry_after = None
                if attempt < self.retries:
                    time.sleep(min(retry_after or delay, 8.0))
                    delay *= 2
                    continue
                raise ProviderError(provider, f"HTTP {r.status_code}", r.status_code, retry_after)
            if r.status_code == 404:
                raise ProviderError(provider, "not found", 404)
            if r.status_code >= 400:
                raise ProviderError(provider, f"HTTP {r.status_code}", r.status_code)
            try:
                return r.json()
            except ValueError:
                raise ProviderError(provider, "invalid JSON response")
        raise ProviderError(provider, "exhausted retries")


# ------------------------------------------------------------------ NTRS -----

class NtrsAdapter:
    name = "ntrs"
    base = "https://ntrs.nasa.gov"

    def __init__(self, http: HttpClient):
        self.http = http

    def search(self, query: str, page: int = 1, size: int = 10, year_min: int | None = None,
               year_max: int | None = None, author: str | None = None) -> tuple[int, list[PaperDTO]]:
        params: dict[str, Any] = {"q": query, "page.size": size, "page.from": (page - 1) * size}
        if author:
            params["author"] = author
        if year_min:
            params["published.gte"] = f"{year_min}-01-01"
        if year_max:
            params["published.lte"] = f"{year_max}-12-31"
        data = self.http.get_json(self.name, f"{self.base}/api/citations/search", params)
        return int(data.get("stats", {}).get("total", 0)), [self._map(r) for r in data.get("results", [])]

    def get(self, ntrs_id: str) -> PaperDTO:
        if not re.fullmatch(r"\d{6,12}", ntrs_id):
            raise ProviderError(self.name, "invalid NTRS id", 400)
        return self._map(self.http.get_json(self.name, f"{self.base}/api/citations/{ntrs_id}"))

    def _map(self, r: dict) -> PaperDTO:
        pid = str(r.get("id"))
        authors = [a.get("meta", {}).get("author", {}).get("name") for a in
                   sorted(r.get("authorAffiliations") or [], key=lambda a: a.get("sequence", 0))]
        year = None
        for p in r.get("publications") or []:
            if p.get("publicationDate"):
                year = int(p["publicationDate"][:4])
                break
        if year is None and r.get("distributionDate"):
            year = int(r["distributionDate"][:4])
        doi = None
        for p in r.get("publications") or []:
            doi = normalize_doi(p.get("doi")) or doi
        for rn in r.get("otherReportNumbers") or []:
            doi = doi or normalize_doi(rn)
        venue = None
        meetings = r.get("meetings") or []
        if meetings:
            venue = meetings[0].get("name")
        if not venue:
            for p in r.get("publications") or []:
                venue = p.get("publicationName") or venue
        fulltext = None
        for d in r.get("downloads") or []:
            link = (d.get("links") or {}).get("pdf") or (d.get("links") or {}).get("original")
            if link:
                fulltext = self.base + link
                break
        return PaperDTO(
            provider=self.name, provider_id=pid, title=" ".join((r.get("title") or "").split()),
            authors=[a for a in authors if a], year=year, venue=venue, doi=doi,
            canonical_url=f"{self.base}/citations/{pid}", abstract=_clean_text(r.get("abstract")),
            is_open_access=bool(r.get("downloadsAvailable")) and r.get("distribution") == "PUBLIC",
            fulltext_url=fulltext, doc_type=r.get("stiTypeDetails") or r.get("stiType"),
            keywords=list(r.get("keywords") or [])[:12],
        )


# -------------------------------------------------------------- OpenAlex -----

def reconstruct_abstract(inv: dict | None) -> str | None:
    """OpenAlex provides abstracts as an inverted index; rebuilding it is the documented way to read them."""
    if not inv:
        return None
    pos: dict[int, str] = {}
    for word, idxs in inv.items():
        for i in idxs:
            pos[i] = word
    return " ".join(pos[i] for i in sorted(pos)) or None


class OpenAlexAdapter:
    name = "openalex"
    base = "https://api.openalex.org"
    select = ("id,doi,title,publication_year,authorships,primary_location,open_access,abstract_inverted_index,"
              "cited_by_count,type,referenced_works,related_works,best_oa_location")

    def __init__(self, http: HttpClient, mailto: str = "", api_key: str = ""):
        self.http = http
        self.mailto = mailto
        self.api_key = api_key

    def _params(self, extra: dict) -> dict:
        p = dict(extra)
        p["select"] = self.select
        if self.mailto:
            p["mailto"] = self.mailto
        if self.api_key:
            p["api_key"] = self.api_key
        return p

    def search(self, query: str, page: int = 1, size: int = 10, year_min: int | None = None,
               year_max: int | None = None, open_access: bool | None = None,
               sort: str = "relevance") -> tuple[int, list[PaperDTO]]:
        filters = []
        if year_min:
            filters.append(f"from_publication_date:{year_min}-01-01")
        if year_max:
            filters.append(f"to_publication_date:{year_max}-12-31")
        if open_access is not None:
            filters.append(f"is_oa:{'true' if open_access else 'false'}")
        params = {"search": query, "per_page": size, "page": page}
        if filters:
            params["filter"] = ",".join(filters)
        if sort == "date":
            params["sort"] = "publication_date:desc"
        data = self.http.get_json(self.name, f"{self.base}/works", self._params(params))
        return int(data.get("meta", {}).get("count", 0)), [self._map(w) for w in data.get("results", [])]

    def get_by_doi(self, doi: str) -> PaperDTO:
        return self._map(self.http.get_json(self.name, f"{self.base}/works/doi:{quote(doi, safe='/')}", self._params({})))

    def get(self, work_id: str) -> PaperDTO:
        if not re.fullmatch(r"W\d{4,12}", work_id):
            raise ProviderError(self.name, "invalid OpenAlex id", 400)
        return self._map(self.http.get_json(self.name, f"{self.base}/works/{work_id}", self._params({})))

    def get_many(self, work_ids: list[str]) -> list[PaperDTO]:
        ids = [w for w in work_ids if re.fullmatch(r"W\d{4,12}", w)][:25]
        if not ids:
            return []
        data = self.http.get_json(self.name, f"{self.base}/works",
                                  self._params({"filter": "openalex:" + "|".join(ids), "per_page": len(ids)}))
        return [self._map(w) for w in data.get("results", [])]

    def _map(self, w: dict) -> PaperDTO:
        wid = (w.get("id") or "").rsplit("/", 1)[-1]
        loc = w.get("primary_location") or {}
        src = (loc.get("source") or {})
        oa = w.get("open_access") or {}
        best = w.get("best_oa_location") or {}
        return PaperDTO(
            provider=self.name, provider_id=wid, title=" ".join((w.get("title") or "").split()),
            authors=[(a.get("author") or {}).get("display_name") for a in (w.get("authorships") or [])
                     if (a.get("author") or {}).get("display_name")][:30],
            year=w.get("publication_year"), venue=src.get("display_name"), doi=normalize_doi(w.get("doi")),
            canonical_url=(f"https://doi.org/{normalize_doi(w.get('doi'))}" if normalize_doi(w.get("doi"))
                           else w.get("id")),
            abstract=reconstruct_abstract(w.get("abstract_inverted_index")),
            is_open_access=oa.get("is_oa"), fulltext_url=best.get("pdf_url") or oa.get("oa_url"),
            doc_type=w.get("type"), cited_by_count=w.get("cited_by_count"),
            related_ids=[x.rsplit("/", 1)[-1] for x in (w.get("related_works") or [])][:15],
            referenced_ids=[x.rsplit("/", 1)[-1] for x in (w.get("referenced_works") or [])][:40],
        )


# --------------------------------------------------------------- Crossref ----

class CrossrefAdapter:
    name = "crossref"
    base = "https://api.crossref.org"

    def __init__(self, http: HttpClient, mailto: str = ""):
        self.http = http
        self.mailto = mailto

    def get_by_doi(self, doi: str) -> PaperDTO:
        params = {"mailto": self.mailto} if self.mailto else None
        data = self.http.get_json(self.name, f"{self.base}/works/{quote(doi, safe='/')}", params)
        m = data.get("message") or {}
        year = None
        for k in ("published-print", "published-online", "issued", "created"):
            parts = (m.get(k) or {}).get("date-parts") or []
            if parts and parts[0] and parts[0][0]:
                year = int(parts[0][0])
                break
        authors = []
        for a in m.get("author") or []:
            name = " ".join(x for x in (a.get("given"), a.get("family")) if x) or a.get("name")
            if name:
                authors.append(name)
        title = " ".join(((m.get("title") or [""])[0]).split())
        return PaperDTO(provider=self.name, provider_id=normalize_doi(m.get("DOI")) or doi, title=title,
                        authors=authors[:30], year=year, venue=((m.get("container-title") or [None])[0]),
                        doi=normalize_doi(m.get("DOI")) or doi, canonical_url=m.get("URL") or f"https://doi.org/{doi}",
                        abstract=_clean_text(m.get("abstract")), doc_type=m.get("type"),
                        cited_by_count=m.get("is-referenced-by-count"))

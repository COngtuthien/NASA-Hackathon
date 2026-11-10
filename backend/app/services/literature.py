"""External literature search with caching, DOI dedupe and honest failure states."""
from __future__ import annotations

import datetime as dt
import hashlib
import json
import logging
import re
import sqlite3
import threading
from concurrent.futures import ThreadPoolExecutor
from typing import Any

from ..core.config import get_settings
from ..core.errors import ApiError, bad_request, not_found
from ..providers.scholarly import (
    CrossrefAdapter, HttpClient, NtrsAdapter, OpenAlexAdapter, PaperDTO, ProviderError, normalize_doi,
)

log = logging.getLogger("spacefire.literature")
PROVIDERS = ("ntrs", "openalex")
_lock = threading.Lock()


class Literature:
    def __init__(self, http: HttpClient | None = None):
        s = get_settings()
        self.settings = s
        self.http = http or HttpClient(timeout_s=s.external_timeout_s)
        self.ntrs = NtrsAdapter(self.http)
        self.openalex = OpenAlexAdapter(self.http, s.openalex_mailto, s.openalex_api_key)
        self.crossref = CrossrefAdapter(self.http, s.openalex_mailto)

    # --------------------------------------------------------------- cache --
    def _cached(self, conn, provider: str, request: dict, fetch):
        key = hashlib.sha256(json.dumps([provider, request], sort_keys=True).encode()).hexdigest()
        row = conn.execute("SELECT response_json, fetched_at FROM external_cache WHERE cache_key=?", (key,)).fetchone()
        now = dt.datetime.now(dt.UTC)
        ttl = dt.timedelta(hours=self.settings.external_cache_ttl_hours)
        if row:
            fetched = dt.datetime.fromisoformat(row["fetched_at"])
            if now - fetched < ttl:
                return json.loads(row["response_json"]), {"cache": "hit", "fetched_at": row["fetched_at"],
                                                          "is_stale": False}
        if not self.settings.external_search_enabled:
            if row:
                return json.loads(row["response_json"]), {"cache": "stale", "fetched_at": row["fetched_at"],
                                                          "is_stale": True, "reason": "external search disabled"}
            raise ProviderError(provider, "external search is disabled by configuration (EXTERNAL_SEARCH_ENABLED=false)")
        try:
            data = fetch()
        except ProviderError as exc:
            if row:
                return json.loads(row["response_json"]), {"cache": "stale", "fetched_at": row["fetched_at"],
                                                          "is_stale": True, "reason": str(exc)}
            raise
        fetched_at = now.replace(microsecond=0).isoformat()
        with _lock:
            conn.execute("INSERT OR REPLACE INTO external_cache VALUES (?,?,?,?,?)",
                         (key, provider, json.dumps(request, sort_keys=True), json.dumps(data), fetched_at))
            conn.commit()
        return data, {"cache": "miss", "fetched_at": fetched_at, "is_stale": False}

    # ------------------------------------------------------------- persist --
    def _persist(self, conn, papers: list[dict]) -> None:
        now = dt.datetime.now(dt.UTC).replace(microsecond=0).isoformat()
        with _lock:
            for p in papers:
                pid = p["paper_id"]
                existing = conn.execute("SELECT provider_json, abstract, first_seen_at FROM external_papers WHERE "
                                        "paper_id=?", (pid,)).fetchone()
                prov = json.loads(existing["provider_json"]) if existing else {}
                prov.update(p["providers"])
                abstract = p.get("abstract") or (existing["abstract"] if existing else None)
                try:
                    conn.execute(
                        "INSERT OR REPLACE INTO external_papers VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
                        (pid, p.get("doi"), p.get("canonical_url"), p["title"], json.dumps(p.get("authors", [])),
                         p.get("year"), p.get("venue"), abstract, "abstract" if abstract else "metadata",
                         None if p.get("is_open_access") is None else int(bool(p.get("is_open_access"))),
                         json.dumps(prov), existing["first_seen_at"] if existing else now, now))
                except sqlite3.IntegrityError:
                    pass  # DOI already stored under another id; keep first
            conn.commit()

    # -------------------------------------------------------------- search --
    def search(self, conn, query: str, sources: list[str] | None = None, page: int = 1, size: int = 10,
               year_min: int | None = None, year_max: int | None = None, author: str | None = None,
               open_access: bool | None = None, sort: str = "relevance") -> dict:
        query = (query or "").strip()
        if not query:
            raise bad_request("Query is required.")
        if len(query) > 300:
            raise bad_request("Query too long (max 300 characters).")
        if not (1 <= size <= 25) or page < 1 or page > 20:
            raise bad_request("size must be 1-25 and page 1-20")
        if sort not in ("relevance", "date"):
            raise bad_request("sort must be relevance or date")
        doi = normalize_doi(query)
        if doi and len(query) <= len(doi) + 20:
            res = self.lookup_doi(conn, doi)
            return {"query": query, "mode": "doi", "providers": res["providers"], "total": 1 if res["paper"] else 0,
                    "results": [res["paper"]] if res["paper"] else [], "page": 1, "size": size,
                    "fulltext_policy": FULLTEXT_POLICY}
        sources = [s for s in (sources or list(PROVIDERS)) if s]
        bad = [s for s in sources if s not in PROVIDERS]
        if bad:
            raise bad_request(f"Unknown source(s): {', '.join(bad)}. Use ntrs, openalex.")
        req = {"q": query, "page": page, "size": size, "year_min": year_min, "year_max": year_max,
               "author": author, "oa": open_access, "sort": sort}

        def run(provider: str):
            if provider == "ntrs":
                def fetch():
                    total, items = self.ntrs.search(query, page, size, year_min, year_max, author)
                    return {"total": total, "items": [i.to_dict() for i in items]}
            else:
                def fetch():
                    q = f"{query} {author}" if author else query
                    total, items = self.openalex.search(q, page, size, year_min, year_max, open_access, sort)
                    return {"total": total, "items": [i.to_dict() for i in items]}
            return self._cached(conn, provider, req, fetch)

        statuses, merged, totals = {}, [], {}
        with ThreadPoolExecutor(max_workers=len(sources)) as ex:
            futures = {p: ex.submit(run, p) for p in sources}
            for p, fut in futures.items():
                try:
                    data, meta = fut.result()
                    statuses[p] = {"status": "stale_cache" if meta["is_stale"] else "ok", **meta,
                                   "returned": len(data["items"]), "total": data["total"]}
                    totals[p] = data["total"]
                    for rank, item in enumerate(data["items"], start=1):
                        merged.append((p, rank, item))
                except ProviderError as exc:
                    statuses[p] = {"status": "unavailable", "error": str(exc), "http_status": exc.status,
                                   "retry_after": exc.retry_after}
        results = dedupe(merged)
        listed = {}
        for r in conn.execute("SELECT lower(doi) d, investigation_id FROM investigation_publications WHERE doi IS NOT NULL"):
            nd = normalize_doi(r["d"])
            if nd:
                listed.setdefault(nd, set()).add(r["investigation_id"])
        for r in results:
            r["nasa_psi_listed"] = sorted(listed.get(r.get("doi") or "", []))
        if open_access is not None:
            results = [r for r in results if r.get("is_open_access") is None or r["is_open_access"] == open_access]
        if sort == "date":
            results.sort(key=lambda r: -(r.get("year") or 0))
        self._persist(conn, results)
        any_ok = any(s["status"] != "unavailable" for s in statuses.values())
        return {"query": query, "mode": "search", "providers": statuses, "provider_totals": totals,
                "total": len(results), "results": results, "page": page, "size": size,
                "external_available": any_ok,
                "message": None if any_ok else "External sources temporarily unavailable. Local data and evidence "
                                               "search remain fully functional.",
                "fulltext_policy": FULLTEXT_POLICY}

    # ----------------------------------------------------------------- DOI --
    def lookup_doi(self, conn, doi: str) -> dict:
        d = normalize_doi(doi)
        if not d:
            raise bad_request("Not a valid DOI (expected 10.xxxx/...).")
        statuses, found = {}, []
        for name, fn in (("crossref", lambda: self.crossref.get_by_doi(d).to_dict()),
                         ("openalex", lambda: self.openalex.get_by_doi(d).to_dict())):
            try:
                data, meta = self._cached(conn, name, {"doi": d}, fn)
                statuses[name] = {"status": "stale_cache" if meta["is_stale"] else "ok", **meta}
                found.append((name, 1, data))
            except ProviderError as exc:
                statuses[name] = {"status": "not_found" if exc.status == 404 else "unavailable", "error": str(exc)}
        merged = dedupe(found)
        paper = merged[0] if merged else None
        verified = statuses.get("crossref", {}).get("status") in ("ok", "stale_cache")
        if paper:
            paper["doi_verified_by"] = [n for n, s in statuses.items() if s["status"] in ("ok", "stale_cache")]
            self._persist(conn, [paper])
        nasa = [dict(r) for r in conn.execute(
            "SELECT investigation_id, title FROM investigation_publications WHERE lower(doi)=?", (d,))]
        return {"doi": d, "verified": verified, "paper": paper, "providers": statuses,
                "listed_in_nasa_psi_metadata": nasa,
                "note": None if paper else "DOI could not be resolved by Crossref or OpenAlex (or providers unavailable)."}

    # ------------------------------------------------------------- related --
    def related(self, conn, paper_id: str) -> dict:
        row = conn.execute("SELECT * FROM external_papers WHERE paper_id=?", (paper_id,)).fetchone()
        if not row:
            raise not_found("Paper", paper_id)
        prov = json.loads(row["provider_json"])
        oa_id = (prov.get("openalex") or {}).get("provider_id")
        statuses: dict[str, Any] = {}
        if not oa_id and row["doi"]:
            try:
                data, meta = self._cached(conn, "openalex", {"doi": row["doi"]},
                                          lambda: self.openalex.get_by_doi(row["doi"]).to_dict())
                oa_id = data["provider_id"]
                prov["openalex"] = {"provider_id": oa_id, "related_ids": data.get("related_ids", []),
                                    "referenced_ids": data.get("referenced_ids", [])}
            except ProviderError as exc:
                statuses["openalex"] = {"status": "unavailable", "error": str(exc)}
        groups: dict[str, list] = {"references": [], "related": []}
        if oa_id:
            meta_src = prov.get("openalex") or {}
            for rel, ids in (("references", meta_src.get("referenced_ids", [])),
                             ("related", meta_src.get("related_ids", []))):
                ids = ids[:12]
                if not ids:
                    continue
                try:
                    data, meta = self._cached(conn, "openalex", {"many": ids},
                                              lambda ids=ids: {"items": [p.to_dict() for p in self.openalex.get_many(ids)]})
                    statuses[f"openalex_{rel}"] = {"status": "stale_cache" if meta["is_stale"] else "ok", **meta}
                    groups[rel] = dedupe([("openalex", i + 1, it) for i, it in enumerate(data["items"])])
                except ProviderError as exc:
                    statuses[f"openalex_{rel}"] = {"status": "unavailable", "error": str(exc)}
        self._persist(conn, groups["references"] + groups["related"])
        return {"paper_id": paper_id, "title": row["title"], "providers": statuses,
                "references": groups["references"], "related": groups["related"],
                "relation_semantics": {
                    "references": "Works this paper cites (citation link from OpenAlex).",
                    "related": "OpenAlex 'related works' (concept similarity, NOT a citation link)."},
                "note": None if oa_id else "No OpenAlex record for this paper; related works unavailable."}


FULLTEXT_POLICY = ("SpaceFire stores metadata and API-provided abstracts only. External full texts are linked, "
                   "never downloaded or analyzed; 'abstract' means only the abstract was available.")


def paper_key(item: dict) -> str:
    if item.get("doi"):
        return f"doi:{item['doi']}"
    return f"{item['provider']}:{item['provider_id']}"


def dedupe(merged: list[tuple[str, int, dict]]) -> list[dict]:
    """Merge provider records; exact DOI match is the only dedupe key (titles may legitimately repeat)."""
    out: dict[str, dict] = {}
    order: list[str] = []
    for provider, rank, item in merged:
        key = paper_key(item)
        cur = out.get(key)
        if cur is None:
            cur = {"paper_id": key, "doi": item.get("doi"), "title": item["title"], "authors": item.get("authors", []),
                   "year": item.get("year"), "venue": item.get("venue"), "canonical_url": item.get("canonical_url"),
                   "abstract": item.get("abstract"), "is_open_access": item.get("is_open_access"),
                   "fulltext_url": item.get("fulltext_url"), "doc_type": item.get("doc_type"),
                   "cited_by_count": item.get("cited_by_count"), "keywords": item.get("keywords", []),
                   "providers": {}, "best_rank": rank, "fulltext_read": False}
            out[key] = cur
            order.append(key)
        else:
            cur["best_rank"] = min(cur["best_rank"], rank)
            for f in ("abstract", "venue", "year", "fulltext_url", "doc_type", "cited_by_count"):
                if not cur.get(f) and item.get(f):
                    cur[f] = item[f]
            if len(item.get("authors", [])) > len(cur["authors"]):
                cur["authors"] = item["authors"]
            if cur.get("is_open_access") is None:
                cur["is_open_access"] = item.get("is_open_access")
        cur["providers"][provider] = {"provider_id": item["provider_id"], "rank": rank,
                                      "url": item.get("canonical_url"),
                                      "related_ids": item.get("related_ids", []),
                                      "referenced_ids": item.get("referenced_ids", [])}
    res = [out[k] for k in order]
    for r in res:
        r["access_type"] = "abstract" if r.get("abstract") else "metadata"
        r["found_in"] = sorted(r["providers"])
    res.sort(key=lambda r: (r["best_rank"], -len(r["providers"])))
    return res


def investigation_publications(conn: sqlite3.Connection, investigation_id: str | None) -> list[dict]:
    sql = "SELECT investigation_id, title, authors, doi, status FROM investigation_publications"
    args: list = []
    if investigation_id:
        sql += " WHERE investigation_id=?"
        args.append(investigation_id)
    out = []
    for r in conn.execute(sql + " ORDER BY investigation_id, title", args):
        d = dict(r)
        d["doi"] = normalize_doi(d["doi"])
        d["source"] = "NASA PSI ISA-Tab metadata (listed publication; content not read)"
        out.append(d)
    return out


_service: Literature | None = None


def get_literature() -> Literature:
    global _service
    if _service is None:
        _service = Literature()
    return _service


def set_literature(svc: Literature | None) -> None:
    global _service
    _service = svc


_ = (ApiError, re, PaperDTO)

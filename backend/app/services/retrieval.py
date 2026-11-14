"""Hybrid evidence retrieval over local NASA documents (+ cached external abstracts).

lexical: SQLite FTS5 BM25 (title/section weighted) + exact-phrase/ID checks
semantic: local LSA vectors (services/vectors.py)
fusion:   reciprocal rank fusion (k=60) + transparent, documented boosts

The returned score is a *retrieval relevance* score, not a probability that a
claim is true. Labels ("High relevance", "Related background", "Metadata-only")
and human-readable reasons are returned with every hit. Snippets are verbatim
substrings of the indexed chunk text.
"""
from __future__ import annotations

import re
import sqlite3
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

from ..core.config import get_settings
from ..core.errors import bad_request, not_found
from ..db.database import jloads
from .vectors import LsaIndex

RRF_K = 60
SUPERSCRIPT = str.maketrans("⁰¹²³⁴⁵⁶⁷⁸⁹₀₁₂₃₄₅₆₇₈₉", "01234567890123456789")
SYNONYMS = {
    "d2": ["d2", "squared", "d-square law", "burning rate", "droplet diameter"],
    "extinguishment": ["extinguishment", "extinction"],
    "extinction": ["extinction", "extinguishment", "extinguished"],
    "co2": ["co2", "carbon dioxide"],
    "o2": ["o2", "oxygen"],
    "sibal": ["sibal", "cotton"],
    "pmma": ["pmma", "polymethylmethacrylate"],
}
STOP = {"the", "a", "an", "of", "and", "or", "in", "on", "for", "to", "is", "are", "what", "how", "does", "do",
        "with", "by", "from", "at", "as", "be", "this", "that", "which", "why", "when", "about", "data", "nasa",
        "show", "me", "tell", "find", "it", "its", "was", "were", "can", "between", "vs"}
DOC_TYPE_WEIGHT = {"nasa_report": 1.0, "data_description": 1.0, "paper": 0.9, "slides": 0.85, "metadata": 0.8,
                   "requirements": 0.8, "procedure": 0.8, "engineering": 0.75, "operations": 0.9}
ID_RE = re.compile(r"\b(\d{2,3}CAL\d{2}|\d{3}[FR]\d{3}|[CHN]\d{2}[MH]\d{3}|[BFMOPT]\d{1,2}[ab]?|S[12](?:C[12])?)\b")
TABLE_RE = re.compile(r"\b(Table|Figure|Appendix)\s+([A-Z]?\d+(?:\.\d+)?)", re.I)


@lru_cache
def _lsa(processed_dir: str) -> LsaIndex | None:
    return LsaIndex.load(Path(processed_dir))


def lsa_index() -> LsaIndex | None:
    return _lsa(str(get_settings().processed_dir))


@lru_cache
def _neural(processed_dir: str):
    from .neural import NeuralIndex
    return NeuralIndex.load(Path(processed_dir))


def dense_indexes() -> list[tuple[str, object, float]]:
    """Dense retrievers per RETRIEVAL_DENSE (lsa | neural | both). Missing indexes are skipped (graceful)."""
    mode = get_settings().retrieval_dense.lower()
    out = []
    if mode in ("lsa", "both"):
        idx = lsa_index()
        if idx is not None:
            out.append(("LSA", idx, 0.05))
    if mode in ("neural", "both"):
        try:
            idx = _neural(str(get_settings().processed_dir))
        except Exception:  # noqa: BLE001 - optional dependency
            idx = None
        if idx is not None:
            out.append(("bge-small", idx, 0.3))
    return out


def normalize_query(q: str) -> str:
    q = q.translate(SUPERSCRIPT).replace("^2", "2").replace("²", "2")
    return " ".join(q.split())


def query_terms(q: str) -> list[str]:
    toks = re.findall(r"[A-Za-z0-9][A-Za-z0-9\-']*", q)
    out = []
    for t in toks:
        tl = t.lower().strip("-'")
        if not tl or tl in STOP:
            continue
        if "-" in tl:
            out += [p for p in tl.split("-") if p and p not in STOP]
        else:
            out.append(tl)
    seen, res = set(), []
    for t in out:
        for s in SYNONYMS.get(t, [t]):
            # multi-word synonyms stay phrases ("burning rate"); FTS5 tokenizes hyphens as separators
            s = s.replace("-", " ")
            if s not in seen:
                seen.add(s)
                res.append(s)
    return res[:24]


def query_groups(q: str) -> list[list[str]]:
    """One synonym group per meaningful query word (used for explainable concept coverage)."""
    groups, seen = [], set()
    for t in re.findall(r"[A-Za-z0-9][A-Za-z0-9\-']*", q):
        tl = t.lower().strip("-'")
        parts = [p for p in tl.split("-") if p] if "-" in tl else [tl]
        for p in parts:
            if p in STOP or p in seen:
                continue
            seen.add(p)
            groups.append([s.replace("-", " ") for s in SYNONYMS.get(p, [p])])
    return groups[:12]


def fts_query(terms: list[str]) -> str:
    return " OR ".join('"' + t.replace('"', "") + '"' for t in terms)


def term_in(term: str, text_low: str) -> bool:
    return re.search(r"\b" + r"[\s\-]+".join(map(re.escape, term.split())), text_low) is not None


@dataclass
class Hit:
    chunk_id: str
    lexical_rank: int | None = None
    lexical_score: float | None = None
    semantic_rank: int | None = None
    semantic_score: float | None = None
    fused: float = 0.0
    reasons: list[str] = field(default_factory=list)
    dense_ranks: dict[str, int] = field(default_factory=dict)
    boosts: dict[str, float] = field(default_factory=dict)


def make_snippet(text: str, terms: list[str], phrases: list[str], width: int = 360) -> str:
    low = text.lower()
    pos = -1
    for p in phrases:
        pos = low.find(p.lower())
        if pos >= 0:
            break
    if pos < 0:
        best = None
        for t in terms:
            m = re.search(r"\b" + r"[\s\-]+".join(map(re.escape, t.split())), low)
            if m and (best is None or m.start() < best):
                best = m.start()
        pos = best if best is not None else 0
    start = max(0, pos - width // 3)
    # snap to a word boundary
    if start > 0:
        sp = text.find(" ", start)
        start = sp + 1 if 0 <= sp < pos else start
    end = min(len(text), start + width)
    return text[start:end]


def citation_string(doc_title: str, page_pdf: int | None, page_printed: int | None, section: str | None) -> str:
    s = doc_title
    if page_pdf:
        s += f", PDF p.{page_pdf}"
        if page_printed:
            s += f" (printed p.{page_printed})"
    elif section:
        s += f", section '{section[:60]}'"
    return s


def search(conn: sqlite3.Connection, q: str, investigation: str | None = None, doc_type: str | None = None,
           source_type: str = "all", year_min: int | None = None, year_max: int | None = None,
           limit: int = 20, offset: int = 0) -> dict:
    if not q or not q.strip():
        raise bad_request("Query text is required.")
    if len(q) > 500:
        raise bad_request("Query is too long (max 500 characters).")
    if source_type not in ("all", "nasa_document", "external_abstract"):
        raise bad_request("source_type must be all, nasa_document or external_abstract")
    if not (1 <= limit <= 50):
        raise bad_request("limit must be between 1 and 50")
    qn = normalize_query(q)
    terms = query_terms(qn)
    groups = query_groups(qn)
    phrases = [m.group(0) for m in TABLE_RE.finditer(qn)]
    words = [w for w in re.findall(r"[A-Za-z0-9\-\.']+", qn) if w.lower() not in STOP]
    if len(words) >= 2:
        phrases.append(" ".join(words[:6]))
    ids = list(dict.fromkeys(ID_RE.findall(qn)))

    results: list[dict] = []
    mode = {"lexical": True, "semantic": False}
    if source_type in ("all", "nasa_document"):
        allowed_rows = conn.execute(
            "SELECT c.chunk_id, d.investigation_id, d.doc_type, d.year FROM document_chunks c JOIN documents d "
            "USING(document_id)").fetchall()
        allowed = {r["chunk_id"] for r in allowed_rows
                   if (not investigation or r["investigation_id"] == investigation)
                   and (not doc_type or r["doc_type"] == doc_type)
                   and (year_min is None or (r["year"] or 0) >= year_min)
                   and (year_max is None or (r["year"] or 9999) <= year_max)}
        hits: dict[str, Hit] = {}
        if terms:
            rows = conn.execute(
                "SELECT chunk_id, bm25(chunks_fts, 0.0, 0.4, 1.5, 1.0) AS s FROM chunks_fts WHERE chunks_fts MATCH ? "
                "ORDER BY s LIMIT 300", (fts_query(terms),)).fetchall()
            rank = 0
            for r in rows:
                if r["chunk_id"] not in allowed:
                    continue
                rank += 1
                hits[r["chunk_id"]] = Hit(r["chunk_id"], lexical_rank=rank, lexical_score=-float(r["s"]))
        for name, idx, floor in dense_indexes():
            mode["semantic"] = True
            mode.setdefault("dense", []).append(name)
            for rank, (cid, sim) in enumerate(idx.search(qn, k=80, allowed=allowed), start=1):
                if sim <= floor:
                    break
                h = hits.setdefault(cid, Hit(cid))
                h.dense_ranks[name] = rank
                if h.semantic_rank is None or rank < h.semantic_rank:
                    h.semantic_rank, h.semantic_score = rank, sim
        # exact-ID linkage
        id_chunks: dict[str, set[str]] = {}
        for ident in ids:
            rows = conn.execute(
                "SELECT l.chunk_id FROM evidence_links l JOIN experiments e USING(experiment_uid) "
                "WHERE e.display_id = ?", (ident,)).fetchall()
            id_chunks[ident] = {r["chunk_id"] for r in rows if r["chunk_id"] in allowed}
            for cid in id_chunks[ident]:
                hits.setdefault(cid, Hit(cid))
        if not hits:
            pass
        meta = {}
        if hits:
            keys = list(hits)
            for i in range(0, len(keys), 500):
                part = keys[i:i + 500]
                for r in conn.execute(
                        "SELECT c.chunk_id, c.document_id, c.page_pdf, c.page_printed, c.section, c.text, d.title, "
                        "d.investigation_id, d.doc_type, d.year, d.relative_path, d.scope_note FROM document_chunks c "
                        f"JOIN documents d USING(document_id) WHERE c.chunk_id IN ({','.join('?' * len(part))})", part):
                    meta[r["chunk_id"]] = dict(r)
        for cid, h in hits.items():
            m = meta[cid]
            text_low = m["text"].lower()
            if h.lexical_rank:
                h.fused += 1.0 / (RRF_K + h.lexical_rank)
            for r_ in h.dense_ranks.values():
                h.fused += 1.0 / (RRF_K + r_)
            for p in phrases:
                if p.lower() in text_low:
                    h.boosts["exact_phrase"] = 0.02
                    h.reasons.append(f"Exact phrase: \"{p}\"")
                    break
            for ident, cs in id_chunks.items():
                if cid in cs:
                    h.boosts["exact_id"] = 0.03
                    h.reasons.append(f"Exact test {ident}")
            # concept coverage: a query word counts as matched if any of its synonyms occurs in the chunk
            matched_groups = [g for g in groups if any(term_in(t, text_low) for t in g)]
            coverage = len(matched_groups) / len(groups) if groups else 0.0
            h.boosts_meta = {"coverage": coverage}
            title_terms = [g[0] for g in groups if g[0] in m["title"].lower()]
            if title_terms:
                h.reasons.append("Title match: " + ", ".join(title_terms[:3]))
            if groups:
                h.reasons.append(f"Covers {len(matched_groups)}/{len(groups)} query concepts")
            if h.semantic_rank and h.semantic_rank <= 10:
                h.reasons.append("Semantic neighbor (" + ", ".join(k for k, v in h.dense_ranks.items() if v <= 10) + ")")
            w = DOC_TYPE_WEIGHT.get(m["doc_type"], 0.8)
            nwords = len(m["text"].split())
            quality = 1.0
            if m["text"].count(". .") > 15:
                quality *= 0.3
                h.reasons.append("Table-of-contents page (down-weighted)")
            elif nwords < 40:
                quality *= 0.6
                h.reasons.append("Very short passage (down-weighted)")
            h.fused = h.fused * w * quality * (0.4 + 0.6 * coverage) + sum(h.boosts.values())
            page = f"NASA document, PDF p.{m['page_pdf']}" if m["page_pdf"] else "NASA document"
            h.reasons.insert(0, page)
            if m["scope_note"] and ("not" in m["scope_note"].lower() or "FLEX-2" in m["scope_note"]):
                h.reasons.append("Scope caution: " + m["scope_note"][:120])
        ranked = sorted(hits.values(), key=lambda x: (-x.fused, x.chunk_id))
        for h in ranked:
            m = meta[h.chunk_id]
            cov = getattr(h, "boosts_meta", {}).get("coverage", 0.0)
            strong = ("exact_id" in h.boosts or "exact_phrase" in h.boosts or
                      (h.lexical_rank is not None and h.lexical_rank <= 10 and cov >= 0.5))
            label = "High relevance" if strong else "Related background"
            links = [dict(r) for r in conn.execute(
                "SELECT DISTINCT experiment_uid, matched_text FROM evidence_links WHERE chunk_id=? LIMIT 8",
                (h.chunk_id,))]
            results.append({
                "result_type": "nasa_document", "evidence_id": h.chunk_id, "chunk_id": h.chunk_id,
                "document_id": m["document_id"], "title": m["title"], "investigation_id": m["investigation_id"],
                "doc_type": m["doc_type"], "year": m["year"], "page_pdf": m["page_pdf"],
                "page_printed": m["page_printed"], "section": m["section"],
                "snippet": make_snippet(m["text"], terms, phrases),
                "citation": citation_string(m["title"], m["page_pdf"], m["page_printed"], m["section"]),
                "source_url": f"/api/v1/documents/{m['document_id']}/file" + (f"#page={m['page_pdf']}" if m["page_pdf"] else ""),
                "access_level": "fulltext", "rank_label": label, "reasons": list(dict.fromkeys(h.reasons)),
                "scores": {"fused": round(h.fused, 5), "lexical_rank": h.lexical_rank,
                           "semantic_rank": h.semantic_rank,
                           "semantic_similarity": round(h.semantic_score, 4) if h.semantic_score else None},
                "linked_experiments": links,
            })

    if source_type in ("all", "external_abstract"):
        results += _external_hits(conn, terms, phrases, year_min, year_max)
        results.sort(key=lambda r: -r["scores"]["fused"])

    total = len(results)
    page = results[offset: offset + limit]
    exp_matches = []
    for ident in ids:
        for r in conn.execute("SELECT experiment_uid, investigation_id, display_id, source_row FROM experiments "
                              "WHERE display_id=?", (ident,)):
            d = dict(r)
            d["report_records"] = [dict(x) for x in conn.execute(
                "SELECT table_id, page_pdf, page_printed, verification FROM report_records WHERE experiment_uid=?",
                (d["experiment_uid"],))]
            exp_matches.append(d)
    return {"query": q, "normalized_query": qn, "terms": terms, "total": total, "offset": offset, "limit": limit,
            "experiment_matches": exp_matches,
            "retrieval_mode": ("hybrid (BM25 + " + " + ".join(mode.get("dense", [])) + ")") if mode["semantic"] else "lexical-only (BM25)",
            "score_note": "Scores rank retrieval relevance only; they are not calibrated confidence in a claim.",
            "results": page}


def _external_hits(conn, terms, phrases, year_min, year_max) -> list[dict]:
    if not terms:
        return []
    rows = conn.execute("SELECT * FROM external_papers").fetchall()
    out = []
    for r in rows:
        if year_min and (r["year"] or 0) < year_min:
            continue
        if year_max and (r["year"] or 9999) > year_max:
            continue
        hay = ((r["title"] or "") + " " + (r["abstract"] or "")).lower()
        matched = [t for t in terms if term_in(t, hay)]
        if len(matched) < max(1, len(terms) // 2):
            continue
        cov = len(matched) / len(terms)
        access = r["access_type"]
        fused = 0.012 * cov * (1.0 if access == "abstract" else 0.6)
        reasons = [f"External {'abstract only' if access == 'abstract' else 'metadata only'}",
                   f"Matches {len(matched)}/{len(terms)} query terms"]
        text = r["abstract"] or r["title"]
        out.append({
            "result_type": "external_abstract", "evidence_id": r["paper_id"], "chunk_id": None,
            "document_id": None, "title": r["title"], "investigation_id": None, "doc_type": "external_paper",
            "year": r["year"], "page_pdf": None, "page_printed": None, "section": None,
            "snippet": make_snippet(text, terms, phrases), "citation": f"{r['title']} ({r['year'] or 'n.d.'})"
            + (f", doi:{r['doi']}" if r["doi"] else ""),
            "source_url": r["canonical_url"], "access_level": access,
            "rank_label": "Metadata-only" if access != "abstract" else "Related background",
            "reasons": reasons, "scores": {"fused": round(fused, 5), "lexical_rank": None, "semantic_rank": None,
                                           "semantic_similarity": None},
            "linked_experiments": [],
        })
    return out


def get_chunk(conn: sqlite3.Connection, chunk_id: str) -> dict:
    r = conn.execute(
        "SELECT c.*, d.title, d.investigation_id, d.doc_type, d.relative_path, d.year, d.authors, d.scope_note "
        "FROM document_chunks c JOIN documents d USING(document_id) WHERE c.chunk_id=?", (chunk_id,)).fetchone()
    if not r:
        raise not_found("Evidence chunk", chunk_id)
    d = dict(r)
    d["citation"] = citation_string(d["title"], d["page_pdf"], d["page_printed"], d["section"])
    d["source_url"] = f"/api/v1/documents/{d['document_id']}/file" + (f"#page={d['page_pdf']}" if d["page_pdf"] else "")
    d["linked_experiments"] = [dict(x) for x in conn.execute(
        "SELECT l.experiment_uid, l.matched_text, l.match_method, l.review_status, e.display_id FROM evidence_links l "
        "JOIN experiments e USING(experiment_uid) WHERE l.chunk_id=?", (chunk_id,))]
    neighbors = conn.execute(
        "SELECT chunk_id, page_pdf, ordinal FROM document_chunks WHERE document_id=? AND ordinal IN (?, ?)",
        (d["document_id"], d["ordinal"] - 1, d["ordinal"] + 1)).fetchall()
    d["neighbors"] = [dict(n) for n in neighbors]
    return d


def list_documents(conn: sqlite3.Connection, investigation: str | None = None) -> list[dict]:
    sql = ("SELECT d.*, s.sha256, s.size_bytes, (SELECT count(*) FROM document_chunks c WHERE "
           "c.document_id=d.document_id) AS chunk_count FROM documents d JOIN source_files s USING(source_id)")
    args: list = []
    if investigation:
        sql += " WHERE d.investigation_id=?"
        args.append(investigation)
    sql += " ORDER BY d.investigation_id, d.title"
    out = []
    for r in conn.execute(sql, args):
        d = dict(r)
        d["low_text_pages"] = jloads(d.pop("low_text_pages_json"), [])
        d["file_url"] = f"/api/v1/documents/{d['document_id']}/file"
        out.append(d)
    return out


def get_document(conn: sqlite3.Connection, document_id: str) -> dict:
    docs = [d for d in list_documents(conn) if d["document_id"] == document_id]
    if not docs:
        raise not_found("Document", document_id)
    d = docs[0]
    d["pages_indexed"] = [r[0] for r in conn.execute(
        "SELECT DISTINCT page_pdf FROM document_chunks WHERE document_id=? AND page_pdf IS NOT NULL ORDER BY 1",
        (document_id,))]
    return d

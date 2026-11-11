"""Experiment-ID -> document-passage linking with explicit confidence.

Link levels (stored in evidence_links.review_status):
  verified_table_row  the passage is the report page holding a curated table row whose values
                      were checked against the CSV (strongest).
  exact_context       the ID appears with explicit context ("test M5", "GMT175-T9" with a matching
                      day-of-year, "FLEX-145", a distinctive FLEX identifier like C01M201).
  manually_reviewed   an auto_unreviewed mention that a person checked in context against the curated
                      report row (run number, sample, GMT day); relation_type then says whether the
                      passage is the test's own row, a figure caption about it, or a cross-reference
                      inside another test's notes (app/curation/link_reviews.json).
  auto_unreviewed     a bare mention of a non-ambiguous ID in a document of the same investigation.
Excluded (never linked; reason kept in the ingest report):
  ambiguous_token     the ID is also an ordinary token (O2 = oxygen, F2 = SD-card/camera labels,
                      S1 = camera prefix) and has no test context.
  collision           GMT-prefixed ID whose day-of-year does not match the BASS-II test (an
                      earlier BASS (I) test with the same name).
  label_reference     preceded by Table/Figure/Appendix/Eq. (e.g. "Table B1").
"""
from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from pathlib import Path

# Tokens that coincide with BASS-II/SAFFIRE test IDs but usually mean something else.
AMBIGUOUS = {
    "O2": "oxygen (chemical formula)",
    "F1": "flow-visualization image set / camera label",
    "F2": "SD-card / camera / image-set label",
    "F3": "camera label", "F4": "SD-card label",
    "S1": "camera/sample prefix", "S2": "camera/sample prefix",
}
TEST_CONTEXT = re.compile(r"(?i)(\b(tests?|run|burns?|sample)\s*(?:#|no\.?|number)?|BASS[\s\-‐‑]*II;?)\s*$")
LABEL_CONTEXT = re.compile(r"(?i)(table|figure|fig\.|appendix|eq\.|equation|section)\s*$")
FLEX_ID_RE = re.compile(r"\b(\d{2,3}CAL\d{2}|\d{3}[FR]\d{3}|[CHN]\d{2}[MH]\d{3})\b")
FLEX_NUM_RE = re.compile(r"\bFLEX-(\d{3})\b")
GMT_ID_RE = re.compile(r"\bGMT\s?(\d{2,3})\s?[-‐‑–]\s?(T\d{1,2}[ab]?)\b")
SAF_RE = re.compile(r"\b(S[12])(C[12])?\b")


def classify_bass_mention(text: str, start: int, end: int, ident: str, gmt_by_id: dict[str, int]) -> tuple[str, str]:
    """Return (level, reason) for one regex match of a BASS-II test ID inside `text`."""
    before = text[max(0, start - 14):start]
    if LABEL_CONTEXT.search(before):
        return "excluded", "label_reference"
    window = text[max(0, start - 10):end]
    g = GMT_ID_RE.search(window)
    if g and g.group(2) == ident:
        doy = int(g.group(1))
        if gmt_by_id.get(ident) == doy:
            return "exact_context", f"GMT{doy}-{ident} matches the test's day-of-year"
        return "excluded", f"collision: GMT{doy}-{ident} is not BASS-II {ident} (day {gmt_by_id.get(ident)})"
    if TEST_CONTEXT.search(before):
        return "exact_context", "preceded by test/run/sample"
    if ident in AMBIGUOUS:
        return "excluded", f"ambiguous_token: {ident} usually means {AMBIGUOUS[ident]}"
    return "auto_unreviewed", "bare mention"


def link_all(conn, chunks_by_inv: dict[str, list[dict]], curated_rows: list[dict]) -> tuple[list[tuple], dict]:
    """Build evidence_links rows. Returns (rows, report)."""
    rows: list[tuple] = []
    report: Counter = Counter()
    excluded: list[dict] = []
    seen: set[tuple[str, str]] = set()

    def add(uid, chunk_id, rel, method, matched, level):
        key = (uid, chunk_id)
        if key in seen:
            return
        seen.add(key)
        rows.append((uid, chunk_id, rel, method, matched, level))
        report[level] += 1

    # 1. verified table rows (curated BASS-II report tables)
    by_page: dict[int, list[dict]] = defaultdict(list)
    for c in chunks_by_inv.get("PSI-25", []):
        if c["document_id"] == "bass-ii-summary-report" and c["page_pdf"]:
            by_page[c["page_pdf"]].append(c)
    for r in curated_rows:
        if r.get("verification") != "verified" or not r.get("experiment_uid"):
            continue
        key = r.get("row_key") or r["test_id"]
        cands = [c for c in by_page.get(r["page_pdf"], []) if re.search(rf"(?<![A-Za-z0-9]){re.escape(key)}(?![A-Za-z0-9])", c["text"])]
        for c in cands[:1] or by_page.get(r["page_pdf"], [])[:1]:
            add(r["experiment_uid"], c["chunk_id"], "table_row", f"curated_table_{r['table']}", key, "verified_table_row")

    # 2. FLEX: distinctive identifiers and FLEX-### test numbers
    flex_ids = defaultdict(list)
    flex_nums = {}
    for r in conn.execute("SELECT experiment_uid, identifier, test_number FROM flex_tests"):
        flex_ids[r["identifier"]].append(r["experiment_uid"])
        flex_nums[r["test_number"]] = r["experiment_uid"]
    for ch in chunks_by_inv.get("PSI-69", []):
        for m in set(FLEX_ID_RE.findall(ch["text"])):
            uids = flex_ids.get(m, [])
            level = "exact_context" if len(uids) == 1 else "auto_unreviewed"  # duplicates (193F001) stay unreviewed
            for uid in uids:
                add(uid, ch["chunk_id"], "explicit_id", "flex_identifier", m, level)
        for m in set(FLEX_NUM_RE.findall(ch["text"])):
            uid = flex_nums.get(int(m))
            if uid:
                add(uid, ch["chunk_id"], "explicit_id", "flex_test_number", f"FLEX-{m}", "exact_context")

    # 3. BASS-II: contextual classification of every mention
    bass = {r["test_id"]: (r["experiment_uid"], r["gmt_doy"]) for r in conn.execute(
        "SELECT experiment_uid, test_id, gmt_doy FROM bass2_tests")}
    gmt_by_id = {k: v[1] for k, v in bass.items()}
    rx = re.compile(r"(?<![A-Za-z0-9.\-])(" + "|".join(sorted(map(re.escape, bass), key=len, reverse=True)) +
                    r")(?![A-Za-z0-9])")
    for ch in chunks_by_inv.get("PSI-25", []):
        text = ch["text"]
        best: dict[str, tuple[str, str]] = {}
        rank = {"exact_context": 2, "auto_unreviewed": 1}
        for m in rx.finditer(text):
            ident = m.group(1)
            level, reason = classify_bass_mention(text, m.start(), m.end(), ident, gmt_by_id)
            if level == "excluded":
                report["excluded"] += 1
                if len(excluded) < 400:
                    excluded.append({"chunk_id": ch["chunk_id"], "id": ident, "reason": reason})
                continue
            if ident not in best or rank[level] > rank[best[ident][0]]:
                best[ident] = (level, reason)
        for ident, (level, reason) in best.items():
            add(bass[ident][0], ch["chunk_id"], "explicit_id", f"bass_id ({reason})", ident, level)

    # 4. SAFFIRE-I: S1/S2 (camera prefixes S1C1 etc. count as the same sample's image set)
    for ch in chunks_by_inv.get("PSI-98", []):
        for s, cam in set(SAF_RE.findall(ch["text"])):
            add(f"saffire1:{s}", ch["chunk_id"], "explicit_id", "saffire_sample", s + cam,
                "exact_context" if cam else "auto_unreviewed")

    rows, applied, stale = apply_reviews(rows)
    report = Counter(r[5] for r in rows) + Counter({"excluded": report["excluded"]})
    excl_reasons = Counter(e["reason"].split(":")[0] for e in excluded)
    return rows, {"links_by_level": dict(report), "excluded_examples": excluded[:40],
                  "excluded_by_reason": dict(excl_reasons),
                  "manual_reviews": {"applied": applied, "stale": stale}}


REVIEWS_PATH = Path(__file__).resolve().parents[1] / "curation" / "link_reviews.json"


def load_reviews() -> dict:
    return json.loads(REVIEWS_PATH.read_text(encoding="utf-8"))


def apply_reviews(rows: list[tuple]) -> tuple[list[tuple], int, list[dict]]:
    """Upgrade `auto_unreviewed` links that a person reviewed (app/curation/link_reviews.json) to
    `manually_reviewed`, with the reviewed relation (own table row / figure caption / cross-reference).
    Reviews that no longer match a generated link are returned as `stale` so a re-chunking cannot silently
    drop or misapply a review."""
    data = load_reviews()
    decisions = data["decisions"]
    by_key = {(r["experiment_uid"], r["chunk_id"]): r for r in data["reviews"]}
    out, used = [], set()
    for uid, chunk_id, rel, method, matched, level in rows:
        rv = by_key.get((uid, chunk_id))
        if rv and level == "auto_unreviewed" and rv["matched"] == matched:
            d = decisions[rv["decision"]]
            out.append((uid, chunk_id, d["relation_type"], f"manual_review ({d['label']}): {rv['evidence']}"[:400],
                        matched, "manually_reviewed"))
            used.add((uid, chunk_id))
        else:
            out.append((uid, chunk_id, rel, method, matched, level))
    stale = [r for k, r in by_key.items() if k not in used]
    return out, len(used), stale

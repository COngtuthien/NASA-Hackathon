"""Source-document extraction and page-preserving chunking.

PDF text comes from PyMuPDF page by page; chunks never cross a page, so every
citation carries a real PDF page number. DOCX keeps paragraph+table order with
heading-based sections; PPTX is chunked per slide. Text is verbatim extraction.
"""
from __future__ import annotations

import csv
import io
import re
import zipfile
from dataclasses import dataclass, field
from pathlib import Path

from .common import sha256_text

CHUNK_WORDS = 320
OVERLAP_WORDS = 32
LOW_TEXT_WORDS = 40

# Curated catalog: title/type/scope were verified by reading each document's
# first pages (see research/01_DATA_INVENTORY.md and ingestion report check).
CATALOG: dict[str, dict] = {
    "FLEX/FLEX_EIRD_v4.pdf": dict(
        title="Droplet Flame Extinguishment in Microgravity (FLEX) - Research Requirements Document",
        doc_type="requirements", year=2005, authors="F. A. Williams et al.", inv="PSI-69",
        scope="File name says EIRD; content is the FLEX Research Requirements Document (RRD)."),
    "FLEX/FLEX_Test_Plan.pdf": dict(
        title="FLEX Test Plan (excerpt of the FLEX Research Requirements Document)", doc_type="requirements",
        year=2005, authors="F. A. Williams et al.", inv="PSI-69",
        scope="Pages duplicate content of FLEX_EIRD_v4.pdf (test matrices, LOI procedure)."),
    "FLEX/FLEX Engineering Requirements Document.pdf": dict(
        title="FLEX-2 Engineering Requirements Document (FLX-REQ-0001)", doc_type="requirements", year=2010,
        authors="NASA GRC", inv="PSI-69",
        scope="Applies to FLEX-2, not the FLEX tests in the CSV; use only as engineering context."),
    "FLEX/FLEX Overall Ext File-2.pdf": dict(
        title="Selections from Engineering Documents for FLEX", doc_type="engineering", year=2015,
        authors="G. Berger (compiler)", inv="PSI-69", scope="CIR/MDCA hardware excerpts covering FLEX and FLEX-2."),
    "FLEX/1G17-070HE-0166.pdf": dict(
        title="Isolated Alkane Droplet Combustion in Microgravity: 'Cool Flames'", doc_type="paper", year=2013,
        authors="T. Farouk, F. Dryer", inv="PSI-69", scope="Numerical study compared with ISS n-heptane data."),
    "FLEX/2G11-070HE-0310.pdf": dict(
        title="Effect of Varying the Initial Diameter of n-Octane and n-Decane Droplets in Microgravity",
        doc_type="paper", year=2013, authors="Y. C. Liu et al.", inv="PSI-69",
        scope="Fuels n-octane/n-decane are NOT in the FLEX CSV (methanol, heptane); d^2-law background only."),
    "FLEX/20130010979.pdf": dict(
        title="Dynamics of Water Absorption and Evaporation During Methanol Droplet Combustion in Microgravity",
        doc_type="slides", year=2012, authors="M. C. Hicks et al.", inv="PSI-69", scope=None),
    "FLEX/Cool Flames in Space, a Hot Prospect on Earth!.pdf": dict(
        title="Cool Flames in Space, a Hot Prospect on Earth!", doc_type="slides", year=2013,
        authors="V. Nayagam", inv="PSI-69", scope="Many slides are image-only."),
    "FLEX/FLEX DoD.docx": dict(
        title="FLEX Description of Data", doc_type="data_description", year=None, authors=None, inv="PSI-69",
        scope=None),
    "FLEX/PSI-69_metadata_PSI-133_FLEX/i_Investigation.txt": dict(
        title="PSI-69 FLEX ISA-Tab investigation metadata", doc_type="metadata", year=2016, authors=None,
        inv="PSI-69", scope=None),
    "BASS-II/BASS-II Summary Report.pdf": dict(
        title="BASS-II Summary Report (NASA/TM-20210011385)", doc_type="nasa_report", year=2021,
        authors="S. L. Olson et al.", inv="PSI-25", offset=8,
        scope="Printed page = PDF page - 8. Appendix A wide tables may interleave rows in text extraction."),
    "BASS-II/SRD_BASS-II.pdf": dict(
        title="BASS-II Science Requirements Document", doc_type="requirements", year=None, authors=None,
        inv="PSI-25", scope="Pages 14-16 (some PI test matrices) are images without extractable text."),
    "BASS-II/BASS-II data FAQ.docx": dict(
        title="BASS-II Data FAQ (column definitions)", doc_type="data_description", year=2017, authors=None,
        inv="PSI-25", scope=None),
    "BASS-II/BASS-II Procedure.docx": dict(
        title="BASS-II Crew Procedure", doc_type="procedure", year=None, authors=None, inv="PSI-25", scope=None),
    "BASS-II/BASS-2 Engineering Requirements.pptx": dict(
        title="BASS-2 Engineering Requirements", doc_type="requirements", year=None, authors=None, inv="PSI-25",
        scope=None),
    "BASS-II/PSI-25_metadata_PSI_metadata_PSI-101_BASS-II.zip::i_Investigation.txt": dict(
        title="PSI-25 BASS-II ISA-Tab investigation metadata", doc_type="metadata", year=None, authors=None,
        inv="PSI-25", scope="Read from inside the metadata ZIP (not extracted to disk)."),
    "SAFFIRE-1/SAFFIRE-I and SAFFIRE-III DoD.docx": dict(
        title="SAFFIRE-I and SAFFIRE-III Description of Data", doc_type="data_description", year=None,
        authors=None, inv="PSI-98", scope="Table 2 (diagnostics) is an embedded image; its text is not indexed."),
    "SAFFIRE-1/SAFFIRE-I Operations.pdf": dict(
        title="SAFFIRE-I Operations", doc_type="operations", year=None, authors=None, inv="PSI-98", scope=None),
    "SAFFIRE-1/SAFFIRE-I Image Directory Nomenclature.pdf": dict(
        title="SAFFIRE-I Image Directory Nomenclature", doc_type="data_description", year=None, authors=None,
        inv="PSI-98", scope=None),
    "SAFFIRE-1/PSI-98_metadata_PSI-166_SAFFIRE-I (1).zip::i_Investigation.txt": dict(
        title="PSI-98 SAFFIRE-I ISA-Tab investigation metadata", doc_type="metadata", year=None, authors=None,
        inv="PSI-98", scope="Contains dates/platform that conflict with operations documents (see quality flags)."),
}


@dataclass
class Page:
    page_pdf: int | None
    text: str
    section_hint: str | None = None


@dataclass
class ExtractedDoc:
    rel_key: str
    pages: list[Page] = field(default_factory=list)
    page_count: int | None = None
    status: str = "parsed"
    low_text_pages: list[int] = field(default_factory=list)


def slugify(key: str) -> str:
    """Stable document id from the source path (e.g. 'bass-ii-summary-report', 'flex-isatab')."""
    if key.endswith("i_Investigation.txt"):
        return re.sub(r"[^a-z0-9]+", "-", key.split("/")[0].lower()).strip("-") + "-isatab"
    name = re.sub(r"\.[A-Za-z0-9]+$", "", key.split("/")[-1])
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


LIGATURES = {"ﬀ": "ff", "ﬁ": "fi", "ﬂ": "fl", "ﬃ": "ffi", "ﬄ": "ffl", "ﬅ": "st",
             "ﬆ": "st"}


def _clean(t: str) -> str:
    """Whitespace/ligature normalization only; wording is unchanged (PDF 'ﬂ' -> 'fl' so 'flame' is searchable)."""
    for k, v in LIGATURES.items():
        t = t.replace(k, v)
    t = t.replace("­", "").replace("\r", "")
    t = re.sub(r"[ \t]+", " ", t)
    t = re.sub(r"\n{3,}", "\n\n", t)
    return t.strip()


def extract_pdf(path: Path, rel_key: str) -> ExtractedDoc:
    import pymupdf

    doc = pymupdf.open(path)
    out = ExtractedDoc(rel_key, page_count=doc.page_count)
    for i, page in enumerate(doc, start=1):
        text = _clean(page.get_text("text"))
        if len(text.split()) < LOW_TEXT_WORDS:
            out.low_text_pages.append(i)
        out.pages.append(Page(i, text))
    doc.close()
    return out


def _iter_docx_blocks(d):
    from docx.table import Table
    from docx.text.paragraph import Paragraph

    body = d.element.body
    for child in body.iterchildren():
        tag = child.tag.split("}")[-1]
        if tag == "p":
            yield Paragraph(child, d)
        elif tag == "tbl":
            yield Table(child, d)


def extract_docx(path: Path, rel_key: str) -> ExtractedDoc:
    import docx
    from docx.table import Table

    d = docx.Document(str(path))
    out = ExtractedDoc(rel_key)
    section = None
    buf: list[str] = []
    sections: list[Page] = []

    def flush():
        if buf:
            sections.append(Page(None, _clean("\n".join(buf)), section))
            buf.clear()

    for block in _iter_docx_blocks(d):
        if isinstance(block, Table):
            for row in block.rows:
                cells = []
                for cell in row.cells:
                    t = " ".join(cell.text.split())
                    if t and (not cells or cells[-1] != t):
                        cells.append(t)
                if cells:
                    buf.append(" | ".join(cells))
            continue
        text = block.text.strip()
        if not text:
            continue
        style = (block.style.name or "") if block.style is not None else ""
        if style.lower().startswith("heading") or style.lower() == "title":
            flush()
            section = text[:160]
        buf.append(text)
    flush()
    out.pages = sections
    return out


def extract_pptx(path: Path, rel_key: str) -> ExtractedDoc:
    from pptx import Presentation

    prs = Presentation(str(path))
    out = ExtractedDoc(rel_key, page_count=len(prs.slides))
    for i, slide in enumerate(prs.slides, start=1):
        parts, title = [], None
        for shape in slide.shapes:
            if shape.has_text_frame:
                t = shape.text_frame.text.strip()
                if t:
                    parts.append(t)
                    if title is None and getattr(shape, "is_placeholder", False):
                        title = t.split("\n")[0][:120]
            if getattr(shape, "has_table", False) and shape.has_table:
                for row in shape.table.rows:
                    parts.append(" | ".join(c.text.strip() for c in row.cells))
        text = _clean("\n".join(parts))
        if len(text.split()) < LOW_TEXT_WORDS:
            out.low_text_pages.append(i)
        # slides are cited by section ("Slide N"), never as a PDF page number
        out.pages.append(Page(None, text, f"Slide {i}" + (f": {title}" if title else "")))
    return out


def read_isatab_text(repo_root: Path, rel_key: str) -> str:
    if "::" in rel_key:
        zpath, member = rel_key.split("::", 1)
        with zipfile.ZipFile(repo_root / zpath) as z:
            return z.read(member).decode("utf-8", errors="replace")
    return (repo_root / rel_key).read_text(encoding="utf-8", errors="replace")


ISA_FIELDS_KEEP = ("Study Identifier", "Study Title", "Study Description", "Comment[Approach]",
                   "Comment[Hypothesis]", "Comment[Objective]", "Comment[DOI]", "Comment[Experiment Hardware]",
                   "Comment[Flight Platform]", "Comment[Investigation Start Date]",
                   "Comment[Investigation End Date]", "Comment[Proposal Title]")


def extract_isatab(repo_root: Path, rel_key: str) -> tuple[ExtractedDoc, list[dict], dict]:
    text = read_isatab_text(repo_root, rel_key)
    rows = list(csv.reader(io.StringIO(text), delimiter="\t"))
    fields: dict[str, list[str]] = {}
    current = None
    for r in rows:
        if not r:
            continue
        if r[0] and (r[0][0].isupper() or r[0].startswith("Comment[")) and (len(r) > 1 or r[0].isupper()):
            current = r[0]
            fields.setdefault(current, []).extend(v for v in r[1:])
        elif current:  # continuation line of a multi-line quoted value
            fields[current].append(" ".join(r))
    out = ExtractedDoc(rel_key)
    for key in ISA_FIELDS_KEEP:
        vals = [v.strip().strip('"') for v in fields.get(key, []) if v and v.strip()]
        if vals:
            out.pages.append(Page(None, _clean(f"{key}: " + "\n".join(vals)), key))
    pubs = []
    titles = fields.get("Study Publication Title", [])
    dois = fields.get("Study Publication DOI", [])
    authors = fields.get("Study Publication Author List", [])
    status = fields.get("Study Publication Status", [])
    for k, t in enumerate(titles):
        t = (t or "").strip()
        if not t:
            continue
        pubs.append({
            "title": t, "doi": (dois[k].strip() if k < len(dois) and dois[k] else None) or None,
            "authors": (authors[k].strip() if k < len(authors) else None) or None,
            "status": (status[k].strip() if k < len(status) else None) or None,
        })
    meta = {key: " ".join(v.strip() for v in fields.get(key, []) if v.strip())[:4000] for key in ISA_FIELDS_KEEP}
    return out, pubs, meta


SECTION_RE = re.compile(
    r"^(?:(?:\d+(?:\.\d+){0,3})\s+[A-Z][A-Za-z0-9 ,/()\-:']{3,80}|(?:APPENDIX|Appendix)\s+[A-Z0-9][^\n]{0,80}|"
    r"(?:Table|TABLE)\s+[A-Z]?\d+(?:\.\d+)?[^\n]{0,90})$"
)


def chunk_document(doc_id: str, title: str, ex: ExtractedDoc, offset: int | None) -> list[dict]:
    chunks: list[dict] = []
    ordinal = 0
    section = None
    for page in ex.pages:
        if page.section_hint:
            section = page.section_hint
        if not page.text.strip():
            continue
        lines = page.text.split("\n")
        words: list[str] = []
        sections_on_page: list[tuple[int, str]] = []
        for line in lines:
            s = line.strip()
            if s and SECTION_RE.match(s):
                sections_on_page.append((len(words), s[:120]))
            words.extend(s.split())
        if not words:
            continue
        start = 0
        k = 0
        while start < len(words):
            end = min(len(words), start + CHUNK_WORDS)
            # section active at chunk start (last heading at or before start, else carry-over)
            for pos, name in sections_on_page:
                if pos <= start:
                    section = name
            text = " ".join(words[start:end])
            # heading that begins inside the chunk is a better label if chunk starts before any heading
            if section is None:
                inside = [n for p, n in sections_on_page if start <= p < end]
                if inside:
                    section = inside[0]
            page_no = page.page_pdf
            cid = f"{doc_id}:{'p' + str(page_no) if page_no else 's' + str(ordinal)}:{k}"
            chunks.append({
                "chunk_id": cid, "document_id": doc_id, "ordinal": ordinal, "page_pdf": page_no,
                "page_printed": (page_no - offset) if (page_no and offset and page_no - offset > 0) else None,
                "section": section, "text": text, "content_hash": sha256_text(text),
                "title": title,
            })
            ordinal += 1
            k += 1
            if end == len(words):
                break
            start = end - OVERLAP_WORDS
        # update section to the last heading on this page for the next page
        if sections_on_page:
            section = sections_on_page[-1][1]
    return chunks


def extract(repo_root: Path, rel_key: str) -> ExtractedDoc:
    path = repo_root / rel_key
    if rel_key.endswith(".pdf"):
        return extract_pdf(path, rel_key)
    if rel_key.endswith(".docx"):
        return extract_docx(path, rel_key)
    if rel_key.endswith(".pptx"):
        return extract_pptx(path, rel_key)
    raise ValueError(f"unsupported document type: {rel_key}")

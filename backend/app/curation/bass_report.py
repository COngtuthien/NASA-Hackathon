"""Curated extraction of BASS-II Summary Report tables (NASA/TM-20210011385).

Tables: 5.1 (Miller flat PMMA, PDF p.65), 7.1 (T'ien SIBAL, PDF p.104), Appendix A.1-A.6
(test matrices with flow direction and "Test observations and anomalies", PDF pp.111-121).

Every extracted row keeps the verbatim printed cell text, its PDF page, and an automatic
verification against the independent BASS-II CSV (test ID, gas readings). A row is
`verified` only when all checkable fields agree; otherwise it is `needs_review` and the
disagreements are listed. Nothing is estimated or filled in.
"""
from __future__ import annotations

import csv
import io
import json
import re
from pathlib import Path

from .pdfcells import cell_text, page_chars

REPORT = "BASS-II/BASS-II Summary Report.pdf"
CSV_PATH = "BASS-II/PSI-25_Experimental table_BASS-II.csv"
PRINTED_OFFSET = 8
NUM = r"[-+]?\d+(?:\.\d+)?"


def _num(s: str | None) -> float | None:
    if s is None:
        return None
    s = s.strip().replace("−", "-")
    s = re.sub(r"^[–—]", "-", s)  # report prints negative numbers with an en dash
    return float(s) if re.fullmatch(NUM, s) else None


def _numlist(s: str | None) -> list[float]:
    """'10, 6, 5, and 3' -> [10, 6, 5, 3]; returns [] for text like 'Not tracked'."""
    if not s or not re.search(r"\d", s):
        return []
    parts = re.split(r",\s*(?:and\s+)?|\s+and\s+", s.strip())
    vals = []
    for p in parts:
        v = _num(p)
        if v is None:
            return []
        vals.append(v)
    return vals


def _csv_rows(repo: Path) -> dict[str, dict]:
    text = (repo / CSV_PATH).read_bytes().decode("utf-8-sig")
    rows = list(csv.reader(io.StringIO(text, newline="")))
    h = rows[0]
    out = {}
    for i, r in enumerate(rows[1:], start=1):
        d = dict(zip(h, r))
        d["_uid"] = f"bass2:{i}"
        out[d["Test #"].strip()] = d
    return out


def _close(a: float | None, b: str | None, tol: float = 0.051) -> bool | None:
    vb = _num(b)
    if a is None or vb is None:
        return None
    return abs(a - vb) <= tol


def _table(page):
    tabs = page.find_tables().tables
    if not tabs:
        raise ValueError(f"no table found on PDF page {page.number + 1}")
    return max(tabs, key=lambda t: t.row_count * t.col_count)


# ----------------------------------------------------------------- Table 5.1 --

def table_5_1(doc, csvrows) -> dict:
    pno = 65
    page = doc[pno - 1]
    ch = page_chars(page)
    t = _table(page)
    header = [cell_text(ch, c) for c in t.rows[0].cells]
    rows = []
    for r in t.rows[1:]:
        cells = [cell_text(ch, c) for c in r.cells]
        if not cells or not re.fullmatch(r"M\d+", cells[0] or ""):
            continue
        tid, thick, width, sides, vel, spread, burn, o2i, o2f = cells[:9]
        vels, spreads = _numlist(vel), _numlist(spread)
        rec = {
            "table": "5.1", "page_pdf": pno, "page_printed": pno - PRINTED_OFFSET, "test_id": tid,
            "raw": dict(zip(header, cells[:9])),
            "values": {
                "thickness_mm": _num(thick), "width_cm": _num(width), "sides_burning": _num(sides),
                "velocity_cm_s": vels, "spread_rate_mm_s": spreads, "spread_rate_status": "not tracked"
                if "not tracked" in spread.lower() else ("tracked" if spreads else "unparsed"),
                "burn_time_min": _num(burn), "initial_o2_vol_pct": _num(o2i), "final_o2_vol_pct": _num(o2f),
            },
            "units": {"thickness_mm": "mm", "width_cm": "cm", "velocity_cm_s": "cm/s", "spread_rate_mm_s": "mm/s",
                      "burn_time_min": "min", "initial_o2_vol_pct": "% by volume", "final_o2_vol_pct": "% by volume"},
        }
        rec["paired_stages"] = ([{"velocity_cm_s": v, "spread_rate_mm_s": s} for v, s in zip(vels, spreads)]
                                if vels and len(vels) == len(spreads) else [])
        _verify(rec, csvrows.get(tid), {"initial_o2_vol_pct": "Calibrated  initial O2 % by vol ",
                                        "final_o2_vol_pct": "Calibrated final O2 % by vol"})
        if vels and spreads and len(vels) != len(spreads):
            rec["notes"].append("Velocity and spread-rate lists have different lengths; stages are not paired.")
        rows.append(rec)
    return {"table": "5.1", "title": "Twenty BASS-II tests (Miller, flat PMMA)", "page_pdf": pno, "rows": rows,
            "header": header}


# ----------------------------------------------------------------- Table 7.1 --

OUTCOME_NORMAL = {"quenched": "quenched", "no ignition": "no_ignition", "blow-off": "blowoff", "no blowoff": "no_blowoff",
                  "reused, did not ignite": "no_ignition", "reused, ignited": "ignited",
                  "reused, one-sided flame": "ignited_one_sided"}


def table_7_1(doc, csvrows) -> dict:
    pno = 104
    page = doc[pno - 1]
    ch = page_chars(page)
    t = _table(page)
    header = [cell_text(ch, c) for c in t.rows[0].cells]
    footnotes = re.findall(r"\n([ab])\s*([^\n]+)", "\n" + page.get_text())
    rows = []
    for r in t.rows[1:]:
        cells = [cell_text(ch, c) for c in r.cells]
        m = re.fullmatch(r"GMT(\d+)-(T\d+[ab]?)", cells[0] or "")
        if not m:
            continue
        doy, tid = int(m.group(1)), m.group(2)
        width, flow, o2, comment = cells[1:5]
        o2m = re.fullmatch(rf"({NUM})([a-z]?)", o2 or "")
        bass1 = (comment or "").strip().upper() == "BASS"
        flows = [float(x) for x in re.findall(NUM, flow or "")]
        rec = {
            "table": "7.1", "page_pdf": pno, "page_printed": pno - PRINTED_OFFSET, "test_id": tid,
            "row_key": cells[0], "investigation": "BASS (I)" if bass1 else "BASS-II",
            "raw": dict(zip(header, cells[:5])),
            "values": {
                "gmt_day_of_year": doy, "sample_width_cm": _num(width), "flow_cm_s": flows,
                "flow_change": "range" if " to " in (flow or "") else "single",
                "o2_vol_pct": _num(o2m.group(1)) if o2m else None,
                "o2_footnote": (o2m.group(2) or None) if o2m else None,
                "comment": None if set((comment or "").strip()) <= {"-"} else comment.strip(),
                "outcome": OUTCOME_NORMAL.get((comment or "").strip().lower()),
            },
            "units": {"sample_width_cm": "cm", "flow_cm_s": "cm/s", "o2_vol_pct": "% by volume"},
        }
        if bass1:
            rec.update(experiment_uid=None, verification="not_applicable", checks={}, notes=[
                "Earlier BASS (I) test: its Test # collides with a BASS-II test name but is a different experiment."])
        else:
            c = csvrows.get(tid)
            _verify(rec, c, {"o2_vol_pct": "Calibrated  initial O2 % by vol "})
            if c is not None:
                ok = str(doy) == c["GMT"].strip()
                rec["checks"]["gmt_day_of_year"] = ok
                if not ok:
                    rec["verification"] = "needs_review"
                    rec["notes"].append(f"GMT {doy} in report vs {c['GMT'].strip()} in CSV.")
        rows.append(rec)
    return {"table": "7.1", "title": "Flat SIBAL fabrics in concurrent flow (T'ien)", "page_pdf": pno, "rows": rows,
            "header": header, "footnotes": {k: v.strip() for k, v in footnotes if k in "ab"}}


# ----------------------------------------------------------- Appendix A ------

# Column anchors (x of the left edge of each cell, PDF points), identical on every page of Appendix A.
APPX_ANCHORS = [
    (72, "actual_date"), (112, "start_time"), (147, "as_run_number"), (166, "test_id"), (185, "sample"),
    (210, "material"), (251, "igniter"), (287, "flow_restrictor"), (297, "flow_direction"), (337, "fan_display"),
    (390, "air_display"), (443, "radiometer_gain"), (466, "radiometer_display"), (498, "gn2_pot"),
    (521, "gn2_display"), (543, "filter"), (557, "release_mode"), (573, "exposure_mode"), (587, "exposure_comp"),
    (607, "bracket"), (631, "f_stop"), (651, "shutter"), (671, "iso"), (698, "shutter_hold"), (723, "sd_card"),
    (742, "total_frames"), (767, "o2_initial_calibrated"), (799, "o2_final_calibrated"),
    (829, "o2_initial_uncalibrated"), (854, "o2_final_uncalibrated"), (879, "co2_initial"), (904, "co2_final"),
    (929, "co_initial"), (950, "co_final"), (975, "observations"),
]
APPX_PAGES = range(111, 122)
APPX_CSV = {"o2_initial_calibrated": "Calibrated  initial O2 % by vol ", "o2_final_calibrated": "Calibrated final O2 % by vol",
            "co2_initial": "Initial CO2 % by vol", "co2_final": "Final CO2 % by vol",
            "co_initial": "Initial CO (ppm)", "co_final": "Final CO (ppm)"}


def _col(x0: float) -> str | None:
    name, best = None, 99.0
    for ax, nm in APPX_ANCHORS:
        d = abs(x0 - ax)
        if d < best:
            name, best = nm, d
    return name if best <= 9 else None


def appendix_a(doc, csvrows) -> dict:
    rows, unmapped = [], []
    for pno in APPX_PAGES:
        page = doc[pno - 1]
        ch = page_chars(page)
        t = _table(page)
        title = re.search(r"TABLE A\.(\d)\.\W*([^\n]+)", page.get_text())
        cur = None
        for r in t.rows[1:]:
            cells = [(c[0], cell_text(ch, c)) for c in r.cells if c]
            cells = [(x, tx) for x, tx in cells if tx]
            if not cells:
                continue
            mapped: dict[str, str] = {}
            for x, tx in cells:
                col = _col(x)
                if col is None:
                    unmapped.append({"page_pdf": pno, "x": round(x, 1), "text": tx[:60]})
                    continue
                mapped[col] = (mapped[col] + " " + tx) if col in mapped else tx
            tid = mapped.get("test_id", "")
            if re.fullmatch(r"[BFMOPT]\d+[ab]?", tid):
                cur = {"table": f"A.{title.group(1)}" if title else "A", "page_pdf": pno,
                       "page_printed": pno - PRINTED_OFFSET, "test_id": tid, "raw": mapped}
                rows.append(cur)
            elif cur is not None and cur["page_pdf"] == pno:
                for k, v in mapped.items():  # continuation lines of wrapped cells
                    cur["raw"][k] = (cur["raw"].get(k, "") + " " + v).strip()
    for rec in rows:
        raw = rec["raw"]
        fd = (raw.get("flow_direction") or "").strip()
        fd_ok = re.match(r"(?i)^(opposed|concurrent|stagnation)", fd) is not None
        arn = _num(raw.get("as_run_number"))
        rec["values"] = {
            "as_run_number": int(arn) if arn is not None and 1 <= arn <= 140 and arn == int(arn) else None,
            "flow_direction": fd if fd_ok else None,
            "material_description": raw.get("material"), "start_time_gmt": raw.get("start_time"),
            "actual_date": raw.get("actual_date"), "observations": raw.get("observations"),
            "o2_initial_uncalibrated": _num(raw.get("o2_initial_uncalibrated")),
            "o2_final_uncalibrated": _num(raw.get("o2_final_uncalibrated")),
        }
        rec["units"] = {"o2_initial_uncalibrated": "% by volume", "o2_final_uncalibrated": "% by volume"}
        _verify(rec, csvrows.get(rec["test_id"]), APPX_CSV, use_raw=True)
        if fd and not fd_ok:
            rec["notes"].append(f"Column at the flow-direction position reads '{fd}' (not a flow direction); not used.")
    return {"table": "A", "title": "Appendix A test matrices (A.1-A.6)", "pages": list(APPX_PAGES), "rows": rows,
            "unmapped_cells": unmapped}


# ------------------------------------------------------------- verification --

def _verify(rec: dict, c: dict | None, field_map: dict[str, str], use_raw: bool = False) -> None:
    rec.setdefault("notes", [])
    rec["checks"] = {}
    if c is None:
        rec.update(experiment_uid=None, verification="needs_review")
        rec["notes"].append("Test ID not found in the BASS-II CSV.")
        return
    rec["experiment_uid"] = c["_uid"]
    rec["checks"]["test_id"] = True
    for field, col in field_map.items():
        rep = rec["raw"].get(field) if use_raw else rec["values"].get(field)
        csv_raw = c.get(col, "")
        if use_raw:
            a, b = _norm_cell(rep), _norm_cell(csv_raw)
            ok = None
            if a == "<missing>" and b == "<missing>":
                ok = True
                if (rep or "").strip().lower() not in ("", "none") and set((rep or "").strip()) - {"-"}:
                    rec["notes"].append(f"{field}: report '{(rep or '').strip()}' and CSV '{csv_raw.strip()}' both mean no reading")
            elif _num(a) is not None and _num(b) is not None:
                ok = abs(_num(a) - _num(b)) <= 0.051 or (abs(_num(a) - _num(b)) <= 0.51 and "co_" in field)
            elif a and b:
                ok = a.lower().replace("—", "-") == b.lower()
        else:
            ok = _close(rep, csv_raw)
        if ok is not None:
            rec["checks"][field] = ok
            if not ok:
                rec["notes"].append(f"{field}: report '{rep}' vs CSV '{csv_raw.strip()}'")
    checked = [v for k, v in rec["checks"].items() if k != "test_id"]
    rec["verification"] = "verified" if checked and all(checked) else "needs_review"


def _norm_cell(v: str | None) -> str:
    """Comparison form only (stored text stays verbatim): missing markers unify, '+OR' == 'OR'."""
    t = (v or "").strip()
    if not t or set(t) <= set("-–—") or t.lower() in ("none", "na", "n/a", "failed"):
        return "<missing>"
    return t.lstrip("+").lower()


def build(repo: Path, out_dir: Path) -> dict:
    import pymupdf

    doc = pymupdf.open(repo / REPORT)
    csvrows = _csv_rows(repo)
    results = {"5.1": table_5_1(doc, csvrows), "7.1": table_7_1(doc, csvrows), "A": appendix_a(doc, csvrows)}
    out_dir.mkdir(parents=True, exist_ok=True)
    summary = {}
    for key, data in results.items():
        name = {"5.1": "bass2_table_5_1.json", "7.1": "bass2_table_7_1.json", "A": "bass2_appendix_a.json"}[key]
        data["source"] = {"file": REPORT, "report": "NASA/TM-20210011385", "printed_page_offset": PRINTED_OFFSET,
                          "method": "PyMuPDF table detection + per-character cell reconstruction; verified against CSV"}
        (out_dir / name).write_text(json.dumps(data, indent=1, ensure_ascii=False), encoding="utf-8")
        st: dict[str, int] = {}
        for r in data["rows"]:
            st[r["verification"]] = st.get(r["verification"], 0) + 1
        summary[key] = {"rows": len(data["rows"]), **st}
    doc.close()
    return summary


if __name__ == "__main__":
    import sys

    root = Path(__file__).resolve().parents[3]
    print(json.dumps(build(root, root / "processed" / "curated"), indent=1))
    sys.exit(0)

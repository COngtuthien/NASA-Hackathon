"""Cross-checks for BASS-II Summary Report values that the CSV cannot verify ("report-only" values).

The CSV verifies IDs and gas readings, but thickness, width, flow velocity and flow direction in Tables 5.1/7.1 are
printed only in the report. Several of them are printed twice (a results table AND the Appendix A test log) or are
also written into the CSV's free-text material column, so they can be checked against each other:

  thickness   Table 5.1 thickness_mm   vs Appendix A material text  vs CSV 'Fuel Sample Material'
  width       Table 5.1 / 7.1 width_cm vs Appendix A material text (nominal "2 cm" / "1 cm"; the tables print the
              actual widths 2.2 / 1.2 cm, Ref. Section 5: "two widths (1.2 and 2.2 cm)")
  velocity    Table 5.1 / 7.1 velocity vs Appendix A 'Air display' readings logged during the test
  direction   Appendix A flow direction; Table 7.1 is titled "flat SIBAL fabrics in concurrent flow"

Nothing here edits a value. Results become quality flags (with page references) and a summary for the UI.
"""
from __future__ import annotations

import re

NUM = r"(\d+(?:\.\d+)?)"
NOMINAL_WIDTH = {2.0: 2.2, 1.0: 1.2}  # nominal sample width (cm) -> actual width printed in Tables 5.1/7.1
VEL_TOL = 0.51  # cm/s; display readings are logged to 1 cm/s at best


def _clean(s: str | None) -> str:
    return (s or "").replace("‐", "-").replace("‑", "-").replace("�", "u").lower()


def thickness_mm(text: str | None) -> float | None:
    d = _clean(text)
    m = re.search(NUM + r"\s*-?\s*mm\b", d)
    if m:
        return float(m.group(1))
    m = re.search(NUM + r"\s*-?\s*(?:micron|um)\b", d)
    return float(m.group(1)) / 1000 if m else None


def width_cm(text: str | None) -> float | None:
    m = re.search(NUM + r"\s*-?\s*cm\b", _clean(text))
    return float(m.group(1)) if m else None


def _numbers(text: str | None) -> list[float]:
    return [float(x) for x in re.findall(NUM, text or "")]


def _as_list(v) -> list[float]:
    vals = v if isinstance(v, list) else [v]
    return [float(x) for x in vals if isinstance(x, (int, float))]


def check(curated: dict, csv_material: dict[str, str]) -> dict:
    """curated: {'5.1': table, '7.1': table, 'A': appendix} as produced by bass_report.build()."""
    appx = {r["test_id"]: r for r in curated.get("A", {}).get("rows", [])}
    out: dict = {"thickness": [], "width": [], "velocity": [], "direction_from_table_7_1": [], "conflicts": []}
    tables = [("5.1", r, r["values"].get("thickness_mm"), r["values"].get("width_cm"), r["values"].get("velocity_cm_s"))
              for r in curated.get("5.1", {}).get("rows", [])]
    tables += [("7.1", r, None, r["values"].get("sample_width_cm"), r["values"].get("flow_cm_s"))
               for r in curated.get("7.1", {}).get("rows", []) if r.get("verification") == "verified"]
    for table, r, thick, width, vel in tables:
        tid = r["test_id"]
        a = appx.get(tid)
        a_raw = a["raw"] if a else {}
        page = f"Table {table} PDF p.{r['page_pdf']}" + (f", Appendix A PDF p.{a['page_pdf']}" if a else "")
        if thick is not None:
            ta, tc = thickness_mm(a_raw.get("material")), thickness_mm(csv_material.get(tid))
            ok = all(x is None or abs(x - thick) < 1e-6 for x in (ta, tc)) and (ta is not None or tc is not None)
            out["thickness"].append({"test_id": tid, "table": thick, "appendix": ta, "csv": tc, "agree": ok})
            if not ok:
                out["conflicts"].append({"test_id": tid, "field": "thickness_mm", "where": page,
                                         "detail": f"Table {table} {thick} mm vs Appendix A {ta} mm / CSV {tc} mm"})
        if width is not None:
            wa, wc = width_cm(a_raw.get("material")), width_cm(csv_material.get(tid))
            expected = NOMINAL_WIDTH.get(wa) if wa is not None else None
            ok = None if expected is None else abs(expected - width) < 1e-6
            out["width"].append({"test_id": tid, "table": width, "appendix_nominal": wa, "csv_nominal": wc, "agree": ok})
            if ok is False:
                csv_note = f" and the CSV material text says {wc:g} cm" if wc is not None else ""
                out["conflicts"].append({"test_id": tid, "field": "width_cm", "where": page,
                                         "detail": f"Table {table} prints {width} cm but the Appendix A log describes "
                                                   f"a {wa:g} cm sample{csv_note} (actual width {expected} cm)"})
        vels = _as_list(vel)
        disp = _numbers(a_raw.get("air_display")) if a else []
        if vels and disp:
            missing = [v for v in vels if not any(abs(v - d) <= VEL_TOL for d in disp)]
            out["velocity"].append({"test_id": tid, "table": table, "report_velocity_cm_s": vels,
                                    "air_display": a_raw.get("air_display"), "all_in_display": not missing,
                                    "not_in_display": missing})
    for r in curated.get("7.1", {}).get("rows", []):
        a = appx.get(r["test_id"])
        if r.get("verification") == "verified" and a and not a["values"].get("flow_direction"):
            out["direction_from_table_7_1"].append({"test_id": r["test_id"], "page_pdf": r["page_pdf"],
                                                    "appendix_raw": a["raw"].get("flow_direction")})
    v = out["velocity"]
    out["summary"] = {
        "thickness_checked": len(out["thickness"]),
        "thickness_agree": sum(1 for x in out["thickness"] if x["agree"]),
        "width_checked": sum(1 for x in out["width"] if x["agree"] is not None),
        "width_agree": sum(1 for x in out["width"] if x["agree"]),
        "velocity_checked": len(v),
        "velocity_all_in_display": sum(1 for x in v if x["all_in_display"]),
        "low_flow_examples": [x for x in v if not x["all_in_display"] and any(m < 3.5 for m in x["not_in_display"])][:6],
        # display readings near zero while the report analyses spread at >= 5 cm/s: the readout is not usable there
        "display_near_zero": [x for x in v if max(_numbers(x["air_display"])) <= 1 and min(x["report_velocity_cm_s"]) >= 5],
        "conflicts": len(out["conflicts"]),
    }
    return out

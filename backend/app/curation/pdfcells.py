"""Coordinate-based PDF table cell reconstruction.

PyMuPDF's table finder locates cell rectangles; plain cell.extract() scrambles
decimal points in the BASS-II report ("22 ." for 2.2). Rebuilding each cell from
its characters ordered by (line, x) recovers the printed text exactly.
"""
from __future__ import annotations

import re


def page_chars(page) -> list[tuple[tuple[float, float, float, float], str]]:
    out = []
    for b in page.get_text("rawdict")["blocks"]:
        for line in b.get("lines", []):
            for span in line["spans"]:
                for c in span["chars"]:
                    out.append((tuple(c["bbox"]), c["c"]))
    return out


def cell_text(chars, rect) -> str:
    if not rect:
        return ""
    x0, y0, x1, y1 = rect
    inside = [(bb, ch) for bb, ch in chars
              if bb[0] >= x0 - 0.6 and bb[2] <= x1 + 0.6 and y0 <= (bb[1] + bb[3]) / 2 <= y1]
    if not inside:
        return ""
    inside.sort(key=lambda z: ((z[0][1] + z[0][3]) / 2, z[0][0]))
    lines, cur, cur_y = [], [], None
    for bb, ch in inside:
        ym = (bb[1] + bb[3]) / 2
        if cur_y is not None and abs(ym - cur_y) > 2.5:
            lines.append(cur)
            cur = []
        cur.append((bb, ch))
        cur_y = ym if cur_y is None or abs(ym - cur_y) > 2.5 else cur_y
    lines.append(cur)
    text = " ".join("".join(ch for _, ch in sorted(l, key=lambda z: z[0][0])) for l in lines)
    text = text.replace("‑", "-").replace("‐", "-").replace(" ", " ")
    return re.sub(r"\s+", " ", text).strip()

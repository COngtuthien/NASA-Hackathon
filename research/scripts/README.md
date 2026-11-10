# Analysis scripts (read-only, stdlib only)

Scripts used to produce the numbers in reports 01–10. They only READ the original
files; they never modify them. Python 3.13, standard library only (no pandas).
Run from the repository root, writing any output outside the repo.

| Script | Purpose | Example |
|---|---|---|
| `flex_load.py` | Load FLEX CSV with the correct cp1252 encoding | imported by `flex2.py` |
| `flex2.py` | FLEX consistency checks (duplicates, mole sums, d2-law ratio, stats) | `python -I research/scripts/flex2.py research/scripts` |
| `office.py` | Extract text from DOCX/PPTX via zipfile+XML | `python -I research/scripts/office.py <out_dir> "BASS-II/BASS-II data FAQ.docx"` |
| `xlsx.py` | Dump small XLSX workbooks (sheets, cells, formulas, external links) | `python -I research/scripts/xlsx.py "BASS-II/Fan calibration data.xlsx" 200` |
| `saffire_xlsx.py` | Stream-summarize every sheet of the 12 MB SAFFIRE workbook | `python -I research/scripts/saffire_xlsx.py "SAFFIRE-1/SAFFIRE-1_MergeResult-jpeg_Update_Final_v2.xlsx"` |
| `saffire_stats.py` | Per-camera frame counts, timing, downlink %, JPEG-size series | `python -I research/scripts/saffire_stats.py "<xlsx>" <out.json>` |

PDF text was extracted with `pdftotext -layout` (poppler). BASS-II CSV checks were
run inline (see report 03 for the exact computations).

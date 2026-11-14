"""Build docs/NEW_NASA_DATASET_INVENTORY.csv for the 2026-11-14 new-dataset audit.

Read-only over the four downloaded folders (FLEX-2, PSI-117, PSI-62, SAME): walks every file,
hashes it, lists ZIP members without extracting them, and attaches the content-based
classification established during the audit (see docs/NEW_NASA_DATASET_AUDIT.md). Categories
come from inspecting file contents, not from file names; the rules below only map each
inspected file (or inspected family of identical-format files) to that finding.

Usage (from the repo root):  python -I research/scripts/new_dataset_inventory.py
Standard library only. Never writes inside the source folders.
"""
from __future__ import annotations

import csv
import hashlib
import os
import re
import sys
import zipfile

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'docs', 'NEW_NASA_DATASET_INVENTORY.csv')

FOLDERS = {
    'FLEX-2': ('PSI-68', 'Flame Extinguishment Experiment - 2 (FLEX-2)'),
    'PSI-117': ('PSI-117', 'Effect of External Thermo-Convective Perturbation on Cool Flame Dynamics: '
                           'A Multidimensional Multi-Physics CFD Analysis'),
    'PSI-62': ('PSI-62', 'Concurrent Flame Spread Modeling using Flamelet Generated Manifolds in Microgravity '
                         'with Comparison to BASS Experiments using Two-Color Tomography'),
    'SAME': ('PSI-102', 'Smoke and Aerosol Measurement Experiment (SAME)'),
}

# Existing SpaceFire source files a new file duplicates (verified by extracted-text hash).
DUPLICATES = {
    'FLEX-2/FLEX-2 Engineering Requirments Document.pdf':
        'FLEX/FLEX Engineering Requirements Document.pdf (text-identical, 37 pages; bytes differ)',
    'FLEX-2/FLEX-2 SRD Final _ No Hypertext.pdf':
        'FLEX-2/FLEX-2 SRD Final.pdf (same 68 pages; this copy has garbled figure text on 16 pages)',
    'SAME/Analyzed data/Reduced Gravity/Dibutyl Phthalate/GMT264 Run 22 DBP.xls':
        'GMT264 Run 21 DBP.xls (housekeeping sheet cell-for-cell identical; sheet names swapped)',
    'SAME/Analyzed data/Reduced Gravity/Dibutyl Phthalate/Run 2 GMT254 testlog b.xlsx':
        'Run 2 GMT254 testlog.xlsx (same 309-row log; bytes differ)',
}

# (regex on relative path, category, inspection status, note). First match wins.
RULES: list[tuple[str, str, str, str]] = [
    # ---------------- FLEX-2 (PSI-68)
    (r'^FLEX-2/67212MFAN11000-4', 'Other: engineering drawing', 'opened; image-only page; visually spot-checked',
     'Title block reads HIBMS PACKAGE ASSEMBLY (CIR imaging package, not FLEX-2-specific); carries an export-control '
     '(ITAR/EAR) notice - do not redistribute'),
    (r'^FLEX-2/67235M.*\.pdf$', 'Other: engineering drawing', 'opened; image-only page (no text layer); not OCRed',
     'Mechanical drawing (fuel reservoir / fiber arm / fiber cover). No science values.'),
    (r'^FLEX-2/FLEX-2 DoD\.docx$', 'Metadata', 'read in full',
     'Description of Data: 40 Experiment Data records by test matrix; Raw Data are .txt per test point; images as .zip. '
     'None of those data files were downloaded.'),
    (r'^FLEX-2/FLEX-2 Engineering', 'Other: engineering requirements', 'text extracted (37 p)',
     'FLX-REQ-0001, 2010-02-04. Already present in SpaceFire under FLEX/.'),
    (r'^FLEX-2/FLEX-2 Hardware Presentation\.ppt$', 'Other: hardware/programme presentation',
     'legacy OLE; text partially recovered',
     'MDCA/CIR overview and FLEX-2 objectives; mostly photos. No measurements.'),
    (r'^FLEX-2/FLEX-2 SRD Final\.pdf$', 'Scientific report: science requirements document', 'text extracted (68 p)',
     'Williams et al. SRD Rev.1: Table 1 fuel properties (p25), Table 2 test-matrix envelope and Table 3 estimated tests '
     '(p33), Table 4 science data end products (p34).'),
    (r'^FLEX-2/FLEX-2 SRD Final _ No Hypertext\.pdf$', 'Scientific report: science requirements document',
     'text extracted (68 p)', 'Alternate export of the SRD; prefer FLEX-2 SRD Final.pdf.'),
    (r'^FLEX-2/PSI-68_Experimental table', 'Metadata: test-matrix envelope', 'parsed in full (8 rows x 7 cols)',
     'Ranges/lists per fuel (d0 1.5-5 mm, XO2 0.17-0.30, 0.5-3 atm, 0.1-5 cm/s). No per-test measurements. '
     'Fuel list differs from SRD Table 2.'),
    (r'^FLEX-2/PSI-68_metadata.*\.zip$', 'Metadata (ISA-Tab archive)', 'entries listed; extracted to audit workspace', ''),
    (r'^FLEX-2/PSI-68_metadata.*::i_Investigation\.txt$', 'Metadata', 'read in full',
     'Study PSI-68, DOI 10.60555/byp8-h018, ISS/CIR/MDCA, 2016-08-12..2019-09-30, PI F.A. Williams, 51 publications.'),
    # ---------------- PSI-117
    (r'^PSI-117/Analyzed data/.*ReadMe', 'Metadata: data dictionary', 'parsed in full (1 sheet, 16x11)',
     'Maps each CSV to fuel, d0, pressure, composition and source DOI. Composition cells ambiguous '
     '(XN2 given as 74/85 next to XO2 fractions; XO3 column says Balance).'),
    (r'^PSI-117/Analyzed data/.*PROCI_2019_(Stable|Oscillatory)', 'Simulation output (1-D droplet model)',
     'parsed in full; column blocks profiled',
     'Model-only time histories (0.5 mm n-heptane, ozone-assisted). Includes T_max and OH position: not measurable '
     'quantities, so not experimental data.'),
    (r'^PSI-117/Analyzed data/.*\.csv$', 'Analyzed Data: figure data (experiment + model series)',
     'parsed in full; column blocks profiled',
     'Side-by-side blocks for experimental (EXP/Expt) and model (Model/Sim) series; '
     'experimental points appear plot-digitized (negative times/diameters).'),
    (r'^PSI-117/PSI-117_metadata.*\.zip$', 'Metadata (ISA-Tab archive)', 'entries listed; extracted to audit workspace', ''),
    (r'^PSI-117/PSI-117_metadata.*::i_Investigation\.txt$', 'Metadata', 'read in full',
     'Study PSI-117 (ground investigation), DOI 10.60555/gz0q-b577, 2017-02-15..2022-02-14, PI T. Farouk (USC). '
     'Approach claims a 3-D OpenFOAM model; no OpenFOAM case files are in the download.'),
    (r'^PSI-117/PSI-117_Presentations_PSI_Users', 'Publication: presentation', 'text extracted (36 p, 3 low-text)',
     'Farouk, PSI seminar 2026-03-26: model summary; "models were validated against the FLEX data" (p31).'),
    (r'^PSI-117/PSI-117_Presentations_.*\.pdf$', 'Publication: conference presentation', 'text extracted',
     'Farouk group slides (Combustion Symposium / ASGSR). Sphero-symmetric 1-D model with fiber; FLEX comparisons.'),
    (r'^PSI-117/PSI-117_Reports_Dissertation', 'Scientific report: PhD dissertation', 'text extracted (227 p)',
     'M.F.E. Alam, Univ. South Carolina, 2018. Sphero-symmetric model; FLEX 563 methanol/xenon validation; '
     'drop-tower n-butanol; sub-mm cool flames.'),
    # ---------------- PSI-62
    (r'^PSI-62/.*\.zip$', 'Metadata (ISA-Tab archive)', 'entries listed; extracted to audit workspace',
     'The only file downloaded for PSI-62.'),
    (r'^PSI-62/.*::i_Investigation\.txt$', 'Metadata', 'read in full',
     'Study PSI-62 (ground investigation), DOI 10.60555/e9xp-ex83, 2019-05-01..2021-04-30, PI P. DesJardin; '
     '4 publications (Combust. Flame 2017/2021/2023).'),
    # ---------------- SAME (PSI-102)
    (r'^SAME/(60089|80089|S1171).*\.pdf$', 'Other: engineering drawing', 'opened; image-only page (no text layer); not OCRed',
     'Sample/ignitor/chamber/fluids drawings. 60089MFHP0001-C fluids schematic visually spot-checked.'),
    (r'^SAME/Analyzed data/.*GMT254HKPandLOG', 'Raw Data: housekeeping export + flight log (two sheets)',
     'every sheet profiled', 'Sheet "GMT254 HKP" (10,524 rows, days 253-254) and sheet "GMT254 LOG" (589 rows).'),
    (r'^SAME/Analyzed data/.*(log|LOG).*\.xls','Raw Data: flight command/event log', 'parsed in full',
     'Timestamped command/event log (YYYY/DDD/HH:MM:SS); gives test-matrix file, sample type and heater setpoint.'),
    (r'^SAME/Analyzed data/.*\.xlsx?$', 'Raw Data (1 Hz flight housekeeping export) + Analyzed Data (analyst sheets)',
     'every sheet profiled (headers, ranges)',
     '98/99-column housekeeping export (detector volts, P-Trak pt/cc, DustTrak mg/m3, flows, temps) plus '
     '"for average"/"for graphing" sheets with analyst averages.'),
    (r'^SAME/ICES Paper 2005', 'Publication: conference paper (pre-flight)', 'legacy OLE; text partially recovered',
     'Urban et al., ICES 2005-01-2930: spacecraft smoke-detector background and SAME rationale.'),
    (r'^SAME/PSI-102_Experimental table', 'Metadata: planned test matrix', 'parsed in full (8 rows x 5 cols)',
     'Planned conditions (5/10 cm/s, 1-2 mg/min, 1/20 min aging). Not the flight log; no results.'),
    (r'^SAME/PSI-102_metadata.*\.zip$', 'Metadata (ISA-Tab archive)', 'entries listed; extracted to audit workspace', ''),
    (r'^SAME/PSI-102_metadata.*::i_Investigation\.txt$', 'Metadata', 'read in full',
     'Study PSI-102, DOI 10.60555/gd4k-8h62, ISS MSG, 2001-03-02..2008-02-28, PI D. Urban; 16 publications.'),
    (r'^SAME/SAME EIRD', 'Other: investigation requirements document', 'text extracted (72 p)',
     'Exploration Investigation Requirements Document Rev 2.0, 2005-02-25.'),
    (r'^SAME/SAME Final Science report', 'Scientific report (+4 attached papers)', 'text extracted (68 p, 8 low-text)',
     'Urban et al. 2010. Table 1 results (printed p17 / PDF p27); Appendix A 47-test flight log (PDF p33). '
     'Attached: SAE 2009-01-2468, AIAA "Properties of Smoke...", SAE 2008-01-2089, AIAA "Spacecraft Fire Detection..."'),
    (r'^SAME/SAME ICES  2013', 'Publication: presentation', 'parsed (29 slides)',
     'SAME-2 flight vs ground comparison (ICES 2013). SAME-2 data are not in this download.'),
    (r'^SAME/SAME ICES 2012', 'Publication: presentation', 'parsed (51 slides, 1 table)',
     'SAME-2 particle morphology/size (ICES 2012). Slide 24 table "SAME-1&2 Results" incl. Pyrell.'),
    (r'^SAME/SAME OPS images\.zip$', 'Figures and images (archive)', 'entries listed; 2 images visually spot-checked',
     '16 JPEGs: 15 ISS015E crew photos of SAME in MSG + annotated hardware cue card. Not extracted.'),
    (r'^SAME/SAME OPS images\.zip::', 'Figures and images', 'header read (size/EXIF strings)', ''),
    (r'^SAME/(Same progress report|SAME slides 7-1|Urban ICES talk)', 'Publication: presentation (legacy .ppt)',
     'legacy OLE; text partially recovered', 'Programme/status talks (2006-2010). No tables recovered as text.'),
    (r'^SAME/SAME Verification Plan', 'Other: verification plan / engineering requirements', 'text extracted (107 p)',
     'SAME-PLN-005 Rev F VPERD, 2007-01.'),
    (r'^SAME/SAME VPRED Matrix', 'Other: requirements matrix', 'every sheet profiled (1 sheet, 1091x19)',
     'Requirement number/source/method matrix. No science data.'),
    (r'^SAME/SAME_(Baseline|Crew|Operations|Software)', 'Other: engineering / operations documentation', 'text extracted',
     'ZIN Technologies project documents (concept, crew interface, ops manual, software).'),
    (r'^SAME/SAME_Wire_Report\.pdf$', 'Other: engineering report', 'text extracted (34 p, 7 low-text)',
     'Ignitor-wire candidate characterization, April 2002 (ZIN, L. Miller).'),
    (r'^SAME/SAME_Wire_Test\.xls$', 'Calibration-type engineering data', 'every sheet profiled',
     'Wire resistance vs temperature for candidate ignitor wires (R/R0 summary + per-wire sheets).'),
    (r'^SAME/TN00[12]\.mp4$', 'Figures and images: video', 'container header read only; not played',
     'H.264 + AAC; 65.3 s (TN001) / 60.8 s (TN002). Content not viewed; test identity of "TN" unknown.'),
    (r'^SAME/TN00[12]\.zip$', 'Figures and images: video archive', 'entries listed; AVI header read in-stream; not extracted',
     'One DV AVI each (720x480, 29.97 fps); durations match the MP4s, so the MP4s are probably transcodes (unverified).'),
    (r'^SAME/TN00[12]\.zip::', 'Figures and images: raw video', 'AVI header read in-stream only', ''),
    (r'::s_PSI-[0-9]+\.txt$', 'Metadata', 'read in full', 'Placeholder sample file ("Do not use this").'),
]

ANOMALIES = {
    'Kapton/kaptonGMT257.xls': 'TimeString column says 2007/254 although the file name and Appendix A (test 8, Kapton) '
                               'say GMT 257; values do not match the GMT254 DBP export at the same timestamps.',
    'Kapton/kaptonGMT257 zgy average.xls': 'Same day-254 TimeString inconsistency as kaptonGMT257.xls.',
    'Cotton Lamp wick/GMT256HKP.xls': 'Full-day export also spans Teflon test (log: Teflon 13:54-14:37) before the '
                                      'lampwick test (15:16-15:33); assign material by time window, not folder.',
    'Cotton Lamp wick/GMT256HKP zgy average.xls': 'Same full-day GMT256 export as GMT256HKP.xls (Teflon + lampwick).',
    'Silicone/GMT267silicon24hkp.xls': 'Main sheet is named GMT267silicon23hkp and spans tests 23 and 24.',
    'Dibutyl Phthalate/GMT264dbptest19and20hkp.xls': 'Main sheet is named GMT264dbptest18hkp.',
    'Teflon/TeflonGMT257hkp.xls': 'Same GMT257 export (sheet "Copy (2) of GMT256hkp") as DBP  GMT257hkp.xls; '
                                  'trailing rows have empty instrument cells.',
}


def sha256(path: str) -> str:
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def classify(rel: str) -> tuple[str, str, str]:
    for pattern, cat, status, note in RULES:
        if re.search(pattern, rel):
            return cat, status, note
    return 'UNCLASSIFIED', 'not inspected', ''


def folder_label(rel: str) -> str:
    parts = rel.split('::')[0].split('/')
    return '/'.join(parts[1:-1]) or '(investigation root)'


def row(folder: str, rel: str, size: int, digest: str, member_of: str = '') -> dict:
    psi, title = FOLDERS[folder]
    cat, status, note = classify(rel)
    key = rel.replace('SAME/Analyzed data/Reduced Gravity/', '')
    extra = ANOMALIES.get(key, '')
    return {
        'investigation_folder': folder, 'psi_id': psi, 'investigation_title': title,
        'relative_path': rel, 'archive_member_of': member_of,
        'format': os.path.splitext(rel.split('::')[-1])[1].lower().lstrip('.') or '(none)',
        'size_bytes': size, 'sha256': digest, 'psi_folder_label': folder_label(rel),
        'actual_category': cat, 'inspection_status': status,
        'duplicate_of': DUPLICATES.get(rel, ''),
        'notes': '; '.join(x for x in (note, extra) if x),
    }


def main() -> int:
    rows = []
    for folder in FOLDERS:
        base = os.path.join(ROOT, folder)
        for dirpath, _, files in os.walk(base):
            for name in sorted(files):
                path = os.path.join(dirpath, name)
                rel = os.path.relpath(path, ROOT).replace(os.sep, '/')
                rows.append(row(folder, rel, os.path.getsize(path), sha256(path)))
                if name.lower().endswith('.zip'):
                    with zipfile.ZipFile(path) as z:
                        for info in z.infolist():
                            if info.is_dir():
                                continue
                            rows.append(row(folder, f'{rel}::{info.filename}', info.file_size,
                                            f'crc32:{info.CRC:08x}', member_of=rel))
    rows.sort(key=lambda r: (r['investigation_folder'], r['relative_path'].lower()))
    unclassified = [r['relative_path'] for r in rows if r['actual_category'] == 'UNCLASSIFIED']
    with open(OUT, 'w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)
    print(f'wrote {len(rows)} rows to {os.path.relpath(OUT, ROOT)}')
    if unclassified:
        print('UNCLASSIFIED:', *unclassified, sep='\n  ')
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())

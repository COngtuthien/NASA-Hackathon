"""Build docs/ACME_DATASET_INVENTORY.csv for the 2026-11-14 ACME dataset audit (Phase 13).

Read-only over the three downloaded ACME folders (exact on-disk names, including the misspelled
'AMCE Flame Design'). Walks every file, hashes it, lists every ZIP member without extracting it,
tests each member of the damaged drawing archives for readability, and attaches the content-based
classification established in docs/ACME_DATASET_AUDIT.md. Categories come from inspected contents;
the rules below map each inspected file (or family of identical-format files) to that finding.

Usage (repo root):  python -I research/scripts/acme_dataset_inventory.py
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
OUT = os.path.join(ROOT, 'docs', 'ACME_DATASET_INVENTORY.csv')
FOLDERS = {'ACME BRE': 'PSI-20', 'ACME CFI-G': 'PSI-159', 'AMCE Flame Design': 'PSI-10'}

NO_MARK = 'No restriction marking found in text layer'
DRAWING = ('Image-only engineering drawing; markings not machine-verifiable (2 sampled had none visible); '
           'keep local, do not redistribute until verified')

# Duplicates verified by SHA-256 (exact) or extracted-text hash (text).
DUPLICATES = {
    'ACME BRE/ACME_non-imaging_data_file_description.pdf':
        'exact: ACME BRE Data interpretation.zip::ACME Data interpretation/ACME non-imaging data file description 20170217.pdf',
    'ACME BRE/ACME-DOC-010_D.pdf': 'exact: ACME BRE Data interpretation.zip::ACME Data interpretation/ACME-DOC-010_D.pdf',
    'ACME BRE/ACME_Science_Operation_Requirements_revA_20111018.pdf':
        'exact: AMCE Flame Design/PSI-10_Science Documents_ACME_SORD.pdf',
    'AMCE Flame Design/PSI-10_Science Documents_ACME_SORD.pdf':
        'exact: ACME BRE/ACME_Science_Operation_Requirements_revA_20111018.pdf',
    'ACME BRE/ACME_Integrated_Science_Requirements_RevB.pdf':
        'text-identical (110 p): AMCE Flame Design/PSI-10_Science Documents_ACME_ISRD.pdf',
    'AMCE Flame Design/PSI-10_Science Documents_ACME_ISRD.pdf':
        'text-identical (110 p): ACME BRE/ACME_Integrated_Science_Requirements_RevB.pdf',
    'ACME CFI-G/PSI-159_Engineering Documents_ACME Engineering Implementation Rpt.pdf':
        'exact: AMCE Flame Design/PSI-10_Engineering Documents_ACME Engineering Implementation Rpt.pdf',
    'AMCE Flame Design/PSI-10_Engineering Documents_ACME Engineering Implementation Rpt.pdf':
        'exact: ACME CFI-G/PSI-159_Engineering Documents_ACME Engineering Implementation Rpt.pdf',
    'ACME BRE/ACME_engineering_20210328.pdf':
        'earlier version (95 p, 2021-03-28) of the 102-page ACME Engineering Implementation report in CFI-G/FD',
    'ACME BRE/ACME-BRE_Test_Summary.docx': 'same embedded image as ACME-BRE_DoD.docx (BRE Table 1)',
}

# (regex, category, scope, inspection status, description, integration purpose, restrictions)
R = []


def rule(pattern, cat, scope, status, desc, purpose, restrict=NO_MARK):
    R.append((pattern, cat, scope, status, desc, purpose, restrict))


# ---------------- ACME BRE (PSI-20) folder
rule(r'^ACME BRE/PSI-20_Experimental table', 'Experimental tables', 'BRE', 'parsed in full (18 rows x 8 cols)',
     'Day-level ISS log: date, burner size, fuel bottle, approx O2 %, flames ignited (194 total). No per-test results; '
     'two date errors and two percent-format cells vs BRE Table 1.', 'Test-campaign overview; provenance cross-check')
rule(r'^ACME BRE/PSI-20_metadata.*\.zip$', 'Metadata', 'BRE', 'entries listed; extracted to temp workspace',
     'ISA-Tab archive', 'Identity, objectives, 16 publications')
rule(r'^ACME BRE/PSI-20_metadata.*::i_Investigation', 'Metadata', 'BRE', 'read in full',
     'PSI-20 "ACME - Burning Rate Emulator", DOI 10.60555/vb93-3y72, ISS/CIR, 2010-01-01..2025-02-08, PI J. Quintiere',
     'RAG metadata; publication list')
rule(r'^ACME BRE/ACME-BRE_DoD\.docx$', 'Metadata', 'BRE', 'read in full (text + 1 image)',
     'Description of Data: PSI organises BRE by 4 burner/fuel records; raw .csv per test with configuration in row 1; '
     'images/videos per record', 'Locating raw files later; data-model design')
rule(r'^ACME BRE/ACME-BRE_Test_Summary\.docx$', 'Experimental tables', 'BRE', 'embedded image viewed',
     'Only content is an image of BRE Table 1 (flames ignited per test day, with YYDDD test-day codes)',
     'Authoritative check of the PSI-20 CSV')
rule(r'^ACME BRE/BRE_final_report', 'Scientific reports', 'BRE', 'text extracted (181 p)',
     'Stocker/Quintiere/Sunderland/de Ris/Dehghani 2022. Results p18-40: quasi-steady burning at XO2 >= 0.265, '
     'flammability maps (figures), Table 2 literature L/LHV (p29), Table 2 two test conditions (p71)',
     'RAG (primary BRE source); figure-level results')
rule(r'^ACME BRE/BRE_data_interpretation', 'Metadata', 'BRE', 'text extracted (33 p)',
     'Data interpretation guide: test numbering, 125 Hz data-file columns (p8), MFC/GCIP/SAMS files, camera formats',
     'Data dictionary for any future raw-data ingest')
rule(r'^ACME BRE/BRE_procedure', 'Configuration and engineering documentation', 'BRE', 'text extracted (40 p)',
     'Experiment procedure (2021/2022)', 'RAG (method questions)')
rule(r'^ACME BRE/BRE_SRD_2012', 'Scientific reports', 'BRE', 'text extracted (27 p)',
     'BRE Science Requirements Document, Aug 2012 draft', 'Superseded by the 2013 SRD')
rule(r'^ACME BRE/BRE_SRD_2013', 'Scientific reports', 'BRE', 'text extracted (63 p)',
     'BRE Science Requirements Document, June 2013 (theory, emulation rationale, test matrix)', 'RAG (why BRE works)')
rule(r'^ACME BRE/BRE_science_concept', 'Scientific reports', 'BRE', 'text extracted (low-text pages present)',
     'Science Concept Review (2012) / Requirements Definition Review (2013) slides', 'RAG background')
rule(r'^ACME BRE/Dissertation-PD', 'Publications', 'BRE', 'text extracted (171 p)',
     'P. Dehghani PhD dissertation (UMD 2022): Burning emulations of condensed phase fuels aboard the ISS',
     'RAG (deepest BRE analysis)', 'University dissertation; cite, do not redistribute')
rule(r'^ACME BRE/ACME_non-imaging_data_file_description', 'Metadata', 'ACME-wide', 'text extracted (18 p)',
     'ACME non-imaging data notes (2017): csv layout and conversions', 'Data dictionary')
rule(r'^ACME BRE/ACME-DOC-010_D', 'Configuration and engineering documentation', 'ACME-wide', 'text extracted (144 p)',
     'ACME Software Interface Design Description Rev D: data output file (sec. 8.1, p124), conversions (sec. 10.2)',
     'Data dictionary for raw csv')
rule(r'^ACME BRE/ACME_Integrated_Science_Requirements_Definition', 'Scientific reports', 'ACME-wide',
     'text extracted (40 p)', 'ACME integrated science RDR slides, 2010', 'RAG background')
rule(r'^ACME BRE/ACME_Integrated_Science_Requirements_RevB', 'Scientific reports', 'ACME-wide', 'text extracted (110 p)',
     'ACME Integrated Science Requirements Document (ISRD) Rev B, 2013: objectives and success criteria for all ACME '
     'experiments', 'RAG (objectives per experiment)')
rule(r'^ACME BRE/ACME_Science_Operation_Requirements', 'Scientific reports', 'ACME-wide', 'text extracted (45 p)',
     'ACME Science Operations Requirements Document (SORD) Rev A, 2011', 'RAG (operations)')
rule(r'^ACME BRE/ACME_Engineering Requirements', 'Configuration and engineering documentation', 'ACME-wide',
     'text extracted (124 p)', 'ACME Engineering Requirements Document Rev K (2015)', 'Low priority')
rule(r'^ACME BRE/ACME_engineering_2021', 'Configuration and engineering documentation', 'ACME-wide',
     'text extracted (95 p)', 'ACME Engineering Implementation (March 2021 version)', 'Hardware context')
rule(r'^ACME BRE/ACME CDR', 'Configuration and engineering documentation', 'ACME-wide', 'text extracted (240 p)',
     'ACME Critical Design Review package (2013)', 'Low priority')
rule(r'^ACME BRE/(ACME CSSCI 2022|ACME CSSCI paper|ACME_CSSCI_2014|ACME_CSSCI_20140317|ACME_ASGSR|AIAA_presentation)',
     'Publications', 'ACME-wide', 'text extracted',
     'ACME overview papers/slides by D. Stocker et al. (2012-2022), incl. 2022 CSS/CI "Laminar Non-Premixed Flames of '
     'Gaseous Fuel Aboard the ISS"', 'RAG (cross-ACME summary)')
rule(r'^ACME BRE/(ACME_fact_sheet|PS-0154|PS-0278|PS-0305|PS_00538)', 'Other', 'ACME-wide / general',
     'text extracted', 'NASA outreach fact/info sheets (PS-numbered public products) and FCF brochure',
     'Plain-language RAG context', 'NASA public outreach product')
rule(r'^ACME BRE/(PS-01374|PS-03403|ACME_pictorial)', 'Images', 'ACME-wide', 'opened; image-only / near-empty text',
     'Outreach poster / pictorial slides (no text layer)', 'Possible imagery with caption check',
     'NASA public outreach product; image rights not documented locally')
rule(r'^ACME BRE/CIR_Paper_59th_IAC_2008', 'Publications', 'General (CIR)', 'text extracted (11 p)',
     'O\'Malley et al., IAC 2008: combustion research on the ISS (CIR overview)', 'RAG context')
rule(r'^ACME BRE/ISS_Researchers_Guide', 'Publications', 'General', 'text extracted (56 p)',
     'NASA ISS Researcher\'s Guide: Combustion Science (Gokoglu, Dietrich, Stocker, Ferkul, Olson ...)',
     'RAG (general microgravity combustion)')
rule(r'^ACME BRE/FLEX A Decisive Step', 'Publications', 'Other investigation (FLEX)',
     'text layer garbled (font-encoded); 7 low-text pages; needs OCR',
     'FLEX overview article (title from file name only; text not machine-readable)', 'Not usable until OCR')
rule(r'^ACME BRE/(s1101mfa0100|s1101mfa1800|S1101MFS0004)', 'Configuration and engineering documentation', 'ACME-wide',
     'opened; image-only; s1101mfa0100 sheet 1 viewed', 'ACME chamber insert assembly / layout drawings',
     'None for the app', DRAWING)
rule(r'^ACME BRE/S1101MFB0001', 'Configuration and engineering documentation', 'ACME-wide', 'text extracted (1 p)',
     'ACME drawing tree', 'None', DRAWING)
rule(r'^ACME BRE/wo662486_.*\.mp4$', 'Videos', 'BRE (by folder; content not viewed)', 'container header read only',
     'H.264/AAC, 720 px wide; 145.9 s / 45.8 s / 56.2 s. Content and test identity not verified',
     'Possible "compare with NASA imagery" after content check', 'NASA video; rights/caption not documented locally')
rule(r'^ACME BRE/ACME BRE Data interpretation\.zip$', 'Metadata', 'ACME-wide', 'CRC-tested; extracted to temp workspace',
     'Archive: data notes + ACME-DOC-010 (both duplicated at folder root)', 'Data dictionary')
rule(r'::ACME Data interpretation/ACME non-imaging', 'Metadata', 'ACME-wide', 'text extracted', 'see root copy', '')
rule(r'::ACME Data interpretation/ACME-DOC-010', 'Configuration and engineering documentation', 'ACME-wide',
     'text extracted', 'see root copy', '')
rule(r'^ACME BRE/ACME Gas flow\.zip$', 'Calibration', 'ACME-wide', 'CRC-tested; extracted to temp workspace',
     'Archive: gas-flow conversion method, vendor gas tables, conversion templates', 'Converting raw MFC data')
rule(r'::ACME Gas flow/ACME flow conversion', 'Metadata', 'ACME-wide', 'text extracted (4 p)',
     'Stocker 2020: MFC flow-rate and velocity computations', 'Data dictionary for flow conversion')
rule(r'::ACME Gas flow/ACMEFlowAndPressuresRawDataConversion', 'Other', 'ACME-wide', 'every sheet inspected',
     'Empty conversion template ("Copy contents of xxx_data.csv here"); formula cells show #VALUE!. No measurements',
     'Reference for conversion formulas')
rule(r'::ACME Gas flow/ACMEFlowCalculator', 'Other', 'ACME-wide', 'every sheet inspected',
     'SLPM-to-velocity calculator with gas correction-factor table', 'Reference')
rule(r'::ACME Gas flow/GasRateConversions', 'Configuration and engineering documentation', 'ACME-wide',
     'every sheet inspected', 'Per-experiment input sheets (BRE, Flame Design, CLD/E-Field/S-Flame) + gas bottle table',
     'Bottle composition reference')
rule(r'::ACME Gas flow/(GasDataTables|Inside gas mix)', 'Calibration', 'ACME-wide', 'every sheet inspected',
     'Vendor (Hastings/TET) gas correction-factor and property tables', 'Reference', 'Vendor workbook; do not redistribute')
rule(r'::ACME Gas flow/Hastings', 'Configuration and engineering documentation', 'ACME-wide', 'text extracted (43 p)',
     'Teledyne Hastings HFM-D-300/HFC-D-302 flowmeter manual', 'None', 'Third-party vendor manual; do not redistribute')
rule(r'^ACME BRE/ACME Imaging\.zip$', 'Calibration', 'ACME-wide', 'CRC-tested; extracted to temp workspace',
     'Archive: optical layout + camera characterization reports', 'Image interpretation')
rule(r'::ACME Imaging/ACME-RPT-010', 'Calibration', 'ACME-wide', 'text extracted (58 p)',
     'ACME Data Camera Characterization Report Rev A (2016) [PDF metadata title wrongly says FLEX-2 Radiometer...]',
     'Needed before any image-based measurement')
rule(r'::ACME Imaging/CFI Intensified', 'Calibration', 'ACME-wide (CFI camera)', 'text extracted (44 p)',
     'CFI Intensified Camera Package Characterization Report (2016)', 'Needed before cool-flame image analysis')
rule(r'::ACME Imaging/(ACME insert|Layouts)', 'Configuration and engineering documentation', 'ACME-wide',
     'text extracted', 'Chamber insert / optical layout slides', 'Source-backed geometry for a schematic')
rule(r'^ACME BRE/ACME Instruments\.zip$', 'Calibration', 'ACME-wide', 'CRC-tested; extracted to temp workspace',
     'Archive: radiometer/PMT characterization + layouts', 'Radiometer/PMT interpretation')
rule(r'::ACME Instruments/ACME-RPT-01[123]', 'Calibration', 'ACME-wide', 'text extracted',
     'ACME radiometer (RPT-011), BRE radiometer (RPT-012), PMT (RPT-013) characterization reports (2016)',
     'Needed before using radiometer/PMT traces')
rule(r'::ACME Instruments/(ACME Radiometer Layouts|TC rake)', 'Configuration and engineering documentation',
     'ACME-wide', 'opened (near image-only)', 'Radiometer positions (+60/+30/0/-30/-60 mm) and thermocouple rake sketch',
     'Instrument geometry for schematic')
rule(r'^ACME BRE/ACME_drawings_.*\.zip$', 'Configuration and engineering documentation', 'ACME-wide',
     'entries listed; CRC-tested; not extracted', 'Archive of ACME engineering drawings (PDF)', 'None for the app', DRAWING)
rule(r'::ACME_drawings_', 'Configuration and engineering documentation', 'ACME-wide', 'member listed only',
     'ACME engineering drawing', 'None', DRAWING)
# ---------------- ACME CFI-G (PSI-159)
rule(r'^ACME CFI-G/.*Experimental table_CFI-G_Normal', 'Experimental tables', 'CFI-G', 'parsed in full (179 rows x 18 cols)',
     'Per-test normal flames: fuel, XO2 before/after, p, Xf, mHC, TFP, Tad, Zst, hot ignition, burn time, SE/FT, peak '
     'burner T, cool-flame flag (8 rows), comments', 'Test-level outcome analysis (ignition/extinction mode vs conditions)')
rule(r'^ACME CFI-G/.*Experimental table_CFI-G_Inverse', 'Experimental tables', 'CFI-G',
     'parsed in full (154 data rows x 20 cols; 861 blank rows)',
     'Per-test inverse flames: fuel, Xf before/after, p, XO2, HC and O2 rates, Tad, Zst, hot ignition, burn time, SE/FT, '
     'peak burner T (C and K), colour, comments', 'Test-level outcome analysis')
rule(r'^ACME CFI-G/PSI-159_metadata.*\.zip$', 'Metadata', 'CFI-G', 'entries listed; extracted to temp workspace',
     'ISA-Tab archive', 'Identity, objectives, 2 publications')
rule(r'^ACME CFI-G/PSI-159_metadata.*::i_Investigation', 'Metadata', 'CFI-G', 'read in full',
     'PSI-159 "ACME / Cool Flames Investigation with Gases", DOI 10.60555/cyt1-kh64, ISS/CIR, PI P. Sunderland; '
     'no investigation dates listed', 'RAG metadata')
rule(r'^ACME CFI-G/PSI-159_Reports_FinalRpt', 'Scientific reports', 'CFI-G', 'text extracted (93 p)',
     'CFI-G Final Report 2022: Table 1-2 flames per test day (p21-22), findings (p23-24, p44), Table 3 cool-flame '
     'summary with hot/cool radii (p46)', 'RAG (primary); Table 3 transcription')
rule(r'^ACME CFI-G/PSI-159_Engineering Documents', 'Configuration and engineering documentation', 'ACME-wide',
     'text extracted (102 p)', 'ACME Engineering Implementation report (2022)', 'Hardware context')
rule(r'^ACME CFI-G/.*Representative Image', 'Images', 'CFI-G', 'viewed (364x364 px)',
     'File name says cool flames; image shows a bright luminous yellow-white flame, inconsistent with the report\'s '
     'cool-flame imagery (intensified, non-luminous). No caption source', 'Do not label as a cool flame without a source',
     'PSI representative image; caption not verifiable locally')
# ---------------- AMCE Flame Design (PSI-10)
rule(r'^AMCE Flame Design/.*Experimental table_Flame Design_Normal', 'Experimental tables', 'Flame Design',
     'parsed in full (207 rows x 15 cols)',
     'Per-test normal flame CONDITIONS only: fuel (C2H4/C3H8), Xfuel, mfuel, mN2, mtot, XO2 init/final, p init/final/mean, '
     'Zst, Tad. 60 ramped tests marked RAMP/RAMPED. No outcomes', 'Condition-space maps; join key for future outcomes')
rule(r'^AMCE Flame Design/.*Experimental table_Flame Design_Inverse', 'Experimental tables', 'Flame Design',
     'parsed in full (120 rows x 14 cols)',
     'Per-test inverse flame CONDITIONS only: XO2, mO2, mN2, mtot, XC2H4 init/final, p, Zst, Tad; RAMP / LOW O2 markers',
     'Condition-space maps')
rule(r'^AMCE Flame Design/PSI-10_metadata.*\.zip$', 'Metadata', 'Flame Design', 'entries listed; extracted to temp workspace',
     'ISA-Tab archive', 'Identity, objectives, 33 publications')
rule(r'^AMCE Flame Design/PSI-10_metadata.*::i_Investigation', 'Metadata', 'Flame Design', 'read in full',
     'PSI-10 "ACME / Flame Design", DOI 10.60555/w4zy-bt45, ISS/CIR, 1999-01-14..2025-04-30, PI R. Axelbaum',
     'RAG metadata')
rule(r'^AMCE Flame Design/PSI-10_Reports_FinalRpt', 'Scientific reports', 'Flame Design', 'text extracted (109 p)',
     'Flame Design Final Report 2023: Table 1 flames per test day (p24), paper abstracts with critical extinction '
     'temperature 1130 K and extinction mass fluxes (p25-27), data appendix (p93)', 'RAG (primary)')
rule(r'^AMCE Flame Design/PSI-10_Reports_TaskbookPubsList', 'Publications', 'Flame Design', 'text extracted (3 p)',
     'NASA Task Book publication list (Feb 2023)', 'Citation list')
rule(r'^AMCE Flame Design/PSI-10_Reports_TaskbookRpts', 'Scientific reports', 'Flame Design', 'text extracted (45 p)',
     'NASA Task Book annual progress reports', 'RAG (history, interim findings)')
rule(r'^AMCE Flame Design/PSI-10_Science Documents_ACME_ISRD', 'Scientific reports', 'ACME-wide', 'text extracted (110 p)',
     'ACME ISRD Rev B (same text as BRE-folder copy)', 'RAG')
rule(r'^AMCE Flame Design/PSI-10_Science Documents_ACME_SORD', 'Scientific reports', 'ACME-wide', 'text extracted (45 p)',
     'ACME SORD (exact duplicate of BRE-folder copy)', 'RAG')
rule(r'^AMCE Flame Design/PSI-10_Science Documents_SRD', 'Scientific reports', 'Flame Design', 'text extracted (39 p)',
     'Flame Design Science Requirements Document (2010)', 'RAG (objectives, theory)')
rule(r'^AMCE Flame Design/PSI-10_Engineering Documents', 'Configuration and engineering documentation', 'ACME-wide',
     'text extracted (102 p)', 'ACME Engineering Implementation report (exact duplicate of CFI-G copy)', 'Hardware context')
rule(r'^AMCE Flame Design/.*Flame Stages', 'Images', 'Flame Design', 'viewed (574x575 px)',
     '3x3 composite of spherical flames (blue to sooty yellow); no caption, conditions or test IDs',
     'Illustrative imagery only, labelled "representative"', 'PSI representative image; caption not documented')
rule(r'^AMCE Flame Design/.*In Space flame', 'Images', 'Flame Design', 'viewed (1094x804 px)',
     'Flame on/near a spherical burner with bright streaks; no caption', 'Illustrative only',
     'PSI representative image; caption not documented')
rule(r'^AMCE Flame Design/.*(Hardware|CIR support)', 'Images', 'Flame Design / ACME-wide', 'viewed',
     'Hardware photo (spherical porous burner, igniter) / astronaut at the CIR', 'Context imagery',
     'PSI representative image')
rule(r'::s_PSI-[0-9]+\.txt$', 'Metadata', '-', 'read in full', 'Placeholder sample file ("Do not use this")', 'None')

BAD_ZIPS = {'ACME_drawings_avionics_package.zip', 'ACME_drawings_burners.zip',
            'ACME_drawings_common_electrical.zip', 'ACME_drawings_shipping_containers.zip'}


def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def classify(rel):
    for pattern, *rest in R:
        if re.search(pattern, rel):
            return rest
    return ['UNCLASSIFIED', '', 'not inspected', '', '', '']


def row(folder, rel, size, digest, member_of='', extra_status=''):
    cat, scope, status, desc, purpose, restrict = classify(rel)
    name = rel.split('::')[-1].split('/')[-1]
    return {
        'investigation_id': FOLDERS[folder], 'folder': folder, 'content_scope': scope, 'relative_path': rel,
        'filename': name, 'extension': os.path.splitext(name)[1].lower().lstrip('.') or '(none)', 'size_bytes': size,
        'sha256_or_crc': digest, 'archive_member_of': member_of, 'category': cat,
        'inspection_status': '; '.join(x for x in (status, extra_status) if x), 'description': desc,
        'integration_purpose': purpose, 'source_restrictions': restrict, 'duplicate_of': DUPLICATES.get(rel, ''),
    }


def main():
    rows = []
    for folder in FOLDERS:
        for dirpath, _, files in os.walk(os.path.join(ROOT, folder)):
            for name in sorted(files):
                path = os.path.join(dirpath, name)
                rel = os.path.relpath(path, ROOT).replace(os.sep, '/')
                extra = ''
                if name in BAD_ZIPS:
                    with zipfile.ZipFile(path) as z:
                        declared = sum(i.compress_size for i in z.infolist())
                    extra = (f'DAMAGED DOWNLOAD: file is {declared - os.path.getsize(path):,} bytes shorter than its '
                             f'members; some members unreadable')
                rows.append(row(folder, rel, os.path.getsize(path), sha256(path), extra_status=extra))
                if name.lower().endswith('.zip'):
                    with zipfile.ZipFile(path) as z:
                        for info in z.infolist():
                            if info.is_dir():
                                continue
                            status = ''
                            if name in BAD_ZIPS:
                                try:
                                    with z.open(info) as f:
                                        while f.read(1 << 20):
                                            pass
                                    status = 'readable (CRC ok)'
                                except Exception:  # noqa: BLE001 - any read failure means unreadable
                                    status = 'UNREADABLE (truncated archive)'
                            rows.append(row(folder, f'{rel}::{info.filename}', info.file_size,
                                            f'crc32:{info.CRC:08x}', member_of=rel, extra_status=status))
    rows.sort(key=lambda r: (r['folder'], r['archive_member_of'] != '', r['relative_path'].lower()))
    with open(OUT, 'w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)
    bad = [r['relative_path'] for r in rows if r['category'] == 'UNCLASSIFIED']
    print(f'wrote {len(rows)} rows to {os.path.relpath(OUT, ROOT)}; unclassified={len(bad)}')
    for b in bad:
        print('  UNCLASSIFIED', b)
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())

// Phase 9 Smart Scientific Notices: the three investigation-wide data limitations, as data. Each notice keeps a short
// summary and one explanatory sentence visible; the exact discrepancies, original vs interpreted values, sources,
// quality-flag rules and what the issue affects open on request. Wording follows the stored quality flags; nothing
// here changes a flag, its severity or a source value. Record-level warnings are shown separately, next to the
// values they affect (see lib/record-facts.ts).

export type NoticeSeverity = "warning" | "caution" | "info";
export type NoticeRow = { label: string; original: string; interpreted: string; source: string };
export type NoticeLink = { label: string; href: string; external?: boolean };

export type ScientificNoticeData = {
  id: string;
  inv: "PSI-69" | "PSI-25" | "PSI-98";
  severity: NoticeSeverity;
  summary: string;
  /** One sentence, always visible. Must name the exact issue, so the notice is truthful even when collapsed. */
  explain: string;
  rows: NoticeRow[];
  why: string;
  affects: string[];
  flags: { rule: string; href: string }[];
  sources: NoticeLink[];
};

const doc = (id: string, page: number | null, label: string): NoticeLink => ({
  label, href: `/api/v1/documents/${id}/file${page ? `#page=${page}` : ""}`, external: true,
});
const flag = (rule: string, inv: string) => ({ rule, href: `/reliability?investigation=${inv}&rule_id=${encodeURIComponent(rule)}#flags` });

export const NOTICES: Record<"flex" | "bass" | "saffire", ScientificNoticeData> = {
  flex: {
    id: "notice-flex", inv: "PSI-69", severity: "warning",
    summary: "Two FLEX source headers require scientific interpretation.",
    explain: "Burning rate K is labelled ‘mm’ but read as mm²/s, and the CO₂ column is headed ‘CO’; values are interpreted, never altered.",
    rows: [
      { label: "Burning-rate constant K", original: "Header ‘Burning rate; mm’", interpreted: "K in mm²/s (d²-law burning-rate constant)", source: "FLEX CSV header; flag FLEX-UNIT-K" },
      { label: "Ambient CO₂", original: "Header ‘CO initial ambient composition; mole fraction’", interpreted: "Initial CO₂ mole fraction (the diluent)", source: "FLEX CSV header; flag FLEX-HDR-CO2" },
    ],
    why: "A d²-law burning-rate constant has units of area per time, so a value in ‘mm’ is dimensionally impossible; the CO₂-diluted tests would read as carbon monoxide if the header were taken literally.",
    affects: ["The d²-law consistency check and calculator (they use K in mm²/s)", "The Diluent filter and CO₂ labels on the extinction map", "Every FLEX record page (the raw header is shown beside the interpreted value)"],
    flags: [flag("FLEX-UNIT-K", "PSI-69"), flag("FLEX-HDR-CO2", "PSI-69")],
    sources: [doc("2g11-070he-0310", 2, "Liu et al. 2013, PDF p.2 (d²-law and K)")],
  },
  bass: {
    id: "notice-bass", inv: "PSI-25", severity: "warning",
    summary: "Some sample dimensions differ between NASA sources.",
    explain: "The CSV gives nominal widths (1 or 2 cm); the report tables give actual widths (1.2 or 2.2 cm). Both are kept, never reconciled.",
    rows: [
      { label: "Sample width (most tests)", original: "1 cm or 2 cm (CSV and Appendix A log, nominal)", interpreted: "1.2 cm or 2.2 cm (Summary Report tables, actual)", source: "BASS-II CSV; Summary Report Tables 5.1 and 7.1" },
      { label: "Test T24 (bass2:123)", original: "Table 7.1 prints 2.2 cm", interpreted: "Appendix A and the CSV describe a 1 cm sample (actual 1.2 cm)", source: "Flag BASS-REPORT-INTERNAL-CONFLICT" },
    ],
    why: "Spread rates and flame behaviour depend on sample width; a reader comparing tests needs to know which width a number refers to.",
    affects: ["Record pages and the 3D studio's measured label (the CSV width is marked nominal)", "Material comparisons in the studio (both widths are shown)", "Report-table values (Table 5.1 spread rates belong to the actual-width samples)"],
    flags: [flag("BASS-REPORT-INTERNAL-CONFLICT", "PSI-25"), flag("BASS-REPORT-CSV-CONFLICT", "PSI-25")],
    sources: [doc("bass-ii-summary-report", 64, "BASS-II Summary Report, PDF p.64 (Table 5.1)")],
  },
  saffire: {
    id: "notice-saffire", inv: "PSI-98", severity: "info",
    summary: "Some experimental measurements are unavailable in the local dataset.",
    explain: "The local files hold two burn rows and an image manifest; flame-spread rates, temperatures, gas histories and image pixels are not included, so no manifest frame is shown or reconstructed.",
    rows: [
      { label: "Flame position and spread rate", original: "Not in the local files", interpreted: "Not shown; NASA's public footage is shown as footage only", source: "Flag SAF-NO-MEDIA" },
      { label: "Temperature and gas histories", original: "Not in the local files", interpreted: "Not shown", source: "Flag SAF-NO-MEDIA" },
      { label: "Camera images", original: "Manifest of file names, times and receipt status", interpreted: "Downlink timeline only; no pixels", source: "SAFFIRE-I manifest workbook" },
      { label: "Sample length and width", original: "CSV: length 40.6 cm, width 94.0 cm", interpreted: "Operations document: ~0.4 m wide by 0.94 m tall (columns appear swapped)", source: "Flag SAF-LENGTH-WIDTH" },
    ],
    why: "Without flame-front positions or calibrated images, the burn cannot be measured here; any moving flame in the 3D model is an illustration of direction, not a reconstruction.",
    affects: ["The 3D studio (conceptual arrangement and flame band)", "S1 vs S2 comparison (burn times only, not spread rates)", "The image downlink timeline (file timing, not flame data)"],
    flags: [flag("SAF-NO-MEDIA", "PSI-98"), flag("SAF-LENGTH-WIDTH", "PSI-98"), flag("SAF-DOWNLINK-GAP", "PSI-98")],
    sources: [doc("saffire-i-operations", 1, "SAFFIRE-I Operations, PDF p.1 (sample size)"), doc("saffire-i-and-saffire-iii-dod", null, "SAFFIRE-I/III Description of Data")],
  },
};

export const SEVERITY_LABEL: Record<NoticeSeverity, string> = { warning: "Data warning", caution: "Caution", info: "Data limitation" };

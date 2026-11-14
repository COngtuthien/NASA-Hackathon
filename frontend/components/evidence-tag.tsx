// Evidence classes for Phase 13 values and 3D elements (shown on every new chart, table row and scene element).
export const EVIDENCE = {
  measured: { label: "Measured (NASA)", cls: "border-data/70 text-data", note: "Value measured or observed in the experiment, shown with its source." },
  derived: { label: "Source-backed derived", cls: "border-link/70 text-link", note: "Calculated by NASA or SpaceFire from measured values; method stated." },
  digitized: { label: "Published figure data", cls: "border-link/70 text-link", note: "Points supplied as figure data (digitized); precision limited." },
  model: { label: "Model prediction", cls: "border-warn/70 text-warn", note: "Output of a numerical model, not a measurement." },
  condition: { label: "Test condition", cls: "border-text-2/60 text-text-2", note: "Experimental setting (an input), not an outcome." },
  report: { label: "Report statement", cls: "border-link/60 text-link", note: "Stated in a NASA report (page cited); per-test values not available." },
  literature: { label: "Literature value", cls: "border-dashed border-text-2 text-text-2", note: "Quoted from the literature in a NASA report; not measured in this experiment." },
  log: { label: "Operational log", cls: "border-text-2/60 text-text-2", note: "What was run and when (counts, dates)." },
  passage: { label: "NASA document passage", cls: "border-text-2/60 text-text-2", note: "Text retrieved from an indexed NASA document; open the page to read it in context." },
  metadata: { label: "Metadata only", cls: "border-dashed border-text-3 text-text-3", note: "Only investigation metadata was downloaded: no measurements or model output." },
  guided: { label: "Evidence-guided concept", cls: "border-flame/70 text-flame", note: "Arrangement or behaviour documented in a NASA source; drawn shape is illustrative." },
  illustration: { label: "Educational illustration", cls: "border-dashed border-text-3 text-text-3", note: "Shape, colour, size or motion chosen for clarity; not from data." },
} as const;
export type EvidenceKind = keyof typeof EVIDENCE;

export function EvidenceTag({ kind, className = "" }: { kind: EvidenceKind; className?: string }) {
  const e = EVIDENCE[kind];
  return <span title={e.note} data-evidence={kind} className={`inline-flex items-center whitespace-nowrap rounded border px-1.5 py-px text-[11.5px] font-medium ${e.cls} ${className}`}>{e.label}</span>;
}

export const docHref = (id: string, page?: number | null) => `/api/v1/documents/${id}/file${page ? `#page=${page}` : ""}`;

export function DocLink({ id, page, children }: { id: string; page?: number | null; children: React.ReactNode }) {
  return <a href={docHref(id, page)} target="_blank" rel="noreferrer">{children}</a>;
}

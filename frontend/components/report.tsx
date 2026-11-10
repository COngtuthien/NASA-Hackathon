"use client";

import { fmt } from "@/lib/api";

export type ReportRecord = {
  record_id: string; table_id: string; page_pdf: number; page_printed: number | null; row_key: string; test_id: string;
  experiment_uid: string | null; investigation: string; verification: string; values: Record<string, unknown>;
  units: Record<string, string>; raw: Record<string, string>; checks: Record<string, boolean>; notes: string[];
  source_url?: string; document_id: string;
};

const LEVEL: Record<string, { label: string; cls: string; tip: string }> = {
  verified_table_row: { label: "Verified table row", cls: "border-ok/60 text-ok",
    tip: "Report table row whose printed values match this test's CSV values" },
  exact_context: { label: "Explicit mention", cls: "border-data/60 text-data",
    tip: "ID appears with explicit context, e.g. 'test M5' or 'GMT175-T9' with the matching day" },
  auto_unreviewed: { label: "Unreviewed mention", cls: "border-dashed border-text-3 text-text-3",
    tip: "Bare mention of the ID found automatically; not reviewed" },
};

export function LinkLevel({ level }: { level: string }) {
  const l = LEVEL[level] ?? { label: level, cls: "border-line text-text-3", tip: level };
  return <span title={l.tip} className={`inline-flex rounded border px-1.5 py-px text-[12px] font-medium ${l.cls}`}>{l.label}</span>;
}

export function VerificationBadge({ v }: { v: string }) {
  const map: Record<string, [string, string]> = {
    verified: ["Verified against CSV", "border-ok/60 text-ok"],
    needs_review: ["Disagrees with CSV", "border-warn/60 text-warn"],
    not_applicable: ["Different investigation", "border-line-strong text-text-3"],
  };
  const [label, cls] = map[v] ?? [v, "border-line text-text-3"];
  return <span className={`inline-flex rounded border px-1.5 py-px text-[12px] font-medium ${cls}`}>{label}</span>;
}

const NICE: Record<string, string> = {
  thickness_mm: "Thickness", width_cm: "Width", sides_burning: "Sides burning", velocity_cm_s: "Velocity stages",
  spread_rate_mm_s: "Spread-rate stages", spread_rate_status: "Spread rate", burn_time_min: "Burn time",
  initial_o2_vol_pct: "Initial O₂", final_o2_vol_pct: "Final O₂", gmt_day_of_year: "GMT day of year",
  sample_width_cm: "Sample width", flow_cm_s: "Flow", flow_change: "Flow change", o2_vol_pct: "O₂", o2_footnote: "O₂ footnote",
  comment: "Comment", outcome: "Outcome", as_run_number: "As-run number", flow_direction: "Flow direction",
  material_description: "Material (as printed)", start_time_gmt: "Start time (GMT)", actual_date: "Actual date",
  observations: "Test observations and anomalies", o2_initial_uncalibrated: "Initial O₂ (uncalibrated)",
  o2_final_uncalibrated: "Final O₂ (uncalibrated)",
};

function show(v: unknown): string {
  if (Array.isArray(v)) return v.length ? v.map((x) => fmt(x)).join(", ") : "—";
  return fmt(v);
}

export function ReportRecordCard({ r }: { r: ReportRecord }) {
  const entries = Object.entries(r.values).filter(([k, v]) => v !== null && v !== "" && !(Array.isArray(v) && !v.length) && k !== "observations");
  const failed = Object.entries(r.checks).filter(([, ok]) => !ok).map(([k]) => k);
  return (
    <article className="rounded-md border border-line p-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold">Table {r.table_id}, row {r.row_key}</span>
        <VerificationBadge v={r.verification} />
        <a href={r.source_url ?? `/api/v1/documents/${r.document_id}/file#page=${r.page_pdf}`} target="_blank" rel="noreferrer">
          PDF p.{r.page_pdf}{r.page_printed ? ` (printed p.${r.page_printed})` : ""}
        </a>
      </div>
      <dl className="mt-2 grid grid-cols-[minmax(120px,max-content)_1fr] gap-x-4 gap-y-1 text-sm">
        {entries.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-text-2">{NICE[k] ?? k}</dt>
            <dd>{show(v)}{r.units[k] ? <span className="text-text-3"> {r.units[k]}</span> : null}</dd>
          </div>
        ))}
      </dl>
      {typeof r.values.observations === "string" && r.values.observations && (
        <blockquote className="mt-2 border-l-2 border-link/50 pl-3 text-sm text-text-2">“{r.values.observations}”</blockquote>
      )}
      {Object.keys(r.checks).length > 0 && (
        <p className="mt-2 text-xs text-text-3">
          Cross-checked with CSV: {Object.keys(r.checks).filter((k) => k !== "test_id").join(", ") || "test ID"}
          {failed.length ? <span className="text-warn">. Disagreement: {failed.join(", ")}</span> : null}
        </p>
      )}
      {r.notes.length > 0 && <ul className="mt-1 list-disc pl-5 text-xs text-text-3">{r.notes.map((n) => <li key={n}>{n}</li>)}</ul>}
    </article>
  );
}

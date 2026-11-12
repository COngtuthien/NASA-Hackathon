"use client";

// Material comparison for BASS-II: two real tests side by side, with their recorded CSV fields, report-table rows
// (spread rates exactly as printed) and differences flagged. Report-vs-CSV disagreements (nominal vs actual width)
// are shown, never reconciled. No ranking of materials is derived from two tests.
import Link from "next/link";
import type { Detail } from "@/components/studio/EvidencePanel";
import { Loadable, Prov } from "@/components/ui";
import { expHref, fmt, useApi } from "@/lib/api";

type Item = { experiment_uid: string; display_id: string; fields: Record<string, unknown> };
type ListResp = { total: number; items: Item[] };

const ROWS: { key: string; label: string; unit?: string; cond?: boolean; raw?: boolean }[] = [
  { key: "pi", label: "Principal investigator" },
  { key: "material_raw", label: "Material (as recorded)", raw: true },
  { key: "material_class", label: "Material class", cond: true },
  { key: "geometry", label: "Geometry", cond: true },
  { key: "thickness_mm", label: "Thickness (CSV text)", unit: "mm", cond: true },
  { key: "diameter_mm", label: "Diameter (CSV text)", unit: "mm", cond: true },
  { key: "width_cm", label: "Width (CSV text, nominal)", unit: "cm", cond: true },
  { key: "flow_direction", label: "Flow direction", cond: true },
  { key: "flow_restrictor", label: "Flow restrictors", cond: true },
  { key: "air_raw", label: "Air display (cm/s, stages)", raw: true },
  { key: "o2_initial", label: "Initial O₂", unit: "% vol", cond: true },
  { key: "o2_final", label: "Final O₂", unit: "% vol" },
];

const same = (x: unknown, y: unknown) => (typeof x === "number" && typeof y === "number" ? Math.abs(x - y) < 1e-9 : String(x ?? "") === String(y ?? ""));

function reportValues(d: Detail) {
  return d.report_records.map((r) => ({
    id: r.record_id, table: r.table_id, page: r.page_pdf, doc: r.document_id,
    spread: r.values.spread_rate_mm_s as number[] | undefined, velocity: (r.values.velocity_cm_s ?? r.values.flow_cm_s) as number[] | undefined,
    width: (r.values.width_cm ?? r.values.sample_width_cm) as number | undefined,
  }));
}

export default function BassCompare({ recA, recB, setRecA, setRecB }: {
  recA: string | null; recB: string | null; setRecA: (u: string | null) => void; setRecB: (u: string | null) => void;
}) {
  const list = useApi<ListResp>("/experiments?dataset=bass2&page_size=200&sort=gmt_doy");
  const da = useApi<Detail>(recA ? `/experiments/${encodeURIComponent(recA)}` : null);
  const db = useApi<Detail>(recB ? `/experiments/${encodeURIComponent(recB)}` : null);
  const A = da.data?.experiment_uid === recA ? da.data : null;
  const B = db.data?.experiment_uid === recB ? db.data : null;
  const diff = A && B ? ROWS.filter((r) => r.cond && !same(A.normalized[r.key], B.normalized[r.key])).map((r) => r.key) : [];

  const select = (value: string | null, set: (u: string | null) => void, label: string, id: string) => (
    <label htmlFor={id} className="flex flex-col gap-1 text-sm">
      <span className="text-text-2">{label}</span>
      <select id={id} value={value ?? ""} onChange={(e) => set(e.target.value || null)}
        className="min-h-9 rounded-md border border-line-strong bg-ink px-2 text-[13px] text-text">
        <option value="">Choose a test…</option>
        {(list.data?.items ?? []).map((it) => (
          <option key={it.experiment_uid} value={it.experiment_uid}>{it.display_id} · {String(it.fields.pi)} · {String(it.fields.material_class)} · {String(it.fields.flow_direction ?? "flow n/r")}</option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="flex flex-col gap-4" data-testid="bass-compare">
      <p className="text-[12.5px] text-text-3">The 3D view shows test A (left) and test B (right) drawn with their recorded geometry and flow direction. Each PI used one material family, geometry and flow direction, so cross-PI differences are confounded.</p>
      <Loadable state={list} rows={2}>
        {() => (
          <div className="grid gap-3 sm:grid-cols-2">
            {select(recA, setRecA, "Test A (left)", "bc-a")}
            {select(recB, setRecB, "Test B (right)", "bc-b")}
          </div>
        )}
      </Loadable>
      {A && B ? (
        <section aria-labelledby="bc-t" data-testid="compare-table">
          <h3 id="bc-t" className="subhead text-[14.5px]">Recorded values side by side</h3>
          <p className={`mt-1 rounded-lg border px-2.5 py-1.5 text-[12.5px] ${diff.length ? "border-warn/60 text-warn" : "border-ok/60 text-ok"}`} data-testid="compare-verdict">
            {diff.length ? `Not numerically comparable as a material property: ${diff.length} recorded condition${diff.length > 1 ? "s" : ""} differ (highlighted).` : "Recorded conditions are the same; still two single tests."}
          </p>
          <div className="mt-2 overflow-x-auto">
            <table className="data">
              <thead><tr><th>Field</th><th><Link href={expHref(A.experiment_uid)}>A · {A.display_id}</Link></th><th><Link href={expHref(B.experiment_uid)}>B · {B.display_id}</Link></th></tr></thead>
              <tbody>
                {ROWS.map((row) => {
                  const off = diff.includes(row.key);
                  const cell = (d: Detail) => {
                    const v = d.normalized[row.key];
                    if (v === null || v === undefined || v === "") return <span className="text-text-3">—</span>;
                    return row.raw ? <span className="raw">{String(v)}</span> : <>{fmt(v)}</>;
                  };
                  return (
                    <tr key={row.key} data-mismatch={off ? "true" : undefined}>
                      <td className="text-text-2">{row.label}{row.unit ? ` (${row.unit})` : ""}{off && <span className="ml-1 text-warn">≠</span>}</td>
                      <td className={off ? "font-semibold text-warn" : ""}>{cell(A)}</td>
                      <td className={off ? "font-semibold text-warn" : ""}>{cell(B)}</td>
                    </tr>
                  );
                })}
                <tr>
                  <td className="text-text-2">Report-table rows <Prov kind="report_table" /></td>
                  {[A, B].map((d) => (
                    <td key={d.experiment_uid} className="text-[12.5px]">
                      {reportValues(d).length ? reportValues(d).map((r) => (
                        <span key={r.id} className="block">
                          <a href={`/api/v1/documents/${r.doc}/file#page=${r.page}`} target="_blank" rel="noreferrer">Table {r.table}, p.{r.page}</a>
                          {r.width !== undefined && <>: width {fmt(r.width)} cm</>}
                          {r.velocity && <>, flow {r.velocity.join(", ")} cm/s</>}
                          {r.spread && <>, spread {r.spread.join(", ")} mm/s</>}
                        </span>
                      )) : <span className="text-text-3">none</span>}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[12px] text-text-3">Spread rates appear exactly as printed in the Summary Report and belong to the flow stage printed beside them. CSV widths are nominal (1 or 2 cm); report tables print actual widths (1.2 or 2.2 cm). Both are shown, never reconciled.</p>
        </section>
      ) : (
        <p className="rounded-lg border border-dashed border-line-strong px-3 py-3 text-[13px] text-text-2">Choose two tests to compare their recorded conditions. Without tests, the split view compares two sample types conceptually.</p>
      )}
    </div>
  );
}

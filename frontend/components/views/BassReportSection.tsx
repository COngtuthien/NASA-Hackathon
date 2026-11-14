"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import Plot, { baseLayout } from "@/components/Plot";
import { VerificationBadge, type ReportRecord } from "@/components/report";
import { Loadable, Panel, Prov } from "@/components/ui";
import { expHref, fmt, useApi } from "@/lib/api";

type Stage = { experiment_uid: string; test_id: string; stage: number; thickness_mm: number; width_cm: number;
  sides_burning: number; velocity_cm_s: number; spread_rate_mm_s: number; page_pdf: number };
type Resp = {
  table_5_1: { rows: ReportRecord[]; stages: Stage[]; n_tests: number; n_stages: number; unpaired_tests: string[]; note: string; page_pdf: number };
  table_7_1: { rows: ReportRecord[]; page_pdf: number };
  appendix_a: { verified: number; needs_review: string[]; flow_direction_counts: Record<string, number> };
  method: string;
  consistency: Consistency | null;
};
type VelocityCheck = { test_id: string; table: string; report_velocity_cm_s: number[]; air_display: string; all_in_display: boolean; not_in_display: number[] };
type Consistency = {
  summary: { thickness_checked: number; thickness_agree: number; width_checked: number; width_agree: number; velocity_checked: number;
    velocity_all_in_display: number; low_flow_examples: VelocityCheck[]; display_near_zero: VelocityCheck[]; conflicts: number };
  conflicts: { test_id: string; field: string; where: string; detail: string }[];
  direction_from_table_7_1: { test_id: string; page_pdf: number }[];
  method: string;
};

function Agreement({ label, n, ok, note, children }: { label: string; n: number; ok: number; note: string; children?: React.ReactNode }) {
  const pct = n ? (ok / n) * 100 : 0;
  return (
    <li className="rounded-lg border border-line p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-semibold text-text">{label}</span>
        <span className="text-sm text-text-2"><span className={ok === n ? "text-ok" : "text-warn"}>{ok} of {n}</span> consistent</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink" role="img" aria-label={`${label}: ${ok} of ${n} consistent`}>
        <div className={`h-full rounded-full ${ok === n ? "bg-ok" : "bg-warn"}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1.5 text-xs text-text-3">{note}</p>
      {children}
    </li>
  );
}

function ReportTrust({ c }: { c: Consistency }) {
  const s = c.summary;
  const v = (x: VelocityCheck) => `${x.test_id}: report ${x.report_velocity_cm_s.join(", ")} cm/s, display “${x.air_display}”`;
  return (
    <Panel id="report-trust" title="How far the report-only values can be trusted" aside="cross-checks within the report and against the CSV text">
      <p className="max-w-[80ch] text-sm text-text-2">Thickness, width, flow velocity and flow direction in Tables 5.1 and 7.1 are not numeric CSV columns, so the CSV cannot verify them directly. Where the report prints a value twice, or the CSV&apos;s material text repeats it, SpaceFire compares the copies. Nothing is corrected; disagreements become flags.</p>
      <ul className="mt-3 grid gap-3 lg:grid-cols-3">
        <Agreement label="Sample thickness" n={s.thickness_checked} ok={s.thickness_agree} note="Table 5.1 vs the Appendix A log vs the CSV material text." />
        <Agreement label="Sample width" n={s.width_checked} ok={s.width_agree} note="Tables print actual widths (2.2 / 1.2 cm); the log and CSV give nominal 2 / 1 cm.">
          {c.conflicts.filter((x) => x.field === "width_cm").map((x) => (
            <p key={x.test_id} className="mt-1.5 text-xs text-warn"><Link href={`/reliability?rule_id=BASS-REPORT-INTERNAL-CONFLICT`}>{x.test_id}</Link>: {x.detail}.</p>))}
        </Agreement>
        <Agreement label="Flow velocity vs Air display" n={s.velocity_checked} ok={s.velocity_all_in_display}
          note="Report velocities found among the Air display readings logged for the same test.">
          <p className="mt-1.5 text-xs text-text-2">The display is a facility readout, not the analysed velocity: at low flow the report gives more than the display ({s.low_flow_examples.slice(0, 2).map(v).join("; ")}){s.display_near_zero.length > 0 && <>, and {s.display_near_zero.map(v).join("; ")}</>}.
            {" "}<Link href="/reliability?rule_id=BASS-AIR-DISPLAY-NOT-VELOCITY">Read the flag</Link></p>
        </Agreement>
      </ul>
      {c.direction_from_table_7_1.length > 0 && (
        <p className="mt-3 text-sm text-text-2"><Prov kind="DOC" /> Flow direction for {c.direction_from_table_7_1.map((d) => d.test_id).join(", ")} is taken from the title of Table 7.1 (“flat SIBAL fabrics in concurrent flow”, PDF p.{c.direction_from_table_7_1[0].page_pdf}); their Appendix A direction cell holds another column&apos;s value.</p>
      )}
      <p className="mt-2 text-xs text-text-3">Still unverifiable: spread rates, burn times and outcomes are printed once only; figures in the report are not digitized.</p>
    </Panel>
  );
}

const OUTCOME_LABEL: Record<string, string> = { quenched: "Quenched", no_ignition: "No ignition", blowoff: "Blow-off",
  no_blowoff: "No blow-off", ignited: "Ignited (reused)", ignited_one_sided: "One-sided flame (reused)" };

// Sequential single-hue ramp for a magnitude (thickness), light -> dark on the dark surface.
const THICK = ["#9BE3F0", "#5FCBE0", "#22A6BF", "#1A7F93", "#125B69"];

export default function BassReportSection() {
  const router = useRouter();
  const st = useApi<Resp>("/analytics/bass/report");
  const plot = useMemo(() => {
    if (!st.data) return null;
    const stages = st.data.table_5_1.stages;
    const byTest = new Map<string, Stage[]>();
    stages.forEach((s) => byTest.set(s.test_id, [...(byTest.get(s.test_id) ?? []), s]));
    const thicknesses = [...new Set(stages.map((s) => s.thickness_mm))].sort((a, b) => a - b);
    const data: unknown[] = thicknesses.map((t, i) => {
      const pts = stages.filter((s) => s.thickness_mm === t);
      return {
        type: "scatter", mode: "markers", name: `${t} mm thick (${new Set(pts.map((p) => p.test_id)).size} tests)`,
        x: pts.map((p) => p.velocity_cm_s), y: pts.map((p) => p.spread_rate_mm_s), customdata: pts.map((p) => p.experiment_uid),
        text: pts.map((p) => `${p.test_id}, stage ${p.stage}, ${p.sides_burning === 2 ? "two" : "one"}-sided`),
        hovertemplate: "<b>%{text}</b><br>Opposed flow %{x} cm/s<br>Spread rate %{y} mm/s<extra></extra>",
        marker: { color: THICK[Math.min(i, THICK.length - 1)], size: 10, symbol: pts.map((p) => (p.sides_burning === 2 ? "circle" : "diamond")),
          line: { color: "#101E33", width: 1.5 } },
      };
    });
    // faint connector per test, in printed stage order (no legend entry; identity is carried by the markers)
    byTest.forEach((pts) => {
      if (pts.length < 2) return;
      data.unshift({ type: "scatter", mode: "lines", x: pts.map((p) => p.velocity_cm_s), y: pts.map((p) => p.spread_rate_mm_s),
        line: { color: "rgba(127,146,173,0.35)", width: 1 }, hoverinfo: "skip", showlegend: false });
    });
    return { data, layout: baseLayout("Opposed flow velocity (cm/s)", "Flame spread rate (mm/s)") };
  }, [st.data]);

  return (
    <Loadable state={st} rows={6}>
      {(d) => (
        <div className="mt-5 flex flex-col gap-5">
          <Panel id="spread" title="Spread rate vs flow velocity, flat PMMA (Summary Report Table 5.1)"
            aside={`n = ${d.table_5_1.n_stages} stages from ${d.table_5_1.n_tests - d.table_5_1.unpaired_tests.length} tests`}>
            <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
              <div>
                {plot && <Plot data={plot.data} layout={plot.layout} height={360} sequential onPointClick={(u) => router.push(expHref(String(u)))}
                  ariaLabel="Scatter of flame spread rate versus opposed flow velocity for Miller's flat PMMA tests, by thickness" />}
                <p className="mt-1 text-xs text-text-3">Color: sample thickness (lighter = thinner). Circle: two-sided burning; diamond: one-sided. Click a point to open the test.</p>
              </div>
              <div className="text-sm">
                <p><Prov kind="DOC" /> Values as printed in <a href={`/api/v1/documents/bass-ii-summary-report/file#page=${d.table_5_1.page_pdf}`} target="_blank" rel="noreferrer">Table 5.1, PDF p.{d.table_5_1.page_pdf}</a>; every row matched the CSV&apos;s O₂ readings.</p>
                <p className="mt-2 text-text-2">{d.table_5_1.note}</p>
                {d.table_5_1.unpaired_tests.length > 0 && (
                  <p className="mt-2 text-text-3">Not plotted: {d.table_5_1.unpaired_tests.map((t) => <Link key={t} className="mr-1.5" href={`/experiments?dataset=bass2&q=${t}`}>{t}</Link>)} (spread rate not tracked, or stage lists of different length).</p>
                )}
                <p className="mt-2 text-xs text-text-3">Different tests also differ in O₂ and sides burned; this is a descriptive view of the printed table, not a fitted model.</p>
                <p className="mt-2 text-xs text-text-3">Velocities are the report&apos;s analysis velocities. The CSV&apos;s “Air display” is a readout and often differs (<a href="#report-trust">see the cross-checks</a>).</p>
              </div>
            </div>
          </Panel>
          <Panel id="outcomes" title="SIBAL fabric outcomes in concurrent flow (Summary Report Table 7.1)" aside={`${d.table_7_1.rows.length} rows, PDF p.${d.table_7_1.page_pdf}`}>
            <div className="max-h-[60vh] overflow-auto">
              <table className="data">
                <thead><tr><th>Test (as printed)</th><th className="num">Width (cm)</th><th>Flow (cm/s)</th><th className="num">O₂ (% vol)</th><th>Outcome</th><th>Check</th></tr></thead>
                <tbody>{d.table_7_1.rows.map((r) => (
                  <tr key={r.record_id}>
                    <td>{r.experiment_uid ? <Link href={expHref(r.experiment_uid)}>{r.row_key}</Link> : <span>{r.row_key}</span>}</td>
                    <td className="num">{fmt(r.values.sample_width_cm)}</td>
                    <td>{r.raw["Flow, cm/s"]}</td>
                    <td className="num">{fmt(r.values.o2_vol_pct)}{r.values.o2_footnote ? <sup className="text-text-3">{String(r.values.o2_footnote)}</sup> : null}</td>
                    <td>{r.values.outcome ? OUTCOME_LABEL[String(r.values.outcome)] ?? String(r.values.comment) : <span className="text-text-3">not stated</span>}</td>
                    <td><VerificationBadge v={r.verification} /></td>
                  </tr>))}</tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-text-3">Rows marked “Different investigation” are earlier BASS (I) tests that share a test name with a BASS-II test; they are shown for completeness and never linked to BASS-II records.</p>
          </Panel>
          <Panel id="report" title="Test matrices (Appendix A)">
            <p className="text-sm">{d.appendix_a.verified} of 126 rows verified against the CSV. Flow direction from the report: {Object.entries(d.appendix_a.flow_direction_counts).map(([k, v]) => `${k === "None" ? "not stated" : k} ${v}`).join(", ")}.
              {d.appendix_a.needs_review.length > 0 && <> Rows that disagree with the CSV: {d.appendix_a.needs_review.map((t) => <Link key={t} className="mx-1" href={`/reliability?rule_id=BASS-REPORT-CSV-CONFLICT`}>{t}</Link>)}.</>}</p>
            <p className="mt-1 text-xs text-text-3">{d.method}</p>
          </Panel>
          {d.consistency && <ReportTrust c={d.consistency} />}
        </div>
      )}
    </Loadable>
  );
}

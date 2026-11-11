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
};

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
                {plot && <Plot data={plot.data} layout={plot.layout} height={360} onPointClick={(u) => router.push(expHref(String(u)))}
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
        </div>
      )}
    </Loadable>
  );
}

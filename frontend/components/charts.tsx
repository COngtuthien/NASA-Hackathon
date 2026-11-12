"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";
import Plot, { baseLayout, CAT, OUTCOME_COLOR, OUTCOME_SYMBOL } from "@/components/Plot";
import { expHref } from "@/lib/api";

export type FlexPoint = {
  experiment_uid: string; identifier: string; fuel: string; diluent: string; pressure_atm: number | null;
  x_o2: number; d0_mm: number; dext_mm: number | null; dext_over_d0: number | null; k_mm2_s: number | null;
  burn_time_s: number | null; test_end: string;
};

const OUTCOMES = ["Extinction", "Disruption", "Completion"];

export function FlexMapChart({ points, height = 400, highlight = null }: { points: FlexPoint[]; height?: number; highlight?: string | null }) {
  const router = useRouter();
  const data = useMemo(() => [...OUTCOMES.map((o) => {
    const pts = points.filter((p) => p.test_end === o);
    return {
      type: "scatter", mode: "markers", name: `${o} (n=${pts.length})`,
      x: pts.map((p) => p.x_o2), y: pts.map((p) => p.d0_mm), customdata: pts.map((p) => p.experiment_uid),
      text: pts.map((p) => `${p.identifier}: ${p.fuel}, ${p.diluent}, ${p.pressure_atm ? p.pressure_atm.toFixed(2) + " atm" : "P invalid"}`),
      hovertemplate: "<b>%{text}</b><br>X_O2 %{x:.3f} (mole fraction)<br>D0 %{y:.2f} mm<br>Test end: " + o +
        "<br><i>Click to open the source row</i><extra></extra>",
      marker: { color: OUTCOME_COLOR[o], symbol: OUTCOME_SYMBOL[o], size: 9, opacity: 0.88,
        line: { color: "#101E33", width: 1.5 } },
    };
  }), ...points.filter((p) => p.experiment_uid === highlight).map((p) => ({
    // the test selected in the 3D studio, ringed (same coordinates as its own point)
    type: "scatter", mode: "markers", name: `Selected in the 3D studio: ${p.identifier}`, x: [p.x_o2], y: [p.d0_mm], customdata: [p.experiment_uid],
    hovertemplate: `<b>${p.identifier}</b> (selected in the studio)<extra></extra>`,
    marker: { color: "rgba(0,0,0,0)", size: 20, symbol: "circle", line: { color: "#E6EDF7", width: 2.5 } },
  }))], [points, highlight]);
  const layout = useMemo(() => baseLayout("Initial O₂ (mole fraction)", "Initial droplet diameter D₀ (mm)"), []);
  return (
    <Plot data={data} layout={layout} height={height}
      ariaLabel={`Scatter of ${points.length} FLEX tests: initial oxygen versus droplet diameter, colored by test outcome`}
      onPointClick={(uid) => router.push(expHref(String(uid)))} />
  );
}

export function BarChart({ x, series, xTitle, yTitle, height = 320, ariaLabel, stack = false }: {
  x: (string | number)[]; series: { name: string; y: number[]; color?: string }[]; xTitle: string; yTitle: string;
  height?: number; ariaLabel: string; stack?: boolean;
}) {
  const data = useMemo(() => series.map((s, i) => ({
    type: "bar", name: s.name, x, y: s.y, marker: { color: s.color ?? CAT[i % CAT.length], line: { color: "#101E33", width: 2 } },
    hovertemplate: `${s.name}: %{y}<br>${xTitle}: %{x}<extra></extra>`,
  })), [x, series, xTitle]);
  const layout = useMemo(() => baseLayout(xTitle, yTitle, { barmode: stack ? "stack" : "group", bargap: 0.25 }),
    [xTitle, yTitle, stack]);
  return <Plot data={data} layout={layout} height={height} ariaLabel={ariaLabel} />;
}

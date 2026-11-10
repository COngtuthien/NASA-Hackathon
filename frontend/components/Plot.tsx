"use client";

import { useEffect, useRef, useState } from "react";

// Validated categorical slots (dataviz validator, dark, surface #101E33). Order is fixed, never cycled.
export const CAT = ["#22A6BF", "#D87830", "#A07CEB", "#56A93B"];
export const OUTCOME_COLOR: Record<string, string> = { Extinction: CAT[0], Disruption: CAT[1], Completion: CAT[2] };
export const OUTCOME_SYMBOL: Record<string, string> = { Extinction: "circle", Disruption: "x", Completion: "diamond" };

type PlotlyLike = {
  react: (el: HTMLElement, data: unknown[], layout: unknown, config: unknown) => Promise<unknown>;
  purge: (el: HTMLElement) => void;
};
type PlotEl = HTMLDivElement & { on?: (ev: string, cb: (e: { points: { customdata?: unknown }[] }) => void) => void;
  removeAllListeners?: (ev: string) => void };

export function baseLayout(xTitle: string, yTitle: string, extra: Record<string, unknown> = {}) {
  const axis = (title: string) => ({
    title: { text: title, font: { size: 13, color: "#A9B8CD" } },
    gridcolor: "#1D3150", zerolinecolor: "#31496D", linecolor: "#31496D", tickfont: { color: "#A9B8CD", size: 12 },
    automargin: true,
  });
  return {
    paper_bgcolor: "#101E33", plot_bgcolor: "#101E33", font: { family: "Archivo, sans-serif", color: "#E6EDF7" },
    margin: { l: 56, r: 16, t: 16, b: 52 }, xaxis: axis(xTitle), yaxis: axis(yTitle),
    legend: { orientation: "h", y: -0.22, font: { color: "#E6EDF7", size: 12 } },
    hoverlabel: { bgcolor: "#16273F", bordercolor: "#31496D", font: { color: "#E6EDF7", family: "Archivo" } },
    ...extra,
  };
}

export default function Plot({ data, layout, height = 380, onPointClick, ariaLabel }: {
  data: unknown[]; layout: Record<string, unknown>; height?: number; ariaLabel: string;
  onPointClick?: (customdata: unknown) => void;
}) {
  const ref = useRef<PlotEl>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const clickRef = useRef(onPointClick);
  useEffect(() => {
    clickRef.current = onPointClick;
  }, [onPointClick]);

  useEffect(() => {
    let cancelled = false;
    const el = ref.current;
    if (!el) return;
    import("plotly.js-dist-min")
      .then((mod) => {
        if (cancelled) return;
        const Plotly = (mod as unknown as { default?: PlotlyLike }).default ?? (mod as unknown as PlotlyLike);
        return Plotly.react(el, data, { ...layout, height, autosize: true },
          { responsive: true, displaylogo: false, modeBarButtonsToRemove: ["lasso2d", "select2d"] }).then(() => {
          if (el.removeAllListeners) el.removeAllListeners("plotly_click");
          el.on?.("plotly_click", (e) => {
            const cd = e.points?.[0]?.customdata;
            if (cd !== undefined && clickRef.current) clickRef.current(cd);
          });
        });
      })
      .catch((e) => setFailed(String(e)));
    return () => {
      cancelled = true;
    };
  }, [data, layout, height]);

  useEffect(() => {
    const el = ref.current;
    return () => {
      if (el) import("plotly.js-dist-min").then((m) => ((m as unknown as { default?: PlotlyLike }).default ?? (m as unknown as PlotlyLike)).purge(el)).catch(() => {});
    };
  }, []);

  if (failed) return <p className="text-sm text-crit">Chart failed to load: {failed}</p>;
  return <div ref={ref} role="img" aria-label={ariaLabel} style={{ width: "100%", minHeight: height }} />;
}

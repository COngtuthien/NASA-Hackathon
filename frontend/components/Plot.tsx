"use client";

import { useEffect, useRef, useState } from "react";
import { useResolvedTheme, type Theme } from "@/lib/theme";

// Categorical slots, fixed order, never cycled. These hex values are the chart "source palette": views write them,
// and Plot maps every source colour to the live theme token when it draws (see THEME_MAP below), so a series keeps
// its identity across themes with luminance tuned per surface (validated with the dataviz validator per theme).
export const CAT = ["#22A6BF", "#D87830", "#A07CEB", "#56A93B"];
export const OUTCOME_COLOR: Record<string, string> = { Extinction: CAT[0], Disruption: CAT[1], Completion: CAT[2] };
export const OUTCOME_SYMBOL: Record<string, string> = { Extinction: "circle", Disruption: "x", Completion: "diamond" };

type PlotlyLike = {
  react: (el: HTMLElement, data: unknown[], layout: unknown, config: unknown) => Promise<unknown>;
  purge: (el: HTMLElement) => void;
  Plots?: { resize: (el: HTMLElement) => void };
};
type PlotEl = HTMLDivElement & { on?: (ev: string, cb: (e: { points: { customdata?: unknown }[] }) => void) => void;
  removeAllListeners?: (ev: string) => void };

// Source colour (as written in the views) → design token. Resolved from the live CSS variables at draw time.
const THEME_MAP: Record<string, string> = {
  "#101E33": "--panel", "#16273F": "--raised", "#E6EDF7": "--text", "#A9B8CD": "--text-2", "#7F92AD": "--text-3",
  "#1D3150": "--chart-grid", "#31496D": "--line-strong",
  "#22A6BF": "--cat-1", "#D87830": "--cat-2", "#A07CEB": "--cat-3", "#56A93B": "--cat-4",
  "#FF6B6B": "--crit", "#F5C451": "--warn", "#7FA7D9": "--info", "#4FD1E8": "--data", "#FF8A3D": "--flame",
};
// Sequential ramps keep their order; on the light surface they start darker so the first step stays visible.
const SEQ_LIGHT: Record<string, string> = {
  "#9BE3F0": "#6CC2D6", "#5FCBE0": "#2FA3BD", "#22A6BF": "#13839C", "#1A7F93": "#0C6478", "#125B69": "#074656",
};
const SEQ_SET = new Set(Object.keys(SEQ_LIGHT));

function themeColours(theme: Theme, sequential: boolean): (c: string) => string {
  const css = getComputedStyle(document.documentElement);
  const cache = new Map<string, string>();
  return (c) => {
    const k = c.toUpperCase();
    if (sequential && SEQ_SET.has(k)) return theme === "light" ? SEQ_LIGHT[k] : c;
    if (!(k in THEME_MAP)) return c;
    if (!cache.has(k)) cache.set(k, css.getPropertyValue(THEME_MAP[k]).trim() || c);
    return cache.get(k)!;
  };
}
/** Deep copy with every exact source colour replaced (strings only; numbers, data and text untouched). */
function recolour<T>(v: T, map: (c: string) => string): T {
  if (typeof v === "string") return (v.startsWith("#") ? map(v) : v) as T;
  if (Array.isArray(v)) return v.map((x) => recolour(x, map)) as T;
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) out[k] = recolour(x, map);
    return out as T;
  }
  return v;
}

export function baseLayout(xTitle: string, yTitle: string, extra: Record<string, unknown> = {}) {
  const axis = (title: string) => ({
    title: { text: title, font: { size: 13, color: "#A9B8CD" } },
    gridcolor: "#1D3150", zerolinecolor: "#31496D", linecolor: "#31496D", tickfont: { color: "#A9B8CD", size: 12 },
    automargin: true,
  });
  return {
    paper_bgcolor: "#101E33", plot_bgcolor: "#101E33", font: { family: "var(--font-archivo), Archivo, sans-serif", color: "#E6EDF7" },
    margin: { l: 56, r: 16, t: 16, b: 52 }, xaxis: axis(xTitle), yaxis: axis(yTitle),
    legend: { orientation: "h", y: -0.22, font: { color: "#E6EDF7", size: 12 } },
    hoverlabel: { bgcolor: "#16273F", bordercolor: "#31496D", font: { color: "#E6EDF7", family: "Archivo" } },
    ...extra,
  };
}

export default function Plot({ data, layout, height = 380, onPointClick, ariaLabel, sequential = false }: {
  data: unknown[]; layout: Record<string, unknown>; height?: number; ariaLabel: string;
  onPointClick?: (customdata: unknown) => void;
  /** The chart encodes magnitude with the cyan sequential ramp (re-stepped for the light surface). */
  sequential?: boolean;
}) {
  const theme = useResolvedTheme();
  const ref = useRef<PlotEl>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const clickRef = useRef(onPointClick);
  const drawn = useRef(false);
  const lastTheme = useRef<Theme | null>(null);
  useEffect(() => {
    clickRef.current = onPointClick;
  }, [onPointClick]);

  useEffect(() => {
    let cancelled = false;
    const el = ref.current;
    if (!el) return;
    // a theme change recolours the same data: no "refresh" pulse
    const retheme = lastTheme.current !== null && lastTheme.current !== theme;
    lastTheme.current = theme;
    import("plotly.js-dist-min")
      .then((mod) => {
        if (cancelled) return;
        const Plotly = (mod as unknown as { default?: PlotlyLike }).default ?? (mod as unknown as PlotlyLike);
        const map = themeColours(theme, sequential);
        return Plotly.react(el, recolour(data, map), { ...recolour(layout, map), height, autosize: true },
          { responsive: true, displaylogo: false, modeBarButtonsToRemove: ["lasso2d", "select2d"] }).then(() => {
          // Data changed (e.g. a filter): a short opacity pulse marks the redraw. Values are never tweened,
          // so no intermediate, non-existent observations are ever drawn.
          if (drawn.current && !retheme && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            el.classList.remove("chart-refresh");
            void el.offsetWidth;
            el.classList.add("chart-refresh");
          }
          drawn.current = true;
          // drawn while hidden (e.g. inside a closed disclosure): fit the real width now
          const fl = (el as unknown as { _fullLayout?: { width?: number } })._fullLayout;
          if (el.clientWidth && fl?.width && Math.abs(fl.width - el.clientWidth) > 2) Plotly.Plots?.resize(el);
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
  }, [data, layout, height, theme, sequential]);

  // A chart drawn while its disclosure was hidden gets Plotly's default width; redraw at the real width when the
  // container's size changes (opened disclosure, rotation), so it never overflows a narrow screen.
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      if (!el.clientWidth || !drawn.current) return;
      const fl = (el as unknown as { _fullLayout?: { width?: number } })._fullLayout;
      if (fl?.width && Math.abs(fl.width - el.clientWidth) < 2) return;
      import("plotly.js-dist-min").then((m) => ((m as unknown as { default?: PlotlyLike }).default ?? (m as unknown as PlotlyLike)).Plots?.resize(el)).catch(() => {});
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = ref.current;
    return () => {
      if (el) import("plotly.js-dist-min").then((m) => ((m as unknown as { default?: PlotlyLike }).default ?? (m as unknown as PlotlyLike)).purge(el)).catch(() => {});
    };
  }, []);

  if (failed) return <p className="text-sm text-crit">Chart failed to load: {failed}</p>;
  return <div ref={ref} role="img" aria-label={ariaLabel} style={{ width: "100%", maxWidth: "100%", minHeight: height, overflow: "hidden" }} />;
}

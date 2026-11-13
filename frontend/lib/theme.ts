// Phase 12: Light / Dark / System theme. The choice is stored in localStorage ("system" until the visitor picks one);
// the resolved theme lives on html[data-theme], set before first paint by the inline script in app/layout.tsx, so
// there is no flash and nothing remounts when it changes: CSS tokens switch, and the few canvases that draw colours
// themselves (Plotly charts) subscribe to the resolved theme.
import { useSyncExternalStore } from "react";
import { LIGHT_QUERY, THEME_KEY } from "@/lib/prepaint";
import { createPref } from "@/lib/ui-prefs";

export type ThemePref = "light" | "dark" | "system";
export type Theme = "light" | "dark";
export { THEME_KEY };

export function resolveTheme(pref: ThemePref): Theme {
  if (pref !== "system") return pref;
  try { return window.matchMedia(LIGHT_QUERY).matches ? "light" : "dark"; } catch { return "dark"; }
}

export function applyTheme(t: Theme) {
  document.documentElement.dataset.theme = t;
}

export const themePref = createPref<ThemePref>("local", THEME_KEY, "system", ["light", "dark", "system"], (v) => applyTheme(resolveTheme(v)));

/**
 * Follow OS changes while the choice is "system". It never applies a theme on mount: the pre-paint script already did,
 * and during hydration the stored choice still reads as the server default ("system"), which must not override it.
 */
export function watchSystemTheme(pref: ThemePref): () => void {
  if (pref !== "system") return () => {};
  const mq = window.matchMedia(LIGHT_QUERY);
  const on = () => { if (themePref.get() === "system") applyTheme(resolveTheme("system")); };
  mq.addEventListener("change", on);
  return () => mq.removeEventListener("change", on);
}

function subscribeTheme(cb: () => void) {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => mo.disconnect();
}
const currentTheme = (): Theme => (document.documentElement.dataset.theme === "light" ? "light" : "dark");

/** The theme actually shown (server snapshot: dark, the default palette). */
export function useResolvedTheme(): Theme {
  return useSyncExternalStore(subscribeTheme, currentTheme, () => "dark");
}

// Phase 11: tiny client-side layout preferences (no account). Each is an external store read through
// useSyncExternalStore, so the server snapshot is the default and the stored value applies right after hydration.
// Storage failures (private mode, blocked storage) fall back to the default silently.
import { useSyncExternalStore } from "react";

type Kind = "local" | "session";

export type Pref<T extends string> = { get: () => T; set: (v: T) => void; use: () => T; readonly key: string };

function store(kind: Kind): Storage | null {
  try { return kind === "local" ? window.localStorage : window.sessionStorage; } catch { return null; }
}

export function createPref<T extends string>(kind: Kind, key: string, fallback: T, valid: readonly T[], onSet?: (v: T) => void): Pref<T> {
  const subs = new Set<() => void>();
  let cache: T | null = null;
  const read = (): T => {
    try {
      const v = store(kind)?.getItem(key);
      return v !== null && v !== undefined && (valid as readonly string[]).includes(v) ? (v as T) : fallback;
    } catch { return fallback; }
  };
  const get = () => (typeof window === "undefined" ? fallback : (cache ??= read()));
  const subscribe = (cb: () => void) => { subs.add(cb); return () => { subs.delete(cb); }; };
  return {
    key,
    get,
    set(v) {
      cache = v;
      try { store(kind)?.setItem(key, v); } catch { /* storage unavailable: keep the in-memory value */ }
      onSet?.(v);
      subs.forEach((f) => f());
    },
    use: () => useSyncExternalStore(subscribe, get, () => fallback),
  };
}

/** Studio setup panel shown/hidden, remembered for this browsing session. */
export const studioControlsPref = createPref("session", "spacefire:studio-controls", "shown", ["shown", "hidden"] as const);

/**
 * Global navigation expanded/collapsed (desktop), remembered across visits. The layout reads it before first paint
 * (an inline script sets html[data-nav]), so the collapsed rail never flashes open.
 */
export const NAV_KEY = "spacefire:nav";
export const navPref = createPref("local", NAV_KEY, "expanded", ["expanded", "collapsed"] as const, (v) => {
  if (v === "collapsed") document.documentElement.dataset.nav = "collapsed";
  else delete document.documentElement.dataset.nav;
});

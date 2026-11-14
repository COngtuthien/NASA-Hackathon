"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ApiErrorBody = { error?: { code: string; message: string; request_id?: string; details?: unknown } };

export class ApiError extends Error {
  status: number;
  code: string;
  requestId?: string;
  constructor(status: number, code: string, message: string, requestId?: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }
}

export const API = "/api/v1";

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path.startsWith("/api/") ? path : `${API}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ApiError(0, "offline", "The SpaceFire API is not reachable. Start the backend (scripts/start).");
  }
  if (!res.ok) {
    let body: ApiErrorBody = {};
    try {
      body = await res.json();
    } catch {
      /* non-JSON error (e.g. proxy 502/500 when backend is down) */
    }
    if (!body.error && (res.status === 502 || res.status === 500 || res.status === 504)) {
      throw new ApiError(0, "offline", "The SpaceFire API is not reachable. Start the backend (scripts/start).");
    }
    throw new ApiError(res.status, body.error?.code ?? "http_error", body.error?.message ?? `HTTP ${res.status}`,
      body.error?.request_id);
  }
  return (await res.json()) as T;
}

/**
 * POST and read an NDJSON stream: `onEvent` gets each progress line as it arrives; resolves with the `data` of the
 * final `{"event":"result"}` line and rejects with an ApiError on an `{"event":"error"}` line or an HTTP error.
 */
export async function apiStream<T>(path: string, body: unknown, onEvent: (ev: Record<string, unknown>) => void,
  signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, { method: "POST", signal, body: JSON.stringify(body),
      headers: { "Content-Type": "application/json", Accept: "application/x-ndjson" } });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ApiError(0, "offline", "The SpaceFire API is not reachable. Start the backend (scripts/start).");
  }
  if (!res.ok || !res.body) {
    let b: ApiErrorBody = {};
    try { b = await res.json(); } catch { /* proxy error page */ }
    if (!b.error && (res.status === 502 || res.status === 500 || res.status === 504))
      throw new ApiError(0, "offline", "The SpaceFire API is not reachable. Start the backend (scripts/start).");
    throw new ApiError(res.status, b.error?.code ?? "http_error", b.error?.message ?? `HTTP ${res.status}`, b.error?.request_id);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    buf += dec.decode(value ?? new Uint8Array(), { stream: !done });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      const ev = JSON.parse(line) as Record<string, unknown>;
      if (ev.event === "result") return ev.data as T;
      if (ev.event === "error") {
        const er = ev.error as { code?: string; message?: string };
        throw new ApiError(500, er.code ?? "stream_error", er.message ?? "The answer stream failed.");
      }
      onEvent(ev);
    }
    if (done) break;
  }
  throw new ApiError(0, "stream_ended", "The answer stream ended before a result arrived.");
}

export type ApiState<T> ={ data: T | null; error: ApiError | null; loading: boolean; reload: () => void };

/** Fetch on mount / when `path` changes. `path = null` skips. Stale responses are ignored. */
export function useApi<T>(path: string | null, body?: unknown): ApiState<T> {
  const [tick, setTick] = useState(0);
  const bodyJson = body === undefined ? undefined : JSON.stringify(body);
  const key = path === null ? null : `${path}#${bodyJson ?? ""}#${tick}`;
  // Results are tagged with the request key; loading is derived, so no setState runs synchronously in the effect.
  const [res, setRes] = useState<{ key: string | null; data: T | null; error: ApiError | null }>({ key: null, data: null, error: null });
  const latest = useRef<string | null>(null);

  useEffect(() => {
    latest.current = key;
    if (key === null || path === null) return;
    const ctrl = new AbortController();
    apiFetch<T>(path, bodyJson === undefined ? { signal: ctrl.signal } : { method: "POST", body: bodyJson, signal: ctrl.signal })
      .then((d) => {
        if (latest.current === key) setRes({ key, data: d, error: null });
      })
      .catch((e) => {
        if ((e as Error).name === "AbortError") return;
        if (latest.current === key) {
          setRes({ key, data: null, error: e instanceof ApiError ? e : new ApiError(0, "unknown", String(e)) });
        }
      });
    return () => ctrl.abort();
  }, [key, path, bodyJson]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  const current = key !== null && res.key === key;
  return {
    data: key === null ? null : res.data,            // previous data stays visible while the next page loads
    error: current ? res.error : null,
    loading: key !== null && !current,
    reload,
  };
}

// Read-only resources that do not change while a page is open (experiment records, health) are fetched once per page
// session and shared, so the studio, a chart's record spotlight and the NASA comparison never refetch the same record.
const CACHE = new Map<string, Promise<unknown>>();
export function cachedFetch<T>(path: string): Promise<T> {
  let p = CACHE.get(path) as Promise<T> | undefined;
  if (!p) {
    // one retry after a short pause for a transient failure (offline/proxy/5xx); client errors are not retried
    p = apiFetch<T>(path).catch((e) => {
      if (e instanceof ApiError && (e.status === 0 || e.status >= 500)) return new Promise<T>((res, rej) => setTimeout(() => apiFetch<T>(path).then(res, rej), 600));
      throw e;
    });
    CACHE.set(path, p);
    p.catch(() => CACHE.delete(path));
  }
  return p;
}

/** Like useApi for GETs, but shared through cachedFetch. `reload` drops the cached copy. */
export function useCachedApi<T>(path: string | null): ApiState<T> {
  const [tick, setTick] = useState(0);
  const key = path === null ? null : `${path}#${tick}`;
  const [res, setRes] = useState<{ key: string | null; data: T | null; error: ApiError | null }>({ key: null, data: null, error: null });
  const latest = useRef<string | null>(null);
  useEffect(() => {
    latest.current = key;
    if (key === null || path === null) return;
    cachedFetch<T>(path)
      .then((d) => { if (latest.current === key) setRes({ key, data: d, error: null }); })
      .catch((e) => { if (latest.current === key) setRes({ key, data: null, error: e instanceof ApiError ? e : new ApiError(0, "unknown", String(e)) }); });
  }, [key, path]);
  const reload = useCallback(() => { if (path) CACHE.delete(path); setTick((t) => t + 1); }, [path]);
  const current = key !== null && res.key === key;
  return { data: key === null ? null : res.data, error: current ? res.error : null, loading: key !== null && !current, reload };
}

export type Health = {
  status: string;
  database: { ok: boolean; ingested_at?: string | null };
  retrieval: { mode: string };
  llm: { configured: boolean; mode: string; provider?: string; model?: string; reason?: string | null; paused_until?: string };
};
/** AI availability from the local health endpoint (shared; never calls the model, never checks quota remotely). */
export function useHealth() {
  return useCachedApi<Health>("/health");
}
export function aiStatus(h: Health | null): "on" | "paused" | "off" | "unknown" {
  if (!h) return "unknown";
  if (!h.llm.configured) return "off";
  return h.llm.mode === "paused" ? "paused" : "on";
}

export function qs(params:Record<string, string | number | boolean | null | undefined | string[]>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === null || v === undefined || v === "") continue;
    if (Array.isArray(v)) {
      if (v.length) sp.set(k, v.join("|"));
    } else sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export function fmt(v: unknown, digits = 3): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return "—";
    if (Number.isInteger(v)) return v.toLocaleString("en-US");
    return Number(v.toPrecision(digits + 1)).toString();
  }
  return String(v);
}

export const DATASETS = [
  { key: "flex", label: "FLEX", inv: "PSI-69", system: "Liquid droplets" },
  { key: "bass2", label: "BASS-II", inv: "PSI-25", system: "Solid samples" },
  { key: "saffire1", label: "SAFFIRE-I", inv: "PSI-98", system: "Spacecraft-scale fabric" },
] as const;

export const INV_LABEL: Record<string, string> = { "PSI-69": "FLEX", "PSI-25": "BASS-II", "PSI-98": "SAFFIRE-I",
  "PSI-159": "ACME CFI-G", "PSI-10": "ACME Flame Design", "PSI-20": "ACME BRE", "PSI-102": "SAME", "PSI-117": "PSI-117",
  "PSI-68": "FLEX-2", "PSI-62": "PSI-62" };
export const INV_KEY: Record<string, string> = { "PSI-69": "flex", "PSI-25": "bass2", "PSI-98": "saffire1" };

export function datasetOf(uid: string): string {
  return uid.split(":")[0];
}

export function expHref(uid: string): string {
  return `/experiments/${datasetOf(uid)}/${encodeURIComponent(uid)}`;
}

/** Local editable copy of a value that also changes from outside (e.g. a URL param), without effects. */
export function useDraft(source: string): [string, (v: string) => void] {
  const [s, setS] = useState({ src: source, v: source });
  const value = s.src === source ? s.v : source;
  return [value, (v: string) => setS({ src: source, v })];
}

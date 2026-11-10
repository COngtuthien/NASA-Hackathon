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

export type ApiState<T> = { data: T | null; error: ApiError | null; loading: boolean; reload: () => void };

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

export function qs(params: Record<string, string | number | boolean | null | undefined | string[]>): string {
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

export const INV_LABEL: Record<string, string> = { "PSI-69": "FLEX", "PSI-25": "BASS-II", "PSI-98": "SAFFIRE-I" };
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

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode, type FormEvent } from "react";
import { useApi } from "@/lib/api";

const NAV: { group: string | null; items: { href: string; label: string }[] }[] = [
  { group: null, items: [{ href: "/", label: "Overview" }, { href: "/assistant", label: "Research assistant" }] },
  { group: "Data", items: [
    { href: "/experiments", label: "Experiment explorer" }, { href: "/compare", label: "Compare experiments" },
    { href: "/similar", label: "Similar experiments" }, { href: "/quality", label: "Data quality" },
  ] },
  { group: "Evidence", items: [
    { href: "/evidence", label: "NASA documents" }, { href: "/research", label: "External research" },
  ] },
  { group: "Physics lab", items: [
    { href: "/physics/flex", label: "FLEX droplets" }, { href: "/physics/bass-ii", label: "BASS-II solids" },
    { href: "/physics/saffire-i", label: "SAFFIRE-I case study" },
  ] },
  { group: "Models", items: [{ href: "/ml/flex", label: "FLEX burn-time model" }] },
  { group: null, items: [{ href: "/methodology", label: "Methodology & sources" }] },
];

type Health = {
  status: string; database: { ok: boolean; ingested_at: string | null };
  retrieval: { mode: string }; llm: { mode: string; configured: boolean };
};

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5 text-text no-underline hover:no-underline">
      <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden>
        <defs>
          <radialGradient id="lg" cx="50%" cy="50%" r="50%">
            <stop offset="35%" stopColor="#0A1424" />
            <stop offset="62%" stopColor="#4FD1E8" stopOpacity="0.9" />
            <stop offset="80%" stopColor="#3B6EF0" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#0A1424" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="14" cy="14" r="13" fill="url(#lg)" />
        <circle cx="14" cy="14" r="3.2" fill="#FF8A3D" />
      </svg>
      <span className="display text-[19px]">SpaceFire AI</span>
    </Link>
  );
}

function StatusBar() {
  const h = useApi<Health>("/health");
  if (h.error) return <span className="text-crit">● API offline</span>;
  if (!h.data) return <span className="text-text-3">Checking data…</span>;
  const d = h.data;
  return (
    <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <span className={d.database.ok ? "text-ok" : "text-crit"}>● Data {d.database.ok ? "loaded" : "missing"}</span>
      {d.database.ingested_at && (
        <span className="text-text-3">Imported {new Date(d.database.ingested_at).toISOString().slice(0, 16).replace("T", " ")} UTC</span>
      )}
      <span className="text-text-3">Search: {d.retrieval.mode}</span>
      <span className={d.llm.configured ? "text-ok" : "text-warn"}>
        AI synthesis: {d.llm.configured ? "on" : "off (retrieval only)"}
      </span>
    </span>
  );
}

function GlobalSearch({ onDone }: { onDone?: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  function submit(e: FormEvent) {
    e.preventDefault();
    const s = q.trim();
    if (!s) return;
    router.push(`/evidence?q=${encodeURIComponent(s)}`);
    onDone?.();
  }
  return (
    <form onSubmit={submit} role="search" className="w-full max-w-sm">
      <label htmlFor="gsearch" className="sr-only">Search NASA documents and experiment IDs</label>
      <input id="gsearch" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search documents or a test ID (e.g. M5)"
        className="min-h-9 w-full rounded-md border border-line-strong bg-ink px-3 text-sm placeholder:text-text-3 focus:border-flame" />
    </form>
  );
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="flex flex-col gap-5">
      {NAV.map((g, i) => (
        <div key={i}>
          {g.group && <p className="mb-1.5 px-3 text-[13px] text-text-3">{g.group}</p>}
          <ul className="flex flex-col gap-0.5">
            {g.items.map((it) => {
              const active = it.href === "/" ? path === "/" : path === it.href || path.startsWith(it.href + "/");
              return (
                <li key={it.href}>
                  <Link href={it.href} onClick={onNavigate} aria-current={active ? "page" : undefined}
                    className={`block rounded-md px-3 py-1.5 text-[14.5px] no-underline hover:no-underline ${
                      active ? "bg-raised text-text shadow-[inset_3px_0_0_var(--flame)]" : "text-text-2 hover:bg-raised/60 hover:text-text"}`}>
                    {it.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export default function Shell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_1fr]">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:bg-flame focus:px-3 focus:py-1 focus:text-flame-ink">
        Skip to content
      </a>
      <aside className="hidden border-r border-line bg-panel/60 px-3 py-5 lg:block">
        <div className="sticky top-5 flex flex-col gap-6">
          <div className="px-2"><Logo /></div>
          <NavList />
          <p className="px-3 text-xs text-text-3">NASA PSI data: FLEX PSI-69, BASS-II PSI-25, SAFFIRE-I PSI-98.</p>
        </div>
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button className="absolute inset-0 bg-black/60" aria-label="Close navigation" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-[84%] max-w-[300px] overflow-y-auto border-r border-line bg-panel px-3 py-5">
            <div className="mb-5 flex items-center justify-between px-2">
              <Logo />
              <button onClick={() => setOpen(false)} className="rounded px-2 py-1 text-text-2" aria-label="Close navigation">✕</button>
            </div>
            <div className="mb-4 px-2"><GlobalSearch onDone={() => setOpen(false)} /></div>
            <NavList onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}

      <div className="min-w-0">
        <header className="sticky top-0 z-30 border-b border-line bg-ink/95 backdrop-blur">
          <div className="flex items-center gap-3 px-4 py-2.5 md:px-6">
            <button className="rounded-md border border-line-strong px-2.5 py-1 text-sm lg:hidden" onClick={() => setOpen(true)}
              aria-label="Open navigation" aria-expanded={open}>Menu</button>
            <div className="lg:hidden"><Logo /></div>
            <div className="hidden flex-1 md:block"><GlobalSearch /></div>
            <div className="ml-auto hidden text-[13px] xl:block"><StatusBar /></div>
          </div>
          <div className="border-t border-line px-4 py-1.5 text-[12.5px] xl:hidden md:px-6"><StatusBar /></div>
        </header>
        <main id="main" className="mx-auto w-full max-w-[1500px] px-4 py-6 md:px-6 md:py-8">{children}</main>
      </div>
    </div>
  );
}

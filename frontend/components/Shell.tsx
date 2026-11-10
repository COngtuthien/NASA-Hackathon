"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Icon } from "@/components/icons";
import { useApi } from "@/lib/api";

type NavItem = { href: string; label: string; icon: string };
const NAV: { group: string | null; items: NavItem[] }[] = [
  { group: null, items: [
    { href: "/", label: "Overview", icon: "overview" }, { href: "/assistant", label: "Research assistant", icon: "assistant" },
  ] },
  { group: "Data", items: [
    { href: "/experiments", label: "Experiment explorer", icon: "experiments" }, { href: "/compare", label: "Compare experiments", icon: "compare" },
    { href: "/similar", label: "Similar experiments", icon: "similar" }, { href: "/quality", label: "Data quality", icon: "quality" },
  ] },
  { group: "Evidence", items: [
    { href: "/evidence", label: "NASA documents", icon: "documents" }, { href: "/research", label: "External research", icon: "research" },
  ] },
  { group: "Physics lab", items: [
    { href: "/physics/flex", label: "FLEX droplets", icon: "droplet" }, { href: "/physics/bass-ii", label: "BASS-II solids", icon: "solid" },
    { href: "/physics/saffire-i", label: "SAFFIRE-I case study", icon: "fire" },
  ] },
  { group: "Models", items: [{ href: "/ml/flex", label: "FLEX burn-time model", icon: "model" }] },
  { group: null, items: [{ href: "/methodology", label: "Methodology & sources", icon: "method" }] },
];
const ALL = NAV.flatMap((g) => g.items.map((i) => ({ ...i, group: g.group })));

type Health = {
  status: string; database: { ok: boolean; ingested_at: string | null };
  retrieval: { mode: string }; llm: { mode: string; configured: boolean };
};

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5 text-text no-underline hover:no-underline" aria-label="SpaceFire AI home">
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

function Pill({ tone, children, title }: { tone: "ok" | "warn" | "crit" | "muted"; children: ReactNode; title?: string }) {
  const cls = { ok: "text-ok border-ok/30", warn: "text-warn border-warn/30", crit: "text-crit border-crit/40", muted: "text-text-3 border-line" }[tone];
  return <span title={title} className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 ${cls}`}>{children}</span>;
}

function StatusBar() {
  const h = useApi<Health>("/health");
  if (h.error) return <Pill tone="crit">API offline: start the backend</Pill>;
  if (!h.data) return <span className="text-text-3">Checking data…</span>;
  const d = h.data;
  return (
    <span className="flex flex-wrap items-center gap-2">
      <Pill tone={d.database.ok ? "ok" : "crit"} title="Local NASA database">
        <span aria-hidden>●</span> {d.database.ok ? "Data loaded" : "Data missing"}
        {d.database.ingested_at && <span className="text-text-3">{new Date(d.database.ingested_at).toISOString().slice(0, 10)}</span>}
      </Pill>
      <Pill tone="muted" title="Evidence retrieval mode">{d.retrieval.mode}</Pill>
      <Pill tone={d.llm.configured ? "ok" : "warn"} title="AI synthesis status">{d.llm.configured ? "AI synthesis on" : "Evidence-only mode"}</Pill>
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
    <form onSubmit={submit} role="search" className="relative w-full max-w-sm">
      <label htmlFor={onDone ? "gsearch-m" : "gsearch"} className="sr-only">Search NASA documents and experiment IDs</label>
      <Icon name="research" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-3" />
      <input id={onDone ? "gsearch-m" : "gsearch"} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search documents or a test ID (e.g. M5)"
        className="min-h-9 w-full rounded-md border border-line-strong bg-ink pl-8 pr-3 text-sm placeholder:text-text-3 focus:border-flame" />
    </form>
  );
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="flex flex-col gap-4">
      {NAV.map((g, i) => (
        <div key={i}>
          {g.group && <p className="mb-1 px-3 text-[12.5px] font-medium text-text-3">{g.group}</p>}
          <ul className="flex flex-col gap-px">
            {g.items.map((it) => {
              const active = it.href === "/" ? path === "/" : path === it.href || path.startsWith(it.href + "/");
              return (
                <li key={it.href}>
                  <Link href={it.href} onClick={onNavigate} aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-2.5 rounded-md px-3 py-1.5 text-[14.5px] no-underline transition-colors hover:no-underline ${
                      active ? "bg-raised text-text shadow-[inset_3px_0_0_var(--flame)]" : "text-text-2 hover:bg-raised/60 hover:text-text"}`}>
                    <Icon name={it.icon} className={active ? "text-flame" : "text-text-3"} />
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

function Breadcrumbs() {
  const path = usePathname();
  if (path === "/") return null;
  const match = ALL.filter((i) => i.href !== "/" && (path === i.href || path.startsWith(i.href + "/")))
    .sort((a, b) => b.href.length - a.href.length)[0];
  const crumbs: { href?: string; label: string }[] = [{ href: "/", label: "Overview" }];
  if (match?.group) crumbs.push({ label: match.group });
  if (match) crumbs.push({ href: path === match.href ? undefined : match.href, label: match.label });
  if (match && path !== match.href) crumbs.push({ label: decodeURIComponent(path.split("/").pop() ?? "") });
  return (
    <nav aria-label="Breadcrumb" className="hidden min-w-0 overflow-hidden text-[13px] text-text-3 lg:block">
      <ol className="flex items-center gap-1 whitespace-nowrap">
        {crumbs.map((c, i) => (
          <li key={i} className="flex items-center gap-1">
            {i > 0 && <Icon name="chevron" size={12} />}
            {c.href ? <Link href={c.href} className="text-text-2 no-underline hover:text-text">{c.label}</Link>
              : <span aria-current={i === crumbs.length - 1 ? "page" : undefined} className={i === crumbs.length - 1 ? "text-text" : ""}>{c.label}</span>}
          </li>
        ))}
      </ol>
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
    <div className="min-h-screen lg:grid lg:grid-cols-[256px_1fr]">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:bg-flame focus:px-3 focus:py-1 focus:text-flame-ink">
        Skip to content
      </a>
      <aside className="hidden border-r border-line bg-[linear-gradient(180deg,#0E1B2F_0%,#0A1424_60%)] px-3 py-5 lg:block">
        <div className="sticky top-5 flex flex-col gap-6">
          <div className="px-2"><Logo /></div>
          <NavList />
          <p className="px-3 text-xs leading-relaxed text-text-3">NASA Physical Sciences Informatics data: FLEX PSI-69, BASS-II PSI-25, SAFFIRE-I PSI-98.</p>
        </div>
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button className="absolute inset-0 bg-black/60" aria-label="Close navigation" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-[86%] max-w-[300px] overflow-y-auto border-r border-line bg-panel px-3 py-5">
            <div className="mb-5 flex items-center justify-between px-2">
              <Logo />
              <button onClick={() => setOpen(false)} className="rounded p-1.5 text-text-2 hover:text-text" aria-label="Close navigation"><Icon name="close" size={18} /></button>
            </div>
            <div className="mb-4 px-2"><GlobalSearch onDone={() => setOpen(false)} /></div>
            <NavList onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}

      <div className="min-w-0">
        <header className="sticky top-0 z-30 border-b border-line bg-ink/90 backdrop-blur">
          <div className="flex items-center gap-3 px-4 py-2.5 md:px-6">
            <button className="inline-flex items-center gap-1.5 rounded-md border border-line-strong px-2.5 py-1 text-sm lg:hidden" onClick={() => setOpen(true)}
              aria-label="Open navigation" aria-expanded={open}><Icon name="menu" />Menu</button>
            <div className="lg:hidden"><Logo /></div>
            <div className="hidden min-w-0 flex-1 items-center gap-5 md:flex"><GlobalSearch /><Breadcrumbs /></div>
            <div className="ml-auto hidden text-[12.5px] 2xl:block"><StatusBar /></div>
          </div>
          <div className="border-t border-line px-4 py-1.5 text-[12px] 2xl:hidden md:px-6"><StatusBar /></div>
        </header>
        <main id="main" className="mx-auto w-full max-w-[1500px] px-4 py-6 md:px-6 md:py-8">{children}</main>
      </div>
    </div>
  );
}

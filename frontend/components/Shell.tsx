"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, ViewTransition, type FormEvent, type ReactNode } from "react";
import { Icon } from "@/components/icons";
import { AnimatePresence, motion, MotionProvider, DUR, EASE } from "@/components/motion";
import { useApi } from "@/lib/api";
import { ROUTES } from "@/lib/routes";

type NavItem = { href: string; label: string; icon: string; source?: string; match?: string[] };
export const NAV: { group: string; items: NavItem[] }[] = [
  { group: "Discover", items: [
    { href: ROUTES.mission, label: "Mission Control", icon: "overview" },
    { href: ROUTES.copilot, label: "Research Copilot", icon: "assistant" },
    { href: ROUTES.explorer, label: "Combustion Explorer", icon: "experiments" },
    { href: ROUTES.lab, label: "Interactive Combustion Lab", icon: "lab" },
  ] },
  { group: "Scientific analysis", items: [
    { href: ROUTES.extinction, label: "Flame Extinction & Burning Dynamics", icon: "droplet", source: "FLEX" },
    { href: ROUTES.spread, label: "Flame Spread & Material Behavior", icon: "solid", source: "BASS-II" },
    { href: ROUTES.spacecraft, label: "Spacecraft Fire Dynamics", icon: "fire", source: "SAFFIRE-I" },
  ] },
  { group: "Research intelligence", items: [
    { href: ROUTES.similar, label: "Experiment Intelligence", icon: "similar", match: ["/intelligence"] },
    { href: ROUTES.documents, label: "Evidence & Literature", icon: "documents", match: ["/evidence"] },
    { href: ROUTES.modeling, label: "Prediction & Modeling", icon: "model" },
  ] },
  { group: "Trust & methods", items: [
    { href: ROUTES.reliability, label: "Data Reliability", icon: "quality" },
    { href: ROUTES.methodology, label: "Methodology", icon: "method" },
  ] },
];
const ALL = NAV.flatMap((g) => g.items.map((i) => ({ ...i, group: g.group })));

function isActive(it: NavItem, path: string) {
  if (it.href === "/") return path === "/";
  const roots = it.match ?? [it.href];
  return roots.some((r) => path === r || path.startsWith(r + "/"));
}

type Health = {
  status: string; database: { ok: boolean; ingested_at: string | null };
  retrieval: { mode: string }; llm: { mode: string; configured: boolean };
};

function Logo() {
  const gid = `lg${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <Link href="/" className="group flex items-center gap-2.5 text-text no-underline hover:no-underline" aria-label="SpaceFire AI home">
      <svg width="30" height="30" viewBox="0 0 28 28" aria-hidden className="transition-transform duration-500 ease-out group-hover:rotate-[30deg]">
        <defs>
          <radialGradient id={gid} cx="50%" cy="50%" r="50%">
            <stop offset="35%" stopColor="#0A1424" />
            <stop offset="62%" stopColor="#4FD1E8" stopOpacity="0.9" />
            <stop offset="80%" stopColor="#5B8CFF" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#0A1424" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="14" cy="14" r="13" fill={`url(#${gid})`} />
        <ellipse cx="14" cy="14" rx="12.5" ry="4.2" fill="none" stroke="#5B8CFF" strokeOpacity="0.5" strokeWidth="0.8" transform="rotate(-24 14 14)" />
        <circle cx="14" cy="14" r="3.2" fill="#FF8A3D" />
      </svg>
      <span className="display text-[19px] leading-none">SpaceFire <span className="text-flame">AI</span></span>
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
        <span aria-hidden className="relative flex h-1.5 w-1.5">
          {d.database.ok && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ok opacity-50 [animation-iteration-count:3]" />}
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
        </span>
        {d.database.ok ? "Data loaded" : "Data missing"}
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
    <form onSubmit={submit} role="search" className="group relative w-full max-w-sm">
      <label htmlFor={onDone ? "gsearch-m" : "gsearch"} className="sr-only">Search NASA documents and experiment IDs</label>
      <Icon name="research" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-3 transition-colors group-focus-within:text-flame" />
      <input id={onDone ? "gsearch-m" : "gsearch"} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search documents or a test ID (e.g. M5)"
        className="min-h-9 w-full rounded-lg border border-line-strong/80 bg-void/60 pl-8 pr-3 text-sm placeholder:text-text-3 focus:border-flame" />
    </form>
  );
}

function NavList({ onNavigate, layoutKey }: { onNavigate?: () => void; layoutKey: string }) {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="flex flex-col gap-5">
      {NAV.map((g) => (
        <div key={g.group}>
          <p className="mb-1.5 px-3 text-[12.5px] font-medium text-text-3">{g.group}</p>
          <ul className="flex flex-col gap-px">
            {g.items.map((it) => {
              const active = isActive(it, path);
              return (
                <li key={it.href} className="relative">
                  {active && (
                    <motion.span layoutId={`nav-active-${layoutKey}`} aria-hidden
                      className="absolute inset-0 rounded-lg bg-[linear-gradient(90deg,rgba(255,138,61,0.16),rgba(22,39,63,0.9)_55%)] shadow-[inset_2px_0_0_var(--flame)]"
                      transition={{ duration: DUR.base, ease: EASE }} />
                  )}
                  <Link href={it.href} onClick={onNavigate} aria-current={active ? "page" : undefined}
                    className={`press relative flex items-start gap-2.5 rounded-lg px-3 py-1.5 text-[14px] leading-snug no-underline hover:no-underline ${
                      active ? "text-text" : "text-text-2 hover:bg-raised/50 hover:text-text"}`}>
                    <Icon name={it.icon} className={`mt-0.5 shrink-0 ${active ? "text-flame" : "text-text-3"}`} />
                    <span className="min-w-0 flex-1">{it.label}</span>
                    {it.source && <span className="mt-0.5 shrink-0 rounded border border-line px-1 text-[10.5px] leading-4 text-text-3" title={`Source: NASA ${it.source}`}>{it.source}</span>}
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

const HUB_CRUMB: Record<string, string> = {
  "/intelligence/compare": "Compare", "/intelligence/similar": "Find similar", "/evidence/literature": "External literature", "/evidence/media": "Scientific media",
};

function Breadcrumbs() {
  const path = usePathname();
  if (path === "/") return null;
  const match = ALL.filter((i) => i.href !== "/" && isActive(i, path)).sort((a, b) => b.href.length - a.href.length)[0];
  const crumbs: { href?: string; label: string }[] = [{ href: "/", label: "Mission Control" }];
  if (match) crumbs.push({ label: match.group });
  if (match) crumbs.push({ href: path === match.href ? undefined : match.href, label: match.label });
  if (HUB_CRUMB[path] && match?.href !== path) crumbs.push({ label: HUB_CRUMB[path] });
  else if (match && path !== match.href && !HUB_CRUMB[path]) crumbs.push({ label: decodeURIComponent(path.split("/").pop() ?? "") });
  return (
    <nav aria-label="Breadcrumb" className="hidden min-w-0 overflow-hidden text-[13px] text-text-3 lg:block">
      <ol className="flex items-center gap-1 whitespace-nowrap">
        {crumbs.map((c, i) => (
          <li key={i} className="flex min-w-0 items-center gap-1">
            {i > 0 && <Icon name="chevron" size={12} className="shrink-0" />}
            {c.href ? <Link href={c.href} className="text-text-2 no-underline hover:text-text">{c.label}</Link>
              : <span aria-current={i === crumbs.length - 1 ? "page" : undefined} className={`truncate ${i === crumbs.length - 1 ? "text-text" : ""}`}>{c.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export default function Shell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const showcase = path === "/";
  const hdr = useRef<HTMLElement>(null);
  useEffect(() => {
    // Section navs stick directly below the header, whose height changes with the status row.
    const el = hdr.current;
    if (!el) return;
    const ro = new ResizeObserver(() => document.documentElement.style.setProperty("--hdr", `${el.offsetHeight}px`));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <MotionProvider>
      <div className="sky min-h-screen lg:grid lg:grid-cols-[272px_1fr]">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:bg-flame focus:px-3 focus:py-1 focus:text-flame-ink">
          Skip to content
        </a>
        <aside className="hidden border-r border-line/70 bg-[linear-gradient(180deg,rgba(14,27,47,0.92)_0%,rgba(5,10,20,0.96)_70%)] px-3 py-5 lg:block">
          <div className="sticky top-5 flex max-h-[calc(100vh-2.5rem)] flex-col gap-6 overflow-y-auto pb-4">
            <div className="px-2"><Logo /></div>
            <NavList layoutKey="desk" />
            <p className="px-3 text-xs leading-relaxed text-text-3">Built on NASA Physical Sciences Informatics data: FLEX (PSI-69), BASS-II (PSI-25) and SAFFIRE-I (PSI-98).</p>
          </div>
        </aside>

        <AnimatePresence>
          {open && (
            <motion.div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: DUR.fast }}>
              <button className="absolute inset-0 bg-black/65 backdrop-blur-[2px]" aria-label="Close navigation" onClick={() => setOpen(false)} />
              <motion.div className="absolute left-0 top-0 h-full w-[86%] max-w-[310px] overflow-y-auto border-r border-line bg-panel px-3 py-5"
                initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }} transition={{ duration: DUR.base, ease: EASE }}>
                <div className="mb-5 flex items-center justify-between px-2">
                  <Logo />
                  <button onClick={() => setOpen(false)} className="rounded p-1.5 text-text-2 hover:text-text" aria-label="Close navigation"><Icon name="close" size={18} /></button>
                </div>
                <div className="mb-4 px-2"><GlobalSearch onDone={() => setOpen(false)} /></div>
                <NavList layoutKey="mobile" onNavigate={() => setOpen(false)} />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="min-w-0">
          <header ref={hdr} className="sticky top-0 z-30 border-b border-line/70 bg-ink/75 backdrop-blur-md" style={{ viewTransitionName: "site-header" }}>
            <div className="flex items-center gap-3 px-4 py-2.5 md:px-6">
              <button className="press inline-flex items-center gap-1.5 rounded-md border border-line-strong px-2.5 py-1 text-sm lg:hidden" onClick={() => setOpen(true)}
                aria-label="Open navigation" aria-expanded={open}><Icon name="menu" />Menu</button>
              <div className="lg:hidden"><Logo /></div>
              <div className="hidden min-w-0 flex-1 items-center gap-5 md:flex"><GlobalSearch /><Breadcrumbs /></div>
              <div className="ml-auto hidden text-[12.5px] 2xl:block"><StatusBar /></div>
            </div>
            <div className="border-t border-line/60 px-4 py-1.5 text-[12px] 2xl:hidden md:px-6"><StatusBar /></div>
          </header>
          <ViewTransition key={path} enter="page-enter" exit="page-exit" default="none">
            <main id="main" className={showcase ? "w-full" : "mx-auto w-full max-w-[1500px] px-4 py-6 md:px-8 md:py-9"}>{children}</main>
          </ViewTransition>
        </div>
      </div>
    </MotionProvider>
  );
}

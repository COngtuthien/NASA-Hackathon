"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, ViewTransition, type FormEvent, type ReactNode } from "react";
import DemoBar from "@/components/demo/DemoBar";
import { Icon } from "@/components/icons";
import ThemeSwitcher from "@/components/theme-switcher";
import { AnimatePresence, motion, MotionProvider, DUR, EASE } from "@/components/motion";
import { aiStatus, useHealth } from "@/lib/api";
import { ROUTES } from "@/lib/routes";
import { navPref } from "@/lib/ui-prefs";

type NavItem = { href: string; label: string; icon: string; source?: string; match?: string[] };
export const NAV: { group: string; items: NavItem[] }[] = [
  { group: "Discover", items: [
    { href: ROUTES.mission, label: "Home", icon: "overview" },
    { href: ROUTES.safety, label: "Research-to-Safety Explorer", icon: "compass" },
    { href: ROUTES.copilot, label: "Research Copilot", icon: "assistant" },
    { href: ROUTES.explorer, label: "Combustion Explorer", icon: "experiments" },
  ] },
  { group: "Scientific analysis", items: [
    { href: ROUTES.extinction, label: "Flame Extinction & Burning Dynamics", icon: "droplet", source: "FLEX" },
    { href: ROUTES.spread, label: "Flame Spread & Material Behavior", icon: "solid", source: "BASS-II" },
    { href: ROUTES.spacecraft, label: "Spacecraft Fire Dynamics", icon: "fire", source: "SAFFIRE-I" },
    { href: ROUTES.gasflames, label: "Gaseous Flame Dynamics", icon: "sphere", source: "ACME" },
    { href: ROUTES.smoke, label: "Smoke & Fire Detection", icon: "smoke", source: "SAME" },
  ] },
  { group: "Advanced research tools", items: [
    { href: ROUTES.similar, label: "Experiment Intelligence", icon: "similar", match: ["/intelligence"] },
    { href: ROUTES.documents, label: "Evidence & Literature", icon: "documents", match: ["/evidence"] },
    { href: ROUTES.modeling, label: "FLEX Burn-Time Estimator", icon: "model" },
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

function Logo({ rail = false }: { rail?: boolean }) {
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
      <span className={`display text-[19px] leading-none ${rail ? "nav-label" : ""}`}>SpaceFire <span className="text-flame">AI</span></span>
    </Link>
  );
}

function Pill({ tone, children, title }: { tone: "ok" | "warn" | "crit" | "muted"; children: ReactNode; title?: string }) {
  const cls = { ok: "text-ok border-ok/30", warn: "text-warn border-warn/30", crit: "text-crit border-crit/40", muted: "text-text-3 border-line" }[tone];
  return <span title={title} className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 ${cls}`}>{children}</span>;
}

/**
 * System status, kept quiet: a single dot and short label when everything works; a prominent pill only when the
 * data or API is unavailable. The retrieval mode is in the tooltip; the AI mode is spelled out because it changes
 * what the Research Copilot can do.
 */
function StatusBar({ compact = false }: { compact?: boolean }) {
  const h = useHealth();
  if (h.error) return <Pill tone="crit">API offline: start the backend</Pill>;
  if (!h.data) return compact ? null : <span className="text-text-3">Checking data…</span>;
  const d = h.data;
  if (!d.database.ok) return <Pill tone="crit" title="Local NASA database">Data missing</Pill>;
  if (compact) return null;
  const date = d.database.ingested_at ? new Date(d.database.ingested_at).toISOString().slice(0, 10) : null;
  return (
    <span className="flex items-center gap-3 text-text-3" data-testid="status">
      <span className="inline-flex items-center gap-1.5" title={`NASA data loaded${date ? ` ${date}` : ""} · document search: ${d.retrieval.mode}`}>
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-ok" />NASA data loaded
      </span>
      <span title="How the Research Copilot answers" className={aiStatus(d) === "on" ? "text-text-3" : "text-warn"}>
        {aiStatus(d) === "on" ? "AI answers on" : aiStatus(d) === "paused" ? "AI paused: evidence-only" : "AI: evidence-only mode"}
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
        <div key={g.group} className="nav-group">
          <p className="nav-group-title mb-1.5 px-3 text-[12.5px] font-medium text-text-3">{g.group}</p>
          <ul className="flex flex-col gap-px">
            {g.items.map((it) => {
              const active = isActive(it, path);
              return (
                <li key={it.href} className="relative">
                  {active && (
                    <motion.span layoutId={`nav-active-${layoutKey}`} aria-hidden
                      className="absolute inset-0 rounded-lg bg-[image:var(--nav-active)] shadow-[inset_2px_0_0_var(--flame)]"
                      transition={{ duration: DUR.base, ease: EASE }} />
                  )}
                  <Link href={it.href} onClick={onNavigate} aria-current={active ? "page" : undefined} data-tip={it.label}
                    className={`nav-link press relative flex items-start gap-2.5 rounded-lg px-3 py-1.5 text-[14px] leading-snug no-underline hover:no-underline ${
                      active ? "text-text" : "text-text-2 hover:bg-raised/50 hover:text-text"}`}>
                    <Icon name={it.icon} className={`mt-0.5 shrink-0 ${active ? "text-flame" : "text-text-3"}`} />
                    <span className="nav-label min-w-0 flex-1">{it.label}</span>
                    {it.source && <span className="nav-extra mt-0.5 shrink-0 rounded border border-line px-1 text-[10.5px] leading-4 text-text-3" title={`Source: NASA ${it.source}`}>{it.source}</span>}
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
  const crumbs: { href?: string; label: string }[] = [{ href: "/", label: "Home" }];
  if (match) crumbs.push({ label: match.group });
  if (match) crumbs.push({ href: path === match.href ? undefined : match.href, label: match.label });
  if (HUB_CRUMB[path] && match?.href !== path) crumbs.push({ label: HUB_CRUMB[path] });
  else if (match && path !== match.href && !HUB_CRUMB[path]) crumbs.push({ label: decodeURIComponent(path.split("/").pop() ?? "") });
  return (
    <nav aria-label="Breadcrumb" className="hidden min-w-0 overflow-hidden text-[13px] text-text-3 lg:block">
      <ol className="flex items-center gap-1 whitespace-nowrap">
        {crumbs.map((c, i) => (
          <li key={i} className={`flex items-center gap-1 ${i === 0 ? "shrink-0" : "min-w-0 overflow-hidden"}`}>
            {i > 0 && <Icon name="chevron" size={12} className="shrink-0" />}
            {c.href ? <Link href={c.href} className="truncate text-text-2 no-underline hover:text-text">{c.label}</Link>
              : <span aria-current={i === crumbs.length - 1 ? "page" : undefined} className={`truncate ${i === crumbs.length - 1 ? "text-text" : ""}`}>{c.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

function SiteFooter() {
  const groups: { title: string; links: [string, string][] }[] = [
    { title: "Explore", links: [[ROUTES.extinction, "Droplet flames"], [ROUTES.spread, "Flame spread"], [ROUTES.spacecraft, "Spacecraft fire"]] },
    { title: "Research", links: [[ROUTES.explorer, "Experiments"], [ROUTES.copilot, "Research Copilot"], [ROUTES.documents, "Evidence & literature"], [ROUTES.media, "NASA media"]] },
    { title: "Trust", links: [[ROUTES.methodology, "Methodology"], [ROUTES.reliability, "Data reliability"], [ROUTES.modeling, "Prediction & modeling"]] },
  ];
  return (
    <footer className="mt-16 border-t border-line/60 bg-void/40" aria-label="Site footer">
      <div className="mx-auto grid w-full max-w-[1400px] gap-8 px-4 py-10 md:grid-cols-[1.4fr_repeat(3,1fr)] md:px-8">
        <div className="max-w-[44ch]">
          <Logo />
          <p className="mt-3 text-[13.5px] leading-relaxed text-text-3">
            An independent research tool built on public NASA Physical Sciences Informatics data: FLEX (PSI-69), BASS-II (PSI-25) and SAFFIRE-I (PSI-98).
            NASA imagery is credited where it appears. Not an official NASA website.
          </p>
        </div>
        {groups.map((g) => (
          <nav key={g.title} aria-label={`${g.title} links`}>
            <p className="text-[13px] font-medium text-text-2">{g.title}</p>
            <ul className="mt-2 flex flex-col gap-1.5 text-[13.5px]">
              {g.links.map(([href, label]) => <li key={href}><Link href={href} className="text-text-3 no-underline hover:text-text">{label}</Link></li>)}
            </ul>
          </nav>
        ))}
      </div>
    </footer>
  );
}

export default function Shell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  // Phase 11: desktop navigation collapses to an icon rail (remembered; applied before paint via html[data-nav])
  const collapsed = navPref.use() === "collapsed";
  const toggleNav = () => navPref.set(collapsed ? "expanded" : "collapsed");
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
      <div className="sky shell-grid min-h-screen lg:grid">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:bg-flame focus:px-3 focus:py-1 focus:text-flame-ink">
          Skip to content
        </a>
        <aside id="site-nav" data-testid="site-nav" data-collapsed={collapsed ? "true" : "false"}
          className="shell-aside hidden min-w-0 border-r border-line/70 bg-[linear-gradient(180deg,var(--side-from)_0%,var(--side-to)_70%)] px-3 py-5 lg:block">
          <div className="nav-scroll sticky top-5 flex max-h-[calc(100vh-2.5rem)] flex-col gap-6 overflow-y-auto pb-4">
            <div className="nav-head flex items-center justify-between gap-2 px-2">
              <Logo rail />
              <button type="button" onClick={toggleNav} aria-expanded={!collapsed} aria-controls="site-nav-list" data-testid="nav-toggle"
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} data-tip={collapsed ? "Expand sidebar" : undefined} title={collapsed ? undefined : "Collapse sidebar"}
                className="nav-toggle press relative grid h-9 w-9 shrink-0 place-items-center rounded-lg text-text-3 hover:bg-raised/60 hover:text-text">
                <Icon name="sidebar" size={18} />
              </button>
            </div>
            <div id="site-nav-list"><NavList layoutKey="desk" /></div>
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
              <button className="press inline-flex min-h-9 min-w-9 items-center justify-center gap-1.5 rounded-md border border-line-strong px-2 py-1 text-sm lg:hidden" onClick={() => setOpen(true)}
                aria-label="Open navigation" aria-expanded={open}><Icon name="menu" /><span className="hidden sm:inline">Menu</span></button>
              <div className="whitespace-nowrap lg:hidden"><Logo /></div>
              <div className="hidden min-w-0 flex-1 items-center gap-5 md:flex"><GlobalSearch /><Breadcrumbs /></div>
              <div className="ml-auto hidden shrink-0 text-[12.5px] xl:block"><StatusBar /></div>
              <div className="ml-auto text-[12px] xl:hidden"><StatusBar compact /></div>
              <ThemeSwitcher />
            </div>
          </header>
          <ViewTransition key={path} enter="page-enter" exit="page-exit" default="none">
            <main id="main" className={showcase ? "w-full" : "mx-auto w-full max-w-[1400px] px-4 py-7 md:px-8 md:py-10"}>{children}</main>
          </ViewTransition>
          <SiteFooter />
          <DemoBar />
        </div>
      </div>
    </MotionProvider>
  );
}

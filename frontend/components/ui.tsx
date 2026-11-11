"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Icon } from "@/components/icons";
import { DUR, EASE, motion } from "@/components/motion";
import { ApiError } from "@/lib/api";

const PSI_URL: Record<string, string> = {
  "PSI-69": "https://psi.nasa.gov/physci/repo/data/investigations/PSI-69",
  "PSI-25": "https://psi.nasa.gov/physci/repo/data/investigations/PSI-25",
  "PSI-98": "https://psi.nasa.gov/physci/repo/data/investigations/PSI-98",
};

/** Attribution chip: which NASA investigation a view or value comes from. */
export function SourceBadge({ source, inv, link = true, size = "md" }: { source: string; inv: string; link?: boolean; size?: "sm" | "md" }) {
  const cls = `inline-flex items-center gap-1.5 rounded-full border border-data/30 bg-data/[0.06] text-text-2 ${size === "sm" ? "px-2 py-px text-[11.5px]" : "px-2.5 py-0.5 text-[12.5px]"}`;
  const inner = (
    <>
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-data" />
      <span>Source: <span className="text-text">NASA {source}</span> <span className="text-text-3">{inv}</span></span>
    </>
  );
  return link && PSI_URL[inv]
    ? <a href={PSI_URL[inv]} target="_blank" rel="noreferrer" className={`${cls} no-underline hover:border-data/60 hover:no-underline`} title={`NASA Physical Sciences Informatics ${inv}`}>{inner}</a>
    : <span className={cls}>{inner}</span>;
}

/** Sticky "on this page" navigation with scroll-spy and a sliding active marker. */
export function SectionNav({ sections }: { sections: { id: string; label: string }[] }) {
  const [active, setActive] = useState<string | null>(null);
  const ids = sections.map((s) => s.id).join("|");
  useEffect(() => {
    const els = ids.split("|").map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    if (!els.length) return;
    const io = new IntersectionObserver((entries) => {
      const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (vis[0]) setActive(vis[0].target.id);
    }, { rootMargin: "-30% 0px -60% 0px" });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [ids]);
  return (
    <nav aria-label="On this page" className="sticky top-[var(--hdr,57px)] z-20 -mx-4 mb-6 border-b border-line/70 bg-ink/80 px-4 backdrop-blur-md md:-mx-8 md:px-8">
      <ul className="flex gap-1 overflow-x-auto py-2 [scrollbar-width:none]">
        {sections.map((s) => (
          <li key={s.id} className="relative shrink-0">
            {active === s.id && (
              <motion.span layoutId="section-active" aria-hidden className="absolute inset-0 rounded-full border border-flame/50 bg-flame/10"
                transition={{ duration: DUR.base, ease: EASE }} />
            )}
            <a href={`#${s.id}`} aria-current={active === s.id ? "location" : undefined}
              className={`press relative block rounded-full px-3 py-1 text-[13px] no-underline hover:no-underline ${active === s.id ? "text-text" : "text-text-2 hover:text-text"}`}>{s.label}</a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function PageHeader({ title, lead, actions, sections, kicker, source, children, art, facts }: {
  title: string; lead?: ReactNode; actions?: ReactNode; sections?: { id: string; label: string }[];
  kicker?: string; source?: { source: string; inv: string }; children?: ReactNode;
  /** Illustration shown beside the title (phenomenon pages). */ art?: ReactNode;
  /** Real computed headline values, each with a label. */ facts?: { value: ReactNode; label: string }[];
}) {
  return (
    <>
      <motion.header className={`relative ${art ? "mb-8" : "mb-6"}`} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: DUR.slow, ease: EASE }}>
        <div aria-hidden className="pointer-events-none absolute -left-24 -top-24 h-64 w-[520px] max-w-[90vw] rounded-full bg-[radial-gradient(closest-side,rgba(91,140,255,0.13),transparent)] blur-2xl" />
        <div className={`relative flex flex-col gap-4 md:flex-row md:justify-between ${art ? "md:items-center" : "md:items-end"}`}>
          <div className="max-w-4xl">
            {kicker && <p className="kicker mb-3">{kicker}</p>}
            <h1 className="display text-[30px] md:text-[42px]">{title}</h1>
            {lead && <p className="mt-3 max-w-[72ch] text-[16px] leading-relaxed text-text-2">{lead}</p>}
            {source && <div className="mt-4"><SourceBadge {...source} /></div>}
            {facts && facts.length > 0 && (
              <dl className="mt-6 grid grid-cols-3 gap-x-3 gap-y-4 sm:flex sm:flex-wrap sm:gap-x-8">
                {facts.map((f) => (
                  <div key={f.label} className="min-w-0 border-l border-line-strong/70 pl-2.5 sm:pl-3">
                    <dd className="text-[19px] font-semibold leading-none text-data [font-stretch:115%] sm:text-[24px]">{f.value}</dd>
                    <dt className="mt-1.5 max-w-[22ch] text-[12.5px] leading-snug text-text-3">{f.label}</dt>
                  </div>
                ))}
              </dl>
            )}
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
          {art && <div className="w-full max-w-[240px] shrink-0 self-center md:w-[34%] md:max-w-[340px]">{art}</div>}
        </div>
        {children}
      </motion.header>
      {sections && sections.length > 0 && <SectionNav sections={sections} />}
    </>
  );
}

/** Route-level tabs for hubs that group two workflows (both remain full pages with their own URLs). */
export function HubTabs({ tabs, label }: { tabs: { href: string; label: string; note?: string }[]; label: string }) {
  const path = usePathname();
  return (
    <nav aria-label={label} className="mb-6">
      <ul className="inline-flex flex-wrap gap-1 rounded-xl border border-line bg-void/50 p-1">
        {tabs.map((t) => {
          const active = path === t.href;
          return (
            <li key={t.href} className="relative">
              {active && <motion.span layoutId={`hub-${label}`} aria-hidden className="absolute inset-0 rounded-lg bg-raised shadow-[inset_0_-2px_0_var(--flame)]"
                transition={{ duration: DUR.base, ease: EASE }} />}
              <Link href={t.href} aria-current={active ? "page" : undefined}
                className={`press relative block rounded-lg px-4 py-2 text-sm no-underline hover:no-underline ${active ? "text-text" : "text-text-2 hover:text-text"}`}>
                <span className="font-medium">{t.label}</span>
                {t.note && <span className="ml-2 hidden text-xs text-text-3 sm:inline">{t.note}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function Panel({ title, children, aside, className = "", id, tone = "default" }: {
  title?: ReactNode; children: ReactNode; aside?: ReactNode; className?: string; id?: string; tone?: "default" | "feature";
}) {
  const bg = tone === "feature"
    ? "border-electric/25 bg-[linear-gradient(160deg,rgba(91,140,255,0.08),rgba(16,30,51,0.92)_45%)]"
    : "border-line/80 bg-panel/90";
  return (
    <motion.section id={id} className={`hairline-top min-w-0 scroll-mt-36 rounded-xl border ${bg} ${className}`}
      initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.05 }}
      transition={{ duration: DUR.slow, ease: EASE }}>
      {(title || aside) && (
        <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 pb-1 pt-4 md:px-5">
          {title && <h2 className="subhead text-[18px]">{title}</h2>}
          {aside && <div className="text-sm text-text-3">{aside}</div>}
        </div>
      )}
      <div className="p-4 md:p-5">{children}</div>
    </motion.section>
  );
}

const PROV: Record<string, { label: string; cls: string; tip: string }> = {
  ORIGINAL_EXPERIMENT: { label: "Measured", cls: "border-data/60 text-data", tip: "Exact value from a NASA CSV/XLSX row" },
  experiment: { label: "Measured", cls: "border-data/60 text-data", tip: "Exact value from a NASA CSV/XLSX row" },
  DOC: { label: "Document", cls: "border-link/60 text-link", tip: "Stated in a NASA source document (page cited)" },
  local_document: { label: "Document", cls: "border-link/60 text-link", tip: "Stated in a NASA source document (page cited)" },
  report_table: { label: "Report table", cls: "border-link/60 text-link", tip: "Curated NASA report table row, verified against the CSV (page cited)" },
  COMPUTED: { label: "Computed", cls: "border-flame/60 text-flame", tip: "Deterministic calculation by SpaceFire code" },
  analysis: { label: "Computed", cls: "border-flame/60 text-flame", tip: "Deterministic calculation by SpaceFire code" },
  quality_flag: { label: "Quality rule", cls: "border-warn/60 text-warn", tip: "Automated data-quality rule" },
  EXTERNAL: { label: "External", cls: "border-text-2/60 text-text-2", tip: "External publication metadata or abstract" },
  external_paper: { label: "External", cls: "border-text-2/60 text-text-2", tip: "External publication metadata or abstract" },
  publication_list: { label: "NASA pub. list", cls: "border-link/60 text-link", tip: "NASA PSI's list of publications for the investigation (titles only; papers not read)" },
  HYPOTHESIS: { label: "Hypothesis", cls: "border-dashed border-text-3 text-text-3", tip: "Interpretation, not verified" },
  UNSUPPORTED: { label: "Unsupported", cls: "border-crit/60 text-crit", tip: "Insufficient evidence" },
};

export function Prov({ kind }: { kind: string }) {
  const p = PROV[kind] ?? { label: kind, cls: "border-line text-text-2", tip: kind };
  return (
    <span title={p.tip} className={`inline-flex items-center rounded border px-1.5 py-px text-[12px] font-medium ${p.cls}`}>
      {p.label}
    </span>
  );
}

const SEV: Record<string, { cls: string; icon: string }> = {
  critical: { cls: "bg-crit/15 text-crit border-crit/40", icon: "▲" },
  warning: { cls: "bg-warn/10 text-warn border-warn/40", icon: "◆" },
  info: { cls: "bg-info/10 text-info border-info/30", icon: "●" },
};

export function Severity({ level, count }: { level: string; count?: number }) {
  const s = SEV[level] ?? SEV.info;
  return (
    <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-px text-[12px] font-medium ${s.cls}`}>
      <span aria-hidden>{s.icon}</span>
      {level}
      {count !== undefined && <span className="tabular-nums">{count}</span>}
    </span>
  );
}

export function Kind({ kind }: { kind?: string | null }) {
  if (!kind || kind === "present" || kind === "text") return null;
  const label: Record<string, string> = {
    blank: "blank cell", dash: "dash (–)", none: "'none'", approximate: "approximate", range: "range",
    over_range: "over range", lower_bound: "lower bound", upper_bound: "upper bound", sequence: "multi-stage",
    text: "text", invalid: "unparsed",
  };
  return <span className="ml-1 rounded bg-raised px-1 text-[11px] text-text-3">{label[kind] ?? kind}</span>;
}

export function Button({ children, onClick, variant = "secondary", type = "button", disabled, ariaLabel }: {
  children: ReactNode; onClick?: () => void; variant?: "primary" | "secondary" | "ghost";
  type?: "button" | "submit"; disabled?: boolean; ariaLabel?: string;
}) {
  const cls = {
    primary: "bg-flame text-flame-ink hover:brightness-110 font-semibold glow-flame",
    secondary: "border border-line-strong bg-raised text-text hover:border-flame/70",
    ghost: "text-text-2 hover:text-text",
  }[variant];
  return (
    <button type={type} onClick={onClick} disabled={disabled} aria-label={ariaLabel}
      className={`press inline-flex min-h-9 items-center justify-center gap-2 rounded-lg px-3.5 py-1.5 text-sm disabled:opacity-40 ${cls}`}>
      {children}
    </button>
  );
}

export function LinkButton({ href, children, variant = "secondary", size = "md" }: {
  href: string; children: ReactNode; variant?: "primary" | "secondary" | "quiet"; size?: "md" | "lg";
}) {
  const cls = {
    primary: "bg-flame text-flame-ink font-semibold hover:brightness-110 glow-flame",
    secondary: "border border-line-strong bg-raised/80 text-text hover:border-flame/70",
    quiet: "border border-line-strong/70 bg-void/40 text-text backdrop-blur hover:border-electric/70",
  }[variant];
  const sz = size === "lg" ? "min-h-11 px-5 text-[15px]" : "min-h-9 px-3.5 text-sm";
  return (
    <Link href={href} className={`press inline-flex items-center gap-2 rounded-lg py-1.5 no-underline hover:no-underline ${sz} ${cls}`}>
      {children}
    </Link>
  );
}

export function Skeleton({ rows = 4, h = 18 }: { rows?: number; h?: number }) {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton" style={{ height: h, width: `${92 - (i % 3) * 14}%` }} />
      ))}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: ApiError | Error; onRetry?: () => void }) {
  const offline = error instanceof ApiError && error.code === "offline";
  return (
    <div role="alert" className="flex gap-3 rounded-md border border-crit/40 bg-crit/10 p-4">
      <Icon name="alert" size={20} className="mt-0.5 shrink-0 text-crit" />
      <div>
      <p className="font-semibold text-crit">{offline ? "The SpaceFire API is not reachable" : "Request failed"}</p>
      <p className="mt-1 text-sm text-text-2">{error.message}</p>
      {offline && <p className="mt-1 text-sm text-text-3">Start the backend with scripts/start.ps1 (or start.sh), then retry.</p>}
      {error instanceof ApiError && error.requestId && (
        <p className="mt-1 text-xs text-text-3">Request ID {error.requestId}</p>
      )}
      {onRetry && <div className="mt-3"><Button onClick={onRetry}>Retry</Button></div>}
      </div>
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-md border border-dashed border-line-strong px-6 py-8 text-center">
      <Icon name="empty" size={28} className="mb-2 text-text-3" />
      <p className="font-semibold">{title}</p>
      {children && <div className="mt-1 text-sm text-text-2">{children}</div>}
    </div>
  );
}

export function Loadable<T>({ state, children, rows }: {
  state: { data: T | null; error: ApiError | null; loading: boolean; reload: () => void };
  children: (data: T) => ReactNode; rows?: number;
}) {
  if (state.error) return <ErrorState error={state.error} onRetry={state.reload} />;
  if (state.loading && !state.data) return <Skeleton rows={rows} />;
  if (!state.data) return null;
  return <>{children(state.data)}</>;
}

export function Pager({ page, pages, onPage }: { page: number; pages: number; onPage: (p: number) => void }) {
  return (
    <nav aria-label="Pagination" className="flex items-center gap-2 text-sm">
      <Button onClick={() => onPage(page - 1)} disabled={page <= 1}>Previous</Button>
      <span className="text-text-2">Page {page} of {pages}</span>
      <Button onClick={() => onPage(page + 1)} disabled={page >= pages}>Next</Button>
    </nav>
  );
}

export function Field({ label, children, htmlFor }: { label: string; children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="flex flex-col gap-1 text-sm">
      <span className="text-text-2">{label}</span>
      {children}
    </label>
  );
}

export const inputCls =
  "min-h-9 rounded-md border border-line-strong bg-ink px-2.5 py-1.5 text-sm text-text placeholder:text-text-3 focus:border-flame";

export function Stat({ value, label, note }: { value: ReactNode; label: string; note?: string }) {
  return (
    <div>
      <div className="display text-[30px] text-data">{value}</div>
      <div className="text-sm text-text-2">{label}</div>
      {note && <div className="text-xs text-text-3">{note}</div>}
    </div>
  );
}

export function Callout({ tone = "info", children }: { tone?: "info" | "warn" | "crit"; children: ReactNode }) {
  const cls = { info: "border-info/50 bg-info/[0.06]", warn: "border-warn/50 bg-warn/[0.06]", crit: "border-crit/50 bg-crit/[0.06]" }[tone];
  return <div className={`rounded-lg border-l-2 ${cls} px-3.5 py-2.5 text-sm text-text-2`}>{children}</div>;
}

export function FilterChips({ chips, onRemove, onClear }: {
  chips: { key: string; label: string }[]; onRemove: (key: string) => void; onClear?: () => void;
}) {
  if (!chips.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5" aria-label="Active filters">
      {chips.map((c) => (
        <button key={c.key} onClick={() => onRemove(c.key)} aria-label={`Remove filter ${c.label}`}
          className="inline-flex items-center gap-1 rounded-full border border-flame/40 bg-flame/10 px-2.5 py-0.5 text-[13px] text-text hover:border-flame">
          {c.label}<Icon name="close" size={12} />
        </button>
      ))}
      {onClear && chips.length > 1 && <button onClick={onClear} className="text-[13px] text-link hover:underline">Clear all</button>}
    </div>
  );
}

export function MetricTile({ value, label, note, href }: { value: ReactNode; label: string; note?: string; href?: string }) {
  const inner = (
    <>
      <div className="text-[26px] font-semibold leading-none text-data [font-stretch:115%]">{value}</div>
      <div className="mt-1.5 text-sm text-text">{label}</div>
      {note && <div className="mt-0.5 text-xs text-text-3">{note}</div>}
    </>
  );
  return href ? (
    <Link href={href} className="lift glow-data hairline-top block rounded-xl border border-line/80 bg-panel/70 px-4 py-3 no-underline hover:border-data/50 hover:no-underline">{inner}</Link>
  ) : <div className="hairline-top rounded-xl border border-line/80 bg-panel/70 px-4 py-3">{inner}</div>;
}

/** Single-choice segmented control (radio-group semantics) with a sliding selection marker. */
export function Segmented({ label, value, options, onChange }: {
  label: string; value: string; options: [string, string][]; onChange: (v: string) => void;
}) {
  const gid = label.replace(/\W+/g, "-").toLowerCase();
  return (
    <div className="flex flex-col gap-1 text-sm">
      <span className="text-text-2" id={`seg-${gid}`}>{label}</span>
      <div role="radiogroup" aria-labelledby={`seg-${gid}`} className="inline-flex flex-wrap gap-1 rounded-lg border border-line-strong/80 bg-ink/70 p-1">
        {options.map(([v, l]) => {
          const on = value === v;
          return (
            <button key={v || "all"} type="button" role="radio" aria-checked={on} onClick={() => onChange(v)}
              className={`press relative rounded-md px-3 py-1 text-[13.5px] ${on ? "font-medium text-flame-ink" : "text-text-2 hover:text-text"}`}>
              {on && <motion.span layoutId={`seg-${gid}`} aria-hidden className="absolute inset-0 rounded-md bg-flame" transition={{ duration: DUR.base, ease: EASE }} />}
              <span className="relative">{l}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

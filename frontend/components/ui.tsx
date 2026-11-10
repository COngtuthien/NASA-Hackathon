"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/icons";
import { ApiError } from "@/lib/api";

export function PageHeader({ title, lead, actions, sections }: {
  title: string; lead?: ReactNode; actions?: ReactNode; sections?: { id: string; label: string }[];
}) {
  return (
    <header className="mb-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="max-w-3xl">
          <h1 className="display text-[28px] md:text-[36px]">{title}</h1>
          {lead && <p className="mt-2 max-w-[72ch] text-[15.5px] text-text-2">{lead}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      {sections && sections.length > 0 && (
        <nav aria-label="On this page" className="mt-4 flex flex-wrap gap-1.5 border-b border-line pb-3">
          {sections.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="rounded-full border border-line-strong px-3 py-1 text-[13px] text-text-2 no-underline hover:border-flame/60 hover:text-text hover:no-underline">{s.label}</a>
          ))}
        </nav>
      )}
    </header>
  );
}

export function Panel({ title, children, aside, className = "", id }: {
  title?: ReactNode; children: ReactNode; aside?: ReactNode; className?: string; id?: string;
}) {
  return (
    <section id={id} className={`scroll-mt-28 rounded-lg border border-line bg-panel shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] ${className}`}>
      {(title || aside) && (
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-4 py-3">
          {title && <h2 className="subhead text-[17px]">{title}</h2>}
          {aside && <div className="text-sm text-text-3">{aside}</div>}
        </div>
      )}
      <div className="p-4">{children}</div>
    </section>
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
    primary: "bg-flame text-flame-ink hover:brightness-110 font-semibold",
    secondary: "border border-line-strong bg-raised text-text hover:border-flame/70",
    ghost: "text-text-2 hover:text-text",
  }[variant];
  return (
    <button type={type} onClick={onClick} disabled={disabled} aria-label={ariaLabel}
      className={`inline-flex min-h-9 items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors disabled:opacity-40 ${cls}`}>
      {children}
    </button>
  );
}

export function LinkButton({ href, children, variant = "secondary" }: {
  href: string; children: ReactNode; variant?: "primary" | "secondary";
}) {
  const cls = variant === "primary"
    ? "bg-flame text-flame-ink font-semibold hover:brightness-110"
    : "border border-line-strong bg-raised text-text hover:border-flame/70";
  return (
    <Link href={href} className={`inline-flex min-h-9 items-center rounded-md px-3 py-1.5 text-sm no-underline hover:no-underline ${cls}`}>
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
  const cls = { info: "border-info/40 bg-info/5", warn: "border-warn/40 bg-warn/5", crit: "border-crit/40 bg-crit/5" }[tone];
  return <div className={`rounded-md border-l-4 ${cls} px-3 py-2 text-sm text-text-2`}>{children}</div>;
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
    <Link href={href} className="block rounded-lg border border-line bg-panel/70 px-4 py-3 no-underline hover:border-flame/50 hover:no-underline">{inner}</Link>
  ) : <div className="rounded-lg border border-line bg-panel/70 px-4 py-3">{inner}</div>;
}

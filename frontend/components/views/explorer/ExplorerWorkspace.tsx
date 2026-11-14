"use client";

// Phase 14: one research scenario. Filters live in the URL and are validated by the API against real values; the
// ranking, matching, evidence and interpretation all come from /api/v1/explorer/scenarios/{id}.
import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { EVIDENCE, EvidenceTag, docHref } from "@/components/evidence-tag";
import { StartScenarioGuide } from "@/components/demo/DemoBar";
import Plot, { baseLayout, CAT } from "@/components/Plot";
import type { DemoScenario } from "@/lib/demo";
import { Icon } from "@/components/icons";
import { Callout, Field, FilterChips, LinkButton, Loadable, inputCls } from "@/components/ui";
import { qs, useApi, useCachedApi } from "@/lib/api";
import { READINESS_LABEL, ROLE_LABEL, type EvidenceItem, type Facet, type Ranked, type ScenarioList, type Workspace } from "./types";

const PARAMS = ["material", "flow", "geometry", "configuration", "fuel", "aging", "investigation", "evidence",
  "o2_min", "o2_max", "pressure_min", "pressure_max"] as const;
const SHOWN = 6;
/** Combustion Explorer collection for each investigation (Phase 16 bidirectional links). */
export const COLLECTION: Record<string, string> = { "PSI-69": "flex", "PSI-25": "bass2", "PSI-98": "saffire1", "PSI-159": "cfig",
  "PSI-10": "flame_design", "PSI-20": "bre", "PSI-102": "same_sizes", "PSI-117": "psi117", "PSI-68": "flex2", "PSI-62": "psi62" };
/** A record page in the Combustion Explorer for an evidence item, where one exists. */
function recordHref(id: string): string | null {
  if (id.startsWith("exp:cfig:")) return `/experiments/cfig/${encodeURIComponent(id.slice(4))}`;
  if (id.startsWith("meas:same:size:")) return `/experiments/same_sizes/${encodeURIComponent(id.slice(5))}`;
  return null;
}

function Bar({ label, value, hint, tone }: { label: string; value: number | null; hint: string; tone: string }) {
  return (
    <div className="min-w-0" title={hint}>
      <div className="flex items-baseline justify-between gap-2 text-[12.5px]"><span className="text-text-2">{label}</span>
        <span className="font-medium text-text">{value === null ? "not assessed" : value}</span></div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink/80" aria-hidden>
        {value !== null && <div className={`h-full rounded-full ${tone}`} style={{ width: `${value}%` }} />}
      </div>
    </div>
  );
}

function RankedCard({ r, facets }: { r: Ranked; facets: Record<string, Facet> }) {
  const [open, setOpen] = useState(false);
  const c = r.components;
  const dimLabel = (d: string) => facets[d]?.label.toLowerCase() ?? d;
  return (
    <li data-testid={`ranked-${r.investigation_id}`} className="rounded-2xl border border-line/70 bg-panel/60 p-4 md:p-5">
      <div className="flex flex-wrap items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full border border-line-strong text-[15px] font-semibold text-text">{r.rank}</span>
        <div className="min-w-0 flex-1">
          <h3 className="flex flex-wrap items-center gap-2 text-[17px] font-semibold text-text">{r.short_name}
            <span className="rounded border border-line-strong/70 px-1.5 py-px text-[12px] font-normal text-text-2">{r.investigation_id}</span>
            <span className={`rounded px-1.5 py-px text-[12px] font-normal ${r.role === "primary" ? "bg-flame/15 text-flame" : r.role === "context" ? "bg-raised text-text-3" : "bg-raised text-text-2"}`}>{ROLE_LABEL[r.role]}</span>
            <span className="text-[12px] font-normal text-text-3">{READINESS_LABEL[r.readiness] ?? r.readiness}</span>
          </h3>
          <p className="mt-1 text-[14.5px] leading-relaxed text-text-2" data-testid="rank-explanation">{r.explanation}</p>
        </div>
        <div className="text-right" data-testid={`score-${r.investigation_id}`}>
          <div className="text-[28px] font-semibold leading-none text-data [font-stretch:115%]">{r.score}</div>
          <div className="mt-1 text-[11.5px] text-text-3">research relevance<br />out of 100</div>
        </div>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Bar label="Relevance" value={c.relevance.value} tone="bg-flame/80" hint="Topic match, microgravity flight vs ground, and role in this scenario." />
        <Bar label="Evidence strength" value={c.evidence.value} tone="bg-data/80" hint={`Strongest evidence downloaded: ${c.evidence.label}.`} />
        <Bar label="Applicability" value={c.applicability.value} tone="bg-electric/80"
          hint={c.applicability.value === null ? "No selected condition is recorded by this investigation." : "Whether recorded conditions match the filters."} />
      </div>
      {r.limitations.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1 text-[13px] text-text-2">
          {r.limitations.slice(0, 2).map((l) => <li key={l.code} className="flex gap-1.5"><Icon name="alert" size={14} className="mt-0.5 shrink-0 text-warn" />{l.text}</li>)}
        </ul>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {r.links.analysis && <LinkButton href={r.links.analysis}>Explore charts</LinkButton>}
        {r.links.studio && <LinkButton href={r.links.studio}>Open 3D Studio</LinkButton>}
        {COLLECTION[r.investigation_id] && <span data-testid={`browse-${r.investigation_id}`}><LinkButton href={`/experiments?dataset=${COLLECTION[r.investigation_id]}`}>Browse records</LinkButton></span>}
        {r.links.copilot && <LinkButton href={r.links.copilot} variant="quiet">Ask Copilot about {r.short_name}</LinkButton>}
        <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="ml-auto text-[13px] text-link hover:underline">
          {open ? "Hide the score breakdown" : "How this score was computed"}</button>
      </div>
      {open && (
        <div className="mt-3 rounded-lg border border-line/60 bg-ink/40 p-3 text-[13px] leading-relaxed text-text-2" data-testid={`breakdown-${r.investigation_id}`}>
          <p><b className="text-text">Relevance {c.relevance.value}</b> = topic {c.relevance.topic} ({c.relevance.topic_basis.replace(/_/g, " ")}) + environment {c.relevance.environment} ({c.relevance.environment_basis.replace(/_/g, " ")}) + role {c.relevance.role}.</p>
          {c.relevance.studies.length > 0 && <p className="mt-1">Topics, from the investigation&apos;s own text: {c.relevance.studies.map((s) => `${s.label} (${s.focus})`).join("; ")}.</p>}
          <p className="mt-1"><b className="text-text">Evidence strength {c.evidence.value}</b>: {c.evidence.label}{c.evidence.directness < 1 ? "; indirect for this scenario, so it counts half in the score" : ""}.</p>
          <p className="mt-1"><b className="text-text">Applicability {c.applicability.value ?? "not assessed"}</b>
            {c.applicability.evaluated.length ? `: ${c.applicability.n_match} of ${c.applicability.n_total} records meet ${c.applicability.evaluated.map(dimLabel).join(", ")}.` : ": no selected condition applies."}
            {c.applicability.not_recorded.length ? ` Not recorded (not penalized): ${c.applicability.not_recorded.map(dimLabel).join(", ")}.` : ""}
            {Object.entries(c.applicability.incomplete).filter(([, n]) => n).map(([d, n]) => ` ${n} record(s) lack a value for ${dimLabel(d)} (incomplete, excluded).`).join("")}</p>
          <p className="mt-1">Score = 0.5 × relevance + 0.3 × evidence{c.evidence.directness < 1 ? " × 0.5" : ""} + 0.2 × applicability{c.applicability.value === null ? " (applicability not assessed: the first two terms are rescaled by 1/0.8)" : ""} = <b className="text-text">{r.score}</b>.</p>
        </div>
      )}
    </li>
  );
}

function EvidenceCard({ e, inv }: { e: EvidenceItem; inv: string }) {
  return (
    <li data-testid="evidence-item" data-evidence-class={e.evidence_class} className="rounded-xl border border-line/60 bg-panel/50 p-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <EvidenceTag kind={e.evidence_class in EVIDENCE ? e.evidence_class : "report"} />
        <span className="text-[12.5px] text-text-3">{inv} · {e.investigation_id}</span>
      </div>
      <h4 className="mt-1.5 text-[15px] font-semibold text-text">{e.title}</h4>
      <p className="mt-1 text-[14px] leading-relaxed text-text-2">{e.observation}</p>
      {Object.keys(e.conditions).length > 0 && (
        <dl className="mt-2 flex flex-wrap gap-1.5 text-[12.5px]">
          {Object.entries(e.conditions).map(([k, v]) => (
            <div key={k} className="rounded border border-line/70 bg-ink/40 px-1.5 py-px"><dt className="inline text-text-3">{k}: </dt><dd className="inline text-text">{String(v)}</dd></div>
          ))}
        </dl>
      )}
      <p className="mt-2 text-[12.5px] text-text-3">Source: {e.source.document_id
        ? <a href={docHref(e.source.document_id, e.source.page)} target="_blank" rel="noreferrer">{e.source.label}</a> : e.source.label}</p>
      {e.limitations.length > 0 && <p className="mt-1 text-[12.5px] text-warn">{e.limitations.join(" ")}</p>}
      {(e.links.length > 0 || recordHref(e.id)) && (
        <div className="mt-2 flex flex-wrap gap-3 text-[13px]">
          {recordHref(e.id) && <Link href={recordHref(e.id)!} data-testid="evidence-record-link">Open the record</Link>}
          {e.links.map((l) => l.href.startsWith("http") || l.href.startsWith("/api/")
            ? <a key={l.href + l.label} href={l.href} target="_blank" rel="noreferrer">{l.label}</a>
            : <Link key={l.href + l.label} href={l.href}>{l.label}</Link>)}
        </div>
      )}
    </li>
  );
}

function Summary({ s }: { s: Workspace["summary"] }) {
  let body: ReactNode = null;
  if (s.kind === "outcomes") {
    const by = s.by_configuration as Record<string, Record<string, number>>;
    body = Object.keys(by).length ? (
      <div className="grid gap-3 sm:grid-cols-2">{Object.entries(by).map(([cfg, d]) => (
        <div key={cfg} className="rounded-lg border border-line/60 bg-ink/40 p-3"><p className="text-[13px] font-semibold capitalize text-text">{cfg} flames</p>
          <ul className="mt-1 text-[13.5px] text-text-2">{Object.entries(d).map(([k, n]) => <li key={k} className="flex justify-between gap-2"><span className="capitalize">{k}</span><span className="text-text">{n}</span></li>)}</ul>
          {(s.censored as Record<string, number>)[cfg] ? <p className="mt-1 text-[12px] text-text-3">{(s.censored as Record<string, number>)[cfg]} censored burn time(s)</p> : null}
        </div>))}</div>) : null;
  } else if (s.kind === "test_end") {
    const by = s.by_fuel as Record<string, Record<string, number>>;
    body = Object.keys(by).length ? (
      <div className="grid gap-3 sm:grid-cols-2">{Object.entries(by).map(([fuel, d]) => (
        <div key={fuel} className="rounded-lg border border-line/60 bg-ink/40 p-3"><p className="text-[13px] font-semibold text-text">{fuel}</p>
          <ul className="mt-1 text-[13.5px] text-text-2">{Object.entries(d).map(([k, n]) => <li key={k} className="flex justify-between gap-2"><span>{k}</span><span className="text-text">{n}</span></li>)}</ul></div>))}</div>) : null;
  } else if (s.kind === "spread_rates") {
    const g = s.groups as { material: string; flow: string; n: number; min: number; max: number }[];
    body = g.length ? (
      <div className="overflow-x-auto"><table className="w-full text-[13.5px]"><thead><tr className="text-left text-text-3"><th className="py-1 pr-3">Material form</th><th className="pr-3">Flow</th><th className="pr-3">Values</th><th>Range (mm/s)</th></tr></thead>
        <tbody>{g.map((x) => <tr key={x.material + x.flow} className="border-t border-line/40"><td className="py-1 pr-3">{x.material}</td><td className="pr-3">{x.flow}</td><td className="pr-3">{x.n}</td><td>{x.min.toPrecision(3)} – {x.max.toPrecision(3)}</td></tr>)}</tbody></table></div>) : null;
  } else if (s.kind === "sizes") {
    const by = s.by_material as Record<string, Record<string, { d10_nm: number; dg_nm: number; d30_nm: number }>>;
    body = Object.keys(by).length ? (
      <div className="overflow-x-auto"><table className="w-full text-[13.5px]"><thead><tr className="text-left text-text-3"><th className="py-1 pr-3">Material</th><th className="pr-3">Fresh mean (nm)</th><th>Aged 720 s mean (nm)</th></tr></thead>
        <tbody>{Object.entries(by).map(([m, d]) => <tr key={m} className="border-t border-line/40"><td className="py-1 pr-3 capitalize">{m}</td><td className="pr-3">{d.fresh?.d10_nm ?? "–"}</td><td>{d.aged?.d10_nm ?? "–"}</td></tr>)}</tbody></table></div>) : null;
  }
  return (
    <section data-testid="evidence-summary" className="rounded-2xl border border-line/60 bg-panel/50 p-4 md:p-5">
      <h2 className="subhead text-[17px]">{s.title}</h2>
      <SummaryChart s={s} />
      <div className="mt-3">{body ?? <p className="text-[14px] text-text-2">No records in the current selection.</p>}</div>
      <p className="mt-2 text-[12.5px] text-text-3">{s.note}</p>
    </section>
  );
}

/** The scenario's primary chart, drawn only from the summary counts and values returned by the API. */
function SummaryChart({ s }: { s: Workspace["summary"] }) {
  let data: unknown[] | null = null;
  let ytitle = "";
  if (s.kind === "outcomes" || s.kind === "test_end") {
    const by = (s.kind === "outcomes" ? s.by_configuration : s.by_fuel) as Record<string, Record<string, number>>;
    const cats = [...new Set(Object.values(by).flatMap((d) => Object.keys(d)))];
    data = Object.entries(by).map(([k, d], i) => ({ type: "bar", name: s.kind === "outcomes" ? `${k} flames` : k, x: cats, y: cats.map((c) => d[c] ?? 0),
      marker: { color: CAT[i % CAT.length] }, hovertemplate: "%{x}: %{y}<extra>" + k + "</extra>" }));
    ytitle = s.kind === "outcomes" ? "Test points" : "FLEX tests";
  } else if (s.kind === "sizes") {
    const by = s.by_material as Record<string, Record<string, { d10_nm: number }>>;
    const mats = Object.keys(by);
    data = ["fresh", "aged"].map((a, i) => ({ type: "bar", name: a === "fresh" ? "Fresh" : "Aged 720 s", x: mats, y: mats.map((m) => by[m][a]?.d10_nm ?? null),
      marker: { color: CAT[i] }, hovertemplate: "%{x}: %{y} nm<extra></extra>" }));
    ytitle = "Arithmetic mean diameter (nm)";
  } else if (s.kind === "spread_rates") {
    const g = s.groups as { material: string; flow: string; min: number; max: number }[];
    if (g.length) data = [{ type: "bar", orientation: "h", y: g.map((x) => `${x.material}, ${x.flow}`), x: g.map((x) => x.max - x.min), base: g.map((x) => x.min),
      marker: { color: CAT[0] }, hovertemplate: "%{y}: %{base:.3g}–%{x:.3g} mm/s<extra>range of reported values</extra>", name: "Reported range" }];
    ytitle = "";
  }
  if (!data || !data.length) return null;
  const layout = s.kind === "spread_rates" ? { ...baseLayout("Spread rate (mm/s)", ""), barmode: "overlay" } : { ...baseLayout("", ytitle), barmode: "group" };
  return <div className="mt-3" data-testid="summary-chart"><Plot data={data} layout={layout} height={260} ariaLabel={s.title} /></div>;
}

function Filters({ w, set, clear }: { w: Workspace; set: (k: string, v: string) => void; clear: () => void }) {
  const sp = useSearchParams();
  const chips: { key: string; label: string }[] = [];
  for (const [k, f] of Object.entries(w.facets)) {
    if (f.kind === "category") {
      const v = sp.get(k);
      const o = f.options.find((x) => x.value === v);
      if (o) chips.push({ key: k, label: `${f.label}: ${o.label}` });
    } else {
      const p = k === "o2" ? "o2" : "pressure";
      const lo = sp.get(`${p}_min`), hi = sp.get(`${p}_max`);
      if (lo || hi) chips.push({ key: p, label: `${f.label}: ${lo || "…"} – ${hi || "…"}` });
    }
  }
  return (
    <section aria-labelledby="flt-title" className="rounded-2xl border border-line/60 bg-panel/50 p-4" data-testid="explorer-filters">
      <h2 id="flt-title" className="subhead text-[16px]">Scientific filters</h2>
      <p className="mt-1 text-[12.5px] text-text-3">Options are the values present in the NASA records (counts in brackets).</p>
      <div className="mt-3 flex flex-col gap-3">
        {Object.entries(w.facets).map(([k, f]) => f.kind === "category" ? (
          <Field key={k} label={f.label} htmlFor={`f-${k}`}>
            <select id={`f-${k}`} data-testid={`filter-${k}`} className={inputCls} value={sp.get(k) ?? ""} onChange={(e) => set(k, e.target.value)}>
              <option value="">Any</option>
              {f.options.map((o) => <option key={o.value} value={o.value}>{k === "evidence" ? (EVIDENCE[o.value as keyof typeof EVIDENCE]?.label ?? o.label) : o.label}{o.records !== undefined && k !== "evidence" ? ` (${o.records})` : ""}</option>)}
            </select>
          </Field>
        ) : (
          <fieldset key={k} className="flex flex-col gap-1 text-sm">
            <legend className="text-text-2">{f.label}{f.min !== null ? <span className="text-text-3"> · data {f.min}–{f.max}</span> : null}</legend>
            <div className="flex gap-2">
              {(["min", "max"] as const).map((b) => {
                const name = `${k === "o2" ? "o2" : "pressure"}_${b}`;
                return <input key={`${name}-${sp.get(name) ?? ""}`} aria-label={`${f.label} ${b}`} data-testid={`filter-${name}`} type="number" step={k === "o2" ? 0.01 : 0.1}
                  min={0} max={k === "o2" ? 1 : 10} placeholder={b} className={`${inputCls} w-full`} defaultValue={sp.get(name) ?? ""}
                  onBlur={(e) => set(name, e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") set(name, (e.target as HTMLInputElement).value); }} />;
              })}
            </div>
          </fieldset>
        ))}
      </div>
      <div className="mt-3"><FilterChips chips={chips} onRemove={(key) => key === "o2" || key === "pressure" ? (set(`${key}_min`, ""), set(`${key}_max`, "")) : set(key, "")} onClear={clear} /></div>
    </section>
  );
}

export default function ExplorerWorkspace() {
  const { scenario } = useParams<{ scenario: string }>();
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [all, setAll] = useState(false);
  const params = Object.fromEntries(PARAMS.map((p) => [p, sp.get(p)]));
  const d = useApi<Workspace>(`/explorer/scenarios/${scenario}${qs(params)}`);
  const list = useCachedApi<ScenarioList>("/explorer/scenarios");
  const set = (k: string, v: string) => {
    const n = new URLSearchParams(window.location.search);
    if (v) n.set(k, v); else n.delete(k);
    const q = n.toString();
    router.replace(`${pathname}${q ? `?${q}` : ""}`, { scroll: false });
  };
  const clear = () => router.replace(pathname, { scroll: false });
  const activeCount = PARAMS.filter((p) => !["investigation", "evidence"].includes(p) && sp.get(p)).length;
  const [filtersOpenState, setFiltersOpen] = useState<boolean | null>(null);
  const filtersOpen = filtersOpenState ?? activeCount > 0;     // open by default only when a condition filter is active
  return (
    <>
      <nav className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13.5px]" aria-label="Research scenarios">
        <Link href="/safety-explorer" className="inline-flex items-center gap-1"><Icon name="chevron" size={13} className="rotate-180" />All research scenarios</Link>
        {list.data && (
          <ul className="flex flex-wrap gap-1.5" data-testid="scenario-switcher">
            {list.data.scenarios.map((s) => {
              const on = s.id === scenario;
              return (
                <li key={s.id}>
                  <Link href={`/safety-explorer/${s.id}`} aria-current={on ? "page" : undefined}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12.5px] no-underline hover:no-underline ${on ? "border-flame bg-flame/15 font-medium text-text" : "border-line-strong/70 text-text-2 hover:border-flame/60 hover:text-text"}`}>
                    <Icon name={s.icon} size={13} />{s.title}</Link>
                </li>
              );
            })}
          </ul>
        )}
      </nav>
      <Loadable state={d} rows={12}>{(w) => {
        const inv = Object.fromEntries(w.ranked.map((r) => [r.investigation_id, r.short_name]));
        const ev = all ? w.evidence : w.evidence.slice(0, SHOWN);
        const L = w.links;
        return (
          <div className="flex flex-col gap-6" data-testid="explorer-workspace" data-scenario={w.scenario.id}>
            <header>
              <p className="kicker mb-2">Research-to-Safety Explorer · {w.scenario.domain}</p>
              <h1 className="display text-[28px] md:text-[38px]">{w.scenario.title}</h1>
              <p className="mt-2 max-w-[70ch] text-[17px] italic leading-relaxed text-text" data-testid="research-question">&ldquo;{w.scenario.question}&rdquo;</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <StartScenarioGuide scenario={w.scenario.id as DemoScenario} />
                {L.copilot && <LinkButton href={L.copilot.href} variant="quiet">Ask Research Copilot</LinkButton>}
              </div>
              <p className="mt-2 text-[12.5px] text-text-3" data-testid="workspace-disclaimer">{w.disclaimer}</p>
            </header>
            {w.no_match && <Callout tone="warn"><span data-testid="no-match">{w.no_match_message}</span> Widen or clear a filter; nothing is predicted for conditions outside the data.</Callout>}
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
              <Summary s={w.summary} />
              <section aria-labelledby="act-h" className="rounded-2xl border border-flame/40 bg-flame/[0.04] p-4 md:p-5" data-testid="explorer-actions">
                <h2 id="act-h" className="subhead text-[17px]">See it</h2>
                <div className="mt-3 flex flex-col items-start gap-2">
                  {L.charts && <span data-testid="action-charts"><LinkButton href={L.charts.href} variant="primary">{L.charts.label}</LinkButton></span>}
                  {L.studio && <span data-testid="action-studio"><LinkButton href={L.studio.href}>{L.studio.label}</LinkButton></span>}
                  {L.experiment && <span data-testid="action-experiment"><LinkButton href={L.experiment.href}>{L.experiment.label}</LinkButton></span>}
                  {L.psi117 && <span data-testid="action-psi117"><LinkButton href={L.psi117.href}>{L.psi117.label}</LinkButton></span>}
                  <span data-testid="action-evidence"><LinkButton href="#evidence">View evidence</LinkButton></span>
                  {L.copilot && <span data-testid="action-copilot"><LinkButton href={L.copilot.href} variant="quiet">{L.copilot.label}</LinkButton></span>}
                </div>
                {L.studio?.note && <p className="mt-2 text-[12.5px] text-text-3">{L.studio.note}</p>}
              </section>
            </div>
            <section aria-labelledby="rank-h">
              <h2 id="rank-h" className="subhead mb-1 text-[19px]">Ranked investigations</h2>
              <p className="mb-3 text-[13px] text-text-3">By research relevance to this question. Not a fire-danger or safety score.</p>
              <ol className="flex flex-col gap-3" data-testid="ranked-list">{w.ranked.map((r) => <RankedCard key={r.investigation_id} r={r} facets={w.facets} />)}</ol>
            </section>
            <section id="evidence" aria-labelledby="ev-h" className="scroll-mt-36">
              <h2 id="ev-h" className="subhead mb-1 text-[19px]">Evidence</h2>
              <p className="mb-3 text-[13px] text-text-3">Each item says what kind of evidence it is and where it comes from.</p>
              {w.evidence.length ? (
                <>
                  <ul className="grid gap-3 xl:grid-cols-2" data-testid="evidence-list">{ev.map((e) => <EvidenceCard key={e.id} e={e} inv={inv[e.investigation_id] ?? e.investigation_id} />)}</ul>
                  {w.evidence.length > SHOWN && <button type="button" onClick={() => setAll(!all)} className="mt-3 text-[13.5px] text-link hover:underline" data-testid="evidence-more">
                    {all ? "Show fewer" : `Show all ${w.evidence.length} evidence items`}</button>}
                </>
              ) : <p className="text-[14px] text-text-2">No evidence items match the current filters.</p>}
            </section>
            <section className="rounded-2xl border border-line/60 bg-panel/50" data-testid="filters-section" data-open={filtersOpen ? "true" : "false"}>
              <button type="button" onClick={() => setFiltersOpen(!filtersOpen)} aria-expanded={filtersOpen} data-testid="filters-toggle"
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
                <span><span className="subhead text-[17px]">Refine by experimental conditions</span>
                  <span className="ml-2 text-[13px] text-text-3">{activeCount ? `${activeCount} filter${activeCount > 1 ? "s" : ""} active` : "material, fuel, oxygen, pressure… and source availability"}</span></span>
                <Icon name="chevron" size={15} className={`transition-transform ${filtersOpen ? "-rotate-90" : "rotate-90"}`} />
              </button>
              <div hidden={!filtersOpen} className="grid gap-4 border-t border-line/50 p-4 lg:grid-cols-[minmax(0,1fr)_300px]">
                <Filters w={w} set={set} clear={clear} />
                <section className="rounded-2xl border border-line/60 bg-panel/50 p-4 text-[13px]" data-testid="source-availability">
                  <h2 className="subhead text-[15px]">Source availability</h2>
                  <ul className="mt-2 flex flex-col gap-1.5">{w.ranked.map((r) => (
                    <li key={r.investigation_id} className="flex justify-between gap-2"><span className="text-text">{r.short_name}</span>
                      <span className="text-right text-text-3">{READINESS_LABEL[r.readiness] ?? r.readiness}{w.matching[r.investigation_id]?.n_total ? ` · ${w.matching[r.investigation_id].n_total} records` : ""}</span></li>))}</ul>
                </section>
              </div>
            </section>
            <section aria-labelledby="int-h" className="rounded-2xl border border-line/60 bg-panel/50 p-4 md:p-5" data-testid="interpretation">
              <h2 id="int-h" className="subhead text-[19px]">Scientific interpretation</h2>
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                <div><h3 className="text-[14px] font-semibold text-text">What the evidence shows</h3>
                  <ul className="mt-1 list-disc pl-5 text-[14px] text-text-2" data-testid="interp-shows">{w.interpretation.shows.map((x) => <li key={x}>{x}</li>)}</ul></div>
                <div><h3 className="text-[14px] font-semibold text-text">What cannot be concluded</h3>
                  <ul className="mt-1 list-disc pl-5 text-[14px] text-text-2" data-testid="interp-cannot">{w.interpretation.cannot_conclude.map((x) => <li key={x}>{x}</li>)}</ul></div>
              </div>
              <details className="mt-3 text-[14px] text-text-2">
                <summary className="cursor-pointer text-[13.5px] text-link">Why it matters, and the missing data</summary>
                <p className="mt-2">{w.interpretation.why_it_matters}</p>
                <ul className="mt-2 list-disc pl-5">{w.interpretation.missing.map((x) => <li key={x}>{x}</li>)}</ul>
              </details>
            </section>
          </div>
        );
      }}</Loadable>
    </>
  );
}

"use client";

/* eslint-disable @next/next/no-img-element -- media are pre-sized WebP variants from the NASA media registry */
// Phase 16: the five scientific domains of the Combustion & Fire Science Explorer and the collections inside the chosen
// one. Each collection shows its evidence level, so measured tests, conditions, figure data and metadata never look alike.
import Link from "next/link";
import { Icon } from "@/components/icons";
import { useCachedApi } from "@/lib/api";
import { MEDIA_BY_ID } from "@/lib/scientific-media";

export type Collection = { kind: "dataset" | "profile"; key: string; investigation_id: string; short_name: string; title: string;
  level: string; level_label: string; badge: string; records: number; original?: boolean };
export type Domain = { id: string; title: string; scenario: string; summary: string; collections: Collection[]; investigations: string[] };
export type DomainsResp = { domains: Domain[]; investigations: number };

// Verified NASA media per domain (credit shown on the card); smoke has no NASA image in SpaceFire, so it gets an
// original schematic that says so.
const IMAGE: Record<string, { id: string; note: string } | null> = {
  droplet: { id: "flex-heptane-soot-composite", note: "NASA image: heptane droplet with soot (FLEX)" },
  gaseous: { id: "cfi-g-cool-flame-video", note: "NASA video frame from a CFI-G test" },
  solid: { id: "bass2-flame-gmt203", note: "NASA image: BASS-II flame over acrylic" },
  smoke: null,
  spacecraft: { id: "saffire1-hardware-cygnus", note: "NASA image: Saffire-I hardware in Cygnus" },
};
export const LEVEL_CLS: Record<string, string> = {
  measured: "border-data/60 text-data", derived: "border-link/60 text-link", figure: "border-link/60 text-link",
  conditions: "border-text-2/60 text-text-2", day_summary: "border-warn/60 text-warn", log: "border-text-2/60 text-text-2",
  plan: "border-dashed border-text-3 text-text-3", metadata: "border-dashed border-text-3 text-text-3",
};

function DomainImage({ domain }: { domain: string }) {
  const img = IMAGE[domain];
  const m = img ? MEDIA_BY_ID[img.id] : null;
  if (!m) {
    return (
      <div className="relative h-24 overflow-hidden rounded-lg bg-[radial-gradient(circle_at_30%_70%,rgba(255,140,60,0.35),transparent_45%),linear-gradient(135deg,#0b1424,#152238)]" aria-hidden>
        <svg viewBox="0 0 200 96" className="absolute inset-0 h-full w-full">
          {Array.from({ length: 26 }).map((_, i) => <circle key={i} cx={30 + ((i * 37) % 150)} cy={20 + ((i * 23) % 60)} r={1.5 + (i % 4)} fill="#c9d3e2" opacity={0.35 + (i % 3) * 0.15} />)}
          <rect x="160" y="30" width="26" height="36" rx="4" fill="none" stroke="#4fd1e8" strokeWidth="2" />
        </svg>
        <span className="absolute bottom-1 left-2 text-[10.5px] text-text-3">Original schematic, not a photo</span>
      </div>
    );
  }
  const v = m.poster ?? m.variants[0];
  return (
    <div className="relative h-24 overflow-hidden rounded-lg bg-black">
      <img src={v.src} alt={m.alt} width={v.width} height={v.height} className="h-full w-full object-cover opacity-90" loading="lazy" decoding="async" />
      <span className="absolute bottom-1 left-2 rounded bg-black/60 px-1 text-[10.5px] text-white/85">{img!.note} · {m.credit}</span>
    </div>
  );
}

export default function DomainPicker({ current, onPick }: { current: string; onPick: (key: string) => void }) {
  const d = useCachedApi<DomainsResp>("/combustion/domains");
  if (!d.data) return <div className="mb-5 h-40 animate-pulse rounded-xl bg-panel/50" aria-busy="true" aria-label="Loading domains" />;
  const domains = d.data.domains;
  const active = domains.find((x) => x.collections.some((c) => c.key === current)) ?? domains[0];
  return (
    <section aria-label="Scientific domains" className="mb-5 flex flex-col gap-3" data-testid="domain-picker">
      <ul className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
        {domains.map((dm) => {
          const on = dm.id === active.id;
          return (
            <li key={dm.id}>
              <button type="button" onClick={() => onPick(dm.collections[0].key)} aria-pressed={on} data-testid={`domain-${dm.id}`}
                className={`press flex h-full w-full flex-col gap-1.5 rounded-xl border p-2 text-left ${on ? "border-flame bg-flame/[0.07] ring-1 ring-flame/40" : "border-line/70 bg-panel/50 hover:border-flame/50"}`}>
                <DomainImage domain={dm.id} />
                <span className="text-[14px] font-semibold leading-snug text-text">{dm.title}</span>
                <span className="text-[12px] text-text-3">{dm.collections.map((c) => c.short_name).filter((v, i, a) => a.indexOf(v) === i).join(" · ")}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label={`${active.title} collections`}>
        {active.collections.map((c) => {
          const on = c.key === current;
          return (
            <button key={c.key} type="button" role="tab" aria-selected={on} onClick={() => onPick(c.key)} data-testid={`collection-${c.key}`}
              className={`press flex flex-col items-start rounded-lg border px-3 py-1.5 text-left ${on ? "border-flame bg-flame/10" : "border-line-strong/70 hover:border-flame/50"}`}>
              <span className="text-[13.5px] font-medium text-text">{c.title}</span>
              <span className="mt-0.5 flex items-center gap-1.5 text-[11.5px]">
                <span className={`rounded border px-1 ${LEVEL_CLS[c.level] ?? ""}`}>{c.level_label}</span>
                <span className="text-text-3">{c.kind === "profile" ? "profile" : `${c.records} ${c.level === "figure" ? "series" : c.level === "day_summary" ? "days" : "records"}`}</span>
              </span>
            </button>
          );
        })}
        <Link href={`/safety-explorer/${active.scenario}`} className="ml-auto inline-flex items-center gap-1 text-[13px]" data-testid="domain-scenario-link">
          Research-to-Safety scenario<Icon name="chevron" size={13} /></Link>
      </div>
      <p className="text-[13px] text-text-3">{active.summary}</p>
    </section>
  );
}

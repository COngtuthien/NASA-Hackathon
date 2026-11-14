"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { MediaImage, MediaLightbox, RelationBadge } from "@/components/media";
import { AnimatePresence, DUR, EASE, LayoutGroup, motion, useRichMotion } from "@/components/motion";
import { PageHeader } from "@/components/ui";
import { MEDIA, RELATION_LABEL, type ScientificMedia } from "@/lib/scientific-media";
import { PHENOMENA } from "@/lib/routes";

const TYPE_LABEL: Record<string, string> = { image: "Photographs", video: "Video", animation: "Animation" };
const FILTERS = ["phenomenon", "investigation", "type", "relation"] as const;
type FilterKey = (typeof FILTERS)[number];

const PHEN_OPTIONS = [
  ...PHENOMENA.map((p) => [p.inv, p.short] as [string, string]),
];

function Chip({ on, onClick, children, count }: { on: boolean; onClick: () => void; children: React.ReactNode; count?: number }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick}
      className={`press rounded-full border px-3 py-1 text-[13px] ${on ? "border-flame bg-flame/15 text-text" : "border-line-strong text-text-2 hover:text-text"}`}>
      {children}{count !== undefined && <span className="ml-1.5 text-text-3">{count}</span>}
    </button>
  );
}

function Card({ m, onOpen }: { m: ScientificMedia; onOpen: () => void }) {
  const rich = useRichMotion();
  const tall = m.variants[m.variants.length - 1].height > m.variants[m.variants.length - 1].width;
  return (
    <motion.li layout={rich} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: DUR.base, ease: EASE }} className="group min-w-0">
      <button type="button" onClick={onOpen} className="lift block w-full overflow-hidden rounded-2xl border border-line/80 bg-panel/80 text-left hover:border-data/40"
        aria-label={`${m.title}: open with source details`}>
        <div className="relative overflow-hidden bg-black" style={{ aspectRatio: "4 / 3" }}>
          <MediaImage m={m} sizes="(min-width: 1280px) 30vw, (min-width: 640px) 46vw, 94vw"
            className={`h-full w-full transition-transform duration-700 ${rich ? "group-hover:scale-[1.05]" : ""} ${tall ? "object-contain" : "object-cover"}`} />
          <span className="absolute left-2.5 top-2.5"><RelationBadge relation={m.relation} onMedia /></span>
          {m.type !== "image" && (
            <span className="absolute bottom-2.5 right-2.5 rounded-full bg-black/70 px-2 py-0.5 text-[11.5px] text-white">{m.type === "video" ? "Video" : "Animation"}</span>
          )}
        </div>
        <div className="p-4">
          <p className="text-[12px] text-text-3">{m.investigation}{m.date ? ` · ${m.date}` : ""}</p>
          <h3 className="subhead mt-1 text-[16px] leading-snug">{m.title}</h3>
          <p className="mt-1.5 line-clamp-3 text-[13.5px] text-text-2">{m.visible}</p>
          <p className="mt-2 text-[12px] text-text-3">Credit: {m.credit}</p>
        </div>
      </button>
    </motion.li>
  );
}

/** Phase 16: media coverage of the ten registered investigations. A count of 0 means no verified NASA image or video
 *  is in SpaceFire for it; none is substituted. "BASS" and "SoFIE" items are related context, not registered here. */
const COVERAGE: { inv: string; name: string; label: string | null; analysis: string }[] = [
  { inv: "PSI-69", name: "FLEX", label: "FLEX", analysis: "/phenomena/flame-extinction" },
  { inv: "PSI-117", name: "PSI-117", label: null, analysis: "/phenomena/flame-extinction#psi117-explore" },
  { inv: "PSI-68", name: "FLEX-2", label: "FLEX-2", analysis: "/phenomena/flame-extinction#flex2" },
  { inv: "PSI-159", name: "ACME CFI-G", label: "CFI-G", analysis: "/phenomena/gaseous-flames?tab=cfig" },
  { inv: "PSI-10", name: "ACME Flame Design", label: null, analysis: "/phenomena/gaseous-flames?tab=flame-design" },
  { inv: "PSI-20", name: "ACME BRE", label: null, analysis: "/phenomena/gaseous-flames?tab=bre" },
  { inv: "PSI-25", name: "BASS-II", label: "BASS-II", analysis: "/phenomena/flame-spread" },
  { inv: "PSI-62", name: "PSI-62", label: null, analysis: "/experiments?dataset=psi62" },
  { inv: "PSI-102", name: "SAME", label: null, analysis: "/phenomena/smoke-detection" },
  { inv: "PSI-98", name: "SAFFIRE-I", label: "SAFFIRE-I", analysis: "/phenomena/spacecraft-fire" },
];

export default function MediaGalleryView() {
  const sp = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const [open, setOpen] = useState<ScientificMedia | null>(null);
  const val = (k: FilterKey) => sp.get(k) ?? "";
  const set = (k: FilterKey, v: string) => {
    const q = new URLSearchParams(sp.toString());
    if (!v || q.get(k) === v) q.delete(k); else q.set(k, v);
    router.replace(`${path}${q.toString() ? `?${q}` : ""}`, { scroll: false });
  };
  const match = (m: ScientificMedia, skip?: FilterKey) =>
    (skip === "phenomenon" || !val("phenomenon") || m.datasetInv === val("phenomenon"))
    && (skip === "investigation" || !val("investigation") || m.investigation === val("investigation"))
    && (skip === "type" || !val("type") || m.type === val("type"))
    && (skip === "relation" || !val("relation") || m.relation === val("relation"));
  const shown = MEDIA.filter((m) => match(m));
  const count = (k: FilterKey, v: string, get: (m: ScientificMedia) => string) => MEDIA.filter((m) => match(m, k) && get(m) === v).length;
  const investigations = [...new Set(MEDIA.map((m) => m.investigation))];
  const types = [...new Set(MEDIA.map((m) => m.type))];
  const active = FILTERS.some((k) => val(k));
  return (
    <>
      <PageHeader kicker="Evidence & literature" title="Scientific media"
        lead="Photographs and footage NASA published from these experiments. Each item says whether it shows the experiment itself or related context, and links to its NASA record." />
      <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-line/80 bg-panel/70 p-4" role="group" aria-label="Filter the media">
        <div className="flex flex-wrap items-center gap-2"><span className="w-28 text-sm text-text-3">Phenomenon</span>
          {PHEN_OPTIONS.map(([inv, label]) => (
            <Chip key={inv} on={val("phenomenon") === inv} onClick={() => set("phenomenon", inv)} count={count("phenomenon", inv, (m) => m.datasetInv)}>{label}</Chip>))}
        </div>
        <div className="flex flex-wrap items-center gap-2"><span className="w-28 text-sm text-text-3">Relation</span>
          {(["experimental", "related"] as const).map((x) => (
            <Chip key={x} on={val("relation") === x} onClick={() => set("relation", x)} count={count("relation", x, (m) => m.relation)}>{RELATION_LABEL[x].label}</Chip>))}
          {active && <button type="button" className="ml-auto text-sm text-link hover:underline" onClick={() => router.replace(path, { scroll: false })}>Clear filters</button>}
        </div>
        <details className="group/more" open={!!(val("investigation") || val("type")) || undefined}>
        <summary className="cursor-pointer text-[13.5px] text-link">More filters: investigation and media type</summary>
        <div className="mt-3 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2"><span className="w-28 text-sm text-text-3">Investigation</span>
          {investigations.map((x) => (
            <Chip key={x} on={val("investigation") === x} onClick={() => set("investigation", x)} count={count("investigation", x, (m) => m.investigation)}>{x}</Chip>))}
        </div>
        <div className="flex flex-wrap items-center gap-2"><span className="w-28 text-sm text-text-3">Media type</span>
          {types.map((x) => (
            <Chip key={x} on={val("type") === x} onClick={() => set("type", x)} count={count("type", x, (m) => m.type)}>{TYPE_LABEL[x] ?? x}</Chip>))}
        </div>
        </div>
        </details>

      </div>
      <details className="mb-5 rounded-2xl border border-line/60 bg-panel/40 p-4" data-testid="media-coverage">
        <summary className="cursor-pointer text-[14px] font-medium text-text">Coverage of the ten NASA investigations</summary>
        <ul className="mt-3 grid gap-2 text-[13.5px] sm:grid-cols-2 xl:grid-cols-3">
          {COVERAGE.map((c) => {
            const n = c.label ? MEDIA.filter((m) => m.investigation === c.label).length : 0;
            return (
              <li key={c.inv} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line/60 px-3 py-2" data-testid={`coverage-${c.inv}`} data-count={n}>
                <span><b className="text-text">{c.name}</b> <span className="text-text-3">{c.inv}</span></span>
                <span className="flex items-center gap-3">
                  {n > 0 ? <button type="button" className="text-link hover:underline" onClick={() => set("investigation", c.label!)}>{n} item{n > 1 ? "s" : ""}</button>
                    : <span className="text-text-3">No verified NASA media in SpaceFire</span>}
                  <a href={c.analysis}>Analysis</a>
                </span>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-[12.5px] text-text-3">Only media whose NASA source and investigation could be verified are shown. Engineering drawings from the downloads are not published (redistribution rights unverified).</p>
      </details>
      <p className="mb-3 text-sm text-text-3" aria-live="polite">{shown.length} of {MEDIA.length} items</p>
      {shown.length === 0 ? (
        <p className="rounded-xl border border-line p-6 text-text-2">No media match these filters. <button className="text-link hover:underline" onClick={() => router.replace(path, { scroll: false })}>Clear filters</button></p>
      ) : (
        <LayoutGroup>
          <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            <AnimatePresence initial={false} mode="popLayout">
              {shown.map((m) => <Card key={m.id} m={m} onOpen={() => setOpen(m)} />)}
            </AnimatePresence>
          </ul>
        </LayoutGroup>
      )}
      <details className="mt-10 rounded-2xl border border-line/60 bg-panel/40 p-5 text-sm text-text-2">
      <summary className="cursor-pointer text-text">What the media labels mean</summary>
      <section className="mt-4 grid gap-4 md:grid-cols-3">
        {(["experimental", "related", "illustration"] as const).map((r) => (
          <div key={r}><RelationBadge relation={r} /><p className="mt-2">{RELATION_LABEL[r].note}</p></div>
        ))}
        <p className="md:col-span-3 text-xs text-text-3">
          Schematics (the droplet, physics and airflow figures) are labelled where they appear and are not listed here. Credits, usage terms and the
          analysis of why no photo is tied to a test number: <Link href="/methodology#sources">Methodology</Link> and <span className="raw">docs/SCIENTIFIC_MEDIA_SOURCES.md</span>.
        </p>
      </section>
      </details>
      {open && <MediaLightbox m={open} open onClose={() => setOpen(null)} />}
    </>
  );
}

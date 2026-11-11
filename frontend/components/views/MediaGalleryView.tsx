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
        lead="Photographs, footage and animation that NASA published from the three investigations and from closely related experiments. Each item says whether it is real experiment media or related context, and links to its original NASA record. Images give context; SpaceFire's numbers come from the data files."
        facts={[
          { value: MEDIA.length, label: "verified media items" },
          { value: MEDIA.filter((m) => m.relation === "experimental").length, label: "real media of FLEX, BASS-II or SAFFIRE-I" },
          { value: 0, label: "items attached to a test ID (NASA captions name none)" },
        ]} />
      <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-line/80 bg-panel/70 p-4" role="group" aria-label="Filter the media">
        <div className="flex flex-wrap items-center gap-2"><span className="w-28 text-sm text-text-3">Phenomenon</span>
          {PHEN_OPTIONS.map(([inv, label]) => (
            <Chip key={inv} on={val("phenomenon") === inv} onClick={() => set("phenomenon", inv)} count={count("phenomenon", inv, (m) => m.datasetInv)}>{label}</Chip>))}
        </div>
        <div className="flex flex-wrap items-center gap-2"><span className="w-28 text-sm text-text-3">Investigation</span>
          {investigations.map((x) => (
            <Chip key={x} on={val("investigation") === x} onClick={() => set("investigation", x)} count={count("investigation", x, (m) => m.investigation)}>{x}</Chip>))}
        </div>
        <div className="flex flex-wrap items-center gap-2"><span className="w-28 text-sm text-text-3">Media type</span>
          {types.map((x) => (
            <Chip key={x} on={val("type") === x} onClick={() => set("type", x)} count={count("type", x, (m) => m.type)}>{TYPE_LABEL[x] ?? x}</Chip>))}
        </div>
        <div className="flex flex-wrap items-center gap-2"><span className="w-28 text-sm text-text-3">Relation</span>
          {(["experimental", "related"] as const).map((x) => (
            <Chip key={x} on={val("relation") === x} onClick={() => set("relation", x)} count={count("relation", x, (m) => m.relation)}>{RELATION_LABEL[x].label}</Chip>))}
          {active && <button type="button" className="ml-auto text-sm text-link hover:underline" onClick={() => router.replace(path, { scroll: false })}>Clear filters</button>}
        </div>
      </div>
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
      <section className="mt-10 grid gap-4 rounded-2xl border border-line/80 bg-panel/60 p-5 text-sm text-text-2 md:grid-cols-3">
        {(["experimental", "related", "illustration"] as const).map((r) => (
          <div key={r}><RelationBadge relation={r} /><p className="mt-2">{RELATION_LABEL[r].note}</p></div>
        ))}
        <p className="md:col-span-3 text-xs text-text-3">
          Schematics (the droplet, physics and airflow figures) are labelled where they appear and are not listed here. Credits, usage terms and the
          analysis of why no photo is tied to a test number: <Link href="/methodology#sources">Methodology</Link> and <span className="raw">docs/SCIENTIFIC_MEDIA_SOURCES.md</span>.
        </p>
      </section>
      {open && <MediaLightbox m={open} open onClose={() => setOpen(null)} />}
    </>
  );
}

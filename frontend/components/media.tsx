"use client";

/* eslint-disable @next/next/no-img-element -- media are pre-sized WebP variants with explicit srcSet/width/height */

// Scientific media primitives: provenance-labelled figures, an accessible lightbox (native <dialog>), and
// user-initiated players for the SAFFIRE-I animation, a local NASA clip and the NASA YouTube video.
// Nothing autoplays; nothing third-party loads before a click; reduced motion turns off reveal masks and zoom.
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "@/components/icons";
import { DUR, EASE, motion, useReducedMotion, useRichMotion } from "@/components/motion";
import { largest, MEDIA_BY_ID, RELATION_LABEL, srcSet, type Relation, type ScientificMedia } from "@/lib/scientific-media";

const RELATION_CLS: Record<Relation, string> = {
  experimental: "border-ok/60 text-ok",
  related: "border-info/60 text-info",
  illustration: "border-dashed border-text-3 text-text-3",
};
const RELATION_BG: Record<Relation, string> = { experimental: "bg-ok/10", related: "bg-info/10", illustration: "" };

/** Relation label. `onMedia` gives it an opaque dark backing so it stays legible over bright photographs. */
export function RelationBadge({ relation, className = "", onMedia = false }: { relation: Relation; className?: string; onMedia?: boolean }) {
  const r = RELATION_LABEL[relation];
  return (
    <span title={r.note} className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-px text-[11.5px] font-medium ${RELATION_CLS[relation]} ${onMedia ? "bg-[#070d18]/90 shadow-[0_1px_6px_rgba(0,0,0,0.5)]" : RELATION_BG[relation]} ${className}`}>
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />{r.short}
    </span>
  );
}

/** Credit line with a working link to the original NASA record. */
export function Credit({ m, className = "" }: { m: ScientificMedia; className?: string }) {
  return (
    <span className={`text-[12px] text-text-3 ${className}`}>
      {m.credit}{m.date ? `, ${m.date}` : ""} ·{" "}
      <a href={m.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5">
        {m.sourceLabel}<Icon name="external" size={11} /><span className="sr-only">(opens the original source)</span>
      </a>
    </span>
  );
}

/** Responsive <img> from registry variants; explicit width/height reserve the space (no layout shift). */
export function MediaImage({ m, sizes, className = "", eager = false, style }: {
  m: ScientificMedia; sizes: string; className?: string; eager?: boolean; style?: React.CSSProperties;
}) {
  const big = largest(m);
  return (
    <img src={big.src} srcSet={srcSet(m)} sizes={sizes} width={big.width} height={big.height} alt={m.alt}
      loading={eager ? "eager" : "lazy"} decoding="async" fetchPriority={eager ? "high" : undefined}
      className={className} style={style} />
  );
}

/**
 * A captioned, clickable scientific figure. The frame reveals with a mask when it enters the viewport (rich motion
 * only) and opens the lightbox with full provenance on click or Enter.
 */
export function MediaFigure({ id, sizes = "(min-width: 1024px) 40vw, 92vw", aspect, fit = "cover", position, caption, className = "",
  frameClass = "", compact = false, eager = false }: {
  id: string; sizes?: string; aspect?: string; fit?: "cover" | "contain"; position?: string; caption?: ReactNode; className?: string;
  frameClass?: string; compact?: boolean; eager?: boolean;
}) {
  const m = MEDIA_BY_ID[id];
  const rich = useRichMotion();
  const [open, setOpen] = useState(false);
  if (!m) return null;
  const big = largest(m);
  return (
    <figure className={`group min-w-0 ${className}`}>
      <motion.div className={`relative overflow-hidden rounded-xl border border-line/70 bg-void ${frameClass}`}
        style={{ aspectRatio: aspect ?? `${big.width} / ${big.height}` }}
        initial={rich ? { clipPath: "inset(12% 8% 12% 8% round 14px)", opacity: 0.4 } : false}
        whileInView={rich ? { clipPath: "inset(0% 0% 0% 0% round 14px)", opacity: 1 } : undefined}
        viewport={{ once: true, amount: 0.25 }} transition={{ duration: DUR.cinematic, ease: EASE }}>
        <button type="button" onClick={() => setOpen(true)} className="absolute inset-0 block h-full w-full cursor-zoom-in focus-visible:outline-offset-[-3px]"
          aria-label={`Open “${m.title}” with source details`}>
          <MediaImage m={m} sizes={sizes} eager={eager}
            className={`h-full w-full transition-transform duration-700 ease-out ${rich ? "group-hover:scale-[1.035]" : ""} ${fit === "cover" ? "object-cover" : "object-contain"}`}
            style={position ? { objectPosition: position } : undefined} />
          {(m.type === "video" || m.type === "animation") && (
            <span className="absolute inset-0 grid place-items-center">
              <span className="grid h-14 w-14 place-items-center rounded-full border border-white/40 bg-black/55 text-white backdrop-blur-sm transition-transform group-hover:scale-110">
                <PlayGlyph />
              </span>
            </span>
          )}
        </button>
        <span className="pointer-events-none absolute left-2.5 top-2.5"><RelationBadge relation={m.relation} onMedia /></span>
      </motion.div>
      <figcaption className={`mt-2 ${compact ? "text-[12.5px]" : "text-[13.5px]"} leading-snug text-text-2`}>
        {caption ?? m.visible}
        <span className="mt-1 block"><Credit m={m} /></span>
      </figcaption>
      <MediaLightbox m={m} open={open} onClose={() => setOpen(false)} />
    </figure>
  );
}

function PlayGlyph() {
  return <svg aria-hidden width="20" height="20" viewBox="0 0 20 20"><path d="M6 4l10 6-10 6z" fill="currentColor" /></svg>;
}

/** The medium itself, at full size: still image, user-started animation, local clip, or click-to-load YouTube. */
export function MediaViewer({ m, sizes = "(min-width: 1024px) 60vw, 94vw" }: { m: ScientificMedia; sizes?: string }) {
  if (m.animation) return <AnimationPlayer m={m} />;
  if (m.video) return <ClipPlayer m={m} />;
  if (m.embed) return <YouTubeFacade m={m} />;
  return <MediaImage m={m} sizes={sizes} className="max-h-[70vh] w-full rounded-lg object-contain" />;
}

/** SAFFIRE-I: a still poster; NASA's animated frames load and play only when asked. */
export function AnimationPlayer({ m }: { m: ScientificMedia }) {
  const [playing, setPlaying] = useState(false);
  const p = m.poster ?? largest(m);
  return (
    <div className="flex flex-col gap-2">
      <div className="relative overflow-hidden rounded-lg border border-line bg-black" style={{ aspectRatio: `${p.width} / ${p.height}` }}>
        <img src={playing ? m.animation : p.src} width={p.width} height={p.height} alt={playing ? `${m.alt} (playing)` : m.alt}
          className="h-full w-full object-contain [image-rendering:auto]" decoding="async" />
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <button type="button" onClick={() => setPlaying((x) => !x)}
          className="press inline-flex items-center gap-2 rounded-full border border-flame/60 bg-flame/10 px-3.5 py-1.5 text-text hover:bg-flame/20">
          {playing ? <><span aria-hidden className="h-3 w-3 rounded-sm bg-current" />Show still frame</> : <><PlayGlyph />Play NASA animation</>}
        </button>
        <span className="text-text-3">{m.caveat}</span>
      </div>
    </div>
  );
}

/** Local NASA clip: preload none, never autoplays, muted (the source has no audio). */
export function ClipPlayer({ m }: { m: ScientificMedia }) {
  const p = m.poster ?? largest(m);
  return (
    <div className="flex flex-col gap-2">
      <video controls preload="none" playsInline muted poster={p.src} width={p.width} height={p.height}
        className="w-full rounded-lg border border-line bg-black" aria-label={m.title}>
        <source src={m.video!.src} type={m.video!.mime} />
        Your browser cannot play this video. <a href={m.sourceUrl}>Open it at NASA</a>.
      </video>
      <span className="text-xs text-text-3">{m.video!.durationNote}. {m.caveat}</span>
    </div>
  );
}

/** YouTube facade: shows the local poster; the privacy-enhanced embed loads only after a click. */
export function YouTubeFacade({ m }: { m: ScientificMedia }) {
  const [on, setOn] = useState(false);
  const e = m.embed!;
  const p = m.poster ?? largest(m);
  if (on) {
    return (
      <div className="relative w-full overflow-hidden rounded-lg border border-line bg-black" style={{ aspectRatio: "16 / 9" }}>
        <iframe className="absolute inset-0 h-full w-full" src={`https://www.youtube-nocookie.com/embed/${e.videoId}?autoplay=1&rel=0`}
          title={`${e.title} (${e.channel})`} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin" />
      </div>
    );
  }
  return (
    <button type="button" onClick={() => setOn(true)} className="group relative block w-full overflow-hidden rounded-lg border border-line bg-black text-left"
      style={{ aspectRatio: "16 / 9" }} aria-label={`Play “${e.title}” from ${e.channel} on YouTube`}>
      <img src={p.src} alt="" width={p.width} height={p.height} className="absolute inset-0 h-full w-full object-cover opacity-60" />
      <span className="absolute inset-0 grid place-items-center">
        <span className="grid h-16 w-16 place-items-center rounded-full bg-[#e62117] text-white shadow-lg transition-transform group-hover:scale-110"><PlayGlyph /></span>
      </span>
      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-3 text-[13px] text-white/90">
        {e.title} · {e.channel}. Loads from YouTube (privacy-enhanced mode) when you press play.
      </span>
    </button>
  );
}

/** Accessible lightbox on the native <dialog>: focus is trapped and restored, Esc closes, the page does not scroll. */
export function MediaLightbox({ m, open, onClose }: { m: ScientificMedia; open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const reduce = useReducedMotion();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} onClose={onClose} onClick={(e) => { if (e.target === ref.current) onClose(); }}
      aria-labelledby={`lb-${m.id}`}
      className="m-auto max-h-[94vh] w-[min(1100px,96vw)] overflow-y-auto rounded-2xl border border-line-strong bg-panel p-0 text-text shadow-2xl backdrop:bg-black/75 backdrop:backdrop-blur-sm">
      {open && (
        <motion.div initial={reduce ? false : { opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: DUR.base, ease: EASE }}
          className="grid gap-5 p-4 md:grid-cols-[1.5fr_1fr] md:p-6">
          <div className="min-w-0"><MediaViewer m={m} /></div>
          <div className="flex min-w-0 flex-col gap-3 text-sm">
            <div className="flex items-start justify-between gap-3">
              <h2 id={`lb-${m.id}`} className="subhead text-[19px] leading-snug">{m.title}</h2>
              <button type="button" onClick={onClose} autoFocus className="press shrink-0 rounded-full border border-line-strong p-1.5 text-text-2 hover:text-text" aria-label="Close">
                <Icon name="close" size={16} />
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2"><RelationBadge relation={m.relation} /><span className="text-xs text-text-3">{m.investigation}</span></div>
            <p className="text-text-2">{m.description}</p>
            <p><span className="text-text-3">What you see: </span>{m.visible}</p>
            <p className="rounded-lg border border-line bg-ink/50 p-2.5 text-[13px] text-text-2"><span className="font-semibold text-text">Why it is labelled “{RELATION_LABEL[m.relation].short}”: </span>{m.relationNote}</p>
            {m.caveat && <p className="text-[13px] text-warn">{m.caveat}</p>}
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]">
              <dt className="text-text-3">Credit</dt><dd>{m.credit}</dd>
              {m.date && <><dt className="text-text-3">Date</dt><dd>{m.date}</dd></>}
              {m.nasaId && <><dt className="text-text-3">NASA ID</dt><dd className="raw break-all">{m.nasaId}</dd></>}
              <dt className="text-text-3">Source</dt><dd><a href={m.sourceUrl} target="_blank" rel="noreferrer" className="break-words">{m.sourceLabel}</a></dd>
              <dt className="text-text-3">Use</dt><dd className="text-text-2">{m.license}</dd>
            </dl>
            {(m.related?.length || m.reference) && (
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {m.related?.map((r) => <Link key={r.href} href={r.href} onClick={onClose}>{r.label}</Link>)}
                {m.reference && <Link href={m.reference.href} onClick={onClose}>{m.reference.label}</Link>}
              </div>
            )}
            <p className="text-xs text-text-3">Images give context only; SpaceFire&apos;s numbers come from the NASA data files and documents.</p>
          </div>
        </motion.div>
      )}
    </dialog>
  );
}

/** A schematic shown beside real media, with an explicit "Schematic" label so the two can never be confused. */
export function SchematicFigure({ children, caption, className = "" }: { children: ReactNode; caption: ReactNode; className?: string }) {
  return (
    <figure className={`min-w-0 ${className}`}>
      <div className="relative grid place-items-center overflow-hidden rounded-xl border border-dashed border-line-strong bg-ink/60 p-3" style={{ aspectRatio: "4 / 3" }}>
        <span className="absolute left-2.5 top-2.5 z-10"><RelationBadge relation="illustration" onMedia /></span>
        <div className="w-full max-w-[300px] [&_figcaption]:hidden">{children}</div>
      </div>
      <figcaption className="mt-2 text-[13px] leading-snug text-text-2">{caption}</figcaption>
    </figure>
  );
}

/** "Seen in orbit" band for a phenomenon page: real media first, the schematic labelled, a link to the gallery. */
export function OrbitMediaPanel({ title, lead, items, schematic, galleryInv }: {
  title: string; lead: ReactNode; galleryInv: string;
  items: { id: string; caption?: ReactNode; fit?: "cover" | "contain"; aspect?: string }[];
  schematic?: { node: ReactNode; caption: ReactNode };
}) {
  return (
    <section id="seen" aria-labelledby="seen-title" className="hairline-top scroll-mt-36 rounded-2xl border border-line/80 bg-[linear-gradient(170deg,rgba(91,140,255,0.06),rgba(16,30,51,0.9)_40%)] p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-[75ch]">
          <p className="kicker">Seen in orbit</p>
          <h2 id="seen-title" className="subhead mt-2 text-[22px] md:text-[26px]">{title}</h2>
          <p className="mt-2 text-[15px] leading-relaxed text-text-2">{lead}</p>
        </div>
        <Link href={`/evidence/media?phenomenon=${galleryInv}`} className="inline-flex items-center gap-1 text-sm">All media for this phenomenon<Icon name="chevron" size={14} /></Link>
      </div>
      <div className={`mt-5 grid gap-5 sm:grid-cols-2 ${items.length + (schematic ? 1 : 0) === 5 ? "lg:grid-cols-3 xl:grid-cols-5" : "xl:grid-cols-4"}`}>
        {items.map((it) => (
          <MediaFigure key={it.id} id={it.id} aspect={it.aspect ?? "4 / 3"} fit={it.fit} caption={it.caption} compact
            sizes="(min-width: 1280px) 22vw, (min-width: 640px) 45vw, 92vw" />
        ))}
        {schematic && <SchematicFigure caption={schematic.caption}>{schematic.node}</SchematicFigure>}
      </div>
      <p className="mt-4 text-xs text-text-3">Photographs and footage give visual context. They are not tied to individual test rows (NASA&apos;s captions name no test numbers), and every value on this page comes from the NASA data files.</p>
    </section>
  );
}

/** Inline player block for pages (not in a lightbox): title, the medium and its provenance. */
export function MediaPanelBlock({ id, children }: { id: string; children?: ReactNode }) {
  const m = MEDIA_BY_ID[id];
  if (!m) return null;
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <MediaViewer m={m} />
      <div className="flex flex-wrap items-center gap-2"><RelationBadge relation={m.relation} /><span className="text-sm font-semibold text-text">{m.title}</span></div>
      <p className="text-[13.5px] text-text-2">{m.visible}</p>
      {children}
      <Credit m={m} />
    </div>
  );
}

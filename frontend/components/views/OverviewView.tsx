"use client";

// Mission Control: the cinematic entry point. Every number here is fetched from the API (/overview, /analytics);
// illustrations are labelled as illustrations. Scientific statements in the physics story cite NASA document pages.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { FlexMapChart, type FlexPoint } from "@/components/charts";
import { Icon } from "@/components/icons";
import { PhysicsFigure, ScaleGlyph, Starfield } from "@/components/illustrations";
import { Credit, MediaFigure, MediaImage, RelationBadge } from "@/components/media";
import {
  CountUp, DUR, EASE, motion, Parallax, Reveal, Stagger, StaggerItem, useInView, useRichMotion, useScroll, useTransform, WordReveal,
} from "@/components/motion";
import { logX, SCALE_ITEMS, TICKS } from "@/components/ScaleLadder";
import { Button, inputCls, LinkButton, Loadable, Prov, SourceBadge } from "@/components/ui";
import { fmt, qs, useApi } from "@/lib/api";
import { canonical, PHENOMENA, ROUTES } from "@/lib/routes";
import { MEDIA_BY_ID } from "@/lib/scientific-media";
import type { MotionValue } from "motion/react";

type Investigation = {
  investigation_id: string; short_name: string; title: string; description: string; scale: string; fuel_system: string;
  burns: number; documents: number; publications_listed: number; quality_flags: number; doi: string; official_url: string;
};
type Insight = {
  id: string; investigation_id: string; kind: string; title: string; text: string; n: number | null; caveat: string;
  link: string; citations: { type: string; label: string; document_id?: string; page_pdf?: number }[];
};
type Overview = { investigations: Investigation[]; counts: Record<string, number>; ingested_at: string; insights: Insight[]; caveat: string };
type Health = { llm: { configured: boolean } };

const doc = (id: string, page: number) => `/api/v1/documents/${id}/file#page=${page}`;
const PH = Object.fromEntries(PHENOMENA.map((p) => [p.inv, p]));

function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-[1280px] px-4 md:px-8 ${className}`}>{children}</div>;
}

function SectionTitle({ kicker, title, lead, id }: { kicker: string; title: string; lead?: ReactNode; id?: string }) {
  return (
    <Reveal className="max-w-3xl">
      <p className="kicker">{kicker}</p>
      <h2 id={id} className="display mt-3 text-[30px] md:text-[44px]">{title}</h2>
      {lead && <p className="mt-4 text-[16.5px] leading-relaxed text-text-2">{lead}</p>}
    </Reveal>
  );
}

/* ---------------- A. Hero ---------------- */

function Hero({ ov }: { ov: Overview | null }) {
  const ref = useRef<HTMLElement>(null);
  const rich = useRichMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const contentY = useTransform(scrollYProgress, [0, 1], [0, -90]);
  const contentO = useTransform(scrollYProgress, [0, 0.8], [1, 0.15]);
  const flameScale = useTransform(scrollYProgress, [0, 1], [1, 1.18]);
  const c = ov?.counts;
  return (
    <section ref={ref} aria-labelledby="hero-title" className="relative isolate overflow-hidden border-b border-line/60">
      <Parallax speed={40} className="absolute inset-[-10%_0] -z-10"><Starfield /></Parallax>
      <div className="tech-grid absolute inset-0 -z-10 opacity-60" aria-hidden />
      <div aria-hidden className="absolute -right-40 top-1/3 -z-10 h-[520px] w-[520px] rounded-full bg-[radial-gradient(closest-side,rgba(255,138,61,0.12),transparent)] blur-3xl" />
      <HeroMedia scale={rich ? flameScale : undefined} />
      <Container className="grid min-h-[min(88vh,860px)] items-center gap-6 pb-14 pt-4 md:py-20">
        <motion.div style={rich ? { y: contentY, opacity: contentO } : undefined} className="relative z-10 lg:max-w-[min(62%,760px)]">
          <motion.p className="kicker" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: DUR.slow, delay: 0.05 }}>
            Microgravity combustion research, from NASA&apos;s own records
          </motion.p>
          <WordReveal text="Understanding Fire Beyond Gravity" className="display mt-5 text-[clamp(34px,9.6vw,60px)] leading-[0.98] xl:text-[84px]" />
          <motion.p className="mt-6 max-w-[56ch] text-[17.5px] leading-relaxed text-text-2" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DUR.slow, ease: EASE, delay: 0.55 }}>
            Explore the physics of combustion in microgravity through NASA experiments, scientific evidence, and intelligent analysis.
            Every value traces back to the CSV row, report page or paper it came from.
          </motion.p>
          <motion.div className="mt-8 flex flex-wrap gap-3" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DUR.slow, ease: EASE, delay: 0.7 }}>
            <LinkButton href="#physics" variant="primary" size="lg">Explore Combustion Physics</LinkButton>
            <LinkButton href={ROUTES.copilot} variant="quiet" size="lg"><Icon name="assistant" />Ask the Research Copilot</LinkButton>
            <LinkButton href={ROUTES.explorer} variant="quiet" size="lg"><Icon name="experiments" />Discover Experiments</LinkButton>
          </motion.div>
          <motion.dl className="mt-12 grid max-w-xl grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-4" initial={{ opacity: 0 }} animate={{ opacity: c ? 1 : 0 }}
            transition={{ duration: DUR.slow, delay: 0.85 }} aria-label="What is in the database">
            {c && ([
              [c.total_burn_rows, "experiment rows"], [c.chunks, "document passages"], [c.report_records ?? 0, "report table rows"], [c.quality_flags, "quality flags"],
            ] as [number, string][]).map(([v, l]) => (
              <div key={l} className="border-l border-line-strong/70 pl-3">
                <dd className="text-[26px] font-semibold leading-none text-data [font-stretch:115%]"><CountUp value={v} /></dd>
                <dt className="mt-1.5 text-[13px] text-text-3">{l}</dt>
              </div>
            ))}
          </motion.dl>
        </motion.div>
      </Container>
      <a href="#physics" className="absolute bottom-5 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 text-xs text-text-3 no-underline hover:text-text hover:no-underline md:flex">
        Scroll to explore
        <span aria-hidden className="relative h-9 w-px overflow-hidden bg-line-strong">
          <motion.span className="absolute left-0 top-0 h-3 w-px bg-flame" animate={{ y: [-12, 36] }} transition={{ duration: 1.8, repeat: 3, ease: "easeInOut" }} />
        </span>
      </a>
    </section>
  );
}

const HERO_MEDIA = "bass2-flame-gmt214";

/**
 * Hero visual: a real BASS-II flame photographed aboard the ISS, composited full-bleed. The photograph itself is unaltered
 * apart from scaling; the fade into the page, the glow and the star field are decorative layers, as the caption says.
 */
function HeroMedia({ scale }: { scale?: MotionValue<number> }) {
  const m = MEDIA_BY_ID[HERO_MEDIA];
  const fade = "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.55) 22%, #000 46%), linear-gradient(to top, transparent 0%, #000 22%)";
  const fadeMobile = "linear-gradient(to bottom, #000 55%, transparent 100%)";
  return (
    <motion.figure className="relative -z-10 lg:absolute lg:inset-y-0 lg:right-0 lg:w-[68%]"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1.8, ease: EASE }}>
      <div className="relative h-[42vh] min-h-[240px] overflow-hidden lg:h-full">
        <motion.div className="h-full w-full [mask-image:var(--fade-m)] lg:[mask-image:var(--fade)] [-webkit-mask-composite:source-in] [mask-composite:intersect]"
          style={{ ...(scale ? { scale } : {}), ["--fade" as string]: fade, ["--fade-m" as string]: fadeMobile }}>
          <MediaImage m={m} sizes="(min-width: 1024px) 68vw, 100vw" eager className="h-full w-full object-cover object-[78%_50%]" />
        </motion.div>
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(40%_45%_at_80%_52%,rgba(255,138,61,0.16),transparent)] mix-blend-screen" />
      </div>
      <figcaption className="relative z-10 mx-4 -mt-8 rounded-xl border border-line/60 bg-ink/80 px-3 py-2 text-[12px] leading-snug text-text-3 backdrop-blur-md lg:absolute lg:bottom-6 lg:right-8 lg:mx-0 lg:mt-0 lg:max-w-[440px]">
        <span className="flex flex-wrap items-center gap-2"><RelationBadge relation={m.relation} />
          <span className="text-text-2">Real BASS-II flame aboard the ISS, reduced-oxygen session, 2014.</span></span>
        <span className="mt-1 block">Real flame from NASA&apos;s BASS-II experiment; the fade, glow and star field are decorative. <Credit m={m} /></span>
      </figcaption>
    </motion.figure>
  );
}

/* ---------------- B. Physics story ---------------- */

const STEPS = [
  { title: "On Earth, hot gas rises", body: "Around a flame on Earth, heated gas is lighter than the air around it and rises. That buoyant flow draws fresh oxygen in and carries heat and combustion products away.",
    quote: "This flow dominates the species and energy transport in normal gravity fires.", cite: { label: "FLEX Research Requirements Document, PDF p.7", href: doc("flex-eird-v4", 7) },
    media: { id: "flex-1g-vs-microgravity", fit: "contain" as const, caption: "NASA's FLEX comparison. Bottom: on Earth (1 g) buoyancy stretches a droplet flame into a bright teardrop. Top: aboard the ISS the same kind of flame stays a dim sphere." } },
  { title: "In orbit, the flame becomes a sphere", body: "Remove buoyancy and an isolated fuel droplet burns inside a nearly spherical flame. That symmetry is what makes the classical d²-law testable: the square of the droplet diameter falls roughly linearly with time.",
    quote: "Schematic of a spherically symmetric droplet flame structure.", cite: { label: "Liu et al., 2G11-070HE-0310, PDF p.2", href: doc("2g11-070he-0310", 2) },
    action: { label: "Test the d²-law against FLEX data", href: `${ROUTES.extinction}#d2` },
    media: { id: "flex-heptane-soot-composite", caption: "A 3 mm heptane droplet burning in FLEX aboard the ISS. NASA's colorized composite of video frames: soot (green) forms near the shrinking droplet and spirals out of the flame zone." } },
  { title: "Slow transport changes how flames go out", body: "Oxygen now reaches the flame mainly by diffusion, and hot gas lingers near it. Radiative heat loss, minor in most small fires on Earth, becomes a real path to extinction.",
    quote: "In most small scale terrestrial fires … radiative quenching plays a relatively minor role in the extinguishment of fires.", cite: { label: "FLEX Research Requirements Document, PDF p.12", href: doc("flex-eird-v4", 12) },
    action: { label: "See where FLEX flames went out", href: `${ROUTES.extinction}#map` },
    media: { id: "sofie-gel-extinction", caption: "Related NASA experiment (SoFIE, 2023), not FLEX: as the pressure drops, a sooty yellow flame turns blue, shrinks and goes out. It shows what extinction looks like, not the radiative mechanism itself." } },
  { title: "Airflow decides how fire spreads", body: "On a spacecraft the only flow is the one ventilation makes. A flame spreading against a gentle forced flow slows as that flow weakens, and below some velocity it can go out. BASS-II and SAFFIRE-I burned samples in controlled opposed and concurrent flows.",
    quote: "The spread rate is known to decrease as the opposed flow is reduced. Under certain conditions, this can lead to flame extinguishment.", cite: { label: "BASS-II Summary Report, PDF p.27", href: doc("bass-ii-summary-report", 27) },
    action: { label: "Explore flame spread versus airflow", href: `${ROUTES.spread}#spread` },
    media: { id: "bass2-flame-gmt203", caption: "BASS-II aboard the ISS: an acrylic slab burned at several flow speeds. NASA's caption notes the flame was long and sooty at high flow and stabilized when the flow was reduced." } },
];

function StoryStep({ i, onActive }: { i: number; onActive: (i: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.6 });
  const s = STEPS[i];
  useEffect(() => {
    if (inView) onActive(i);
  }, [inView, i, onActive]);
  return (
    <div ref={ref} className="flex min-h-[auto] flex-col justify-center py-10 lg:min-h-[78vh]">
      <div className="mx-auto mb-6 w-full max-w-[320px] lg:hidden"><PhysicsFigure step={i} /></div>
      <Reveal>
        <p className="text-sm text-flame">Step {i + 1} of {STEPS.length}</p>
        <h3 className="display mt-2 text-[26px] md:text-[34px]">{s.title}</h3>
        <p className="mt-4 max-w-[58ch] text-[16.5px] leading-relaxed text-text-2">{s.body}</p>
        <blockquote className="mt-5 max-w-[58ch] border-l-2 border-data/50 pl-4 text-[14.5px] text-text-2">
          <p>&ldquo;{s.quote}&rdquo;</p>
          <footer className="mt-1.5 text-[13px]"><a href={s.cite.href} target="_blank" rel="noreferrer">{s.cite.label}</a></footer>
        </blockquote>
        {s.action && <Link href={s.action.href} className="mt-5 inline-flex items-center gap-1.5 text-[15px]">{s.action.label}<Icon name="chevron" size={14} /></Link>}
      </Reveal>
      {s.media && (
        <MediaFigure id={s.media.id} className={`mt-7 max-w-[560px] ${i % 2 ? "lg:ml-10" : ""}`} aspect="16 / 10" fit={s.media.fit ?? "cover"}
          sizes="(min-width: 1024px) 34vw, 92vw" caption={s.media.caption} />
      )}
    </div>
  );
}

function PhysicsStory() {
  const [active, setActive] = useState(0);
  const set = (i: number) => setActive((a) => (a === i ? a : i));
  return (
    <section id="physics" aria-labelledby="physics-title" className="scroll-mt-16 py-20 md:py-28">
      <Container>
        <SectionTitle id="physics-title" kicker="The physics" title="The physics of fire without gravity"
          lead="Four ideas explain why NASA burns fuel in orbit. Each is quoted from a NASA document in this workspace and shown with real NASA imagery; the sticky figure is a schematic, not data." />
        <div className="mt-6 grid gap-10 lg:grid-cols-[1fr_1fr] lg:gap-16">
          <div className="hidden lg:block">
            <div className="sticky top-[calc(var(--hdr,57px)+6vh)] flex h-[78vh] flex-col items-center justify-center">
              <PhysicsFigure step={active} />
              <ol className="mt-6 flex gap-2" aria-label="Story progress">
                {STEPS.map((s, i) => (
                  <li key={s.title}>
                    <span className={`block h-1.5 rounded-full transition-all duration-500 ${i === active ? "w-10 bg-flame" : "w-4 bg-line-strong"}`} />
                    <span className="sr-only">{s.title}{i === active ? " (current)" : ""}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-3 text-xs text-text-3">Schematic, not to scale</p>
            </div>
          </div>
          <div>{STEPS.map((_, i) => <StoryStep key={i} i={i} onActive={set} />)}</div>
        </div>
      </Container>
    </section>
  );
}

/* ---------------- C. Three scales ---------------- */

const GLYPH = ["droplet", "sample", "sheet"] as const;
const SCALE_MEDIA = [
  { id: "flex-1g-vs-microgravity", position: "50% 8%", note: "FLEX droplet flame aboard the ISS" },
  { id: "bass2-flame-gmt213", position: "60% 50%", note: "BASS-II flame aboard the ISS" },
  { id: "saffire1-hardware-cygnus", position: "50% 55%", note: "SAFFIRE-I flight hardware in Cygnus" },
];

function Scales({ ov }: { ov: Overview }) {
  const ref = useRef<HTMLDivElement>(null);
  const rich = useRichMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 85%", "center 45%"] });
  const fill = useTransform(scrollYProgress, [0, 1], [0, 1]);
  const inv = Object.fromEntries(ov.investigations.map((i) => [i.investigation_id, i]));
  return (
    <section id="scales" aria-labelledby="scales-title" className="relative scroll-mt-16 border-y border-line/60 bg-[linear-gradient(180deg,rgba(5,10,20,0.6),rgba(10,20,36,0.2))] py-20 md:py-28">
      <Container>
        <SectionTitle id="scales-title" kicker="Three scales" title="From a droplet to a spacecraft"
          lead="Droplet-scale combustion, material-scale combustion and spacecraft-scale fire are different physical regimes. SpaceFire analyzes each one on its own terms and never pools their measurements." />
        <div ref={ref} className="relative mt-14">
          <div className="relative mx-2 hidden h-12 md:block" aria-hidden>
            <div className="absolute inset-x-0 top-[30px] h-px bg-line-strong" />
            <motion.div className="absolute inset-x-0 top-[30px] h-px origin-left bg-gradient-to-r from-data via-electric to-flame"
              style={rich ? { scaleX: fill } : undefined} />
            {TICKS.map((t) => (
              <span key={t} className="absolute top-0 -translate-x-1/2 text-[11px] text-text-3" style={{ left: `${logX(t)}%` }}>
                {t >= 1000 ? "1 m" : t >= 10 ? `${t / 10} cm` : "1 mm"}
                <span className="mx-auto mt-1.5 block h-3 w-px bg-line-strong" />
              </span>
            ))}
            {SCALE_ITEMS.map((it) => (
              <span key={it.name} className="absolute top-[27px] h-[7px] rounded-full bg-data/80 shadow-[0_0_12px_rgba(79,209,232,0.6)]"
                style={{ left: `${logX(it.lo)}%`, width: `max(7px, ${logX(it.hi) - logX(it.lo)}%)` }} />
            ))}
          </div>
          <p className="mb-8 mt-2 hidden text-xs text-text-3 md:block">Logarithmic length scale, characteristic sample size. Nearly three orders of magnitude separate the droplet and the spacecraft sheet.</p>
          <Stagger className="grid gap-5 md:grid-cols-3">
            {PHENOMENA.map((p, k) => {
              const it = SCALE_ITEMS[k];
              const i = inv[p.inv];
              return (
                <StaggerItem as="article" key={p.inv} className="lift group relative flex flex-col overflow-hidden rounded-2xl border border-line/80 bg-panel/70 p-5 pt-0 hover:border-data/40">
                  <ScaleMedia k={k} />
                  <div className="flex items-start justify-between gap-3">
                    <ScaleGlyph kind={GLYPH[k]} />
                    <span className="mt-1 text-right text-[13px] text-text-3">{p.scale}<span className="block text-text-2">{it.label.split(",")[0]}</span></span>
                  </div>
                  <h3 className="subhead mt-3 text-[21px] leading-tight">
                    <Link href={p.href} className="text-text no-underline after:absolute after:inset-0 hover:no-underline">{p.title}</Link>
                  </h3>
                  <p className="mt-2 flex-1 text-sm text-text-2">{i?.description}</p>
                  <p className="mt-4 flex items-baseline gap-2"><span className="text-[30px] font-semibold leading-none text-data [font-stretch:115%]">{i ? <CountUp value={i.burns} /> : "—"}</span>
                    <span className="text-sm text-text-2">burn rows · {i?.documents ?? "—"} documents</span></p>
                  <div className="mt-4 flex items-center justify-between gap-2">
                    <SourceBadge source={p.source} inv={p.inv} link={false} size="sm" />
                    <span className="inline-flex items-center gap-1 text-sm text-flame transition-transform duration-300 group-hover:translate-x-1">Open<Icon name="chevron" size={14} /></span>
                  </div>
                  <p className="mt-3 text-[11.5px] text-text-3">Size: {it.label}. Source: {it.src}.</p>
                </StaggerItem>
              );
            })}
          </Stagger>
          <p className="mt-6 max-w-[90ch] text-sm text-text-3">{ov.caveat}</p>
        </div>
      </Container>
    </section>
  );
}

function ScaleMedia({ k }: { k: number }) {
  const sm = SCALE_MEDIA[k];
  const m = MEDIA_BY_ID[sm.id];
  const rich = useRichMotion();
  return (
    <div className="-mx-5 mb-4">
      <div className="relative h-44 overflow-hidden bg-black md:h-52">
        <MediaImage m={m} sizes="(min-width: 768px) 30vw, 92vw" className={`h-full w-full object-cover transition-transform duration-700 ${rich ? "group-hover:scale-[1.06]" : ""}`}
          style={{ objectPosition: sm.position }} />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-panel via-panel/10 to-transparent" />
        <span className="absolute left-3 top-3"><RelationBadge relation={m.relation} onMedia /></span>
      </div>
      <p className="relative z-10 px-5 pt-1.5 text-[11.5px] text-text-3">{sm.note}. <Credit m={m} /></p>
    </div>
  );
}

/* ---------------- D. Discovery highlights ---------------- */

// Context per investigation, chosen so no image repeats elsewhere on Mission Control.
const INSIGHT_MEDIA: Record<string, string> = { "PSI-69": "flex2-mdca-apparatus", "PSI-25": "bass1-flame-2013", "PSI-98": "saffire1-preflight-ceit" };

function InsightCard({ x, big }: { x: Insight; big?: boolean }) {
  const mid = INSIGHT_MEDIA[x.investigation_id];
  return (
    <StaggerItem as="article" className={`hairline-top flex flex-col rounded-2xl border p-5 md:p-6 ${big
      ? "border-electric/25 bg-[linear-gradient(155deg,rgba(91,140,255,0.10),rgba(16,30,51,0.85)_50%)] lg:col-span-2 lg:grid lg:grid-cols-[1fr_1.1fr] lg:gap-x-10" : "border-line/80 bg-panel/70"}`}>
      <div>
      <div className="flex flex-wrap items-center gap-2">
        <Prov kind={x.kind} />
        <span className="text-xs text-text-3">{PH[x.investigation_id]?.short ?? x.investigation_id} · {PH[x.investigation_id]?.source}{x.n ? `, n = ${x.n}` : ""}</span>
      </div>
      <h3 className={`subhead mt-3 leading-tight ${big ? "text-[28px] md:text-[36px]" : "text-[18px]"}`}>{x.title}</h3>
      {big && mid && (
        <MediaFigure id={mid} className="mt-5" aspect="16 / 10" compact sizes="(min-width: 1024px) 34vw, 92vw"
          caption={<>Context: {MEDIA_BY_ID[mid].title.charAt(0).toLowerCase() + MEDIA_BY_ID[mid].title.slice(1)} ({MEDIA_BY_ID[mid].investigation}). The finding comes from the data, not from this image.</>} />
      )}
      </div>
      <div className="flex flex-col">
      <p className={`mt-3 ${big ? "text-[17px] lg:mt-0" : "text-[14.5px]"} text-text`}>{x.text}</p>
      <p className="mt-2 flex-1 text-sm text-text-3">{x.caveat}</p>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <Link href={canonical(x.link)}>See the analysis</Link>
        {x.citations.filter((c) => c.document_id).map((c) => (
          <a key={c.label} href={doc(c.document_id!, c.page_pdf ?? 1)} target="_blank" rel="noreferrer">{c.label}</a>
        ))}
      </div>
      </div>
    </StaggerItem>
  );
}

function Insights({ ov }: { ov: Overview }) {
  const [first, ...rest] = ov.insights;
  return (
    <section aria-labelledby="ins-title" className="py-20 md:py-28">
      <Container>
        <SectionTitle id="ins-title" kicker="Discovery highlights" title="What the data says, recomputed"
          lead={<>Each finding is recalculated from the NASA files when the database is built, with its sample size, caveat and source. Labels show whether a statement is <Prov kind="COMPUTED" /> or taken from a <Prov kind="DOC" />.</>} />
        <Stagger className="mt-12 grid gap-5 lg:grid-cols-2">
          {first && <InsightCard x={first} big />}
          {rest.map((x) => <InsightCard key={x.id} x={x} />)}
        </Stagger>
      </Container>
    </section>
  );
}

/* ---------------- D2. Recorded in orbit ---------------- */

const ORBIT_MEDIA = ["bass-iss40-20140627", "saffire1-burn-animation", "bass2-flame-gmt213", "cfi-g-cool-flame-video", "bass2-msg-operations"];

function OrbitMedia() {
  return (
    <section aria-labelledby="orbit-title" className="relative overflow-hidden border-t border-line/60 py-20 md:py-28">
      <div aria-hidden className="absolute inset-x-0 top-0 -z-10 h-[520px] bg-[radial-gradient(60%_60%_at_50%_0%,rgba(91,140,255,0.10),transparent)]" />
      <Container>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionTitle id="orbit-title" kicker="Recorded in orbit" title="What these fires actually looked like"
            lead="Photographs and footage NASA published from the three investigations. Each says whether it is real experiment media or related context, and links to its original record. Images give context; the numbers come from the data." />
          <Reveal><LinkButton href={ROUTES.media} variant="secondary">Open the media gallery<Icon name="chevron" size={14} /></LinkButton></Reveal>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-6">
          <MediaFigure id={ORBIT_MEDIA[0]} className="md:col-span-4" aspect="16 / 9" sizes="(min-width: 768px) 62vw, 92vw" />
          <MediaFigure id={ORBIT_MEDIA[1]} className="md:col-span-2" aspect="4 / 5" fit="contain" sizes="(min-width: 768px) 30vw, 92vw" />
          <MediaFigure id={ORBIT_MEDIA[2]} className="md:col-span-2" aspect="4 / 3" sizes="(min-width: 768px) 30vw, 92vw" />
          <MediaFigure id={ORBIT_MEDIA[3]} className="md:col-span-2" aspect="16 / 9" sizes="(min-width: 768px) 30vw, 92vw" />
          <MediaFigure id={ORBIT_MEDIA[4]} className="md:col-span-2" aspect="4 / 3" sizes="(min-width: 768px) 30vw, 92vw" />
        </div>
      </Container>
    </section>
  );
}

/* ---------------- D2. Interactive 3D lab entry ---------------- */

const LAB_CARDS = [
  { scene: "flex", icon: "droplet", title: "Droplet Combustion", source: "FLEX", line: "A spherical flame around a fuel droplet, and the 1 g teardrop it becomes on Earth." },
  { scene: "bass", icon: "solid", title: "Flame Spread over Solids", source: "BASS-II", line: "A sample in the documented 7.6 × 7.6 × 17 cm flow duct, burning against or with the air." },
  { scene: "saffire", icon: "fire", title: "Spacecraft Fire Safety", source: "SAFFIRE-I", line: "A conceptual cutaway of the flow duct where a 0.4 × 0.94 m fabric sheet burned aboard Cygnus." },
] as const;

function LabBand() {
  return (
    <section aria-labelledby="lab-title" className="relative overflow-hidden border-t border-line/60 py-20 md:py-28">
      <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(50%_70%_at_85%_50%,rgba(255,138,61,0.08),transparent),radial-gradient(40%_60%_at_10%_40%,rgba(91,140,255,0.08),transparent)]" />
      <Container className="grid gap-10 lg:grid-cols-[minmax(0,420px)_1fr] lg:items-center lg:gap-14">
        <div>
          <SectionTitle id="lab-title" kicker="Interactive Combustion Lab" title="Take the experiments apart in 3D"
            lead="Rotate, zoom and select the parts of each experiment, switch gravity on and off, then put the picture next to real NASA records. The 3D views explain principles; every measured value stays in the evidence panel." />
          <Reveal className="mt-6 flex flex-wrap gap-3">
            <LinkButton href={ROUTES.lab} variant="primary" size="lg">Enter the lab<Icon name="chevron" size={14} /></LinkButton>
          </Reveal>
        </div>
        <Stagger className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
          {LAB_CARDS.map((c) => (
            <StaggerItem key={c.scene}>
              <Link href={`${ROUTES.lab}?scene=${c.scene}`}
                className="lift glow-flame hairline-top group flex h-full flex-col gap-3 rounded-2xl border border-line/80 bg-panel/80 p-5 text-text no-underline hover:border-flame/60 hover:no-underline">
                <span className="grid h-10 w-10 place-items-center rounded-xl border border-flame/40 bg-flame/10 text-flame"><Icon name={c.icon} size={20} /></span>
                <span className="subhead text-[18px]">{c.title}</span>
                <span className="text-[14px] leading-relaxed text-text-2">{c.line}</span>
                <span className="mt-auto flex items-center justify-between text-[12.5px] text-text-3">
                  <span>NASA {c.source}</span>
                  <span className="inline-flex items-center gap-1 text-link group-hover:underline">Open in 3D<Icon name="chevron" size={12} /></span>
                </span>
              </Link>
            </StaggerItem>
          ))}
        </Stagger>
      </Container>
    </section>
  );
}

/* ---------------- E. Interactive preview ---------------- */

function Preview() {
  const [fuel, setFuel] = useState<string>("");
  const map = useApi<{ points: FlexPoint[]; n_total: number; n_plotted: number; excluded: unknown[] }>(`/analytics/flex/map${qs({ fuel })}`);
  return (
    <section aria-labelledby="prev-title" className="border-y border-line/60 bg-void/40 py-20 md:py-28">
      <Container className="grid gap-10 lg:grid-cols-[minmax(0,380px)_1fr] lg:gap-14">
        <div>
          <SectionTitle id="prev-title" kicker="Try it" title="Where droplet flames went out" />
          <Reveal className="mt-5 flex flex-col gap-4 text-[15px] text-text-2">
            <p>Each point is one FLEX test: initial oxygen across, initial droplet diameter up. Color and shape give the recorded outcome.</p>
            <p>Switch to <b className="text-text">Methanol</b>: every test below about 0.175 O₂ ended in Extinction. At higher oxygen the outcomes overlap, so oxygen alone does not decide the result. &apos;Disruption&apos; is not defined in the local documents and may hide a censored outcome.</p>
            <p className="text-sm">Data: <a href={`/api/v1/documents/flex-dod/file`} target="_blank" rel="noreferrer">FLEX Description of Data</a> and the PSI-69 experimental table.</p>
            <div><LinkButton href={`${ROUTES.extinction}#map`} variant="primary">Open the full extinction analysis</LinkButton></div>
          </Reveal>
        </div>
        <Reveal className="min-w-0 rounded-2xl border border-line/80 bg-panel/90 p-4 md:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Fuel filter">
              {["", "Methanol", "Heptane"].map((f) => (
                <button key={f || "all"} onClick={() => setFuel(f)} aria-pressed={fuel === f}
                  className={`press rounded-full border px-3 py-1 text-sm ${fuel === f ? "border-flame bg-flame/15 text-text" : "border-line-strong text-text-2 hover:text-text"}`}>
                  {f || "Both fuels"}
                </button>
              ))}
            </div>
            <span className="text-sm text-text-3">{map.data ? `n = ${map.data.n_plotted} plotted of ${map.data.n_total} rows` : "Loading…"}</span>
          </div>
          <Loadable state={map} rows={8}>
            {(m) => (
              <>
                <FlexMapChart points={m.points} height={400} />
                <p className="mt-2 text-xs text-text-3">{fmt(m.excluded.length)} rows without a numeric D₀ are excluded. Click a point to open its source row.</p>
              </>
            )}
          </Loadable>
        </Reveal>
      </Container>
    </section>
  );
}

/* ---------------- F. Workflow ---------------- */

function Workflow({ ov }: { ov: Overview | null }) {
  const [i, setI] = useState(0);
  const c = ov?.counts;
  const steps = [
    { name: "Explore", icon: "experiments", text: `Filter ${c ? fmt(c.total_burn_rows) : "all"} experiment rows by fuel, oxygen, pressure, material or test outcome. Raw cells stay visible beside parsed values.`,
      not: "Each investigation keeps its own columns and units; rows are never merged across investigations.", href: ROUTES.explorer, cta: "Open the Combustion Explorer" },
    { name: "Analyze", icon: "model", text: "Open a phenomenon: extinction maps and the d²-law for droplets, gas balance and spread rate for solids, burn records and downlink timeline for the spacecraft fire.",
      not: "Every chart lists the rows it excluded and why.", href: ROUTES.extinction, cta: "Start with flame extinction" },
    { name: "Compare", icon: "compare", text: "Put 2–5 tests side by side, or find the nearest cases by initial conditions only, with a per-field explanation of the distance.",
      not: "Outcomes are never used to find similar cases, so similarity cannot leak the answer.", href: ROUTES.similar, cta: "Find similar experiments" },
    { name: "Verify evidence", icon: "documents", text: `Search ${c ? fmt(c.chunks) : "all"} passages from ${c ? c.documents : ""} NASA documents with page numbers, look up external papers, and check ${c ? fmt(c.quality_flags) : ""} data-quality flags.`,
      not: "Test-ID mentions carry their link confidence: verified table row, explicit mention, or a bare mention reviewed by hand against the report row.", href: ROUTES.documents, cta: "Search the evidence" },
  ];
  const s = steps[i];
  return (
    <section aria-labelledby="wf-title" className="py-20 md:py-28">
      <Container>
        <SectionTitle id="wf-title" kicker="How it works" title="Explore, analyze, compare, verify"
          lead="A research loop, not a chatbot: you move from raw records to computed results to the sources that support them." />
        <div className="mt-12 grid gap-6 lg:grid-cols-[minmax(0,360px)_1fr]">
          <div role="tablist" aria-label="Research workflow steps" className="relative flex flex-col gap-1.5">
            <span aria-hidden className="absolute bottom-9 left-[27px] top-9 w-px bg-line-strong" />
            {steps.map((st, k) => (
              <button key={st.name} role="tab" id={`wf-tab-${k}`} aria-selected={i === k} aria-controls="wf-panel" onClick={() => setI(k)}
                onKeyDown={(e) => { if (e.key === "ArrowDown" || e.key === "ArrowRight") setI((k + 1) % 4); if (e.key === "ArrowUp" || e.key === "ArrowLeft") setI((k + 3) % 4); }}
                tabIndex={i === k ? 0 : -1}
                className={`press relative flex items-center gap-4 rounded-xl px-3 py-3 text-left ${i === k ? "text-text" : "text-text-2 hover:bg-raised/40 hover:text-text"}`}>
                {i === k && <motion.span layoutId="wf-active" aria-hidden className="absolute inset-0 rounded-xl border border-flame/40 bg-flame/[0.07]" transition={{ duration: DUR.base, ease: EASE }} />}
                <span className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold ${i === k ? "border-flame bg-flame text-flame-ink" : "border-line-strong bg-ink text-text-2"}`}>{k + 1}</span>
                <span className="subhead relative z-10 text-[17px]">{st.name}</span>
              </button>
            ))}
          </div>
          <div id="wf-panel" role="tabpanel" aria-labelledby={`wf-tab-${i}`} className="hairline-top relative min-h-[260px] overflow-hidden rounded-2xl border border-line/80 bg-panel/80 p-6 md:p-8">
            <motion.div key={i} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: DUR.base, ease: EASE }}>
              <div className="flex items-center gap-3 text-flame"><Icon name={s.icon} size={22} /><span className="text-sm">Step {i + 1}</span></div>
              <h3 className="display mt-3 text-[28px]">{s.name}</h3>
              <p className="mt-3 max-w-[62ch] text-[16px] leading-relaxed text-text">{s.text}</p>
              <p className="mt-3 max-w-[62ch] text-sm text-text-3">{s.not}</p>
              <div className="mt-6"><LinkButton href={s.href} variant="secondary">{s.cta}</LinkButton></div>
            </motion.div>
          </div>
        </div>
      </Container>
    </section>
  );
}

/* ---------------- G. Copilot band ---------------- */

function CopilotBand() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const h = useApi<Health>("/health");
  const examples = [
    "Does 'Disruption' mean extinction in FLEX?",
    "How does BASS-II GMT differ from clock time?",
    "Does the SAFFIRE workbook contain flame-front measurements?",
  ];
  function go(e?: FormEvent, text?: string) {
    e?.preventDefault();
    const s = (text ?? q).trim();
    if (s) router.push(`${ROUTES.copilot}${qs({ q: s })}`);
  }
  return (
    <section aria-labelledby="cp-title" className="relative overflow-hidden border-t border-line/60 py-20 md:py-28">
      <div aria-hidden className="absolute left-1/2 top-0 -z-10 h-[420px] w-[900px] max-w-full -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(255,138,61,0.10),transparent)] blur-2xl" />
      <Container className="grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-center">
        <SectionTitle id="cp-title" kicker="Research Copilot" title="Ask the Research Copilot"
          lead={h.data?.llm.configured
            ? "It runs fixed data tools and searches the documents, then writes an answer in which every statement cites a source and every number must appear in it."
            : "It runs fixed data tools and searches the documents. AI synthesis is not configured here, so it returns the retrieved passages and computed results themselves, with their sources, and says so."} />
        <Reveal>
          <form onSubmit={go} className="hairline-top flex flex-col gap-3 rounded-2xl border border-line/80 bg-panel/85 p-5">
            <label htmlFor="rail-q" className="text-sm text-text-2">Your question</label>
            <textarea id="rail-q" rows={3} value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="e.g. Which FLEX methanol tests extinguished below 17.5 % O₂?" className={`${inputCls} resize-y`} />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-text-3">Answers cite NASA rows, document pages and papers.</span>
              <Button type="submit" variant="primary" disabled={!q.trim()}>Ask</Button>
            </div>
            <ul className="mt-1 flex flex-col gap-1.5 border-t border-line/70 pt-3">
              {examples.map((x) => (
                <li key={x}><button type="button" onClick={() => go(undefined, x)} className="text-left text-sm text-link hover:underline">{x}</button></li>
              ))}
            </ul>
          </form>
        </Reveal>
      </Container>
    </section>
  );
}

export default function OverviewView() {
  const ov = useApi<Overview>("/overview");
  return (
    <div className="flex flex-col">
      <Hero ov={ov.data} />
      <PhysicsStory />
      {ov.error || !ov.data ? (
        <Container className="py-16"><Loadable state={ov} rows={6}>{() => null}</Loadable></Container>
      ) : (
        <>
          <Scales ov={ov.data} />
          <Insights ov={ov.data} />
        </>
      )}
      <OrbitMedia />
      <LabBand />
      <Preview />
      <Workflow ov={ov.data} />
      <CopilotBand />
    </div>
  );
}

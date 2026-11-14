"use client";

// Home (Phase 8): a calm, visual first impression. Five sections: hero, three phenomena, 3D studios, Research Copilot,
// scientific trust. Detailed statistics, the physics story with document quotes, the FLEX preview chart and the
// workflow tabs now live on the pages they belong to (phenomenon pages, Methodology), not here.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Icon } from "@/components/icons";
import { JourneyCard, useJourney } from "@/components/journey";
import { Credit, MediaImage, RelationBadge } from "@/components/media";
import { DUR, EASE, motion, Parallax, Reveal, Stagger, StaggerItem, useRichMotion, useScroll, useTransform, WordReveal } from "@/components/motion";
import { Starfield } from "@/components/illustrations";
import { StartDemoButton } from "@/components/demo/DemoBar";
import { Button, inputCls, LinkButton } from "@/components/ui";
import { qs, useApi } from "@/lib/api";
import { journeyHref, type Topic } from "@/lib/journey";
import { ROUTES } from "@/lib/routes";
import { MEDIA_BY_ID } from "@/lib/scientific-media";
import type { MotionValue } from "motion/react";

type Health = { llm: { configured: boolean } };

function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-[1240px] px-4 md:px-8 ${className}`}>{children}</div>;
}

function SectionTitle({ kicker, title, lead, id }: { kicker: string; title: string; lead?: ReactNode; id?: string }) {
  return (
    <Reveal className="max-w-2xl">
      <p className="kicker">{kicker}</p>
      <h2 id={id} className="display mt-3 text-[30px] md:text-[42px]">{title}</h2>
      {lead && <p className="mt-4 text-[17px] leading-relaxed text-text-2">{lead}</p>}
    </Reveal>
  );
}

/* ---------------- A. Hero ---------------- */

const HERO_MEDIA = "bass2-flame-gmt214";

/**
 * Hero visual: a real BASS-II flame photographed aboard the ISS, composited full-bleed. The photograph is unaltered
 * apart from scaling; the fade into the page and the star field are decorative, as the caption says.
 */
function HeroMedia({ scale }: { scale?: MotionValue<number> }) {
  const m = MEDIA_BY_ID[HERO_MEDIA];
  const fade = "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.55) 22%, #000 46%), linear-gradient(to top, transparent 0%, #000 22%)";
  const fadeMobile = "linear-gradient(to bottom, #000 55%, transparent 100%)";
  return (
    <motion.figure className="relative -z-10 lg:absolute lg:inset-y-0 lg:right-0 lg:w-[66%]"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1.6, ease: EASE }}>
      <div className="relative h-[40vh] min-h-[240px] overflow-hidden lg:h-full">
        <motion.div className="h-full w-full [mask-image:var(--fade-m)] lg:[mask-image:var(--fade)] [-webkit-mask-composite:source-in] [mask-composite:intersect]"
          style={{ ...(scale ? { scale } : {}), ["--fade" as string]: fade, ["--fade-m" as string]: fadeMobile }}>
          <MediaImage m={m} sizes="(min-width: 1024px) 66vw, 100vw" eager className="h-full w-full object-cover object-[78%_50%]" />
        </motion.div>
      </div>
      <figcaption className="relative z-10 mx-4 -mt-6 flex flex-wrap items-center gap-2 text-[12px] text-text-3 lg:absolute lg:bottom-6 lg:right-8 lg:mx-0 lg:mt-0">
        <RelationBadge relation={m.relation} />
        <span>Real flame from NASA&apos;s BASS-II experiment aboard the ISS, 2014. Fade and stars are decorative. <Credit m={m} /></span>
      </figcaption>
    </motion.figure>
  );
}

function Hero() {
  const ref = useRef<HTMLElement>(null);
  const rich = useRichMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const contentY = useTransform(scrollYProgress, [0, 1], [0, -70]);
  const flameScale = useTransform(scrollYProgress, [0, 1], [1, 1.12]);
  return (
    <section ref={ref} aria-labelledby="hero-title" className="theme-dark dark-band relative isolate overflow-hidden">
      <Parallax speed={30} className="absolute inset-[-10%_0] -z-10 opacity-70"><Starfield count={90} /></Parallax>
      <HeroMedia scale={rich ? flameScale : undefined} />
      <Container className="grid items-center pb-14 pt-6 md:py-16 lg:min-h-[min(82vh,780px)] lg:py-20">
        <motion.div style={rich ? { y: contentY } : undefined} className="relative z-10 lg:max-w-[min(56%,640px)]">
          <WordReveal text="Understanding Fire Beyond Earth" className="display text-[clamp(34px,9.4vw,56px)] leading-[1] xl:text-[68px]" />
          <motion.p className="mt-6 max-w-[46ch] text-[18px] leading-relaxed text-text-2" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DUR.slow, ease: EASE, delay: 0.5 }}>
            Why does fire behave differently in space? Explore real NASA experiments, interactive 3D models and an AI research assistant that cites its sources.
          </motion.p>
          <motion.div className="mt-8 flex flex-wrap gap-3" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DUR.slow, ease: EASE, delay: 0.65 }}>
            <LinkButton href={journeyHref("choose", null)} variant="primary" size="lg">Start exploring</LinkButton>
            <LinkButton href="#explore" variant="quiet" size="lg">Explore on my own</LinkButton>
            <StartDemoButton />
          </motion.div>
          <motion.p className="mt-3 text-[13px] text-text-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: DUR.slow, delay: 0.8 }}>
            “Start exploring” is an optional seven-step guided journey; you can leave it at any time.
          </motion.p>
        </motion.div>
      </Container>
    </section>
  );
}

/* ---------------- B. Three phenomena ---------------- */

const PHENOMENA_CARDS: { topic: Topic; href: string; media: string; position: string; source: string; title: string; question: string }[] = [
  { topic: "flex", href: ROUTES.extinction, media: "flex-heptane-soot-composite", position: "50% 45%", source: "FLEX", title: "Droplet flames",
    question: "Why does a burning fuel droplet make a sphere of flame in orbit, and when does it go out?" },
  { topic: "bass", href: ROUTES.spread, media: "bass2-flame-gmt203", position: "55% 50%", source: "BASS-II", title: "Flame spread",
    question: "How does a flame creep across a solid when there is no gravity to carry heat upward?" },
  { topic: "saffire", href: ROUTES.spacecraft, media: "saffire1-hardware-cygnus", position: "50% 55%", source: "SAFFIRE-I", title: "Spacecraft fire",
    question: "What happens when a large fire is lit inside a real spacecraft?" },
];

/** The journey card and journey-aware links. Only this part reads the URL, so the rest of Home stays static. */
function JourneyExplore() {
  const journey = useJourney();
  const choosing = journey.step === "choose";
  return (
    <>
      {choosing && (
        <JourneyCard step="choose" topic={null} title="Choose a phenomenon" hideNext className="mt-8 max-w-3xl">
          <p>Pick one of the three experiments below. Each opens its 3D model, and the journey continues there.</p>
        </JourneyCard>
      )}
      <PhenomenaGrid choosing={choosing} />
    </>
  );
}

function ExplorePhenomena() {
  return (
    <section id="explore" aria-labelledby="explore-title" className="scroll-mt-16 py-20 md:py-28">
      <Container>
        <SectionTitle id="explore-title" kicker="Explore" title="Three ways fire behaves in space"
          lead="Each investigation burned something different aboard a spacecraft. Pick one to see it in 3D, with NASA's own data." />
        <Suspense fallback={<PhenomenaGrid choosing={false} />}>
          <JourneyExplore />
        </Suspense>
      </Container>
    </section>
  );
}

function PhenomenaGrid({ choosing }: { choosing: boolean }) {
  const rich = useRichMotion();
  return (
        <Stagger className="mt-12 grid gap-5 md:grid-cols-3">
          {PHENOMENA_CARDS.map((c) => {
            const m = MEDIA_BY_ID[c.media];
            return (
              <StaggerItem key={c.href} as="article">
                <Link href={choosing ? journeyHref("model", c.topic) : c.href} className="lift group flex h-full flex-col overflow-hidden rounded-2xl border border-line/60 bg-panel/60 text-text no-underline hover:border-flame/50 hover:no-underline" data-testid="phenomenon-card">
                  <div className="relative h-52 overflow-hidden bg-black">
                    <MediaImage m={m} sizes="(min-width: 768px) 30vw, 92vw" className={`h-full w-full object-cover transition-transform duration-700 ${rich ? "group-hover:scale-[1.05]" : ""}`}
                      style={{ objectPosition: c.position }} />
                    <span className="absolute left-3 top-3"><RelationBadge relation={m.relation} onMedia /></span>
                  </div>
                  <div className="flex flex-1 flex-col gap-2 p-5">
                    <p className="text-[12.5px] text-text-3">NASA {c.source}</p>
                    <h3 className="subhead text-[21px]">{c.title}</h3>
                    <p className="text-[15px] leading-relaxed text-text-2">{c.question}</p>
                    <span className="mt-auto inline-flex items-center gap-1 pt-2 text-[14px] text-flame">Explore {c.title.toLowerCase()}<Icon name="chevron" size={14} /></span>
                  </div>
                </Link>
                <p className="mt-1.5 px-1 text-[11.5px] text-text-3"><Credit m={m} /></p>
              </StaggerItem>
            );
          })}
        </Stagger>
  );
}

/* ---------------- C. Experience the science (3D studios) ---------------- */

function Studios() {
  const m = MEDIA_BY_ID["flex-1g-vs-microgravity"];
  return (
    <section id="studios" aria-labelledby="lab-title" className="border-y border-line/50 bg-void/30 py-20 md:py-28">
      <Container className="grid items-center gap-10 lg:grid-cols-[1fr_minmax(0,420px)] lg:gap-16">
        <div>
          <SectionTitle id="lab-title" kicker="Interactive 3D" title="Experience the science"
            lead="Every science page opens with a 3D model you can rotate and take apart. Switch gravity off, compare fuels, follow a guided tour, then check the picture against NASA's measurements." />
          <Reveal className="mt-7 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
            {PHENOMENA_CARDS.map((c, i) => (
              <LinkButton key={c.href} href={`${c.href}#studio`} variant={i === 0 ? "primary" : "secondary"}>Open the {c.title.toLowerCase()} model</LinkButton>
            ))}
          </Reveal>
          <p className="mt-5 max-w-[60ch] text-[13.5px] text-text-3">The 3D models explain ideas; they are not measurements. Each one says so on screen, and the measured values sit beside it.</p>
        </div>
        <Reveal>
          <figure className="mx-auto max-w-[300px]">
            <div className="overflow-hidden rounded-2xl border border-line/60 bg-black">
              <MediaImage m={m} sizes="300px" className="h-auto w-full" />
            </div>
            <figcaption className="mt-2 text-[13px] leading-snug text-text-2">
              <span className="mr-1.5"><RelationBadge relation={m.relation} /></span>
              A droplet flame aboard the ISS (top) and on Earth (bottom). The 3D model lets you switch between the two. <Credit m={m} />
            </figcaption>
          </figure>
        </Reveal>
      </Container>
    </section>
  );
}

/* ---------------- D. Ask scientific AI ---------------- */

function AskAI() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const h = useApi<Health>("/health");
  const howId = useId();
  const [how, setHow] = useState(false);
  const examples = [
    "Is the d²-law consistent with the reported FLEX burn times?",
    "How does airflow direction change flame spread in BASS-II?",
    "Does the SAFFIRE workbook contain flame-front measurements?",
  ];
  function ask(e: FormEvent) {
    e.preventDefault();
    const s = q.trim();
    if (s) router.push(`${ROUTES.copilot}${qs({ q: s })}`);   // explicit Ask: the Copilot answers this question
  }
  return (
    <section aria-labelledby="cp-title" className="py-20 md:py-28">
      <Container className="grid gap-10 lg:grid-cols-2 lg:items-start">
        <div>
          <SectionTitle id="cp-title" kicker="Research Copilot" title="Ask a scientific question"
            lead="The Copilot searches NASA's data and documents, and every statement in its answer points to a source." />
          {h.data && !h.data.llm.configured && (
            <p className="mt-4 text-[14px] text-warn">AI writing is off here, so the Copilot shows the evidence it finds rather than a written answer.</p>
          )}
          <button type="button" aria-expanded={how} aria-controls={howId} onClick={() => setHow(!how)} className="mt-5 text-[14px] text-link hover:underline">
            {how ? "Hide how it works" : "How it works"}
          </button>
          <div id={howId} hidden={!how} className="mt-3 max-w-[60ch] text-[14px] leading-relaxed text-text-2">
            <p>The Copilot runs fixed data tools (experiment lookups, the FLEX d²-law check, BASS-II gas balances) and searches the NASA documents. When AI writing is on, a model drafts an answer from that evidence only; code then checks that every statement cites a source and every number appears in it, and removes anything that fails. <Link href={`${ROUTES.methodology}#ai`}>Read the methodology</Link>.</p>
          </div>
        </div>
        <Reveal>
          <form onSubmit={ask} className="flex flex-col gap-3 rounded-2xl border border-line/60 bg-panel/60 p-5">
            <label htmlFor="rail-q" className="text-sm text-text-2">Your question</label>
            <textarea id="rail-q" rows={3} value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. Why are droplet flames spherical in microgravity?" className={`${inputCls} resize-y`} />
            <div className="flex justify-end"><Button type="submit" variant="primary" disabled={!q.trim()}>Ask</Button></div>
            <p className="mt-1 border-t border-line/50 pt-3 text-[13px] text-text-3">Or start from an example (opens the Copilot with the question ready to send):</p>
            <ul className="flex flex-col gap-1.5">
              {examples.map((x) => (
                <li key={x}><Link href={`${ROUTES.copilot}${qs({ draft: x })}`} className="text-[14px]">{x}</Link></li>
              ))}
            </ul>
          </form>
        </Reveal>
      </Container>
    </section>
  );
}

/* ---------------- E. Scientific trust ---------------- */

function Trust() {
  const items = [
    { icon: "documents", title: "Real NASA data", body: "Every value comes from NASA's FLEX, BASS-II and SAFFIRE-I files, with the original cells kept alongside." },
    { icon: "quality", title: "Linked to evidence", body: "Numbers and statements point to the data row, document page or paper they came from. Known data problems are flagged, not hidden." },
    { icon: "model", title: "Ideas vs measurements", body: "3D models and timelines are labelled as illustrations. Measured values are always shown separately, with their units." },
  ];
  return (
    <section aria-labelledby="trust-title" className="border-t border-line/50 py-20 md:py-24">
      <Container>
        <SectionTitle id="trust-title" kicker="Scientific trust" title="How you can trust what you see" />
        <ul className="mt-10 grid gap-6 md:grid-cols-3">
          {items.map((x) => (
            <li key={x.title} className="flex gap-3">
              <Icon name={x.icon} size={22} className="mt-0.5 shrink-0 text-data" />
              <div><h3 className="subhead text-[17px]">{x.title}</h3><p className="mt-1 text-[15px] leading-relaxed text-text-2">{x.body}</p></div>
            </li>
          ))}
        </ul>
        <div className="mt-8 flex flex-wrap gap-3">
          <LinkButton href={ROUTES.methodology} variant="secondary">View methodology</LinkButton>
          <LinkButton href={ROUTES.reliability} variant="quiet">See data reliability</LinkButton>
        </div>
      </Container>
    </section>
  );
}

export default function OverviewView() {
  return (
    <div className="flex flex-col">
      <Hero />
      <ExplorePhenomena />
      <Studios />
      <AskAI />
      <Trust />
    </div>
  );
}

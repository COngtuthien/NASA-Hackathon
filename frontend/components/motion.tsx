"use client";

// SpaceFire motion system. One easing family, three durations, all transform/opacity.
// MotionConfig reducedMotion="user" strips transform animation for people who ask for less motion;
// components below also short-circuit to their final state so nothing waits on an animation.
import {
  animate, motion, MotionConfig, useInView, useReducedMotion, useScroll, useTransform, type MotionValue,
} from "motion/react";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";

export const EASE = [0.16, 1, 0.3, 1] as const;          // expo-out: arrives fast, settles softly
export const EASE_IN_OUT = [0.65, 0, 0.35, 1] as const;
export const DUR = { fast: 0.16, base: 0.32, slow: 0.6, cinematic: 1.1 } as const;

export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user" transition={{ duration: DUR.base, ease: EASE }}>{children}</MotionConfig>;
}

const subscribeMq = (q: string) => (cb: () => void) => {
  const mq = window.matchMedia(q);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
/** SSR-safe media query (false on the server). */
export function useMedia(query: string): boolean {
  return useSyncExternalStore(subscribeMq(query), () => window.matchMedia(query).matches, () => false);
}

/** Large-motion effects (parallax, ambient loops) only where they are cheap and wanted. */
export function useRichMotion(): boolean {
  const reduce = useReducedMotion();
  const wide = useMedia("(min-width: 768px)");
  return !reduce && wide;
}

type RevealProps = {
  children: ReactNode; className?: string; delay?: number; y?: number; as?: "div" | "section" | "li" | "header" | "figure";
  id?: string; amount?: number;
};

/** Fade + rise once when the element approaches the viewport. Never replays. */
export function Reveal({ children, className, delay = 0, y = 18, as = "div", id, amount = 0.15 }: RevealProps) {
  const Tag = motion[as];
  return (
    <Tag id={id} className={className} initial={{ opacity: 0, y }} whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount, margin: "0px 0px -6% 0px" }} transition={{ duration: DUR.slow, ease: EASE, delay }}>
      {children}
    </Tag>
  );
}

const staggerParent = { hidden: {}, show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } } };
const staggerChild = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: DUR.slow, ease: EASE } } };

export function Stagger({ children, className, as = "div" }: { children: ReactNode; className?: string; as?: "div" | "ul" | "ol" }) {
  const Tag = motion[as];
  return (
    <Tag className={className} variants={staggerParent} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.1 }}>
      {children}
    </Tag>
  );
}

export function StaggerItem({ children, className, as = "div" }: { children: ReactNode; className?: string; as?: "div" | "li" | "article" }) {
  const Tag = motion[as];
  return <Tag className={className} variants={staggerChild}>{children}</Tag>;
}

/** Headline that rises word by word from behind a mask. Accessible name is the plain text. */
export function WordReveal({ text, className, delay = 0.1, as = "h1" }: { text: string; className?: string; delay?: number; as?: "h1" | "h2" }) {
  const Tag = as;
  const words = text.split(" ");
  return (
    <Tag className={className}>
      {words.map((w, i) => (
        <span key={i}>
          <span className="inline-block overflow-hidden pb-[0.08em] align-bottom">
            <motion.span className="inline-block" initial={{ y: "105%" }} animate={{ y: "0%" }}
              transition={{ duration: DUR.cinematic, ease: EASE, delay: delay + i * 0.09 }}>{w}</motion.span>
          </span>
          {i < words.length - 1 ? " " : ""}
        </span>
      ))}
    </Tag>
  );
}

/** Scroll-linked vertical drift for decorative layers. Static on small screens and with reduced motion. */
export function Parallax({ children, speed = 60, className }: { children: ReactNode; speed?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const rich = useRichMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [-speed, speed]);
  return (
    <motion.div ref={ref} className={className} style={rich ? { y } : undefined} aria-hidden>
      {children}
    </motion.div>
  );
}

/** Progress (0..1) of an element moving through the viewport, for scroll-driven figures. */
export function useSectionProgress(offset: ["start end" | "start start" | "start center", "end start" | "end end" | "end center"] = ["start end", "end start"]) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset });
  return { ref, progress: scrollYProgress as MotionValue<number> };
}

/**
 * Counts up to a real value once visible. The exact final value is always in the DOM (screen readers and
 * tests read it); the animated digits are presentation only.
 */
export function CountUp({ value, className, duration = 1.2, format = (n: number) => Math.round(n).toLocaleString("en-US") }: {
  value: number; className?: string; duration?: number; format?: (n: number) => string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const seen = useInView(ref, { once: true, amount: 0.6 });
  const reduce = useReducedMotion();
  const [shown, setShown] = useState<number | null>(null);
  useEffect(() => {
    if (!seen || reduce) return;
    const c = animate(0, value, { duration, ease: EASE, onUpdate: (v) => setShown(v) });
    return () => c.stop();
  }, [seen, reduce, value, duration]);
  const display = reduce || shown === null ? (seen || reduce ? format(value) : format(0)) : format(shown);
  return (
    <span ref={ref} className={className}>
      <span aria-hidden>{display}</span>
      <span className="sr-only">{format(value)}</span>
    </span>
  );
}

/** Adds data-paused while an element is off-screen so CSS ambient loops stop costing frames. */
export function usePauseOffscreen<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => el.toggleAttribute("data-paused", !e.isIntersecting), { rootMargin: "80px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return ref;
}

export { AnimatePresence, LayoutGroup } from "motion/react";
export { motion, useReducedMotion, useInView, useScroll, useTransform };

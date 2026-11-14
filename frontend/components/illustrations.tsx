"use client";

// Decorative, clearly labelled illustrations. None of these encode measurements: they depict textbook
// configurations (spherical droplet flame, opposed-flow spread, a fabric sheet in a flow duct).
import { useId, useMemo } from "react";
import { AnimatePresence, DUR, EASE, motion, usePauseOffscreen } from "@/components/motion";

// Rounded so server and client produce identical attribute strings (trig can differ in the last digits).
const q = (n: number) => Math.round(n * 10) / 10;

function makeStars(count: number, seed: number) {
  let st = seed;
  const rnd = () => ((st = (st * 1664525 + 1013904223) % 4294967296) / 4294967296);
  return Array.from({ length: count }, () => ({ x: q(rnd() * 1600), y: q(rnd() * 900), r: rnd() < 0.08 ? 1.6 : q(rnd() * 0.9 + 0.3), t: rnd() < 0.18 }));
}

/** Deterministic star field (seeded LCG) so server and client render the same SVG. */
export function Starfield({ count = 140, seed = 7, className = "" }: { count?: number; seed?: number; className?: string }) {
  const stars = useMemo(() => makeStars(count, seed), [count, seed]);
  return (
    <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" className={`h-full w-full ${className}`} aria-hidden>
      {stars.map((st, i) => (
        <circle key={i} cx={st.x} cy={st.y} r={st.r} fill={i % 11 === 0 ? "#FFD7B0" : "#CFE3FF"} opacity={st.t ? undefined : 0.55}
          className={st.t ? "anim-twinkle" : undefined} style={st.t ? { animationDelay: `${(i % 9) * 0.6}s` } : undefined} />
      ))}
    </svg>
  );
}

/** Hero: a spherical diffusion flame around a droplet, with orbital geometry. Layers animate independently. */
export function SphericalFlame({ className = "" }: { className?: string }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const ref = usePauseOffscreen<HTMLDivElement>();
  return (
    <div ref={ref} className={`relative aspect-square ${className}`} aria-hidden>
      <div className="absolute inset-[-18%] rounded-full bg-[radial-gradient(closest-side,rgba(91,140,255,0.28),rgba(79,209,232,0.08)_55%,transparent)] blur-2xl" />
      <div className="anim-orbit-rev absolute inset-0">
        <svg viewBox="0 0 400 400" className="h-full w-full">
          <ellipse cx="200" cy="200" rx="192" ry="70" fill="none" stroke="#5B8CFF" strokeOpacity="0.28" strokeWidth="1" transform="rotate(-28 200 200)" />
          <circle cx="368" cy="114" r="3" fill="#4FD1E8" />
          <circle cx="40" cy="282" r="2" fill="#5B8CFF" />
        </svg>
      </div>
      <div className="anim-orbit absolute inset-[6%]">
        <svg viewBox="0 0 400 400" className="h-full w-full">
          <ellipse cx="200" cy="200" rx="196" ry="118" fill="none" stroke="#4FD1E8" strokeOpacity="0.16" strokeDasharray="2 7" transform="rotate(34 200 200)" />
          <circle cx="352" cy="300" r="2.4" fill="#FFB547" />
        </svg>
      </div>
      <div className="anim-breathe absolute inset-[14%]">
        <svg viewBox="0 0 400 400" className="h-full w-full">
          <defs>
            <radialGradient id={`shell${id}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#050A14" stopOpacity="0" />
              <stop offset="46%" stopColor="#0A1424" stopOpacity="0.2" />
              <stop offset="56%" stopColor="#1E3A8A" stopOpacity="0.55" />
              <stop offset="63%" stopColor="#4FD1E8" stopOpacity="0.95" />
              <stop offset="67%" stopColor="#8FE6F5" stopOpacity="0.9" />
              <stop offset="72%" stopColor="#5B8CFF" stopOpacity="0.5" />
              <stop offset="86%" stopColor="#1E3A8A" stopOpacity="0.14" />
              <stop offset="100%" stopColor="#050A14" stopOpacity="0" />
            </radialGradient>
            <radialGradient id={`drop${id}`} cx="40%" cy="38%" r="62%">
              <stop offset="0%" stopColor="#FFE7CC" />
              <stop offset="45%" stopColor="#FFB547" />
              <stop offset="100%" stopColor="#C2541A" />
            </radialGradient>
            <radialGradient id={`vap${id}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FF8A3D" stopOpacity="0.32" />
              <stop offset="100%" stopColor="#FF8A3D" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="200" cy="200" r="198" fill={`url(#shell${id})`} />
          <circle cx="200" cy="200" r="96" fill="none" stroke="#FFB547" strokeOpacity="0.22" strokeDasharray="1.5 5" />
          <circle cx="200" cy="200" r="70" fill={`url(#vap${id})`} />
          <circle cx="200" cy="200" r="30" fill={`url(#drop${id})`} />
          <circle cx="190" cy="189" r="7" fill="#FFF4E6" opacity="0.55" />
        </svg>
      </div>
    </div>
  );
}

const ARROW = "M0 0 L-7 -4 L-7 4 Z";


/** Scroll-story figure: four schematic states, crossfaded. */
export function PhysicsFigure({ step }: { step: number }) {
  const ref = usePauseOffscreen<HTMLDivElement>();
  // Several figures can be on one page (one hidden by CSS); gradient ids must be unique or the hidden
  // copy's <defs> win and the visible figure renders without its gradients.
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const tear = `tear${uid}`, sph = `sph${uid}`;
  return (
    <div ref={ref} className="relative aspect-square w-full max-w-[460px]" role="img"
      aria-label={["Schematic: on Earth a flame is drawn upward by buoyant flow",
        "Schematic: in microgravity a droplet burns inside a spherical flame",
        "Schematic: oxygen diffuses inward, fuel vapor outward, heat radiates away",
        "Schematic: a flame spreads along a solid sample against a forced airflow"][step]}>
      <div className="absolute inset-0 rounded-full bg-[radial-gradient(closest-side,rgba(91,140,255,0.12),transparent)]" />
      <AnimatePresence mode="wait">
        <motion.svg key={step} viewBox="0 0 400 400" className="absolute inset-0 h-full w-full"
          initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.04 }}
          transition={{ duration: DUR.slow, ease: EASE }}>
          <defs>
            <linearGradient id={tear} x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#5B8CFF" stopOpacity="0.9" />
              <stop offset="28%" stopColor="#FFB547" />
              <stop offset="75%" stopColor="#FF8A3D" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#FF8A3D" stopOpacity="0" />
            </linearGradient>
            <radialGradient id={sph} cx="50%" cy="50%" r="50%">
              <stop offset="50%" stopColor="#4FD1E8" stopOpacity="0" />
              <stop offset="66%" stopColor="#4FD1E8" stopOpacity="0.9" />
              <stop offset="74%" stopColor="#5B8CFF" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#5B8CFF" stopOpacity="0" />
            </radialGradient>
          </defs>
          {step === 0 && (
            <g>
              <path d="M200 92 C 236 168 252 214 236 262 C 226 292 174 292 164 262 C 148 214 164 168 200 92 Z" fill={`url(#${tear})`} />
              <circle cx="200" cy="268" r="9" fill="#FFB547" />
              <rect x="196" y="276" width="8" height="54" rx="3" fill="#31496D" />
              {[150, 250].map((x) => (
                <g key={x} stroke="#A9B8CD" strokeOpacity="0.7" fill="none" strokeWidth="1.6">
                  <path d={`M${x} 300 C ${x} 230, ${x + (x < 200 ? 25 : -25)} 170, ${x + (x < 200 ? 30 : -30)} 90`} className="anim-flow" strokeDasharray="5 7" />
                </g>
              ))}
              <g fill="#A9B8CD"><path d={ARROW} transform="translate(180 90) rotate(-80)" /><path d={ARROW} transform="translate(220 90) rotate(-100)" /></g>
              <text x="40" y="60" fill="#8194AE" fontSize="14">g</text>
              <path d="M46 70 V 112" stroke="#8194AE" strokeWidth="1.5" /><path d={ARROW} transform="translate(46 116) rotate(90)" fill="#8194AE" />
            </g>
          )}
          {step >= 1 && step <= 2 && (
            <g>
              <circle cx="200" cy="200" r="150" fill={`url(#${sph})`} />
              <circle cx="200" cy="200" r="22" fill="#FFB547" />
              {step === 2 && (
                <g>
                  {[0, 60, 120, 180, 240, 300].map((a) => {
                    const r = (a * Math.PI) / 180;
                    const o = { x: q(200 + Math.cos(r) * 188), y: q(200 + Math.sin(r) * 188) };
                    const i = { x: q(200 + Math.cos(r) * 132), y: q(200 + Math.sin(r) * 132) };
                    const f0 = { x: q(200 + Math.cos(r + 0.5) * 34), y: q(200 + Math.sin(r + 0.5) * 34) };
                    const f1 = { x: q(200 + Math.cos(r + 0.5) * 84), y: q(200 + Math.sin(r + 0.5) * 84) };
                    return (
                      <g key={a}>
                        <line x1={o.x} y1={o.y} x2={i.x} y2={i.y} stroke="#4FD1E8" strokeWidth="1.6" strokeDasharray="4 5" className="anim-flow" />
                        <path d={ARROW} fill="#4FD1E8" transform={`translate(${i.x} ${i.y}) rotate(${a + 180})`} />
                        <line x1={f0.x} y1={f0.y} x2={f1.x} y2={f1.y} stroke="#FF8A3D" strokeWidth="1.6" />
                        <path d={ARROW} fill="#FF8A3D" transform={`translate(${f1.x} ${f1.y}) rotate(${a + 28.6})`} />
                      </g>
                    );
                  })}
                  <text x="70" y="392" fill="#4FD1E8" fontSize="13">→ O₂ diffuses in</text>
                  <text x="216" y="392" fill="#FFB547" fontSize="13">→ fuel vapor out</text>
                </g>
              )}
            </g>
          )}
          {step === 3 && (
            <g>
              <rect x="40" y="212" width="320" height="10" rx="2" fill="#31496D" />
              <rect x="40" y="212" width="150" height="10" rx="2" fill="#1A1410" />
              <path d="M190 212 C 196 186 214 176 238 190 C 222 196 214 204 212 212 Z" fill="#FF8A3D" opacity="0.9" />
              <path d="M190 222 C 196 248 214 258 238 244 C 222 238 214 230 212 222 Z" fill="#FF8A3D" opacity="0.9" />
              <path d="M196 212 C 200 196 212 190 226 196" fill="none" stroke="#5B8CFF" strokeWidth="2" />
              {[150, 180, 254, 284].map((y) => (
                <g key={y}>
                  <line x1="380" y1={y} x2="250" y2={y} stroke="#4FD1E8" strokeWidth="1.6" strokeDasharray="6 6" className="anim-flow" />
                  <path d={ARROW} fill="#4FD1E8" transform={`translate(248 ${y}) rotate(180)`} />
                </g>
              ))}
              <text x="268" y="136" fill="#4FD1E8" fontSize="13">forced airflow</text>
              <path d="M196 304 H 262" stroke="#FFB547" strokeWidth="1.6" /><path d={ARROW} fill="#FFB547" transform="translate(266 304)" />
              <text x="128" y="330" fill="#FFB547" fontSize="13">flame spreads into the flow</text>
              <text x="48" y="200" fill="#8194AE" fontSize="12">burned</text>
            </g>
          )}
        </motion.svg>
      </AnimatePresence>
    </div>
  );
}

/** Small glyph for a physical scale. */
export function ScaleGlyph({ kind }: { kind: "droplet" | "sample" | "sheet" }) {
  const gid = `g-${kind}${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <svg viewBox="0 0 120 120" className="h-24 w-24" aria-hidden>
      <defs>
        <radialGradient id={gid} cx="50%" cy="50%" r="50%">
          <stop offset="50%" stopColor="#4FD1E8" stopOpacity="0" />
          <stop offset="70%" stopColor="#4FD1E8" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#5B8CFF" stopOpacity="0" />
        </radialGradient>
      </defs>
      {kind === "droplet" && (<><circle cx="60" cy="60" r="40" fill={`url(#${gid})`} /><circle cx="60" cy="60" r="7" fill="#FFB547" /></>)}
      {kind === "sample" && (
        <>
          <rect x="18" y="56" width="84" height="8" rx="2" fill="#31496D" />
          <path d="M58 56 C 62 40 74 36 86 46 C 76 48 70 52 68 56 Z M58 64 C 62 80 74 84 86 74 C 76 72 70 68 68 64 Z" fill="#FF8A3D" />
          {[36, 84].map((y) => <line key={y} x1="114" y1={y} x2="92" y2={y} stroke="#4FD1E8" strokeWidth="1.5" strokeDasharray="3 3" />)}
        </>
      )}
      {kind === "sheet" && (
        <>
          <rect x="22" y="10" width="76" height="100" rx="3" fill="none" stroke="#31496D" strokeWidth="1.5" />
          <rect x="38" y="18" width="44" height="84" fill="#22324D" />
          <path d="M38 80 C 48 66 60 74 66 62 C 72 72 78 66 82 70 L 82 102 L 38 102 Z" fill="#FF8A3D" opacity="0.85" />
          <path d="M60 112 V 116" stroke="#4FD1E8" />
          {[30, 90].map((x) => <line key={x} x1={x} y1="114" x2={x} y2="94" stroke="#4FD1E8" strokeWidth="1.5" strokeDasharray="3 3" />)}
        </>
      )}
    </svg>
  );
}

/** Phenomenon page heroes. Loops pause off-screen and stop for reduced motion. */
export function PhenomenonArt({ kind, caption }: { kind: "droplet" | "spread" | "spacecraft"; caption: string }) {
  const ref = usePauseOffscreen<HTMLDivElement>();
  const gid = `pa-${kind}${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <figure ref={ref} className="relative mx-auto w-full max-w-[360px]">
      {/* space schematic: a dark stage in Light Mode (see .art-stage in globals.css) */}
      <div className="theme-dark art-stage relative aspect-[4/3]" aria-hidden>
        <div className="absolute inset-0 rounded-[40%] bg-[radial-gradient(closest-side,rgba(91,140,255,0.16),transparent)]" />
        <svg viewBox="0 0 360 270" className="absolute inset-0 h-full w-full">
          <defs>
            <radialGradient id={gid} cx="50%" cy="50%" r="50%">
              <stop offset="48%" stopColor="#4FD1E8" stopOpacity="0" />
              <stop offset="66%" stopColor="#4FD1E8" stopOpacity="0.85" />
              <stop offset="76%" stopColor="#5B8CFF" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#5B8CFF" stopOpacity="0" />
            </radialGradient>
          </defs>
          {kind === "droplet" && (
            <g className="anim-breathe" style={{ transformOrigin: "180px 135px", transformBox: "view-box" }}>
              <circle cx="180" cy="135" r="112" fill={`url(#${gid})`} />
              <circle cx="180" cy="135" r="16" fill="#FFB547" />
              <line x1="20" y1="135" x2="160" y2="135" stroke="#8194AE" strokeWidth="1" />
              <circle cx="180" cy="135" r="62" fill="none" stroke="#FFB547" strokeOpacity="0.25" strokeDasharray="2 5" />
            </g>
          )}
          {kind === "spread" && (
            <g>
              <rect x="30" y="128" width="300" height="12" rx="2" fill="#31496D" />
              <rect x="30" y="128" width="130" height="12" rx="2" fill="#160F0B" />
              <g className="anim-breathe" style={{ transformOrigin: "170px 134px", transformBox: "view-box" }}>
                <path d="M160 128 C 168 100 190 92 214 108 C 196 112 186 120 182 128 Z M160 140 C 168 168 190 176 214 160 C 196 156 186 148 182 140 Z" fill="#FF8A3D" />
                <path d="M166 128 C 172 110 186 104 204 112" fill="none" stroke="#5B8CFF" strokeWidth="2" />
              </g>
              {[80, 104, 164, 188].map((y) => (
                <g key={y}><line x1="350" y1={y} x2="232" y2={y} stroke="#4FD1E8" strokeWidth="1.5" strokeDasharray="6 6" className="anim-flow" />
                  <path d={ARROW} fill="#4FD1E8" transform={`translate(230 ${y}) rotate(180)`} /></g>
              ))}
            </g>
          )}
          {kind === "spacecraft" && (
            <g>
              <rect x="96" y="14" width="168" height="242" rx="8" fill="none" stroke="#31496D" strokeWidth="2" />
              <rect x="128" y="34" width="104" height="202" fill="#1C2A42" />
              <g className="anim-breathe" style={{ transformOrigin: "180px 200px", transformBox: "view-box" }}>
                <path d="M128 196 C 146 168 160 186 172 160 C 184 182 198 164 214 176 C 222 170 228 176 232 180 L 232 236 L 128 236 Z" fill="#FF8A3D" opacity="0.85" />
                <path d="M128 196 C 146 168 160 186 172 160 C 184 182 198 164 214 176 C 222 170 228 176 232 180" fill="none" stroke="#FFB547" strokeWidth="2" />
              </g>
              {[110, 250].map((x) => (
                <g key={x}><line x1={x} y1="262" x2={x} y2="40" stroke="#4FD1E8" strokeWidth="1.5" strokeDasharray="6 6" className="anim-flow" />
                  <path d={ARROW} fill="#4FD1E8" transform={`translate(${x} 36) rotate(-90)`} /></g>
              ))}
            </g>
          )}
        </svg>
      </div>
      <figcaption className="mt-2 text-center text-xs text-text-3">{caption}</figcaption>
    </figure>
  );
}

// Scientific glossary (Phase 9): short plain-language definitions for terms that recur across SpaceFire. Caveats
// that matter for interpretation are kept with the definition. Sources are local NASA documents or SpaceFire pages.

export type GlossaryEntry = { id: string; term: string; short: string; caveat?: string; source?: { label: string; href: string; external?: boolean } };

const doc = (id: string, page: number, label: string) => ({ label, href: `/api/v1/documents/${id}/file#page=${page}`, external: true });

export const GLOSSARY: GlossaryEntry[] = [
  { id: "microgravity", term: "Microgravity",
    short: "The near-weightless condition in orbit. Objects still feel gravity, but everything falls together, so hot gas does not rise and buoyancy almost disappears.",
    caveat: "Small residual accelerations and forced airflow can still shape a flame." },
  { id: "diffusion-flame", term: "Diffusion flame",
    short: "A flame where fuel and oxygen start apart and meet by mixing (diffusing) into each other, burning where they meet. Candle and droplet flames are diffusion flames.",
    source: doc("2g11-070he-0310", 2, "Liu et al. 2013, PDF p.2") },
  { id: "flame-extinction", term: "Flame extinction",
    short: "The moment a flame goes out, for example when the droplet becomes too small or there is too little oxygen to sustain it.",
    caveat: "In FLEX, the visible flame can go out while an invisible ‘cool flame’ keeps burning n-heptane." },
  { id: "flame-spread", term: "Flame spread",
    short: "How a flame moves across the surface of a solid material, heating unburned material ahead of it until it ignites.",
    caveat: "Measured BASS-II spread rates exist only where NASA tracked the flame on video (Summary Report Table 5.1).",
    source: doc("bass-ii-summary-report", 27, "BASS-II Summary Report, PDF p.27") },
  { id: "opposed-flow", term: "Opposed flow",
    short: "Airflow that moves against the direction the flame spreads. The flame creeps upstream into fresh air.",
    source: doc("bass-ii-summary-report", 27, "BASS-II Summary Report, PDF p.27") },
  { id: "concurrent-flow", term: "Concurrent flow",
    short: "Airflow that moves in the same direction as the flame spreads, carrying hot gas ahead of the flame.",
    caveat: "SAFFIRE-I burn S1 spread with the airflow (concurrent), S2 against it (opposed)." },
  { id: "burning-rate-constant", term: "Burning-rate constant (K)",
    short: "How fast a droplet's surface area shrinks while it burns: the slope of diameter squared over time, in mm²/s.",
    caveat: "The FLEX CSV header says ‘mm’; SpaceFire reads the values as mm²/s (flag FLEX-UNIT-K) and keeps the raw header.",
    source: doc("2g11-070he-0310", 2, "Liu et al. 2013, PDF p.2") },
  { id: "d2-law", term: "d²-law",
    short: "The classical result that a burning droplet's diameter squared falls linearly with time: D² = D₀² − K·t.",
    caveat: "SpaceFire uses it only as a consistency check against reported burn times, not as a validated prediction.",
    source: doc("2g11-070he-0310", 2, "Liu et al. 2013, PDF p.2") },
  { id: "soot", term: "Soot",
    short: "Tiny carbon particles formed in fuel-rich parts of a flame. They glow yellow-orange and radiate heat away.",
    caveat: "n-Heptane is sooting; methanol is essentially non-sooting (FLEX ERD v4, p.36).",
    source: doc("flex-eird-v4", 36, "FLEX ERD v4, PDF p.36") },
  { id: "nasa-evidence", term: "NASA Evidence",
    short: "Values recorded in NASA's data files and documents, shown exactly as stored, with units, provenance and quality flags.",
    caveat: "Photographs are context: NASA's captions name no test numbers, so no image is evidence for a specific test." },
  { id: "conceptual-visualization", term: "Conceptual visualization",
    short: "A drawing or 3D model that explains an idea or an arrangement. Its shapes, colours and motion are not computed from data.",
    caveat: "It is not a simulation of any test." },
];

export const GLOSSARY_BY_ID: Record<string, GlossaryEntry> = Object.fromEntries(GLOSSARY.map((g) => [g.id, g]));

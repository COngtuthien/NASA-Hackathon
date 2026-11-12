// Scientific trust model for the Interactive Combustion Lab (Phase 6).
// Every statement shown next to a 3D scene is one of: a NASA measurement (shown in the evidence panel, never baked
// into geometry), a documented qualitative principle (with its source page), or an assumed illustrative choice.
// Sources below are local NASA documents already ingested by the backend (served at /api/v1/documents/{id}/file).

export type Basis = "confirmed" | "documented-principle" | "illustrative";

export const BASIS_LABEL: Record<Basis, { label: string; note: string; cls: string }> = {
  confirmed: { label: "Confirmed", note: "Feature or value stated in a NASA source document or data file", cls: "border-data/60 text-data" },
  "documented-principle": { label: "Documented principle", note: "Qualitative behaviour described in a NASA source; not a measurement of this test", cls: "border-link/60 text-link" },
  illustrative: { label: "Illustrative", note: "Assumed shape, size or position chosen for legibility; not from a source", cls: "border-dashed border-text-3 text-text-3" },
};

export type SourceRef = { label: string; href: string; external?: boolean };

const doc = (id: string, page: number | null, label: string): SourceRef => ({
  label, href: `/api/v1/documents/${id}/file${page ? `#page=${page}` : ""}`, external: true,
});

export const SOURCES = {
  liuP2: doc("2g11-070he-0310", 2, "Liu et al. 2013, PDF p.2 (spherical droplet flame structure, d²-law)"),
  liuP4: doc("2g11-070he-0310", 4, "Liu et al. 2013, PDF p.4 (MDCA droplet deployment and ignition)"),
  flexEird74: doc("flex-eird-v4", 74, "FLEX ERD v4, PDF p.74 (earlier quiescent and forced-flow droplet experiments)"),
  coolFlames: doc("cool-flames-in-space-a-hot-prospect-on-earth", 23, "Cool Flames in Space, PDF p.23 (cool-flame burning after extinction)"),
  bassP12: doc("bass-ii-summary-report", 12, "BASS-II Summary Report, PDF p.12 (flow duct, fan, flow straightener, radiometer)"),
  bassP13: doc("bass-ii-summary-report", 13, "BASS-II Summary Report, PDF p.13 (sample geometries, igniter, cameras)"),
  bassP27: doc("bass-ii-summary-report", 27, "BASS-II Summary Report, PDF p.27 (spread rate falls as opposed flow is reduced)"),
  bassP64: doc("bass-ii-summary-report", 64, "BASS-II Summary Report, PDF p.64 (Table 5.1 setup: opposed flow, 3–20 cm/s)"),
  saffireIsa: doc("saffire-1-isatab", null, "SAFFIRE-I ISA-Tab metadata (sample card, flow duct, fans, sensors)"),
  saffireOps: doc("saffire-i-operations", 1, "SAFFIRE-I Operations, PDF p.1 (~0.4 m × 0.94 m sample, flow duct inlet/outlet)"),
  saffireDod: doc("saffire-i-and-saffire-iii-dod", null, "SAFFIRE-I/III Description of Data (20 cm/s flow, SIBAL fabric, cameras C1/C2)"),
  psi69: { label: "NASA PSI investigation PSI-69 (FLEX)", href: "https://psi.nasa.gov/physci/repo/data/investigations/PSI-69", external: true },
  psi25: { label: "NASA PSI investigation PSI-25 (BASS-II)", href: "https://psi.nasa.gov/physci/repo/data/investigations/PSI-25", external: true },
  psi98: { label: "NASA PSI investigation PSI-98 (SAFFIRE-I)", href: "https://psi.nasa.gov/physci/repo/data/investigations/PSI-98", external: true },
} satisfies Record<string, SourceRef>;

/** The two visualization modes the lab exposes. A third, "Validated model", is deliberately absent (see docs). */
export const MODES = {
  conceptual: {
    label: "Conceptual 3D",
    banner: "Conceptual visualization — not measured NASA output.",
    note: "Controls change the illustration only. Shapes, colours and motion explain a principle or an arrangement; they are not computed from data.",
  },
  evidence: {
    label: "NASA Evidence",
    banner: "NASA Evidence — measured values are in the panel; 3D geometry stays illustrative unless marked as measured.",
    note: "Inspect a real experiment record. The panel shows the values exactly as NASA recorded them, with units, provenance and caveats.",
  },
} as const;

export type Mode = keyof typeof MODES;

/** Why there is no "Validated model" mode (shown in the explanation panel and the docs). */
export const NO_VALIDATED_MODEL =
  "No validated model mode is offered. SpaceFire's d²-law calculation is a consistency check against reported burn times (median ratio and spread are on the Flame Extinction page), not a model validated to predict a burn; nothing here predicts extinction, temperature, burn time or spread rate.";

/** FLEX burning-rate unit convention (shared with the backend verifier's UNIT_RULES). */
export const FLEX_K_UNIT = {
  unit: "mm²/s",
  rawHeader: "Burning rate; mm",
  note: "The CSV header says 'mm', which is dimensionally inconsistent with a d²-law burning-rate constant; SpaceFire interprets the value as mm²/s (dataset flag FLEX-UNIT-K). The raw header is kept.",
};

// Phase 3 information architecture. Pages are named by phenomenon; NASA investigations are attribution.
// Old URLs keep working through redirects in next.config.ts (LEGACY_REDIRECTS); canonical() maps links that
// still arrive in the old form (for example from backend payloads) so the UI never takes a redirect hop.

export const ROUTES = {
  mission: "/",
  copilot: "/copilot",
  explorer: "/experiments",
  extinction: "/phenomena/flame-extinction",
  spread: "/phenomena/flame-spread",
  spacecraft: "/phenomena/spacecraft-fire",
  similar: "/intelligence/similar",
  compare: "/intelligence/compare",
  documents: "/evidence",
  literature: "/evidence/literature",
  media: "/evidence/media",
  modeling: "/modeling",
  reliability: "/reliability",
  methodology: "/methodology",
} as const;

export const LEGACY: [string, string][] = [
  ["/assistant", ROUTES.copilot],
  ["/physics/flex", ROUTES.extinction],
  ["/physics/bass-ii", ROUTES.spread],
  ["/physics/saffire-i", ROUTES.spacecraft],
  ["/similar", ROUTES.similar],
  ["/compare", ROUTES.compare],
  ["/research", ROUTES.literature],
  ["/ml/flex", ROUTES.modeling],
  ["/quality", ROUTES.reliability],
];

/** Map a legacy in-app href (path + optional ?query / #hash) to its Phase 3 route. */
export function canonical(href: string): string {
  const m = href.match(/^([^?#]*)(.*)$/);
  if (!m) return href;
  const [, path, rest] = m;
  const hit = LEGACY.find(([old]) => path === old);
  return hit ? hit[1] + rest : href;
}

/** The phenomenon each NASA investigation supports (dataset names stay as source badges). */
export const PHENOMENA = [
  { inv: "PSI-69", dataset: "flex", source: "FLEX", href: ROUTES.extinction, title: "Flame Extinction & Burning Dynamics",
    short: "Flame extinction", scale: "Droplet scale", system: "Liquid fuel droplets" },
  { inv: "PSI-25", dataset: "bass2", source: "BASS-II", href: ROUTES.spread, title: "Flame Spread & Material Behavior",
    short: "Flame spread", scale: "Material scale", system: "Solid material samples" },
  { inv: "PSI-98", dataset: "saffire1", source: "SAFFIRE-I", href: ROUTES.spacecraft, title: "Spacecraft Fire Dynamics",
    short: "Spacecraft fire", scale: "Spacecraft scale", system: "Large fabric sheet" },
] as const;

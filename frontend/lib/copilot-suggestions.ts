// Contextual Research Copilot suggestions (Phase 9). Each suggestion names its investigation, stays short, and opens
// the Copilot with a *draft* (never `q`, which would ask immediately). A selected record adds only its identifier and
// UID; conceptual 3D settings are never included, so they cannot be mistaken for NASA data.
import { ROUTES } from "@/lib/routes";

export type Inv = "PSI-69" | "PSI-25" | "PSI-98";
export type Suggestion = { text: string; href: string };
export type SuggestionContext = {
  inv: Inv;
  record?: { uid: string; label: string } | null;
  media?: { title: string } | null;
  from?: "page" | "record" | "chart" | "media" | "journey";
};

export const MAX_SUGGESTION = 300;
const SOURCE: Record<Inv, string> = { "PSI-69": "FLEX", "PSI-25": "BASS-II", "PSI-98": "SAFFIRE-I" };

const BASE: Record<Inv, string[]> = {
  "PSI-69": [
    "Why can a droplet flame become nearly spherical in microgravity?",
    "Is the d²-law consistent with the reported FLEX burn times?",
    "Why can an n-heptane droplet keep burning as a cool flame after the visible flame goes out?",
  ],
  "PSI-25": [
    "How does airflow direction affect flame spread over solid materials?",
    "Which BASS-II tests have measured spread rates in the Summary Report?",
    "How much CO₂ is produced per O₂ consumed in the BASS-II PMMA tests?",
  ],
  "PSI-98": [
    "Why is large-scale spacecraft fire testing important?",
    "How did the S1 and S2 burns differ in flow direction and burn time?",
    "Does the SAFFIRE-I data contain flame-front measurements?",
  ],
};

/** Adds the investigation when the question does not already name it, so the Copilot gets an unambiguous scope. */
function scoped(q: string, inv: Inv): string {
  const src = SOURCE[inv];
  return q.includes(src) ? q : `${q.replace(/\?$/, "")} (NASA ${src}, ${inv})?`;
}

function href(text: string, ctx: SuggestionContext): string {
  const p = new URLSearchParams({ draft: text.slice(0, MAX_SUGGESTION), inv: ctx.inv, from: ctx.from ?? "page" });
  if (ctx.record) p.set("uid", ctx.record.uid);
  return `${ROUTES.copilot}?${p.toString()}`;
}

export function suggestions(ctx: SuggestionContext, max = 3): Suggestion[] {
  const out: string[] = [];
  const src = SOURCE[ctx.inv];
  if (ctx.record) {
    out.push(`What do the NASA ${src} sources say about test ${ctx.record.label}, and how does it compare with similar tests?`);
    if (ctx.inv === "PSI-69") out.push(`Why did ${src} test ${ctx.record.label} end the way it did?`);
    if (ctx.inv === "PSI-25") out.push(`Which values for ${src} test ${ctx.record.label} differ between the CSV and the Summary Report?`);
  }
  if (ctx.media) out.push(`What does the NASA image “${ctx.media.title}” show about ${src}, and what can it not show?`);
  for (const q of BASE[ctx.inv]) out.push(scoped(q, ctx.inv));
  return [...new Set(out)].slice(0, max).map((t) => ({ text: t.slice(0, MAX_SUGGESTION), href: href(t, ctx) }));
}

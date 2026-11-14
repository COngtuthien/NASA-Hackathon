// Visual evidence comparison (Phase 9): which verified NASA media sit beside each 3D studio, and how each one relates
// to what the visitor is looking at. Only registry media of the investigation itself are offered (relation
// "experimental"; never BASS (I) media for BASS-II, never related-experiment media). No NASA caption names a test,
// so `fit` always says how the image relates to the selection instead of implying it shows that test.
import { MEDIA_BY_ID, type ScientificMedia } from "@/lib/scientific-media";
import type { SceneId } from "@/lib/lab-models";

export type CompareContext = { fuel?: string | null; sample?: string | null; recordLabel?: string | null };
export type CompareOption = { media: ScientificMedia; label: string; fit: string };

const INV: Record<SceneId, ScientificMedia["investigation"]> = { flex: "FLEX", bass: "BASS-II", saffire: "SAFFIRE-I" };

const OPTIONS: Record<SceneId, { id: string; label: string }[]> = {
  flex: [{ id: "flex-heptane-soot-composite", label: "Burning droplet" }, { id: "flex-1g-vs-microgravity", label: "Earth vs orbit" }],
  bass: [{ id: "bass2-flame-gmt203", label: "Slab flame" }, { id: "bass2-flame-gmt214", label: "Rod flame" }, { id: "bass2-msg-operations", label: "Glovebox" }],
  saffire: [{ id: "saffire1-hardware-cygnus", label: "Flight unit" }, { id: "saffire1-burn-animation", label: "Burn footage" }, { id: "saffire1-preflight-ceit", label: "Before flight" }],
};

/** What the 3D model and the NASA media differ on. Short, and the same whatever is selected. */
export const DIFFERENCES: Record<SceneId, string[]> = {
  flex: [
    "The 3D flame is a smooth shell at an assumed distance from the droplet; the NASA image is a processed composite of video frames, with soot in false colour.",
    "Neither picture gives a flame radius. Measured sizes are the record's initial and extinction diameters.",
    "NASA's captions name no test number, so no image is a picture of the selected test.",
  ],
  bass: [
    "The 3D flame and flame front are illustrative; the photograph is a real BASS-II flame, but its caption gives no test number.",
    "Spread rates come only from Summary Report Table 5.1, never from the animation or a photograph.",
    "BASS (I) images from the earlier campaign are never shown as BASS-II.",
  ],
  saffire: [
    "Component positions and the duct cross-section in 3D are illustrative; the photograph shows the closed flight unit, and the burn happened inside it.",
    "NASA's footage is a selection of frames: its playback rate is not the burn rate.",
    "The local manifest lists file names and times only, with no pixels, so nothing in 3D is reconstructed from it.",
  ],
};

function fitFor(scene: SceneId, id: string, ctx: CompareContext): string {
  const rec = ctx.recordLabel ? `test ${ctx.recordLabel}` : "the selection";
  if (scene === "flex") {
    if (id === "flex-heptane-soot-composite") {
      return ctx.fuel === "Methanol"
        ? `Shows an n-heptane droplet. ${ctx.recordLabel ? `Test ${ctx.recordLabel}` : "Your selection"} burned methanol, and no verified NASA image names a methanol FLEX droplet.`
        : "A FLEX n-heptane droplet, as NASA published it; not tied to any test number.";
    }
    return "NASA's FLEX comparison of a flame in orbit and on Earth; it does not state its fuel or test.";
  }
  if (scene === "bass") {
    if (id === "bass2-msg-operations") return "BASS-II operations in the glovebox: apparatus context, no flame.";
    const shown = id === "bass2-flame-gmt214" ? "rod" : "slab";
    if (!ctx.sample) return `A real BASS-II ${shown} flame; NASA's caption gives no test number.`;
    return ctx.sample === shown
      ? `A real BASS-II ${shown} flame, the same sample type as ${rec}; not a photo of that test.`
      : `Investigation-level image of a ${shown} sample; ${rec} used a ${ctx.sample.replace("-", " ")}, which has no verified NASA photograph here.`;
  }
  if (id === "saffire1-burn-animation") return "NASA's published footage of the real Saffire-I burn (loads only when you press play).";
  if (id === "saffire1-preflight-ceit") return "The flight unit before launch: hardware context, no flame.";
  return "NASA's photograph of the Saffire-I flight unit in Cygnus: hardware context, no flame.";
}

/** Ordered options for a studio, best match first, each with its relation to the current selection. */
export function compareOptions(scene: SceneId, ctx: CompareContext = {}): CompareOption[] {
  const list = OPTIONS[scene].map((o) => ({ ...o, media: MEDIA_BY_ID[o.id] }))
    .filter((o) => o.media && o.media.investigation === INV[scene] && o.media.relation === "experimental");
  if (scene === "bass" && ctx.sample === "rod") list.sort((a, b) => (a.id === "bass2-flame-gmt214" ? -1 : b.id === "bass2-flame-gmt214" ? 1 : 0));
  if (scene === "flex" && ctx.fuel === "Methanol") list.reverse();   // the fuel-neutral comparison first
  return list.map((o) => ({ media: o.media, label: o.label, fit: fitFor(scene, o.id, ctx) }));
}

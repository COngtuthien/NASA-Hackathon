// "Ask AI about this": builds a Research Copilot link with a drafted question. The Copilot pre-fills the draft and
// waits for the visitor to press Ask, so no model request is ever sent by a 3D click. Only bounded, factual context
// travels: the investigation, the named component and (optionally) one experiment UID. Conceptual slider positions
// are never included, so they cannot be mistaken for NASA data.
import type { LabComponent, LabScene } from "@/lib/lab-models";
import { ROUTES } from "@/lib/routes";

export const MAX_DRAFT = 400;

export function draftQuestion(scene: LabScene, component: LabComponent | null, record: { uid: string; label: string } | null): string {
  const topic = component ? component.askAbout : `${scene.title.toLowerCase()} in this investigation`;
  let q = `What do the NASA ${scene.source} (${scene.inv}) sources say about ${topic}?`;
  if (record) q += ` Use test ${record.label} (${record.uid}) as context where relevant.`;
  return q.slice(0, MAX_DRAFT);
}

export function copilotHref(scene: LabScene, component: LabComponent | null, record: { uid: string; label: string } | null): string {
  const p = new URLSearchParams({ draft: draftQuestion(scene, component, record), inv: scene.inv, from: "lab" });
  if (record) p.set("uid", record.uid);
  if (component) p.set("topic", component.label);
  return `${ROUTES.copilot}?${p.toString()}`;
}

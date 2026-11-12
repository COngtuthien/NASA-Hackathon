"use client";

// "Compare with NASA" (Phase 9): shown beside the live 3D viewport (the same single canvas, no second WebGL context).
// Left: the conceptual model. Right: verified NASA media of the same investigation, how that media relates to the
// selection, the selected test's recorded values with their warnings, and what differs between model and evidence.
// Video and animation load only when the visitor presses play.
import { useState } from "react";
import { AskSuggestions } from "@/components/ask-suggestions";
import { MediaFigure } from "@/components/media";
import { RecordFacts } from "@/components/record-facts";
import { Segmented } from "@/components/ui";
import type { Inv } from "@/lib/copilot-suggestions";
import { compareOptions, DIFFERENCES } from "@/lib/evidence-compare";
import type { SceneId } from "@/lib/lab-models";
import type { RecordLike } from "@/lib/record-facts";
import { RELATION_LABEL } from "@/lib/scientific-media";

const INV: Record<SceneId, Inv> = { flex: "PSI-69", bass: "PSI-25", saffire: "PSI-98" };

export default function EvidenceCompare({ sceneId, detail, fuel, sample, onExample, exampleLabel }: {
  sceneId: SceneId; detail: RecordLike | null; fuel?: string | null; sample?: string | null;
  onExample?: () => void; exampleLabel?: string;
}) {
  const options = compareOptions(sceneId, { fuel, sample, recordLabel: detail?.display_id ?? null });
  const [pick, setPick] = useState<string | null>(null);
  const current = options.find((o) => o.media.id === pick) ?? options[0];
  const [diffOpen, setDiffOpen] = useState(false);
  if (!current) return null;
  const m = current.media;
  return (
    <section aria-labelledby={`${sceneId}-nasa-title`} data-testid="evidence-compare"
      className="flex min-w-0 flex-col gap-3 rounded-2xl border border-ok/30 bg-panel/70 p-3 md:p-4">
      <div>
        <p className="text-[12px] font-semibold uppercase tracking-wide text-ok">{m.relation === "experimental" ? "NASA experiment image" : RELATION_LABEL[m.relation].label}</p>
        <h3 id={`${sceneId}-nasa-title`} className="subhead mt-0.5 text-[16px]">{m.title}</h3>
      </div>
      {options.length > 1 && (
        <Segmented label="NASA media" value={m.id} onChange={setPick} options={options.map((o) => [o.media.id, o.label])} />
      )}
      <MediaFigure key={m.id} id={m.id} aspect={m.id === "flex-1g-vs-microgravity" ? "3 / 4" : "4 / 3"} fit={m.id === "flex-1g-vs-microgravity" ? "contain" : "cover"}
        compact sizes="(min-width: 1280px) 30vw, 92vw" className={m.id === "flex-1g-vs-microgravity" ? "mx-auto w-full max-w-[220px]" : ""}
        caption={<><span data-testid="compare-fit">{current.fit}</span> {m.caveat && <span className="text-text-3">{m.caveat}</span>}</>} />
      <p className="text-[13px]"><a href={m.sourceUrl} target="_blank" rel="noreferrer">Open the original NASA source</a></p>

      <div className="border-t border-line/50 pt-3">
        <p className="text-[12px] font-semibold uppercase tracking-wide text-text-3">Recorded values (NASA data)</p>
        {detail ? <RecordFacts record={detail} className="mt-2" /> : (
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[13.5px] text-text-2">
            <span>No test selected: the picture and the model show no measurement.</span>
            {onExample && <button type="button" onClick={onExample} data-testid="compare-example" className="press rounded-lg border border-line-strong px-2.5 py-1 text-[13px] text-text hover:border-electric">{exampleLabel ?? "Use an example test"}</button>}
          </div>
        )}
      </div>

      <div>
        <button type="button" aria-expanded={diffOpen} aria-controls={`${sceneId}-diff`} onClick={() => setDiffOpen(!diffOpen)} className="text-[13.5px] text-link hover:underline">
          {diffOpen ? "Hide the differences" : "What differs between the model and the evidence"}
        </button>
        <ul id={`${sceneId}-diff`} hidden={!diffOpen} className="mt-2 list-disc pl-5 text-[13px] leading-relaxed text-text-2">
          {DIFFERENCES[sceneId].map((d) => <li key={d}>{d}</li>)}
        </ul>
      </div>
      <AskSuggestions ctx={{ inv: INV[sceneId], media: { title: m.title }, from: "media" }} max={1} compact title="Ask about this image" />
    </section>
  );
}

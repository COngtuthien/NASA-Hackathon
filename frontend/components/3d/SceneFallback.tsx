"use client";

import { PhenomenonArt } from "@/components/illustrations";
import type { LabScene } from "@/lib/lab-models";

const ART: Record<string, "droplet" | "spread" | "spacecraft"> = { flex: "droplet", bass: "spread", saffire: "spacecraft" };

/**
 * Static view used when WebGL is unavailable, after an unrecoverable context loss, or when the visitor picks
 * "Static view". It keeps everything that matters: the schematic, the plain-language description and (in the
 * panels beside it) all controls' explanations and the NASA evidence.
 */
export default function SceneFallback({ scene, reason, onRetry }: { scene: LabScene; reason: "no-webgl" | "context-lost" | "user" | "error"; onRetry?: () => void }) {
  const why = {
    "no-webgl": "This browser or device does not provide WebGL, so the interactive 3D view is replaced by a static schematic.",
    "context-lost": "The graphics context was lost (for example after a GPU reset) and could not be restored.",
    user: "Static view selected. The 3D scene is not loaded, which saves battery and memory.",
    error: "The 3D scene failed to load.",
  }[reason];
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 overflow-auto p-5 text-center" data-testid="scene-fallback">
      <div className="w-full max-w-[300px] [&_figcaption]:hidden"><PhenomenonArt kind={ART[scene.id]} caption="" /></div>
      <div className="max-w-[60ch]">
        <p className="text-[13px] font-medium text-warn">{why}</p>
        <p className="mt-2 text-[13.5px] leading-relaxed text-text-2">{scene.textAlternative}</p>
        <p className="mt-2 text-[12px] text-text-3">Schematic, not to scale; not data.</p>
        {onRetry && (
          <button type="button" onClick={onRetry} className="press mt-3 rounded-lg border border-line-strong bg-raised px-3 py-1.5 text-sm text-text hover:border-flame/70">
            {reason === "user" ? "Load the 3D view" : "Try the 3D view again"}
          </button>
        )}
      </div>
    </div>
  );
}

"use client";

import { Html } from "@react-three/drei";
import type { ReactNode } from "react";

/**
 * A label pinned to a 3D point. Clicking it selects the component. Labels are presentation only (aria-hidden,
 * not in the tab order): the same components are listed as real buttons in the explanation panel.
 */
export function Annotation({ position, label, id, selected, onSelect, tone = "default", note }: {
  position: [number, number, number]; label: string; id: string; selected: boolean; onSelect: (id: string) => void;
  tone?: "default" | "measured" | "warn"; note?: ReactNode;
}) {
  const ring = tone === "measured" ? "border-data/70 text-data" : tone === "warn" ? "border-warn/70 text-warn" : "border-white/25 text-text";
  return (
    <Html position={position} center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
      <div aria-hidden className="flex flex-col items-center" data-annotation={id}>
        <button type="button" tabIndex={-1} onClick={(e) => { e.stopPropagation(); onSelect(id); }}
          className={`pointer-events-auto whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[12px] font-medium shadow-[0_4px_18px_-6px_rgba(0,0,0,0.8)] backdrop-blur-md transition-colors ${
            selected ? "border-flame bg-flame/90 text-flame-ink" : `${ring} bg-void/75 hover:border-flame/80`}`}>
          {label}
        </button>
        {note && <span className="mt-0.5 whitespace-nowrap rounded bg-void/70 px-1.5 text-[11px] text-text-2">{note}</span>}
      </div>
    </Html>
  );
}

/** A thin pointer line from a label anchor to the feature it names. */
export function Leader({ from, to, color = "#a9b8cd" }: { from: [number, number, number]; to: [number, number, number]; color?: string }) {
  const positions = new Float32Array([...from, ...to]);
  return (
    <line>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <lineBasicMaterial color={color} transparent opacity={0.45} />
    </line>
  );
}

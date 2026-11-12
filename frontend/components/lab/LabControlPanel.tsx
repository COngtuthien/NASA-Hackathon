"use client";

import { useId, type ReactNode } from "react";
import { Segmented } from "@/components/ui";
import type { SceneId } from "@/lib/lab-models";
import {
  BASS_FLOWS, BASS_SAMPLES, FLEX_RANGE, type BassState, type CommonState, type FlexState, type SaffireState,
} from "@/lib/lab-presets";
import type { Mode } from "@/lib/lab-scientific-metadata";

/** Accessible on/off switch (a checkbox with switch semantics). */
export function Toggle({ label, checked, onChange, note, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; note?: string; disabled?: boolean }) {
  const id = useId();
  return (
    <div className={`flex items-start justify-between gap-3 ${disabled ? "opacity-50" : ""}`}>
      <label htmlFor={id} className="min-w-0 text-sm">
        <span className="text-text">{label}</span>
        {note && <span className="block text-[12px] leading-snug text-text-3">{note}</span>}
      </label>
      <button id={id} type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)}
        className={`press relative mt-0.5 h-6 w-11 shrink-0 rounded-full border transition-colors ${checked ? "border-flame bg-flame/80" : "border-line-strong bg-ink"}`}>
        <span aria-hidden className={`absolute top-0.5 h-4.5 w-4.5 rounded-full bg-text transition-[left] duration-200 ${checked ? "left-[22px]" : "left-0.5"}`} />
      </button>
    </div>
  );
}

function Slider({ label, value, min, max, step, onChange, format, note, disabled }: {
  label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void;
  format: (v: number) => string; note: string; disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className={disabled ? "opacity-50" : ""}>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <label htmlFor={id} className="text-text">{label}</label>
        <output htmlFor={id} className="font-mono text-[13px] text-flame">{format(value)}</output>
      </div>
      <input id={id} type="range" min={min} max={max} step={step} value={value} disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))} aria-valuetext={format(value)}
        className="mt-1.5 w-full accent-[var(--flame)]" />
      <p className="text-[12px] leading-snug text-text-3">{note}</p>
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-3.5 border-t border-line/70 pt-3.5 first:border-t-0 first:pt-0">
      <legend className="sr-only">{title}</legend>
      <p aria-hidden className="text-[12.5px] font-medium text-text-3">{title}</p>
      {children}
    </fieldset>
  );
}

export default function LabControlPanel({ scene, mode, common, setCommon, flex, setFlex, bass, setBass, saffire, setSaffire, onReset, onStatic, locked }: {
  scene: SceneId; mode: Mode; common: CommonState; setCommon: (c: CommonState) => void;
  flex: FlexState; setFlex: (s: FlexState) => void; bass: BassState; setBass: (s: BassState) => void;
  saffire: SaffireState; setSaffire: (s: SaffireState) => void; onReset: () => void; onStatic: () => void;
  /** Evidence mode with a selected record: the drawing follows the record, so these controls are locked. */
  locked: string | null;
}) {
  return (
    <div className="flex flex-col gap-5" data-testid="lab-controls">
      {locked && <p className="rounded-lg border border-data/40 bg-data/[0.06] px-3 py-2 text-[12.5px] text-text-2">Evidence mode: the drawing follows <b className="text-data">{locked}</b>. Switch to Conceptual 3D to explore freely.</p>}

      {scene === "flex" && (
        <Group title="Droplet experiment (conceptual)">
          <div inert={mode === "evidence"} className={mode === "evidence" ? "opacity-50" : ""}>
            <Segmented label="Gravity environment" value={mode === "evidence" ? "micro" : flex.gravity} onChange={(v) => setFlex({ ...flex, gravity: v as FlexState["gravity"] })}
              options={[["micro", "Microgravity"], ["earth", "Earth 1 g (comparison)"]]} />
          </div>
          <p className="-mt-2 text-[12px] leading-snug text-text-3">
            {mode === "evidence" ? "All FLEX tests ran aboard the ISS, so evidence mode is microgravity only." : "Shape change only: buoyancy stretches the flame upward at 1 g. The teardrop is qualitative, not a simulation."}
          </p>
          <div inert={!!locked} className={locked ? "opacity-50" : ""}>
            <Segmented label="Fuel (FLEX fuels)" value={flex.fuel} onChange={(v) => setFlex({ ...flex, fuel: v as FlexState["fuel"] })}
              options={[["Heptane", "n-Heptane"], ["Methanol", "Methanol"]]} />
          </div>
          <p className="-mt-2 text-[12px] leading-snug text-text-3">Both fuels were burned in FLEX. Heptane adds the documented soot shell; flame colours are illustrative. Also filters the nearby NASA tests in Evidence.</p>
          <Slider label="Ambient O₂ (mole fraction)" value={flex.o2} {...FLEX_RANGE.o2} disabled={!!locked}
            onChange={(v) => setFlex({ ...flex, o2: v })} format={(v) => v.toFixed(2)}
            note="Changes the share of cyan O₂ dots only. Finds real FLEX tests near this value; it does not predict burning or extinction." />
          <Slider label="Initial droplet diameter D₀" value={flex.d0} {...FLEX_RANGE.d0} disabled={!!locked}
            onChange={(v) => setFlex({ ...flex, d0: v })} format={(v) => `${v.toFixed(1)} mm`}
            note="Redraws the droplet to scale (see the mm scale bar). The flame is always drawn at 4× the droplet radius: an illustrative choice, not computed." />
        </Group>
      )}

      {scene === "bass" && (
        <Group title="Sample and airflow (conceptual)">
          <div inert={!!locked} className={locked ? "opacity-50" : ""}>
            <Segmented label="Sample type (BASS-II geometries)" value={bass.sample} onChange={(v) => setBass({ ...bass, sample: v as BassState["sample"], flow: v !== "rod" && bass.flow === "stagnation" ? "opposed" : bass.flow })}
              options={BASS_SAMPLES.map((x) => [x.id, x.label])} />
            <p className="mt-1 text-[12px] leading-snug text-text-3">{BASS_SAMPLES.find((x) => x.id === bass.sample)?.note} Sample length is illustrative.</p>
          </div>
          <div inert={!!locked} className={locked ? "opacity-50" : ""}>
            <Segmented label="Flame spread relative to airflow" value={bass.flow} onChange={(v) => setBass({ ...bass, flow: v as BassState["flow"] })}
              options={BASS_FLOWS.filter((f) => f.id !== "stagnation" || bass.sample === "rod").map((f) => [f.id, f.label])} />
            <p className="mt-1 text-[12px] leading-snug text-text-3">{BASS_FLOWS.find((f) => f.id === bass.flow)?.note} Air always flows from the fan end to the outlet; what changes is which end of the sample burns first.</p>
          </div>
          <Toggle label="Moving flame front" checked={bass.showFront} onChange={(v) => setBass({ ...bass, showFront: v })}
            note="Illustrative travel only. Its speed is not a measured spread rate." />
        </Group>
      )}

      {scene === "saffire" && (
        <Group title="Inspection (conceptual arrangement)">
          <Toggle label="Cutaway (transparent walls)" checked={saffire.cutaway} onChange={(v) => setSaffire({ ...saffire, cutaway: v })} note="See the sample card and duct inside the enclosure." />
          <Toggle label="Exploded view" checked={saffire.exploded} onChange={(v) => setSaffire({ ...saffire, exploded: v })} note="Separates fans, straighteners and diagnostics so each can be selected." />
          <div inert={!!locked} className={locked ? "opacity-50" : ""}>
            <Segmented label="Burn record (CSV)" value={saffire.burn} onChange={(v) => setSaffire({ ...saffire, burn: v as SaffireState["burn"] })}
              options={[["S1", "S1 · concurrent"], ["S2", "S2 · opposed"]]} />
            <p className="mt-1 text-[12px] leading-snug text-text-3">Sets the flame-spread arrow to the direction recorded in the CSV for that burn. No flame position or speed is drawn as measured.</p>
          </div>
        </Group>
      )}

      <Group title="View">
        <Toggle label="Annotations" checked={common.annotations} onChange={(v) => setCommon({ ...common, annotations: v })} />
        <Toggle label={scene === "flex" ? "Transport indicators" : "Airflow indicators"} checked={common.transport} onChange={(v) => setCommon({ ...common, transport: v })}
          note="Conceptual arrows and particles; their speed is not a measured velocity." />
        <Toggle label="Decorative motion" checked={common.motion} onChange={(v) => setCommon({ ...common, motion: v })}
          note="Flicker and drifting particles. Off renders only on change (saves power); off by default with reduced motion." />
      </Group>

      <div className="flex flex-wrap gap-2 border-t border-line/70 pt-4">
        <button type="button" onClick={onReset} data-testid="reset-params"
          className="press inline-flex min-h-9 items-center rounded-lg border border-line-strong bg-raised px-3.5 text-sm text-text hover:border-flame/70">Reset parameters</button>
        <button type="button" onClick={onStatic}
          className="press inline-flex min-h-9 items-center rounded-lg px-3 text-sm text-text-2 hover:text-text">Use static view</button>
      </div>
    </div>
  );
}

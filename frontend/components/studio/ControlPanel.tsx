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

export function Slider({ label, value, min, max, step, onChange, format, note, disabled }: {
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

export function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-3.5 border-t border-line/70 pt-3.5 first:border-t-0 first:pt-0">
      <legend className="sr-only">{title}</legend>
      <p aria-hidden className="text-[12.5px] font-medium text-text-3">{title}</p>
      {children}
    </fieldset>
  );
}

export type FlexCoverage = { n: number; o2: [number, number]; d0: [number, number]; pressures: string[]; diluents: string[] };

export default function ControlPanel({ scene, mode, common, setCommon, flex, setFlex, bass, setBass, saffire, setSaffire, onReset, onStatic, locked, flexCoverage, bassCounts, extra }: {
  scene: SceneId; mode: Mode; common: CommonState; setCommon: (c: CommonState) => void;
  flex: FlexState; setFlex: (s: FlexState) => void; bass: BassState; setBass: (s: BassState) => void;
  saffire: SaffireState; setSaffire: (s: SaffireState) => void; onReset: () => void; onStatic: () => void;
  /** Evidence mode with a selected record: the drawing follows the record, so these controls are locked. */
  locked: string | null;
  /** Ranges actually covered by FLEX tests of the selected fuel (from /analytics/flex/map). */
  flexCoverage?: FlexCoverage | null;
  /** Number of BASS-II CSV tests per sample type. */
  bassCounts?: Partial<Record<BassState["sample"], number>>;
  /** Scene-specific content shown after the scene controls (e.g. the fuel explanation). */
  extra?: ReactNode;
}) {
  const o2Range = flexCoverage ? { min: Math.floor(flexCoverage.o2[0] * 100) / 100, max: Math.ceil(flexCoverage.o2[1] * 100) / 100, step: 0.01 } : FLEX_RANGE.o2;
  const d0Range = flexCoverage ? { min: Math.floor(flexCoverage.d0[0] * 10) / 10, max: Math.ceil(flexCoverage.d0[1] * 10) / 10, step: 0.1 } : FLEX_RANGE.d0;
  return (
    <div className="flex flex-col gap-5" data-testid="lab-controls">
      {locked && <p className="rounded-lg border border-data/40 bg-data/[0.06] px-3 py-2 text-[12.5px] text-text-2">Evidence mode: the drawing follows <b className="text-data">{locked}</b>. Switch to Conceptual 3D to explore freely.</p>}

      {scene === "flex" && (
        <Group title="Droplet experiment (conceptual)">
          <div inert={mode === "evidence"} className={mode === "evidence" ? "opacity-50" : ""}>
            <Segmented label="Gravity environment" value={mode === "evidence" ? "micro" : flex.gravity} onChange={(v) => setFlex({ ...flex, gravity: v as FlexState["gravity"] })}
              options={[["micro", "Microgravity"], ["earth", "Earth"]]} />
          </div>
          <p className="-mt-2 text-[12px] leading-snug text-text-3">
            {mode === "evidence" ? "All FLEX tests ran aboard the ISS, so evidence mode is microgravity only." : "Changes the flame shape only. Not a simulation."}
          </p>
          <div inert={!!locked} className={locked ? "opacity-50" : ""}>
            <Segmented label="Fuel (FLEX fuels)" value={flex.fuel} onChange={(v) => setFlex({ ...flex, fuel: v as FlexState["fuel"] })}
              options={[["Heptane", "n-Heptane"], ["Methanol", "Methanol"]]} />
          </div>
          <p className="-mt-2 text-[12px] leading-snug text-text-3">The two fuels FLEX burned. Flame colours are illustrative.</p>
          <Slider label="Ambient O₂ (mole fraction)" value={Math.min(Math.max(flex.o2, o2Range.min), o2Range.max)} {...o2Range} disabled={!!locked}
            onChange={(v) => setFlex({ ...flex, o2: v })} format={(v) => v.toFixed(2)}
            note="Recolours the oxygen dots and finds real tests nearby. Predicts nothing." />
          <Slider label="Initial droplet diameter D₀" value={Math.min(Math.max(flex.d0, d0Range.min), d0Range.max)} {...d0Range} disabled={!!locked}
            onChange={(v) => setFlex({ ...flex, d0: v })} format={(v) => `${v.toFixed(1)} mm`}
            note="Redraws the droplet to scale. The flame size around it is illustrative." />
          {flexCoverage && (
            <details className="text-[12.5px] text-text-3">
            <summary className="cursor-pointer text-text-2">Data coverage for this fuel</summary>
            <p className="mt-1.5 rounded-lg border border-line/80 px-2.5 py-1.5 text-[12px] leading-snug text-text-3" data-testid="fuel-coverage">
              Slider ranges follow the {flexCoverage.n} FLEX {flex.fuel === "Heptane" ? "n-heptane" : "methanol"} tests with numeric O₂ and D₀: O₂ {flexCoverage.o2[0]}–{flexCoverage.o2[1]}, D₀ {flexCoverage.d0[0]}–{flexCoverage.d0[1]} mm,
              pressure bands {flexCoverage.pressures.join(", ")} atm, diluents {flexCoverage.diluents.join(", ")} <span className="text-text-2">(computed from the CSV)</span>.
            </p>
            </details>
          )}
        </Group>
      )}

      {scene === "bass" && (
        <Group title="Sample and airflow (conceptual)">
          <div inert={!!locked} className={locked ? "opacity-50" : ""}>
            <Segmented label="Sample type (BASS-II geometries)" value={bass.sample} onChange={(v) => setBass({ ...bass, sample: v as BassState["sample"], flow: v !== "rod" && bass.flow === "stagnation" ? "opposed" : bass.flow })}
              options={BASS_SAMPLES.map((x) => [x.id, bassCounts?.[x.id] !== undefined ? `${x.label} (${bassCounts[x.id]})` : x.label])} />
            <p className="mt-1 text-[12px] leading-snug text-text-3">{BASS_SAMPLES.find((x) => x.id === bass.sample)?.note} Length is illustrative.{bassCounts ? " (n) = tests in the CSV." : ""}</p>
          </div>
          <div inert={!!locked} className={locked ? "opacity-50" : ""}>
            <Segmented label="Flame spread relative to airflow" value={bass.flow} onChange={(v) => setBass({ ...bass, flow: v as BassState["flow"] })}
              options={BASS_FLOWS.filter((f) => f.id !== "stagnation" || bass.sample === "rod").map((f) => [f.id, f.label])} />
            <p className="mt-1 text-[12px] leading-snug text-text-3">{BASS_FLOWS.find((f) => f.id === bass.flow)?.note} The fan always blows the same way; the burning end changes.</p>
          </div>
          <Toggle label="Flame front and direction" checked={bass.showFront} onChange={(v) => setBass({ ...bass, showFront: v })}
            note="Moves only with the timeline. Not a measured spread rate." />
        </Group>
      )}

      {scene === "saffire" && (
        <Group title="Inspection (conceptual arrangement)">
          <Toggle label="Cutaway (transparent walls)" checked={saffire.cutaway} onChange={(v) => setSaffire({ ...saffire, cutaway: v })} />
          <Toggle label="Exploded view" checked={saffire.exploded} onChange={(v) => setSaffire({ ...saffire, exploded: v })} note="Pulls the parts apart so each is easy to select." />
          <div inert={!!locked} className={locked ? "opacity-50" : ""}>
            <Segmented label="Burn record (CSV)" value={saffire.burn} onChange={(v) => setSaffire({ ...saffire, burn: v as SaffireState["burn"] })}
              options={[["S1", "S1 · concurrent"], ["S2", "S2 · opposed"]]} />
            <p className="mt-1 text-[12px] leading-snug text-text-3">Sets the spread arrow to the recorded direction. Flame position and speed are illustrative.</p>
          </div>
        </Group>
      )}

      {extra}

      <details className="rounded-xl border border-line/70 px-3 py-2" data-testid="display-settings">
      <summary className="cursor-pointer py-1 text-[13.5px] text-text-2">Display settings</summary>
      <div className="mt-3 flex flex-col gap-3.5 pb-1">
        <Segmented label="3D labels" value={common.labels} onChange={(v) => setCommon({ ...common, labels: v as CommonState["labels"] })}
          options={[["focus", "Contextual"], ["all", "All"], ["off", "Off"]]} />

        <Toggle label={scene === "flex" ? "Transport indicators" : "Airflow indicators"} checked={common.transport} onChange={(v) => setCommon({ ...common, transport: v })}
          note="Conceptual arrows; their speed is not a velocity." />
        <Toggle label="Decorative motion" checked={common.motion} onChange={(v) => setCommon({ ...common, motion: v })}
          note="Flicker and drift. Off saves power; off by default with reduced motion." />
      </div>
      </details>

      <div className="flex flex-wrap gap-2 border-t border-line/70 pt-4">
        <button type="button" onClick={onReset} data-testid="reset-params"
          className="press inline-flex min-h-9 items-center rounded-lg border border-line-strong bg-raised px-3.5 text-sm text-text hover:border-flame/70">Reset parameters</button>
        <button type="button" onClick={onStatic}
          className="press inline-flex min-h-9 items-center rounded-lg px-3 text-sm text-text-2 hover:text-text">Use static view</button>
      </div>
    </div>
  );
}

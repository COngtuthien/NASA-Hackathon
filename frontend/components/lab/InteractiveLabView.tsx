"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Component, useCallback, useState, type ReactNode } from "react";
import type { InteractiveSceneProps } from "@/components/3d/InteractiveScene";
import SceneFallback from "@/components/3d/SceneFallback";
import type { BassMeasured, FlexMeasured, SaffireMeasured } from "@/components/3d/types";
import LabControlPanel from "@/components/lab/LabControlPanel";
import LabEvidencePanel, { type Detail } from "@/components/lab/LabEvidencePanel";
import LabExplanationPanel from "@/components/lab/LabExplanationPanel";
import LabSceneSelector from "@/components/lab/LabSceneSelector";
import { useMedia } from "@/components/motion";
import { PageHeader, Segmented } from "@/components/ui";
import { useApi } from "@/lib/api";
import { isSceneId, SCENE_BY_ID, type SceneId } from "@/lib/lab-models";
import {
  BASS_DEFAULT, COMMON_DEFAULT, FLEX_DEFAULT, SAFFIRE_DEFAULT, type BassSample, type BassState, type CommonState, type FlexState, type SaffireState,
} from "@/lib/lab-presets";
import { MODES, type Mode } from "@/lib/lab-scientific-metadata";
import { ROUTES } from "@/lib/routes";

function ViewportLoading() {
  return (
    <div className="grid h-full place-items-center" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-3 text-sm text-text-2">
        <span aria-hidden className="relative h-12 w-12">
          <span className="absolute inset-0 animate-ping rounded-full border border-flame/40" />
          <span className="absolute inset-2 rounded-full bg-[radial-gradient(circle,rgba(255,138,61,0.9),rgba(91,140,255,0.25)_60%,transparent_70%)]" />
        </span>
        Loading the 3D lab…
      </div>
    </div>
  );
}

// three.js, React Three Fiber and the scenes load only on the client, in their own chunk.
const LabViewport = dynamic(() => import("@/components/lab/LabViewport"), { ssr: false, loading: ViewportLoading });

class ViewportBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

const TABS = [["controls", "Controls"], ["explain", "Explain"], ["evidence", "NASA evidence"]] as const;
type Tab = (typeof TABS)[number][0];

function bassSampleOf(cls: string | null | undefined): BassSample | null {
  if (!cls) return null;
  if (cls === "PMMA thin film") return "thin-film";
  if (cls === "PMMA slab") return "slab";
  if (cls.startsWith("PMMA rod")) return "rod";
  if (cls.startsWith("PMMA sphere")) return "sphere";
  if (cls.includes("fabric")) return "fabric";
  return null;
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

export default function InteractiveLabView() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const reduce = useMedia("(prefers-reduced-motion: reduce)");

  const sceneId: SceneId = isSceneId(sp.get("scene")) ? (sp.get("scene") as SceneId) : "flex";
  const mode: Mode = sp.get("mode") === "evidence" ? "evidence" : "conceptual";
  const scene = SCENE_BY_ID[sceneId];
  const selected = scene.components.some((c) => c.id === sp.get("component")) ? sp.get("component") : null;

  const [common, setCommonRaw] = useState<CommonState>(COMMON_DEFAULT);
  const [motionPref, setMotionPref] = useState<boolean | null>(null);
  const [flex, setFlex] = useState<FlexState>(FLEX_DEFAULT);
  const [bass, setBass] = useState<BassState>(BASS_DEFAULT);
  const [saffire, setSaffire] = useState<SaffireState>(SAFFIRE_DEFAULT);
  const [staticView, setStaticView] = useState(false);
  const [tab, setTab] = useState<Tab>(sp.get("component") ? "explain" : sp.get("record") || sp.get("mode") === "evidence" ? "evidence" : "controls");

  const motionOn = motionPref ?? !reduce;
  const commonView: CommonState = { ...common, motion: motionOn };
  const setCommon = (c: CommonState) => {
    if (c.motion !== motionOn) setMotionPref(c.motion);
    setCommonRaw({ ...c, motion: true });
  };

  const setParams = useCallback((patch: Record<string, string | null>) => {
    const n = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) { if (v) n.set(k, v); else n.delete(k); }
    router.replace(`${pathname}?${n.toString()}`, { scroll: false });
  }, [sp, router, pathname]);

  // record: FLEX/BASS from the URL; SAFFIRE always one of its two burn rows
  const urlRecord = sp.get("record");
  const recordUid = sceneId === "saffire" ? `saffire1:${saffire.burn}`
    : urlRecord && urlRecord.startsWith(sceneId === "flex" ? "flex:" : "bass2:") ? urlRecord : null;
  const det = useApi<Detail>(recordUid ? `/experiments/${encodeURIComponent(recordUid)}` : null);
  const detail = det.data && det.data.experiment_uid === recordUid ? det.data : null;
  const n = detail?.normalized;

  const flexMeasured: FlexMeasured | null = sceneId === "flex" && n && detail
    ? { uid: detail.experiment_uid, label: detail.display_id, d0_mm: num(n.d0_mm), dext_mm: num(n.dext_mm), x_o2: num(n.x_o2), fuel: (n.fuel as string) ?? null } : null;
  const bassMeasured: BassMeasured | null = sceneId === "bass" && n && detail
    ? { uid: detail.experiment_uid, label: detail.display_id, width_cm: num(n.width_cm), thickness_mm: num(n.thickness_mm), diameter_mm: num(n.diameter_mm), flow: (n.flow_direction as string) ?? null } : null;
  const saffireMeasured: SaffireMeasured | null = sceneId === "saffire" && n && detail
    ? { uid: detail.experiment_uid, label: detail.display_id, flow: (n.flow_direction as string) ?? null } : null;

  const evidenceRecord = mode === "evidence" && (flexMeasured || bassMeasured);
  const locked = evidenceRecord ? `test ${detail?.display_id}` : null;

  // In evidence mode a BASS-II record decides the drawn sample type and flow direction.
  const bassView: BassState = (() => {
    if (!(mode === "evidence" && bassMeasured)) return bass;
    const s = bassSampleOf(n?.material_class as string) ?? bass.sample;
    const f = (bassMeasured.flow ?? "").toLowerCase();
    return { ...bass, sample: s, flow: f === "opposed" || f === "concurrent" || f === "stagnation" ? f : bass.flow };
  })();

  const select = useCallback((id: string | null) => {
    setParams({ component: id });
    if (id) setTab("explain");
  }, [setParams]);

  const common3d = { common: commonView, animate: motionOn, mode, selected, onSelect: (id: string) => select(id) };
  const sceneProps: InteractiveSceneProps = sceneId === "flex" ? { id: "flex", props: { ...common3d, state: flex, measured: flexMeasured } }
    : sceneId === "bass" ? { id: "bass", props: { ...common3d, state: bassView, measured: bassMeasured } }
      : { id: "saffire", props: { ...common3d, state: saffire, measured: saffireMeasured } };

  const measuredLabel = mode !== "evidence" ? null
    : flexMeasured ? `test ${flexMeasured.label}: D₀ ${flexMeasured.d0_mm ?? "—"} mm, D_ext ${flexMeasured.dext_mm ?? "—"} mm`
      : bassMeasured ? `test ${bassMeasured.label}: ${bassMeasured.diameter_mm ? `diameter ${bassMeasured.diameter_mm} mm` : bassMeasured.width_cm ? `width ${bassMeasured.width_cm} cm (CSV, nominal)` : "no recorded width"}, ${bassMeasured.flow ?? "flow not recorded"}`
        : saffireMeasured ? `burn ${saffireMeasured.label} (${saffireMeasured.flow}); sample size from the Operations document` : null;

  function resetParams() {
    if (sceneId === "flex") setFlex(FLEX_DEFAULT);
    if (sceneId === "bass") setBass(BASS_DEFAULT);
    if (sceneId === "saffire") setSaffire(SAFFIRE_DEFAULT);
    setCommonRaw(COMMON_DEFAULT);
    setMotionPref(null);
    setParams({ component: null, record: null, mode: null });
  }

  function onTabKey(e: React.KeyboardEvent, i: number) {
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const next = TABS[(i + d + TABS.length) % TABS.length][0];
    setTab(next);
    requestAnimationFrame(() => document.getElementById(`lab-tab-${next}`)?.focus());
  }

  return (
    <>
      <PageHeader kicker="Discover" title="Interactive Combustion Lab"
        lead="Rotate, zoom and take apart three microgravity combustion experiments, then set the picture beside real NASA records. The 3D views explain principles and arrangements; measured values live only in the NASA evidence panel." />

      <LabSceneSelector value={sceneId} onChange={(id) => { if (id !== sceneId) setParams({ scene: id, record: null, component: null }); }} />
      <p className="mt-3 max-w-[90ch] text-[14px] text-text-2">{scene.blurb}</p>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_400px] xl:grid-cols-[minmax(0,1fr)_440px]">
        <div className="relative h-[58vh] min-h-[360px] overflow-hidden rounded-2xl border border-line/80 bg-[radial-gradient(120%_90%_at_50%_45%,rgba(30,52,90,0.55),rgba(5,10,20,0.98)_70%)] lg:sticky lg:top-[calc(var(--hdr,57px)+1rem)] lg:h-[calc(100vh-var(--hdr,57px)-2rem)] lg:max-h-[820px]">
          <div aria-hidden className="tech-grid pointer-events-none absolute inset-0 opacity-60" />
          {staticView ? (
            <SceneFallback scene={scene} reason="user" onRetry={() => setStaticView(false)} />
          ) : (
            <ViewportBoundary fallback={<SceneFallback scene={scene} reason="error" />}>
              <LabViewport scene={sceneProps} mode={mode} animate={motionOn} measuredLabel={measuredLabel} onStatic={() => setStaticView(true)} />
            </ViewportBoundary>
          )}
        </div>

        <aside aria-label="Lab panel" className="hairline-top min-w-0 rounded-2xl border border-line/80 bg-panel/90">
          <div className="border-b border-line/70 p-4">
            <Segmented label="Visualization mode" value={mode} onChange={(v) => { setParams({ mode: v === "evidence" ? "evidence" : null }); if (v === "evidence") setTab("evidence"); }}
              options={[["conceptual", MODES.conceptual.label], ["evidence", MODES.evidence.label]]} />
            <p className="mt-2 text-[12.5px] leading-snug text-text-3">{MODES[mode].note}</p>
          </div>
          <div role="tablist" aria-label="Lab panel sections" className="flex gap-1 border-b border-line/70 px-3 pt-2">
            {TABS.map(([id, label], i) => (
              <button key={id} id={`lab-tab-${id}`} type="button" role="tab" aria-selected={tab === id} aria-controls={`lab-panel-${id}`} tabIndex={tab === id ? 0 : -1}
                onClick={() => setTab(id)} onKeyDown={(e) => onTabKey(e, i)}
                className={`press -mb-px rounded-t-lg border-b-2 px-3 py-2 text-sm ${tab === id ? "border-flame text-text" : "border-transparent text-text-2 hover:text-text"}`}>
                {label}
              </button>
            ))}
          </div>
          {TABS.map(([id]) => (
            <div key={id} id={`lab-panel-${id}`} role="tabpanel" aria-labelledby={`lab-tab-${id}`} hidden={tab !== id} className="p-4">
              {id === "controls" && (
                <LabControlPanel scene={sceneId} mode={mode} common={commonView} setCommon={setCommon} flex={flex} setFlex={setFlex}
                  bass={bass} setBass={setBass} saffire={saffire} setSaffire={setSaffire} onReset={resetParams} onStatic={() => setStaticView(true)} locked={locked} />
              )}
              {id === "explain" && (
                <LabExplanationPanel scene={scene} mode={mode} selected={selected} onSelect={select}
                  record={detail ? { uid: detail.experiment_uid, label: detail.display_id } : null} />
              )}
              {id === "evidence" && (
                <LabEvidencePanel scene={scene} flex={flex} bass={bass} saffireBurn={saffire.burn} uid={recordUid}
                  onRecord={(uid) => setParams({ record: uid })} detail={detail} />
              )}
            </div>
          ))}
        </aside>
      </div>

      <section aria-labelledby="lab-about" className="mt-8 grid gap-4 md:grid-cols-3">
        <h2 id="lab-about" className="sr-only">About this lab</h2>
        <div className="rounded-xl border border-line/80 bg-panel/70 p-4 text-[13.5px] text-text-2">
          <p className="subhead text-[15px] text-text">What you are looking at</p>
          <p className="mt-1.5">{scene.textAlternative}</p>
        </div>
        <div className="rounded-xl border border-line/80 bg-panel/70 p-4 text-[13.5px] text-text-2">
          <p className="subhead text-[15px] text-text">What it is not</p>
          <p className="mt-1.5">Not a simulation and not a reconstruction of a specific test. No slider produces a burning rate, temperature, extinction limit, burn time or spread rate. Measured values appear only in the NASA evidence panel, with their units and flags.</p>
        </div>
        <div className="rounded-xl border border-line/80 bg-panel/70 p-4 text-[13.5px] text-text-2">
          <p className="subhead text-[15px] text-text">Go deeper</p>
          <ul className="mt-1.5 flex flex-col gap-1">
            <li><Link href={scene.phenomenonHref}>{scene.phenomenonTitle}</Link></li>
            <li><Link href={ROUTES.media}>NASA scientific media</Link></li>
            <li><Link href={ROUTES.copilot}>Research Copilot</Link></li>
            <li><Link href={ROUTES.methodology}>Methodology and limitations</Link></li>
          </ul>
        </div>
      </section>
    </>
  );
}

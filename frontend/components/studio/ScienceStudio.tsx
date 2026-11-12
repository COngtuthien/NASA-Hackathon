"use client";

// The Interactive Science Studio embedded in each phenomenon page (#studio). One component for the three
// investigations: URL state (record, mode, component, view), scene state, layers, illustrative timeline, camera
// focus, comparison views, guided exploration and the inspector panels. three.js loads only with the viewport.
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { LegendItem } from "@/components/3d/ModelLegend";
import SceneFallback from "@/components/3d/SceneFallback";
import type { CameraApi } from "@/components/3d/ScientificCameraControls";
import type { BassMeasured, FlexMeasured, SaffireMeasured, SceneCommonProps } from "@/components/3d/types";
import { Icon } from "@/components/icons";
import { MediaFigure, MediaPanelBlock } from "@/components/media";
import { useMedia } from "@/components/motion";
import BassCompare from "@/components/studio/BassCompare";
import ControlPanel, { type FlexCoverage } from "@/components/studio/ControlPanel";
import EvidencePanel, { SaffireEvidence, type Detail } from "@/components/studio/EvidencePanel";
import FuelCompare from "@/components/studio/FuelCompare";
import GuidedTour from "@/components/studio/GuidedTour";
import LayerInspector from "@/components/studio/LayerInspector";
import type { AnySceneProps } from "@/components/studio/StudioViewport";
import TimelineBar from "@/components/studio/TimelineBar";
import { Segmented } from "@/components/ui";
import { fmt, useApi } from "@/lib/api";
import { FUELS, type FuelId } from "@/lib/flex-fuels";
import { SCENE_BY_ID, type SceneId } from "@/lib/lab-models";
import {
  BASS_DEFAULT, BASS_SAMPLES, COMMON_DEFAULT, FLEX_DEFAULT, SAFFIRE_DEFAULT, type BassSample, type BassState, type CommonState, type FlexState, type SaffireState,
} from "@/lib/lab-presets";
import { MODES, type Mode } from "@/lib/lab-scientific-metadata";
import { bassFocus, CAMERA_HOME, flexFocus, SAFFIRE_PRESETS, saffireFocus, type Shot } from "@/lib/studio-camera";
import { BASS_STAGES, createTimeline, FLEX_STAGES, useTimeline } from "@/lib/timeline";
import { TOURS, type TourStep } from "@/lib/tours";

function ViewportLoading() {
  return (
    <div className="grid h-full place-items-center" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-3 text-sm text-text-2">
        <span aria-hidden className="relative h-12 w-12">
          <span className="absolute inset-0 animate-ping rounded-full border border-flame/40" />
          <span className="absolute inset-2 rounded-full bg-[radial-gradient(circle,rgba(255,138,61,0.9),rgba(91,140,255,0.25)_60%,transparent_70%)]" />
        </span>
        Loading the 3D studio…
      </div>
    </div>
  );
}

// three.js, React Three Fiber and the scene load only on the client, in their own chunk, when the studio mounts.
const StudioViewport = dynamic(() => import("@/components/studio/StudioViewport"), { ssr: false, loading: ViewportLoading });

class ViewportBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

const VIEWS: Record<SceneId, [string, string][]> = {
  flex: [["single", "Single droplet"], ["fuels", "Compare fuels"], ["gravity", "Earth vs microgravity"]],
  bass: [["single", "Single sample"], ["compare", "Compare"]],
  saffire: [["3d", "3D model"], ["footage", "NASA footage"], ["data", "Evidence & metadata"]],
};

const TABS: Record<SceneId, [string, string][]> = {
  flex: [["explore", "Explore"], ["layers", "Layers"], ["evidence", "NASA evidence"], ["compare", "Compare"]],
  bass: [["explore", "Explore"], ["layers", "Layers"], ["evidence", "NASA evidence"], ["compare", "Compare"]],
  saffire: [["explore", "Explore"], ["layers", "Layers"], ["evidence", "NASA evidence"]],
};

const LEGEND: Record<SceneId, LegendItem[]> = {
  flex: [
    { color: "#5b8cff", label: "Flame envelope (conceptual)" },
    { color: "#ffb547", label: "Fuel vapour, outward" },
    { color: "#4fd1e8", label: "O₂ (dots, inward arrows)" },
    { color: "#5d6b83", label: "N₂ and diluent" },
    { color: "#c47a2c", label: "Soot (n-heptane)" },
  ],
  bass: [
    { color: "#4fd1e8", label: "Airflow direction (conceptual)" },
    { color: "#ff8a3d", label: "Flame (illustrative)" },
    { color: "#ffb547", label: "Flame-front line" },
    { color: "#3b2a22", label: "Burned region (illustrative)" },
  ],
  saffire: [
    { color: "#4fd1e8", label: "Airflow (bottom → top)" },
    { color: "#ffb547", label: "Flame-spread direction (CSV)" },
    { color: "#c9b48a", label: "SIBAL sample card" },
  ],
};

function bassSampleOf(cls: string | null | undefined): BassSample | null {
  if (!cls) return null;
  if (cls === "PMMA thin film") return "thin-film";
  if (cls === "PMMA slab") return "slab";
  if (cls.startsWith("PMMA rod")) return "rod";
  if (cls.startsWith("PMMA sphere")) return "sphere";
  if (cls.toLowerCase().includes("fabric")) return "fabric";
  return null;
}
const flowOf = (f: unknown, fallback: BassState["flow"]): BassState["flow"] => {
  const v = String(f ?? "").toLowerCase();
  return v === "opposed" || v === "concurrent" || v === "stagnation" ? v : fallback;
};
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

function flexMeasuredOf(d: Detail | null): FlexMeasured | null {
  if (!d || !d.experiment_uid.startsWith("flex:")) return null;
  const n = d.normalized;
  return { uid: d.experiment_uid, label: d.display_id, d0_mm: num(n.d0_mm), dext_mm: num(n.dext_mm), x_o2: num(n.x_o2), fuel: (n.fuel as string) ?? null };
}
function bassMeasuredOf(d: Detail | null): BassMeasured | null {
  if (!d || !d.experiment_uid.startsWith("bass2:")) return null;
  const n = d.normalized;
  return { uid: d.experiment_uid, label: d.display_id, width_cm: num(n.width_cm), thickness_mm: num(n.thickness_mm), diameter_mm: num(n.diameter_mm), flow: (n.flow_direction as string) ?? null };
}

type MapResp = { points: { fuel: string; x_o2: number; d0_mm: number; pressure_band: string | null; diluent: string }[] };
type BassFacets = { facets: { material_class: { value: string; count: number }[] } };

export default function ScienceStudio({ sceneId }: { sceneId: SceneId }) {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const reduce = useMedia("(prefers-reduced-motion: reduce)");
  const scene = SCENE_BY_ID[sceneId];
  const views = VIEWS[sceneId];
  const tabs = TABS[sceneId];

  const mode: Mode = sp.get("mode") === "evidence" ? "evidence" : "conceptual";
  const selected = scene.components.some((c) => c.id === sp.get("component")) ? sp.get("component") : null;
  const view = views.some(([v]) => v === sp.get("view")) ? (sp.get("view") as string) : views[0][0];
  const urlRecord = sp.get("record");

  const [common, setCommonRaw] = useState<CommonState>(COMMON_DEFAULT);
  const [motionPref, setMotionPref] = useState<boolean | null>(null);
  const [flex, setFlex] = useState<FlexState>(FLEX_DEFAULT);
  const [bass, setBass] = useState<BassState>(BASS_DEFAULT);
  const [saffireLocal, setSaffireLocal] = useState<SaffireState>(SAFFIRE_DEFAULT);
  const [hidden, setHidden] = useState<string[]>([]);
  const [isolate, setIsolate] = useState(false);
  const [staticView, setStaticView] = useState(false);
  const [tab, setTab] = useState<string>(sp.get("component") ? "layers" : urlRecord || sp.get("mode") === "evidence" ? "evidence" : "explore");
  const [panelOpen, setPanelOpen] = useState(true);
  const [fuelsLR, setFuelsLR] = useState<[FuelId, FuelId]>(["Heptane", "Methanol"]);
  const [cmpA, setCmpA] = useState<string | null>(null);
  const [cmpB, setCmpB] = useState<string | null>(null);
  const [tourIdx, setTourIdx] = useState<number | null>(null);
  const [timeline] = useState(() => createTimeline(sceneId === "bass" ? 12 : 14));
  const tl = useTimeline(timeline);
  const [cam, setCam] = useState<CameraApi | null>(null);
  const section = useRef<HTMLElement>(null);

  const motionOn = motionPref ?? !reduce;
  const commonView: CommonState = { ...common, motion: motionOn };
  const setCommon = (c: CommonState) => {
    if (c.motion !== motionOn) setMotionPref(c.motion);
    setCommonRaw({ ...c, motion: true });
  };

  const setParams = useCallback((patch: Record<string, string | null>) => {
    const n = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) { if (v) n.set(k, v); else n.delete(k); }
    n.delete("scene");                                   // legacy /lab parameter, no longer needed once here
    const q = n.toString();
    router.replace(`${pathname}${q ? `?${q}` : ""}`, { scroll: false });
  }, [sp, router, pathname]);

  // Deep links (record, component, legacy /lab links, #studio) scroll the studio into view once.
  useEffect(() => {
    // #footage (older links to the SAFFIRE-I footage section) opens the studio's NASA footage view
    if (sceneId === "saffire" && window.location.hash === "#footage") setParams({ view: "footage" });
    if (["#studio", "#footage"].includes(window.location.hash) || sp.has("record") || sp.has("component") || sp.has("scene") || sp.has("view")) {
      section.current?.scrollIntoView({ block: "start", behavior: "auto" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // SAFFIRE-I: the burn record is the URL record (S1 by default)
  const burn: SaffireState["burn"] = urlRecord === "saffire1:S2" ? "S2" : "S1";
  const saffire: SaffireState = { ...saffireLocal, burn };
  const setSaffire = (s: SaffireState) => {
    setSaffireLocal(s);
    if (s.burn !== burn) setParams({ record: `saffire1:${s.burn}` });
  };

  const recordUid = sceneId === "saffire" ? `saffire1:${burn}`
    : urlRecord && urlRecord.startsWith(sceneId === "flex" ? "flex:" : "bass2:") ? urlRecord : null;
  const det = useApi<Detail>(recordUid ? `/experiments/${encodeURIComponent(recordUid)}` : null);
  const detail = det.data && det.data.experiment_uid === recordUid ? det.data : null;
  const flexMeasured = sceneId === "flex" ? flexMeasuredOf(detail) : null;
  const bassMeasured = sceneId === "bass" ? bassMeasuredOf(detail) : null;
  const saffireMeasured: SaffireMeasured | null = sceneId === "saffire" && detail
    ? { uid: detail.experiment_uid, label: detail.display_id, flow: (detail.normalized.flow_direction as string) ?? null } : null;
  const locked = mode === "evidence" && (flexMeasured || bassMeasured) ? `test ${detail?.display_id}` : null;

  // compare-mode records (fetched only when chosen)
  const compareA = useApi<Detail>(cmpA && ((sceneId === "flex" && view === "fuels") || (sceneId === "bass" && view === "compare")) ? `/experiments/${encodeURIComponent(cmpA)}` : null);
  const compareB = useApi<Detail>(cmpB && ((sceneId === "flex" && view === "fuels") || (sceneId === "bass" && view === "compare")) ? `/experiments/${encodeURIComponent(cmpB)}` : null);
  const cA = compareA.data?.experiment_uid === cmpA ? compareA.data : null;
  const cB = compareB.data?.experiment_uid === cmpB ? compareB.data : null;

  // coverage of the selected fuel (computed from the CSV rows the map endpoint returns)
  const map = useApi<MapResp>(sceneId === "flex" ? "/analytics/flex/map" : null);
  const coverage: FlexCoverage | null = (() => {
    const pts = map.data?.points.filter((p) => p.fuel === flex.fuel) ?? [];
    if (!pts.length) return null;
    const o2 = pts.map((p) => p.x_o2), d0 = pts.map((p) => p.d0_mm);
    return { n: pts.length, o2: [Math.min(...o2), Math.max(...o2)], d0: [Math.min(...d0), Math.max(...d0)],
      pressures: [...new Set(pts.map((p) => p.pressure_band ?? "").filter(Boolean))]
        .sort((x, y) => parseFloat(x.replace(/[^0-9.]/, "")) - parseFloat(y.replace(/[^0-9.]/, ""))).map((b) => b.replace(/ atm$/, "")),
      diluents: [...new Set(pts.map((p) => p.diluent))].sort() };
  })();
  const bassFacets = useApi<BassFacets>(sceneId === "bass" ? "/experiments?dataset=bass2&page_size=1" : null);
  const bassCounts = (() => {
    const f = bassFacets.data?.facets.material_class;
    if (!f) return undefined;
    const out: Partial<Record<BassSample, number>> = {};
    for (const s of BASS_SAMPLES) out[s.id] = f.filter((m) => s.materialClasses.includes(m.value)).reduce((a, m) => a + m.count, 0);
    return out;
  })();

  // drawn droplet size (for camera focus distances)
  const drawnD0 = mode === "evidence" && flexMeasured?.d0_mm ? flexMeasured.d0_mm : flex.d0;

  const shotFor = useCallback((id: string): Shot | null => {
    if (sceneId === "flex") return flexFocus(id, drawnD0);
    if (sceneId === "bass") return bassFocus(id, bass.flow !== "opposed");
    return saffireFocus(id);
  }, [sceneId, drawnD0, bass.flow]);

  const flyHome = useCallback(() => {
    const h = CAMERA_HOME[sceneId];
    cam?.fly({ target: h.target, position: h.position }, !reduce);
  }, [sceneId, reduce, cam]);

  const select = useCallback((id: string | null) => {
    setParams({ component: id });
    if (id) {
      setTab("layers");
      const shot = shotFor(id);
      if (shot) cam?.fly(shot, !reduce);
    }
  }, [setParams, shotFor, reduce, cam, setTab]);

  // --- guided exploration -------------------------------------------------------------------------------------
  const steps = TOURS[sceneId];
  function applyStep(i: number) {
    const st: TourStep = steps[Math.max(0, Math.min(i, steps.length - 1))];
    setTourIdx(i);
    const patch: Record<string, string | null> = {};
    if (st.select !== undefined) patch.component = st.select;
    if (st.mode) patch.mode = st.mode === "evidence" ? "evidence" : null;
    if (st.view) patch.view = st.view === views[0][0] ? null : st.view;
    if (Object.keys(patch).length) setParams(patch);
    if (st.patch) {
      if (sceneId === "flex") setFlex((f) => ({ ...f, ...(st.patch as Partial<FlexState>) }));
      if (sceneId === "bass") setBass((b) => ({ ...b, ...(st.patch as Partial<BassState>) }));
    }
    if (st.tab) setTab(st.tab);
    if (st.timeline !== undefined) {
      if (st.timeline === "off") timeline.set({ active: false, playing: false });
      else timeline.set({ active: true, playing: false, p: st.timeline });
    }
    const preset = st.preset ? SAFFIRE_PRESETS.find((p) => p.id === st.preset) : null;
    if (preset) cam?.fly(preset.shot, !reduce);
    else if (st.select) { const s = shotFor(st.select); if (s) cam?.fly(s, !reduce); }
    else if (st.select === null) flyHome();
  }
  function startTour() {
    setHidden([]);
    setIsolate(false);
    setStaticView(false);
    applyStep(0);
  }
  const taskDone = (id: string) => {
    switch (id) {
      case "earth": return flex.gravity === "earth";
      case "methanol": return flex.fuel === "Methanol";
      case "record": return !!recordUid && sceneId !== "saffire";
      case "rod": return bass.sample === "rod";
      case "concurrent": return bass.flow === "concurrent" && tl.active && tl.p > 0.14;
      case "footage": return view === "footage";
      default: return false;
    }
  };

  // --- scene props ---------------------------------------------------------------------------------------------
  const base: SceneCommonProps = {
    common: commonView, animate: motionOn, mode, selected, onSelect: (id: string) => select(id), hidden, isolate, interactive: true,
    timeline: sceneId === "saffire" ? null : timeline,
  };
  const passive: SceneCommonProps = { ...base, selected: null, hidden: [], isolate: false, interactive: false };
  const bassView: BassState = mode === "evidence" && bassMeasured
    ? { ...bass, sample: bassSampleOf(detail?.normalized.material_class as string) ?? bass.sample, flow: flowOf(bassMeasured.flow, bass.flow) } : bass;

  let single: AnySceneProps | undefined;
  let split: { left: AnySceneProps; right: AnySceneProps; leftLabel: string; rightLabel: string; note?: string } | undefined;
  if (sceneId === "flex") {
    if (view === "fuels") {
      const mA = mode === "evidence" ? flexMeasuredOf(cA) : null, mB = mode === "evidence" ? flexMeasuredOf(cB) : null;
      split = {
        left: { ...passive, state: { ...flex, fuel: fuelsLR[0] }, measured: mA }, right: { ...passive, state: { ...flex, fuel: fuelsLR[1] }, measured: mB },
        leftLabel: `${FUELS[fuelsLR[0]].label}${mA ? ` · ${mA.label}` : ""}`, rightLabel: `${FUELS[fuelsLR[1]].label}${mB ? ` · ${mB.label}` : ""}`,
        note: mode === "evidence" ? (mA && mB ? "Each side drawn at its test's measured D₀ and D_ext." : "Pick a test for each fuel in Compare to draw measured sizes.") : "Same drawn size and oxygen on both sides; only the fuel-specific features differ.",
      };
    } else if (view === "gravity") {
      split = {
        left: { ...passive, mode: "conceptual", state: { ...flex, gravity: "micro" }, measured: null },
        right: { ...passive, mode: "conceptual", state: { ...flex, gravity: "earth" }, measured: null },
        leftLabel: "Microgravity", rightLabel: "Earth 1 g (conceptual comparison)",
        note: "Qualitative shapes only. The 1 g side is not a FLEX measurement, and microgravity flames are not spherical under every flow condition.",
      };
    } else single = { ...base, state: flex, measured: flexMeasured };
  } else if (sceneId === "bass") {
    if (view === "compare") {
      const mA = bassMeasuredOf(cA), mB = bassMeasuredOf(cB);
      if (mA && mB) {
        split = {
          left: { ...passive, mode: "evidence", state: { ...bass, sample: bassSampleOf(cA?.normalized.material_class as string) ?? bass.sample, flow: flowOf(mA.flow, bass.flow) }, measured: mA },
          right: { ...passive, mode: "evidence", state: { ...bass, sample: bassSampleOf(cB?.normalized.material_class as string) ?? bass.sample, flow: flowOf(mB.flow, bass.flow) }, measured: mB },
          leftLabel: `A · ${mA.label} · ${String(cA?.normalized.material_class)}`, rightLabel: `B · ${mB.label} · ${String(cB?.normalized.material_class)}`,
          note: "Recorded geometry and flow direction for each test; flames and fronts remain illustrative.",
        };
      } else {
        const opp = bass.sample === "rod" && bass.flow === "stagnation" ? "stagnation" : "opposed";
        split = {
          left: { ...passive, state: { ...bass, flow: opp }, measured: null }, right: { ...passive, state: { ...bass, flow: "concurrent" }, measured: null },
          leftLabel: opp === "stagnation" ? "Stagnation" : "Opposed flow", rightLabel: "Concurrent flow",
          note: "Conceptual: the same sample in two flow configurations. Choose two tests in Compare to draw their recorded geometry.",
        };
      }
    } else single = { ...base, state: bassView, measured: bassMeasured };
  } else single = { ...base, state: saffire, measured: saffireMeasured };

  const measuredLabel = mode !== "evidence" ? null
    : flexMeasured && view === "single" ? `test ${flexMeasured.label}: D₀ ${flexMeasured.d0_mm ?? "—"} mm, D_ext ${flexMeasured.dext_mm ?? "—"} mm`
      : bassMeasured && view === "single" ? `test ${bassMeasured.label}: ${bassMeasured.diameter_mm ? `diameter ${bassMeasured.diameter_mm} mm` : bassMeasured.width_cm ? `width ${bassMeasured.width_cm} cm (CSV, nominal)` : "no recorded width"}, ${bassMeasured.flow ?? "flow not recorded"}`
        : saffireMeasured ? `burn ${saffireMeasured.label} (${saffireMeasured.flow}); sample size from the Operations document` : null;

  function resetParams() {
    setFlex(FLEX_DEFAULT); setBass(BASS_DEFAULT); setSaffireLocal(SAFFIRE_DEFAULT);
    setCommonRaw(COMMON_DEFAULT); setMotionPref(null); setHidden([]); setIsolate(false);
    timeline.set({ active: false, playing: false, p: 0 });
    setParams({ component: null, record: null, mode: null, view: null });
    cam?.reset();
  }

  function onTabKey(e: React.KeyboardEvent, i: number) {
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const next = tabs[(i + d + tabs.length) % tabs.length][0];
    setTab(next);
    requestAnimationFrame(() => document.getElementById(`${sceneId}-tab-${next}`)?.focus());
  }

  const presets = sceneId === "saffire" ? SAFFIRE_PRESETS.map((p) => ({
    id: p.id, label: p.label, onSelect: () => { cam?.fly(p.shot, !reduce); setParams({ component: p.component }); },
  })) : undefined;

  const record = detail ? { uid: detail.experiment_uid, label: detail.display_id } : null;
  const fuel = FUELS[mode === "evidence" && flexMeasured?.fuel ? (flexMeasured.fuel as FuelId) : flex.fuel];
  const unavailable = sceneId === "flex" && fuel.id === "Methanol" ? [{ id: "soot", reason: "not drawn: methanol is non-sooting" }] : [];
  const showViewport = sceneId !== "saffire" || view === "3d";
  const timelineOn = sceneId !== "saffire";

  return (
    <section id="studio" ref={section} aria-labelledby={`${sceneId}-studio-title`} data-testid="science-studio"
      className="hairline-top relative scroll-mt-28 overflow-hidden rounded-2xl border border-electric/25 bg-[linear-gradient(165deg,rgba(91,140,255,0.10),rgba(10,20,36,0.94)_42%)] p-3 md:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-[70ch]">
          <p className="kicker">Interactive Science Studio · {scene.source}</p>
          <h2 id={`${sceneId}-studio-title`} className="subhead mt-2 text-[22px] md:text-[26px]">{scene.title} in 3D</h2>
          <p className="mt-1 text-[14px] leading-relaxed text-text-2">{scene.blurb}</p>
        </div>
        <button type="button" onClick={startTour} data-testid="start-tour"
          className="press glow-flame inline-flex min-h-10 items-center gap-2 rounded-lg bg-flame px-4 text-[14.5px] font-semibold text-flame-ink">
          <Icon name="chevron" />Start guided exploration
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-3">
        <Segmented label="Mode" value={mode} onChange={(v) => { setParams({ mode: v === "evidence" ? "evidence" : null }); if (v === "evidence") setTab("evidence"); }}
          options={[["conceptual", MODES.conceptual.label], ["evidence", MODES.evidence.label]]} />
        <Segmented label="View" value={view} onChange={(v) => { setParams({ view: v === views[0][0] ? null : v }); if (v !== views[0][0] && tabs.some(([t]) => t === "compare")) setTab("compare"); }}
          options={views} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_400px] xl:grid-cols-[minmax(0,1fr)_430px]">
        <div className="flex min-w-0 flex-col gap-3">
          <div className="relative h-[58vh] min-h-[360px] overflow-hidden rounded-2xl border border-line/80 bg-[radial-gradient(120%_90%_at_50%_45%,rgba(30,52,90,0.55),rgba(5,10,20,0.98)_70%)] lg:h-[min(72vh,700px)]">
            <div aria-hidden className="tech-grid pointer-events-none absolute inset-0 opacity-60" />
            <div className="absolute inset-0" hidden={!showViewport}>
              {staticView ? (
                <SceneFallback scene={scene} reason="user" onRetry={() => setStaticView(false)} />
              ) : (
                <ViewportBoundary fallback={<SceneFallback scene={scene} reason="error" />}>
                  <StudioViewport sceneId={sceneId} mode={split && view === "gravity" ? "conceptual" : mode} animate={motionOn || tl.playing}
                    measuredLabel={measuredLabel} onStatic={() => setStaticView(true)} cameraRef={setCam} single={single} split={split}
                    legend={LEGEND[sceneId]} timeline={timelineOn ? timeline : null} presets={presets} />
                </ViewportBoundary>
              )}
            </div>
            {sceneId === "saffire" && view === "footage" && (
              <div id="footage" className="absolute inset-0 scroll-mt-28 overflow-y-auto p-4" data-testid="footage-view">
                <p className="mb-3 rounded-lg border border-data/40 bg-void/70 px-3 py-2 text-[12.5px] text-text-2">NASA&apos;s public footage of the real Saffire-I burn. Nothing loads until you press play. The 3D view is not reconstructed from these frames.</p>
                <div className="grid gap-5 xl:grid-cols-2">
                  <MediaPanelBlock id="saffire1-burn-animation">
                    <p className="text-xs text-text-3">A flame front moving along the sample. Its playback rate is not the burn rate: the frames are NASA&apos;s selection, with no scale.</p>
                  </MediaPanelBlock>
                  <MediaPanelBlock id="saffire1-youtube" />
                </div>
              </div>
            )}
            {sceneId === "saffire" && view === "data" && (
              <div className="absolute inset-0 overflow-y-auto bg-ink/80 p-4" data-testid="data-view">
                <SaffireEvidence scene={scene} burn={burn} detail={detail} />
              </div>
            )}
            {tourIdx !== null && (
              <div className="pointer-events-none absolute inset-x-3 bottom-16 z-40 hidden lg:block lg:max-w-[440px]">
                <GuidedTour steps={steps} index={tourIdx} onIndex={(i) => applyStep(i)} onClose={() => setTourIdx(null)} taskDone={taskDone} />
              </div>
            )}
          </div>
          {tourIdx !== null && (
            <div className="lg:hidden">
              <GuidedTour steps={steps} index={tourIdx} onIndex={(i) => applyStep(i)} onClose={() => setTourIdx(null)} taskDone={taskDone} />
            </div>
          )}
          {timelineOn && (
            <TimelineBar store={timeline} stages={sceneId === "flex" ? FLEX_STAGES : BASS_STAGES}
              title={sceneId === "flex" ? "Guided burn timeline" : "Flame-spread timeline"}
              caveat={sceneId === "flex" ? "Illustrative sequence — not a NASA test's timing" : "Illustrative progression — not measured flame-front motion"}
              measured={sceneId === "flex" && detail && flexMeasured ? (
                <>Recorded for test <b className="text-text">{detail.display_id}</b>: burn time <b className="text-data">{fmt(detail.normalized.burn_time_s)} s</b>, test end <b className="text-data">{String(detail.normalized.test_end ?? "—")}</b> <span className="text-text-3">(measured; shown separately, the timeline is not scaled to it)</span></>
              ) : sceneId === "bass" && detail && bassMeasured ? (
                <>Recorded for test <b className="text-text">{detail.display_id}</b>: {detail.report_records.some((r) => Array.isArray(r.values.spread_rate_mm_s))
                  ? <>spread rate {detail.report_records.filter((r) => Array.isArray(r.values.spread_rate_mm_s)).map((r) => `${(r.values.spread_rate_mm_s as number[]).join(", ")} mm/s at ${(r.values.velocity_cm_s as number[] | undefined)?.join(", ") ?? "?"} cm/s (Table ${r.table_id})`).join("; ")}</>
                  : "no spread rate in the report tables"} <span className="text-text-3">(measured; independent of the animation)</span></>
              ) : undefined} />
          )}
        </div>

        <aside aria-label={`${scene.source} studio panel`} className="min-w-0 rounded-2xl border border-line/80 bg-panel/90">
          <div className="flex items-center justify-between border-b border-line/70 px-3 pt-2">
            <div role="tablist" aria-label="Studio panel sections" className="flex gap-1 overflow-x-auto [scrollbar-width:none]">
              {tabs.map(([id, label], i) => (
                <button key={id} id={`${sceneId}-tab-${id}`} type="button" role="tab" aria-selected={tab === id} aria-controls={`${sceneId}-panel-${id}`} tabIndex={tab === id ? 0 : -1}
                  onClick={() => { setTab(id); setPanelOpen(true); }} onKeyDown={(e) => onTabKey(e, i)}
                  className={`press -mb-px shrink-0 rounded-t-lg border-b-2 px-3 py-2 text-sm ${tab === id ? "border-flame text-text" : "border-transparent text-text-2 hover:text-text"}`}>
                  {label}
                </button>
              ))}
            </div>
            <button type="button" className="press ml-2 shrink-0 rounded-md px-2 py-1 text-[12px] text-text-3 hover:text-text lg:hidden" aria-expanded={panelOpen}
              onClick={() => setPanelOpen((o) => !o)}>{panelOpen ? "Collapse" : "Expand"}</button>
          </div>
          {tabs.map(([id]) => (
            <div key={id} id={`${sceneId}-panel-${id}`} role="tabpanel" aria-labelledby={`${sceneId}-tab-${id}`} hidden={tab !== id || !panelOpen}
              className="max-h-none overflow-y-auto p-4 lg:max-h-[min(80vh,860px)]">
              {id === "explore" && (
                <ControlPanel scene={sceneId} mode={mode} common={commonView} setCommon={setCommon} flex={flex} setFlex={setFlex}
                  bass={bass} setBass={setBass} saffire={saffire} setSaffire={setSaffire} onReset={resetParams} onStatic={() => setStaticView(true)} locked={locked}
                  flexCoverage={coverage} bassCounts={bassCounts}
                  extra={sceneId === "flex" ? (
                    <section aria-labelledby="fuel-h" className="rounded-xl border border-line/80 bg-ink/60 p-3" data-testid="fuel-info">
                      <h3 id="fuel-h" className="subhead text-[15px]">{fuel.label} <span className="text-[12.5px] font-normal text-text-3">{fuel.formula} · {fuel.family}</span></h3>
                      <ul className="mt-1.5 flex flex-col gap-1.5 text-[13px] text-text-2">
                        {fuel.facts.map((f) => <li key={f.text}>{f.text} <a href={f.source.href} target="_blank" rel="noreferrer" className="text-[12px]">[{f.source.label.split(" (")[0]}]</a></li>)}
                      </ul>
                      <p className="mt-2 text-[12.5px] text-text-2"><span className="text-text-3">In the 3D view: </span>{fuel.visual}</p>
                      {fuel.mediaId ? <div className="mt-2 max-w-[260px]"><MediaFigure id={fuel.mediaId} aspect="4 / 3" compact sizes="260px" caption={fuel.mediaNote} /></div>
                        : <p className="mt-2 text-[12px] text-text-3">{fuel.mediaNote}</p>}
                      <p className="mt-2 text-[12px] text-text-3">Limits: {fuel.limits}</p>
                    </section>
                  ) : sceneId === "saffire" ? (
                    <section aria-labelledby="preset-h" className="rounded-xl border border-line/80 p-3">
                      <h3 id="preset-h" className="text-[12.5px] font-medium text-text-3">Camera presets</h3>
                      <div className="mt-2 flex flex-wrap gap-1.5">{presets?.map((p) => (
                        <button key={p.id} type="button" onClick={p.onSelect} className="press rounded-full border border-line-strong px-3 py-1 text-[13px] text-text-2 hover:border-electric hover:text-text">{p.label}</button>))}</div>
                    </section>
                  ) : undefined} />
              )}
              {id === "layers" && (
                <LayerInspector scene={scene} mode={mode} selected={selected} onSelect={select} hidden={hidden} setHidden={setHidden}
                  isolate={isolate} setIsolate={setIsolate} record={record} unavailable={unavailable} />
              )}
              {id === "evidence" && (
                <EvidencePanel scene={scene} flex={flex} bass={bass} saffireBurn={burn} uid={recordUid}
                  onRecord={(uid) => setParams({ record: uid })} detail={detail} />
              )}
              {id === "compare" && view === views[0][0] && (
                <div className="mb-4 rounded-xl border border-electric/40 bg-electric/[0.06] p-3 text-[13px] text-text-2" data-testid="compare-switch">
                  <p>The 3D view is showing a single {sceneId === "flex" ? "droplet" : "sample"}. Switch to a side-by-side view (both halves share one camera):</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {views.slice(1).map(([v, label]) => (
                      <button key={v} type="button" onClick={() => setParams({ view: v })}
                        className="press rounded-lg border border-electric/60 px-3 py-1.5 text-[13px] text-text hover:bg-electric/10">{label}</button>
                    ))}
                  </div>
                </div>
              )}
              {id === "compare" && sceneId === "flex" && (
                <div className="flex flex-col gap-4">
                  <Segmented label="Comparison" value={view === "gravity" ? "gravity" : "fuels"} onChange={(v) => setParams({ view: v })}
                    options={[["fuels", "Compare fuels"], ["gravity", "Earth vs microgravity"]]} />
                  {view === "gravity" ? (
                    <div className="flex flex-col gap-3 text-[13.5px] text-text-2" data-testid="gravity-compare">
                      <p>Left: the conceptual microgravity flame, a near-spherical shell fed by diffusion. Right: the same droplet with buoyancy, where hot gas rises, the flame stretches into a teardrop and an updraft replaces radial inflow.</p>
                      <MediaFigure id="flex-1g-vs-microgravity" aspect="3 / 4" fit="contain" compact sizes="260px" className="max-w-[240px]"
                        caption="NASA FLEX comparison: microgravity flame (top, ISS) vs 1 g flame (bottom). Real imagery; the 3D views are conceptual." />
                      <p className="text-[12.5px] text-text-3">The 1 g side is a conceptual comparison, not a FLEX measurement: every FLEX test ran in microgravity. A microgravity flame is not spherical under every condition; any forced flow or drift breaks the symmetry.</p>
                    </div>
                  ) : (
                    <FuelCompare left={fuelsLR[0]} right={fuelsLR[1]} setLeft={(f) => setFuelsLR([f, fuelsLR[1]])} setRight={(f) => setFuelsLR([fuelsLR[0], f])}
                      o2={flex.o2} d0={flex.d0} recA={cmpA} recB={cmpB} setRecA={setCmpA} setRecB={setCmpB} />
                  )}
                </div>
              )}
              {id === "compare" && sceneId === "bass" && <BassCompare recA={cmpA} recB={cmpB} setRecA={setCmpA} setRecB={setCmpB} />}
            </div>
          ))}
        </aside>
      </div>
    </section>
  );
}

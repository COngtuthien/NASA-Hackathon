// Interactive Combustion Lab: scenes, inspectable components and the provenance of each drawn feature.
import { SOURCES, type Basis, type SourceRef } from "@/lib/lab-scientific-metadata";
import { ROUTES } from "@/lib/routes";

export type SceneId = "flex" | "bass" | "saffire";

export type LabComponent = {
  id: string;
  label: string;
  /** Short explanation shown when the component is selected. */
  summary: string;
  basis: Basis;
  /** What exactly is confirmed vs assumed for this component. */
  provenance: string;
  sources: SourceRef[];
  /** Phrase used to draft a Research Copilot question (never sent automatically). */
  askAbout: string;
};

export type LabScene = {
  id: SceneId;
  title: string;
  short: string;
  source: string;
  inv: string;
  dataset: string;
  phenomenonHref: string;
  phenomenonTitle: string;
  scale: string;
  blurb: string;
  components: LabComponent[];
  /** Plain-language description of the scene for screen readers and the static fallback. */
  textAlternative: string;
};

export const SCENES: LabScene[] = [
  {
    id: "flex", title: "Droplet Combustion", short: "Droplet", source: "FLEX", inv: "PSI-69", dataset: "flex",
    phenomenonHref: ROUTES.extinction, phenomenonTitle: "Flame Extinction & Burning Dynamics", scale: "Millimetre scale",
    blurb: "A fuel droplet wrapped in its flame. Compare the near-spherical microgravity flame with the buoyant 1 g teardrop, then inspect a real FLEX test.",
    textAlternative: "A small liquid fuel droplet sits at the centre. Around it a translucent flame envelope is drawn several droplet diameters away. In microgravity the envelope is a near-sphere; in the 1 g comparison it stretches upward into a teardrop. Optional arrows show fuel vapour moving outward and oxygen moving inward (microgravity) or an upward buoyant flow (1 g). A millimetre scale bar sits beside the droplet.",
    components: [
      { id: "droplet", label: "Fuel droplet", basis: "documented-principle",
        summary: "A liquid fuel droplet (methanol or n-heptane in FLEX). In the MDCA apparatus a droplet can be formed between two hollow needles that then retract, leaving it free-floating, and hot-wire igniters retract once it lights.",
        provenance: "Deployment and ignition sequence as documented for MDCA runs by Liu et al.; whether an individual FLEX test was free-floating is not in the CSV. The droplet is drawn as a perfect sphere; its drawn diameter follows the slider (conceptual) or the selected test's measured D₀ (evidence mode).",
        sources: [SOURCES.liuP4, SOURCES.psi69], askAbout: "the burning fuel droplet" },
      { id: "surface", label: "Fuel surface", basis: "documented-principle",
        summary: "Liquid evaporates from the droplet surface; the vapour diffuses outward and burns where it meets oxygen. The square of the diameter shrinks roughly linearly in time in the classical d²-law.",
        provenance: "Classical theory (no soot, no radiation, quasi-steady) as summarised by Liu et al. The surface is not animated to shrink: no validated burn model drives this scene.",
        sources: [SOURCES.liuP2], askAbout: "evaporation at the droplet surface and the d²-law" },
      { id: "flame", label: "Flame envelope", basis: "documented-principle",
        summary: "A diffusion flame where fuel vapour and oxygen meet. With buoyancy suppressed it can approach spherical symmetry; at 1 g buoyancy stretches it upward.",
        provenance: "Shape behaviour is documented qualitatively (NASA FLEX 1 g vs microgravity image; Liu et al.). The flame is drawn at a fixed 4× the droplet radius for legibility: real flame standoff varies with fuel, oxygen and time and is not represented.",
        sources: [SOURCES.liuP2], askAbout: "the flame envelope around a burning droplet in microgravity" },
      { id: "soot", label: "Soot shell (n-heptane)", basis: "documented-principle",
        summary: "For n-heptane, NASA imagery shows soot forming near the droplet and spiralling out of the flame zone.",
        provenance: "Shown only when n-heptane is selected, based on NASA's FLEX soot composite caption. Its radius and density are illustrative. No soot shell is drawn for methanol because the local sources used here document soot only for heptane.",
        sources: [{ label: "NASA image: Burning in Microgravity (FLEX heptane soot)", href: "https://www.nasa.gov/image-article/burning-microgravity/", external: true }],
        askAbout: "soot formation around n-heptane droplet flames" },
      { id: "ambient", label: "Ambient gas", basis: "illustrative",
        summary: "The surrounding atmosphere: O₂ with N₂ and, in many FLEX tests, CO₂ or helium as diluent.",
        provenance: "Dots are illustrative: the cyan share follows the oxygen slider (conceptual) or the selected test's recorded O₂ mole fraction (evidence mode). Dot motion is decorative.",
        sources: [SOURCES.psi69], askAbout: "how ambient oxygen and diluents affect FLEX droplet flames" },
      { id: "transport", label: "Transport (conceptual)", basis: "documented-principle",
        summary: "Microgravity: fuel vapour diffuses outward, oxygen inward, meeting at the flame. 1 g: buoyancy drives an upward flow past the droplet.",
        provenance: "Directions follow the classical spherically symmetric picture and the documented buoyancy effect. Arrow speed and spacing are illustrative, not velocities.",
        sources: [SOURCES.liuP2, SOURCES.flexEird74], askAbout: "how fuel vapour and oxygen are transported to a droplet flame without buoyancy" },
    ],
  },
  {
    id: "bass", title: "Flame Spread over Solids", short: "Flame spread", source: "BASS-II", inv: "PSI-25", dataset: "bass2",
    phenomenonHref: ROUTES.spread, phenomenonTitle: "Flame Spread & Material Behavior", scale: "Centimetre scale",
    blurb: "A solid sample inside the BASS-II flow duct. Change the sample type and whether the flame spreads against or with the airflow.",
    textAlternative: "A rectangular flow duct, 7.6 by 7.6 by 17 centimetres as documented, with a fan and honeycomb flow straightener at the upstream end. A solid sample sits on a holder along the duct axis. Cyan arrows show the airflow from inlet to outlet. A flame region sits on the sample, and an illustrative flame front moves either toward the incoming air (opposed spread) or with it (concurrent spread). A radiometer sits in the downstream top back corner.",
    components: [
      { id: "duct", label: "Flow duct", basis: "confirmed",
        summary: "Black anodized 7.6 × 7.6 × 17 cm rectangular duct with rounded corners, installed in the Microgravity Science Glovebox (255 L).",
        provenance: "Outer dimensions and the 17 cm test section are stated in the BASS-II Summary Report; wall thickness and corner radius are illustrative.",
        sources: [SOURCES.bassP12, SOURCES.bassP64], askAbout: "the BASS-II flow duct" },
      { id: "fan", label: "Fan and flow restrictors", basis: "confirmed",
        summary: "A variable-speed fan blows air through the duct. Up to two flow restrictors at the fan inlet lower the maximum flow from ~55 cm/s to ~35 cm/s.",
        provenance: "Components and flow limits from the Summary Report. Their drawn size and position upstream of the test section are illustrative.",
        sources: [SOURCES.bassP12], askAbout: "how the BASS-II fan and flow restrictors set the airflow" },
      { id: "straightener", label: "Honeycomb straightener and screen", basis: "confirmed",
        summary: "The flow passes a honeycomb straightener and an inlet screen to reduce swirl; an omnidirectional airspeed transducer sits between them.",
        provenance: "Order of components from the Summary Report; cell size is illustrative.",
        sources: [SOURCES.bassP12], askAbout: "flow conditioning in the BASS-II duct" },
      { id: "sample", label: "Solid sample", basis: "confirmed",
        summary: "PMMA rods (6.35–12.7 mm), slabs (0.125–5 mm thick), a section of a 4 cm sphere, or 1–2 cm wide cotton-fiberglass fabric strips.",
        provenance: "Geometry ranges from the Summary Report. Sample length is illustrative. In evidence mode the drawn width or diameter follows the selected test's CSV value when one exists.",
        sources: [SOURCES.bassP13], askAbout: "the solid sample geometries burned in BASS-II" },
      { id: "holder", label: "Sample holder", basis: "illustrative",
        summary: "Holds the sample along the duct axis so it can burn in opposed or concurrent flow.",
        provenance: "The report says samples could be mounted for opposed or concurrent burning; the holder's shape here is assumed.",
        sources: [SOURCES.bassP13], askAbout: "how BASS-II samples were mounted for opposed or concurrent flame spread" },
      { id: "flame", label: "Flame and flame front", basis: "documented-principle",
        summary: "Opposed spread: the flame creeps toward the incoming air. Concurrent spread: it moves with the air, with a longer flame trailing downstream. Spread slows as opposed flow is reduced, and the flame can go out.",
        provenance: "Qualitative behaviour from the Summary Report. The moving front is illustrative: its speed is not a measured spread rate (measured rates are in the evidence panel, Table 5.1).",
        sources: [SOURCES.bassP27, SOURCES.bassP64], askAbout: "opposed versus concurrent flame spread over solids in microgravity" },
      { id: "igniter", label: "Hot-wire igniter", basis: "confirmed",
        summary: "A Kanthal A-1 hot-wire coil swung into position by a crew-pulled lever.",
        provenance: "Igniter type from the Summary Report; drawn position is illustrative.",
        sources: [SOURCES.bassP13], askAbout: "how BASS-II samples were ignited" },
      { id: "radiometer", label: "Radiometer", basis: "confirmed",
        summary: "A thermopile detector in the downstream top back corner of the duct, looking upstream. Its signal was not calibrated but tracked flame steadiness.",
        provenance: "Position stated in the Summary Report.",
        sources: [SOURCES.bassP12, SOURCES.bassP13], askAbout: "what the BASS-II radiometer measured" },
    ],
  },
  {
    id: "saffire", title: "Spacecraft Fire Safety", short: "Spacecraft", source: "SAFFIRE-I", inv: "PSI-98", dataset: "saffire1",
    phenomenonHref: ROUTES.spacecraft, phenomenonTitle: "Spacecraft Fire Dynamics", scale: "Metre scale",
    blurb: "A conceptual arrangement of the Saffire-I flow duct: a large fabric sample card, fans, flow straighteners and diagnostics. Open the cutaway to look inside.",
    textAlternative: "A conceptual experiment enclosure, roughly 0.5 by 1 by 1.3 metres as NASA describes it. Inside, a flow duct holds a large fabric sample card, about 0.4 metres wide and 0.94 metres tall, in its middle. Flow straighteners sit at the bottom and fans at the top, so air is drawn upward past the sample. Two cameras and several sensors are shown in illustrative positions. A flame-spread arrow shows the direction recorded in the CSV for the selected burn: with the airflow (concurrent) or against it (opposed).",
    components: [
      { id: "enclosure", label: "Experiment enclosure", basis: "illustrative",
        summary: "The Saffire-I unit flew inside the Cygnus cargo vehicle and burned its sample after Cygnus left the space station.",
        provenance: "NASA Glenn describes the enclosure as about 0.5 m wide, 1 m deep and 1.3 m long; how those dimensions map onto the axes drawn here is assumed, and external details are simplified. This is not a reconstruction of the flight hardware.",
        sources: [{ label: "NASA Glenn: NASA Ignites Fire Experiment Aboard Space Cargo Ship", href: "https://www.nasa.gov/centers-and-facilities/glenn/nasa-ignites-fire-experiment-aboard-space-cargo-ship/", external: true }, SOURCES.saffireOps],
        askAbout: "the Saffire-I experiment enclosure aboard Cygnus" },
      { id: "duct", label: "Flow duct", basis: "confirmed",
        summary: "A large flow duct with the sample card in its middle. The crew checked that its inlet and outlet were clear of stowage before unberthing.",
        provenance: "Existence and the sample-in-the-middle arrangement from the ISA-Tab and Operations documents; the duct's drawn cross-section is illustrative.",
        sources: [SOURCES.saffireIsa, SOURCES.saffireOps], askAbout: "the Saffire-I flow duct" },
      { id: "sample", label: "Sample card (SIBAL fabric)", basis: "confirmed",
        summary: "A cotton-fiberglass composite (75 % cotton, 25 % fiberglass by weight), approximately 0.4 m wide by 0.94 m tall.",
        provenance: "Size from the Operations document. The CSV lists Length 40.6 cm and Width 94.0 cm, which appear swapped (flag SAF-LENGTH-WIDTH); the drawing follows the document and the conflict stays visible in the evidence panel.",
        sources: [SOURCES.saffireOps, SOURCES.saffireDod], askAbout: "the Saffire-I SIBAL fabric sample" },
      { id: "fans", label: "Fans (top of duct)", basis: "confirmed",
        summary: "Air is drawn through the flow duct by fans at the top of the duct; Saffire-I ran at 20 cm/s.",
        provenance: "Location (top) and flow speed from the ISA-Tab and the Description of Data. Fan count and size are illustrative.",
        sources: [SOURCES.saffireIsa, SOURCES.saffireDod], askAbout: "the airflow in the Saffire-I flow duct" },
      { id: "straighteners", label: "Flow straighteners (bottom)", basis: "confirmed",
        summary: "Flow straighteners at the bottom of the experiment module condition the air before it reaches the sample.",
        provenance: "Location from the ISA-Tab; geometry illustrative.",
        sources: [SOURCES.saffireIsa], askAbout: "the Saffire-I flow straighteners" },
      { id: "cameras", label: "Two cameras", basis: "confirmed",
        summary: "Two cameras (C1, C2) recorded the burn; images were compressed and downlinked after the test.",
        provenance: "Camera count and labels from the ISA-Tab and Description of Data; positions and viewing angles are illustrative.",
        sources: [SOURCES.saffireIsa, SOURCES.saffireDod], askAbout: "the Saffire-I cameras and image downlink" },
      { id: "sensors", label: "Diagnostics", basis: "confirmed",
        summary: "Thermocouples (flow, flame and plume temperatures), two radiometers, solid-state pressure, CO₂ and O₂ sensors, and two anemometers.",
        provenance: "Sensor list from the ISA-Tab. Their positions here are illustrative. None of these sensor time series are in SpaceFire's local data.",
        sources: [SOURCES.saffireIsa], askAbout: "the Saffire-I diagnostics and which data are available" },
      { id: "flame", label: "Flame-spread direction", basis: "confirmed",
        summary: "The CSV records S1 as concurrent (flame moving with the airflow) and S2 as opposed (against it).",
        provenance: "Direction per burn from the CSV. The glowing band and its motion are illustrative: the local data has no flame position, spread rate or ignition location, so none is drawn as measured.",
        sources: [SOURCES.psi98], askAbout: "concurrent versus opposed flame spread in Saffire-I" },
    ],
  },
];

export const SCENE_BY_ID: Record<SceneId, LabScene> = Object.fromEntries(SCENES.map((s) => [s.id, s])) as Record<SceneId, LabScene>;

export function isSceneId(v: string | null | undefined): v is SceneId {
  return v === "flex" || v === "bass" || v === "saffire";
}

/** Which lab scene an experiment record belongs to (for links from detail pages). */
export const SCENE_OF_DATASET: Record<string, SceneId> = { flex: "flex", bass2: "bass", saffire1: "saffire" };

export function labHref(scene: SceneId, record?: string | null, component?: string | null): string {
  const p = new URLSearchParams({ scene });
  if (record) p.set("record", record);
  if (component) p.set("component", component);
  return `${ROUTES.lab}?${p.toString()}`;
}

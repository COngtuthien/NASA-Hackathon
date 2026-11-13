// Guided exploration scripts for the three studios. Each step may select (and focus) a component, move the camera
// to a preset, set scene state, switch view/mode/tab, position the illustrative timeline, and ask the visitor to do
// one interaction (checked by the studio). No step calls the Research Copilot or any model.
import type { SceneId } from "@/lib/lab-models";
import { SOURCES, type Mode, type SourceRef } from "@/lib/lab-scientific-metadata";

export type TourStep = {
  id: string;
  title: string;
  body: string;
  select?: string | null;
  preset?: string;
  patch?: Record<string, unknown>;
  view?: string;
  mode?: Mode;
  tab?: string;
  timeline?: number | "off";
  task?: { id: string; prompt: string };
  sources?: SourceRef[];
  takeaway?: boolean;
};

const glenn: SourceRef = { label: "NASA Glenn: NASA Ignites Fire Experiment Aboard Space Cargo Ship", href: "https://www.nasa.gov/centers-and-facilities/glenn/nasa-ignites-fire-experiment-aboard-space-cargo-ship/", external: true };

export const TOURS: Record<SceneId, TourStep[]> = {
  flex: [
    { id: "intro", title: "Why burn a single droplet in orbit?", select: null, view: "single", mode: "conceptual", timeline: "off", patch: { gravity: "micro" },
      body: "FLEX burned isolated methanol and n-heptane droplets aboard the ISS, many with CO₂ or helium added, to see how burning and extinction depend on the atmosphere. Without buoyancy the flame can wrap the droplet almost symmetrically, a geometry that simple theory can describe.",
      sources: [SOURCES.liuP2, SOURCES.psi69] },
    { id: "droplet", title: "The droplet", select: "droplet",
      body: "In the droplet apparatus a droplet forms between two hollow needles, which retract and leave it nearly stationary; hot wires ignite it and retract. Liquid evaporates from its surface, and the vapour feeds the flame.",
      sources: [SOURCES.liuP4] },
    { id: "flame", title: "A flame shell, not a candle flame", select: "flame",
      body: "The flame sits where outward-diffusing fuel vapour meets inward-diffusing oxygen. In microgravity, with buoyant convection suppressed, it can approach a sphere. Its drawn size (4× the droplet radius) is illustrative: real standoff varies with diameter and time.",
      sources: [SOURCES.liuP2, SOURCES.liuP8] },
    { id: "gravity", title: "Try it: turn gravity on", select: null, tab: "explore",
      task: { id: "earth", prompt: "Switch the gravity environment to Earth." },
      body: "On Earth, hot gas rises: buoyancy drags the flame upward into a teardrop and drives a flow past the droplet. The Earth view is a qualitative comparison, not a FLEX measurement: every FLEX test ran in microgravity." },
    { id: "transport", title: "What feeds the flame", select: "oxygen", patch: { gravity: "micro" },
      body: "Back in microgravity, transport is by diffusion: oxygen moves inward from the surroundings (cyan) while fuel vapour moves outward (amber). Arrow and particle speeds are illustrative, not velocities.",
      sources: [SOURCES.liuP2] },
    { id: "fuels", title: "Try it: compare the two FLEX fuels", select: "soot", patch: { fuel: "Heptane" },
      task: { id: "methanol", prompt: "Switch the fuel to Methanol and watch the soot shell disappear." },
      body: "n-Heptane is a sooting fuel: soot forms between droplet and flame. Methanol is a non-sooting alcohol. For large heptane droplets the visible flame can go out while a low-temperature “cool flame” keeps burning; methanol shows classical radiative extinction.",
      sources: [SOURCES.flexEird36, SOURCES.faroukP2] },
    { id: "timeline", title: "A burn, step by step", select: null, timeline: 0.45,
      body: "The burn timeline steps through formation, ignition, burning, regression and extinction. It is a conceptual sequence on a normalized axis. A real test's recorded burn time is shown separately and never stretched to fit the animation." },
    { id: "evidence", title: "Try it: open a real NASA test", mode: "evidence", tab: "evidence", timeline: "off",
      task: { id: "record", prompt: "Pick a FLEX test in the evidence panel." },
      body: "NASA Evidence mode draws a real test's measured initial diameter D₀ and extinction diameter D_ext, and the panel lists its recorded values: the burning-rate constant K in mm²/s (raw header ‘Burning rate; mm’), burn time and outcome, with every data-quality flag." },
    { id: "takeaway", title: "Takeaway", takeaway: true,
      body: "Without buoyancy a droplet flame becomes a nearly spherical shell fed purely by diffusion, which is what makes FLEX droplets a clean test of combustion theory. The pictures here explain that geometry; the numbers come only from NASA's records, and an idealized d²-law calculation is available for tests with a recorded D₀ and K." },
  ],
  bass: [
    { id: "intro", title: "How does a flame spread over a solid in orbit?", select: null, view: "single", mode: "conceptual", timeline: "off",
      body: "BASS-II burned small solid samples inside a flow duct in the Microgravity Science Glovebox, varying airflow, oxygen and sample geometry, to see when flames spread, how fast, and when they go out.",
      sources: [SOURCES.bassP12, SOURCES.psi25] },
    { id: "duct", title: "The flow duct", select: "duct",
      body: "A black anodized 7.6 × 7.6 × 17 cm duct with rounded corners. Gas analyzers measured O₂, CO and CO₂ in the glovebox before and after each burn.",
      sources: [SOURCES.bassP12] },
    { id: "fan", title: "Controlling the airflow", select: "fan",
      body: "A variable-speed fan blows air through the duct. Up to two flow restrictors at the fan inlet lower the maximum flow from about 55 to about 35 cm/s. A honeycomb straightener and screen reduce swirl before the test section.",
      sources: [SOURCES.bassP12] },
    { id: "sample", title: "Try it: change the sample", select: "sample", tab: "explore",
      task: { id: "rod", prompt: "Choose the PMMA rod sample." },
      body: "BASS-II used PMMA rods (6.35–12.7 mm), slabs (0.125–5 mm thick), a 4 cm sphere section, and 1–2 cm wide cotton-fiberglass fabric. Geometry changes how heat reaches unburned material.",
      sources: [SOURCES.bassP13] },
    { id: "flow", title: "Try it: opposed vs concurrent", select: "flame", patch: { sample: "slab", flow: "opposed" }, timeline: 0.3,
      task: { id: "concurrent", prompt: "Switch the flame spread to Concurrent and press Play on the timeline." },
      body: "In opposed spread the flame creeps toward the incoming air; in concurrent spread it moves with the air and the flame trails downstream. The timeline shows the direction only: its speed is not a measured flame-front motion.",
      sources: [SOURCES.bassP27, SOURCES.bassP64] },
    { id: "igniter", title: "Ignition", select: "igniter",
      body: "A Kanthal A-1 hot-wire coil was swung into place by a crew-pulled lever. Its drawn position at the end where spread starts is illustrative.",
      sources: [SOURCES.bassP13] },
    { id: "radiometer", title: "Diagnostics", select: "radiometer",
      body: "A thermopile radiometer in the downstream top back corner looks upstream at the flame. Its signal was not calibrated, but it tracked flame steadiness. Still and video cameras recorded the flame for later tracking.",
      sources: [SOURCES.bassP12, SOURCES.bassP13] },
    { id: "evidence", title: "Reading a spread-rate measurement", mode: "evidence", tab: "evidence", timeline: "off",
      task: { id: "record", prompt: "Pick a BASS-II test in the evidence panel." },
      body: "Measured spread rates (mm/s) come from NASA's Table 5.1, tracked from video at a stated flow velocity. Each belongs to one test and flow stage. The CSV and the report disagree on some sample widths (nominal vs actual), and both are shown." },
    { id: "takeaway", title: "Takeaway", takeaway: true,
      body: "Flow direction and speed shape how a flame spreads over a solid: the same material can spread readily in one configuration and go out in another. Comparing tests is only meaningful when geometry, oxygen and flow are matched, and the comparison panel flags where they are not." },
  ],
  saffire: [
    { id: "intro", title: "A real fire in a real spacecraft", select: null, preset: "overview", view: "3d", mode: "conceptual",
      body: "Saffire-I lit a large fabric sheet inside the Cygnus cargo vehicle on 14 June 2016, after it left the space station, to see how a fire grows at spacecraft scale in low gravity.",
      sources: [SOURCES.saffireOps, SOURCES.saffireDod] },
    { id: "sample", title: "The sample", select: "sample", preset: "sample",
      body: "A cotton-fiberglass SIBAL sheet about 0.4 m wide by 0.94 m tall, mounted as a card in the middle of a large flow duct. The CSV's length and width columns appear swapped; the drawing follows the Operations document.",
      sources: [SOURCES.saffireOps, SOURCES.saffireIsa] },
    { id: "flow", title: "Airflow", select: "fans", preset: "flow",
      body: "Fans at the top of the duct draw air upward through flow straighteners at the bottom, past the sample, at 20 cm/s.",
      sources: [SOURCES.saffireIsa, SOURCES.saffireDod] },
    { id: "ignition", title: "Ignition", select: "flame", preset: "sample",
      body: "NASA describes ignition by a hot wire. The ignition location is not in SpaceFire's local data, so it is not drawn. The CSV records S1 as concurrent and S2 as opposed spread.",
      sources: [glenn, SOURCES.psi98] },
    { id: "diagnostics", title: "Diagnostics", select: "sensors", preset: "diagnostics",
      body: "Two cameras recorded the burn, alongside thermocouples, two radiometers, O₂, CO₂ and pressure sensors and two anemometers. The positions shown are illustrative, and none of these sensor time series are in the local data.",
      sources: [SOURCES.saffireIsa] },
    { id: "footage", title: "Try it: see what NASA filmed", view: "footage",
      task: { id: "footage", prompt: "Open the NASA footage view (it is already open: press play on the animation if you like)." },
      body: "NASA's footage shows the real flame front. Nothing in the 3D view is reconstructed from those frames; the local manifest has file names and times only." },
    { id: "limits", title: "What the data can and cannot say", view: "3d", mode: "evidence", tab: "evidence",
      body: "Two burn rows (S1, S2) with different flow directions, a manifest with a large Sample 2 downlink gap, and no flame-position, spread-rate or temperature data. Burn times differ partly because the flow direction differs: they are not a material property." },
    { id: "takeaway", title: "Takeaway", takeaway: true,
      body: "Saffire-I ran and recorded a large-scale fire inside a spacecraft, the first of three Saffire flights. The arrangement here is conceptual; the authoritative record is NASA's footage, documents and the two CSV rows.",
      sources: [SOURCES.saffireOps] },
  ],
};

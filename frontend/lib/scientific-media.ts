/**
 * Scientific media registry: every photograph, video and animation shown in SpaceFire AI, with its provenance.
 *
 * Rules (see docs/SCIENTIFIC_MEDIA_SOURCES.md):
 * - Metadata is copied from the original NASA record (NASA Image and Video Library API, nasa.gov / science.nasa.gov
 *   article captions, Wikimedia Commons file page). Nothing here is invented; unknown fields stay undefined.
 * - `relation` separates real media of the named investigation ("experimental"), authentic NASA media of a related
 *   investigation or of the vehicle/apparatus ("related"), and explanatory drawings ("illustration").
 * - `testId` is set only when NASA's own record names the test. No asset in this registry is attached to a test ID.
 * - Images are context, never numerical evidence: measurements come from the NASA CSV files and documents.
 *
 * Usage: NASA content is generally not subject to copyright in the United States and may be used for educational
 * web pages with NASA credited, without implying endorsement (nasa.gov/nasa-brand-center/images-and-media).
 * Images that use the NASA insignia as a graphic element (e.g. a print layout) were excluded; insignia that appear
 * incidentally on hardware in NASA's own documentary photos are left as photographed.
 */

export type Relation = "experimental" | "related" | "illustration";
export type MediaType = "image" | "video" | "animation" | "illustration";
export type Phenomenon = "droplet" | "spread" | "spacecraft" | "general";

export type Variant = { src: string; width: number; height: number };

export type ScientificMedia = {
  id: string;
  title: string;
  description: string;
  /** What a viewer can actually see, written for the caption. */
  visible: string;
  investigation: "FLEX" | "FLEX-2" | "BASS-II" | "BASS" | "SAFFIRE-I" | "CFI-G" | "SoFIE";
  /** PSI investigation of the SpaceFire dataset this item gives context to. */
  datasetInv: "PSI-69" | "PSI-25" | "PSI-98";
  phenomenon: Phenomenon;
  type: MediaType;
  relation: Relation;
  /** Why the relation is what it is (shown on hover / in the detail view). */
  relationNote: string;
  sourceUrl: string;
  sourceLabel: string;
  credit: string;
  date?: string;
  nasaId?: string;
  testId?: undefined;
  license: string;
  alt: string;
  variants: Variant[];
  poster?: Variant;
  animation?: string;
  video?: { src: string; mime: string; durationNote: string };
  embed?: { provider: "youtube"; videoId: string; title: string; channel: string };
  reference?: { label: string; href: string };
  related?: { label: string; href: string }[];
  /** Short note on what the medium cannot show. Displayed with the media. */
  caveat?: string;
};

const NASA_PD = "NASA media, not subject to U.S. copyright; educational use with credit, no endorsement implied.";
const v = (id: string, sizes: [number, number][]): Variant[] =>
  sizes.map(([w, h]) => ({ src: `/media/${id}/${w}.webp`, width: w, height: h }));
const lib = (nasaId: string) => `https://images.nasa.gov/details/${nasaId}`;

export const MEDIA: ScientificMedia[] = [
  // ------------------------------------------------------------------ FLEX (PSI-69) ---
  {
    id: "flex-heptane-soot-composite", title: "Burning heptane droplet and soot in microgravity",
    description: "A 3-millimetre heptane droplet burning in microgravity in the Flame Extinguishment Experiment. A backlight and video camera make soot visible as a dark cloud; image processing measures its concentration. The droplet shrinks as it burns, while soot particles (green) form near the liquid and spiral out of the flame zone as long, twisting streamers.",
    visible: "Colorized composite of video frames: the shrinking droplet and soot streamers (false colour).",
    investigation: "FLEX", datasetInv: "PSI-69", phenomenon: "droplet", type: "image", relation: "experimental",
    relationNote: "NASA's caption identifies the Flame Extinguishing Experiment (FLEX) droplet. It is a processed, colorized composite of video frames, not a single photograph, and no test number is given.",
    sourceUrl: "https://www.nasa.gov/image-article/burning-microgravity/", sourceLabel: "NASA, Burning in Microgravity",
    credit: "NASA", date: "2011-05-25", license: NASA_PD,
    alt: "False-colour composite of a burning heptane droplet: a central droplet image with green and yellow soot streamers spiralling outward on a red background.",
    variants: v("flex-heptane-soot-composite", [[480, 360], [960, 720]]),
    related: [{ label: "Flame extinction & burning dynamics", href: "/phenomena/flame-extinction" }],
    caveat: "Colours are added by image processing; the soot concentration is not readable from this picture.",
  },
  {
    id: "flex-1g-vs-microgravity", title: "Droplet flame on Earth vs aboard the ISS",
    description: "NASA's FLEX comparison of droplet combustion in normal gravity and in microgravity. On Earth buoyancy stretches the flame upward into a teardrop; aboard the ISS the flame surrounds the droplet as a near-spherical shell.",
    visible: "Top: microgravity droplet flame (ISS), a dim blue sphere. Bottom: a 1-g droplet flame, a bright yellow teardrop.",
    investigation: "FLEX", datasetInv: "PSI-69", phenomenon: "droplet", type: "image", relation: "experimental",
    relationNote: "Published by NASA Science on its Flame Extinguishment Experiment (FLEX) page with the caption '1-g and micro-g droplet combustion'. No test number is given.",
    sourceUrl: "https://science.nasa.gov/image-detail/screenshot-2024-03-29-at-10-02-47-am/", sourceLabel: "NASA Science, Flame Extinguishment Experiment (FLEX)",
    credit: "NASA", license: NASA_PD,
    alt: "Two droplet flames stacked vertically: a small blue spherical flame labelled ISS above a tall yellow teardrop flame labelled 1-g.",
    variants: v("flex-1g-vs-microgravity", [[292, 800]]),
    related: [{ label: "Flame extinction & burning dynamics", href: "/phenomena/flame-extinction" }],
  },
  {
    id: "flex2-mdca-apparatus", title: "The droplet combustion apparatus (MDCA) being prepared for FLEX-2",
    description: "Astronaut Terry Virts prepares the Multi-user Droplet Combustion Apparatus inside the Combustion Integrated Rack for runs of FLEX-2, which studies how quickly fuel burns, when soot forms and how fuel mixtures evaporate before burning.",
    visible: "An astronaut working at the open combustion rack aboard the ISS; the apparatus that holds and ignites the droplets.",
    investigation: "FLEX-2", datasetInv: "PSI-69", phenomenon: "droplet", type: "image", relation: "related",
    relationNote: "Same apparatus family (MDCA in the Combustion Integrated Rack) used by FLEX, photographed for the later FLEX-2 campaign. It does not show FLEX (PSI-69) tests.",
    sourceUrl: lib("iss043e190395"), sourceLabel: "NASA Image and Video Library, iss043e190395",
    credit: "NASA / Terry Virts", date: "2015-05-13", nasaId: "iss043e190395", license: NASA_PD,
    alt: "Astronaut in a headlamp handling equipment at an open rack inside the space station, surrounded by cables and hardware.",
    variants: v("flex2-mdca-apparatus", [[480, 319], [960, 639]]),
  },
  {
    id: "cfi-g-cool-flame-video", title: "A hot flame that leaves a cool flame behind",
    description: "A hot flame burning during a test of the Cool Flames Investigation with Gases. After the flame appears to extinguish, a cool flame is created. It was too faint to see in real time; the research team found it in the data.",
    visible: "Silent clip (about 30 s): a bright flame that fades out; the cool flame that follows is too faint for the eye.",
    investigation: "CFI-G", datasetInv: "PSI-69", phenomenon: "droplet", type: "video", relation: "related",
    relationNote: "A different, later experiment (gaseous fuel, 2021) showing the same phenomenon FLEX discovered with heptane droplets: low-temperature 'cool flame' burning after the visible flame goes out.",
    sourceUrl: lib("jsc2021m000185_Cool_Flames_Created_Aboard_International_Space_Station"), sourceLabel: "NASA Image and Video Library, Hot Flame Aboard the ISS",
    credit: "NASA", date: "2021-07-14", nasaId: "jsc2021m000185_Cool_Flames_Created_Aboard_International_Space_Station", license: NASA_PD,
    alt: "Video frame of a bright flame inside a combustion chamber aboard the space station.",
    variants: v("cfi-g-cool-flame-video", [[480, 270]]), poster: { src: "/media/cfi-g-cool-flame-video/480.webp", width: 480, height: 270 },
    video: { src: "/media/cfi-g-cool-flame-video/clip.mp4", mime: "video/mp4", durationNote: "about 30 s, no audio" },
    caveat: "Not a droplet and not FLEX data: it illustrates the cool-flame phenomenon only.",
  },
  // --------------------------------------------------------------- BASS-II (PSI-25) ---
  {
    id: "bass2-flame-gmt203", title: "BASS-II flame over an acrylic slab",
    description: "Image taken during a BASS-II flame test session (card 2) conducted on GMT 203: a 4 mm thick, 1 cm wide acrylic (PMMA) slab burned at multiple flow velocities. At high flows the flame was long and sooty; when the flow was reduced, the flame stabilized.",
    visible: "A flame wrapped around the end of a flat sample in the BASS-II flow duct: blue leading edge, orange-pink sooty core.",
    investigation: "BASS-II", datasetInv: "PSI-25", phenomenon: "spread", type: "image", relation: "experimental",
    relationNote: "NASA identifies it as a BASS-II flame test session. No test number is given. Possible match, not verified: the BASS-II CSV's only 4 mm × 1 cm slab is test M10, dated 23 Jul 2014 (day 204), which is also this photo's date, but NASA's caption says GMT 203. SpaceFire therefore does not attach the photo to M10.",
    sourceUrl: lib("iss040e072900"), sourceLabel: "NASA Image and Video Library, iss040e072900",
    credit: "NASA / Reid Wiseman", date: "2014-07-23", nasaId: "iss040e072900", license: NASA_PD,
    alt: "A rounded blue-edged flame with an orange-pink interior enveloping the tip of a dark rectangular fuel sample on a black background.",
    variants: v("bass2-flame-gmt203", [[480, 319], [960, 638], [1600, 1063]]),
    related: [{ label: "Flame spread & material behavior", href: "/phenomena/flame-spread" }],
  },
  {
    id: "bass2-flame-gmt213", title: "BASS-II flame at reduced oxygen",
    description: "Image taken on card 8 during a BASS-II flame test session with reduced O2 partial pressure, conducted on GMT 213.",
    visible: "A dim, mostly blue flame cap at the end of a sample in low-oxygen air.",
    investigation: "BASS-II", datasetInv: "PSI-25", phenomenon: "spread", type: "image", relation: "experimental",
    relationNote: "NASA identifies it as a BASS-II session with reduced oxygen (GMT 213). The test number is not given; the CSV lists five tests on day 213, so the photo cannot be assigned to one.",
    sourceUrl: lib("iss040e086481"), sourceLabel: "NASA Image and Video Library, iss040e086481",
    credit: "NASA / Reid Wiseman", date: "2014-08-02", nasaId: "iss040e086481", license: NASA_PD,
    alt: "A thin blue dome-shaped flame at the tip of a dark sample, with a faint orange spot, against black.",
    variants: v("bass2-flame-gmt213", [[480, 319], [960, 638], [1600, 1063]]),
  },
  {
    id: "bass2-flame-gmt214", title: "BASS-II flame on a cylindrical sample, reduced oxygen",
    description: "Image taken on card 15 during a BASS-II flame test session with reduced O2 partial pressure, conducted on GMT 214.",
    visible: "An elongated flame with a blue envelope and pink core around a sample held in the duct.",
    investigation: "BASS-II", datasetInv: "PSI-25", phenomenon: "spread", type: "image", relation: "experimental",
    relationNote: "NASA identifies it as a BASS-II reduced-oxygen session (GMT 214). The BASS-II CSV has no test on day 214 (the CSV's GMT column has known day-of-year inconsistencies, flag BASS-GMT-DOY-MISMATCH), so the photo is not assigned to any test.",
    sourceUrl: lib("iss040e088023"), sourceLabel: "NASA Image and Video Library, iss040e088023",
    credit: "NASA / Reid Wiseman", date: "2014-08-02", nasaId: "iss040e088023", license: NASA_PD,
    alt: "A long flame with a glowing blue outline and pink interior surrounding the end of a rod-shaped sample, black background.",
    variants: v("bass2-flame-gmt214", [[480, 319], [960, 638], [1600, 1063]]),
  },
  {
    id: "bass2-msg-operations", title: "Running BASS-II in the Microgravity Science Glovebox",
    description: "NASA astronaut Rick Mastracchio, Expedition 38, works with the BASS-II experiment in the Microgravity Science Glovebox in the Destiny laboratory.",
    visible: "An astronaut with his arms in the glovebox ports; the sealed work volume where the BASS-II flow duct is installed.",
    investigation: "BASS-II", datasetInv: "PSI-25", phenomenon: "spread", type: "image", relation: "experimental",
    relationNote: "NASA identifies the activity as BASS-II operations in the MSG on 14 Feb 2014. This is apparatus context; no flame is shown.",
    sourceUrl: lib("iss038e047576"), sourceLabel: "NASA Image and Video Library, iss038e047576",
    credit: "NASA", date: "2014-02-14", nasaId: "iss038e047576", license: NASA_PD,
    alt: "Astronaut in a dark shirt with both arms inserted into the round glove ports of a glovebox inside the space station laboratory.",
    variants: v("bass2-msg-operations", [[480, 319], [960, 638]]),
  },
  {
    id: "bass-iss40-20140627", title: "Sooty flame during a BASS run, Expedition 40",
    description: "Close-up photographed during a run of the Burning and Suppression of Solids (BASS) experiment, conducted by Reid Wiseman, Expedition 40.",
    visible: "A large yellow-orange sooty flame with a blue base around a sample.",
    investigation: "BASS", datasetInv: "PSI-25", phenomenon: "spread", type: "image", relation: "related",
    relationNote: "NASA's caption says only 'BASS'. The photo date (27 Jun 2014) falls inside the BASS-II campaign, and the BASS-II CSV lists SIBAL and sphere tests on that day, but the caption does not say BASS-II, so it is shown as BASS-series context.",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:ISS-40_Burning_and_Suppression_of_Solids_(BASS)_experiment_(2).jpg",
    sourceLabel: "Wikimedia Commons (from NASA's Flickr), public domain",
    credit: "NASA / Reid Wiseman", date: "2014-06-27", license: "Public domain (NASA); via Wikimedia Commons.",
    alt: "A billowing yellow and orange flame with a thin blue lower edge on a black background.",
    variants: v("bass-iss40-20140627", [[480, 319], [960, 638]]),
  },
  {
    id: "bass1-flame-2013", title: "A small blue flame from the first BASS campaign",
    description: "One of a series of close-up images photographed during a run of the Burning and Suppression of Solids (BASS) experiment by Chris Cassidy in April 2013. BASS examines the burning and extinction characteristics of a wide variety of fuel samples in microgravity.",
    visible: "A tiny, faint blue flame near extinction.",
    investigation: "BASS", datasetInv: "PSI-25", phenomenon: "spread", type: "image", relation: "related",
    relationNote: "From the earlier BASS (I) campaign (2013), not BASS-II. Four BASS (I) tests share names with BASS-II tests (rule BASS-ID-COLLISION-BASS1).",
    sourceUrl: lib("iss035e015900"), sourceLabel: "NASA Image and Video Library, iss035e015900",
    credit: "NASA", date: "2013-04-09", nasaId: "iss035e015900", license: NASA_PD,
    alt: "A small crescent-shaped blue flame on a black background.",
    variants: v("bass1-flame-2013", [[480, 319], [960, 638]]),
  },
  {
    id: "sofie-gel-extinction", title: "A solid-fuel flame shrinking to extinction",
    description: "The Solid Fuel Ignition and Extinction (SoFIE) Growth and Extinction Limits experiment. Snapshots about 3 seconds apart: the oxygen concentration starts relatively high (28%) and the flame is yellow and sooty; as the pressure is reduced, the flame becomes bluer and shrinks until it is fully extinguished.",
    visible: "A grid of snapshots of one flame going from yellow and sooty to small and blue, then out.",
    investigation: "SoFIE", datasetInv: "PSI-25", phenomenon: "spread", type: "image", relation: "related",
    relationNote: "A later NASA solid-fuel flammability experiment (2023), not BASS-II. It shows the same physics BASS-II probes: sooty flames at high oxygen turning blue and quenching as conditions worsen.",
    sourceUrl: lib("jsc2023e013681"), sourceLabel: "NASA Image and Video Library, jsc2023e013681",
    credit: "NASA", date: "2023-03-09", nasaId: "jsc2023e013681", license: NASA_PD,
    alt: "A grid of about forty small flame snapshots, early ones yellow-orange, later ones blue and shrinking.",
    variants: v("sofie-gel-extinction", [[480, 294], [960, 588]]),
  },
  // ------------------------------------------------------------- SAFFIRE-I (PSI-98) ---
  {
    id: "saffire1-burn-animation", title: "Saffire-I sample burning aboard Cygnus",
    description: "The Saffire-I sample burning aboard the Cygnus spacecraft on June 14, 2016, after the vehicle left the space station. NASA describes the sample as a cotton-fiberglass blend, 0.4 m wide by 1 m long, inside an enclosure about 0.5 m wide, 1 m deep and 1.3 m long, ignited by a hot wire. (The SAFFIRE-I CSV records SIBAL fabric, 94 cm × 40.6 cm.)",
    visible: "Animated camera frames published by NASA: a glowing flame front along the fabric sample; part-way through, a green-tinted view of the whole sample.",
    investigation: "SAFFIRE-I", datasetInv: "PSI-98", phenomenon: "spacecraft", type: "animation", relation: "experimental",
    relationNote: "NASA Glenn's caption: 'the Saffire-1 sample burning aboard the Cygnus spacecraft on June 14, 2016.' These are frames NASA published; SpaceFire has no other SAFFIRE-I imagery, and the local workbook is a manifest, not images.",
    sourceUrl: "https://www.nasa.gov/centers-and-facilities/glenn/nasa-ignites-fire-experiment-aboard-space-cargo-ship/",
    sourceLabel: "NASA Glenn, NASA Ignites Fire Experiment Aboard Space Cargo Ship", credit: "NASA", date: "2016-06-14", license: NASA_PD,
    alt: "Low-resolution camera view of a long fabric sample with a glowing orange flame front along its edge on a dark background.",
    variants: [{ src: "/media/saffire1-burn-animation/poster.webp", width: 320, height: 230 }],
    poster: { src: "/media/saffire1-burn-animation/poster.webp", width: 320, height: 230 },
    animation: "/media/saffire1-burn-animation/animation.webp",
    reference: { label: "SAFFIRE-I image-set manifest in SpaceFire (timing only, no pixels)", href: "/phenomena/spacecraft-fire" },
    caveat: "NASA's animation is a sped-up sequence of selected frames; its playback rate is not the real burn rate.",
  },
  {
    id: "saffire1-youtube", title: "Saffire-I Experiment Burns in Space (video)",
    description: "NASA's video of the Saffire-I experiment burning inside the Cygnus cargo vehicle.",
    visible: "NASA video published as 'Saffire-I Experiment Burns in Space'.",
    investigation: "SAFFIRE-I", datasetInv: "PSI-98", phenomenon: "spacecraft", type: "video", relation: "experimental",
    relationNote: "Published by NASA's official YouTube channel (NASA Video) under the title 'Saffire-I Experiment Burns in Space'. Loaded from YouTube only after you choose to play it.",
    sourceUrl: "https://www.youtube.com/watch?v=j23887AMwXk", sourceLabel: "NASA Video on YouTube", credit: "NASA", license: NASA_PD,
    alt: "Saffire-I burn footage from NASA.",
    variants: [{ src: "/media/saffire1-burn-animation/poster.webp", width: 320, height: 230 }],
    poster: { src: "/media/saffire1-burn-animation/poster.webp", width: 320, height: 230 },
    embed: { provider: "youtube", videoId: "j23887AMwXk", title: "Saffire-I Experiment Burns in Space", channel: "NASA Video" },
  },
  {
    id: "saffire1-hardware-cygnus", title: "Saffire-I hardware strapped into the Cygnus cargo module",
    description: "The Saffire-I hardware shown strapped into the Orbital ATK Cygnus Pressurized Cargo Module.",
    visible: "A large white box held by black cargo straps inside the cargo module.",
    investigation: "SAFFIRE-I", datasetInv: "PSI-98", phenomenon: "spacecraft", type: "image", relation: "experimental",
    relationNote: "NASA Glenn's caption identifies the Saffire-I flight hardware. Apparatus context; no flame is shown.",
    sourceUrl: "https://www.nasa.gov/centers-and-facilities/glenn/nasa-ignites-fire-experiment-aboard-space-cargo-ship/",
    sourceLabel: "NASA Glenn, NASA Ignites Fire Experiment Aboard Space Cargo Ship", credit: "NASA", license: NASA_PD,
    alt: "A large white rectangular experiment box secured with black straps inside a spacecraft cargo module.",
    variants: v("saffire1-hardware-cygnus", [[480, 358], [960, 717]]),
  },
  {
    id: "saffire1-preflight-ceit", title: "Saffire-I before flight, OA-6 equipment check",
    description: "Photographic documentation of Saffire-I taken during the OA-6 Crew Equipment Interface Test at Kennedy Space Center's Space Station Processing Facility.",
    visible: "The white Saffire-I unit on a cart in a clean room, with the team in clean-room suits behind it.",
    investigation: "SAFFIRE-I", datasetInv: "PSI-98", phenomenon: "spacecraft", type: "image", relation: "experimental",
    relationNote: "NASA's record names Saffire-I. Pre-flight hardware context; no flame is shown.",
    sourceUrl: lib("jsc2016e017570"), sourceLabel: "NASA Image and Video Library, jsc2016e017570",
    credit: "NASA", date: "2016-01-22", nasaId: "jsc2016e017570", license: NASA_PD,
    alt: "A team in white clean-room suits standing behind a large white experiment box in a hangar-like clean room.",
    variants: v("saffire1-preflight-ceit", [[480, 360], [960, 720]]),
  },
];

export const MEDIA_BY_ID: Record<string, ScientificMedia> = Object.fromEntries(MEDIA.map((m) => [m.id, m]));

export const RELATION_LABEL: Record<Relation, { label: string; short: string; note: string }> = {
  experimental: { label: "Real experimental media", short: "Experiment media",
    note: "Authentic NASA photograph or footage of this investigation (or its flight hardware)." },
  related: { label: "Related NASA media", short: "Related media",
    note: "Authentic NASA media from a related investigation, campaign or apparatus; context, not this dataset's evidence." },
  illustration: { label: "Schematic / illustration", short: "Illustration",
    note: "Explanatory drawing made for SpaceFire; not experimental evidence." },
};

export const INVESTIGATION_OF: Record<string, string> = { "PSI-69": "FLEX", "PSI-25": "BASS-II", "PSI-98": "SAFFIRE-I" };

export function mediaFor(opts: { inv?: string; phenomenon?: Phenomenon; relation?: Relation; ids?: string[] }) {
  if (opts.ids) return opts.ids.map((id) => MEDIA_BY_ID[id]).filter(Boolean);
  return MEDIA.filter((m) => (!opts.inv || m.datasetInv === opts.inv) && (!opts.phenomenon || m.phenomenon === opts.phenomenon)
    && (!opts.relation || m.relation === opts.relation));
}

/** srcSet + sizes for responsive images. */
export function srcSet(m: { variants: Variant[] }) {
  return m.variants.map((x) => `${x.src} ${x.width}w`).join(", ");
}
export function largest(m: { variants: Variant[] }) {
  return m.variants[m.variants.length - 1];
}

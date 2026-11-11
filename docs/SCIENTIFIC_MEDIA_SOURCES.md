# Scientific media: sources, credits and provenance decisions

All photographs, video and animation in SpaceFire AI are listed in `frontend/lib/scientific-media.ts`. Each item names
its original source, credit, date, NASA ID (when one exists), relation type and caption. This document records how the
items were verified and which candidates were rejected. Last verified 2026-11-11: every source URL returned HTTP 200.

## Rules
- **Real experimental media**: authentic NASA photograph or footage of the named investigation or its flight hardware,
  identified as such in NASA's own caption.
- **Related NASA media**: authentic NASA media of a related investigation, an earlier or later campaign, or the same
  apparatus. Shown as context, never as evidence for this dataset.
- **Schematic / illustration**: the SpaceFire SVG drawings (hero droplet, physics figures, airflow schematics), labelled
  "Schematic" where shown. They are not in the media registry.
- No image is attached to a test ID. NASA's captions never name a test number, and matching by date is unreliable
  (below). Images are context; every number in SpaceFire comes from the NASA CSV files and documents.
- Metadata comes from the NASA Image and Video Library API (`images-api.nasa.gov`), the nasa.gov / science.nasa.gov
  article captions, and the Wikimedia Commons file page. Nothing was invented; unknown dates are left blank.
- Usage: NASA media is generally not subject to U.S. copyright and may be used on educational web pages with NASA
  credited, without implying endorsement (<https://www.nasa.gov/nasa-brand-center/images-and-media/>). The NASA
  insignia is not public domain: images that use it as a graphic element were excluded, while insignia that appear
  incidentally on hardware in NASA's documentary photos (e.g. a sticker on a crate in jsc2016e017570) are left as
  photographed. SpaceFire uses no NASA logo of its own.

## Registry

| ID | Investigation | Relation | Source (credit, date) | Notes |
|---|---|---|---|---|
| flex-heptane-soot-composite | FLEX | experimental | [NASA, Burning in Microgravity](https://www.nasa.gov/image-article/burning-microgravity/) (NASA, 2011-05-25) | 3 mm heptane droplet; **colorized composite of video frames** (false colour), labelled as such |
| flex-1g-vs-microgravity | FLEX | experimental | [NASA Science, FLEX](https://science.nasa.gov/image-detail/screenshot-2024-03-29-at-10-02-47-am/) (NASA) | NASA caption "1-g and micro-g droplet combustion"; date not stated |
| flex2-mdca-apparatus | FLEX-2 | related | [iss043e190395](https://images.nasa.gov/details/iss043e190395) (NASA / Terry Virts, 2015-05-13) | Same MDCA apparatus, prepared for FLEX-2; not FLEX (PSI-69) tests |
| cfi-g-cool-flame-video | CFI-G | related | [Hot Flame Aboard the ISS](https://images.nasa.gov/details/jsc2021m000185_Cool_Flames_Created_Aboard_International_Space_Station) (NASA, 2021-07-14) | 1.6 MB mobile rendition hosted locally; silent (NASA captions say "no audio content"); a gaseous-fuel experiment showing the cool-flame phenomenon |
| bass2-flame-gmt203 | BASS-II | experimental | [iss040e072900](https://images.nasa.gov/details/iss040e072900) (NASA / Reid Wiseman, 2014-07-23) | Caption: session GMT 203, 4 mm × 1 cm acrylic slab. Possible match M10, **not verified** (see below) |
| bass2-flame-gmt213 | BASS-II | experimental | [iss040e086481](https://images.nasa.gov/details/iss040e086481) (NASA / Reid Wiseman, 2014-08-02) | Reduced-O₂ session, GMT 213; 5 CSV tests that day, not assigned |
| bass2-flame-gmt214 | BASS-II | experimental | [iss040e088023](https://images.nasa.gov/details/iss040e088023) (NASA / Reid Wiseman, 2014-08-02) | Reduced-O₂ session, GMT 214; no CSV test on day 214 |
| bass2-msg-operations | BASS-II | experimental (apparatus) | [iss038e047576](https://images.nasa.gov/details/iss038e047576) (NASA, 2014-02-14) | Rick Mastracchio at the Microgravity Science Glovebox |
| bass-iss40-20140627 | BASS | related | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:ISS-40_Burning_and_Suppression_of_Solids_(BASS)_experiment_(2).jpg) (NASA / Reid Wiseman, 2014-06-27, public domain) | Caption says "BASS" only; date lies in the BASS-II campaign, so shown as BASS-series context |
| bass1-flame-2013 | BASS (I) | related | [iss035e015900](https://images.nasa.gov/details/iss035e015900) (NASA, 2013-04-09) | Earlier BASS campaign; not BASS-II |
| sofie-gel-extinction | SoFIE | related | [jsc2023e013681](https://images.nasa.gov/details/jsc2023e013681) (NASA, 2023-03-09) | Later solid-fuel extinction experiment |
| saffire1-burn-animation | SAFFIRE-I | experimental | [NASA Glenn article](https://www.nasa.gov/centers-and-facilities/glenn/nasa-ignites-fire-experiment-aboard-space-cargo-ship/) (NASA, burn 2016-06-14) | NASA's 12.9 MB GIF converted to a 756 KB animated WebP (all 574 frames, original 40 ms timing) plus a still poster (frame 120); plays only on request |
| saffire1-youtube | SAFFIRE-I | experimental | [NASA Video on YouTube, "Saffire-I Experiment Burns in Space"](https://www.youtube.com/watch?v=j23887AMwXk) | Title and channel verified via YouTube oEmbed; embedded with `youtube-nocookie.com` only after a click |
| saffire1-hardware-cygnus | SAFFIRE-I | experimental (hardware) | [NASA Glenn article](https://www.nasa.gov/centers-and-facilities/glenn/nasa-ignites-fire-experiment-aboard-space-cargo-ship/) (NASA) | Flight unit strapped in the Cygnus cargo module |
| saffire1-preflight-ceit | SAFFIRE-I | experimental (hardware) | [jsc2016e017570](https://images.nasa.gov/details/jsc2016e017570) (NASA, 2016-01-22) | OA-6 crew equipment interface test at KSC |

Assets: `frontend/public/media/<id>/` as WebP at 480 / 960 px (1600 px for the three BASS-II flames used full-width),
3.0 MB in total, including the 1.6 MB video. Every `<img>` gets explicit width and height from the registry, so nothing
shifts when it loads.

## Photo-to-test matching (why no image carries a test ID)

NASA's BASS-II captions give a session day ("GMT 203") and sometimes a sample description, but never a test number.
Checked against the BASS-II CSV:

- iss040e072900: the caption says GMT 203 and "4 mm thick, 1 cm wide acrylic slab". The CSV lists only rods on day 203.
  Its only 4 mm × 1 cm slab is **M10**, dated 7/23/2014 (day 204), which is the photo's own date. The match is
  plausible but contradicts NASA's caption day, so it is recorded as unverified and not shown on M10's page.
- iss040e086481 (GMT 213): five CSV tests that day (F3, M20, O10, O14, O19); cannot be assigned.
- iss040e088023 (GMT 214): no CSV test on day 214. The CSV's GMT column has known day-of-year inconsistencies (flag
  `BASS-GMT-DOY-MISMATCH`).

## Candidates examined and rejected
- **GRC-2014-C-02323** (Spacecraft Fire Safety Demonstration lab photo, 2010): the print layout shows the NASA insignia,
  which the brand guidelines exclude. It shows a technician, not the experiment.
- **Saffire-II, Saffire-V and Saffire-VI media** (e.g. iss051e039882, GRC-2021-CN-00008): later SAFFIRE flights. Not
  used, so they cannot be mistaken for SAFFIRE-I.
- **iss047e021821 "Cygnus Capture"**: the record's date (2016-03-26, capture) and its description (the June release
  before Saffire-1) disagree, so it was left out.
- **BASS (I) close-ups from 2013**: one is kept, labelled BASS (I); none is presented as BASS-II.
- MDCA hardware photos captioned for FLEX-2: one is kept as related apparatus context; none is presented as FLEX data.

import { expect, test } from "@playwright/test";
import { suggestions, MAX_SUGGESTION } from "@/lib/copilot-suggestions";
import { compareOptions, DIFFERENCES } from "@/lib/evidence-compare";
import { GLOSSARY, GLOSSARY_BY_ID } from "@/lib/glossary";
import { EXAMPLE_RECORD, isStep, journeyHref, JOURNEY_QUESTION, JOURNEY_STEPS, nextStep, prevStep, stepNumber, STEP_COPY } from "@/lib/journey";
import { bassWidthConflict, recordFacts, type RecordLike } from "@/lib/record-facts";
import { MEDIA_BY_ID } from "@/lib/scientific-media";
import { NOTICES } from "@/lib/scientific-notices";

// Phase 9 logic tests: pure modules only, no browser or server (run once, in the desktop project).
test.beforeEach(({}, info) => { test.skip(info.project.name !== "desktop", "logic tests run once"); });

test.describe("Phase 9 logic", () => {
  test("journey: seven ordered steps, reversible transitions, hrefs that never ask the model", () => {
    expect(JOURNEY_STEPS).toEqual(["welcome", "choose", "model", "interact", "evidence", "ask", "next"]);
    expect(stepNumber("welcome")).toBe(1);
    expect(stepNumber("next")).toBe(7);
    for (const s of JOURNEY_STEPS) {
      const n = nextStep(s);
      if (n) expect(prevStep(n)).toBe(s);
    }
    expect(prevStep("welcome")).toBeNull();
    expect(nextStep("next")).toBeNull();
    expect(isStep("evidence")).toBe(true);
    expect(isStep("bogus")).toBe(false);
    expect(journeyHref("welcome", null)).toBe("/");
    expect(journeyHref("model", null)).toBe("/?journey=choose#explore");          // no topic: back to choosing
    expect(journeyHref("model", "flex")).toBe("/phenomena/flame-extinction?journey=model#studio");
    expect(journeyHref("evidence", "bass")).toBe("/phenomena/flame-spread?journey=evidence&view=nasa#studio");
    for (const t of ["flex", "bass", "saffire"] as const) {
      const ask = new URL(journeyHref("ask", t), "http://x");
      expect(ask.pathname).toBe("/copilot");
      expect(ask.searchParams.get("q")).toBeNull();                                  // `q` would ask immediately
      expect(ask.searchParams.get("draft")).toBe(JOURNEY_QUESTION[t]);
      expect(ask.searchParams.get("journey")).toBe("ask");
      for (const k of ["model", "interact", "evidence"] as const) {
        const c = STEP_COPY[t][k];
        expect(c.body.split(/(?<=\.)\s/).length).toBeLessThanOrEqual(3);            // concise
        expect(c.task.length).toBeGreaterThan(0);
      }
    }
    expect(EXAMPLE_RECORD).toEqual({ flex: "flex:180", bass: "bass2:33", saffire: "saffire1:S1" });
  });

  test("scientific notices: short summaries, truthful one-sentence explanations, flags and sources", () => {
    expect(NOTICES.flex.summary).toBe("Two FLEX source headers require scientific interpretation.");
    expect(NOTICES.bass.summary).toBe("Some sample dimensions differ between NASA sources.");
    expect(NOTICES.saffire.summary).toBe("Some experimental measurements are unavailable in the local dataset.");
    expect(NOTICES.flex.explain).toMatch(/‘mm’ but read as mm²\/s/);
    expect(NOTICES.flex.explain).toMatch(/headed ‘CO’/);
    expect(NOTICES.bass.explain).toMatch(/nominal widths \(1 or 2 cm\).*actual widths \(1\.2 or 2\.2 cm\)/);
    expect(NOTICES.saffire.explain).toMatch(/no manifest frame is shown or reconstructed/);
    expect(NOTICES.flex.flags.map((f) => f.rule)).toEqual(["FLEX-UNIT-K", "FLEX-HDR-CO2"]);
    expect(NOTICES.bass.rows.some((r) => /T24/.test(r.label) && /2\.2 cm/.test(r.original))).toBe(true);
    for (const n of Object.values(NOTICES)) {
      expect(n.summary.split(" ").length).toBeLessThanOrEqual(12);
      expect(n.rows.length).toBeGreaterThan(0);
      expect(n.affects.length).toBeGreaterThan(0);
      expect(n.sources.length).toBeGreaterThan(0);
      for (const f of n.flags) expect(f.href).toMatch(/^\/reliability\?investigation=PSI-\d+&rule_id=/);
    }
    expect(NOTICES.flex.severity).toBe("warning");
    expect(NOTICES.bass.severity).toBe("warning");
  });

  test("evidence comparison: only verified media of the same investigation; never BASS (I) as BASS-II; never a test claim", () => {
    const inv = { flex: "FLEX", bass: "BASS-II", saffire: "SAFFIRE-I" } as const;
    for (const scene of ["flex", "bass", "saffire"] as const) {
      const opts = compareOptions(scene, { recordLabel: "X1" });
      expect(opts.length).toBeGreaterThan(1);
      for (const o of opts) {
        expect(o.media.investigation).toBe(inv[scene]);
        expect(o.media.relation).toBe("experimental");
        expect(o.media.testId).toBeUndefined();
        expect(o.fit).not.toMatch(/\b(is|shows) test X1\b/);
      }
      expect(DIFFERENCES[scene].length).toBeGreaterThanOrEqual(3);
    }
    expect(compareOptions("bass").map((o) => o.media.id)).not.toContain("bass1-flame-2013");
    expect(compareOptions("bass").map((o) => o.media.id)).not.toContain("bass-iss40-20140627");
    // methanol: the heptane image is labelled as heptane and the fuel-neutral image comes first
    const meth = compareOptions("flex", { fuel: "Methanol", recordLabel: "N01" });
    expect(meth[0].media.id).toBe("flex-1g-vs-microgravity");
    expect(meth.find((o) => o.media.id === "flex-heptane-soot-composite")!.fit).toMatch(/n-heptane.*methanol/);
    // a rod test puts the rod photograph first; a sphere test says no verified photo of its type exists
    expect(compareOptions("bass", { sample: "rod" })[0].media.id).toBe("bass2-flame-gmt214");
    expect(compareOptions("bass", { sample: "sphere", recordLabel: "B2" })[0].fit).toMatch(/Investigation-level image.*no verified NASA photograph/);
    expect(MEDIA_BY_ID["bass1-flame-2013"].investigation).toBe("BASS");
  });

  test("contextual Copilot suggestions: scoped, short, draft-only, carry only the record UID", () => {
    for (const inv of ["PSI-69", "PSI-25", "PSI-98"] as const) {
      const list = suggestions({ inv });
      expect(list.length).toBe(3);
      for (const s of list) {
        const u = new URL(s.href, "http://x");
        expect(u.pathname).toBe("/copilot");
        expect(u.searchParams.get("q")).toBeNull();
        expect(u.searchParams.get("draft")).toBe(s.text);
        expect(u.searchParams.get("inv")).toBe(inv);
        expect(s.text.length).toBeLessThanOrEqual(MAX_SUGGESTION);
        expect(s.text).toMatch(/FLEX|BASS-II|SAFFIRE-I/);
      }
    }
    expect(suggestions({ inv: "PSI-69" })[0].text).toMatch(/nearly spherical in microgravity/);
    expect(suggestions({ inv: "PSI-25" })[0].text).toMatch(/airflow direction affect flame spread over solid materials/);
    expect(suggestions({ inv: "PSI-98" })[0].text).toMatch(/large-scale spacecraft fire testing important/);
    const rec = suggestions({ inv: "PSI-69", record: { uid: "flex:180", label: "C02H101" }, from: "chart" }, 1)[0];
    expect(rec.text).toContain("C02H101");
    const u = new URL(rec.href, "http://x");
    expect(u.searchParams.get("uid")).toBe("flex:180");
    expect(u.searchParams.get("from")).toBe("chart");
    expect([...u.searchParams.keys()].sort()).toEqual(["draft", "from", "inv", "uid"]);   // nothing from the 3D controls
  });

  test("glossary: the eleven core terms, with their caveats", () => {
    const ids = ["microgravity", "flame-extinction", "flame-spread", "diffusion-flame", "burning-rate-constant", "d2-law", "soot",
      "opposed-flow", "concurrent-flow", "nasa-evidence", "conceptual-visualization"];
    expect(GLOSSARY.map((g) => g.id).sort()).toEqual([...ids].sort());
    for (const g of GLOSSARY) expect(g.short.split(/\s+/).length).toBeLessThanOrEqual(40);
    expect(GLOSSARY_BY_ID["burning-rate-constant"].short).toContain("mm²/s");
    expect(GLOSSARY_BY_ID["burning-rate-constant"].caveat).toContain("FLEX-UNIT-K");
    expect(GLOSSARY_BY_ID["d2-law"].caveat).toMatch(/consistency check/);
    expect(GLOSSARY_BY_ID["conceptual-visualization"].caveat).toMatch(/not a simulation/);
  });

  test("record facts: values with units; warnings that affect them travel with them", () => {
    const flex: RecordLike = { experiment_uid: "flex:180", display_id: "C02H101", investigation: "FLEX", investigation_id: "PSI-69",
      normalized: { fuel: "Heptane", x_o2: 0.19, diluent: "CO2", d0_mm: 3.4, dext_mm: 3.13, k_mm2_s: 0.41, burn_time_s: 4.5, test_end: "Extinction" },
      quality_flags: [] };
    const f = recordFacts(flex);
    const k = f.facts.find((x) => x.label.startsWith("Burning-rate"))!;
    expect(k.value).toBe("0.41 mm²/s");
    expect(k.note).toMatch(/‘Burning rate; mm’.*mm²\/s.*FLEX-UNIT-K/);
    expect(f.facts.find((x) => x.label === "Diluent")!.note).toMatch(/header reads ‘CO’/);
    const bass: RecordLike = { experiment_uid: "bass2:33", display_id: "M7", investigation: "BASS-II", investigation_id: "PSI-25",
      normalized: { material_class: "PMMA slab", width_cm: 1, thickness_mm: 1, flow_direction: "Opposed" },
      quality_flags: [{ rule_id: "BASS-MULTISTAGE-FLOW", severity: "info", description: "x" }, { rule_id: "BASS-O2-UNPHYSICAL", severity: "critical", description: "Final O2 1.6 %" }],
      report_records: [{ table_id: "5.1", page_pdf: 65, values: { width_cm: 1.2 } }] };
    expect(bassWidthConflict(bass)).toEqual({ csv: 1, report: [{ table: "5.1", width: 1.2, page: 65 }] });
    const b = recordFacts(bass);
    expect(b.warnings[0].text).toMatch(/1 cm in the CSV \(nominal\) and 1\.2 cm in Table 5\.1 \(PDF p\.65\)/);
    expect(b.warnings.map((w) => w.rule)).toContain("BASS-O2-UNPHYSICAL");
    expect(b.warnings.map((w) => w.rule)).not.toContain("BASS-MULTISTAGE-FLOW");             // info stays in the flag list
    expect(bassWidthConflict({ ...bass, report_records: [{ table_id: "5.1", page_pdf: 65, values: { width_cm: 1 } }] })).toBeNull();
  });
});

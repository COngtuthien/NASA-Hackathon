// Key recorded values for one experiment record, plus the warnings that apply to exactly those values (Phase 9).
// Used by the chart "record spotlight" and the studio's NASA comparison. Values are read from the stored record as is
// (normalized value + unit), never computed from the 3D controls. A warning that affects a shown value is returned
// with it, so a compact page-level notice can never hide it.
import { FLEX_K_UNIT } from "@/lib/lab-scientific-metadata";

export type FlagLike = { rule_id: string; severity: string; description: string };
export type RecordLike = {
  experiment_uid: string; display_id: string; investigation: string; investigation_id: string;
  normalized: Record<string, unknown>; quality_flags: FlagLike[]; dataset_flags?: FlagLike[];
  report_records?: { table_id: string; page_pdf: number; values: Record<string, unknown>; source_url?: string }[];
};
export type Fact = { label: string; value: string; note?: string };
export type ContextWarning = { severity: "critical" | "warning"; text: string; rule?: string };

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const show = (v: unknown, unit = "") => {
  if (v === null || v === undefined || v === "") return "not recorded";
  const n = num(v);
  const s = n === null ? String(v) : Number.isInteger(n) ? String(n) : String(Number(n.toPrecision(4)));
  return unit ? `${s} ${unit}` : s;
};

/** Width disagreement between the CSV (nominal) and the report tables (actual), if the record has both. */
export function bassWidthConflict(r: RecordLike): { csv: number; report: { table: string; width: number; page: number }[] } | null {
  const csv = num(r.normalized.width_cm);
  if (csv === null) return null;
  const report = (r.report_records ?? []).flatMap((x) => {
    const w = num(x.values.width_cm) ?? num(x.values.sample_width_cm);
    return w !== null && w !== csv ? [{ table: x.table_id, width: w, page: x.page_pdf }] : [];
  });
  return report.length ? { csv, report } : null;
}

export function recordFacts(r: RecordLike): { facts: Fact[]; warnings: ContextWarning[] } {
  const n = r.normalized;
  const facts: Fact[] = [];
  const warnings: ContextWarning[] = [];
  if (r.experiment_uid.startsWith("flex:")) {
    facts.push(
      { label: "Fuel", value: show(n.fuel) },
      { label: "Initial O₂", value: show(n.x_o2, "mole fraction") },
      { label: "Diluent", value: show(n.diluent), note: n.diluent === "CO2" ? "CO₂; the source header reads ‘CO’" : undefined },
      { label: "Initial diameter D₀", value: show(n.d0_mm, "mm") },
      { label: "Extinction diameter", value: show(n.dext_mm, "mm") },
      { label: "Burning-rate constant K", value: show(n.k_mm2_s, FLEX_K_UNIT.unit), note: `source header ‘${FLEX_K_UNIT.rawHeader}’, read as ${FLEX_K_UNIT.unit} (FLEX-UNIT-K)` },
      { label: "Burn time", value: show(n.burn_time_s, "s") },
      { label: "Test end", value: show(n.test_end) },
    );
  } else if (r.experiment_uid.startsWith("bass2:")) {
    const conflict = bassWidthConflict(r);
    const geom = num(n.diameter_mm) !== null ? { label: "Diameter", value: show(n.diameter_mm, "mm") }
      : { label: "Width (CSV)", value: show(n.width_cm, "cm"), note: num(n.width_cm) !== null ? "nominal width as written in the CSV" : undefined };
    facts.push(
      { label: "Material", value: show(n.material_class), note: n.material_raw ? `CSV text: ${String(n.material_raw)}` : undefined },
      { label: "Investigator", value: show(n.pi) },
      { label: "Flow direction", value: show(n.flow_direction) },
      geom,
      { label: "Thickness", value: show(n.thickness_mm, "mm") },
      { label: "O₂ before → after", value: `${show(n.o2_initial)} → ${show(n.o2_final)} % by volume` },
    );
    if (conflict) {
      const rep = conflict.report.map((x) => `${x.width} cm in Table ${x.table} (PDF p.${x.page})`).join("; ");
      warnings.push({ severity: "warning", text: `Sample width differs between sources: ${conflict.csv} cm in the CSV (nominal) and ${rep}. Both are kept.` });
    }
  } else if (r.experiment_uid.startsWith("saffire1:")) {
    facts.push(
      { label: "Material", value: show(n.material) },
      { label: "Flame spread vs airflow", value: show(n.flow_direction) },
      { label: "Air flow", value: show(n.air_flow_cm_s, "cm/s") },
      { label: "Burn time (CSV)", value: show(n.burn_time_s, "s") },
      { label: "O₂", value: show(n.o2_raw, "%"), note: n.o2_kind === "range" ? "recorded as a range" : undefined },
      { label: "Length × width (CSV)", value: `${show(n.length_cm)} × ${show(n.width_cm)} cm`, note: "appear swapped vs the Operations document (SAF-LENGTH-WIDTH)" },
    );
  }
  for (const f of r.quality_flags) {
    if (f.severity === "critical" || f.severity === "warning") warnings.push({ severity: f.severity, text: f.description, rule: f.rule_id });
  }
  return { facts, warnings };
}

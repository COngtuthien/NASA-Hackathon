"""Investigation registry for all ten investigations (3 existing + 7 Phase 13), machine-readable for Phase 14.

Identity fields (title, DOI, PI, dates, platform) are read from each investigation's ISA-Tab metadata; scope,
evidence level, routes and limitations are SpaceFire's documented assessment (docs/NEW_NASA_DATASET_AUDIT.md,
docs/ACME_DATASET_AUDIT.md), stated as such.
"""
from __future__ import annotations

from pathlib import Path

from .. import documents
from .common import Dataset, new_record, read_csv_rows, source_entry, spec

SCENARIOS = {
    "material_flame_spread": "Flame spread over spacecraft materials",
    "gaseous_flame_behavior": "Gaseous flame behaviour (spherical diffusion flames, cool flames, burning emulation)",
    "early_smoke_detection": "Early smoke detection from overheated materials",
    "droplet_flame_extinction": "Droplet flame extinction and cool flames",
}
READINESS = {
    "quantitative": "Per-test data processed and charted",
    "curated_tables": "Verified report tables and logs; no per-test outcome data",
    "figure_data": "Published figure data (experiment and model series)",
    "conditions_only": "Test conditions only; outcomes reported only as author findings",
    "documentation_only": "Documents and metadata only",
    "metadata_only": "Metadata only",
}

# key, folder, isa key, scenario, readiness, routes, datasets, condition fields, limitations, related
ENTRIES = [
    dict(investigation_id="PSI-69", key="flex", short_name="FLEX", folder="FLEX",
         isa="FLEX/PSI-69_metadata_PSI-133_FLEX/i_Investigation.txt", scenario="droplet_flame_extinction",
         readiness="quantitative", route="/phenomena/flame-extinction", studio="/phenomena/flame-extinction#studio",
         datasets=["flex_tests"], conditions=["fuel", "pressure_atm", "x_o2", "diluent", "d0_mm"],
         limitations=[("ADAPTIVE-DESIGN", "Conditions chosen adaptively; outcome shares are not probabilities."),
                      ("K-UNIT", "Burning-rate header says 'mm'; interpreted as mm²/s.")],
         related=[("PSI-117", "PSI-117 models FLEX cool flames (no row-level join)"), ("PSI-68", "follow-on campaign")]),
    dict(investigation_id="PSI-25", key="bass2", short_name="BASS-II", folder="BASS-II",
         isa="BASS-II/PSI-25_metadata_PSI_metadata_PSI-101_BASS-II.zip::i_Investigation.txt",
         scenario="material_flame_spread", readiness="quantitative", route="/phenomena/flame-spread",
         studio="/phenomena/flame-spread#studio", datasets=["bass2_tests"],
         conditions=["material_class", "geometry", "flow_direction", "o2_initial", "air_single_cm_s"],
         limitations=[("AIR-DISPLAY", "'Air display' is a facility readout, not the analysed flow velocity.")],
         related=[("PSI-62", "PSI-62 models BASS/BASS-II flame spread (metadata only)"),
                  ("PSI-20", "BRE emulates steady burning of flat materials; qualitative comparison only")]),
    dict(investigation_id="PSI-98", key="saffire1", short_name="SAFFIRE-I", folder="SAFFIRE-1",
         isa="SAFFIRE-1/PSI-98_metadata_PSI-166_SAFFIRE-I (1).zip::i_Investigation.txt", scenario="material_flame_spread",
         readiness="quantitative", route="/phenomena/spacecraft-fire", studio="/phenomena/spacecraft-fire#studio",
         datasets=["saffire_burns"], conditions=["flow_direction", "air_flow_cm_s"],
         limitations=[("NO-SENSOR-SERIES", "No sensor time series in the local data.")], related=[]),
    dict(investigation_id="PSI-117", key="psi117", short_name="PSI-117", folder="PSI-117",
         isa="PSI-117/PSI-117_metadata_NEWID-13_Effect of External T.zip::i_Investigation.txt",
         scenario="droplet_flame_extinction", readiness="figure_data", route="/phenomena/flame-extinction#psi117",
         studio="/phenomena/flame-extinction#studio", datasets=["psi117_series"],
         conditions=["fuel", "pressure_atm", "d0_mm"],
         limitations=[("FIGURE-DATA", "Experimental points are published figure data (digitized)."),
                      ("MODEL-1D", "Model is 1-D sphero-symmetric; no 3-D CFD output is available."),
                      ("NO-FLEX-JOIN", "FLEX test numbers cited by PSI-117 have no key in SpaceFire's FLEX table."),
                      ("UNITS", "Several units are inferred or unknown (flagged per series).")],
         related=[("PSI-69", "uses FLEX flight data"), ("PSI-159", "cool flames in a gaseous configuration")]),
    dict(investigation_id="PSI-102", key="same", short_name="SAME", folder="SAME",
         isa="SAME/PSI-102_metadata_PSI-170_SAME.zip::i_Investigation.txt", scenario="early_smoke_detection",
         readiness="curated_tables", route="/phenomena/smoke-detection", studio="/phenomena/smoke-detection#studio",
         datasets=["same_particle_sizes", "same_particle_sizes_other_sources", "same_flight_log", "same_telemetry_inventory"],
         conditions=["material", "aged"],
         limitations=[("TELEMETRY-DEFERRED", "1 Hz housekeeping telemetry not processed (material assignment and "
                       "sentinel semantics unresolved)."),
                      ("MOMENT-METHOD", "Particle sizes are moment-method results assuming a log-normal distribution."),
                      ("SOURCES-DIFFER", "Different SAME documents print different values for the same quantity.")],
         related=[("PSI-25", "fire-safety context; no quantitative link")]),
    dict(investigation_id="PSI-68", key="flex2", short_name="FLEX-2", folder="FLEX-2",
         isa="FLEX-2/PSI-68_metadata_PSI-132_FLEX-2.zip::i_Investigation.txt", scenario="droplet_flame_extinction",
         readiness="documentation_only", route="/phenomena/flame-extinction#flex2", studio=None,
         datasets=["flex2_envelope"], conditions=[],
         limitations=[("NO-MEASUREMENTS", "Only a test-matrix envelope (ranges) and documents were downloaded.")],
         related=[("PSI-69", "follow-on to FLEX")]),
    dict(investigation_id="PSI-62", key="psi62", short_name="PSI-62", folder="PSI-62",
         isa="PSI-62/PSI-62_metadata_NEWID-7_Concurrent Flame Spr.zip::i_Investigation.txt",
         scenario="material_flame_spread", readiness="metadata_only", route="/phenomena/flame-spread#related",
         studio=None, datasets=[], conditions=[],
         limitations=[("METADATA-ONLY", "Only the ISA-Tab metadata was downloaded: no model outputs or tomography.")],
         related=[("PSI-25", "models BASS/BASS-II concurrent flame spread")]),
    dict(investigation_id="PSI-159", key="cfig", short_name="ACME CFI-G", folder="ACME CFI-G",
         isa="ACME CFI-G/PSI-159_metadata_PSI-159-ISA.zip::i_Investigation.txt", scenario="gaseous_flame_behavior",
         readiness="quantitative", route="/phenomena/gaseous-flames?tab=cfig", studio="/phenomena/gaseous-flames#studio",
         datasets=["cfig_tests", "cfig_cool_flames", "cfig_test_days"],
         conditions=["configuration", "fuel_species", "bottle_fuel_pct", "x_o2_before", "p_bar", "m_fuel_mg_s", "x_o2_supply"],
         limitations=[("CENSORED", "FT burn times are right-censored."),
                      ("COUNTS-DIFFER", "CSV and report count flames differently; both kept."),
                      ("UNDEFINED-LABELS", "'limit' colour and PCI-A...G labels are undefined locally."),
                      ("COOL-NARROW", "Cool flames only at one condition set; radii not transferable.")],
         related=[("PSI-10", "same ACME insert and burner type"), ("PSI-117", "cool flames in droplets")]),
    dict(investigation_id="PSI-10", key="flame_design", short_name="ACME Flame Design", folder="ACME Flame Design",
         isa="ACME Flame Design/PSI-10_metadata_PSI-10-ISA.zip::i_Investigation.txt", scenario="gaseous_flame_behavior",
         readiness="conditions_only", route="/phenomena/gaseous-flames?tab=flame-design",
         studio="/phenomena/gaseous-flames#studio", datasets=["fd_conditions", "fd_test_days"],
         conditions=["configuration", "fuel", "x_o2_init", "x_o2_supply", "p_mean_atm", "m_total_mg_s", "zst", "tad_k"],
         limitations=[("CONDITIONS-ONLY", "No per-test outcomes in the download."),
                      ("RESULTS-ABSTRACT", "Key results exist only as author statements in the final report.")],
         related=[("PSI-159", "same ACME insert and burner type")]),
    dict(investigation_id="PSI-20", key="bre", short_name="ACME BRE", folder="ACME BRE",
         isa="ACME BRE/PSI-20_metadata_PSI-96_ACME BRE.zip::i_Investigation.txt", scenario="gaseous_flame_behavior",
         readiness="curated_tables", route="/phenomena/gaseous-flames?tab=bre", studio=None,
         datasets=["bre_test_days", "bre_literature"], conditions=["burner_mm", "fuel", "o2_pct"],
         limitations=[("NO-PER-TEST", "No per-test measurements in the download (day log only)."),
                      ("EMULATION", "Burning emulation is an analogy, not a material flammability test."),
                      ("PRELIMINARY", "Results described as preliminary by the authors.")],
         related=[("PSI-25", "qualitative link to solid-material burning")]),
]
PSI_URL = "https://psi.nasa.gov/physci/repo/data/investigations/{}"


def build(repo: Path) -> tuple[Dataset, Dataset | None]:
    ds = Dataset("investigation_registry", "ALL", "SpaceFire investigation registry", "report_statement",
                 "Identity from ISA-Tab metadata; scope, readiness, routes and limitations are SpaceFire's documented "
                 "assessment.", field_specs=[spec("readiness", "Quantitative readiness (SpaceFire assessment)",
                                                  "report_statement", unit_status="n/a")])
    for i, e in enumerate(ENTRIES, start=1):
        meta = {}
        zip_part = e["isa"].split("::")[0]
        if (repo / zip_part).exists():
            _, pubs, meta = documents.extract_isatab(repo, e["isa"])
            ds.sources.append(source_entry(repo, zip_part, "isa_tab_metadata"))
        else:
            pubs = []
        v = {k: e[k] for k in ("investigation_id", "key", "short_name", "folder", "scenario", "readiness", "route",
                               "studio", "datasets", "conditions")}
        v.update(scenario_label=SCENARIOS[e["scenario"]], readiness_label=READINESS[e["readiness"]],
                 title=meta.get("Study Title") or None, doi=(meta.get("Comment[DOI]") or None),
                 platform=meta.get("Comment[Flight Platform]") or None, hardware=meta.get("Comment[Experiment Hardware]") or None,
                 start=meta.get("Comment[Investigation Start Date]") or None, end=meta.get("Comment[Investigation End Date]") or None,
                 objective=(meta.get("Comment[Objective]") or "")[:1200] or None, psi_url=PSI_URL.format(e["investigation_id"]),
                 publications=len(pubs), limitations=[{"code": c, "text": t} for c, t in e["limitations"]],
                 related=[{"investigation_id": r, "relation": t} for r, t in e["related"]], isa_key=e["isa"])
        ds.records.append(new_record(f"inv:{e['investigation_id']}", test_id=None, source_file=e["isa"],
                                     source_table="ISA-Tab i_Investigation.txt", source_row=i,
                                     verification="identity_from_isa_tab" if meta else "isa_missing", values=v))
    ds.finalize(len(ENTRIES))
    ds.extra = {"scenarios": SCENARIOS, "readiness": READINESS}
    # FLEX-2 test-matrix envelope (documentary context only)
    rel = "FLEX-2/PSI-68_Experimental table_Flex2.csv"
    env = None
    if (repo / rel).exists():
        env = Dataset("flex2_envelope", "PSI-68", "FLEX-2 test-matrix envelope (conditions only)", "test_condition",
                      "The PSI-68 'Experimental table' lists ranges per fuel, identical in every row: an envelope of "
                      "conditions, not executed tests and not results.", sources=[source_entry(repo, rel, "experiment_table")],
                      field_specs=[spec("conditions", "Condition ranges as printed", "test_condition", unit_status="header")])
        header, rows, _ = read_csv_rows(repo / rel)
        for row_no, r in rows:
            env.records.append(new_record(f"flex2:env:{row_no}", test_id=None, source_file=rel,
                                          source_table="PSI-68 experimental table", source_row=row_no,
                                          verification="parsed_from_source_csv",
                                          values={h.strip(): r[j].strip() for j, h in enumerate(header)}))
        env.finalize(len(rows))
        env.notes = ["Fuel list differs from FLEX-2 SRD Table 2 (PDF p33); no measurements were downloaded."]
    return ds, env

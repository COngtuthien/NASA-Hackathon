"""Whitelisted, dataset-specific field definitions.

Every filter/sort/compare field must be declared here; user input is only ever
matched against these names, and SQL identifiers come from this file, never from
the request.
"""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class FieldDef:
    name: str
    label: str
    kind: str                 # numeric / category / text
    unit: str | None = None
    role: str = "input"       # input / output / context / identifier
    source_header: str | None = None
    note: str | None = None
    kind_col: str | None = None   # column holding value_kind for this field


@dataclass(frozen=True)
class DatasetDef:
    key: str
    investigation_id: str
    short_name: str
    table: str
    display_col: str
    search_cols: tuple[str, ...]
    default_sort: str
    fields: tuple[FieldDef, ...]
    list_cols: tuple[str, ...]
    extra: dict = field(default_factory=dict)

    def field(self, name: str) -> FieldDef | None:
        return next((f for f in self.fields if f.name == name), None)


FLEX = DatasetDef(
    key="flex", investigation_id="PSI-69", short_name="FLEX", table="flex_tests", display_col="identifier",
    search_cols=("identifier", "fuel", "series", "mixture_code", "test_end", "test_date"),
    default_sort="test_number",
    fields=(
        FieldDef("test_number", "FLEX Test #", "numeric", None, "identifier", "FLEX Test #"),
        FieldDef("identifier", "FLEX Identifier", "text", None, "identifier", "FLEX Identifier",
                 "Not unique (193F001 appears twice)."),
        FieldDef("test_date", "Test date", "text", None, "context", "Test Date"),
        FieldDef("fuel", "Fuel", "category", None, "input", "Fuel"),
        FieldDef("diluent", "Diluent", "category", None, "input", None, "Derived: CO2 if X_CO2>0, He if X_He>0, else N2-only."),
        FieldDef("series", "Identifier series", "category", None, "context", None, "Decoded from identifier pattern."),
        FieldDef("mixture_code", "Mixture code", "category", None, "context", None, "C## / H## / N## from identifier."),
        FieldDef("pressure_band", "Pressure band", "category", None, "input", None, "Derived from mmHg."),
        FieldDef("pressure_mmhg", "Ambient pressure", "numeric", "mmHg", "input", "Ambient pressure; mmHg"),
        FieldDef("pressure_atm", "Ambient pressure", "numeric", "atm", "input", None, "Derived: mmHg / 760."),
        FieldDef("x_o2", "Initial O2", "numeric", "mole fraction", "input", "O initial ambient composition; mole fraction"),
        FieldDef("x_n2", "Initial N2", "numeric", "mole fraction", "input", "N initial ambient composition; mole fraction"),
        FieldDef("x_co2", "Initial CO2 (header 'CO')", "numeric", "mole fraction", "input",
                 "CO initial ambient composition; mole fraction", "Header says CO; interpreted as CO2 diluent."),
        FieldDef("x_he", "Initial He", "numeric", "mole fraction", "input", "He initial ambient composition; mole fraction"),
        FieldDef("d0_mm", "Initial droplet diameter D0", "numeric", "mm", "input", "Droplet initial diameter; mm",
                 kind_col="d0_kind"),
        FieldDef("dext_mm", "Visible-flame extinction diameter", "numeric", "mm", "output",
                 "Visible flame extinction diameter; mm", kind_col="dext_kind"),
        FieldDef("k_mm2_s", "Burning-rate constant K", "numeric", "mm^2/s", "output", "Burning rate; mm",
                 "Header unit 'mm' interpreted as mm^2/s.", kind_col="k_kind"),
        FieldDef("burn_time_s", "Burn time", "numeric", "s", "output", "Burn time; s", kind_col="burn_time_kind"),
        FieldDef("test_end", "Test end", "category", None, "output", "Test end",
                 "'Disruption' is undefined locally (possibly censored)."),
    ),
    list_cols=("test_number", "identifier", "test_date", "fuel", "diluent", "pressure_atm", "x_o2", "x_co2", "x_he",
               "d0_mm", "dext_mm", "k_mm2_s", "burn_time_s", "test_end"),
)

BASS2 = DatasetDef(
    key="bass2", investigation_id="PSI-25", short_name="BASS-II", table="bass2_tests", display_col="test_id",
    search_cols=("test_id", "pi", "sample_id", "material_raw", "material_class", "date_raw"),
    default_sort="experiment_uid",
    fields=(
        FieldDef("test_id", "Test #", "text", None, "identifier", "Test #"),
        FieldDef("pi", "PI", "category", None, "context", "PI"),
        FieldDef("date_iso", "Date", "text", None, "context", "Date"),
        FieldDef("gmt_doy", "GMT (day of year)", "numeric", "day of year", "context", "GMT",
                 "Day-of-year, not a clock time."),
        FieldDef("sample_id", "Sample #", "text", None, "identifier", "Sample #"),
        FieldDef("material_class", "Material class", "category", None, "input", "Fuel Sample Material",
                 "Normalized from free text; raw string preserved."),
        FieldDef("geometry", "Geometry", "category", None, "input", "Fuel Sample Material"),
        FieldDef("thickness_mm", "Thickness", "numeric", "mm", "input", "Fuel Sample Material", "Parsed from material text."),
        FieldDef("diameter_mm", "Diameter", "numeric", "mm", "input", "Fuel Sample Material", "Parsed from material text."),
        FieldDef("width_cm", "Width", "numeric", "cm", "input", "Fuel Sample Material", "Parsed from material text."),
        FieldDef("flow_restrictor", "Flow restrictor", "category", None, "input", "Flow restrictor",
                 "0 = highest flow, 2 = lowest."),
        FieldDef("air_single_cm_s", "Air display (single reading)", "numeric", "cm/s", "instrument", "Air display",
                 "Only when the cell is one number; multi-stage cells are not reduced to one value."),
        FieldDef("o2_initial", "Initial O2", "numeric", "%vol", "input", "Calibrated  initial O2 % by vol ",
                 kind_col="o2_initial_kind"),
        FieldDef("o2_final", "Final O2", "numeric", "%vol", "output", "Calibrated final O2 % by vol",
                 kind_col="o2_final_kind"),
        FieldDef("co2_initial", "Initial CO2", "numeric", "%vol", "input", "Initial CO2 % by vol",
                 kind_col="co2_initial_kind"),
        FieldDef("co2_final", "Final CO2", "numeric", "%vol", "output", "Final CO2 % by vol", kind_col="co2_final_kind"),
        FieldDef("co_initial", "Initial CO", "numeric", "ppm", "input", "Initial CO (ppm)", kind_col="co_initial_kind"),
        FieldDef("co_final", "Final CO", "numeric", "ppm", "output", "Final CO (ppm)", kind_col="co_final_kind"),
    ),
    list_cols=("test_id", "pi", "date_iso", "gmt_doy", "sample_id", "material_class", "geometry", "flow_restrictor",
               "o2_initial", "o2_final", "co2_initial", "co2_final", "co_initial", "co_final"),
)

SAFFIRE1 = DatasetDef(
    key="saffire1", investigation_id="PSI-98", short_name="SAFFIRE-I", table="saffire_burns", display_col="sample",
    search_cols=("sample", "material", "flow_direction"),
    default_sort="sample",
    fields=(
        FieldDef("sample", "Sample Number", "text", None, "identifier", "Sample Number "),
        FieldDef("material", "Material", "category", None, "input", "Material"),
        FieldDef("flow_direction", "Flow direction", "category", None, "input", "Flow Direction "),
        FieldDef("thickness_cm", "Thickness", "numeric", "cm", "input", "Sample Thickness (cm)"),
        FieldDef("length_cm", "Length (CSV)", "numeric", "cm", "input", "Sample Length (cm)",
                 "Likely swapped with width (see quality flag)."),
        FieldDef("width_cm", "Width (CSV)", "numeric", "cm", "input", "Sample Width (cm)",
                 "Likely swapped with length (see quality flag)."),
        FieldDef("air_flow_cm_s", "Air flow", "numeric", "cm/s", "input", "Air Flow (cm/s)"),
        FieldDef("o2_low", "O2 (lower bound)", "numeric", "%", "input", "Percent O2", "From text range/approximation."),
        FieldDef("o2_high", "O2 (upper bound)", "numeric", "%", "input", "Percent O2", "From text range/approximation."),
        FieldDef("ignition_power_w", "Ignition power", "numeric", "W", "input", "Ignition Power (W)"),
        FieldDef("ignition_time_s", "Ignition time", "numeric", "s", "input", "Ignition Time (s)"),
        FieldDef("burn_time_s", "Burn time", "numeric", "s", "output", "Burn Time (s)"),
    ),
    list_cols=("sample", "material", "flow_direction", "air_flow_cm_s", "o2_raw", "burn_time_s"),
)

DATASETS: dict[str, DatasetDef] = {d.key: d for d in (FLEX, BASS2, SAFFIRE1)}
BY_INVESTIGATION: dict[str, DatasetDef] = {d.investigation_id: d for d in DATASETS.values()}


def dataset_for_uid(uid: str) -> DatasetDef | None:
    prefix = uid.split(":", 1)[0]
    return DATASETS.get(prefix)

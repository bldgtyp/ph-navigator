"""Shared built-in `status` single-select field for DataTable records.

A handful of DataTable-backed tables (Thermal Bridges plus most Equipment
tables) carry a first-class `status` column so the future splash-page
dashboard can report how complete the project record set is — how much is
done, still needed, blocked by a question, or intentionally not applicable.

The field is byte-identical across every table, so its FieldDef, option
list, option ids, and namespaced option key live here once instead of
being copy-pasted into every table module (PRD/PLAN: "one shared helper
to avoid copies drifting"). Every DataTable-backed table that carries a
`Datasheet` slot gets the field; Thermal Bridges is the lone status-
without-Datasheet table (pure dashboard accounting).

Storage contract:
- the option value lives in `row.custom_values["status"]`;
- the option list lives in `single_select_options["<table_label>.status"]`,
  the same `<table_label>.<field_key>` namespace the generic-table
  validator resolves single-select option lists under (see
  `_validators.validate_rows_custom_values`).
"""

from __future__ import annotations

from features.project_document.custom_fields import CustomFieldType, TableFieldDef
from features.project_document.document import SingleSelectOption
from features.project_document.tables._built_in_seeds import built_in_field_def

STATUS_FIELD_KEY = "status"
STATUS_DISPLAY_NAME = "Specification Status"

STATUS_OPTION_COMPLETE = "opt_status_complete"
STATUS_OPTION_NEEDED = "opt_status_needed"
STATUS_OPTION_QUESTION = "opt_status_question"
STATUS_OPTION_NA = "opt_status_na"

# New rows default to "Needed": work remains until a human marks it done.
STATUS_DEFAULT_OPTION_ID = STATUS_OPTION_NEEDED

STATUS_OPTION_IDS: tuple[str, ...] = (
    STATUS_OPTION_COMPLETE,
    STATUS_OPTION_NEEDED,
    STATUS_OPTION_QUESTION,
    STATUS_OPTION_NA,
)

# Tables that carry the built-in status field, keyed by their validation
# label (the `<table_label>` half of the `<table_label>.status` option
# key). This is the single source of truth for the field's table list;
# the table modules, `empty_project_document` defaults, seed JSON, and
# frontend schemas must all stay aligned with it.
STATUS_TABLE_NAMES: tuple[str, ...] = (
    "thermal_bridges",
    "pumps",
    "fans",
    "hot_water_heaters",
    "hot_water_tanks",
    "electric_heaters",
    "appliances",
    "ventilators",
    "heat_pumps_outdoor_equip",
    "heat_pumps_indoor_equip",
    "heat_pumps_outdoor_units",
    "heat_pumps_indoor_units",
)

# `(option_id, label, color)` in display order. Colors mirror the
# Materials / report-status semantic palette (frontend `--report-status-*`
# tokens); "Needed" uses the same amber as the typed Materials/Glazings/Frames
# `needed` status, because it is the same state in the other storage family.
_STATUS_OPTIONS: tuple[tuple[str, str, str], ...] = (
    (STATUS_OPTION_COMPLETE, "Complete", "#16a34a"),
    (STATUS_OPTION_NEEDED, "Needed", "#d97706"),
    (STATUS_OPTION_QUESTION, "Question", "#0ea5b7"),
    (STATUS_OPTION_NA, "N/A", "#9ca3af"),
)


def status_field_def() -> TableFieldDef:
    """Return the shared built-in `status` single-select FieldDef."""
    return built_in_field_def(
        field_key=STATUS_FIELD_KEY,
        display_name=STATUS_DISPLAY_NAME,
        field_type=CustomFieldType.single_select,
        default=STATUS_DEFAULT_OPTION_ID,
        description="Record completeness for dashboard accounting.",
    )


def status_option_list() -> list[SingleSelectOption]:
    """Return the four shared status options, in display order."""
    return [
        SingleSelectOption(id=option_id, label=label, color=color, order=order)
        for order, (option_id, label, color) in enumerate(_STATUS_OPTIONS)
    ]


def status_option_key(table_name: str) -> str:
    """Build the namespaced `<table_label>.status` option-list key.

    `table_name` is the table's contract name / validation label (e.g.
    `pumps`, `thermal_bridges`, `heat_pumps_outdoor_equip`), matching the
    `<table_label>.<field_key>` key that `validate_rows_custom_values`
    resolves single-select option lists under.
    """
    return f"{table_name}.{STATUS_FIELD_KEY}"

"""Generic tabular-element export for the Grasshopper Data API.

`GET /tables/{table_name}` serves the 12 row-based element tables (rooms, space
types, thermal bridges, and all equipment) from a saved document. Each table is
a Plan-31 mixed-storage envelope `{field_defs, rows}`: rows carry typed built-in
columns plus a `custom_values` bag. This exporter serializes both, keyed to the
stable GH-facing external names.

Payload conventions (PRD §4.4, decisions O5/O6):
- `records` — one object per row (`model_dump(mode="json")`): id + typed
  built-ins + `custom_values` / `custom_links` passed through verbatim (O5), so
  the GH side interprets custom fields via `field_defs` without hardcoding.
- `field_defs` — the table's field definitions, passed through.
- **Single-select denormalization** (O6): any single-select value (a `opt_…`
  option id, in a typed column or in `custom_values`) is emitted as
  `{"id", "label"}`, resolved from the document's `single_select_options`
  (which holds both built-in and custom option catalogs). Unset stays `null`.
- Cross-table references stay ids (e.g. an indoor unit's `outdoor_unit_id`); the
  GH side joins client-side. Asset references stay ids. No computed/formula
  values — raw stored fields only (computed rollups are a logged follow-up).
"""

from __future__ import annotations

from typing import Any

from starlette import status

from features.project_document.custom_fields import CustomFieldType
from features.project_document.document import ProjectDocumentV1, SingleSelectOption
from features.project_document.rows import RowWithCustomFields
from features.project_document.tables.contracts import read_table_envelope
from features.project_document.tables.registry import iter_table_contracts
from features.shared.errors import api_error

__all__ = ["TABLE_PATHS", "export_table"]

# GH-facing external name → attribute path under `document.tables`. External
# names are the stable GH contract, deliberately decoupled from the internal
# registry names (e.g. `ervs`, plural `heat_pumps_*`). The drift guard below
# ties each path to a real document table so this map can't silently desync.
TABLE_PATHS: dict[str, tuple[str, ...]] = {
    "rooms": ("rooms",),
    "space_types": ("space_types",),
    "thermal_bridges": ("thermal_bridges",),
    "pumps": ("equipment", "pumps"),
    "fans": ("equipment", "fans"),
    "ventilators": ("equipment", "ervs"),
    "hot_water_heaters": ("equipment", "hot_water_heaters"),
    "hot_water_tanks": ("equipment", "hot_water_tanks"),
    "electric_heaters": ("equipment", "electric_heaters"),
    "appliances": ("equipment", "appliances"),
    "heat_pump_indoor_units": ("equipment", "heat_pumps", "indoor_units"),
    "heat_pump_outdoor_units": ("equipment", "heat_pumps", "outdoor_units"),
}


def export_table(body: ProjectDocumentV1, table_name: str) -> dict[str, list[Any]]:
    """Serialize one allowlisted table as `{field_defs, records}` for Grasshopper."""
    path = TABLE_PATHS.get(table_name)
    if path is None:
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "unknown_table",
            f"Unknown table {table_name!r}.",
            {"valid_names": sorted(TABLE_PATHS)},
        )
    # `read_table_envelope` is typed `-> object`; every allowlisted path lands on
    # a `{field_defs, rows}` envelope (guaranteed by the module-load drift guard).
    envelope: Any = read_table_envelope(body, path)
    option_labels = _option_label_index(body.single_select_options)
    single_select_keys = {
        field_def.field_key
        for field_def in envelope.field_defs
        if field_def.field_type is CustomFieldType.single_select
    }
    return {
        "field_defs": [field_def.model_dump(mode="json") for field_def in envelope.field_defs],
        "records": [_record(row, single_select_keys, option_labels) for row in envelope.rows],
    }


def _record(row: RowWithCustomFields, single_select_keys: set[str], option_labels: dict[str, str]) -> dict[str, Any]:
    data = row.model_dump(mode="json")

    def denormalize(bag: dict[str, Any]) -> None:
        # Single-selects live either in a typed column (top-level) or the
        # custom_values bag; wrap whichever holds the option id.
        for key in single_select_keys & bag.keys():
            bag[key] = _denormalize_option(bag[key], option_labels)

    denormalize(data)
    custom_values = data.get("custom_values")
    if isinstance(custom_values, dict):
        denormalize(custom_values)
    return data


def _denormalize_option(value: object, option_labels: dict[str, str]) -> object:
    if isinstance(value, str) and value.startswith("opt_"):
        return {"id": value, "label": option_labels.get(value)}
    return value


def _option_label_index(single_select_options: dict[str, list[SingleSelectOption]]) -> dict[str, str]:
    """Flatten every option catalog to `{option_id: label}`.

    Option ids are globally unique, so one flat map resolves any single-select
    value regardless of which table/field catalog it came from (built-in or
    custom — both live in the document's `single_select_options`).
    """
    return {option.id: option.label for options in single_select_options.values() for option in options}


# Drift guard (mirrors registry.py's status-field guard): every GH-facing path
# must resolve to a real document table. If a table is renamed/moved internally,
# or a new GH name is added with a wrong path, this fails at import rather than
# 422-ing silently at request time.
_known_table_paths = {contract.table_path for contract in iter_table_contracts()}
_unknown = {name: path for name, path in TABLE_PATHS.items() if path not in _known_table_paths}
assert not _unknown, f"TABLE_PATHS entries do not match any document table contract: {_unknown}"

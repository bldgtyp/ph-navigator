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
  GH side joins client-side. Asset references stay ids.
- **Reverse links** are emitted per target record in `inverse_links`, keyed by
  the stable `<source_table_path>.<field_key>` source key. Values remain source
  row ids so GH can join them against the corresponding table download.
- **Computed/formula values** (decisions D8/D10): a formula field's resolved
  value is emitted **inline** on the record, keyed by its `field_key`, alongside
  the typed built-ins and `custom_values`. Formula values are never persisted —
  they are derived on read by `evaluate_table_formulas` (the same overlay MCP and
  the frontend already surface). A row whose formula errored exports `null` (an
  energy model can't consume `#ERROR`).
"""

from __future__ import annotations

from typing import Any

from starlette import status

from features.project_document.custom_fields import CustomFieldType
from features.project_document.document import ProjectDocumentV1, SingleSelectOption
from features.project_document.formula.document_evaluator import evaluate_table_formulas, overlay_cell_value
from features.project_document.inverse_view import attach_inverse_links_overlay, build_inverse_table_view
from features.project_document.rows import RowWithCustomFields
from features.project_document.tables.contracts import TableFieldRegistry, read_table_envelope
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
    formula_keys = {
        field_def.field_key for field_def in envelope.field_defs if field_def.field_type is CustomFieldType.formula
    }
    # Overlay of derived formula values (`{row_id: {field_key: value | {"error"}}}`).
    # `_REGISTRY_BY_PATH` only holds FieldDef tables and the import-time guard pins
    # every exported path into it, so the lookup is total and already non-optional.
    overlay = evaluate_table_formulas(_REGISTRY_BY_PATH[path], body)
    inverse_view = build_inverse_table_view(body, path)
    records = [_record(row, single_select_keys, formula_keys, option_labels, overlay) for row in envelope.rows]
    # Attach reverse-link ids via the shared derived-export helper (the same seam
    # the rooms/ventilators table payloads use). Only tables that are a link
    # target gain the `inverse_links` key.
    if inverse_view.inverse_link_fields:
        records = attach_inverse_links_overlay(records, inverse_view.inverse_links)
    return {
        "field_defs": [field_def.model_dump(mode="json") for field_def in envelope.field_defs],
        "records": records,
    }


def _record(
    row: RowWithCustomFields,
    single_select_keys: set[str],
    formula_keys: set[str],
    option_labels: dict[str, str],
    overlay: dict[str, dict[str, object]],
) -> dict[str, Any]:
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
    # Merge derived formula values inline (D10). A formula has no stored cell, so
    # its `field_key` never collides with a typed column or `custom_values`; an
    # errored row exports `null` (via `overlay_cell_value`).
    # `id` is declared on each concrete row model, not the base (mirrors the
    # evaluator's own `getattr(row, "id", "")` keying).
    row_overlay = overlay.get(str(getattr(row, "id", "")), {})
    for field_key in formula_keys:
        data[field_key] = overlay_cell_value(row_overlay.get(field_key))
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
# must resolve to a real FieldDef document table. If a table is renamed/moved
# internally, opts out of the field registry, or a new GH name is added with a
# wrong path, this fails at import rather than 422-ing (or KeyError-ing) at
# request time. Keying by `table_path` also lets `export_table` fetch a path's
# field registry — guaranteed present by construction — without re-scanning.
_REGISTRY_BY_PATH: dict[tuple[str, ...], TableFieldRegistry] = {
    contract.table_path: contract.field_registry
    for contract in iter_table_contracts()
    if contract.field_registry is not None
}
_unknown = {name: path for name, path in TABLE_PATHS.items() if path not in _REGISTRY_BY_PATH}
assert not _unknown, f"TABLE_PATHS entries must map to a FieldDef table contract: {_unknown}"

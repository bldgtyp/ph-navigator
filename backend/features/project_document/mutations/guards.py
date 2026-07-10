"""Shared validation guards and envelope helpers used by every dispatcher.

These helpers are deliberately lightweight: fingerprint match, field
lookup, display-name / id collision checks, insert-position resolution,
and row read/write through the table envelope. Every guard raises
`features.shared.errors.api_error` on failure; none return error
sentinels. The `origin` slot on each FieldDef carries the
`"built_in"` / `"custom"` discriminator surfaced in
`colliding_field_origin` envelopes.
"""

from __future__ import annotations

from typing import Any, Final, cast

from starlette import status

from features.project_document.custom_fields import (
    RESERVED_CUSTOM_FIELD_KEYS,
    CustomFieldType,
    TableFieldDef,
    normalize_display_name,
)
from features.project_document.document import ProjectDocumentV1
from features.project_document.mutations.models import EditFieldBundleMutation, FieldSchemaMutation
from features.project_document.tables.contracts import TableFieldRegistry
from features.shared.errors import api_error

__all__ = [
    "CARRY_FORWARD_UNITS",
    "check_stale_fingerprint",
    "collapse_carried_units",
    "enforce_fixed_units_lock",
    "find_field",
    "number_units_are_fixed",
    "read_rows_from_envelope",
    "reject_duplicate_display_name",
    "reject_field_id_collision",
    "reject_reserved_field_key",
    "replace_rows_in_envelope",
    "resolve_insert_position",
    "resolved_display_units",
    "strip_field_from_row",
    "strip_field_from_rows",
]

# Sentinel: the client sent no explicit units signal, so the server carries
# the existing units forward (on a number→formula convert / same-type edit)
# or seeds them back (on a formula→number reverse). Distinct from `None`,
# which is an explicit clear to a bare-number formula (D12 tri-state).
CARRY_FORWARD_UNITS: Final = object()


def number_units_are_fixed(field: TableFieldDef) -> bool:
    """True when the field carries a catalog-locked (`mode == "fixed"`) unit."""
    units = field.config.get("units")
    return isinstance(units, dict) and cast(dict[str, object], units).get("mode") == "fixed"


def resolved_display_units(mutation: EditFieldBundleMutation) -> object:
    """The D12 tri-state display-units signal for a bundle:

    - `CARRY_FORWARD_UNITS` — the field was absent from the request (carry forward);
    - `None` — an explicit clear to a bare-number formula;
    - a units dict — set / retag.
    """
    if "display_units" not in mutation.model_fields_set:
        return CARRY_FORWARD_UNITS
    return mutation.display_units


def collapse_carried_units(signal: object, fallback_units: object) -> object:
    """Resolve a units tri-state signal to a concrete value: `CARRY_FORWARD_UNITS`
    → `fallback_units` (the existing / source units); otherwise the signal itself
    (a units dict to set, or `None` to clear). The one place the sentinel meets
    its fallback — used by the guard, the bundle, and `apply_set_formula`."""
    return fallback_units if signal is CARRY_FORWARD_UNITS else signal


def _effective_after_units(
    existing: TableFieldDef,
    to_type: CustomFieldType,
    after_config: dict[str, object],
    display_units: object,
) -> object:
    """The units the field will actually carry after this edit (D13).

    - `number` target: a `number → number` edit keeps exact-match semantics
      (`after_config["units"]`); a `formula → number` reverse carries the
      display-unit back when the client sends none (D6 / undo).
    - `formula` target: the `display_units` tri-state — provided (set or
      explicit clear) wins, else the existing units carry forward (D5).
    - any other target: units are irrelevant (the type gate rejects first).
    """
    existing_units = existing.config.get("units")
    if to_type is CustomFieldType.number:
        if existing.field_type is CustomFieldType.formula and "units" not in after_config:
            return existing_units
        return after_config.get("units")
    if to_type is CustomFieldType.formula:
        return collapse_carried_units(display_units, existing_units)
    return None


def enforce_fixed_units_lock(
    existing: TableFieldDef,
    to_type: CustomFieldType,
    after_config: dict[str, object],
    field_id: str,
    display_units: object = CARRY_FORWARD_UNITS,
) -> None:
    """D13: a fixed-unit field may change type only `number ↔ formula`, and its
    units may never be retargeted — on either type. `editable`-unit and unit-less
    fields skip entirely. The effective-after units are computed here so the rule
    lives in exactly one place; `display_units` (the D12 tri-state) is only
    meaningful for a formula target, so a standalone changeType omits it."""
    if not number_units_are_fixed(existing):
        return
    if to_type not in (CustomFieldType.number, CustomFieldType.formula):
        raise _fixed_units_locked(field_id)
    if _effective_after_units(existing, to_type, after_config, display_units) != existing.config.get("units"):
        raise _fixed_units_locked(field_id)


def _fixed_units_locked(field_id: str) -> Any:
    return api_error(
        status.HTTP_422_UNPROCESSABLE_CONTENT,
        "custom_field_fixed_units_locked",
        "Fixed unit config cannot be edited.",
        {"field_id": field_id},
    )


def check_stale_fingerprint(
    body: ProjectDocumentV1,
    mutation: FieldSchemaMutation,
    capability: TableFieldRegistry,
) -> None:
    actual = capability.compute_schema_fingerprint(body)
    expected = mutation.expected_schema_fingerprint
    if actual != expected:
        raise api_error(
            status.HTTP_409_CONFLICT,
            "custom_field_stale_schema_fingerprint",
            "Schema fingerprint does not match the current draft.",
            {
                "expected_fingerprint": expected,
                "actual_fingerprint": actual,
                "table_key": mutation.table_key,
            },
        )


def find_field(
    field_defs: list[TableFieldDef],
    field_key: str,
    table_key: str,
) -> tuple[int, TableFieldDef]:
    for index, field in enumerate(field_defs):
        if field.field_key == field_key:
            return index, field
    raise api_error(
        status.HTTP_422_UNPROCESSABLE_CONTENT,
        "custom_field_invalid_field_id",
        "Custom field id was not found in this table.",
        {"field_id": field_key, "table_key": table_key},
    )


def reject_field_id_collision(
    field_defs: list[TableFieldDef],
    new_field_key: str,
) -> None:
    if any(field.field_key == new_field_key for field in field_defs):
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "custom_field_invalid_field_id",
            "Custom field id is already in use on this table.",
            {"field_id": new_field_key},
        )


def reject_reserved_field_key(field_key: str) -> None:
    """Reject `field_key`s reserved for built-in slots (PRD §P4.3).

    Custom fields cannot claim `"record_id"` as their `field_key`; the
    slot belongs to the per-table built-in identifier FieldDef. Phase
    1a reserved the namespace before the semantics shipped; Phase 2
    wires the guard into the add / duplicate dispatchers.
    """
    if field_key in RESERVED_CUSTOM_FIELD_KEYS:
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "custom_field_invalid_field_id",
            f"Custom fields cannot use the reserved field_key {field_key!r}.",
            {"field_id": field_key, "reason": "reserved_field_key"},
        )


def reject_duplicate_display_name(
    field_defs: list[TableFieldDef],
    candidate: str,
    *,
    skip_field_key: str | None = None,
) -> None:
    normalized_candidate = normalize_display_name(candidate)
    for field in field_defs:
        if field.field_key == skip_field_key:
            continue
        if normalize_display_name(field.display_name) != normalized_candidate:
            continue
        origin_label = "built-in" if field.origin == "built_in" else "custom"
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "custom_field_duplicate_name",
            f"Field name '{candidate}' already exists in this table ({origin_label} field).",
            {
                "field_name": candidate,
                "colliding_field_id": field.field_key,
                "colliding_field_origin": field.origin,
            },
        )


def resolve_insert_position(
    field_defs: list[TableFieldDef],
    insert_after_field_key: str | None,
    table_key: str,
) -> int:
    if insert_after_field_key is None:
        return len(field_defs)
    for index, field in enumerate(field_defs):
        if field.field_key == insert_after_field_key:
            return index + 1
    raise api_error(
        status.HTTP_422_UNPROCESSABLE_CONTENT,
        "custom_field_invalid_field_id",
        "Anchor field id for insertion was not found in this table.",
        {"field_id": insert_after_field_key, "table_key": table_key},
    )


def strip_field_from_rows(
    body: ProjectDocumentV1,
    table_key: str,
    field_key: str,
    capability: TableFieldRegistry,
) -> tuple[list[object], int]:
    """Return (next_rows, cleared_row_count) for the deleted field."""
    rows = read_rows_from_envelope(body, table_key)
    cleared = 0
    next_rows: list[object] = []
    for row in rows:
        next_row, row_was_cleared = strip_field_from_row(row, field_key, capability)
        if row_was_cleared:
            cleared += 1
        next_rows.append(next_row)
    return next_rows, cleared


def strip_field_from_row(
    row: object,
    field_key: str,
    capability: TableFieldRegistry,
) -> tuple[object, bool]:
    custom_values = capability.read_row_custom_values(row)
    custom_links = capability.read_row_links(row)
    has_value = field_key in custom_values
    has_link = field_key in custom_links
    if not has_value and not has_link:
        return row, False
    stripped_values = {key: value for key, value in custom_values.items() if key != field_key}
    stripped_links = {key: value for key, value in custom_links.items() if key != field_key}
    stripped_row = capability.set_row_custom_values(row, stripped_values)
    return capability.set_row_links(stripped_row, stripped_links), True


def read_rows_from_envelope(body: ProjectDocumentV1, table_key: str) -> list[object]:
    """Pull the row list out of the table's envelope.

    FieldDef-capable equipment tables live under `tables.equipment`,
    while Rooms and Thermal Bridges are top-level envelopes. Resolve
    through the table contract path so mutation handlers stay table-
    agnostic.
    """
    from features.project_document.tables.contracts import read_table_envelope
    from features.project_document.tables.registry import get_table_contract

    envelope = read_table_envelope(body, get_table_contract(table_key).table_path)
    rows = getattr(envelope, "rows", None)
    if rows is None:
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "custom_field_unsupported_table",
            "Table envelope does not expose rows.",
            {"table_key": table_key},
        )
    return list(rows)


def replace_rows_in_envelope(
    body: ProjectDocumentV1,
    table_key: str,
    rows: list[object],
) -> ProjectDocumentV1:
    from features.project_document.tables.contracts import read_table_envelope, replace_table_envelope
    from features.project_document.tables.registry import get_table_contract

    table_path = get_table_contract(table_key).table_path
    envelope = cast(Any, read_table_envelope(body, table_path))
    next_envelope = envelope.model_copy(update={"rows": list(rows)})
    return replace_table_envelope(body, table_path, next_envelope)

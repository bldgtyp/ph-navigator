"""Shared validation guards and envelope helpers used by every dispatcher.

These helpers are deliberately lightweight: fingerprint match, field
lookup, display-name / id collision checks, insert-position resolution,
and row read/write through the table envelope. Every guard raises
`features.shared.errors.api_error` on failure; none return error
sentinels.
"""

from __future__ import annotations

from starlette import status

from features.project_document.custom_fields import (
    CustomFieldDef,
    normalize_display_name,
)
from features.project_document.document import ProjectDocumentV1
from features.project_document.mutations.models import FieldSchemaMutation
from features.project_document.tables.contracts import CustomFieldCapability
from features.shared.errors import api_error

__all__ = [
    "check_stale_fingerprint",
    "find_field",
    "read_rows_from_envelope",
    "reject_duplicate_display_name",
    "reject_field_id_collision",
    "replace_rows_in_envelope",
    "resolve_insert_position",
    "strip_field_from_rows",
]


def check_stale_fingerprint(
    body: ProjectDocumentV1,
    mutation: FieldSchemaMutation,
    capability: CustomFieldCapability,
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
    custom_fields: list[CustomFieldDef],
    field_id: str,
    table_key: str,
) -> tuple[int, CustomFieldDef]:
    for index, field in enumerate(custom_fields):
        if field.id == field_id:
            return index, field
    raise api_error(
        status.HTTP_422_UNPROCESSABLE_ENTITY,
        "custom_field_invalid_field_id",
        "Custom field id was not found in this table.",
        {"field_id": field_id, "table_key": table_key},
    )


def reject_field_id_collision(
    custom_fields: list[CustomFieldDef],
    new_field_id: str,
) -> None:
    if any(field.id == new_field_id for field in custom_fields):
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "custom_field_invalid_field_id",
            "Custom field id is already in use on this table.",
            {"field_id": new_field_id},
        )


def reject_duplicate_display_name(
    custom_fields: list[CustomFieldDef],
    core_display_names: tuple[str, ...],
    candidate: str,
    *,
    skip_field_id: str | None = None,
) -> None:
    normalized_candidate = normalize_display_name(candidate)
    for core_name in core_display_names:
        if normalize_display_name(core_name) == normalized_candidate:
            raise api_error(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                "custom_field_duplicate_name",
                f"Field name '{candidate}' already exists in this table (core field).",
                {
                    "field_name": candidate,
                    "colliding_field_id": core_name,
                    "colliding_field_origin": "core",
                },
            )
    for field in custom_fields:
        if field.id == skip_field_id:
            continue
        if normalize_display_name(field.display_name) == normalized_candidate:
            raise api_error(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                "custom_field_duplicate_name",
                f"Field name '{candidate}' already exists in this table (custom field).",
                {
                    "field_name": candidate,
                    "colliding_field_id": field.id,
                    "colliding_field_origin": "custom",
                },
            )


def resolve_insert_position(
    custom_fields: list[CustomFieldDef],
    insert_after_field_id: str | None,
    table_key: str,
) -> int:
    if insert_after_field_id is None:
        return len(custom_fields)
    for index, field in enumerate(custom_fields):
        if field.id == insert_after_field_id:
            return index + 1
    raise api_error(
        status.HTTP_422_UNPROCESSABLE_ENTITY,
        "custom_field_invalid_field_id",
        "Anchor field id for insertion was not found in this table.",
        {"field_id": insert_after_field_id, "table_key": table_key},
    )


def strip_field_from_rows(
    body: ProjectDocumentV1,
    table_key: str,
    field_id: str,
    capability: CustomFieldCapability,
) -> tuple[list[object], int]:
    """Return (next_rows, cleared_row_count) for the deleted field."""
    rows = read_rows_from_envelope(body, table_key)
    cleared = 0
    next_rows: list[object] = []
    for row in rows:
        custom = capability.read_row_custom(row)
        if field_id in custom:
            cleared += 1
            stripped = {key: value for key, value in custom.items() if key != field_id}
            next_rows.append(capability.set_row_custom(row, stripped))
        else:
            next_rows.append(row)
    return next_rows, cleared


def read_rows_from_envelope(body: ProjectDocumentV1, table_key: str) -> list[object]:
    """Pull the row list out of the table's envelope.

    Phase 2 only ships Rooms; the dotted-path indirection through
    `getattr(body.tables, ...)` is here so registering ERVs / Pumps /
    Fans later does not need a per-table reader.
    """
    envelope = getattr(body.tables, table_key)
    rows = getattr(envelope, "rows", None)
    if rows is None:
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
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
    envelope = getattr(body.tables, table_key)
    next_envelope = envelope.model_copy(update={"rows": list(rows)})
    next_tables = body.tables.model_copy(update={table_key: next_envelope})
    return body.model_copy(update={"tables": next_tables})

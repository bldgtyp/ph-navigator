"""Typed `FieldSchemaMutation` union + `apply_schema_mutation` dispatcher.

Each mutation kind carries an `expected_schema_fingerprint` for
optimistic-concurrency; the dispatcher rejects stale fingerprints,
validates per-mutation rules through the capability accessors, then
re-validates the resulting document. `changeType` / `setFormula` are
declared in the discriminator so the wire contract is closed; the
dispatcher rejects them with `custom_field_unsupported_mutation`
until later phases implement them.
"""

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field
from starlette import status

from features.project_document.custom_fields import (
    CUSTOM_FIELD_DESCRIPTION_MAX,
    CustomFieldDef,
    normalize_display_name,
)
from features.project_document.document import ProjectDocumentV1
from features.project_document.tables.contracts import CustomFieldCapability
from features.project_document.validation import validate_document
from features.shared.errors import api_error

# Audit-log action kind per mutation discriminator. drafts.py / MCP
# write the matching key so the action log is filterable.
AUDIT_KIND_BY_MUTATION: dict[str, str] = {
    "addField": "project_version_custom_field_add",
    "renameField": "project_version_custom_field_rename",
    "deleteField": "project_version_custom_field_delete",
    "duplicateField": "project_version_custom_field_duplicate",
    "setDescription": "project_version_custom_field_set_description",
}

_DEFERRED_MUTATION_PHASES: dict[str, str] = {
    "changeType": "Phase 3",
    "setFormula": "Phase 4",
}


def _to_lower_camel(value: str) -> str:
    head, *tail = value.split("_")
    return head + "".join(part[:1].upper() + part[1:] for part in tail)


_SCHEMA_MUTATION_MODEL_CONFIG = ConfigDict(
    extra="forbid",
    populate_by_name=True,
    alias_generator=_to_lower_camel,
)


class AddFieldMutation(BaseModel):
    model_config = _SCHEMA_MUTATION_MODEL_CONFIG

    kind: Literal["addField"]
    table_key: str
    after: CustomFieldDef
    insert_after_field_id: str | None = None
    expected_schema_fingerprint: str


class RenameFieldMutation(BaseModel):
    model_config = _SCHEMA_MUTATION_MODEL_CONFIG

    kind: Literal["renameField"]
    table_key: str
    field_id: str
    display_name: str = Field(min_length=1, max_length=120)
    expected_schema_fingerprint: str


class DeleteFieldMutation(BaseModel):
    model_config = _SCHEMA_MUTATION_MODEL_CONFIG

    kind: Literal["deleteField"]
    table_key: str
    field_id: str
    # `True` is the only accepted value — the discriminated WriteOp in
    # data-table.md pins the contract that delete always clears row
    # values atomically. Keep the field present so the wire shape is
    # explicit / non-defaultable from the caller's side.
    clear_values: Literal[True] = True
    expected_schema_fingerprint: str


class DuplicateFieldMutation(BaseModel):
    model_config = _SCHEMA_MUTATION_MODEL_CONFIG

    kind: Literal["duplicateField"]
    table_key: str
    source_field_id: str
    # Caller mints the fresh `cf_*` id, deep-copies `field_type` /
    # `config` / `description` from the source, and supplies the
    # uniquified `display_name` (US-CF-13 client-side rule). The
    # server still re-validates everything and stamps `created_by`.
    after: CustomFieldDef
    expected_schema_fingerprint: str


class SetDescriptionMutation(BaseModel):
    model_config = _SCHEMA_MUTATION_MODEL_CONFIG

    kind: Literal["setDescription"]
    table_key: str
    field_id: str
    # Length is clamped (truncated) to CUSTOM_FIELD_DESCRIPTION_MAX
    # in `apply_schema_mutation` rather than rejected, so accidental
    # over-length input from an MCP agent is normalized server-side.
    description: str | None = None
    expected_schema_fingerprint: str


class ChangeTypeMutation(BaseModel):
    """Declared up front to close the discriminator; rejected by the
    dispatcher with `custom_field_unsupported_mutation` until Phase 3."""

    model_config = _SCHEMA_MUTATION_MODEL_CONFIG

    kind: Literal["changeType"]
    table_key: str
    field_id: str
    after: CustomFieldDef
    cell_writes: list[dict[str, object]] = Field(default_factory=list)
    expected_schema_fingerprint: str


class SetFormulaMutation(BaseModel):
    """Declared up front to close the discriminator; rejected by the
    dispatcher with `custom_field_unsupported_mutation` until Phase 4."""

    model_config = _SCHEMA_MUTATION_MODEL_CONFIG

    kind: Literal["setFormula"]
    table_key: str
    field_id: str
    config: dict[str, object]
    expected_schema_fingerprint: str


FieldSchemaMutation = Annotated[
    AddFieldMutation
    | RenameFieldMutation
    | DeleteFieldMutation
    | DuplicateFieldMutation
    | SetDescriptionMutation
    | ChangeTypeMutation
    | SetFormulaMutation,
    Field(discriminator="kind"),
]


def apply_schema_mutation(
    body: ProjectDocumentV1,
    mutation: FieldSchemaMutation,
    *,
    actor_user_id: str,
    capability: CustomFieldCapability,
) -> tuple[ProjectDocumentV1, dict[str, object]]:
    """Apply one `FieldSchemaMutation` to `body`, return (next_body, audit).

    Rejections raise `features.shared.errors.api_error`; no partial body
    is produced. Final `validate_document` ensures any per-table check
    that slipped past the preflight surfaces here.
    """
    _check_stale_fingerprint(body, mutation, capability)

    if isinstance(mutation, ChangeTypeMutation | SetFormulaMutation):
        _raise_unsupported_mutation(mutation.kind)

    if isinstance(mutation, AddFieldMutation):
        next_body, audit = _apply_add_field(body, mutation, actor_user_id, capability)
    elif isinstance(mutation, RenameFieldMutation):
        next_body, audit = _apply_rename_field(body, mutation, capability)
    elif isinstance(mutation, DeleteFieldMutation):
        next_body, audit = _apply_delete_field(body, mutation, capability)
    elif isinstance(mutation, DuplicateFieldMutation):
        next_body, audit = _apply_duplicate_field(body, mutation, actor_user_id, capability)
    elif isinstance(mutation, SetDescriptionMutation):
        next_body, audit = _apply_set_description(body, mutation, capability)
    else:
        # Defensive — every discriminator branch is handled above; this
        # only fires if the union grows without a matching dispatcher.
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "custom_field_unsupported_mutation",
            "Unknown custom-field mutation kind.",
            {"kind": getattr(mutation, "kind", "unknown")},
        )

    validated = validate_document(next_body.model_dump(mode="json"))
    return validated, audit


def validate_schema_mutation(
    body: ProjectDocumentV1,
    mutation: FieldSchemaMutation,
    *,
    capability: CustomFieldCapability,
) -> None:
    """Run schema-mutation preflight without committing the result.

    Delegating to `apply_schema_mutation` keeps dry-run validation in
    lockstep with the write path.
    """
    apply_schema_mutation(
        body,
        mutation,
        actor_user_id=_VALIDATE_ONLY_ACTOR,
        capability=capability,
    )


_VALIDATE_ONLY_ACTOR = "__validate_only__"


def _apply_add_field(
    body: ProjectDocumentV1,
    mutation: AddFieldMutation,
    actor_user_id: str,
    capability: CustomFieldCapability,
) -> tuple[ProjectDocumentV1, dict[str, object]]:
    current_fields = capability.read_custom_fields(body)
    _reject_field_id_collision(current_fields, mutation.after.id)
    _reject_duplicate_display_name(
        current_fields,
        capability.core_display_names,
        mutation.after.display_name,
    )
    position = _resolve_insert_position(
        current_fields,
        mutation.insert_after_field_id,
        mutation.table_key,
    )

    stamped = mutation.after.model_copy(update={"created_by": actor_user_id})
    next_fields = list(current_fields)
    next_fields.insert(position, stamped)
    next_body = capability.replace_custom_fields(body, next_fields)
    audit: dict[str, object] = {
        "kind": "addField",
        "table_key": mutation.table_key,
        "field_id": stamped.id,
        "display_name": stamped.display_name,
        "field_type": stamped.field_type.value,
    }
    return next_body, audit


def _apply_rename_field(
    body: ProjectDocumentV1,
    mutation: RenameFieldMutation,
    capability: CustomFieldCapability,
) -> tuple[ProjectDocumentV1, dict[str, object]]:
    current_fields = capability.read_custom_fields(body)
    index, existing = _find_field(current_fields, mutation.field_id, mutation.table_key)
    _reject_duplicate_display_name(
        current_fields,
        capability.core_display_names,
        mutation.display_name,
        skip_field_id=mutation.field_id,
    )

    renamed = existing.model_copy(update={"display_name": mutation.display_name})
    next_fields = list(current_fields)
    next_fields[index] = renamed
    next_body = capability.replace_custom_fields(body, next_fields)
    audit: dict[str, object] = {
        "kind": "renameField",
        "table_key": mutation.table_key,
        "field_id": mutation.field_id,
        "old_display_name": existing.display_name,
        "new_display_name": mutation.display_name,
    }
    return next_body, audit


def _apply_delete_field(
    body: ProjectDocumentV1,
    mutation: DeleteFieldMutation,
    capability: CustomFieldCapability,
) -> tuple[ProjectDocumentV1, dict[str, object]]:
    current_fields = capability.read_custom_fields(body)
    _find_field(current_fields, mutation.field_id, mutation.table_key)

    # Strip the field id from every row's `custom` dict first; then
    # remove the schema entry. Doing rows before schema keeps the
    # intermediate body's `validate_document_references` happy
    # (custom values must reference a known field id).
    next_rows, cleared_row_count = _strip_field_from_rows(body, mutation.table_key, mutation.field_id, capability)
    body_with_stripped_rows = _replace_rows_in_envelope(body, mutation.table_key, next_rows)

    next_fields = [field for field in current_fields if field.id != mutation.field_id]
    next_body = capability.replace_custom_fields(body_with_stripped_rows, next_fields)
    audit: dict[str, object] = {
        "kind": "deleteField",
        "table_key": mutation.table_key,
        "field_id": mutation.field_id,
        "cleared_row_count": cleared_row_count,
    }
    return next_body, audit


def _apply_duplicate_field(
    body: ProjectDocumentV1,
    mutation: DuplicateFieldMutation,
    actor_user_id: str,
    capability: CustomFieldCapability,
) -> tuple[ProjectDocumentV1, dict[str, object]]:
    current_fields = capability.read_custom_fields(body)
    source_index, source = _find_field(current_fields, mutation.source_field_id, mutation.table_key)
    if mutation.after.id == mutation.source_field_id:
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "custom_field_invalid_field_id",
            "Duplicate target id must differ from the source field id.",
            {
                "field_id": mutation.after.id,
                "table_key": mutation.table_key,
            },
        )
    _reject_field_id_collision(current_fields, mutation.after.id)
    _reject_duplicate_display_name(
        current_fields,
        capability.core_display_names,
        mutation.after.display_name,
    )

    stamped = mutation.after.model_copy(update={"created_by": actor_user_id})
    next_fields = list(current_fields)
    next_fields.insert(source_index + 1, stamped)
    next_body = capability.replace_custom_fields(body, next_fields)
    audit: dict[str, object] = {
        "kind": "duplicateField",
        "table_key": mutation.table_key,
        "source_field_id": source.id,
        "new_field_id": stamped.id,
        "display_name": stamped.display_name,
    }
    return next_body, audit


def _apply_set_description(
    body: ProjectDocumentV1,
    mutation: SetDescriptionMutation,
    capability: CustomFieldCapability,
) -> tuple[ProjectDocumentV1, dict[str, object]]:
    current_fields = capability.read_custom_fields(body)
    index, existing = _find_field(current_fields, mutation.field_id, mutation.table_key)

    raw = mutation.description
    if raw is None:
        clamped: str | None = None
    else:
        clamped = raw[:CUSTOM_FIELD_DESCRIPTION_MAX]
    next_field = existing.model_copy(update={"description": clamped})
    next_fields = list(current_fields)
    next_fields[index] = next_field
    next_body = capability.replace_custom_fields(body, next_fields)
    audit: dict[str, object] = {
        "kind": "setDescription",
        "table_key": mutation.table_key,
        "field_id": mutation.field_id,
        "old_description_length": len(existing.description or ""),
        "new_description_length": len(clamped or ""),
    }
    return next_body, audit


def _check_stale_fingerprint(
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


def _raise_unsupported_mutation(kind: str) -> None:
    phase = _DEFERRED_MUTATION_PHASES.get(kind, "a later phase")
    raise api_error(
        status.HTTP_422_UNPROCESSABLE_ENTITY,
        "custom_field_unsupported_mutation",
        f"{kind} for custom fields is not available yet (planned for {phase}).",
        {"kind": kind, "available_in_phase": phase},
    )


def _find_field(
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


def _reject_field_id_collision(
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


def _reject_duplicate_display_name(
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


def _resolve_insert_position(
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


def _strip_field_from_rows(
    body: ProjectDocumentV1,
    table_key: str,
    field_id: str,
    capability: CustomFieldCapability,
) -> tuple[list[object], int]:
    """Return (next_rows, cleared_row_count) for the deleted field."""
    rows = _read_rows_from_envelope(body, table_key)
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


def _read_rows_from_envelope(body: ProjectDocumentV1, table_key: str) -> list[object]:
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


def _replace_rows_in_envelope(
    body: ProjectDocumentV1,
    table_key: str,
    rows: list[object],
) -> ProjectDocumentV1:
    envelope = getattr(body.tables, table_key)
    next_envelope = envelope.model_copy(update={"rows": list(rows)})
    next_tables = body.tables.model_copy(update={table_key: next_envelope})
    return body.model_copy(update={"tables": next_tables})

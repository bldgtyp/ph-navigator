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

from typing import Annotated, Literal, cast

from pydantic import BaseModel, ConfigDict, Field
from starlette import status

from features.project_document.custom_fields import (
    CUSTOM_FIELD_DESCRIPTION_MAX,
    SHORT_TEXT_MAX_LENGTH,
    CustomFieldDef,
    CustomFieldType,
    CustomValue,
    normalize_display_name,
)
from features.project_document.document import ProjectDocumentV1, SingleSelectOption
from features.project_document.formula import (
    SOURCE_LENGTH_MAX,
    FormulaAST,
    FormulaCycleError,
    FormulaMissingRefError,
    FormulaParseError,
    FormulaResourceLimitError,
    FormulaUnsupportedFunctionError,
    ast_from_json,
    ast_to_json,
    build_field_registry,
    detect_cycles,
    parse,
    resolve_refs,
)
from features.project_document.formula.resolver import collect_field_refs
from features.project_document.options import (
    OPTION_COLOR_PALETTE,
    mint_option_id,
    option_list_key,
    remove_option_list,
    validate_option_list,
)
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
    "editOptions": "project_version_custom_field_edit_options",
    "changeType": "project_version_custom_field_change_type",
    "setFormula": "project_version_custom_field_set_formula",
    "editFieldBundle": "project_version_custom_field_edit_bundle",
}

_DEFERRED_MUTATION_PHASES: dict[str, str] = {}

# Convertibility matrix: (from, to) -> ConversionPolicy. Pairs absent
# from this map are forbidden. Frontend `typeConversionMatrix.ts`
# mirrors this — keep them in sync.
ConversionPolicy = Literal[
    "lossless",
    "lossy",
    "create_options",
    "substitute_labels",
]

CONVERSION_MATRIX: dict[tuple[CustomFieldType, CustomFieldType], ConversionPolicy] = {
    # short_text → *
    (CustomFieldType.short_text, CustomFieldType.long_text): "lossless",
    (CustomFieldType.short_text, CustomFieldType.number): "lossy",
    (CustomFieldType.short_text, CustomFieldType.url): "lossy",
    (CustomFieldType.short_text, CustomFieldType.single_select): "create_options",
    # long_text → *
    (CustomFieldType.long_text, CustomFieldType.short_text): "lossy",
    (CustomFieldType.long_text, CustomFieldType.number): "lossy",
    (CustomFieldType.long_text, CustomFieldType.url): "lossy",
    (CustomFieldType.long_text, CustomFieldType.single_select): "create_options",
    # number → *
    (CustomFieldType.number, CustomFieldType.short_text): "lossless",
    (CustomFieldType.number, CustomFieldType.long_text): "lossless",
    # url → *
    (CustomFieldType.url, CustomFieldType.short_text): "lossless",
    (CustomFieldType.url, CustomFieldType.long_text): "lossless",
    # single_select → *
    (CustomFieldType.single_select, CustomFieldType.short_text): "substitute_labels",
    (CustomFieldType.single_select, CustomFieldType.long_text): "substitute_labels",
    # Single-select → number: substitute the label, then number-coerce.
    # Labels that don't parse as numbers fall into the preflight incompatible
    # set so the user acks the clear (existing lossy-conversion UX).
    (CustomFieldType.single_select, CustomFieldType.number): "substitute_labels",
}

TEXT_TO_SINGLE_SELECT_OPTION_CAP = 50


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
    # Only valid when `after.field_type == "single_select"`; supplies the
    # initial option list so add-with-options is one atomic mutation
    # rather than a follow-up `editOptions` round trip.
    initial_options: list[SingleSelectOption] | None = None
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
    """Change a custom field's type with per-row coercion preflight.

    Identity rules: `after.id` must equal `field_id`; only `field_type`
    and `config` may differ from the existing field. The server derives
    cell clears authoritatively — no client-supplied cell_writes.
    """

    model_config = _SCHEMA_MUTATION_MODEL_CONFIG

    kind: Literal["changeType"]
    table_key: str
    field_id: str
    after: CustomFieldDef
    acknowledge_destructive: bool = False
    expected_schema_fingerprint: str


class EditOptionsMutation(BaseModel):
    """Edit a single_select field's option list in one gesture.

    Covers add / rename / reorder / recolor / delete. The server diffs
    `next_options` against the current list and cascades deletes to row
    clears (custom: clear `custom[cf_id]`; core nullable: clear field;
    core required: reject without replacement). Works for both core and
    custom single-selects via the contract's option-key map / list
    helpers.
    """

    model_config = _SCHEMA_MUTATION_MODEL_CONFIG

    kind: Literal["editOptions"]
    table_key: str
    field_id: str
    next_options: list[SingleSelectOption]
    # Optional replacements for deleted required-core option ids:
    # `{deleted_option_id: replacement_option_id}`. Required-core deletes
    # without replacements are rejected.
    replacements: dict[str, str] = Field(default_factory=dict)
    expected_schema_fingerprint: str


class EditFieldBundleMutation(BaseModel):
    """Edit any subset of a custom field's properties in one transactional save.

    The modal field-config UI (plan-21) emits this as a single WriteOp.
    The server diffs `after` against the stored `FieldDef` and applies
    rename, description, options, type-change, formula source, and
    single-select default in one atomic step — one audit row, one undo
    entry on the client. Per-property dispatchers' semantics are
    composed in `_apply_edit_field_bundle`; this mutation never widens
    the set of allowed changes.
    """

    model_config = _SCHEMA_MUTATION_MODEL_CONFIG

    kind: Literal["editFieldBundle"]
    table_key: str
    field_id: str
    after: CustomFieldDef
    # Optional next-options list. Required when the bundle edits the
    # option list of a single_select field (covers add/rename/reorder/
    # color/delete just like `EditOptionsMutation.next_options`); also
    # required when changing TYPE *into* `single_select` and supplying
    # an explicit list rather than relying on text→materialize.
    next_options: list[SingleSelectOption] | None = None
    # Required when `after.field_type` differs from the stored
    # field_type AND the per-row preflight is non-empty. Mirrors
    # `ChangeTypeMutation.acknowledge_destructive` semantics.
    acknowledge_destructive: bool = False
    # Replacement option-id map for required-core deletes (mirrors
    # `EditOptionsMutation.replacements`). Always empty for custom
    # fields — custom single-selects never have required-core deletes.
    option_replacements: dict[str, str] = Field(default_factory=dict)
    # When `after.field_type == "formula"` AND the formula source
    # changed, the bundle carries the new source string; the
    # dispatcher reparses + resolves + cycle-checks just like
    # `setFormula`. None means "keep the stored formula source".
    formula_source: str | None = Field(default=None, max_length=SOURCE_LENGTH_MAX)
    expected_schema_fingerprint: str


class SetFormulaMutation(BaseModel):
    """Set / replace the formula source on a custom formula field.

    The server parses + resolves + cycle-checks `source` and stores
    `config = {"source": source, "ast": ast_to_json(...), "deps":
    [field_id, ...], "result_type": <inferred>}`. Existing field
    identity / metadata (id, display_name, description, field_key,
    created_at, created_by) is preserved.
    """

    model_config = _SCHEMA_MUTATION_MODEL_CONFIG

    kind: Literal["setFormula"]
    table_key: str
    field_id: str
    # User-facing source string; bounded by `SOURCE_LENGTH_MAX` from
    # `formula/limits.py`. Empty / whitespace-only sources are
    # rejected at parse time.
    source: str = Field(min_length=1, max_length=SOURCE_LENGTH_MAX)
    expected_schema_fingerprint: str


FieldSchemaMutation = Annotated[
    AddFieldMutation
    | RenameFieldMutation
    | DeleteFieldMutation
    | DuplicateFieldMutation
    | SetDescriptionMutation
    | EditOptionsMutation
    | ChangeTypeMutation
    | SetFormulaMutation
    | EditFieldBundleMutation,
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
    elif isinstance(mutation, EditOptionsMutation):
        next_body, audit = _apply_edit_options(body, mutation, capability)
    elif isinstance(mutation, ChangeTypeMutation):
        next_body, audit = _apply_change_type(body, mutation, capability)
    elif isinstance(mutation, SetFormulaMutation):
        next_body, audit = _apply_set_formula(body, mutation, capability)
    elif isinstance(mutation, EditFieldBundleMutation):
        next_body, audit = _apply_edit_field_bundle(body, mutation, capability)
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

    initial_options = mutation.initial_options
    if initial_options is not None and mutation.after.field_type is not CustomFieldType.single_select:
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "custom_field_option_list_invalid",
            "initial_options is only valid for single_select fields.",
            {"reason": "initial_options_wrong_type", "field_type": mutation.after.field_type.value},
        )
    if mutation.after.field_type is CustomFieldType.single_select and initial_options:
        validate_option_list(initial_options)

    stamped = mutation.after.model_copy(update={"created_by": actor_user_id})
    next_fields = list(current_fields)
    next_fields.insert(position, stamped)
    next_body = capability.replace_custom_fields(body, next_fields)
    if mutation.after.field_type is CustomFieldType.single_select:
        next_body = capability.replace_field_option_list(
            next_body, stamped.id, list(initial_options or [])
        )
    audit: dict[str, object] = {
        "kind": "addField",
        "table_key": mutation.table_key,
        "field_id": stamped.id,
        "display_name": stamped.display_name,
        "field_type": stamped.field_type.value,
        "initial_option_count": len(initial_options or []),
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
    duplicated_option_count = 0
    if source.field_type is CustomFieldType.single_select:
        # Row values aren't copied, but the source's option list is
        # deep-copied under fresh ids so the duplicate column is fully
        # independent of the source.
        source_options = capability.read_field_option_list(next_body, source.id)
        new_options = [option.model_copy(update={"id": mint_option_id()}) for option in source_options]
        next_body = capability.replace_field_option_list(next_body, stamped.id, new_options)
        duplicated_option_count = len(new_options)
    audit: dict[str, object] = {
        "kind": "duplicateField",
        "table_key": mutation.table_key,
        "source_field_id": source.id,
        "new_field_id": stamped.id,
        "display_name": stamped.display_name,
        "duplicated_option_count": duplicated_option_count,
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


# ---------------------------------------------------------------------------
# editOptions
# ---------------------------------------------------------------------------


def _resolve_option_target(
    body: ProjectDocumentV1,
    field_id: str,
    table_key: str,
    capability: CustomFieldCapability,
) -> tuple[bool, str, list[SingleSelectOption]]:
    """Return (is_custom, namespace_key, current_options) for a field id.

    Raises `custom_field_invalid_field_id` if the field is neither a
    core single-select nor a custom single-select.
    """
    core_key = capability.core_option_key_by_field_id.get(field_id)
    if core_key is not None:
        return False, core_key, list(body.single_select_options.get(core_key, []))
    custom_fields = capability.read_custom_fields(body)
    for field in custom_fields:
        if field.id == field_id:
            if field.field_type is not CustomFieldType.single_select:
                raise api_error(
                    status.HTTP_422_UNPROCESSABLE_ENTITY,
                    "custom_field_invalid_field_id",
                    "Cannot edit options on a non-single_select field.",
                    {
                        "field_id": field_id,
                        "table_key": table_key,
                        "reason": "field_type_not_single_select",
                    },
                )
            namespace_key = option_list_key(capability.table_path, field_id)
            return True, namespace_key, list(body.single_select_options.get(namespace_key, []))
    raise api_error(
        status.HTTP_422_UNPROCESSABLE_ENTITY,
        "custom_field_invalid_field_id",
        "Field id was not found as a single-select column.",
        {"field_id": field_id, "table_key": table_key},
    )


def _validate_default_option_id(
    field: CustomFieldDef, next_option_ids: set[str]
) -> None:
    """Ensure single-select `config.default_option_id` (if set) is a real option.

    Atomically validated with option-list mutations so a pending
    default cannot survive an option deletion in the same write.
    Called from `_apply_edit_options`, `_apply_change_type` (when
    target is single_select), and `_apply_edit_field_bundle`.
    """
    if field.field_type is not CustomFieldType.single_select:
        return
    raw = field.config.get("default_option_id")
    if raw is None:
        return
    if not isinstance(raw, str):
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "custom_field_option_list_invalid",
            "default_option_id must be a string option id or null.",
            {
                "field_id": field.id,
                "reason": "default_option_id_not_string",
            },
        )
    if raw not in next_option_ids:
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "custom_field_option_list_invalid",
            "default_option_id must reference an option in the field's option list.",
            {
                "field_id": field.id,
                "reason": "default_option_id_not_in_options",
                "default_option_id": raw,
            },
        )


def _apply_edit_options(
    body: ProjectDocumentV1,
    mutation: EditOptionsMutation,
    capability: CustomFieldCapability,
) -> tuple[ProjectDocumentV1, dict[str, object]]:
    is_custom, namespace_key, current_options = _resolve_option_target(
        body, mutation.field_id, mutation.table_key, capability
    )
    validate_option_list(mutation.next_options)

    current_ids = {option.id for option in current_options}
    next_ids = {option.id for option in mutation.next_options}
    deleted_ids = current_ids - next_ids

    # If this is a custom single-select with a configured default,
    # validate the default still exists in next_options. If the
    # default was deleted, this is a hard error — the caller (the
    # modal) is expected to strip the default in the same write via
    # `editFieldBundle`; the raw `editOptions` mutation refuses to
    # silently clear it.
    if is_custom:
        current_fields = capability.read_custom_fields(body)
        for field in current_fields:
            if field.id == mutation.field_id:
                _validate_default_option_id(field, next_ids)
                break

    # Required core single-select fields cannot be cleared on referenced
    # deletes — caller must supply replacement option ids.
    if (
        not is_custom
        and mutation.field_id in capability.required_core_select_fields
        and deleted_ids
    ):
        for deleted_id in deleted_ids:
            replacement = mutation.replacements.get(deleted_id)
            if replacement is None:
                raise api_error(
                    status.HTTP_422_UNPROCESSABLE_ENTITY,
                    "custom_field_option_list_invalid",
                    "Required core single-select option deletion requires a replacement.",
                    {
                        "reason": "required_core_select_delete_without_replacement",
                        "deleted_option_id": deleted_id,
                        "field_id": mutation.field_id,
                    },
                )
            if replacement not in next_ids:
                raise api_error(
                    status.HTTP_422_UNPROCESSABLE_ENTITY,
                    "custom_field_option_list_invalid",
                    "Replacement option must be present in next_options.",
                    {
                        "reason": "replacement_not_in_next_options",
                        "deleted_option_id": deleted_id,
                        "replacement_option_id": replacement,
                    },
                )

    # Cascade deletes into row values atomically.
    cleared_row_count = 0
    next_body = body
    if deleted_ids:
        rows = _read_rows_from_envelope(next_body, mutation.table_key)
        next_rows: list[object] = []
        for row in rows:
            if is_custom:
                custom = capability.read_row_custom(row)
                current_value = custom.get(mutation.field_id)
                if isinstance(current_value, str) and current_value in deleted_ids:
                    cleared_row_count += 1
                    new_custom = dict(custom)
                    new_custom[mutation.field_id] = None
                    next_rows.append(capability.set_row_custom(row, new_custom))
                else:
                    next_rows.append(row)
            else:
                current_value = capability.read_core_option_value(row, mutation.field_id)
                if isinstance(current_value, str) and current_value in deleted_ids:
                    cleared_row_count += 1
                    replacement = mutation.replacements.get(current_value)
                    next_rows.append(
                        capability.set_core_option_value(row, mutation.field_id, replacement)
                    )
                else:
                    next_rows.append(row)
        next_body = _replace_rows_in_envelope(next_body, mutation.table_key, next_rows)

    next_options = list(mutation.next_options)
    next_map = dict(next_body.single_select_options)
    next_map[namespace_key] = next_options
    next_body = next_body.model_copy(update={"single_select_options": next_map})

    audit: dict[str, object] = {
        "kind": "editOptions",
        "table_key": mutation.table_key,
        "field_id": mutation.field_id,
        "is_custom": is_custom,
        "added_option_ids": sorted(next_ids - current_ids),
        "deleted_option_ids": sorted(deleted_ids),
        "cleared_row_count": cleared_row_count,
    }
    return next_body, audit


# ---------------------------------------------------------------------------
# changeType
# ---------------------------------------------------------------------------


def _format_number_for_text(value: object) -> str:
    """Locale-independent text rendering for number -> text coercion."""
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, int):
        return str(value)
    if isinstance(value, float):
        # Match JS / JSON canonical form: integers without `.0`.
        if value.is_integer():
            return str(int(value))
        return repr(value)
    return str(value)


def _try_coerce_for_change_type(
    raw_value: object,
    to_type: CustomFieldType,
    *,
    target_option_list: list[SingleSelectOption] | None,
) -> tuple[bool, object | None, str]:
    """Try to coerce raw_value to to_type. Returns (ok, coerced, reason).

    `coerced` is the new stored value (None when the source was empty);
    `reason` carries a short string when ok=False (used in the preflight
    diagnostics).
    """
    if raw_value is None or raw_value == "":
        return True, None, ""
    if to_type is CustomFieldType.short_text:
        if isinstance(raw_value, str):
            if len(raw_value) > SHORT_TEXT_MAX_LENGTH:
                return False, None, "exceeds_short_text_max_length"
            return True, raw_value, ""
        if isinstance(raw_value, (int, float)) and not isinstance(raw_value, bool):
            return True, _format_number_for_text(raw_value), ""
        return False, None, "not_coercible_to_short_text"
    if to_type is CustomFieldType.long_text:
        if isinstance(raw_value, str):
            return True, raw_value, ""
        if isinstance(raw_value, (int, float)) and not isinstance(raw_value, bool):
            return True, _format_number_for_text(raw_value), ""
        return False, None, "not_coercible_to_long_text"
    if to_type is CustomFieldType.number:
        if isinstance(raw_value, bool):
            return False, None, "boolean_not_numeric"
        if isinstance(raw_value, (int, float)):
            return True, raw_value, ""
        if isinstance(raw_value, str):
            stripped = raw_value.strip()
            if not stripped:
                return True, None, ""
            try:
                value = float(stripped)
            except ValueError:
                return False, None, "not_a_number"
            if value.is_integer():
                return True, int(value), ""
            return True, value, ""
        return False, None, "not_coercible_to_number"
    if to_type is CustomFieldType.url:
        if not isinstance(raw_value, str):
            return False, None, "url_must_be_string"
        stripped = raw_value.strip()
        if not stripped:
            return True, None, ""
        # Minimal URL guard: require a recognized scheme prefix. The
        # frontend `coerceCustomValue` mirrors this exactly.
        lowered = stripped.lower()
        if not (lowered.startswith("http://") or lowered.startswith("https://")):
            return False, None, "missing_url_scheme"
        return True, stripped, ""
    if to_type is CustomFieldType.single_select:
        # When the target option list is provided, look up by label
        # (case-insensitive trimmed) — the create_options policy in
        # `_apply_change_type` materializes the list before calling here.
        if target_option_list is None:
            return False, None, "missing_target_option_list"
        if not isinstance(raw_value, str):
            return False, None, "single_select_requires_text"
        normalized = normalize_display_name(raw_value)
        if not normalized:
            return True, None, ""
        for option in target_option_list:
            if normalize_display_name(option.label) == normalized:
                return True, option.id, ""
        return False, None, "no_matching_option"
    return False, None, f"unsupported_to_type:{to_type.value}"


def _materialize_options_for_text_to_select(
    rows: list[object],
    field_id: str,
    capability: CustomFieldCapability,
) -> tuple[list[SingleSelectOption], list[tuple[str, object, str]]]:
    """Enumerate distinct trimmed non-empty source values into options.

    Returns the new option list (capped at TEXT_TO_SINGLE_SELECT_OPTION_CAP)
    and the list of `(row_id, raw_value, reason)` diagnostics for rows
    whose value falls past the cap.
    """
    seen: dict[str, SingleSelectOption] = {}
    overflow: list[tuple[str, object, str]] = []
    order_index = 0
    for row in rows:
        custom = capability.read_row_custom(row)
        raw_value = custom.get(field_id)
        if not isinstance(raw_value, str):
            continue
        stripped = raw_value.strip()
        if not stripped:
            continue
        normalized = normalize_display_name(stripped)
        if normalized in seen:
            continue
        if len(seen) >= TEXT_TO_SINGLE_SELECT_OPTION_CAP:
            row_id = str(getattr(row, "id", ""))
            overflow.append((row_id, raw_value, "single_select_option_cap_exceeded"))
            continue
        option_id = mint_option_id()
        color = OPTION_COLOR_PALETTE[order_index % len(OPTION_COLOR_PALETTE)]
        seen[normalized] = SingleSelectOption(
            id=option_id,
            label=stripped,
            color=color,
            order=float(order_index + 1),
        )
        order_index += 1
    return list(seen.values()), overflow


def _apply_change_type(
    body: ProjectDocumentV1,
    mutation: ChangeTypeMutation,
    capability: CustomFieldCapability,
) -> tuple[ProjectDocumentV1, dict[str, object]]:
    current_fields = capability.read_custom_fields(body)
    index, existing = _find_field(current_fields, mutation.field_id, mutation.table_key)

    if mutation.after.id != mutation.field_id:
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "custom_field_invalid_field_id",
            "changeType target id must equal the source field id.",
            {"field_id": mutation.after.id, "expected_field_id": mutation.field_id},
        )
    if mutation.after.field_type == existing.field_type:
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "custom_field_invalid_field_id",
            "changeType requires a different target field_type.",
            {"field_id": mutation.field_id, "field_type": existing.field_type.value},
        )
    # Disallow silent metadata rewrites during a type change — only
    # field_type and config may differ. `created_at` and `created_by`
    # are preserved server-side (clients aren't required to round-trip
    # them exactly), but `display_name`, `field_key`, and `description`
    # must match the stored field.
    for attr in ("display_name", "field_key", "description"):
        if getattr(mutation.after, attr) != getattr(existing, attr):
            raise api_error(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                "custom_field_invalid_field_id",
                "changeType may not modify field metadata other than type/config.",
                {"field_id": mutation.field_id, "disallowed_attribute": attr},
            )

    from_type = existing.field_type
    to_type = mutation.after.field_type
    policy = CONVERSION_MATRIX.get((from_type, to_type))
    if policy is None:
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "custom_field_illegal_type_conversion",
            f"Cannot convert custom field from {from_type.value} to {to_type.value}.",
            {"field_id": mutation.field_id, "from_type": from_type.value, "to_type": to_type.value},
        )

    rows = _read_rows_from_envelope(body, mutation.table_key)

    target_option_list: list[SingleSelectOption] | None = None
    generated_options: list[SingleSelectOption] | None = None
    overflow_diagnostics: list[tuple[str, object, str]] = []
    label_lookup_for_substitute: dict[str, str] | None = None
    if policy == "create_options":
        generated_options, overflow_diagnostics = _materialize_options_for_text_to_select(
            rows, mutation.field_id, capability
        )
        target_option_list = generated_options
    elif policy == "substitute_labels":
        # Build {option_id: label} from the existing namespaced list so
        # the per-row pass can substitute labels.
        namespace_key = option_list_key(capability.table_path, mutation.field_id)
        existing_options = body.single_select_options.get(namespace_key, [])
        label_lookup_for_substitute = {opt.id: opt.label for opt in existing_options}

    # Per-row preflight.
    incompatible: list[dict[str, object]] = []
    compatible_writes: list[tuple[str, object | None]] = []
    for row in rows:
        row_id = str(getattr(row, "id", ""))
        custom = capability.read_row_custom(row)
        raw_value = custom.get(mutation.field_id)
        if policy == "substitute_labels" and label_lookup_for_substitute is not None:
            if raw_value is None or raw_value == "":
                compatible_writes.append((row_id, None))
                continue
            label = label_lookup_for_substitute.get(str(raw_value))
            if label is None:
                incompatible.append(
                    {"row_id": row_id, "raw_value": raw_value, "reason": "no_matching_option"}
                )
                continue
            if to_type in (CustomFieldType.short_text, CustomFieldType.long_text):
                compatible_writes.append((row_id, label))
                continue
            # single_select → number (or other future targets): re-coerce
            # the label through the standard coercion path. Unparseable
            # labels surface to preflight so the user acks the clear.
            ok, coerced, reason = _try_coerce_for_change_type(
                label, to_type, target_option_list=target_option_list
            )
            if ok:
                compatible_writes.append((row_id, coerced))
            else:
                incompatible.append({"row_id": row_id, "raw_value": raw_value, "reason": reason})
            continue
        ok, coerced, reason = _try_coerce_for_change_type(
            raw_value, to_type, target_option_list=target_option_list
        )
        if ok:
            compatible_writes.append((row_id, coerced))
        else:
            incompatible.append({"row_id": row_id, "raw_value": raw_value, "reason": reason})
    # Overflow diagnostics from text→single_select cap are also incompatible.
    for row_id, raw_value, reason in overflow_diagnostics:
        incompatible.append({"row_id": row_id, "raw_value": raw_value, "reason": reason})

    if incompatible and not mutation.acknowledge_destructive:
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "custom_field_coercion_preflight_required",
            "Conversion would clear values; resubmit with acknowledge_destructive.",
            {
                "field_id": mutation.field_id,
                "from_type": from_type.value,
                "to_type": to_type.value,
                "incompatible_row_count": len(incompatible),
                "total_row_count": len(rows),
                "incompatible_rows": incompatible[:25],
            },
        )

    # Default-option-id validation against the destination state. When
    # the target is single_select, the new option list is either the
    # materialized list (create_options) or the existing namespaced
    # list (already-single_select branch doesn't reach here because
    # changeType requires from != to). When leaving single_select,
    # `after.config.default_option_id` must be unset — defense in
    # depth against a stale draft (the modal strips this per
    # US-CF-16 criterion 9).
    if to_type is CustomFieldType.single_select:
        target_ids = {opt.id for opt in (target_option_list or [])}
        _validate_default_option_id(mutation.after, target_ids)
    elif "default_option_id" in mutation.after.config:
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "custom_field_option_list_invalid",
            "default_option_id is only valid for single_select fields.",
            {
                "field_id": mutation.field_id,
                "reason": "default_option_id_outside_single_select",
                "to_type": to_type.value,
            },
        )

    # Apply: replace field def, rewrite rows, update option lists.
    # Preserve created_at / created_by from the existing field so a
    # client doesn't need to round-trip them exactly.
    next_fields = list(current_fields)
    next_fields[index] = mutation.after.model_copy(
        update={"created_by": existing.created_by, "created_at": existing.created_at}
    )
    next_body = capability.replace_custom_fields(body, next_fields)

    # Handle option-list namespace changes.
    if policy == "create_options":
        next_body = capability.replace_field_option_list(
            next_body, mutation.field_id, generated_options or []
        )
    elif from_type is CustomFieldType.single_select:
        # Field is no longer single_select — strip its option-list entry.
        namespace_key = option_list_key(capability.table_path, mutation.field_id)
        next_body = remove_option_list(next_body, namespace_key)

    # Apply row writes. `capability.replace_custom_fields` does not
    # touch the row list, so we can reuse the `rows` we already iterated
    # for preflight and skip a second envelope read.
    write_by_row: dict[str, CustomValue] = {
        row_id: cast(CustomValue, value) for row_id, value in compatible_writes
    }
    incompatible_by_row: set[str] = {str(entry["row_id"]) for entry in incompatible}

    new_rows: list[object] = []
    for row in rows:
        row_id = str(getattr(row, "id", ""))
        if row_id in write_by_row:
            custom = dict(capability.read_row_custom(row))
            value = write_by_row[row_id]
            if value is None:
                custom.pop(mutation.field_id, None)
            else:
                custom[mutation.field_id] = value
            new_rows.append(capability.set_row_custom(row, custom))
        elif row_id in incompatible_by_row:
            custom = dict(capability.read_row_custom(row))
            custom.pop(mutation.field_id, None)
            new_rows.append(capability.set_row_custom(row, custom))
        else:
            new_rows.append(row)
    next_body = _replace_rows_in_envelope(next_body, mutation.table_key, new_rows)

    audit: dict[str, object] = {
        "kind": "changeType",
        "table_key": mutation.table_key,
        "field_id": mutation.field_id,
        "from_type": from_type.value,
        "to_type": to_type.value,
        "compatible_row_count": len(compatible_writes),
        "cleared_row_count": len(incompatible),
    }
    if generated_options is not None:
        audit["created_option_count"] = len(generated_options)
    return next_body, audit


# ---------------------------------------------------------------------------
# setFormula (Phase 4)
# ---------------------------------------------------------------------------


def _raise_formula_parse_error(
    exc: FormulaParseError, field_id: str
) -> None:
    raise api_error(
        status.HTTP_422_UNPROCESSABLE_ENTITY,
        "custom_field_formula_parse_error",
        f"Couldn't parse the formula: {exc.message} (position {exc.offset}).",
        {
            "field_id": field_id,
            "parse_error": exc.message,
            "offset": exc.offset,
            "source": exc.source,
        },
    )


def _raise_formula_resource_limit(
    exc: FormulaResourceLimitError, field_id: str
) -> None:
    raise api_error(
        status.HTTP_422_UNPROCESSABLE_ENTITY,
        "custom_field_formula_resource_limit",
        f"Formula exceeds {exc.limit_name} limit ({exc.actual}/{exc.max_value}). "
        "Simplify the expression and try again.",
        {
            "field_id": field_id,
            "limit_name": exc.limit_name,
            "actual": exc.actual,
            "max": exc.max_value,
        },
    )


def _raise_formula_unsupported_function(
    exc: FormulaUnsupportedFunctionError, field_id: str
) -> None:
    available = sorted(exc.available)
    raise api_error(
        status.HTTP_422_UNPROCESSABLE_ENTITY,
        "custom_field_formula_unsupported_function",
        f"Function {exc.function_name!r} is not supported. Available: "
        + ", ".join(available)
        + ".",
        {
            "field_id": field_id,
            "function_name": exc.function_name,
            "available_functions": available,
        },
    )


def _raise_formula_missing_ref(
    exc: FormulaMissingRefError, field_id: str, missing_ref_id: str | None = None
) -> None:
    raise api_error(
        status.HTTP_422_UNPROCESSABLE_ENTITY,
        "custom_field_formula_missing_ref",
        f"Formula references a field that doesn't exist in this table: "
        f"{exc.display_name}.",
        {
            "field_id": field_id,
            "missing_ref_display_name": exc.display_name,
            "missing_ref_id": missing_ref_id,
        },
    )


def _raise_formula_cycle(
    exc: FormulaCycleError, field_id: str
) -> None:
    raise api_error(
        status.HTTP_422_UNPROCESSABLE_ENTITY,
        "custom_field_formula_cycle",
        f"This formula creates a cycle: {' -> '.join(exc.cycle_path)}. "
        "Remove the loop and try again.",
        {
            "field_id": field_id,
            "cycle_path": list(exc.cycle_path),
        },
    )


def _apply_set_formula(
    body: ProjectDocumentV1,
    mutation: SetFormulaMutation,
    capability: CustomFieldCapability,
) -> tuple[ProjectDocumentV1, dict[str, object]]:
    current_fields = capability.read_custom_fields(body)
    index, existing = _find_field(current_fields, mutation.field_id, mutation.table_key)
    if existing.field_type is not CustomFieldType.formula:
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "custom_field_invalid_field_id",
            "setFormula target is not a formula field.",
            {
                "field_id": mutation.field_id,
                "table_key": mutation.table_key,
                "reason": "field_type_not_formula",
            },
        )

    # Parse.
    try:
        ast = parse(mutation.source)
    except FormulaParseError as exc:
        _raise_formula_parse_error(exc, mutation.field_id)
        raise  # pragma: no cover — _raise_* always raises
    except FormulaResourceLimitError as exc:
        _raise_formula_resource_limit(exc, mutation.field_id)
        raise  # pragma: no cover
    except FormulaUnsupportedFunctionError as exc:
        _raise_formula_unsupported_function(exc, mutation.field_id)
        raise  # pragma: no cover

    # Resolve refs against the current registry.
    registry = build_field_registry(capability, body)
    try:
        resolved = resolve_refs(ast, registry)
    except FormulaMissingRefError as exc:
        _raise_formula_missing_ref(exc, mutation.field_id)
        raise  # pragma: no cover

    # Cycle-check against every other formula field's stored AST.
    asts_by_id: dict[str, FormulaAST] = {}
    for f in current_fields:
        if f.id == mutation.field_id:
            continue
        if f.field_type is not CustomFieldType.formula:
            continue
        stored = f.config.get("ast")
        if stored is None:
            continue
        try:
            asts_by_id[f.id] = ast_from_json(stored)
        except (ValueError, TypeError):
            # Skip malformed stored ASTs — the per-row evaluator will
            # surface missing_ref at read time.
            continue

    try:
        detect_cycles(mutation.field_id, resolved, asts_by_id)
    except FormulaCycleError as exc:
        _raise_formula_cycle(exc, mutation.field_id)
        raise  # pragma: no cover

    deps = collect_field_refs(resolved)
    new_config: dict[str, object] = {
        "source": mutation.source,
        "ast": ast_to_json(resolved),
        "deps": deps,
        "result_type": _infer_result_type(resolved),
    }

    next_field = existing.model_copy(update={"config": new_config})
    next_fields = list(current_fields)
    next_fields[index] = next_field
    next_body = capability.replace_custom_fields(body, next_fields)

    audit: dict[str, object] = {
        "kind": "setFormula",
        "table_key": mutation.table_key,
        "field_id": mutation.field_id,
        "source_length": len(mutation.source),
        "ast_node_count": _count_ast_nodes(resolved),
        "deps": deps,
    }
    return next_body, audit


# ---------------------------------------------------------------------------
# editFieldBundle (plan-21)
# ---------------------------------------------------------------------------


def _apply_edit_field_bundle(
    body: ProjectDocumentV1,
    mutation: EditFieldBundleMutation,
    capability: CustomFieldCapability,
) -> tuple[ProjectDocumentV1, dict[str, object]]:
    """Apply rename + description + options + type-change + formula in one tx.

    Composes the existing per-property dispatchers' cores so behavior
    stays identical to the matching one-property mutations. Order:
    identity → name uniqueness → description clamp → (type-change OR
    same-type option diff) → field-def replace → formula → default
    validation. Final document validation runs in the outer
    `apply_schema_mutation`.
    """
    current_fields = capability.read_custom_fields(body)
    index, existing = _find_field(current_fields, mutation.field_id, mutation.table_key)
    after = mutation.after

    # --- 1. Identity ---
    if after.id != mutation.field_id:
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "custom_field_invalid_field_id",
            "editFieldBundle target id must equal field_id.",
            {"field_id": after.id, "expected_field_id": mutation.field_id},
        )
    if after.field_key != existing.field_key:
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "custom_field_invalid_field_id",
            "editFieldBundle may not modify field_key.",
            {"field_id": mutation.field_id, "disallowed_attribute": "field_key"},
        )

    properties_changed: list[str] = []

    # --- 2. Display-name uniqueness (only when the name actually changed) ---
    if after.display_name != existing.display_name:
        _reject_duplicate_display_name(
            current_fields,
            capability.core_display_names,
            after.display_name,
            skip_field_id=mutation.field_id,
        )
        properties_changed.append("display_name")

    # --- 3. Description clamp ---
    raw_description = after.description
    clamped_description = (
        None if raw_description is None else raw_description[:CUSTOM_FIELD_DESCRIPTION_MAX]
    )
    if clamped_description != existing.description:
        properties_changed.append("description")

    # We'll build the next field def progressively; start from `after`
    # with metadata preserved and the description clamped.
    next_field = after.model_copy(
        update={
            "description": clamped_description,
            "created_by": existing.created_by,
            "created_at": existing.created_at,
        }
    )

    type_changed = after.field_type != existing.field_type
    next_body = body
    cleared_row_count = 0
    created_option_count = 0
    audit_extras: dict[str, object] = {}

    if type_changed:
        # Reuse the changeType core by constructing the equivalent
        # mutation; its validations (forbidden conversion, identity,
        # metadata-only field_type/config differ, preflight ack)
        # mirror plan-21 §3.3a step 5.
        change_type_mutation = ChangeTypeMutation(
            kind="changeType",
            table_key=mutation.table_key,
            field_id=mutation.field_id,
            after=next_field.model_copy(
                update={
                    # _apply_change_type rejects metadata changes besides
                    # field_type/config; rebuild `after` to match `existing`
                    # for those, since rename/description are applied below.
                    "display_name": existing.display_name,
                    "description": existing.description,
                }
            ),
            acknowledge_destructive=mutation.acknowledge_destructive,
            expected_schema_fingerprint=mutation.expected_schema_fingerprint,
        )
        next_body, ct_audit = _apply_change_type(next_body, change_type_mutation, capability)
        cleared_row_count = cast(int, ct_audit.get("cleared_row_count") or 0)
        created_option_count = cast(int, ct_audit.get("created_option_count") or 0)
        properties_changed.append("field_type")
        # After change_type ran, re-read fields so we can layer the
        # display_name / description / final config changes on top.
        current_fields = capability.read_custom_fields(next_body)
        index, existing = _find_field(current_fields, mutation.field_id, mutation.table_key)
    elif (
        after.field_type is CustomFieldType.single_select
        and mutation.next_options is not None
    ):
        # Same-type single_select option-list edit. Reuse editOptions.
        edit_options_mutation = EditOptionsMutation(
            kind="editOptions",
            table_key=mutation.table_key,
            field_id=mutation.field_id,
            next_options=mutation.next_options,
            replacements=mutation.option_replacements,
            expected_schema_fingerprint=mutation.expected_schema_fingerprint,
        )
        # Detect any list diff (incl. label/color/order changes) by
        # comparing pre/post snapshots — the editOptions audit only
        # reports id-set deltas.
        namespace_key = option_list_key(capability.table_path, mutation.field_id)
        pre_list = next_body.single_select_options.get(namespace_key, [])
        next_body, eo_audit = _apply_edit_options(next_body, edit_options_mutation, capability)
        post_list = next_body.single_select_options.get(namespace_key, [])
        cleared_row_count = cast(int, eo_audit.get("cleared_row_count") or 0)
        if pre_list != post_list:
            properties_changed.append("options")
        # Re-read after the option list change.
        current_fields = capability.read_custom_fields(next_body)
        index, existing = _find_field(current_fields, mutation.field_id, mutation.table_key)

    # --- 4. Field def replace (display_name / description / config) ---
    # Re-anchor on the post-mutation `existing` (which has the new
    # field_type/config from changeType when type changed). We layer
    # display_name + description + the user's intended config on top.
    target_config: dict[str, object] = dict(after.config)
    final_field = existing.model_copy(
        update={
            "display_name": after.display_name,
            "description": clamped_description,
            "config": target_config,
        }
    )
    next_fields = list(current_fields)
    next_fields[index] = final_field
    next_body = capability.replace_custom_fields(next_body, next_fields)

    # --- 5. Formula source change (when target is formula) ---
    if (
        final_field.field_type is CustomFieldType.formula
        and mutation.formula_source is not None
    ):
        set_formula_mutation = SetFormulaMutation(
            kind="setFormula",
            table_key=mutation.table_key,
            field_id=mutation.field_id,
            source=mutation.formula_source,
            expected_schema_fingerprint=mutation.expected_schema_fingerprint,
        )
        # _apply_set_formula re-reads fields and replaces config with
        # {source, ast, deps, result_type} — that wipes whatever we
        # just wrote into config; that's the intended behavior since
        # the bundle's `after.config.source` is the user's input and
        # the parsed AST is server-derived.
        next_body, sf_audit = _apply_set_formula(next_body, set_formula_mutation, capability)
        properties_changed.append("formula_source")
        audit_extras["formula_source_length"] = sf_audit.get("source_length")

    # --- 6. Default-option-id validation (single_select only) ---
    if final_field.field_type is CustomFieldType.single_select:
        namespace_key = option_list_key(capability.table_path, mutation.field_id)
        final_options = next_body.single_select_options.get(namespace_key, [])
        final_ids = {opt.id for opt in final_options}
        # Re-read final field after potential rewrites.
        post_fields = capability.read_custom_fields(next_body)
        _, post_field = _find_field(post_fields, mutation.field_id, mutation.table_key)
        _validate_default_option_id(post_field, final_ids)
        if (
            existing.field_type is CustomFieldType.single_select
            and existing.config.get("default_option_id")
            != post_field.config.get("default_option_id")
        ):
            properties_changed.append("default_option_id")
        elif (
            existing.field_type is not CustomFieldType.single_select
            and post_field.config.get("default_option_id") is not None
        ):
            properties_changed.append("default_option_id")
    elif "default_option_id" in final_field.config:
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "custom_field_option_list_invalid",
            "default_option_id is only valid for single_select fields.",
            {
                "field_id": mutation.field_id,
                "reason": "default_option_id_outside_single_select",
                "field_type": final_field.field_type.value,
            },
        )

    audit: dict[str, object] = {
        "kind": "editFieldBundle",
        "table_key": mutation.table_key,
        "field_id": mutation.field_id,
        "properties_changed": properties_changed,
        "cleared_row_count": cleared_row_count,
        "created_option_count": created_option_count,
        **audit_extras,
    }
    return next_body, audit


def _count_ast_nodes(node: object) -> int:
    from features.project_document.formula.ast_nodes import (
        BinaryOp as _BinaryOp,
    )
    from features.project_document.formula.ast_nodes import (
        FieldRef as _FieldRef,
    )
    from features.project_document.formula.ast_nodes import (
        FuncCall as _FuncCall,
    )
    from features.project_document.formula.ast_nodes import (
        IfExpr as _IfExpr,
    )
    from features.project_document.formula.ast_nodes import (
        Literal_ as _Literal,
    )
    from features.project_document.formula.ast_nodes import (
        UnaryOp as _UnaryOp,
    )

    if isinstance(node, _Literal) or isinstance(node, _FieldRef):
        return 1
    if isinstance(node, _UnaryOp):
        return 1 + _count_ast_nodes(node.operand)
    if isinstance(node, _BinaryOp):
        return 1 + _count_ast_nodes(node.left) + _count_ast_nodes(node.right)
    if isinstance(node, _IfExpr):
        return (
            1
            + _count_ast_nodes(node.condition)
            + _count_ast_nodes(node.then_branch)
            + _count_ast_nodes(node.else_branch)
        )
    if isinstance(node, _FuncCall):
        return 1 + sum(_count_ast_nodes(a) for a in node.args)
    return 1


def _infer_result_type(node: object) -> str:
    """Best-effort static result type used for downstream filter
    operators (number aggregations, text comparisons). Falls back to
    "text" for dynamic / mixed-typed expressions."""
    from features.project_document.formula.ast_nodes import (
        BinaryOp as _BinaryOp,
    )
    from features.project_document.formula.ast_nodes import (
        FuncCall as _FuncCall,
    )
    from features.project_document.formula.ast_nodes import (
        IfExpr as _IfExpr,
    )
    from features.project_document.formula.ast_nodes import (
        Literal_ as _Literal,
    )
    from features.project_document.formula.ast_nodes import (
        UnaryOp as _UnaryOp,
    )

    if isinstance(node, _Literal):
        return node.inferred_type
    if isinstance(node, _UnaryOp):
        if node.op == "-":
            return "number"
        if node.op == "not":
            return "bool"
    if isinstance(node, _BinaryOp):
        if node.op in ("+", "-", "*", "/", "%"):
            return "number"
        if node.op in ("=", "!=", "<", "<=", ">", ">=", "and", "or"):
            return "bool"
    if isinstance(node, _IfExpr):
        # Use the then-branch type when both branches agree.
        then_t = _infer_result_type(node.then_branch)
        else_t = _infer_result_type(node.else_branch)
        return then_t if then_t == else_t else "text"
    if isinstance(node, _FuncCall):
        if node.name in ("upper", "lower", "trim", "replace", "substring", "concat", "text"):
            return "text"
        if node.name in ("len", "number"):
            return "number"
    return "text"

"""Wire contracts for `FieldSchemaMutation` and related constants.

Pydantic v2 models for every custom-field schema mutation, plus the
`AUDIT_KIND_BY_MUTATION` map and the `CONVERSION_MATRIX` that constrain
the dispatcher. Pure data; no logic. The `FieldSchemaMutation`
discriminated union is the closed wire contract.
"""

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

from features.project_document.custom_fields import (
    CustomFieldType,
    TableFieldDef,
)
from features.project_document.document import SingleSelectOption
from features.project_document.formula import SOURCE_LENGTH_MAX

# Back-compat alias so callers still importing `CustomFieldDef` keep
# working through the Phase 1b cutover.
CustomFieldDef = TableFieldDef

__all__ = [
    "AUDIT_KIND_BY_MUTATION",
    "AddFieldMutation",
    "CONVERSION_MATRIX",
    "ChangeTypeMutation",
    "ConversionPolicy",
    "DeleteFieldMutation",
    "DuplicateFieldMutation",
    "EditFieldBundleMutation",
    "EditOptionsMutation",
    "FieldSchemaMutation",
    "RenameFieldMutation",
    "SetDescriptionMutation",
    "SetFormulaMutation",
    "TEXT_TO_SINGLE_SELECT_OPTION_CAP",
]

# Audit-log action kind per mutation discriminator. drafts.py / MCP
# write the matching key so the action log is filterable. Phase 1b
# renamed these to drop the `_custom_field_` namespace — built-in
# fields now ride the same mutation pipeline, so the audit kinds are
# field-agnostic.
AUDIT_KIND_BY_MUTATION: dict[str, str] = {
    "addField": "project_version_field_add",
    "renameField": "project_version_field_rename",
    "deleteField": "project_version_field_delete",
    "duplicateField": "project_version_field_duplicate",
    "setDescription": "project_version_field_set_description",
    "editOptions": "project_version_field_edit_options",
    "changeType": "project_version_field_change_type",
    "setFormula": "project_version_field_set_formula",
    "editFieldBundle": "project_version_field_edit_bundle",
}

# Convertibility matrix: (from, to) -> ConversionPolicy. Pairs absent
# from this map are forbidden. Frontend `typeConversionMatrix.ts`
# mirrors this — keep them in sync.
#
# `discard_then_author` (primitive → formula): the conversion drops every
# stored cell value for the field and the user authors a fresh formula
# source. There is no per-row preservation — the affected-row count is
# simply the count of non-empty cells. Always destructive when any cell
# is non-empty; user must ack before the change applies. The new
# formula source rides in `EditFieldBundleMutation.formula_source` (or
# `SetFormulaMutation.source` if the type change is committed first).
ConversionPolicy = Literal[
    "lossless",
    "lossy",
    "create_options",
    "substitute_labels",
    "substitute_option_colors",
    "discard_then_author",
]

CONVERSION_MATRIX: dict[tuple[CustomFieldType, CustomFieldType], ConversionPolicy] = {
    # short_text → *
    (CustomFieldType.short_text, CustomFieldType.long_text): "lossless",
    (CustomFieldType.short_text, CustomFieldType.number): "lossy",
    (CustomFieldType.short_text, CustomFieldType.url): "lossy",
    (CustomFieldType.short_text, CustomFieldType.color): "lossy",
    (CustomFieldType.short_text, CustomFieldType.single_select): "create_options",
    (CustomFieldType.short_text, CustomFieldType.formula): "discard_then_author",
    # long_text → *
    (CustomFieldType.long_text, CustomFieldType.short_text): "lossy",
    (CustomFieldType.long_text, CustomFieldType.number): "lossy",
    (CustomFieldType.long_text, CustomFieldType.url): "lossy",
    (CustomFieldType.long_text, CustomFieldType.color): "lossy",
    (CustomFieldType.long_text, CustomFieldType.single_select): "create_options",
    (CustomFieldType.long_text, CustomFieldType.formula): "discard_then_author",
    # number → *
    (CustomFieldType.number, CustomFieldType.short_text): "lossless",
    (CustomFieldType.number, CustomFieldType.long_text): "lossless",
    (CustomFieldType.number, CustomFieldType.single_select): "create_options",
    (CustomFieldType.number, CustomFieldType.formula): "discard_then_author",
    # url → *
    (CustomFieldType.url, CustomFieldType.short_text): "lossless",
    (CustomFieldType.url, CustomFieldType.long_text): "lossless",
    (CustomFieldType.url, CustomFieldType.color): "lossy",
    (CustomFieldType.url, CustomFieldType.formula): "discard_then_author",
    # single_select → *
    (CustomFieldType.single_select, CustomFieldType.short_text): "substitute_labels",
    (CustomFieldType.single_select, CustomFieldType.long_text): "substitute_labels",
    # Single-select → number: substitute the label, then number-coerce.
    # Labels that don't parse as numbers fall into the preflight incompatible
    # set so the user acks the clear (existing lossy-conversion UX).
    (CustomFieldType.single_select, CustomFieldType.number): "substitute_labels",
    (CustomFieldType.single_select, CustomFieldType.color): "substitute_option_colors",
    (CustomFieldType.single_select, CustomFieldType.formula): "discard_then_author",
    # color → *
    (CustomFieldType.color, CustomFieldType.short_text): "lossless",
    (CustomFieldType.color, CustomFieldType.long_text): "lossless",
    (CustomFieldType.color, CustomFieldType.formula): "discard_then_author",
    # formula → * (snapshot the computed overlay at the moment of conversion)
    # The apply path re-evaluates the live document one last time and
    # writes the computed value into `custom_values[field_key]` coerced
    # to the target type. `formula → single_select` materializes options
    # from the rendered text values (same as `long_text → single_select`).
    (CustomFieldType.formula, CustomFieldType.short_text): "lossless",
    (CustomFieldType.formula, CustomFieldType.long_text): "lossless",
    (CustomFieldType.formula, CustomFieldType.number): "lossy",
    (CustomFieldType.formula, CustomFieldType.url): "lossy",
    (CustomFieldType.formula, CustomFieldType.single_select): "create_options",
    (CustomFieldType.formula, CustomFieldType.color): "lossy",
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

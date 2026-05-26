"""`editFieldBundle` dispatcher — composes the per-property dispatchers.

Plan-21 lets the modal field-config UI emit any subset of
rename + description + options + type-change + formula source +
default-option as one atomic WriteOp. This module sequences the
existing per-property cores in the order that preserves their
individual semantics; it never widens the allowed change set.

Sub-step order (numbered comments below mirror plan-21 §3.3a):
    1. Identity (id / field_key immutability)
    2. Display-name uniqueness
    3. Description clamp
    4. Field-def replace (display_name / description / config)
    5. Formula source change (when target type is formula)
    6. Default-option-id validation (single_select only)

Between (1) and (4), if the field type changes the changeType core is
invoked; if the type is unchanged but the option list differs, the
editOptions core is invoked.
"""

from __future__ import annotations

from typing import cast

from starlette import status

from features.project_document.custom_fields import (
    CUSTOM_FIELD_DESCRIPTION_MAX,
    CustomFieldType,
)
from features.project_document.document import ProjectDocumentV1
from features.project_document.mutations.formula_ops import apply_set_formula
from features.project_document.mutations.guards import (
    find_field,
    reject_duplicate_display_name,
)
from features.project_document.mutations.models import (
    ChangeTypeMutation,
    EditFieldBundleMutation,
    EditOptionsMutation,
    SetFormulaMutation,
)
from features.project_document.mutations.options_ops import (
    apply_edit_options,
    validate_default_option_id,
)
from features.project_document.mutations.type_conversion import apply_change_type
from features.project_document.options import option_list_key
from features.project_document.tables.contracts import CustomFieldCapability
from features.shared.errors import api_error

__all__ = ["apply_edit_field_bundle"]


def apply_edit_field_bundle(
    body: ProjectDocumentV1,
    mutation: EditFieldBundleMutation,
    capability: CustomFieldCapability,
) -> tuple[ProjectDocumentV1, dict[str, object]]:
    """Apply rename + description + options + type-change + formula in one tx.

    Composes the existing per-property dispatchers' cores so behavior
    stays identical to the matching one-property mutations. Final
    document validation runs in the outer `apply_schema_mutation`.
    """
    current_fields = capability.read_custom_fields(body)
    index, existing = find_field(current_fields, mutation.field_id, mutation.table_key)
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
        reject_duplicate_display_name(
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
                    # apply_change_type rejects metadata changes besides
                    # field_type/config; rebuild `after` to match `existing`
                    # for those, since rename/description are applied below.
                    "display_name": existing.display_name,
                    "description": existing.description,
                }
            ),
            acknowledge_destructive=mutation.acknowledge_destructive,
            expected_schema_fingerprint=mutation.expected_schema_fingerprint,
        )
        next_body, ct_audit = apply_change_type(next_body, change_type_mutation, capability)
        cleared_row_count = cast(int, ct_audit.get("cleared_row_count") or 0)
        created_option_count = cast(int, ct_audit.get("created_option_count") or 0)
        properties_changed.append("field_type")
        # After change_type ran, re-read fields so we can layer the
        # display_name / description / final config changes on top.
        current_fields = capability.read_custom_fields(next_body)
        index, existing = find_field(current_fields, mutation.field_id, mutation.table_key)
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
        next_body, eo_audit = apply_edit_options(next_body, edit_options_mutation, capability)
        post_list = next_body.single_select_options.get(namespace_key, [])
        cleared_row_count = cast(int, eo_audit.get("cleared_row_count") or 0)
        if pre_list != post_list:
            properties_changed.append("options")
        # Re-read after the option list change.
        current_fields = capability.read_custom_fields(next_body)
        index, existing = find_field(current_fields, mutation.field_id, mutation.table_key)

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
        # apply_set_formula re-reads fields and replaces config with
        # {source, ast, deps, result_type} — that wipes whatever we
        # just wrote into config; that's the intended behavior since
        # the bundle's `after.config.source` is the user's input and
        # the parsed AST is server-derived.
        next_body, sf_audit = apply_set_formula(next_body, set_formula_mutation, capability)
        properties_changed.append("formula_source")
        audit_extras["formula_source_length"] = sf_audit.get("source_length")

    # --- 6. Default-option-id validation (single_select only) ---
    if final_field.field_type is CustomFieldType.single_select:
        namespace_key = option_list_key(capability.table_path, mutation.field_id)
        final_options = next_body.single_select_options.get(namespace_key, [])
        final_ids = {opt.id for opt in final_options}
        # Re-read final field after potential rewrites.
        post_fields = capability.read_custom_fields(next_body)
        _, post_field = find_field(post_fields, mutation.field_id, mutation.table_key)
        validate_default_option_id(post_field, final_ids)
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

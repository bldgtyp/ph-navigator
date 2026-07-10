"""`editFieldBundle` dispatcher — composes the per-property dispatchers.

Plan-21 lets the modal field-config UI emit any subset of
rename + description + options + type-change + formula source +
default-option as one atomic WriteOp. This module sequences the
existing per-property cores in the order that preserves their
individual semantics; it never widens the allowed change set.

Sub-step order (numbered comments below mirror plan-21 §3.3a):
    1. Identity (field_key immutability)
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
    FIELD_DESCRIPTION_MAX,
    CustomFieldType,
)
from features.project_document.document import ProjectDocumentV1
from features.project_document.mutations.formula_ops import apply_set_formula
from features.project_document.mutations.guards import (
    collapse_carried_units,
    enforce_fixed_units_lock,
    find_field,
    reject_duplicate_display_name,
    resolved_display_units,
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
from features.project_document.tables.contracts import TableFieldRegistry
from features.shared.errors import api_error

__all__ = ["apply_edit_field_bundle"]


def apply_edit_field_bundle(
    body: ProjectDocumentV1,
    mutation: EditFieldBundleMutation,
    capability: TableFieldRegistry,
) -> tuple[ProjectDocumentV1, dict[str, object]]:
    """Apply rename + description + options + type-change + formula in one tx.

    Composes the existing per-property dispatchers' cores so behavior
    stays identical to the matching one-property mutations. Final
    document validation runs in the outer `apply_schema_mutation`.
    """
    current_fields = capability.read_field_defs(body)
    index, existing = find_field(current_fields, mutation.field_id, mutation.table_key)
    after = mutation.after

    # --- 1. Identity ---
    if after.field_key != mutation.field_id:
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "custom_field_invalid_field_id",
            "editFieldBundle target id must equal field_id.",
            {"field_id": after.field_key, "expected_field_id": mutation.field_id},
        )
    # D13: fixed-unit fields may convert only number ↔ formula and never have
    # their units retargeted. This authoritative guard runs first, with the real
    # `display_units` tri-state; the changeType core's own copy of the guard
    # (reached below) sees no display_units and treats a formula target as a
    # carry-forward, so it never double-rejects.
    display_units = resolved_display_units(mutation)
    enforce_fixed_units_lock(existing, after.field_type, after.config, mutation.field_id, display_units=display_units)
    # Capture the pre-mutation formula scaffolding: step 4 drops `units` from a
    # formula target's config (D12) and change_type re-reads the field, so the
    # carry-forward source/units must be remembered here, before either runs.
    original_units = existing.config.get("units")
    original_source = existing.config.get("source") if existing.field_type is CustomFieldType.formula else None

    properties_changed: list[str] = []

    # --- 2. Display-name uniqueness (only when the name actually changed) ---
    if after.display_name != existing.display_name:
        reject_duplicate_display_name(
            current_fields,
            after.display_name,
            skip_field_key=mutation.field_id,
        )
        properties_changed.append("display_name")

    # --- 3. Description clamp ---
    raw_description = after.description
    clamped_description = None if raw_description is None else raw_description[:FIELD_DESCRIPTION_MAX]
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

    # PRD Q13: `target_table_path` on an existing linked_record field is
    # not editable. Retarget requires delete + re-add. `max_links` stays
    # freely editable (no row-data migration needed per Q4).
    if (
        not type_changed
        and existing.field_type is CustomFieldType.linked_record
        and existing.config.get("target_table_path") != after.config.get("target_table_path")
    ):
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "linked_record_retarget_not_supported",
            "Editing target_table_path on an existing linked_record field is not supported.",
            {"field_id": mutation.field_id},
        )
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
        # When the bundle is changing INTO single_select and the client
        # supplied an explicit option list (the modal pre-populates this
        # from the source values for an Airtable-style preview), pass it
        # through so the backend uses it as authoritative instead of
        # re-materializing options from raw row values.
        ct_client_options = (
            mutation.next_options
            if (after.field_type is CustomFieldType.single_select and mutation.next_options is not None)
            else None
        )
        next_body, ct_audit = apply_change_type(
            next_body,
            change_type_mutation,
            capability,
            client_options=ct_client_options,
        )
        cleared_row_count = cast(int, ct_audit.get("cleared_row_count") or 0)
        created_option_count = cast(int, ct_audit.get("created_option_count") or 0)
        properties_changed.append("field_type")
        # After change_type ran, re-read fields so we can layer the
        # display_name / description / final config changes on top.
        current_fields = capability.read_field_defs(next_body)
        index, existing = find_field(current_fields, mutation.field_id, mutation.table_key)
    elif after.field_type is CustomFieldType.single_select and mutation.next_options is not None:
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
        current_fields = capability.read_field_defs(next_body)
        index, existing = find_field(current_fields, mutation.field_id, mutation.table_key)

    # --- 4. Field def replace (display_name / description / config) ---
    # Re-anchor on the post-mutation `existing` (which has the new
    # field_type/config from changeType when type changed). We layer
    # display_name + description + the user's intended config on top.
    target_config: dict[str, object] = dict(after.config)
    # D6 reverse carry-back: on a formula→number type change with no client
    # units, changeType (site 6) seeded the display unit onto the number field.
    # `after.config` is empty on that undo path, so preserve it here instead of
    # clobbering. Scoped to the formula→number conversion so a number→number
    # units *removal* is untouched (that path never runs changeType).
    if (
        type_changed
        and original_source is not None
        and after.field_type is CustomFieldType.number
        and "units" not in target_config
        and "units" in existing.config
    ):
        target_config["units"] = existing.config["units"]
    final_field = existing.model_copy(
        update={
            "display_name": after.display_name,
            "description": clamped_description,
            "config": target_config,
        }
    )
    next_fields = list(current_fields)
    next_fields[index] = final_field
    next_body = capability.replace_field_defs(next_body, next_fields)

    # --- 5. Formula reconciliation (runs for EVERY formula target, D14) ---
    # Reconciling on every formula-typed target — not only when `formula_source`
    # is sent — is what keeps units on a same-type rename (step 4 dropped them
    # per D12) and lets a units-only retag land without a source edit. Re-parsing
    # an unchanged source is idempotent. Source falls back to the stored source;
    # a conversion INTO formula must supply one (the `discard_then_author` case).
    if final_field.field_type is CustomFieldType.formula:
        source = mutation.formula_source if mutation.formula_source is not None else original_source
        if not isinstance(source, str):
            raise api_error(
                status.HTTP_422_UNPROCESSABLE_CONTENT,
                "custom_field_formula_source_required",
                "Converting a field to a formula requires a formula source.",
                {"field_id": mutation.field_id},
            )
        set_formula_mutation = SetFormulaMutation(
            kind="setFormula",
            table_key=mutation.table_key,
            field_id=mutation.field_id,
            source=source,
            expected_schema_fingerprint=mutation.expected_schema_fingerprint,
        )
        # Resolve the D12 tri-state against the ORIGINAL units (step 4's config no
        # longer carries them): unset → carry forward; null → clear; dict → retag.
        carried_units = collapse_carried_units(display_units, original_units)
        next_body, sf_audit = apply_set_formula(
            next_body, set_formula_mutation, capability, carried_units=carried_units
        )
        if mutation.formula_source is not None:
            properties_changed.append("formula_source")
            audit_extras["formula_source_length"] = sf_audit.get("source_length")
        # Audit the units outcome from the reconciled config `apply_set_formula`
        # reports — covers set, retag, explicit clear, and a result_type flip that
        # drops units on a source edit.
        final_units = sf_audit.get("units")
        if final_units != original_units:
            properties_changed.append("display_units")
        if original_units is not None and final_units is None:
            audit_extras["display_units_dropped"] = True

    # --- 6. Default-option-id validation (single_select only) ---
    if final_field.field_type is CustomFieldType.single_select:
        namespace_key = option_list_key(capability.table_path, mutation.field_id)
        final_options = next_body.single_select_options.get(namespace_key, [])
        final_ids = {opt.id for opt in final_options}
        # Re-read final field after potential rewrites.
        post_fields = capability.read_field_defs(next_body)
        _, post_field = find_field(post_fields, mutation.field_id, mutation.table_key)
        validate_default_option_id(post_field, final_ids)
        if existing.field_type is CustomFieldType.single_select and existing.config.get(
            "default_option_id"
        ) != post_field.config.get("default_option_id"):
            properties_changed.append("default_option_id")
        elif (
            existing.field_type is not CustomFieldType.single_select
            and post_field.config.get("default_option_id") is not None
        ):
            properties_changed.append("default_option_id")
    elif "default_option_id" in final_field.config:
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
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

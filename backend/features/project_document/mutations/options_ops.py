"""`editOptions` dispatcher and the option-target / default-id helpers.

Resolves a target field id to its option-list namespace (core or
custom), validates the next option list, cascades deletions to row
values, and rewrites `body.single_select_options`. The helpers
`resolve_option_target` and `validate_default_option_id` are reused by
`type_conversion` and `bundle`.
"""

from __future__ import annotations

from starlette import status

from features.project_document.custom_fields import (
    CustomFieldDef,
    CustomFieldType,
)
from features.project_document.document import ProjectDocumentV1, SingleSelectOption
from features.project_document.mutations.guards import (
    read_rows_from_envelope,
    replace_rows_in_envelope,
)
from features.project_document.mutations.models import EditOptionsMutation
from features.project_document.options import option_list_key, validate_option_list
from features.project_document.tables.contracts import CustomFieldCapability
from features.shared.errors import api_error

__all__ = [
    "apply_edit_options",
    "resolve_option_target",
    "validate_default_option_id",
]


def resolve_option_target(
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


def validate_default_option_id(
    field: CustomFieldDef, next_option_ids: set[str]
) -> None:
    """Ensure single-select `config.default_option_id` (if set) is a real option.

    Atomically validated with option-list mutations so a pending
    default cannot survive an option deletion in the same write.
    Called from `apply_edit_options`, `apply_change_type` (when target
    is single_select), and `apply_edit_field_bundle`.
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


def apply_edit_options(
    body: ProjectDocumentV1,
    mutation: EditOptionsMutation,
    capability: CustomFieldCapability,
) -> tuple[ProjectDocumentV1, dict[str, object]]:
    is_custom, namespace_key, current_options = resolve_option_target(
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
                validate_default_option_id(field, next_ids)
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
        rows = read_rows_from_envelope(next_body, mutation.table_key)
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
        next_body = replace_rows_in_envelope(next_body, mutation.table_key, next_rows)

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

"""`editOptions` dispatcher and the option-target / default-id helpers.

Resolves a target field key to its option-list namespace (built-in or
custom), validates the next option list, cascades deletions to row
values, and rewrites `body.single_select_options`. The helpers
`resolve_option_target` and `validate_default_option_id` are reused by
`type_conversion` and `bundle`.
"""

from __future__ import annotations

from starlette import status

from features.project_document.custom_fields import (
    CustomFieldType,
    TableFieldDef,
)
from features.project_document.document import ProjectDocumentV1, SingleSelectOption
from features.project_document.mutations.guards import (
    find_field,
    read_rows_from_envelope,
    replace_rows_in_envelope,
)
from features.project_document.mutations.models import EditOptionsMutation
from features.project_document.options import option_list_key, validate_option_list
from features.project_document.tables.contracts import TableFieldRegistry
from features.shared.errors import api_error

__all__ = [
    "apply_edit_options",
    "resolve_option_target",
    "validate_default_option_id",
]


def resolve_option_target(
    body: ProjectDocumentV1,
    field_key: str,
    table_key: str,
    capability: TableFieldRegistry,
) -> tuple[bool, str, list[SingleSelectOption]]:
    """Return (in_custom_values, namespace_key, current_options) for a field key.

    `in_custom_values` is False for locked-type built-in single-selects
    (typed columns); True for mutable-type built-ins and customs whose
    values live in `row.custom_values`. Raises
    `custom_field_invalid_field_id` if the field is neither a built-in
    single-select nor a custom single-select.
    """
    built_in_namespace = capability.built_in_option_key_by_field_key.get(field_key)
    if built_in_namespace is not None:
        return False, built_in_namespace, list(body.single_select_options.get(built_in_namespace, []))
    field_defs = capability.read_field_defs(body)
    for field in field_defs:
        if field.field_key == field_key:
            if field.field_type is not CustomFieldType.single_select:
                raise api_error(
                    status.HTTP_422_UNPROCESSABLE_ENTITY,
                    "custom_field_invalid_field_id",
                    "Cannot edit options on a non-single_select field.",
                    {
                        "field_id": field_key,
                        "table_key": table_key,
                        "reason": "field_type_not_single_select",
                    },
                )
            namespace_key = option_list_key(capability.table_path, field_key)
            return True, namespace_key, list(body.single_select_options.get(namespace_key, []))
    raise api_error(
        status.HTTP_422_UNPROCESSABLE_ENTITY,
        "custom_field_invalid_field_id",
        "Field id was not found as a single-select column.",
        {"field_id": field_key, "table_key": table_key},
    )


def validate_default_option_id(field: TableFieldDef, next_option_ids: set[str]) -> None:
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
                "field_id": field.field_key,
                "reason": "default_option_id_not_string",
            },
        )
    if raw not in next_option_ids:
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "custom_field_option_list_invalid",
            "default_option_id must reference an option in the field's option list.",
            {
                "field_id": field.field_key,
                "reason": "default_option_id_not_in_options",
                "default_option_id": raw,
            },
        )


def apply_edit_options(
    body: ProjectDocumentV1,
    mutation: EditOptionsMutation,
    capability: TableFieldRegistry,
) -> tuple[ProjectDocumentV1, dict[str, object]]:
    in_custom_values, namespace_key, current_options = resolve_option_target(
        body, mutation.field_id, mutation.table_key, capability
    )
    validate_option_list(mutation.next_options)

    current_ids = {option.id for option in current_options}
    next_ids = {option.id for option in mutation.next_options}
    deleted_ids = current_ids - next_ids

    # If this field stores its value in `custom_values` and has a
    # configured default, validate the default still exists in
    # next_options. The caller (the modal) is expected to strip the
    # default in the same write via `editFieldBundle` when needed;
    # the raw `editOptions` mutation refuses to silently clear it.
    if in_custom_values:
        _, field = find_field(capability.read_field_defs(body), mutation.field_id, mutation.table_key)
        validate_default_option_id(field, next_ids)

    # Required built-in single-select fields cannot be cleared on
    # referenced deletes — caller must supply replacement option ids.
    if not in_custom_values and mutation.field_id in capability.required_field_keys and deleted_ids:
        for deleted_id in deleted_ids:
            replacement = mutation.replacements.get(deleted_id)
            if replacement is None:
                raise api_error(
                    status.HTTP_422_UNPROCESSABLE_ENTITY,
                    "custom_field_option_list_invalid",
                    "Required built-in single-select option deletion requires a replacement.",
                    {
                        "reason": "required_built_in_select_delete_without_replacement",
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
            if in_custom_values:
                custom_values = capability.read_row_custom_values(row)
                current_value = custom_values.get(mutation.field_id)
                if isinstance(current_value, str) and current_value in deleted_ids:
                    cleared_row_count += 1
                    new_custom = dict(custom_values)
                    new_custom[mutation.field_id] = None
                    next_rows.append(capability.set_row_custom_values(row, new_custom))
                else:
                    next_rows.append(row)
            else:
                current_value = capability.read_built_in_option_value(row, mutation.field_id)
                if isinstance(current_value, str) and current_value in deleted_ids:
                    cleared_row_count += 1
                    replacement = mutation.replacements.get(current_value)
                    next_rows.append(capability.set_built_in_option_value(row, mutation.field_id, replacement))
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
        "in_custom_values": in_custom_values,
        "added_option_ids": sorted(next_ids - current_ids),
        "deleted_option_ids": sorted(deleted_ids),
        "cleared_row_count": cleared_row_count,
    }
    return next_body, audit

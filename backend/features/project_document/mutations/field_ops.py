"""Per-field CRUD dispatchers: add / rename / delete / duplicate / set_description.

Each handler returns `(next_body, audit)` and never raises except via
`features.shared.errors.api_error`. Each is invoked exclusively from
the dispatcher in `mutations.dispatcher` — they are not part of the
public API surface and live behind the `apply_schema_mutation` facade.
"""

from __future__ import annotations

from starlette import status

from features.project_document.custom_fields import (
    FIELD_DESCRIPTION_MAX,
    CustomFieldType,
)
from features.project_document.document import ProjectDocumentV1
from features.project_document.mutations.guards import (
    find_field,
    reject_duplicate_display_name,
    reject_field_id_collision,
    reject_reserved_field_key,
    replace_rows_in_envelope,
    resolve_insert_position,
    strip_field_from_rows,
)
from features.project_document.mutations.models import (
    AddFieldMutation,
    DeleteFieldMutation,
    DuplicateFieldMutation,
    RenameFieldMutation,
    SetDescriptionMutation,
)
from features.project_document.options import mint_option_id, validate_option_list
from features.project_document.tables.contracts import TableFieldRegistry
from features.shared.errors import api_error

__all__ = [
    "apply_add_field",
    "apply_delete_field",
    "apply_duplicate_field",
    "apply_rename_field",
    "apply_set_description",
]


def apply_add_field(
    body: ProjectDocumentV1,
    mutation: AddFieldMutation,
    actor_user_id: str,
    capability: TableFieldRegistry,
) -> tuple[ProjectDocumentV1, dict[str, object]]:
    current_fields = capability.read_field_defs(body)
    reject_reserved_field_key(mutation.after.field_key)
    reject_field_id_collision(current_fields, mutation.after.field_key)
    reject_duplicate_display_name(
        current_fields,
        mutation.after.display_name,
    )
    position = resolve_insert_position(
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
    next_body = capability.replace_field_defs(body, next_fields)
    if mutation.after.field_type is CustomFieldType.single_select:
        next_body = capability.replace_field_option_list(next_body, stamped.field_key, list(initial_options or []))
    audit: dict[str, object] = {
        "kind": "addField",
        "table_key": mutation.table_key,
        "field_id": stamped.field_key,
        "display_name": stamped.display_name,
        "field_type": stamped.field_type.value,
        "initial_option_count": len(initial_options or []),
    }
    return next_body, audit


def apply_rename_field(
    body: ProjectDocumentV1,
    mutation: RenameFieldMutation,
    capability: TableFieldRegistry,
) -> tuple[ProjectDocumentV1, dict[str, object]]:
    current_fields = capability.read_field_defs(body)
    index, existing = find_field(current_fields, mutation.field_id, mutation.table_key)
    reject_duplicate_display_name(
        current_fields,
        mutation.display_name,
        skip_field_key=mutation.field_id,
    )

    renamed = existing.model_copy(update={"display_name": mutation.display_name})
    next_fields = list(current_fields)
    next_fields[index] = renamed
    next_body = capability.replace_field_defs(body, next_fields)
    audit: dict[str, object] = {
        "kind": "renameField",
        "table_key": mutation.table_key,
        "field_id": mutation.field_id,
        "old_display_name": existing.display_name,
        "new_display_name": mutation.display_name,
    }
    return next_body, audit


def apply_delete_field(
    body: ProjectDocumentV1,
    mutation: DeleteFieldMutation,
    capability: TableFieldRegistry,
) -> tuple[ProjectDocumentV1, dict[str, object]]:
    current_fields = capability.read_field_defs(body)
    find_field(current_fields, mutation.field_id, mutation.table_key)

    # Strip the field key from every row's `custom_values` first; then
    # remove the schema entry. Doing rows before schema keeps the
    # intermediate body's `validate_document_references` happy
    # (custom values must reference a known field key).
    next_rows, cleared_row_count = strip_field_from_rows(body, mutation.table_key, mutation.field_id, capability)
    body_with_stripped_rows = replace_rows_in_envelope(body, mutation.table_key, next_rows)

    next_fields = [field for field in current_fields if field.field_key != mutation.field_id]
    next_body = capability.replace_field_defs(body_with_stripped_rows, next_fields)
    audit: dict[str, object] = {
        "kind": "deleteField",
        "table_key": mutation.table_key,
        "field_id": mutation.field_id,
        "cleared_row_count": cleared_row_count,
    }
    return next_body, audit


def apply_duplicate_field(
    body: ProjectDocumentV1,
    mutation: DuplicateFieldMutation,
    actor_user_id: str,
    capability: TableFieldRegistry,
) -> tuple[ProjectDocumentV1, dict[str, object]]:
    current_fields = capability.read_field_defs(body)
    source_index, source = find_field(current_fields, mutation.source_field_id, mutation.table_key)
    if mutation.after.field_key == mutation.source_field_id:
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "custom_field_invalid_field_id",
            "Duplicate target id must differ from the source field id.",
            {
                "field_id": mutation.after.field_key,
                "table_key": mutation.table_key,
            },
        )
    reject_reserved_field_key(mutation.after.field_key)
    reject_field_id_collision(current_fields, mutation.after.field_key)
    reject_duplicate_display_name(
        current_fields,
        mutation.after.display_name,
    )

    stamped = mutation.after.model_copy(update={"created_by": actor_user_id})
    next_fields = list(current_fields)
    next_fields.insert(source_index + 1, stamped)
    next_body = capability.replace_field_defs(body, next_fields)
    duplicated_option_count = 0
    if source.field_type is CustomFieldType.single_select:
        # Row values aren't copied, but the source's option list is
        # deep-copied under fresh ids so the duplicate column is fully
        # independent of the source.
        source_options = capability.read_field_option_list(next_body, source.field_key)
        new_options = [option.model_copy(update={"id": mint_option_id()}) for option in source_options]
        next_body = capability.replace_field_option_list(next_body, stamped.field_key, new_options)
        duplicated_option_count = len(new_options)
    audit: dict[str, object] = {
        "kind": "duplicateField",
        "table_key": mutation.table_key,
        "source_field_id": source.field_key,
        "new_field_id": stamped.field_key,
        "display_name": stamped.display_name,
        "duplicated_option_count": duplicated_option_count,
    }
    return next_body, audit


def apply_set_description(
    body: ProjectDocumentV1,
    mutation: SetDescriptionMutation,
    capability: TableFieldRegistry,
) -> tuple[ProjectDocumentV1, dict[str, object]]:
    current_fields = capability.read_field_defs(body)
    index, existing = find_field(current_fields, mutation.field_id, mutation.table_key)

    raw = mutation.description
    clamped: str | None = None if raw is None else raw[:FIELD_DESCRIPTION_MAX]
    next_field = existing.model_copy(update={"description": clamped})
    next_fields = list(current_fields)
    next_fields[index] = next_field
    next_body = capability.replace_field_defs(body, next_fields)
    audit: dict[str, object] = {
        "kind": "setDescription",
        "table_key": mutation.table_key,
        "field_id": mutation.field_id,
        "old_description_length": len(existing.description or ""),
        "new_description_length": len(clamped or ""),
    }
    return next_body, audit

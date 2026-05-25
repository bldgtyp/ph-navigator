"""Developer-only helpers for seeding custom fields onto Rooms.

Lets the test suite (and manual CLI smoke) inject a custom field
without going through the real schema-editor HTTP / MCP surface — it
deliberately side-steps editor-login gating, so NEVER import from
production code paths. The fixture path accepts `created_by=None`;
real API / MCP paths must supply a user id.
"""

from __future__ import annotations

import sys
from datetime import UTC, datetime

from features.project_document.custom_fields import (
    CustomFieldDef,
    CustomFieldType,
    mint_custom_field_id,
)
from features.project_document.document import (
    ProjectDocumentV1,
    RoomsTableEnvelope,
    SingleSelectOption,
)
from features.project_document.validation import validate_document


def _is_dev_or_test() -> bool:
    """Block production imports. Heuristic: pytest sets `sys.modules['pytest']`."""
    return "pytest" in sys.modules or __name__ == "__main__"


def seed_rooms_custom_field(
    body: ProjectDocumentV1,
    *,
    display_name: str,
    field_type: CustomFieldType = CustomFieldType.short_text,
    description: str | None = None,
    field_id: str | None = None,
    created_at: datetime | None = None,
) -> tuple[ProjectDocumentV1, CustomFieldDef]:
    """TEST/DEV ONLY. Append a custom field to Rooms with created_by=None.

    Returns the validated next document body and the appended
    CustomFieldDef so callers can write `row.custom[id]` values.
    """
    if not _is_dev_or_test():
        raise RuntimeError("seed_rooms_custom_field is dev/test only and must not be imported in production")

    custom_field = CustomFieldDef(
        id=field_id or mint_custom_field_id(),
        display_name=display_name,
        field_type=field_type,
        description=description,
        created_at=created_at or datetime.now(tz=UTC),
        created_by=None,
    )
    next_custom_fields = [*body.tables.rooms.custom_fields, custom_field]
    next_envelope = RoomsTableEnvelope(
        custom_fields=next_custom_fields,
        rows=list(body.tables.rooms.rows),
    )
    next_tables = body.tables.model_copy(update={"rooms": next_envelope})
    next_body = body.model_copy(update={"tables": next_tables})
    return validate_document(next_body.model_dump(mode="json")), custom_field


def seed_rooms_custom_single_select(
    body: ProjectDocumentV1,
    *,
    display_name: str,
    options: list[SingleSelectOption],
    description: str | None = None,
    field_id: str | None = None,
    created_at: datetime | None = None,
) -> tuple[ProjectDocumentV1, CustomFieldDef]:
    """TEST/DEV ONLY. Seed a custom single_select field + its option list.

    The field is registered in `rooms.custom_fields` and the option list
    is stored under `single_select_options["rooms.<cf_id>"]`.
    """
    if not _is_dev_or_test():
        raise RuntimeError("seed_rooms_custom_single_select is dev/test only")

    custom_field = CustomFieldDef(
        id=field_id or mint_custom_field_id(),
        display_name=display_name,
        field_type=CustomFieldType.single_select,
        description=description,
        created_at=created_at or datetime.now(tz=UTC),
        created_by=None,
    )
    next_custom_fields = [*body.tables.rooms.custom_fields, custom_field]
    next_envelope = RoomsTableEnvelope(
        custom_fields=next_custom_fields,
        rows=list(body.tables.rooms.rows),
    )
    next_tables = body.tables.model_copy(update={"rooms": next_envelope})
    next_options = dict(body.single_select_options)
    next_options[f"rooms.{custom_field.id}"] = list(options)
    next_body = body.model_copy(
        update={"tables": next_tables, "single_select_options": next_options}
    )
    return validate_document(next_body.model_dump(mode="json")), custom_field

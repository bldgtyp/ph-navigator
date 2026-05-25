"""Developer-only helpers for seeding custom fields onto Rooms.

Plan-14 P1.6 acceptance: lets the test suite (and a manual CLI smoke)
inject a `short_text` (or any v1 type) custom field on the Rooms table
without exposing a real schema-editor HTTP / MCP surface in Phase 1.

NEVER import this from production code paths — it deliberately
side-steps the editor-login gating that Phase 2 schema mutations will
honour. The fixture path (D11) accepts `created_by=None`; the API /
MCP paths must require a real user id.
"""

from __future__ import annotations

import secrets
import sys
from datetime import UTC, datetime

from features.project_document.custom_fields import (
    CustomFieldDef,
    CustomFieldType,
)
from features.project_document.document import (
    ProjectDocumentV1,
    RoomsTableEnvelope,
)
from features.project_document.validation import validate_document


def _is_dev_or_test() -> bool:
    """Block production imports. Heuristic: pytest sets `sys.modules['pytest']`."""
    return "pytest" in sys.modules or __name__ == "__main__"


def _generate_cf_id() -> str:
    return f"cf_{secrets.token_hex(8)}"


def seed_rooms_custom_field(
    body: ProjectDocumentV1,
    *,
    display_name: str,
    field_type: CustomFieldType = CustomFieldType.short_text,
    description: str | None = None,
    field_id: str | None = None,
    created_at: datetime | None = None,
) -> tuple[ProjectDocumentV1, CustomFieldDef]:
    """TEST/DEV ONLY. Append a custom field to Rooms with created_by=None (D11).

    Returns the validated next document body and the appended
    CustomFieldDef so callers can write `row.custom[id]` values against
    the new field.
    """
    if not _is_dev_or_test():
        raise RuntimeError("seed_rooms_custom_field is dev/test only and must not be imported in production")

    custom_field = CustomFieldDef(
        id=field_id or _generate_cf_id(),
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

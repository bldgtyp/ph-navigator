"""`"record_id"` reserved-slug guard.

`record_id` is the field-key the Phase 2 identifier slot will occupy on
every project-document table. Phase 1a reserves the namespace before
the semantics ship so an MCP / REST caller cannot land a custom field
whose advisory `field_key` collides with the upcoming reserved slot.

The Pydantic `field_validator` on `CustomFieldDef.field_key` runs at
parse time, so every write path that constructs a `CustomFieldDef` from
JSON (REST, MCP, fixtures, schema-mutation envelopes) is covered.
"""

from __future__ import annotations

from datetime import UTC, datetime

import pytest
from pydantic import ValidationError

from features.project_document.custom_fields import (
    RESERVED_FIELD_KEY_RECORD_ID,
    CustomFieldDef,
    CustomFieldType,
)


def _make_field(field_id: str, *, field_key: str | None = None) -> CustomFieldDef:
    return CustomFieldDef(
        id=field_id,
        field_key=field_key,
        display_name="Notes",
        field_type=CustomFieldType.short_text,
        created_at=datetime(2026, 5, 26, 12, 0, tzinfo=UTC),
        created_by=None,
    )


def test_validator_rejects_reserved_record_id_slug() -> None:
    with pytest.raises(ValidationError) as excinfo:
        _make_field("cf_x", field_key=RESERVED_FIELD_KEY_RECORD_ID)
    assert RESERVED_FIELD_KEY_RECORD_ID in str(excinfo.value)


def test_validator_accepts_other_field_keys() -> None:
    field = _make_field("cf_x", field_key="notes_export_key")
    assert field.field_key == "notes_export_key"


def test_validator_accepts_none_field_key() -> None:
    field = _make_field("cf_x", field_key=None)
    assert field.field_key is None


def test_validator_runs_through_model_validate() -> None:
    # Mirrors the REST / MCP path: JSON in → validated CustomFieldDef.
    payload = {
        "id": "cf_x",
        "field_key": RESERVED_FIELD_KEY_RECORD_ID,
        "display_name": "Bogus",
        "field_type": "short_text",
        "config": {},
        "description": None,
        "created_at": "2026-05-26T12:00:00Z",
        "created_by": None,
    }
    with pytest.raises(ValidationError):
        CustomFieldDef.model_validate(payload)

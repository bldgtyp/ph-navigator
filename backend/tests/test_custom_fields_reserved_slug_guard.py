"""`"record_id"` reserved custom-field key guard.

`record_id` is the built-in identifier field-key on every
project-document table. Custom-field mutations must not claim that
slot, but the canonical `TableFieldDef` model must still accept it for
built-in seeds.

The rejection therefore lives in the schema-mutation guard, where the
field's custom-side origin is known.
"""

from __future__ import annotations

from datetime import UTC, datetime

import pytest
from fastapi import HTTPException

from features.project_document.custom_fields import (
    RESERVED_FIELD_KEY_RECORD_ID,
    CustomFieldType,
    TableFieldDef,
)
from features.project_document.mutations.guards import reject_reserved_field_key


def _make_field(field_key: str) -> TableFieldDef:
    return TableFieldDef(
        field_key=field_key,
        display_name="Notes",
        field_type=CustomFieldType.short_text,
        created_at=datetime(2026, 5, 26, 12, 0, tzinfo=UTC),
        created_by=None,
    )


def test_guard_rejects_reserved_record_id_custom_field_key() -> None:
    with pytest.raises(HTTPException) as excinfo:
        reject_reserved_field_key(RESERVED_FIELD_KEY_RECORD_ID)

    detail = excinfo.value.detail
    assert isinstance(detail, dict)
    assert detail["error_code"] == "custom_field_invalid_field_id"
    assert detail["details"] == {
        "field_id": RESERVED_FIELD_KEY_RECORD_ID,
        "reason": "reserved_field_key",
    }


def test_guard_accepts_other_custom_field_keys() -> None:
    reject_reserved_field_key("cf_notes")


def test_table_field_def_accepts_builtin_record_id_seed() -> None:
    field = _make_field(RESERVED_FIELD_KEY_RECORD_ID)
    assert field.field_key == RESERVED_FIELD_KEY_RECORD_ID


def test_table_field_def_model_validate_accepts_builtin_record_id_seed() -> None:
    payload = {
        "field_key": RESERVED_FIELD_KEY_RECORD_ID,
        "display_name": "Record-ID",
        "field_type": "formula",
        "config": {},
        "description": None,
        "origin": "built_in",
        "created_at": "2026-05-26T12:00:00Z",
        "created_by": None,
    }
    field = TableFieldDef.model_validate(payload)
    assert field.field_key == RESERVED_FIELD_KEY_RECORD_ID

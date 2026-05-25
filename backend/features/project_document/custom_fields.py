"""Custom field definitions for project-document tables.

Phase 1 (plan-14 P1.1) lands the closed `CustomFieldDef` shape and the
`CustomFieldType` enum that the JSON Schema and document validators
consume. Per-type `config` validation, formula evaluation, and the
schema-mutation DTOs are deferred to phase 2/3/4.

`CustomValue` is the value side: each row's `custom` dict maps a
`cf_*` id to a scalar. The narrow scalar set keeps round-trips
deterministic across JSON serialization. Richer types (e.g. computed
overlays, attachments) ride on read paths only.
"""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field

CUSTOM_FIELD_ID_PATTERN = r"^cf_[A-Za-z0-9_-]+$"
CUSTOM_FIELD_DISPLAY_NAME_MAX = 120
CUSTOM_FIELD_DESCRIPTION_MAX = 280
CUSTOM_FIELD_KEY_MAX = 80

# Scalar set permitted inside `RoomRow.custom`. Per-type validation
# against the field's declared `field_type` runs in
# `validate_document_references` (document.py); this alias is the JSON
# shape contract for storage / round-trip.
CustomValue = str | int | float | bool | None


class CustomFieldType(StrEnum):
    """Closed v1 set of custom field types.

    Phase 1 exercises `short_text` end-to-end. The enum closes the v1
    set up front so the published JSON Schema is authoritative from day
    one; per-type config validation and runtime support for `formula`,
    `single_select`, etc. land in later phases.
    """

    short_text = "short_text"
    long_text = "long_text"
    number = "number"
    url = "url"
    single_select = "single_select"
    formula = "formula"


class CustomFieldDef(BaseModel):
    """One user-defined field on a project-document table.

    Identity is the `cf_*` id (D12) — every row value, view-state
    column id, write op, and formula reference uses it. `field_key`
    is an advisory export slug for JSON readability only.

    `created_by` accepts None for fixture / dev-seed callers (D11);
    the API and MCP write surfaces (phase 2) must supply a real user
    id.
    """

    model_config = ConfigDict(extra="forbid")

    id: str = Field(pattern=CUSTOM_FIELD_ID_PATTERN, max_length=CUSTOM_FIELD_KEY_MAX)
    field_key: str | None = Field(default=None, max_length=CUSTOM_FIELD_KEY_MAX)
    display_name: str = Field(min_length=1, max_length=CUSTOM_FIELD_DISPLAY_NAME_MAX)
    field_type: CustomFieldType
    config: dict[str, object] = Field(default_factory=dict)
    description: str | None = Field(default=None, max_length=CUSTOM_FIELD_DESCRIPTION_MAX)
    created_at: datetime
    created_by: str | None = None


def coerce_custom_value(value: object, field_type: CustomFieldType) -> CustomValue:
    """Coerce / validate a row's `custom[cf_id]` value against its declared type.

    Phase 1 only ships the `short_text` path end-to-end; other branches
    accept JSON scalars matching the field type so existing
    schema-mutation tests can seed fixtures without per-type validators.
    Phase 3/4 tighten the per-type contracts.

    Raises ValueError on a hard mismatch — caller surfaces this through
    the `invalid_project_document` error code.
    """
    if value is None:
        return None
    if field_type is CustomFieldType.short_text:
        if not isinstance(value, str):
            raise ValueError(f"short_text value must be a string, got {type(value).__name__}")
        if len(value) > 4000:
            raise ValueError("short_text value exceeds 4000 characters")
        return value
    if field_type is CustomFieldType.long_text:
        if not isinstance(value, str):
            raise ValueError(f"long_text value must be a string, got {type(value).__name__}")
        return value
    if field_type is CustomFieldType.number:
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise ValueError(f"number value must be numeric, got {type(value).__name__}")
        return value
    if field_type is CustomFieldType.url:
        if not isinstance(value, str):
            raise ValueError(f"url value must be a string, got {type(value).__name__}")
        return value
    if field_type is CustomFieldType.single_select:
        if not isinstance(value, str):
            raise ValueError(f"single_select value must be an option id string, got {type(value).__name__}")
        return value
    if field_type is CustomFieldType.formula:
        raise ValueError("formula custom fields are computed; stored row values are not permitted")
    raise ValueError(f"unsupported custom field type: {field_type!r}")

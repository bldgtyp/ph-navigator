"""Custom field definitions for project-document tables.

`CustomFieldDef` is the closed shape of a user-defined column; the
`CustomFieldType` enum is the closed v1 type set consumed by the JSON
Schema and document validators. `CustomValue` is the value side: each
row's `custom` dict maps a `cf_*` id to one of a narrow set of scalars
so JSON round-trips stay deterministic. Computed/formula values ride
read paths only and never enter stored rows.
"""

from __future__ import annotations

import secrets
from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING

from pydantic import BaseModel, ConfigDict, Field

if TYPE_CHECKING:
    from features.project_document.document import SingleSelectOption

CUSTOM_FIELD_ID_PATTERN = r"^cf_[A-Za-z0-9_-]+$"
CUSTOM_FIELD_DISPLAY_NAME_MAX = 120
CUSTOM_FIELD_DESCRIPTION_MAX = 280
CUSTOM_FIELD_KEY_MAX = 80


def normalize_display_name(value: str) -> str:
    """Canonical form for case-insensitive, trimmed name comparison.

    Used by every duplicate-name check across core + custom fields,
    option labels, room numbers, and window-type names. Frontend mirror
    lives in `frontend/.../lib/fieldDisplayNames.ts::normalizeDisplayName`.
    """
    return value.strip().casefold()


def mint_custom_field_id() -> str:
    """Single mint for `cf_*` identifiers used by dev seed / fixtures.

    Wire shape matches `CUSTOM_FIELD_ID_PATTERN`. The frontend mints via
    `generatedId("cf")` for browser-originated adds; this helper is for
    backend-side seed paths.
    """
    return f"cf_{secrets.token_hex(8)}"


# Scalar set permitted inside `RoomRow.custom`. Per-type validation
# against the field's declared `field_type` runs in
# `validate_document_references` (document.py); this alias is the JSON
# shape contract for storage / round-trip.
CustomValue = str | int | float | bool | None


class CustomFieldType(StrEnum):
    """Closed v1 set of custom field types — kept closed up front so the
    published JSON Schema is authoritative."""

    short_text = "short_text"
    long_text = "long_text"
    number = "number"
    url = "url"
    single_select = "single_select"
    formula = "formula"


class CustomFieldDef(BaseModel):
    """One user-defined field on a project-document table.

    `id` is the immutable identity — every row value, view-state column
    id, write op, and formula reference uses it. `field_key` is an
    advisory export slug; never use it for identity. `created_by`
    accepts None for fixture / dev-seed callers; the API and MCP write
    paths supply a real user id.
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


SHORT_TEXT_MAX_LENGTH = 4000


def coerce_custom_value(
    value: object,
    field_type: CustomFieldType,
    *,
    option_list: list[SingleSelectOption] | None = None,
) -> CustomValue:
    """Coerce / validate a row's `custom[cf_id]` value against its declared type.

    `option_list` is required for strict single_select validation; when
    omitted, Phase 1/2 permissive behaviour is preserved (any string id
    is accepted). Phase 3 schema-mutation and document-reference passes
    supply the resolved option list and gain the stricter check.

    Raises ValueError on a hard mismatch — caller surfaces this through
    the `invalid_project_document` error code at the validator boundary;
    Phase 3 schema-mutation services translate it into the more specific
    `custom_field_option_id_unknown` envelope.
    """
    if value is None:
        return None
    if field_type is CustomFieldType.short_text:
        if not isinstance(value, str):
            raise ValueError(f"short_text value must be a string, got {type(value).__name__}")
        if len(value) > SHORT_TEXT_MAX_LENGTH:
            raise ValueError(f"short_text value exceeds {SHORT_TEXT_MAX_LENGTH} characters")
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
        stripped = value.strip()
        if not stripped:
            return None
        # Mirror the changeType-mutation URL guard in
        # `schema_mutations._coerce_to_target` — require an explicit
        # `http://` / `https://` scheme so cell writes share the same
        # validation contract as type conversions.
        lowered = stripped.lower()
        if not (lowered.startswith("http://") or lowered.startswith("https://")):
            raise ValueError(f"url value must start with http:// or https://, got {value!r}")
        return value
    if field_type is CustomFieldType.single_select:
        if value == "":
            return None
        if not isinstance(value, str):
            raise ValueError(f"single_select value must be an option id string, got {type(value).__name__}")
        if option_list is not None and not any(option.id == value for option in option_list):
            raise ValueError(f"single_select value {value!r} is not a known option id")
        return value
    if field_type is CustomFieldType.formula:
        raise ValueError("formula custom fields are computed; stored row values are not permitted")
    raise ValueError(f"unsupported custom field type: {field_type!r}")

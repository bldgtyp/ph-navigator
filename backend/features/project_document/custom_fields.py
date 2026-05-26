"""Field-config definitions for project-document tables.

`TableFieldDef` is the closed shape of any field on a project-document
table — both built-in (feature-author-declared) and custom
(user-created). The `CustomFieldType` enum is the closed v1 type set
consumed by the JSON Schema and document validators. `CustomValue` is
the value side: each row's `custom_values` dict maps a `field_key` to
one of a narrow set of scalars so JSON round-trips stay deterministic.
Computed/formula values ride read paths only and never enter stored
rows.

`field_key` is the identity slot for both built-in and custom fields:
- Built-ins use a stable code-declared slug (`"number"`, `"name"`, …).
- Custom fields use a `cf_*` ULID-style id minted at creation time.

`origin` is persisted so feature code can find "the built-in entry for
`field_key='number'`" without re-matching by key.
"""

from __future__ import annotations

import secrets
from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING, Literal

from pydantic import BaseModel, ConfigDict, Field

if TYPE_CHECKING:
    from features.project_document.document import SingleSelectOption

# Built-ins use stable slugs (lowercase + underscores); customs use cf_*.
# The unified pattern admits both forms.
FIELD_KEY_PATTERN = r"^(cf_[A-Za-z0-9_-]+|[a-z][a-z0-9_]*)$"
FIELD_KEY_MAX = 80
FIELD_DISPLAY_NAME_MAX = 120
FIELD_DESCRIPTION_MAX = 280

# `record_id` is reserved for the Phase 2 identifier slot. Phase 1a's
# guard ships now so an MCP / REST caller cannot land a custom field
# that collides before the semantics arrive.
RESERVED_FIELD_KEY_RECORD_ID = "record_id"
RESERVED_CUSTOM_FIELD_KEYS: frozenset[str] = frozenset({RESERVED_FIELD_KEY_RECORD_ID})


FieldOrigin = Literal["built_in", "custom"]


def normalize_display_name(value: str) -> str:
    """Canonical form for case-insensitive, trimmed name comparison.

    Used by every duplicate-name check across all fields, option
    labels, room numbers, and window-type names. Frontend mirror lives
    in `frontend/.../lib/fieldDisplayNames.ts::normalizeDisplayName`.
    """
    return value.strip().casefold()


def mint_custom_field_key() -> str:
    """Single mint for `cf_*` identifiers used by dev seed / fixtures.

    Wire shape matches the custom-branch of `FIELD_KEY_PATTERN`. The
    frontend mints via `generatedId("cf")` for browser-originated adds;
    this helper is for backend-side seed paths.
    """
    return f"cf_{secrets.token_hex(8)}"


# Back-compat alias for callers still using the v2 name.
mint_custom_field_id = mint_custom_field_key


# Scalar set permitted inside `row.custom_values`. Per-type validation
# against the field's declared `field_type` runs in
# `validate_document_references` (document.py); this alias is the JSON
# shape contract for storage / round-trip.
CustomValue = str | int | float | bool | None


class CustomFieldType(StrEnum):
    """Closed v1 set of field types — kept closed up front so the
    published JSON Schema is authoritative. Used for both built-in and
    custom fields under the unified `TableFieldDef` registry."""

    short_text = "short_text"
    long_text = "long_text"
    number = "number"
    url = "url"
    single_select = "single_select"
    formula = "formula"


class TableFieldDef(BaseModel):
    """One field-config entry on a project-document table.

    Identity carrier is `field_key`. Built-ins use stable code-declared
    keys (`"number"`, `"name"`, …); customs use `cf_*` ids minted at
    creation time. `origin` records which side the entry came from.

    `default` carries the seed default value; it's coerced into rows on
    first save and on built-in field additions through
    `coerce_custom_value`.

    `locked` arrays are NOT carried here — they're a render-time overlay
    layered onto each FieldDef by the feature seed at load time
    (PRD §P3.3 / Q-F9).
    """

    model_config = ConfigDict(extra="forbid")

    field_key: str = Field(pattern=FIELD_KEY_PATTERN, max_length=FIELD_KEY_MAX)
    display_name: str = Field(min_length=1, max_length=FIELD_DISPLAY_NAME_MAX)
    field_type: CustomFieldType
    config: dict[str, object] = Field(default_factory=dict)
    description: str | None = Field(default=None, max_length=FIELD_DESCRIPTION_MAX)
    default: CustomValue = None
    origin: FieldOrigin = "custom"
    created_at: datetime
    created_by: str | None = None

    # The reserved-key guard (RESERVED_CUSTOM_FIELD_KEYS) runs in the
    # schema-mutation pipeline, where the field's `origin` is known —
    # a built-in `record_id` seed must land cleanly while custom-side
    # writes reject `field_key="record_id"`. Not enforced here.

    @property
    def id(self) -> str:
        """Deprecated alias for `field_key`. Phase 1b unified identity on
        `field_key` for both built-in and custom fields. Remove once
        every caller has migrated."""
        return self.field_key


# Back-compat aliases for callers still importing the v2 names. Remove
# once every callsite has migrated to `TableFieldDef` /
# `FIELD_KEY_PATTERN` / `FIELD_KEY_MAX`.
CustomFieldDef = TableFieldDef
CUSTOM_FIELD_ID_PATTERN = FIELD_KEY_PATTERN
CUSTOM_FIELD_KEY_MAX = FIELD_KEY_MAX
CUSTOM_FIELD_DISPLAY_NAME_MAX = FIELD_DISPLAY_NAME_MAX
CUSTOM_FIELD_DESCRIPTION_MAX = FIELD_DESCRIPTION_MAX


SHORT_TEXT_MAX_LENGTH = 4000


def coerce_custom_value(
    value: object,
    field_type: CustomFieldType,
    *,
    option_list: list[SingleSelectOption] | None = None,
) -> CustomValue:
    """Coerce / validate a row's `custom_values[field_key]` value
    against its declared type.

    `option_list` is required for strict single_select validation; when
    omitted, permissive behaviour is preserved (any string id is
    accepted).

    Raises ValueError on a hard mismatch — caller surfaces this through
    the `invalid_project_document` error code at the validator boundary;
    schema-mutation services translate it into the more specific
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
        raise ValueError("formula fields are computed; stored row values are not permitted")
    raise ValueError(f"unsupported field type: {field_type!r}")

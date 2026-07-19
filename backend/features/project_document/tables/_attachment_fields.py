"""Shared built-in FieldDefs for attachment-backed table columns."""

from __future__ import annotations

from features.project_document.custom_fields import CustomFieldType, TableFieldDef
from features.project_document.tables._built_in_seeds import built_in_field_def

DATASHEET_FIELD_KEY = "datasheet_asset_ids"
PHOTO_FIELD_KEY = "photo_asset_ids"


def datasheet_field_def() -> TableFieldDef:
    """Return the shared built-in Datasheet attachment FieldDef."""
    return built_in_field_def(
        field_key=DATASHEET_FIELD_KEY,
        display_name="Datasheet",
        field_type=CustomFieldType.long_text,
    )


def photo_field_def() -> TableFieldDef:
    """Return the shared built-in Site Photos attachment FieldDef."""
    return built_in_field_def(
        field_key=PHOTO_FIELD_KEY,
        display_name="Site Photos",
        field_type=CustomFieldType.long_text,
    )

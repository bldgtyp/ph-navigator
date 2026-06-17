"""Shared row base for FieldDef-capable project-document tables."""

from __future__ import annotations

from pydantic import BaseModel, Field

from features.project_document.custom_fields import CustomValue


class RowWithCustomFields(BaseModel):
    """Shared custom-field bags for every FieldDef-capable table row."""

    custom_values: dict[str, CustomValue] = Field(default_factory=dict)
    custom_links: dict[str, list[str]] = Field(default_factory=dict)

"""Pydantic contracts for Model tab HBJSON file management (US-VIEW-1)."""

from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

ExtractionStatus = Literal["pending", "success", "failed"]

# US-VIEW-1 crit. 10: notes are a short provenance blurb ("Round 2 model
# after slab change"), not a document.
HBJSON_NOTES_MAX_CHARS = 1000


class HbjsonFilePublic(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID
    project_id: UUID
    asset_id: str
    display_name: str
    notes: str | None
    uploaded_by: UUID
    uploaded_by_display_name: str
    uploaded_at: datetime
    # Joined from project_assets so the file popover can render
    # "{size} MB · {relative time} · {uploader}" from the list payload.
    size_bytes: int
    original_filename: str
    # D-16: drives the "Failed to parse" badge. 'pending' until the
    # link-step extraction job (model_data.run_extraction_job) completes.
    extraction_status: ExtractionStatus
    extraction_error: str | None


class HbjsonFileListResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[HbjsonFilePublic]


def _strip_required(value: object) -> object:
    if isinstance(value, str):
        return value.strip()
    return value


def _strip_optional(value: object) -> object:
    if isinstance(value, str):
        stripped = value.strip()
        return stripped or None
    return value


class HbjsonFileCreateRequest(BaseModel):
    """Link step: attach an already-uploaded hbjson asset to the viewer list."""

    model_config = ConfigDict(extra="forbid")

    asset_id: str = Field(min_length=1, max_length=200)
    display_name: str | None = Field(default=None, min_length=1, max_length=500)
    notes: str | None = Field(default=None, max_length=HBJSON_NOTES_MAX_CHARS)

    @field_validator("display_name", mode="before")
    @classmethod
    def strip_display_name(cls, value: object) -> object:
        return _strip_optional(value)

    @field_validator("notes", mode="before")
    @classmethod
    def strip_notes(cls, value: object) -> object:
        return _strip_optional(value)


class HbjsonFileUpdateRequest(BaseModel):
    """Rename and/or edit notes. `notes: null` clears the note."""

    model_config = ConfigDict(extra="forbid")

    display_name: str | None = Field(default=None, min_length=1, max_length=500)
    notes: str | None = Field(default=None, max_length=HBJSON_NOTES_MAX_CHARS)

    @field_validator("display_name", mode="before")
    @classmethod
    def strip_display_name(cls, value: object) -> object:
        return _strip_required(value)

    @field_validator("notes", mode="before")
    @classmethod
    def strip_notes(cls, value: object) -> object:
        return _strip_optional(value)

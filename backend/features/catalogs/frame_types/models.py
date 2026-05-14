"""Pydantic contracts for the Window-Frame catalog."""

from __future__ import annotations

from datetime import date, datetime
from typing import Final
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from features.catalogs._shared import (
    reject_clearing_version_date,
    strip_optional,
    strip_required,
)

CATALOG_VERSION_ID_PREFIX: Final[str] = "framev_"


class CatalogFrameTypePublic(BaseModel):
    """Bookshelf-ready frame row.

    Field shape matches US-WIN-4 criterion 3: a downstream picker copies these
    typed values into a project Window element's per-side FrameRef along with
    the `catalog_origin` block (record id, version id, schema version).
    """

    model_config = ConfigDict(extra="forbid")

    id: str
    name: str
    manufacturer: str | None
    brand: str | None
    current_version_id: str
    catalog_schema_version: int
    version_label: str
    version_date: date
    width_mm: float | None
    u_value_w_m2k: float | None
    psi_g_w_mk: float | None
    psi_install_w_mk: float | None
    argb_color: str | None
    notes: str | None
    source_provenance: str | None
    is_active: bool
    created_at: datetime
    created_by: UUID | None
    updated_at: datetime
    updated_by: UUID | None


class CatalogFrameTypeListResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[CatalogFrameTypePublic]


class _CatalogFrameTypeFields(BaseModel):
    """Shared field shape and validators for Create/Update requests."""

    model_config = ConfigDict(extra="forbid")

    manufacturer: str | None = Field(default=None, max_length=200)
    brand: str | None = Field(default=None, max_length=200)
    version_label: str | None = Field(default=None, min_length=1, max_length=80)
    version_date: date | None = None
    width_mm: float | None = None
    u_value_w_m2k: float | None = None
    psi_g_w_mk: float | None = None
    psi_install_w_mk: float | None = None
    argb_color: str | None = Field(default=None, max_length=40)
    notes: str | None = Field(default=None, max_length=4000)
    source_provenance: str | None = Field(default=None, max_length=400)

    @field_validator("manufacturer", "brand", "version_label", mode="before")
    @classmethod
    def _strip_optional_meta(cls, value: object) -> object:
        return strip_optional(value)

    @field_validator("argb_color", "notes", "source_provenance", mode="before")
    @classmethod
    def _strip_optional_text(cls, value: object) -> object:
        return strip_optional(value)

    @field_validator("width_mm", "u_value_w_m2k", "psi_g_w_mk", "psi_install_w_mk")
    @classmethod
    def _non_negative(cls, value: float | None) -> float | None:
        if value is not None and value < 0:
            raise ValueError("must be >= 0")
        return value


class CatalogFrameTypeCreateRequest(_CatalogFrameTypeFields):
    name: str = Field(min_length=1, max_length=200)
    version_label: str = Field(default="v1", min_length=1, max_length=80)

    @field_validator("name", "version_label", mode="before")
    @classmethod
    def _strip_required_fields(cls, value: object) -> object:
        return strip_required(value)


class CatalogFrameTypeUpdateRequest(_CatalogFrameTypeFields):
    """Patch identity (name) + the current version's typed fields in place.

    Per data-model.md §7.3: in-place edit allowed on the current version for
    small corrections. Creating a new version is a separate flow (deferred).
    """

    name: str | None = Field(default=None, min_length=1, max_length=200)

    @field_validator("name", mode="before")
    @classmethod
    def _strip_optional_name(cls, value: object) -> object:
        return strip_optional(value)

    @model_validator(mode="after")
    def _reject_clearing_version_date(self) -> CatalogFrameTypeUpdateRequest:
        reject_clearing_version_date(self)
        return self

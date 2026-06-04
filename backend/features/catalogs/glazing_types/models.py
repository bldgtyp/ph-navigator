"""Pydantic contracts for the Window-Glazing catalog."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from features.catalogs._shared import strip_optional, strip_required
from features.shared.colors import normalize_optional_hex_color


class CatalogGlazingTypeListItem(BaseModel):
    """List-endpoint projection: trims `created_by` / `updated_by` since no
    list view shows "edited by". The per-row detail endpoint returns the
    full audit fields via :class:`CatalogGlazingTypePublic` below.

    `extra="ignore"` so the repository row's audit columns silently drop
    on `model_validate` — the SQL query is shared between list and detail
    paths.
    """

    model_config = ConfigDict(extra="ignore")

    id: str
    name: str
    manufacturer: str | None
    brand: str | None
    suffix: str | None
    u_value_w_m2k: float | None
    g_value: float | None
    color: str | None
    source: str | None
    comments: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class CatalogGlazingTypePublic(CatalogGlazingTypeListItem):
    """Bookshelf-ready glazing row.

    Field shape matches US-WIN-4 criterion 3: a downstream picker copies
    these typed values into a project Window element's GlazingRef along
    with the `catalog_origin` block (record id).
    """

    model_config = ConfigDict(extra="forbid")

    created_by: UUID | None
    updated_by: UUID | None


class CatalogGlazingTypeListResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[CatalogGlazingTypeListItem]


class _CatalogGlazingTypeFields(BaseModel):
    """Shared field shape and validators for Create/Update requests."""

    model_config = ConfigDict(extra="forbid")

    manufacturer: str | None = Field(default=None, max_length=200)
    brand: str | None = Field(default=None, max_length=200)
    suffix: str | None = Field(default=None, max_length=80)
    u_value_w_m2k: float | None = None
    # g-value (SHGC) is a unitless fraction in [0, 1].
    g_value: float | None = Field(default=None, ge=0.0, le=1.0)
    color: str | None = Field(default=None, max_length=40)
    source: str | None = Field(default=None, max_length=400)
    comments: str | None = Field(default=None, max_length=4000)

    @field_validator("manufacturer", "brand", "suffix", "source", "comments", mode="before")
    @classmethod
    def _strip_optional_text(cls, value: object) -> object:
        return strip_optional(value)

    @field_validator("color", mode="before")
    @classmethod
    def _normalize_color(cls, value: object) -> object:
        return normalize_optional_hex_color(value)

    @field_validator("u_value_w_m2k")
    @classmethod
    def _non_negative(cls, value: float | None) -> float | None:
        if value is not None and value < 0:
            raise ValueError("must be >= 0")
        return value


class CatalogGlazingTypeCreateRequest(_CatalogGlazingTypeFields):
    name: str = Field(min_length=1, max_length=200)

    @field_validator("name", mode="before")
    @classmethod
    def _strip_required_name(cls, value: object) -> object:
        return strip_required(value)


class CatalogGlazingTypeUpdateRequest(_CatalogGlazingTypeFields):
    """Patch identity (name) + the typed fields in place."""

    name: str | None = Field(default=None, min_length=1, max_length=200)

    @field_validator("name", mode="before")
    @classmethod
    def _strip_optional_name(cls, value: object) -> object:
        return strip_optional(value)

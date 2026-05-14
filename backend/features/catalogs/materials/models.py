"""Pydantic contracts for the Materials catalog."""

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

CATALOG_VERSION_ID_PREFIX: Final[str] = "matv_"


class CatalogMaterialPublic(BaseModel):
    """Bookshelf-ready material row.

    The shape includes everything a downstream project picker needs to
    construct a `catalog_origin` block (record id, version id, schema
    version) plus the typed value fields copied at pick time.
    """

    model_config = ConfigDict(extra="forbid")

    id: str
    name: str
    category: str
    current_version_id: str
    catalog_schema_version: int
    version_label: str
    version_date: date
    conductivity_w_mk: float | None
    density_kg_m3: float | None
    specific_heat_j_kgk: float | None
    emissivity: float | None
    argb_color: str | None
    notes: str | None
    source_provenance: str | None
    is_active: bool
    created_at: datetime
    created_by: UUID | None
    updated_at: datetime
    updated_by: UUID | None


class CatalogMaterialListResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[CatalogMaterialPublic]


class _CatalogMaterialFields(BaseModel):
    """Shared field shape and validators for Create/Update requests.

    Subclasses redeclare `name` and `category` to flip required vs optional
    without restating the rest of the value-field set or the validators.
    """

    model_config = ConfigDict(extra="forbid")

    version_label: str | None = Field(default=None, min_length=1, max_length=80)
    version_date: date | None = None
    conductivity_w_mk: float | None = None
    density_kg_m3: float | None = None
    specific_heat_j_kgk: float | None = None
    emissivity: float | None = Field(default=None, ge=0.0, le=1.0)
    argb_color: str | None = Field(default=None, max_length=40)
    notes: str | None = Field(default=None, max_length=4000)
    source_provenance: str | None = Field(default=None, max_length=400)

    @field_validator("version_label", mode="before")
    @classmethod
    def _strip_optional_label(cls, value: object) -> object:
        return strip_optional(value)

    @field_validator("argb_color", "notes", "source_provenance", mode="before")
    @classmethod
    def _strip_optional_fields(cls, value: object) -> object:
        return strip_optional(value)

    @field_validator("conductivity_w_mk", "density_kg_m3", "specific_heat_j_kgk")
    @classmethod
    def _non_negative(cls, value: float | None) -> float | None:
        if value is not None and value < 0:
            raise ValueError("must be >= 0")
        return value


class CatalogMaterialCreateRequest(_CatalogMaterialFields):
    name: str = Field(min_length=1, max_length=200)
    category: str = Field(min_length=1, max_length=120)
    version_label: str = Field(default="v1", min_length=1, max_length=80)

    @field_validator("name", "category", "version_label", mode="before")
    @classmethod
    def _strip_required_fields(cls, value: object) -> object:
        return strip_required(value)


class CatalogMaterialUpdateRequest(_CatalogMaterialFields):
    """Patch the identity row (name/category) and the current version's typed fields in place.

    Per data-model.md §7.3: in-place edit allowed on the current version for
    small corrections. Creating a new version is a separate flow (deferred).
    """

    name: str | None = Field(default=None, min_length=1, max_length=200)
    category: str | None = Field(default=None, min_length=1, max_length=120)

    @field_validator("name", "category", mode="before")
    @classmethod
    def _strip_optional_identity(cls, value: object) -> object:
        return strip_optional(value)

    @model_validator(mode="after")
    def _reject_clearing_version_date(self) -> CatalogMaterialUpdateRequest:
        reject_clearing_version_date(self)
        return self

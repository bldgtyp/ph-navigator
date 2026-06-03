"""Pydantic contracts for the Materials catalog."""

from __future__ import annotations

from datetime import datetime
from typing import Final, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from features.catalogs._shared import strip_optional, strip_required
from features.shared.colors import normalize_optional_hex_color

# Fixed twelve-option set. Edits here flow to the Alembic CHECK constraint and
# the frontend overlay; keep all three in sync.
MATERIAL_CATEGORY_IDS: Final[tuple[str, ...]] = (
    "insulation",
    "finishes",
    "woods",
    "metals",
    "masonry",
    "stud_layers_steel",
    "stud_layers_wood",
    "air_horizontal_heat_flow",
    "air_upward_heat_flow",
    "air_downward_heat_flow",
    "rainscreen_insulation",
    "doors",
)

MaterialCategoryId = Literal[
    "insulation",
    "finishes",
    "woods",
    "metals",
    "masonry",
    "stud_layers_steel",
    "stud_layers_wood",
    "air_horizontal_heat_flow",
    "air_upward_heat_flow",
    "air_downward_heat_flow",
    "rainscreen_insulation",
    "doors",
]


class CatalogMaterialPublic(BaseModel):
    """Bookshelf-ready material row.

    One row per material — the per-version layer was dropped in
    Alembic 20260603_0015 because the envelope pick command snapshots
    values into the project document at pick time (see
    ``features/envelope/commands/materials.py``), so the catalog never
    needed history.
    """

    model_config = ConfigDict(extra="forbid")

    id: str
    name: str
    category: MaterialCategoryId
    density_kg_m3: float | None
    specific_heat_j_kgk: float | None
    conductivity_w_mk: float | None
    emissivity: float | None
    color: str | None
    source: str | None
    url: str | None
    comments: str | None
    is_active: bool
    created_at: datetime
    created_by: UUID | None
    updated_at: datetime
    updated_by: UUID | None


class CatalogMaterialListResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[CatalogMaterialPublic]


class _CatalogMaterialFields(BaseModel):
    """Shared field shape and validators for Create/Update requests."""

    model_config = ConfigDict(extra="forbid")

    density_kg_m3: float | None = None
    specific_heat_j_kgk: float | None = None
    conductivity_w_mk: float | None = None
    emissivity: float | None = Field(default=None, ge=0.0, le=1.0)
    color: str | None = Field(default=None, max_length=40)
    source: str | None = Field(default=None, max_length=400)
    url: str | None = Field(default=None, max_length=2000)
    comments: str | None = Field(default=None, max_length=4000)

    @field_validator("source", "url", "comments", mode="before")
    @classmethod
    def _strip_optional_text(cls, value: object) -> object:
        return strip_optional(value)

    @field_validator("color", mode="before")
    @classmethod
    def _normalize_color(cls, value: object) -> object:
        return normalize_optional_hex_color(value)

    @field_validator("density_kg_m3", "specific_heat_j_kgk", "conductivity_w_mk")
    @classmethod
    def _non_negative(cls, value: float | None) -> float | None:
        if value is not None and value < 0:
            raise ValueError("must be >= 0")
        return value


class CatalogMaterialCreateRequest(_CatalogMaterialFields):
    name: str = Field(min_length=1, max_length=200)
    category: MaterialCategoryId

    @field_validator("name", mode="before")
    @classmethod
    def _strip_name(cls, value: object) -> object:
        return strip_required(value)


class CatalogMaterialUpdateRequest(_CatalogMaterialFields):
    """In-place patch of any catalog field. Omitted fields are unchanged."""

    name: str | None = Field(default=None, min_length=1, max_length=200)
    category: MaterialCategoryId | None = None

    @field_validator("name", mode="before")
    @classmethod
    def _strip_name(cls, value: object) -> object:
        return strip_optional(value)

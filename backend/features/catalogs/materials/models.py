"""Pydantic contracts for the Materials catalog."""

from __future__ import annotations

from datetime import datetime
from typing import Final, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from features.catalogs._shared import strip_optional, strip_required
from features.shared.colors import normalize_optional_hex_color

# Fixed thirteen-option set. Edits here flow to the Alembic CHECK constraint and
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
    "membrane",
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
    "membrane",
]

# Sheet goods and coatings — WRBs, vapour-control layers, self-adhered
# flashings, paints. The canonical statement of what this category means,
# and the only place the rationale lives:
#
# Layers built from these materials are excluded from the R calculation
# outright (`features/envelope/thermal.py:is_membrane_layer`) rather than
# contributing a near-zero R. A 6-mil poly sheet is ~0.0005 m2K/W, four
# orders of magnitude below a typical assembly; omitting it is simpler,
# marginally conservative (slightly higher U), and matches PHPP, which
# does not enter membranes on the U-Values worksheet either.
#
# Envelope imports this rather than defining its own copy so the DB CHECK
# constraint, the picker overlay, and the thermal exclusion cannot drift
# apart. See `planning/archive/dated/2026-07-26/assembly-membrane-layers/PRD.md` §3.
MEMBRANE_CATEGORY_ID: Final[str] = "membrane"


class CatalogMaterialListItem(BaseModel):
    """List-endpoint projection: the fields the catalog UI actually
    renders. Drops `created_by` / `updated_by` since no list view shows
    "edited by"; on the 410-row fixture this trims ~20% of the
    uncompressed payload. The per-row detail endpoint
    (``GET /catalogs/materials/{id}``) returns the full audit fields via
    :class:`CatalogMaterialPublic` below.

    `extra="ignore"` rather than `"forbid"` so the repository row's
    audit columns silently drop on `model_validate` — the SQL query is
    shared between list and detail paths.
    """

    model_config = ConfigDict(extra="ignore")

    id: str
    name: str
    category: MaterialCategoryId
    density_kg_m3: float | None
    specific_heat_j_kgk: float | None
    conductivity_w_mk: float | None
    emissivity: float | None
    air_permeance_l_s_m2_at_75pa: float | None
    color: str | None
    source: str | None
    url: str | None
    comments: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class CatalogMaterialPublic(CatalogMaterialListItem):
    """Per-row detail. Extends the list projection with audit user refs.

    One row per material — the per-version layer was dropped in
    Alembic 20260603_0015 because the envelope pick command snapshots
    values into the project document at pick time (see
    ``features/envelope/commands/materials.py``), so the catalog never
    needed history.
    """

    model_config = ConfigDict(extra="forbid")

    created_by: UUID | None
    updated_by: UUID | None


class CatalogMaterialListResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[CatalogMaterialListItem]


class _CatalogMaterialFields(BaseModel):
    """Shared field shape and validators for Create/Update requests."""

    model_config = ConfigDict(extra="forbid")

    density_kg_m3: float | None = None
    specific_heat_j_kgk: float | None = None
    conductivity_w_mk: float | None = None
    emissivity: float | None = Field(default=None, ge=0.0, le=1.0)
    # ASTM E2178 air permeance, in the unit datasheets report it in:
    # L/(s*m2) at 75 Pa. The air-barrier material criterion is <= 0.02.
    air_permeance_l_s_m2_at_75pa: float | None = None
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

    @field_validator(
        "density_kg_m3",
        "specific_heat_j_kgk",
        "conductivity_w_mk",
        "air_permeance_l_s_m2_at_75pa",
    )
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

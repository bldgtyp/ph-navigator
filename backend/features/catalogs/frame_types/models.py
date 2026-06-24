"""Pydantic contracts for the Window-Frame catalog."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from features.catalogs._shared import strip_optional
from features.project_document.rows import SingleSelectOption
from features.shared.colors import normalize_optional_hex_color

# Soft-enum text fields (PRD D4): UI surfaces suggestions, server stores any
# string. Promotion to strict single_select is deferred until the AirTable
# seed lands and the real option distribution is observable.
_SOFT_ENUM_MAX = 40
_CODE_MAX = 80


class CatalogFrameTypeListItem(BaseModel):
    """List-endpoint projection: trims `created_by` / `updated_by` since no
    list view shows "edited by". The per-row detail endpoint returns the
    full audit fields via :class:`CatalogFrameTypePublic` below.

    `extra="ignore"` so the repository row's audit columns silently drop
    on `model_validate` — the SQL query is shared between list and detail
    paths.
    """

    model_config = ConfigDict(extra="ignore")

    id: str
    name: str
    manufacturer: str | None
    brand: str | None
    use: str | None
    operation: str | None
    location: str | None
    mull_type: str | None
    prefix: str | None
    suffix: str | None
    material: str | None
    width_mm: float | None
    u_value_w_m2k: float | None
    psi_g_w_mk: float | None
    psi_install_w_mk: float | None
    color: str | None
    source: str | None
    datasheet_url: str | None
    comments: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class CatalogFrameTypePublic(CatalogFrameTypeListItem):
    """Bookshelf-ready frame row.

    Field shape matches US-WIN-4 criterion 3: a downstream picker copies
    these typed values into a project Window element's per-side FrameRef
    along with the `catalog_origin` block (record id).
    """

    model_config = ConfigDict(extra="forbid")

    created_by: UUID | None
    updated_by: UUID | None


class CatalogFrameTypeListResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[CatalogFrameTypeListItem]


class _CatalogFrameTypeFields(BaseModel):
    """Shared field shape and validators for Create/Update requests."""

    model_config = ConfigDict(extra="forbid")

    manufacturer: str | None = Field(default=None, max_length=200)
    brand: str | None = Field(default=None, max_length=200)
    use: str | None = Field(default=None, max_length=_SOFT_ENUM_MAX)
    operation: str | None = Field(default=None, max_length=_SOFT_ENUM_MAX)
    location: str | None = Field(default=None, max_length=_SOFT_ENUM_MAX)
    mull_type: str | None = Field(default=None, max_length=_SOFT_ENUM_MAX)
    prefix: str | None = Field(default=None, max_length=_CODE_MAX)
    suffix: str | None = Field(default=None, max_length=_CODE_MAX)
    material: str | None = Field(default=None, max_length=_CODE_MAX)
    width_mm: float | None = None
    u_value_w_m2k: float | None = None
    psi_g_w_mk: float | None = None
    psi_install_w_mk: float | None = None
    color: str | None = Field(default=None, max_length=40)
    source: str | None = Field(default=None, max_length=400)
    datasheet_url: str | None = Field(default=None, max_length=400)
    comments: str | None = Field(default=None, max_length=4000)

    @field_validator(
        "manufacturer",
        "brand",
        "use",
        "operation",
        "location",
        "mull_type",
        "prefix",
        "suffix",
        "material",
        "source",
        "datasheet_url",
        "comments",
        mode="before",
    )
    @classmethod
    def _strip_optional_text(cls, value: object) -> object:
        return strip_optional(value)

    @field_validator("color", mode="before")
    @classmethod
    def _normalize_color(cls, value: object) -> object:
        return normalize_optional_hex_color(value)

    @field_validator("width_mm", "u_value_w_m2k", "psi_g_w_mk", "psi_install_w_mk")
    @classmethod
    def _non_negative(cls, value: float | None) -> float | None:
        if value is not None and value < 0:
            raise ValueError("must be >= 0")
        return value


class CatalogFrameTypeCreateRequest(_CatalogFrameTypeFields):
    """Create payload. ``name`` is **server-derived** from the parts (D-3), so it
    is not accepted here — sending one is rejected by ``extra="forbid"``."""


class CatalogFrameTypeUpdateRequest(_CatalogFrameTypeFields):
    """Patch the typed fields in place. ``name`` is derived and recomputed
    server-side whenever a name-part changes; an inbound ``name`` is rejected."""


# --------------------------------------------------------------------------- #
# Single-select option store (catalog_field_options) — see _options_repository.
# The generic ``CatalogFieldOptionsResponse`` / ``EditCatalogOptionsRequest``
# DTOs live in ``features.catalogs._shared`` (shared across catalogs); only the
# frame-specific "all fields at once" aggregate lives here.
# --------------------------------------------------------------------------- #


class CatalogFrameTypeOptionsResponse(BaseModel):
    """All six frame-type fields' option lists in one fetch (one round-trip for
    the whole grid). Keyed by ``field_key`` (e.g. ``manufacturer``)."""

    model_config = ConfigDict(extra="forbid")

    fields: dict[str, list[SingleSelectOption]]

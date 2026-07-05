"""Envelope (assemblies + apertures + materials) Pydantic schemas.

Split out of ``document.py`` so the central ``ProjectDocumentV1`` module
can focus on cross-table invariants. ``CatalogOrigin`` and the per-ref
family-check helper live here too because every consumer
(``FrameRef``, ``GlazingRef``, ``ProjectMaterial``) is in this file.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from features.project_document._validators import (
    validate_contiguous_orders,
    validate_unique_ids,
)
from features.shared.colors import normalize_optional_hex_color

CatalogTableName = Literal["materials", "frame_types", "glazing_types"]
CATALOG_RECORD_ID_PATTERN = r"^rec[A-Za-z0-9]{14}$"
CATALOG_VERSION_ID_PATTERN = r"^(matv|framev|glazingv)_[A-Za-z0-9_-]+$"
AssemblyType = Literal["wall", "floor", "roof", "other"]
AssemblyOrientation = Literal["first_layer_outside", "last_layer_outside"]
SpecificationStatus = Literal["complete", "missing", "question", "na"]

APERTURE_DEFAULT_FRAME_NAME = "PHN-Default-Frame"
APERTURE_DEFAULT_GLAZING_NAME = "PHN-Default-Glass"

# Deterministic sentinel ids of the built-in default catalog rows (seeded by
# migration 20260605_0018). The default frame/glazing are resolved by **id**,
# not name: frame `name` is now derived from its parts (D-3) and the all-null
# sentinel composes to an empty string, so a name lookup would fail.
APERTURE_DEFAULT_FRAME_ID = "recPHNDefFrame001"
APERTURE_DEFAULT_GLAZING_ID = "recPHNDefGlazng01"

ApertureOperationType = Literal["swing", "slide"]
ApertureOperationDirection = Literal["left", "right", "up", "down"]


class CatalogOrigin(BaseModel):
    """Bookshelf-copy provenance stamped at pick time."""

    model_config = ConfigDict(extra="forbid")

    catalog_table: CatalogTableName
    catalog_record_id: str = Field(pattern=CATALOG_RECORD_ID_PATTERN)
    # ``catalog_version_id`` / ``catalog_schema_version`` are legacy fields
    # from the per-version row layer. All v1 catalogs (materials, glazing,
    # frames) are now flat; new origins leave ``catalog_version_id`` null
    # and may stamp ``catalog_schema_version=1`` (e.g. default aperture
    # refs). Both stay nullable on the model so older documents that
    # carry neither — or that still carry a stamped version id — round-
    # trip cleanly.
    catalog_version_id: str | None = Field(default=None, pattern=CATALOG_VERSION_ID_PATTERN)
    catalog_schema_version: int | None = Field(default=None, ge=1)
    synced_at: datetime
    local_overrides: list[str] = Field(default_factory=list)


def require_catalog_origin_family(
    origin: CatalogOrigin | None,
    *,
    expected_table: CatalogTableName,
    expected_version_prefix: str | None,
) -> None:
    if origin is None:
        return
    if origin.catalog_table != expected_table:
        raise ValueError(f"catalog_origin.catalog_table must be {expected_table!r}, got {origin.catalog_table!r}")
    version_id = origin.catalog_version_id
    if expected_version_prefix is None:
        # Catalogs without a version layer (materials) must not stamp a
        # version id; surface that mismatch instead of silently ignoring it.
        if version_id is not None:
            raise ValueError(f"catalog_origin.catalog_version_id must be null for {expected_table!r}")
        return
    if version_id is None or not version_id.startswith(expected_version_prefix):
        raise ValueError(f"catalog_origin.catalog_version_id must start with {expected_version_prefix!r}")


class FrameRef(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=200)
    manufacturer: str | None = Field(default=None, max_length=200)
    brand: str | None = Field(default=None, max_length=200)
    use: str | None = Field(default=None, max_length=40)
    operation: str | None = Field(default=None, max_length=40)
    location: str | None = Field(default=None, max_length=40)
    mull_type: str | None = Field(default=None, max_length=40)
    prefix: str | None = Field(default=None, max_length=80)
    suffix: str | None = Field(default=None, max_length=80)
    material: str | None = Field(default=None, max_length=80)
    width_mm: float | None = Field(default=None, ge=0)
    u_value_w_m2k: float | None = Field(default=None, ge=0)
    psi_g_w_mk: float | None = Field(default=None, ge=0)
    psi_install_w_mk: float | None = Field(default=None, ge=0)
    color: str | None = Field(default=None, max_length=40)
    source: str | None = Field(default=None, max_length=400)
    datasheet_url: str | None = Field(default=None, max_length=400)
    comments: str | None = Field(default=None, max_length=4000)
    catalog_origin: CatalogOrigin | None = None

    @field_validator("color", mode="before")
    @classmethod
    def _normalize_color(cls, value: object) -> object:
        return normalize_optional_hex_color(value)

    @model_validator(mode="after")
    def _validate_catalog_origin_family(self) -> FrameRef:
        require_catalog_origin_family(
            self.catalog_origin,
            expected_table="frame_types",
            expected_version_prefix=None,
        )
        return self


class GlazingRef(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=200)
    manufacturer: str | None = Field(default=None, max_length=200)
    brand: str | None = Field(default=None, max_length=200)
    suffix: str | None = Field(default=None, max_length=80)
    u_value_w_m2k: float | None = Field(default=None, ge=0)
    g_value: float | None = Field(default=None, ge=0.0, le=1.0)
    color: str | None = Field(default=None, max_length=40)
    source: str | None = Field(default=None, max_length=400)
    datasheet_url: str | None = Field(default=None, max_length=400)
    comments: str | None = Field(default=None, max_length=4000)
    catalog_origin: CatalogOrigin | None = None

    @field_validator("color", mode="before")
    @classmethod
    def _normalize_color(cls, value: object) -> object:
        return normalize_optional_hex_color(value)

    @model_validator(mode="after")
    def _validate_catalog_origin_family(self) -> GlazingRef:
        require_catalog_origin_family(
            self.catalog_origin,
            expected_table="glazing_types",
            expected_version_prefix=None,
        )
        return self


class AssemblySegment(BaseModel):
    """A side-by-side material slot inside one assembly layer."""

    model_config = ConfigDict(extra="forbid")

    id: str = Field(pattern=r"^seg_[A-Za-z0-9_-]+$", max_length=80)
    order: int = Field(ge=0)
    width_mm: float = Field(gt=0, allow_inf_nan=False)
    is_continuous_insulation: bool = False
    steel_stud_spacing_mm: float | None = Field(default=None, gt=0, allow_inf_nan=False)
    project_material_id: str | None = Field(default=None, pattern=r"^pmat_[A-Za-z0-9_-]+$", max_length=80)
    photo_asset_ids: list[str] = Field(default_factory=list)
    use_site_notes: str | None = Field(default=None, max_length=4000)

    @field_validator("use_site_notes", mode="before")
    @classmethod
    def _strip_optional_notes(cls, value: object) -> object:
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value


class AssemblyLayer(BaseModel):
    """One ordered horizontal strip in an assembly cross-section."""

    model_config = ConfigDict(extra="forbid")

    id: str = Field(pattern=r"^lyr_[A-Za-z0-9_-]+$", max_length=80)
    order: int = Field(ge=0)
    thickness_mm: float = Field(gt=0, allow_inf_nan=False)
    segments: list[AssemblySegment] = Field(min_length=1)

    @model_validator(mode="after")
    def _validate_segments(self) -> AssemblyLayer:
        validate_unique_ids("segment", [segment.id for segment in self.segments])
        validate_contiguous_orders("segment", [(segment.id, segment.order) for segment in self.segments])
        return self


class Assembly(BaseModel):
    """A project-owned opaque construction assembly."""

    model_config = ConfigDict(extra="forbid")

    id: str = Field(pattern=r"^asm_[A-Za-z0-9_-]+$", max_length=80)
    name: str = Field(min_length=1, max_length=200)
    type: AssemblyType
    orientation: AssemblyOrientation
    layers: list[AssemblyLayer] = Field(min_length=1)

    @field_validator("name", mode="before")
    @classmethod
    def _strip_name(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip()
        return value

    @model_validator(mode="after")
    def _validate_layers(self) -> Assembly:
        validate_unique_ids("layer", [layer.id for layer in self.layers])
        validate_contiguous_orders("layer", [(layer.id, layer.order) for layer in self.layers])
        return self

    def layers_outside_to_inside(self) -> list[AssemblyLayer]:
        """Layers ordered outside→inside, honoring ``orientation``.

        The stored `order` runs first→last; `last_layer_outside` means the last
        stored layer faces outdoors, so the list is reversed. This ordering rule
        is a property of the assembly, shared by every serializer (HBJSON web
        download and the Grasshopper export) so they can never drift.
        """
        ordered = sorted(self.layers, key=lambda layer: layer.order)
        return list(reversed(ordered)) if self.orientation == "last_layer_outside" else ordered


class ProjectMaterial(BaseModel):
    """A project-owned material/product record referenced by segments.

    Catalog-sourced fields mirror ``CatalogMaterialPublic``; the project
    side adds ``id``, ``specification_status``, ``datasheet_asset_ids``,
    and ``catalog_origin``.
    """

    model_config = ConfigDict(extra="forbid")

    id: str = Field(pattern=r"^pmat_[A-Za-z0-9_-]+$", max_length=80)
    name: str = Field(min_length=1, max_length=200)
    category: str = Field(min_length=1, max_length=120)
    density_kg_m3: float | None = Field(default=None, ge=0, allow_inf_nan=False)
    specific_heat_j_kgk: float | None = Field(default=None, ge=0, allow_inf_nan=False)
    conductivity_w_mk: float | None = Field(default=None, gt=0, allow_inf_nan=False)
    emissivity: float | None = Field(default=None, ge=0, le=1, allow_inf_nan=False)
    color: str | None = Field(default=None, max_length=40)
    source: str | None = Field(default=None, max_length=400)
    url: str | None = Field(default=None, max_length=2000)
    comments: str | None = Field(default=None, max_length=4000)
    specification_status: SpecificationStatus = "missing"
    datasheet_asset_ids: list[str] = Field(default_factory=list)
    catalog_origin: CatalogOrigin | None = None

    @field_validator("name", "category", mode="before")
    @classmethod
    def _strip_required_strings(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip()
        return value

    @field_validator("source", "url", "comments", mode="before")
    @classmethod
    def _strip_optional_text(cls, value: object) -> object:
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value

    @field_validator("color", mode="before")
    @classmethod
    def _normalize_color(cls, value: object) -> object:
        return normalize_optional_hex_color(value)

    @model_validator(mode="after")
    def _validate_catalog_origin_family(self) -> ProjectMaterial:
        require_catalog_origin_family(
            self.catalog_origin,
            expected_table="materials",
            expected_version_prefix=None,
        )
        return self


class ProjectGlazing(BaseModel):
    """A project-owned glazing product referenced by aperture elements."""

    model_config = ConfigDict(extra="forbid")

    id: str = Field(pattern=r"^pglz_[A-Za-z0-9_-]+$", max_length=80)
    name: str = Field(min_length=1, max_length=200)
    manufacturer: str | None = Field(default=None, max_length=200)
    brand: str | None = Field(default=None, max_length=200)
    suffix: str | None = Field(default=None, max_length=80)
    u_value_w_m2k: float | None = Field(default=None, ge=0, allow_inf_nan=False)
    g_value: float | None = Field(default=None, ge=0.0, le=1.0, allow_inf_nan=False)
    color: str | None = Field(default=None, max_length=40)
    source: str | None = Field(default=None, max_length=400)
    comments: str | None = Field(default=None, max_length=4000)
    specification_status: SpecificationStatus = "missing"
    datasheet_asset_ids: list[str] = Field(default_factory=list)
    catalog_origin: CatalogOrigin | None = None

    @field_validator("name", mode="before")
    @classmethod
    def _strip_required_strings(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip()
        return value

    @field_validator("manufacturer", "brand", "suffix", "source", "comments", mode="before")
    @classmethod
    def _strip_optional_text(cls, value: object) -> object:
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value

    @field_validator("color", mode="before")
    @classmethod
    def _normalize_color(cls, value: object) -> object:
        return normalize_optional_hex_color(value)

    @model_validator(mode="after")
    def _validate_catalog_origin_family(self) -> ProjectGlazing:
        require_catalog_origin_family(
            self.catalog_origin,
            expected_table="glazing_types",
            expected_version_prefix=None,
        )
        return self


class ProjectFrame(BaseModel):
    """A project-owned frame product referenced by aperture frame slots."""

    model_config = ConfigDict(extra="forbid")

    id: str = Field(pattern=r"^pfrm_[A-Za-z0-9_-]+$", max_length=80)
    name: str = Field(min_length=1, max_length=200)
    manufacturer: str | None = Field(default=None, max_length=200)
    brand: str | None = Field(default=None, max_length=200)
    use: str | None = Field(default=None, max_length=40)
    operation: str | None = Field(default=None, max_length=40)
    location: str | None = Field(default=None, max_length=40)
    mull_type: str | None = Field(default=None, max_length=40)
    prefix: str | None = Field(default=None, max_length=80)
    suffix: str | None = Field(default=None, max_length=80)
    material: str | None = Field(default=None, max_length=80)
    width_mm: float | None = Field(default=None, ge=0, allow_inf_nan=False)
    u_value_w_m2k: float | None = Field(default=None, ge=0, allow_inf_nan=False)
    psi_g_w_mk: float | None = Field(default=None, ge=0, allow_inf_nan=False)
    psi_install_w_mk: float | None = Field(default=None, ge=0, allow_inf_nan=False)
    color: str | None = Field(default=None, max_length=40)
    source: str | None = Field(default=None, max_length=400)
    comments: str | None = Field(default=None, max_length=4000)
    specification_status: SpecificationStatus = "missing"
    datasheet_asset_ids: list[str] = Field(default_factory=list)
    catalog_origin: CatalogOrigin | None = None

    @field_validator("name", mode="before")
    @classmethod
    def _strip_required_strings(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip()
        return value

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
        "comments",
        mode="before",
    )
    @classmethod
    def _strip_optional_text(cls, value: object) -> object:
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value

    @field_validator("color", mode="before")
    @classmethod
    def _normalize_color(cls, value: object) -> object:
        return normalize_optional_hex_color(value)

    @model_validator(mode="after")
    def _validate_catalog_origin_family(self) -> ProjectFrame:
        require_catalog_origin_family(
            self.catalog_origin,
            expected_table="frame_types",
            expected_version_prefix=None,
        )
        return self


class ApertureOperation(BaseModel):
    """Aperture-element operation (Fixed when omitted at the element level).

    `swing` (hinge) and `slide` (track) are the two parametric families.
    `directions` is the per-leaf set of hinge or slide directions. Multiple
    directions remain valid for compound operations such as tilt-turn.
    """

    model_config = ConfigDict(extra="forbid")

    type: ApertureOperationType
    directions: list[ApertureOperationDirection] = Field(default_factory=list)

    @model_validator(mode="after")
    def _validate_directions(self) -> ApertureOperation:
        if len(self.directions) != len(set(self.directions)):
            raise ValueError("ApertureOperation.directions must be unique")
        return self


class ApertureElementFrames(BaseModel):
    """Four-sided per-element frame slots (top/right/bottom/left)."""

    model_config = ConfigDict(extra="forbid")

    top: str | None = Field(default=None, pattern=r"^pfrm_[A-Za-z0-9_-]+$", max_length=80)
    right: str | None = Field(default=None, pattern=r"^pfrm_[A-Za-z0-9_-]+$", max_length=80)
    bottom: str | None = Field(default=None, pattern=r"^pfrm_[A-Za-z0-9_-]+$", max_length=80)
    left: str | None = Field(default=None, pattern=r"^pfrm_[A-Za-z0-9_-]+$", max_length=80)


class ApertureElement(BaseModel):
    """One sash inside an aperture type, spanning a contiguous grid rectangle.

    `name` defaults to "Unnamed" so newly created elements are valid
    without an explicit label; empty / whitespace-only names are rejected
    at validation time. `operation=None` means Fixed. `row_span` /
    `column_span` are inclusive on both ends; coverage of the aperture
    grid is enforced by `check_aperture_coverage` (no holes, no overlaps).
    """

    model_config = ConfigDict(extra="forbid")

    id: str = Field(pattern=r"^aptel_[A-Za-z0-9_-]+$", max_length=80)
    name: str = Field(default="Unnamed", min_length=1, max_length=200)
    row_span: tuple[int, int]
    column_span: tuple[int, int]
    frames: ApertureElementFrames = Field(default_factory=ApertureElementFrames)
    glazing_id: str | None = Field(default=None, pattern=r"^pglz_[A-Za-z0-9_-]+$", max_length=80)
    operation: ApertureOperation | None = None

    @field_validator("name", mode="before")
    @classmethod
    def _strip_name(cls, value: object) -> object:
        if isinstance(value, str):
            stripped = value.strip()
            if not stripped:
                raise ValueError("ApertureElement.name must not be empty")
            return stripped
        return value

    @field_validator("row_span", "column_span")
    @classmethod
    def _validate_span(cls, value: tuple[int, int]) -> tuple[int, int]:
        start, end = value
        if start < 0 or end < 0:
            raise ValueError("span indices must be >= 0")
        if start > end:
            raise ValueError("span start must be <= end")
        return value


class ApertureTypeEntry(BaseModel):
    """A named aperture type — grid + element layout + per-element refs.

    The `coverage invariant` is enforced here: every grid cell
    `(r, c)` for `0 <= r < R`, `0 <= c < C` must be covered by exactly
    one element. Holes and overlaps both raise validation errors. The
    pure check lives in `apertures/coverage.py` so the merge/split and
    add-row/add-column command handlers (later phases) can reuse it.
    """

    model_config = ConfigDict(extra="forbid")

    id: str = Field(pattern=r"^apt_[A-Za-z0-9_-]+$", max_length=80)
    name: str = Field(min_length=1, max_length=200)
    row_heights_mm: list[float] = Field(min_length=1)
    column_widths_mm: list[float] = Field(min_length=1)
    elements: list[ApertureElement] = Field(min_length=1)

    @field_validator("name", mode="before")
    @classmethod
    def _strip_name(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip()
        return value

    @field_validator("row_heights_mm", "column_widths_mm")
    @classmethod
    def _positive_dimensions(cls, value: list[float]) -> list[float]:
        for dim in value:
            if dim <= 0:
                raise ValueError("grid dimensions must be > 0")
        return value

    @model_validator(mode="after")
    def _validate_coverage(self) -> ApertureTypeEntry:
        # Lazy-import to keep the coverage check independent of the
        # document module — apertures/coverage.py imports
        # `ApertureTypeEntry` for typing, so a top-level import would
        # cycle.
        from features.project_document.apertures.coverage import check_aperture_coverage

        check_aperture_coverage(self)
        return self

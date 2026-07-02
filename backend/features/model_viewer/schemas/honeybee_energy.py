"""Pydantic mirrors of honeybee_energy constructions and materials.

D-12: constructions serialize all four thermal fields, for opaque AND
window constructions, LBT-verbatim — `*_factor` includes standard air-film
resistances (EN673/ISO10292), `*_value` is material layers only. No
relabeling on the wire; the frontend inspector shows both rows.

Opaque construction detail ships as a deduplicated top-level
`constructions` map on the combined artifact (construction-detail D-2):
each unique construction appears once as a `DetailedOpaqueConstructionSchema`
with full layer/segment/color data, while every face carries only the thin
`FaceConstructionSummarySchema` and keys into the map by `identifier`.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class PhColorSchema(BaseModel):
    """honeybee_ph_utils.color.PhColor — the material's ARGB swatch."""

    a: int
    r: int
    g: int
    b: int


class DivisionCellSchema(BaseModel):
    """One cell of a framed layer's division grid, with its own material."""

    row: int
    column: int
    material: ConstructionMaterialSchema


class DivisionGridSchema(BaseModel):
    """honeybee-ph material divisions: a framed layer's cell grid.

    Empty `column_widths`/`cells` means the layer is homogeneous (flat
    honeybee material). Widths/heights are meters, as authored.
    """

    column_widths: list[float] = Field(default_factory=list)
    row_heights: list[float] = Field(default_factory=list)
    steel_stud_spacing_mm: float | None = None
    cells: list[DivisionCellSchema] = Field(default_factory=list)


class PhMaterialPropertiesSchema(BaseModel):
    """The `properties.ph` extension data on an EnergyMaterial.

    `ph_color` is optional — homogenized layers (e.g. a steel-stud layer's
    outer material) may carry none; the frontend falls back to a neutral
    fill (construction-detail D-6).
    """

    ph_color: PhColorSchema | None = None
    divisions: DivisionGridSchema = Field(default_factory=DivisionGridSchema)


class MaterialPropertiesSchema(BaseModel):
    """EnergyMaterial `properties` — only the `ph` extension is consumed."""

    ph: PhMaterialPropertiesSchema | None = None


class ConstructionMaterialSchema(BaseModel):
    """honeybee_energy.material.opaque.EnergyMaterial + honeybee-ph props.

    Recursive (construction-detail D-3): a framed layer's division cells
    nest full materials of this same schema. Depth is one level in
    practice; the schema allows the general case.
    """

    type: str
    identifier: str
    display_name: str | None = None
    thickness: float
    conductivity: float
    specific_heat: float
    roughness: str
    visible_absorptance: float
    thermal_absorptance: float
    solar_absorptance: float
    density: float
    properties: MaterialPropertiesSchema | None = None


class FaceConstructionSummarySchema(BaseModel):
    """Thin per-face construction summary (construction-detail D-2).

    No materials — the layer detail lives once in the `constructions`
    map, keyed by this `identifier`.
    """

    identifier: str
    type: str
    u_factor: float = Field(default=0.0, description="W/m²K, air films included")
    u_value: float = Field(default=0.0, description="W/m²K, air films excluded")
    r_factor: float = Field(default=0.0, description="m²K/W, air films included")
    r_value: float = Field(default=0.0, description="m²K/W, air films excluded")


class DetailedOpaqueConstructionSchema(FaceConstructionSummarySchema):
    """honeybee_energy.construction.opaque.OpaqueConstruction, layers included.

    The summary plus `materials` — stored once per unique construction in
    the top-level `constructions` map. Also the AirBoundary tripwire: an
    AirBoundary construction fails this schema's validation (no opaque
    materials), which is what makes the extraction service skip + count
    the face (Q-VIEW-1).

    `materials` is ordered exterior → interior (honeybee convention:
    "outside to inside" — construction-detail Q1, verified).
    """

    materials: list[ConstructionMaterialSchema]


class WindowConstructionSchema(BaseModel):
    """honeybee_energy.construction.window.WindowConstruction."""

    identifier: str
    type: str
    u_factor: float = Field(default=0.0, description="W/m²K, air films included")
    u_value: float = Field(default=0.0, description="W/m²K, air films excluded")
    r_factor: float = Field(default=0.0, description="m²K/W, air films included")
    r_value: float = Field(default=0.0, description="m²K/W, air films excluded")


class FaceEnergyPropertiesSchema(BaseModel):
    """honeybee_energy.properties.face.FaceEnergyProperties."""

    construction: FaceConstructionSummarySchema | None = None


class ApertureEnergyPropertiesSchema(BaseModel):
    """honeybee_energy.properties.aperture.ApertureEnergyProperties."""

    construction: WindowConstructionSchema | None = None


DivisionCellSchema.model_rebuild()

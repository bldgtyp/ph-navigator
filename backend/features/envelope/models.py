"""Pydantic contracts for Assembly Builder read and command models."""

from __future__ import annotations

from typing import Annotated, Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from features.project_document.document import (
    Assembly,
    AssemblyOrientation,
    AssemblyType,
    ProjectMaterial,
    SpecificationStatus,
)
from features.project_document.models import ProjectDocumentSource
from features.shared.colors import normalize_optional_hex_color

ThermalStatusFlag = Literal[
    "missing_material",
    "missing_conductivity",
    "invalid_geometry",
    "broken_material_reference",
]


class AssemblyThermalStatus(BaseModel):
    """Completeness flags derived from ``thermal.thermal_issues``.

    ``is_complete`` is true when no issues are reported; ``flags`` enumerates
    user-actionable problems (missing materials, missing conductivity,
    invalid geometry, broken material references).
    """

    model_config = ConfigDict(extra="forbid")

    is_complete: bool
    flags: list[ThermalStatusFlag] = Field(default_factory=list)


class ProjectMaterialUseSite(BaseModel):
    """Derived reference from a segment back to its project material."""

    model_config = ConfigDict(extra="forbid")

    assembly_id: str
    assembly_name: str
    layer_id: str
    layer_order: int
    segment_id: str
    segment_order: int
    use_site_notes: str | None
    photo_asset_ids: list[str] = Field(default_factory=list)


class AssemblyRead(Assembly):
    """Assembly document row plus read-only status flags."""

    status: AssemblyThermalStatus


class ProjectMaterialRead(ProjectMaterial):
    """Project material document row plus derived use-sites."""

    use_sites: list[ProjectMaterialUseSite] = Field(default_factory=list)


class EnvelopeReadResponse(BaseModel):
    """Envelope document slice used by the read-only Assembly shell."""

    model_config = ConfigDict(extra="forbid")

    project_id: UUID
    version_id: UUID
    source: ProjectDocumentSource
    version_etag: str
    draft_etag: str | None
    assemblies: list[AssemblyRead] = Field(default_factory=list)
    project_materials: list[ProjectMaterialRead] = Field(default_factory=list)


class AssemblyThermalResponse(BaseModel):
    """Backend-computed construction-only thermal result in SI units."""

    model_config = ConfigDict(extra="forbid")

    project_id: UUID
    version_id: UUID
    source: ProjectDocumentSource
    assembly_id: str
    input_hash: str
    status: AssemblyThermalStatus
    r_parallel_path_m2k_w: float | None
    r_isothermal_planes_m2k_w: float | None
    r_effective_m2k_w: float | None
    u_effective_w_m2k: float | None
    warnings: list[str] = Field(default_factory=list)


ProjectMaterialDriftState = Literal[
    "in_sync",
    "customized",
    "drifted",
    "source_deactivated",
    "source_missing",
]
ProjectMaterialDriftFieldKey = Literal[
    "name",
    "category",
    "density_kg_m3",
    "specific_heat_j_kgk",
    "conductivity_w_mk",
    "emissivity",
    "color",
    "source",
    "url",
    "comments",
]
ProjectMaterialRefreshAction = Literal["keep_mine", "take_catalog", "use_value"]


class ProjectMaterialDriftField(BaseModel):
    model_config = ConfigDict(extra="forbid")

    key: ProjectMaterialDriftFieldKey
    project_value: Any
    catalog_value: Any
    is_overridden: bool
    differs: bool


class ProjectMaterialDriftItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    project_material_id: str
    state: ProjectMaterialDriftState
    catalog_record_id: str
    local_overrides: list[str] = Field(default_factory=list)
    fields: list[ProjectMaterialDriftField] = Field(default_factory=list)


class ProjectMaterialDriftReport(BaseModel):
    model_config = ConfigDict(extra="forbid")

    project_id: UUID
    version_id: UUID
    source: ProjectDocumentSource
    version_etag: str
    draft_etag: str | None
    materials: list[ProjectMaterialDriftItem] = Field(default_factory=list)


class ProjectMaterialRefreshChoice(BaseModel):
    model_config = ConfigDict(extra="forbid")

    key: ProjectMaterialDriftFieldKey
    action: ProjectMaterialRefreshAction
    value: Any = None


class CreateAssemblyCommand(BaseModel):
    """Create a new assembly with one default layer and one null segment."""

    model_config = ConfigDict(extra="forbid")

    kind: Literal["create_assembly"]
    name: str = Field(min_length=1, max_length=200)
    type: AssemblyType = "wall"
    orientation: AssemblyOrientation = "first_layer_outside"
    thickness_mm: float = Field(default=100.0, gt=0, allow_inf_nan=False)
    width_mm: float = Field(default=1000.0, gt=0, allow_inf_nan=False)


class RenameAssemblyCommand(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: Literal["rename_assembly"]
    assembly_id: str
    name: str = Field(min_length=1, max_length=200)


class UpdateAssemblyTypeCommand(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: Literal["update_assembly_type"]
    assembly_id: str
    type: AssemblyType


class DuplicateAssemblyCommand(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: Literal["duplicate_assembly"]
    assembly_id: str
    name: str | None = Field(default=None, max_length=200)


class DeleteAssemblyCommand(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: Literal["delete_assembly"]
    assembly_id: str


class AddLayerCommand(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: Literal["add_layer"]
    assembly_id: str
    target_layer_id: str | None = None
    position: Literal["above", "below"] = "below"
    thickness_mm: float = Field(default=100.0, gt=0, allow_inf_nan=False)


class UpdateLayerThicknessCommand(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: Literal["update_layer_thickness"]
    assembly_id: str
    layer_id: str
    thickness_mm: float = Field(gt=0, allow_inf_nan=False)


class DeleteLayerCommand(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: Literal["delete_layer"]
    assembly_id: str
    layer_id: str


class AddSegmentCommand(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: Literal["add_segment"]
    assembly_id: str
    layer_id: str
    target_segment_id: str | None = None
    position: Literal["left", "right"] = "right"
    width_mm: float = Field(default=1000.0, gt=0, allow_inf_nan=False)


class UpdateSegmentCommand(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: Literal["update_segment"]
    assembly_id: str
    layer_id: str
    segment_id: str
    width_mm: float = Field(gt=0, allow_inf_nan=False)
    is_continuous_insulation: bool
    steel_stud_spacing_mm: float | None = Field(default=None, gt=0, allow_inf_nan=False)


class DeleteSegmentCommand(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: Literal["delete_segment"]
    assembly_id: str
    layer_id: str
    segment_id: str


class FlipOrientationCommand(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: Literal["flip_orientation"]
    assembly_id: str


class FlipLayersCommand(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: Literal["flip_layers"]
    assembly_id: str


class FlipSegmentsCommand(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: Literal["flip_segments"]
    assembly_id: str


class PasteAssignmentCommand(BaseModel):
    """Copy/paste material assignment fields without geometry or evidence."""

    model_config = ConfigDict(extra="forbid")

    kind: Literal["paste_assignment"]
    assembly_id: str
    layer_id: str
    segment_id: str
    project_material_id: str | None
    is_continuous_insulation: bool
    steel_stud_spacing_mm: float | None = Field(default=None, gt=0, allow_inf_nan=False)


class PickProjectMaterialCommand(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: Literal["pick_project_material"]
    assembly_id: str
    layer_id: str
    segment_id: str
    project_material_id: str | None


class PickCatalogMaterialCommand(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: Literal["pick_catalog_material"]
    assembly_id: str
    layer_id: str
    segment_id: str
    catalog_material_id: str


class HandEnterMaterialCommand(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: Literal["hand_enter_material"]
    assembly_id: str
    layer_id: str
    segment_id: str
    name: str = Field(min_length=1, max_length=200)
    category: str = Field(default="Other", min_length=1, max_length=120)
    conductivity_w_mk: float | None = Field(default=None, gt=0, allow_inf_nan=False)
    density_kg_m3: float | None = Field(default=None, ge=0, allow_inf_nan=False)
    specific_heat_j_kgk: float | None = Field(default=None, ge=0, allow_inf_nan=False)
    emissivity: float | None = Field(default=None, ge=0, le=1, allow_inf_nan=False)
    color: str | None = Field(default=None, max_length=40)

    @field_validator("color", mode="before")
    @classmethod
    def _normalize_color(cls, value: object) -> object:
        return normalize_optional_hex_color(value)


class UpdateProjectMaterialCommand(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: Literal["update_project_material"]
    project_material_id: str
    name: str | None = Field(default=None, min_length=1, max_length=200)
    category: str | None = Field(default=None, min_length=1, max_length=120)
    density_kg_m3: float | None = Field(default=None, ge=0, allow_inf_nan=False)
    specific_heat_j_kgk: float | None = Field(default=None, ge=0, allow_inf_nan=False)
    conductivity_w_mk: float | None = Field(default=None, gt=0, allow_inf_nan=False)
    emissivity: float | None = Field(default=None, ge=0, le=1, allow_inf_nan=False)
    color: str | None = Field(default=None, max_length=40)
    source: str | None = Field(default=None, max_length=400)
    url: str | None = Field(default=None, max_length=2000)
    comments: str | None = Field(default=None, max_length=4000)
    specification_status: SpecificationStatus | None = None

    @field_validator("color", mode="before")
    @classmethod
    def _normalize_color(cls, value: object) -> object:
        return normalize_optional_hex_color(value)


class UpdateSegmentUseSiteNotesCommand(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: Literal["update_segment_use_site_notes"]
    assembly_id: str
    layer_id: str
    segment_id: str
    use_site_notes: str | None = Field(default=None, max_length=4000)


class DetachSegmentMaterialCommand(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: Literal["detach_segment_material"]
    assembly_id: str
    layer_id: str
    segment_id: str


class RemoveUnusedProjectMaterialsCommand(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: Literal["remove_unused_project_materials"]


class RemoveProjectMaterialCommand(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: Literal["remove_project_material"]
    project_material_id: str


class RefreshProjectMaterialFromCatalogCommand(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: Literal["refresh_project_material_from_catalog"]
    project_material_id: str
    field_choices: list[ProjectMaterialRefreshChoice]


EnvelopeCommand = Annotated[
    CreateAssemblyCommand
    | RenameAssemblyCommand
    | UpdateAssemblyTypeCommand
    | DuplicateAssemblyCommand
    | DeleteAssemblyCommand
    | AddLayerCommand
    | UpdateLayerThicknessCommand
    | DeleteLayerCommand
    | AddSegmentCommand
    | UpdateSegmentCommand
    | DeleteSegmentCommand
    | FlipOrientationCommand
    | FlipLayersCommand
    | FlipSegmentsCommand
    | PasteAssignmentCommand
    | PickProjectMaterialCommand
    | PickCatalogMaterialCommand
    | HandEnterMaterialCommand
    | UpdateProjectMaterialCommand
    | UpdateSegmentUseSiteNotesCommand
    | DetachSegmentMaterialCommand
    | RemoveUnusedProjectMaterialsCommand
    | RemoveProjectMaterialCommand
    | RefreshProjectMaterialFromCatalogCommand,
    Field(discriminator="kind"),
]


class EnvelopeCommandRequest(BaseModel):
    """Single semantic command sent by the canvas editor."""

    model_config = ConfigDict(extra="forbid")

    command: EnvelopeCommand


class AssemblySegmentTableRow(BaseModel):
    """Flattened segment adapter for table/attachment workflows."""

    model_config = ConfigDict(extra="forbid")

    id: str
    assembly_id: str
    assembly_name: str
    layer_id: str
    layer_order: int
    segment_order: int
    width_mm: float
    is_continuous_insulation: bool
    steel_stud_spacing_mm: float | None
    project_material_id: str | None
    project_material_name: str | None
    photo_asset_ids: list[str] = Field(default_factory=list)
    use_site_notes: str | None

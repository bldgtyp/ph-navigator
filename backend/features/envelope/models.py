"""Pydantic contracts for Assembly Builder read and command models."""

from __future__ import annotations

from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from features.project_document.document import (
    Assembly,
    AssemblyOrientation,
    AssemblyType,
    ProjectMaterial,
)
from features.project_document.models import ProjectDocumentSource

ThermalStatusFlag = Literal["missing_material", "missing_conductivity", "invalid_geometry"]


class AssemblyThermalStatus(BaseModel):
    """Placeholder completeness flags until Phase 5 adds calculations."""

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
    | PasteAssignmentCommand,
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

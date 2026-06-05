"""Wire contracts for the `ApertureCommand` discriminated union.

Each user gesture in the Aperture Builder maps to exactly one command;
the union is closed and ``extra="forbid"`` so unknown fields fail at the
boundary. Six commands ship with Phase 01 (sidebar CRUD + per-element
name / operation); the rest are reserved in the union so the wire shape
is stable, but their handlers raise ``aperture_command_not_implemented``
until the phase that owns the gesture fills them in.
"""

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

from features.project_document.document import (
    ApertureOperation,
    FrameRef,
    GlazingRef,
)

APT_ID_PATTERN = r"^apt_[A-Za-z0-9_-]+$"
APTEL_ID_PATTERN = r"^aptel_[A-Za-z0-9_-]+$"

ApertureSide = Literal["top", "right", "bottom", "left"]


class CreateApertureType(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: Literal["createApertureType"] = "createApertureType"
    proposed_name: str | None = Field(default=None, max_length=200)


class RenameApertureType(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: Literal["renameApertureType"] = "renameApertureType"
    aperture_type_id: str = Field(pattern=APT_ID_PATTERN, max_length=80)
    new_name: str = Field(min_length=1, max_length=200)


class DuplicateApertureType(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: Literal["duplicateApertureType"] = "duplicateApertureType"
    aperture_type_id: str = Field(pattern=APT_ID_PATTERN, max_length=80)
    new_name: str | None = Field(default=None, max_length=200)


class DeleteApertureType(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: Literal["deleteApertureType"] = "deleteApertureType"
    aperture_type_id: str = Field(pattern=APT_ID_PATTERN, max_length=80)


class SetElementName(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: Literal["setElementName"] = "setElementName"
    aperture_type_id: str = Field(pattern=APT_ID_PATTERN, max_length=80)
    element_id: str = Field(pattern=APTEL_ID_PATTERN, max_length=80)
    new_name: str = Field(min_length=1, max_length=200)


class SetElementOperation(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: Literal["setElementOperation"] = "setElementOperation"
    aperture_type_id: str = Field(pattern=APT_ID_PATTERN, max_length=80)
    element_id: str = Field(pattern=APTEL_ID_PATTERN, max_length=80)
    operation: ApertureOperation | None = None


# ---- Stubs (handlers raise not_implemented; ship in later phases) ----


class EditDimension(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: Literal["editDimension"] = "editDimension"
    aperture_type_id: str = Field(pattern=APT_ID_PATTERN, max_length=80)
    axis: Literal["row", "column"]
    index: int = Field(ge=0)
    new_value_mm: float = Field(gt=0)


class AddRow(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: Literal["addRow"] = "addRow"
    aperture_type_id: str = Field(pattern=APT_ID_PATTERN, max_length=80)
    at_index: int = Field(ge=0)
    height_mm: float = Field(gt=0)


class AddColumn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: Literal["addColumn"] = "addColumn"
    aperture_type_id: str = Field(pattern=APT_ID_PATTERN, max_length=80)
    at_index: int = Field(ge=0)
    width_mm: float = Field(gt=0)


class DeleteRow(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: Literal["deleteRow"] = "deleteRow"
    aperture_type_id: str = Field(pattern=APT_ID_PATTERN, max_length=80)
    index: int = Field(ge=0)


class DeleteColumn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: Literal["deleteColumn"] = "deleteColumn"
    aperture_type_id: str = Field(pattern=APT_ID_PATTERN, max_length=80)
    index: int = Field(ge=0)


class MergeElements(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: Literal["mergeElements"] = "mergeElements"
    aperture_type_id: str = Field(pattern=APT_ID_PATTERN, max_length=80)
    element_ids: list[str] = Field(min_length=2)


class SplitElement(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: Literal["splitElement"] = "splitElement"
    aperture_type_id: str = Field(pattern=APT_ID_PATTERN, max_length=80)
    element_id: str = Field(pattern=APTEL_ID_PATTERN, max_length=80)
    axis: Literal["row", "column"]
    at_index: int = Field(ge=1)


class PickFrame(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: Literal["pickFrame"] = "pickFrame"
    aperture_type_id: str = Field(pattern=APT_ID_PATTERN, max_length=80)
    element_id: str = Field(pattern=APTEL_ID_PATTERN, max_length=80)
    side: ApertureSide
    frame: FrameRef


class PickGlazing(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: Literal["pickGlazing"] = "pickGlazing"
    aperture_type_id: str = Field(pattern=APT_ID_PATTERN, max_length=80)
    element_id: str = Field(pattern=APTEL_ID_PATTERN, max_length=80)
    glazing: GlazingRef


class PasteAssignment(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: Literal["pasteAssignment"] = "pasteAssignment"
    aperture_type_id: str = Field(pattern=APT_ID_PATTERN, max_length=80)
    source_element_id: str = Field(pattern=APTEL_ID_PATTERN, max_length=80)
    target_element_ids: list[str] = Field(min_length=1)


ApertureCommand = Annotated[
    (
        CreateApertureType
        | RenameApertureType
        | DuplicateApertureType
        | DeleteApertureType
        | SetElementName
        | SetElementOperation
        | EditDimension
        | AddRow
        | AddColumn
        | DeleteRow
        | DeleteColumn
        | MergeElements
        | SplitElement
        | PickFrame
        | PickGlazing
        | PasteAssignment
    ),
    Field(discriminator="kind"),
]


AUDIT_KIND_BY_APERTURE_COMMAND: dict[str, str] = {
    "createApertureType": "project_version_aperture_type_create",
    "renameApertureType": "project_version_aperture_type_rename",
    "duplicateApertureType": "project_version_aperture_type_duplicate",
    "deleteApertureType": "project_version_aperture_type_delete",
    "setElementName": "project_version_aperture_element_set_name",
    "setElementOperation": "project_version_aperture_element_set_operation",
    "editDimension": "project_version_aperture_dimension_edit",
    "addRow": "project_version_aperture_row_add",
    "addColumn": "project_version_aperture_column_add",
    "deleteRow": "project_version_aperture_row_delete",
    "deleteColumn": "project_version_aperture_column_delete",
}

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
APERTURE_SIDES: tuple[ApertureSide, ...] = ("top", "right", "bottom", "left")


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
    """Collapse N adjacent elements into one ``ApertureElement``.

    The element ids must reference elements within the same
    ``aperture_type_id`` and form a contiguous rectangle (no holes,
    no overlaps, no L-shapes). The merged element inherits its 6
    assignment fields (operation, glazing, four frames) and its
    ``name`` from the top-left source — sorted by
    ``row_span[0]`` then ``column_span[0]``.
    """

    model_config = ConfigDict(extra="forbid")
    kind: Literal["mergeElements"] = "mergeElements"
    aperture_type_id: str = Field(pattern=APT_ID_PATTERN, max_length=80)
    element_ids: list[str] = Field(min_length=2, max_length=400)


class SplitElement(BaseModel):
    """Explode a multi-cell element into one fresh 1×1 element per cell.

    Requires ``row_span`` or ``column_span`` to cover more than one
    cell. Every new element inherits the source's 6 assignment fields
    and ``name``. Catalog-origin ``synced_at`` is re-stamped on the
    copies so Phase 12 drift detection treats them as distinct picks.
    """

    model_config = ConfigDict(extra="forbid")
    kind: Literal["splitElement"] = "splitElement"
    aperture_type_id: str = Field(pattern=APT_ID_PATTERN, max_length=80)
    element_id: str = Field(pattern=APTEL_ID_PATTERN, max_length=80)


class PickFrame(BaseModel):
    """Replace one element's per-side frame slot.

    Two paths share this command: ``catalog`` (the frontend has already
    resolved a catalog row's full payload into ``frame``) and
    ``hand_enter`` (``frame.catalog_origin`` is null; user fills the
    inline fields after the pick). The backend stamps a fresh
    ``synced_at`` on catalog picks so refresh-from-catalog can compare.
    """

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


OverrideTarget = Literal[
    "frame.top",
    "frame.right",
    "frame.bottom",
    "frame.left",
    "glazing",
]


class PasteAssignment(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: Literal["pasteAssignment"] = "pasteAssignment"
    aperture_type_id: str = Field(pattern=APT_ID_PATTERN, max_length=80)
    source_element_id: str = Field(pattern=APTEL_ID_PATTERN, max_length=80)
    target_element_ids: list[str] = Field(min_length=1)


class RefreshRefFromCatalog(BaseModel):
    """Phase 12 — write the user's per-field choices back onto a
    catalog-sourced ref and re-stamp ``synced_at``.

    The frontend resolves the choices in the dialog and ships the
    final ``chosen_values`` map keyed by ``field_key``. The backend
    coerces each value through the ref's Pydantic per-field validators
    so an invalid third-value (e.g. negative U) fails the command.
    ``catalog_origin.local_overrides`` is preserved verbatim per PRD
    §15 — refresh does not silently demote an existing override.
    """

    model_config = ConfigDict(extra="forbid")
    kind: Literal["refreshRefFromCatalog"] = "refreshRefFromCatalog"
    aperture_type_id: str = Field(pattern=APT_ID_PATTERN, max_length=80)
    element_id: str = Field(pattern=APTEL_ID_PATTERN, max_length=80)
    target: OverrideTarget
    chosen_values: dict[str, str | float | int | None] = Field(default_factory=dict)


class SetManufacturerFilters(BaseModel):
    """Replace the document's ``tables.manufacturer_filters`` enabled lists.

    A ``None`` value for either field means "all manufacturers enabled"
    (the explicit default state). An empty ``[]`` list means "no
    manufacturers enabled" — the explicit clear-all state. The handler
    refuses any new list that drops a manufacturer currently referenced
    by an element (``manufacturer_filter_strands_frame_picks`` /
    ``..._strands_glazing_picks``).
    """

    model_config = ConfigDict(extra="forbid")
    kind: Literal["setManufacturerFilters"] = "setManufacturerFilters"
    frame_manufacturers_enabled: list[str] | None = None
    glazing_manufacturers_enabled: list[str] | None = None


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
        | RefreshRefFromCatalog
        | SetManufacturerFilters
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
    "pickFrame": "project_version_aperture_frame_pick",
    "pickGlazing": "project_version_aperture_glazing_pick",
    "mergeElements": "project_version_aperture_elements_merge",
    "splitElement": "project_version_aperture_element_split",
    "pasteAssignment": "project_version_aperture_assignment_paste",
    "setManufacturerFilters": "project_version_aperture_manufacturer_filters_set",
    "refreshRefFromCatalog": "project_version_aperture_ref_refresh_from_catalog",
}

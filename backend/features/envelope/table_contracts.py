"""Registered table adapters for envelope document surfaces."""

from __future__ import annotations

from typing import cast
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from features.envelope.models import AssemblySegmentTableRow
from features.envelope.selectors import flatten_assembly_segments
from features.envelope.specification_status_compat import CompatibleSpecificationStatus
from features.project_document.document import EvidenceStatus, ProjectDocumentV1, ProjectMaterial
from features.project_document.models import ProjectDocumentSource
from features.project_document.tables.contracts import TableContract, TableRowsResponse
from features.project_document.validation import validate_document


class ProjectMaterialMutation(ProjectMaterial):
    """Public table-row DTO; the stored ``ProjectMaterial`` remains strict v7."""

    specification_status: CompatibleSpecificationStatus = "missing"


class ProjectMaterialsReplaceRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    rows: list[ProjectMaterialMutation]


class AssemblySegmentReplaceRow(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    photo_asset_ids: list[str] = Field(default_factory=list)
    photo_status: EvidenceStatus = "needed"
    photo_not_required: bool = False
    use_site_notes: str | None = None

    @field_validator("use_site_notes", mode="before")
    @classmethod
    def _strip_optional_notes(cls, value: object) -> object:
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value


class AssemblySegmentsReplaceRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    rows: list[AssemblySegmentReplaceRow]


def build_project_materials_response(
    project_id: UUID,
    version_id: UUID,
    source: ProjectDocumentSource,
    version_etag: str,
    draft_etag: str | None,
    body: ProjectDocumentV1,
) -> TableRowsResponse:
    return TableRowsResponse(
        project_id=project_id,
        version_id=version_id,
        source=source,
        version_etag=version_etag,
        draft_etag=draft_etag,
        rows=[material.model_dump(mode="json") for material in body.tables.project_materials],
    )


def apply_project_materials_replace(body: ProjectDocumentV1, payload: BaseModel) -> ProjectDocumentV1:
    rows = [
        ProjectMaterial.model_validate(row.model_dump(mode="json"))
        for row in cast(ProjectMaterialsReplaceRequest, payload).rows
    ]
    if body.tables.project_materials == rows:
        return body
    raw = body.model_dump(mode="json")
    raw["tables"]["project_materials"] = [row.model_dump(mode="json") for row in rows]
    return validate_document(raw)


def extract_project_materials(body: ProjectDocumentV1) -> list[dict[str, object]]:
    return [material.model_dump(mode="json") for material in body.tables.project_materials]


def build_assembly_segments_response(
    project_id: UUID,
    version_id: UUID,
    source: ProjectDocumentSource,
    version_etag: str,
    draft_etag: str | None,
    body: ProjectDocumentV1,
) -> TableRowsResponse:
    return TableRowsResponse(
        project_id=project_id,
        version_id=version_id,
        source=source,
        version_etag=version_etag,
        draft_etag=draft_etag,
        rows=[row.model_dump(mode="json") for row in flatten_assembly_segments(body)],
    )


def apply_assembly_segments_replace(body: ProjectDocumentV1, payload: BaseModel) -> ProjectDocumentV1:
    incoming = cast(AssemblySegmentsReplaceRequest, payload).rows
    by_id = {row.id: row for row in incoming}
    changed = False
    for assembly in body.tables.assemblies:
        for layer in assembly.layers:
            for segment in layer.segments:
                replacement = by_id.get(segment.id)
                if replacement is None:
                    continue
                notes_changed = (
                    "use_site_notes" in replacement.model_fields_set
                    and segment.use_site_notes != replacement.use_site_notes
                )
                waiver_changed = (
                    "photo_not_required" in replacement.model_fields_set
                    and segment.photo_not_required != replacement.photo_not_required
                )
                status_changed = (
                    "photo_status" in replacement.model_fields_set and segment.photo_status != replacement.photo_status
                )
                if (
                    segment.photo_asset_ids != replacement.photo_asset_ids
                    or status_changed
                    or waiver_changed
                    or notes_changed
                ):
                    changed = True
                    break
            if changed:
                break
        if changed:
            break
    if not changed:
        return body

    raw = body.model_dump(mode="json")
    for assembly in raw["tables"]["assemblies"]:
        for layer in assembly["layers"]:
            for segment in layer["segments"]:
                replacement = by_id.get(str(segment.get("id", "")))
                if replacement is None:
                    continue
                photo_asset_ids = list(replacement.photo_asset_ids)
                segment["photo_asset_ids"] = photo_asset_ids
                if "photo_status" in replacement.model_fields_set:
                    segment["photo_status"] = replacement.photo_status
                if "photo_not_required" in replacement.model_fields_set:
                    segment["photo_not_required"] = replacement.photo_not_required
                if "use_site_notes" in replacement.model_fields_set:
                    segment["use_site_notes"] = replacement.use_site_notes
    return validate_document(raw)


def extract_assembly_segments(body: ProjectDocumentV1) -> list[dict[str, object]]:
    return [row.model_dump(mode="json") for row in flatten_assembly_segments(body)]


project_materials_contract = TableContract(
    name="project_materials",
    schema_slug="project-material",
    schema_model=ProjectMaterial,
    replace_request_model=ProjectMaterialsReplaceRequest,
    build_response=build_project_materials_response,
    apply_replace=apply_project_materials_replace,
    extract_rows=extract_project_materials,
    extract_diff_value=extract_project_materials,
    table_path=("project_materials",),
    unit_fields={
        "conductivity_w_mk": "conductivity",
        "density_kg_m3": "density",
        "specific_heat_j_kgk": "specific_heat",
    },
)

assembly_segments_contract = TableContract(
    name="assembly_segments",
    schema_slug="assembly-segment",
    schema_model=AssemblySegmentTableRow,
    replace_request_model=AssemblySegmentsReplaceRequest,
    build_response=build_assembly_segments_response,
    apply_replace=apply_assembly_segments_replace,
    extract_rows=extract_assembly_segments,
    extract_diff_value=extract_assembly_segments,
    table_path=("assemblies", "layers", "segments"),
    unit_fields={
        "width_mm": "length",
        "steel_stud_spacing_mm": "length",
    },
)

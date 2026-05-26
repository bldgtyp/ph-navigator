"""Table contracts for locked attachment-field surfaces.

These are intentionally narrow, row-dict contracts around PHN-defined core
fields. They are not custom-field surfaces.
"""

from __future__ import annotations

from typing import Any, cast
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from features.project_document.document import ProjectDocumentV1
from features.project_document.models import ProjectDocumentSource
from features.project_document.tables.contracts import TableContract
from features.project_document.validation import validate_document


class AttachmentRow(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str
    name: str | None = None


class AttachmentRowsReplaceRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    rows: list[dict[str, Any]]


class AttachmentRowsResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    project_id: UUID
    version_id: UUID
    source: ProjectDocumentSource
    version_etag: str
    draft_etag: str | None
    rows: list[dict[str, Any]] = Field(default_factory=list)


def make_simple_attachment_contract(
    *,
    name: str,
    schema_slug: str,
    table_path: tuple[str, ...],
) -> TableContract:
    def build_response(
        project_id: UUID,
        version_id: UUID,
        source: ProjectDocumentSource,
        version_etag: str,
        draft_etag: str | None,
        body: ProjectDocumentV1,
    ) -> AttachmentRowsResponse:
        return AttachmentRowsResponse(
            project_id=project_id,
            version_id=version_id,
            source=source,
            version_etag=version_etag,
            draft_etag=draft_etag,
            rows=_read_path(body.model_dump(mode="json")["tables"], table_path),
        )

    def apply_replace(body: ProjectDocumentV1, payload: BaseModel) -> ProjectDocumentV1:
        rows = cast(AttachmentRowsReplaceRequest, payload).rows
        raw = body.model_dump(mode="json")
        _write_path(raw["tables"], table_path, rows)
        return validate_document(raw)

    def extract_rows(body: ProjectDocumentV1) -> list[dict[str, Any]]:
        return _read_path(body.model_dump(mode="json")["tables"], table_path)

    return TableContract(
        name=name,
        schema_slug=schema_slug,
        schema_model=AttachmentRow,
        replace_request_model=AttachmentRowsReplaceRequest,
        build_response=build_response,
        apply_replace=apply_replace,
        extract_rows=extract_rows,
        extract_diff_value=extract_rows,
        table_path=table_path,
    )


def build_assembly_segments_response(
    project_id: UUID,
    version_id: UUID,
    source: ProjectDocumentSource,
    version_etag: str,
    draft_etag: str | None,
    body: ProjectDocumentV1,
) -> AttachmentRowsResponse:
    return AttachmentRowsResponse(
        project_id=project_id,
        version_id=version_id,
        source=source,
        version_etag=version_etag,
        draft_etag=draft_etag,
        rows=extract_assembly_segments(body),
    )


def apply_assembly_segments_replace(body: ProjectDocumentV1, payload: BaseModel) -> ProjectDocumentV1:
    incoming = cast(AttachmentRowsReplaceRequest, payload).rows
    raw = body.model_dump(mode="json")
    tables = raw["tables"]
    if not isinstance(tables, dict):
        return body
    by_id = {str(row.get("id")): row for row in incoming if row.get("id")}
    for assembly in _dict_rows(tables.get("assemblies")):
        for layer in _dict_rows(assembly.get("layers")):
            for segment in _dict_rows(layer.get("segments")):
                row_id = str(segment.get("id", ""))
                replacement = by_id.get(row_id)
                if replacement is None:
                    continue
                segment["photo_asset_ids"] = [
                    value for value in replacement.get("photo_asset_ids", []) if isinstance(value, str)
                ]
                if isinstance(replacement.get("name"), str):
                    segment["name"] = replacement["name"]
    return validate_document(raw)


def extract_assembly_segments(body: ProjectDocumentV1) -> list[dict[str, Any]]:
    tables = body.model_dump(mode="json")["tables"]
    rows: list[dict[str, Any]] = []
    for assembly in _dict_rows(tables.get("assemblies")):
        for layer in _dict_rows(assembly.get("layers")):
            for segment in _dict_rows(layer.get("segments")):
                row = dict(segment)
                row.setdefault("assembly_id", assembly.get("id"))
                row.setdefault("layer_id", layer.get("id"))
                row.setdefault("name", segment.get("name") or segment.get("id"))
                row.setdefault("photo_asset_ids", [])
                rows.append(row)
    return rows


assembly_segments_contract = TableContract(
    name="assembly_segments",
    schema_slug="assembly-segment",
    schema_model=AttachmentRow,
    replace_request_model=AttachmentRowsReplaceRequest,
    build_response=build_assembly_segments_response,
    apply_replace=apply_assembly_segments_replace,
    extract_rows=extract_assembly_segments,
    extract_diff_value=extract_assembly_segments,
    table_path=("assemblies", "layers", "segments"),
)

project_materials_contract = make_simple_attachment_contract(
    name="project_materials",
    schema_slug="project-material",
    table_path=("project_materials",),
)
thermal_bridges_contract = make_simple_attachment_contract(
    name="thermal_bridges",
    schema_slug="thermal-bridge",
    table_path=("thermal_bridges",),
)
equipment_ervs_contract = make_simple_attachment_contract(
    name="equipment_ervs",
    schema_slug="equipment-erv",
    table_path=("equipment", "ervs"),
)
equipment_pumps_contract = make_simple_attachment_contract(
    name="equipment_pumps",
    schema_slug="equipment-pump",
    table_path=("equipment", "pumps"),
)
equipment_fans_contract = make_simple_attachment_contract(
    name="equipment_fans",
    schema_slug="equipment-fan",
    table_path=("equipment", "fans"),
)


def _read_path(tables: dict[str, Any], path: tuple[str, ...]) -> list[dict[str, Any]]:
    current: Any = tables
    for part in path:
        if not isinstance(current, dict):
            return []
        current = current.get(part)
    return _dict_rows(current)


def _write_path(tables: dict[str, Any], path: tuple[str, ...], rows: list[dict[str, Any]]) -> None:
    current: Any = tables
    for part in path[:-1]:
        if not isinstance(current, dict):
            return
        current = current.setdefault(part, {})
    if isinstance(current, dict):
        current[path[-1]] = rows


def _dict_rows(value: object) -> list[dict[str, Any]]:
    return [cast(dict[str, Any], item) for item in value if isinstance(item, dict)] if isinstance(value, list) else []

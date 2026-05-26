"""Locked, PHN-defined attachment field registry.

Attachments are not user-extensible custom fields in v1. This registry is the
only backend source for which document paths may hold asset id arrays.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal, cast

from features.project_document.document import ProjectDocumentV1

AssetKind = Literal["datasheet", "site_photo", "hbjson", "simulation_file", "export_bundle", "other"]


@dataclass(frozen=True)
class AttachmentFieldConfig:
    key: str
    table_key: str
    field_key: str
    asset_kinds: frozenset[AssetKind]
    allowed_content_types: frozenset[str]
    allowed_extensions: frozenset[str]
    max_count: int
    max_file_size_mb: int


ATTACHMENT_FIELDS: tuple[AttachmentFieldConfig, ...] = (
    AttachmentFieldConfig(
        key="project_materials.datasheet_asset_ids",
        table_key="project_materials",
        field_key="datasheet_asset_ids",
        asset_kinds=frozenset({"datasheet"}),
        allowed_content_types=frozenset({"application/pdf", "image/png", "image/jpeg", "image/webp"}),
        allowed_extensions=frozenset(),
        max_count=5,
        max_file_size_mb=25,
    ),
    AttachmentFieldConfig(
        key="assembly_segments.photo_asset_ids",
        table_key="assembly_segments",
        field_key="photo_asset_ids",
        asset_kinds=frozenset({"site_photo"}),
        allowed_content_types=frozenset({"image/png", "image/jpeg", "image/webp"}),
        allowed_extensions=frozenset(),
        max_count=10,
        max_file_size_mb=25,
    ),
    *(
        AttachmentFieldConfig(
            key=f"{table}.datasheet_asset_ids",
            table_key=table,
            field_key="datasheet_asset_ids",
            asset_kinds=frozenset({"datasheet"}),
            allowed_content_types=frozenset({"application/pdf", "image/png", "image/jpeg", "image/webp"}),
            allowed_extensions=frozenset(),
            max_count=5,
            max_file_size_mb=25,
        )
        for table in ("equipment_ervs", "equipment_pumps", "equipment_fans", "thermal_bridges")
    ),
    AttachmentFieldConfig(
        key="thermal_bridges.simulation_file_asset_ids",
        table_key="thermal_bridges",
        field_key="simulation_file_asset_ids",
        asset_kinds=frozenset({"simulation_file", "hbjson"}),
        allowed_content_types=frozenset(
            {"application/pdf", "image/png", "image/jpeg", "application/json", "application/octet-stream"}
        ),
        allowed_extensions=frozenset({".hbjson"}),
        max_count=5,
        max_file_size_mb=25,
    ),
)


def all_asset_kinds() -> frozenset[AssetKind]:
    return frozenset({"datasheet", "site_photo", "hbjson", "simulation_file", "export_bundle", "other"})


def get_attachment_field(table_key: str, field_key: str) -> AttachmentFieldConfig | None:
    for field in ATTACHMENT_FIELDS:
        if field.table_key == table_key and field.field_key == field_key:
            return field
    return None


def attachment_fields_for_asset_kind(asset_kind: str) -> list[AttachmentFieldConfig]:
    return [field for field in ATTACHMENT_FIELDS if asset_kind in field.asset_kinds]


def filename_extension(filename: str) -> str:
    dot = filename.rfind(".")
    return filename[dot:].lower() if dot >= 0 else ""


def asset_matches_field(
    field: AttachmentFieldConfig,
    *,
    asset_kind: str,
    content_type: str,
    original_filename: str,
    size_bytes: int,
) -> bool:
    if asset_kind not in field.asset_kinds:
        return False
    if size_bytes > field.max_file_size_mb * 1024 * 1024:
        return False
    if content_type in field.allowed_content_types:
        if field.allowed_extensions and content_type in {"application/json", "application/octet-stream"}:
            return filename_extension(original_filename) in field.allowed_extensions
        return True
    return filename_extension(original_filename) in field.allowed_extensions


def asset_referenced_by_document(body: ProjectDocumentV1, asset_id: str) -> bool:
    return bool(list_asset_references(body, asset_ids={asset_id}))


def list_asset_references(
    body: ProjectDocumentV1,
    *,
    asset_ids: set[str] | None = None,
    table_key: str | None = None,
    column_key: str | None = None,
    kind: str | None = None,
) -> list[dict[str, Any]]:
    references: list[dict[str, Any]] = []
    field_configs = [
        field
        for field in ATTACHMENT_FIELDS
        if (table_key is None or field.table_key == table_key)
        and (column_key is None or field.field_key == column_key)
        and (kind is None or kind in field.asset_kinds)
    ]
    for field in field_configs:
        for row in iter_rows_for_table(body, field.table_key):
            values = row.get(field.field_key)
            if not isinstance(values, list):
                continue
            for index, value in enumerate(values):
                if not isinstance(value, str):
                    continue
                if asset_ids is not None and value not in asset_ids:
                    continue
                references.append(
                    {
                        "table_key": field.table_key,
                        "field_key": field.field_key,
                        "row_id": row.get("id"),
                        "row_name": row.get("name") or row.get("number") or row.get("id"),
                        "asset_id": value,
                        "index": index,
                    }
                )
    return references


def iter_rows_for_table(body: ProjectDocumentV1, table_key: str) -> list[dict[str, Any]]:
    tables = body.model_dump(mode="json")["tables"]
    if table_key == "project_materials":
        return _dict_rows(tables.get("project_materials"))
    if table_key == "thermal_bridges":
        return _dict_rows(tables.get("thermal_bridges"))
    if table_key == "equipment_ervs":
        return _dict_rows(tables.get("equipment", {}).get("ervs"))
    if table_key == "equipment_pumps":
        return _dict_rows(tables.get("equipment", {}).get("pumps"))
    if table_key == "equipment_fans":
        return _dict_rows(tables.get("equipment", {}).get("fans"))
    if table_key == "assembly_segments":
        rows: list[dict[str, Any]] = []
        for assembly in _dict_rows(tables.get("assemblies")):
            for layer in _dict_rows(assembly.get("layers")):
                for segment in _dict_rows(layer.get("segments")):
                    row = dict(segment)
                    row.setdefault("assembly_id", assembly.get("id"))
                    row.setdefault("layer_id", layer.get("id"))
                    row.setdefault("name", segment.get("name") or segment.get("id"))
                    rows.append(row)
        return rows
    return []


def _dict_rows(value: object) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []
    return [cast(dict[str, Any], item) for item in value if isinstance(item, dict)]

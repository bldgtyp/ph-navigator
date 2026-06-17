"""Locked, PHN-defined attachment field registry.

Attachments are not user-extensible custom fields in v1. This registry is the
only backend source for which document paths may hold asset id arrays.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal, cast

from features.project_document.document import ProjectDocumentV1

AssetKind = Literal["datasheet", "site_photo", "hbjson", "simulation_file", "export_bundle", "epw", "other"]


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
        for table in (
            "ventilators",
            "pumps",
            "fans",
            "hot_water_heaters",
            "hot_water_tanks",
            "electric_heaters",
            "appliances",
            "thermal_bridges",
            "heat_pump_outdoor_equip",
            "heat_pump_indoor_equip",
            "heat_pump_outdoor_units",
            "heat_pump_indoor_units",
        )
    ),
)

EQUIPMENT_ATTACHMENT_TABLE_KEYS: dict[str, str] = {
    "ventilators": "ervs",
    "pumps": "pumps",
    "fans": "fans",
    "hot_water_heaters": "hot_water_heaters",
    "hot_water_tanks": "hot_water_tanks",
    "electric_heaters": "electric_heaters",
    "appliances": "appliances",
}
HEAT_PUMP_ATTACHMENT_TABLE_KEYS: dict[str, str] = {
    "heat_pump_outdoor_equip": "outdoor_equip",
    "heat_pump_indoor_equip": "indoor_equip",
    "heat_pump_outdoor_units": "outdoor_units",
    "heat_pump_indoor_units": "indoor_units",
}


# Model-tab HBJSON exports (US-VIEW-1) upload as standalone assets, not
# through an attachment field, so ATTACHMENT_FIELDS does not govern them.
# Size is bounded by the service's global hard cap, which is the D-17
# 100 MB HBJSON limit. Browsers report no MIME type for `.hbjson`, so
# `application/octet-stream` must be accepted alongside JSON.
HBJSON_ALLOWED_EXTENSIONS = frozenset({".hbjson", ".json"})
HBJSON_ALLOWED_CONTENT_TYPES = frozenset({"application/json", "application/octet-stream"})
EPW_ALLOWED_EXTENSIONS = frozenset({".epw"})
EPW_ALLOWED_CONTENT_TYPES = frozenset({"text/plain", "application/octet-stream"})
EPW_MAX_FILE_SIZE_MB = 25


def hbjson_upload_allowed(*, content_type: str, original_filename: str) -> bool:
    return (
        content_type in HBJSON_ALLOWED_CONTENT_TYPES
        and filename_extension(original_filename) in HBJSON_ALLOWED_EXTENSIONS
    )


def epw_upload_allowed(*, content_type: str, original_filename: str, size_bytes: int) -> bool:
    return (
        size_bytes <= EPW_MAX_FILE_SIZE_MB * 1024 * 1024
        and content_type in EPW_ALLOWED_CONTENT_TYPES
        and filename_extension(original_filename) in EPW_ALLOWED_EXTENSIONS
    )


def all_asset_kinds() -> frozenset[AssetKind]:
    return frozenset({"datasheet", "site_photo", "hbjson", "simulation_file", "export_bundle", "epw", "other"})


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
    tables = body.model_dump(mode="json")["tables"]
    field_configs = [
        field
        for field in ATTACHMENT_FIELDS
        if (table_key is None or field.table_key == table_key)
        and (column_key is None or field.field_key == column_key)
        and (kind is None or kind in field.asset_kinds)
    ]
    for field in field_configs:
        for row in iter_rows_for_raw_tables(tables, field.table_key):
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
    return iter_rows_for_raw_tables(tables, table_key)


def iter_rows_for_raw_tables(tables: dict[str, Any], table_key: str) -> list[dict[str, Any]]:
    if table_key == "project_materials":
        return _dict_rows(tables.get("project_materials"))
    if table_key == "thermal_bridges":
        return _dict_rows(tables.get("thermal_bridges"))
    if equipment_key := EQUIPMENT_ATTACHMENT_TABLE_KEYS.get(table_key):
        return attachment_table_rows(tables.get("equipment", {}).get(equipment_key))
    if heat_pump_key := HEAT_PUMP_ATTACHMENT_TABLE_KEYS.get(table_key):
        return _dict_rows(tables.get("equipment", {}).get("heat_pumps", {}).get(heat_pump_key))
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


def attachment_table_rows(value: object) -> list[dict[str, Any]]:
    if isinstance(value, dict):
        envelope = cast(dict[str, Any], value)
        if isinstance(envelope.get("rows"), list):
            return _dict_rows(envelope["rows"])
    return _dict_rows(value)

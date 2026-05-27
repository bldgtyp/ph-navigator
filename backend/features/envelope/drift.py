"""Project material catalog drift reporting."""

from __future__ import annotations

from typing import Any

from psycopg import Connection

from features.catalogs.materials import repository as catalog_materials_repository
from features.envelope.material_fields import PROJECT_MATERIAL_CATALOG_FIELDS
from features.envelope.models import ProjectMaterialDriftField, ProjectMaterialDriftItem
from features.project_document.document import ProjectMaterial


def load_catalog_material_rows(
    conn: Connection[Any],
    materials: list[ProjectMaterial],
) -> dict[str, dict[str, Any] | None]:
    record_ids = catalog_material_record_ids(materials)
    if not record_ids:
        return {}
    sorted_ids = sorted(record_ids)
    rows = catalog_materials_repository.get_materials_by_ids(conn, sorted_ids)
    rows_by_id = {row["id"]: row for row in rows}
    return {record_id: rows_by_id.get(record_id) for record_id in sorted_ids}


def catalog_material_record_ids(materials: list[ProjectMaterial]) -> set[str]:
    return {material.catalog_origin.catalog_record_id for material in materials if material.catalog_origin is not None}


def project_material_drift_item(
    material: ProjectMaterial,
    catalog_rows: dict[str, dict[str, Any] | None],
) -> ProjectMaterialDriftItem:
    origin = material.catalog_origin
    if origin is None:
        raise RuntimeError("Expected catalog_origin for project material drift item.")

    row = catalog_rows.get(origin.catalog_record_id)
    overrides = set(origin.local_overrides)
    source_missing = row is None
    source_deactivated = row is not None and not row["is_active"]
    if source_missing:
        fields = _project_material_drift_fields(material, None, overrides)
        state = "source_missing"
        current_version_id = None
    elif source_deactivated:
        fields = _project_material_drift_fields(material, None, overrides)
        state = "source_deactivated"
        current_version_id = row["current_version_id"]
    else:
        fields = _project_material_drift_fields(material, row, overrides)
        current_version_id = row["current_version_id"]
        version_drift = current_version_id != origin.catalog_version_id
        field_drift = any(field.differs for field in fields)
        if version_drift or field_drift:
            state = "drifted"
        elif origin.local_overrides:
            state = "customized"
        else:
            state = "in_sync"

    return ProjectMaterialDriftItem(
        project_material_id=material.id,
        state=state,
        catalog_record_id=origin.catalog_record_id,
        pinned_catalog_version_id=origin.catalog_version_id,
        current_catalog_version_id=current_version_id,
        local_overrides=list(origin.local_overrides),
        fields=fields,
    )


def _project_material_drift_fields(
    material: ProjectMaterial,
    catalog_row: dict[str, Any] | None,
    overrides: set[str],
) -> list[ProjectMaterialDriftField]:
    return [
        ProjectMaterialDriftField(
            key=key,
            project_value=getattr(material, key),
            catalog_value=None if catalog_row is None else catalog_row[key],
            is_overridden=key in overrides,
            differs=False if catalog_row is None else getattr(material, key) != catalog_row[key],
        )
        for key in PROJECT_MATERIAL_CATALOG_FIELDS
    ]

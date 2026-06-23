"""Project material command handlers for envelope workflows."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from psycopg import Connection
from starlette import status

from features.catalogs.materials import repository as catalog_materials_repository
from features.envelope import ops
from features.envelope.identifiers import ID_PREFIX_PROJECT_MATERIAL, new_id
from features.envelope.material_fields import PROJECT_MATERIAL_CATALOG_FIELDS, PROJECT_MATERIAL_OVERRIDE_FIELDS
from features.envelope.models import (
    DetachSegmentMaterialCommand,
    HandEnterMaterialCommand,
    PasteAssignmentCommand,
    PickCatalogMaterialCommand,
    PickProjectMaterialCommand,
    ProjectMaterialRefreshChoice,
    RefreshProjectMaterialFromCatalogCommand,
    RemoveProjectMaterialCommand,
    RemoveUnusedProjectMaterialsCommand,
    UpdateProjectMaterialCommand,
)
from features.project_document.document import CatalogOrigin, ProjectDocumentV1, ProjectMaterial
from features.shared.errors import api_error

DEFAULT_HAND_ENTERED_MATERIAL_COLOR = "#e6e6e6"


def paste_assignment(body: ProjectDocumentV1, command: PasteAssignmentCommand) -> ProjectDocumentV1:
    ops.ensure_project_material_exists(body, command.project_material_id)
    return ops.update_segment(
        body,
        command.assembly_id,
        command.layer_id,
        command.segment_id,
        lambda segment: segment.model_copy(
            update={
                "project_material_id": command.project_material_id,
                "is_continuous_insulation": command.is_continuous_insulation,
                "steel_stud_spacing_mm": command.steel_stud_spacing_mm,
            }
        ),
    )


def pick_project_material(body: ProjectDocumentV1, command: PickProjectMaterialCommand) -> ProjectDocumentV1:
    ops.ensure_project_material_exists(body, command.project_material_id)
    return assign_segment_material(
        body,
        command.assembly_id,
        command.layer_id,
        command.segment_id,
        command.project_material_id,
    )


def pick_catalog_material(
    conn: Connection[Any],
    body: ProjectDocumentV1,
    command: PickCatalogMaterialCommand,
) -> ProjectDocumentV1:
    matches = [
        material
        for material in body.tables.project_materials
        if material.catalog_origin is not None
        and material.catalog_origin.catalog_table == "materials"
        and material.catalog_origin.catalog_record_id == command.catalog_material_id
    ]
    if len(matches) == 1:
        return assign_segment_material(
            body,
            command.assembly_id,
            command.layer_id,
            command.segment_id,
            matches[0].id,
        )
    if len(matches) > 1:
        raise api_error(
            status.HTTP_409_CONFLICT,
            "ambiguous_catalog_material",
            "Multiple project materials already came from this catalog material. Pick one explicitly.",
            {
                "catalog_material_id": command.catalog_material_id,
                "project_material_ids": [material.id for material in matches],
            },
        )

    row = catalog_materials_repository.get_material(conn, command.catalog_material_id)
    if row is None or not row["is_active"]:
        raise api_error(
            status.HTTP_404_NOT_FOUND,
            "catalog_material_not_found",
            "Catalog material not found.",
            {"catalog_material_id": command.catalog_material_id},
        )
    material = project_material_from_catalog(row)
    body_with_material = ops.replace_project_materials(body, [*body.tables.project_materials, material])
    return assign_segment_material(
        body_with_material,
        command.assembly_id,
        command.layer_id,
        command.segment_id,
        material.id,
    )


def hand_enter_material(body: ProjectDocumentV1, command: HandEnterMaterialCommand) -> ProjectDocumentV1:
    material = ProjectMaterial(
        id=new_id(ID_PREFIX_PROJECT_MATERIAL),
        name=command.name,
        category=command.category,
        conductivity_w_mk=command.conductivity_w_mk,
        density_kg_m3=command.density_kg_m3,
        specific_heat_j_kgk=command.specific_heat_j_kgk,
        emissivity=command.emissivity,
        color=command.color or DEFAULT_HAND_ENTERED_MATERIAL_COLOR,
        specification_status="missing",
        datasheet_asset_ids=[],
        catalog_origin=None,
    )
    body_with_material = ops.replace_project_materials(body, [*body.tables.project_materials, material])
    return assign_segment_material(
        body_with_material,
        command.assembly_id,
        command.layer_id,
        command.segment_id,
        material.id,
    )


def update_project_material(body: ProjectDocumentV1, command: UpdateProjectMaterialCommand) -> ProjectDocumentV1:
    changed = command.model_dump(exclude_unset=True, exclude={"kind", "project_material_id"})
    if not changed:
        ops.find_project_material(body.tables.project_materials, command.project_material_id)
        return body

    materials: list[ProjectMaterial] = []
    found = False
    for material in body.tables.project_materials:
        if material.id != command.project_material_id:
            materials.append(material)
            continue
        found = True
        update_values = changed_project_material_values(material, changed)
        materials.append(material.model_copy(update=update_values))
    if not found:
        ops.not_found("project_material", command.project_material_id)
    return ops.replace_project_materials(body, materials)


def detach_segment_material(body: ProjectDocumentV1, command: DetachSegmentMaterialCommand) -> ProjectDocumentV1:
    segment = ops.find_segment(body, command.assembly_id, command.layer_id, command.segment_id)
    if segment.project_material_id is None:
        raise api_error(
            status.HTTP_409_CONFLICT,
            "segment_has_no_material",
            "The segment does not have a material to detach.",
            {"segment_id": command.segment_id},
        )
    source = ops.find_project_material(body.tables.project_materials, segment.project_material_id)
    detached = source.model_copy(
        update={
            "id": new_id(ID_PREFIX_PROJECT_MATERIAL),
            "name": ops.next_unique_name(
                [material.name for material in body.tables.project_materials],
                f"{source.name} (Custom)",
                new_id(ID_PREFIX_PROJECT_MATERIAL),
            ),
            "catalog_origin": None,
        }
    )
    body_with_material = ops.replace_project_materials(body, [*body.tables.project_materials, detached])
    return assign_segment_material(
        body_with_material,
        command.assembly_id,
        command.layer_id,
        command.segment_id,
        detached.id,
    )


def remove_unused_project_materials(
    body: ProjectDocumentV1,
    _command: RemoveUnusedProjectMaterialsCommand,
) -> ProjectDocumentV1:
    return ops.replace_project_materials(body, used_project_materials(body))


def remove_project_material(body: ProjectDocumentV1, command: RemoveProjectMaterialCommand) -> ProjectDocumentV1:
    ops.find_project_material(body.tables.project_materials, command.project_material_id)
    if command.project_material_id in used_project_material_ids(body):
        raise api_error(
            status.HTTP_409_CONFLICT,
            "project_material_in_use",
            "Only unused project materials can be removed.",
            {"project_material_id": command.project_material_id},
        )
    return ops.replace_project_materials(
        body,
        [material for material in body.tables.project_materials if material.id != command.project_material_id],
    )


def refresh_project_material_from_catalog(
    conn: Connection[Any],
    body: ProjectDocumentV1,
    command: RefreshProjectMaterialFromCatalogCommand,
) -> ProjectDocumentV1:
    source = ops.find_project_material(body.tables.project_materials, command.project_material_id)
    origin = source.catalog_origin
    if origin is None:
        raise api_error(
            status.HTTP_409_CONFLICT,
            "project_material_has_no_catalog_origin",
            "Only catalog-origin project materials can be refreshed.",
            {"project_material_id": command.project_material_id},
        )
    row = catalog_materials_repository.get_material(conn, origin.catalog_record_id)
    if row is None:
        raise api_error(
            status.HTTP_409_CONFLICT,
            "catalog_material_source_missing",
            "The source catalog material no longer exists.",
            {"catalog_material_id": origin.catalog_record_id},
        )
    if not row["is_active"]:
        raise api_error(
            status.HTTP_409_CONFLICT,
            "catalog_material_source_deactivated",
            "The source catalog material is deactivated.",
            {"catalog_material_id": origin.catalog_record_id},
        )

    next_values = refresh_values(source, row, command.field_choices)
    refreshed = source.model_copy(
        update={
            **next_values,
            "catalog_origin": origin.model_copy(update={"synced_at": datetime.now(UTC)}),
        }
    )
    return ops.replace_project_materials(
        body,
        [
            refreshed if material.id == command.project_material_id else material
            for material in body.tables.project_materials
        ],
    )


def assign_segment_material(
    body: ProjectDocumentV1,
    assembly_id: str,
    layer_id: str,
    segment_id: str,
    project_material_id: str | None,
) -> ProjectDocumentV1:
    return ops.update_segment(
        body,
        assembly_id,
        layer_id,
        segment_id,
        lambda segment: segment.model_copy(update={"project_material_id": project_material_id}),
    )


def project_material_from_catalog(row: dict[str, Any]) -> ProjectMaterial:
    return ProjectMaterial(
        id=new_id(ID_PREFIX_PROJECT_MATERIAL),
        name=row["name"],
        category=row["category"],
        density_kg_m3=row["density_kg_m3"],
        specific_heat_j_kgk=row["specific_heat_j_kgk"],
        conductivity_w_mk=row["conductivity_w_mk"],
        emissivity=row["emissivity"],
        color=row["color"],
        source=row["source"],
        url=row["url"],
        comments=row["comments"],
        specification_status="missing",
        datasheet_asset_ids=[],
        catalog_origin=CatalogOrigin(
            catalog_table="materials",
            catalog_record_id=row["id"],
            synced_at=datetime.now(UTC),
            local_overrides=[],
        ),
    )


def changed_project_material_values(material: ProjectMaterial, changed: dict[str, Any]) -> dict[str, Any]:
    update_values = dict(changed)
    if material.catalog_origin is None:
        return update_values

    overrides = set(material.catalog_origin.local_overrides)
    for field_name in PROJECT_MATERIAL_OVERRIDE_FIELDS.intersection(changed):
        if getattr(material, field_name) != changed[field_name]:
            overrides.add(field_name)
    update_values["catalog_origin"] = material.catalog_origin.model_copy(update={"local_overrides": sorted(overrides)})
    return update_values


def refresh_values(
    material: ProjectMaterial,
    catalog_row: dict[str, Any],
    choices: list[ProjectMaterialRefreshChoice],
) -> dict[str, Any]:
    choices_by_key = {choice.key: choice for choice in choices}
    unknown = sorted(set(choices_by_key) - set(PROJECT_MATERIAL_CATALOG_FIELDS))
    if unknown:
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "unknown_project_material_refresh_field",
            "Refresh choices include fields that cannot be refreshed from the materials catalog.",
            {"fields": unknown},
        )
    values: dict[str, Any] = {}
    for key in PROJECT_MATERIAL_CATALOG_FIELDS:
        choice = choices_by_key.get(key)
        if choice is None or choice.action == "keep_mine":
            values[key] = getattr(material, key)
        elif choice.action == "take_catalog":
            values[key] = catalog_row[key]
        else:
            values[key] = choice.value
    return values


def used_project_materials(body: ProjectDocumentV1) -> list[ProjectMaterial]:
    used_ids = used_project_material_ids(body)
    return [material for material in body.tables.project_materials if material.id in used_ids]


def used_project_material_ids(body: ProjectDocumentV1) -> set[str]:
    return {
        segment.project_material_id
        for assembly in body.tables.assemblies
        for layer in assembly.layers
        for segment in layer.segments
        if segment.project_material_id is not None
    }

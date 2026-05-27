"""Envelope read and semantic command workflows."""

from __future__ import annotations

import secrets
from collections.abc import Callable
from datetime import UTC, datetime
from typing import Any, Literal, NoReturn
from uuid import UUID

from psycopg import Connection
from starlette import status

from database import transaction
from features.catalogs.materials import repository as catalog_materials_repository
from features.envelope.models import (
    AddLayerCommand,
    AddSegmentCommand,
    AssemblyThermalResponse,
    CreateAssemblyCommand,
    DeleteAssemblyCommand,
    DeleteLayerCommand,
    DeleteSegmentCommand,
    DetachSegmentMaterialCommand,
    DuplicateAssemblyCommand,
    EnvelopeCommand,
    EnvelopeReadResponse,
    FlipLayersCommand,
    FlipOrientationCommand,
    HandEnterMaterialCommand,
    PasteAssignmentCommand,
    PickCatalogMaterialCommand,
    PickProjectMaterialCommand,
    RemoveUnusedProjectMaterialsCommand,
    RenameAssemblyCommand,
    UpdateAssemblyTypeCommand,
    UpdateLayerThicknessCommand,
    UpdateProjectMaterialCommand,
    UpdateSegmentCommand,
    UpdateSegmentUseSiteNotesCommand,
)
from features.envelope.selectors import build_envelope_read_parts
from features.envelope.thermal import calculate_assembly_thermal
from features.project_document import repository
from features.project_document.audit import log_document_action
from features.project_document.document import (
    Assembly,
    AssemblyLayer,
    AssemblySegment,
    CatalogOrigin,
    ProjectDocumentV1,
    ProjectMaterial,
)
from features.project_document.models import ProjectDocumentSource
from features.project_document.service import (
    document_etag,
    get_current_document_view,
    get_saved_document,
    next_draft_etag,
    validate_document,
)
from features.projects.access import ProjectAccess, require_editor_user
from features.shared.errors import api_error

ID_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789"
PROJECT_MATERIAL_OVERRIDE_FIELDS: frozenset[str] = frozenset(
    {
        "name",
        "category",
        "conductivity_w_mk",
        "density_kg_m3",
        "specific_heat_j_kgk",
        "emissivity",
        "argb_color",
    }
)


def get_envelope_read_model(
    version_id: UUID,
    access: ProjectAccess,
    source: ProjectDocumentSource,
) -> EnvelopeReadResponse:
    """Load the envelope slice from the saved version or user's draft."""
    if source == "version":
        body = get_saved_document(version_id, access)
        assemblies, project_materials = build_envelope_read_parts(body)
        return EnvelopeReadResponse(
            project_id=access.project_id,
            version_id=version_id,
            source="version",
            version_etag=document_etag(body),
            draft_etag=None,
            assemblies=assemblies,
            project_materials=project_materials,
        )

    view = get_current_document_view(version_id, access)
    assemblies, project_materials = build_envelope_read_parts(view.body)
    return EnvelopeReadResponse(
        project_id=access.project_id,
        version_id=version_id,
        source=view.source,
        version_etag=view.version_etag,
        draft_etag=view.draft_etag,
        assemblies=assemblies,
        project_materials=project_materials,
    )


def get_assembly_thermal_model(
    version_id: UUID,
    access: ProjectAccess,
    assembly_id: str,
    source: ProjectDocumentSource,
) -> AssemblyThermalResponse:
    """Load and calculate one assembly thermal overlay from draft or saved body."""
    if source == "version":
        body = get_saved_document(version_id, access)
        response_source: ProjectDocumentSource = "version"
    else:
        view = get_current_document_view(version_id, access)
        body = view.body
        response_source = view.source

    assembly = _find_assembly(body.tables.assemblies, assembly_id)
    result = calculate_assembly_thermal(
        assembly,
        {material.id: material for material in body.tables.project_materials},
    )
    return AssemblyThermalResponse(
        project_id=access.project_id,
        version_id=version_id,
        source=response_source,
        assembly_id=assembly_id,
        input_hash=result.input_hash,
        status=result.status,
        r_parallel_path_m2k_w=result.r_parallel_path_m2k_w,
        r_isothermal_planes_m2k_w=result.r_isothermal_planes_m2k_w,
        r_effective_m2k_w=result.r_effective_m2k_w,
        u_effective_w_m2k=result.u_effective_w_m2k,
        warnings=result.warnings,
    )


def apply_envelope_command(
    version_id: UUID,
    access: ProjectAccess,
    command: EnvelopeCommand,
    if_match: str | None,
    if_match_version: str | None,
) -> EnvelopeReadResponse:
    """Apply one semantic Assembly Builder command to the editor draft."""
    user = require_editor_user(access)

    with transaction() as conn:
        base_body, base_version_etag, version_etag, draft = _load_command_context(
            conn,
            access.project_id,
            version_id,
            user.id,
            if_match,
            if_match_version,
        )
        next_body = _apply_command(conn, base_body, command)

        if next_body == base_body:
            source: ProjectDocumentSource = "draft" if draft is not None else "version"
            assemblies, project_materials = build_envelope_read_parts(base_body)
            return EnvelopeReadResponse(
                project_id=access.project_id,
                version_id=version_id,
                source=source,
                version_etag=version_etag,
                draft_etag=draft["draft_etag"] if draft is not None else None,
                assemblies=assemblies,
                project_materials=project_materials,
            )

        draft_etag = repository.upsert_draft(
            conn,
            version_id,
            user.id,
            next_body,
            base_version_etag,
            next_draft_etag(next_body),
        )
        log_document_action(
            conn,
            "envelope_command",
            access,
            version_id,
            user.id,
            None,
            extra_details={"command_kind": command.kind},
        )

    assemblies, project_materials = build_envelope_read_parts(next_body)
    return EnvelopeReadResponse(
        project_id=access.project_id,
        version_id=version_id,
        source="draft",
        version_etag=version_etag,
        draft_etag=draft_etag,
        assemblies=assemblies,
        project_materials=project_materials,
    )


def _load_command_context(
    conn: Connection[Any],
    project_id: UUID,
    version_id: UUID,
    user_id: UUID,
    if_match: str | None,
    if_match_version: str | None,
) -> tuple[ProjectDocumentV1, str, str, dict[str, Any] | None]:
    version = repository.get_project_version_for_update(conn, project_id, version_id)
    if version is None:
        raise api_error(status.HTTP_404_NOT_FOUND, "project_version_not_found", "Project version not found.")
    if version["locked"]:
        raise api_error(status.HTTP_409_CONFLICT, "version_locked", "Locked versions cannot be edited.")

    version_body = validate_document(version["body"])
    version_etag = document_etag(version_body)
    draft = repository.get_draft_for_update(conn, version_id, user_id)

    if draft is None:
        if if_match_version != version_etag:
            raise api_error(
                status.HTTP_409_CONFLICT,
                "version_etag_mismatch",
                "The saved version changed before this envelope command was applied.",
                {"expected": version_etag},
            )
        return version_body, version_etag, version_etag, None

    if if_match != draft["draft_etag"]:
        raise api_error(
            status.HTTP_409_CONFLICT,
            "draft_etag_mismatch",
            "The draft changed before this envelope command was applied.",
            {"expected": draft["draft_etag"]},
        )
    return validate_document(draft["body"]), str(draft["base_version_etag"]), version_etag, draft


def _apply_command(conn: Connection[Any], body: ProjectDocumentV1, command: EnvelopeCommand) -> ProjectDocumentV1:
    if isinstance(command, CreateAssemblyCommand):
        return _replace_assemblies(body, _create_assembly(body.tables.assemblies, command))
    if isinstance(command, RenameAssemblyCommand):
        return _update_assembly(
            body,
            command.assembly_id,
            lambda assembly: assembly.model_copy(update={"name": command.name}),
        )
    if isinstance(command, UpdateAssemblyTypeCommand):
        return _update_assembly(
            body,
            command.assembly_id,
            lambda assembly: assembly.model_copy(update={"type": command.type}),
        )
    if isinstance(command, DuplicateAssemblyCommand):
        return _duplicate_assembly(body, command)
    if isinstance(command, DeleteAssemblyCommand):
        return _delete_assembly(body, command.assembly_id)
    if isinstance(command, AddLayerCommand):
        return _add_layer(body, command)
    if isinstance(command, UpdateLayerThicknessCommand):
        return _update_layer(
            body,
            command.assembly_id,
            command.layer_id,
            lambda layer: layer.model_copy(update={"thickness_mm": command.thickness_mm}),
        )
    if isinstance(command, DeleteLayerCommand):
        return _delete_layer(body, command)
    if isinstance(command, AddSegmentCommand):
        return _add_segment(body, command)
    if isinstance(command, UpdateSegmentCommand):
        return _update_segment(
            body,
            command.assembly_id,
            command.layer_id,
            command.segment_id,
            lambda segment: segment.model_copy(
                update={
                    "width_mm": command.width_mm,
                    "is_continuous_insulation": command.is_continuous_insulation,
                    "steel_stud_spacing_mm": command.steel_stud_spacing_mm,
                }
            ),
        )
    if isinstance(command, DeleteSegmentCommand):
        return _delete_segment(body, command)
    if isinstance(command, FlipOrientationCommand):
        return _update_assembly(body, command.assembly_id, _flipped_orientation)
    if isinstance(command, FlipLayersCommand):
        return _update_assembly(
            body,
            command.assembly_id,
            lambda assembly: assembly.model_copy(update={"layers": _renumber_layers(list(reversed(assembly.layers)))}),
        )
    if isinstance(command, PasteAssignmentCommand):
        _ensure_project_material_exists(body, command.project_material_id)
        return _update_segment(
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
    if isinstance(command, PickProjectMaterialCommand):
        _ensure_project_material_exists(body, command.project_material_id)
        return _assign_segment_material(
            body,
            command.assembly_id,
            command.layer_id,
            command.segment_id,
            command.project_material_id,
        )
    if isinstance(command, PickCatalogMaterialCommand):
        return _pick_catalog_material(conn, body, command)
    if isinstance(command, HandEnterMaterialCommand):
        return _hand_enter_material(body, command)
    if isinstance(command, UpdateProjectMaterialCommand):
        return _update_project_material(body, command)
    if isinstance(command, UpdateSegmentUseSiteNotesCommand):
        return _update_segment(
            body,
            command.assembly_id,
            command.layer_id,
            command.segment_id,
            lambda segment: segment.model_copy(update={"use_site_notes": command.use_site_notes}),
        )
    if isinstance(command, DetachSegmentMaterialCommand):
        return _detach_segment_material(body, command)
    if isinstance(command, RemoveUnusedProjectMaterialsCommand):
        return _replace_project_materials(body, _used_project_materials(body))
    raise api_error(status.HTTP_422_UNPROCESSABLE_ENTITY, "unknown_envelope_command", "Unknown envelope command.")


def _create_assembly(existing: list[Assembly], command: CreateAssemblyCommand) -> list[Assembly]:
    _ensure_unique_assembly_name(existing, command.name)
    assembly = Assembly(
        id=_new_id("asm"),
        name=command.name,
        type=command.type,
        orientation=command.orientation,
        layers=[
            AssemblyLayer(
                id=_new_id("lyr"),
                order=0,
                thickness_mm=command.thickness_mm,
                segments=[
                    AssemblySegment(
                        id=_new_id("seg"),
                        order=0,
                        width_mm=command.width_mm,
                    )
                ],
            )
        ],
    )
    return [*existing, assembly]


def _duplicate_assembly(body: ProjectDocumentV1, command: DuplicateAssemblyCommand) -> ProjectDocumentV1:
    source = _find_assembly(body.tables.assemblies, command.assembly_id)
    name = command.name.strip() if command.name else _next_copy_name(body.tables.assemblies, source.name)
    _ensure_unique_assembly_name(body.tables.assemblies, name)

    layers: list[AssemblyLayer] = []
    for layer in source.layers:
        segments = [
            segment.model_copy(
                update={
                    "id": _new_id("seg"),
                    "order": idx,
                    "photo_asset_ids": [],
                    "use_site_notes": None,
                }
            )
            for idx, segment in enumerate(layer.segments)
        ]
        layers.append(layer.model_copy(update={"id": _new_id("lyr"), "order": len(layers), "segments": segments}))

    copy = source.model_copy(update={"id": _new_id("asm"), "name": name, "layers": layers})
    return _replace_assemblies(body, [*body.tables.assemblies, copy])


def _delete_assembly(body: ProjectDocumentV1, assembly_id: str) -> ProjectDocumentV1:
    assemblies = body.tables.assemblies
    if not any(assembly.id == assembly_id for assembly in assemblies):
        _not_found("assembly", assembly_id)
    return _replace_assemblies(body, [assembly for assembly in assemblies if assembly.id != assembly_id])


def _add_layer(body: ProjectDocumentV1, command: AddLayerCommand) -> ProjectDocumentV1:
    def updater(assembly: Assembly) -> Assembly:
        target_index = _target_layer_index(assembly.layers, command.target_layer_id, command.position)
        width_mm = _layer_width(assembly.layers[max(0, min(target_index - 1, len(assembly.layers) - 1))])
        layer = AssemblyLayer(
            id=_new_id("lyr"),
            order=target_index,
            thickness_mm=command.thickness_mm,
            segments=[AssemblySegment(id=_new_id("seg"), order=0, width_mm=width_mm)],
        )
        layers = [*assembly.layers[:target_index], layer, *assembly.layers[target_index:]]
        return assembly.model_copy(update={"layers": _renumber_layers(layers)})

    return _update_assembly(body, command.assembly_id, updater)


def _delete_layer(body: ProjectDocumentV1, command: DeleteLayerCommand) -> ProjectDocumentV1:
    def updater(assembly: Assembly) -> Assembly:
        if len(assembly.layers) == 1:
            raise api_error(status.HTTP_409_CONFLICT, "last_layer", "An assembly must keep at least one layer.")
        if not any(layer.id == command.layer_id for layer in assembly.layers):
            _not_found("layer", command.layer_id)
        return assembly.model_copy(
            update={"layers": _renumber_layers([layer for layer in assembly.layers if layer.id != command.layer_id])}
        )

    return _update_assembly(body, command.assembly_id, updater)


def _add_segment(body: ProjectDocumentV1, command: AddSegmentCommand) -> ProjectDocumentV1:
    def layer_updater(layer: AssemblyLayer) -> AssemblyLayer:
        target_index = _target_segment_index(layer.segments, command.target_segment_id, command.position)
        segment = AssemblySegment(id=_new_id("seg"), order=target_index, width_mm=command.width_mm)
        segments = [*layer.segments[:target_index], segment, *layer.segments[target_index:]]
        return layer.model_copy(update={"segments": _renumber_segments(segments)})

    return _update_layer(body, command.assembly_id, command.layer_id, layer_updater)


def _delete_segment(body: ProjectDocumentV1, command: DeleteSegmentCommand) -> ProjectDocumentV1:
    def layer_updater(layer: AssemblyLayer) -> AssemblyLayer:
        if len(layer.segments) == 1:
            raise api_error(status.HTTP_409_CONFLICT, "last_segment", "A layer must keep at least one segment.")
        if not any(segment.id == command.segment_id for segment in layer.segments):
            _not_found("segment", command.segment_id)
        return layer.model_copy(
            update={"segments": _renumber_segments([seg for seg in layer.segments if seg.id != command.segment_id])}
        )

    return _update_layer(body, command.assembly_id, command.layer_id, layer_updater)


def _assign_segment_material(
    body: ProjectDocumentV1,
    assembly_id: str,
    layer_id: str,
    segment_id: str,
    project_material_id: str | None,
) -> ProjectDocumentV1:
    return _update_segment(
        body,
        assembly_id,
        layer_id,
        segment_id,
        lambda segment: segment.model_copy(update={"project_material_id": project_material_id}),
    )


def _pick_catalog_material(
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
        return _assign_segment_material(
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
    material = _project_material_from_catalog(row)
    body_with_material = _replace_project_materials(body, [*body.tables.project_materials, material])
    return _assign_segment_material(
        body_with_material,
        command.assembly_id,
        command.layer_id,
        command.segment_id,
        material.id,
    )


def _hand_enter_material(body: ProjectDocumentV1, command: HandEnterMaterialCommand) -> ProjectDocumentV1:
    material = ProjectMaterial(
        id=_new_id("pmat"),
        name=command.name,
        category=command.category,
        conductivity_w_mk=command.conductivity_w_mk,
        density_kg_m3=command.density_kg_m3,
        specific_heat_j_kgk=command.specific_heat_j_kgk,
        emissivity=command.emissivity,
        argb_color=command.argb_color or "(255,230,230,230)",
        specification_status="missing",
        datasheet_asset_ids=[],
        notes=None,
        catalog_origin=None,
    )
    body_with_material = _replace_project_materials(body, [*body.tables.project_materials, material])
    return _assign_segment_material(
        body_with_material,
        command.assembly_id,
        command.layer_id,
        command.segment_id,
        material.id,
    )


def _update_project_material(body: ProjectDocumentV1, command: UpdateProjectMaterialCommand) -> ProjectDocumentV1:
    changed = command.model_dump(exclude_unset=True, exclude={"kind", "project_material_id"})
    if not changed:
        _find_project_material(body.tables.project_materials, command.project_material_id)
        return body

    materials: list[ProjectMaterial] = []
    found = False
    for material in body.tables.project_materials:
        if material.id != command.project_material_id:
            materials.append(material)
            continue
        found = True
        update_values = _changed_project_material_values(material, changed)
        updated_material = material.model_copy(update=update_values)
        materials.append(updated_material)
    if not found:
        _not_found("project_material", command.project_material_id)
    return _replace_project_materials(body, materials)


def _detach_segment_material(body: ProjectDocumentV1, command: DetachSegmentMaterialCommand) -> ProjectDocumentV1:
    segment = _find_segment(body, command.assembly_id, command.layer_id, command.segment_id)
    if segment.project_material_id is None:
        raise api_error(
            status.HTTP_409_CONFLICT,
            "segment_has_no_material",
            "The segment does not have a material to detach.",
            {"segment_id": command.segment_id},
        )
    source = _find_project_material(body.tables.project_materials, segment.project_material_id)
    detached = source.model_copy(
        update={
            "id": _new_id("pmat"),
            "name": _next_custom_material_name(body.tables.project_materials, source.name),
            "catalog_origin": None,
        }
    )
    body_with_material = _replace_project_materials(body, [*body.tables.project_materials, detached])
    return _assign_segment_material(
        body_with_material,
        command.assembly_id,
        command.layer_id,
        command.segment_id,
        detached.id,
    )


def _update_assembly(
    body: ProjectDocumentV1,
    assembly_id: str,
    updater: Callable[[Assembly], Assembly],
) -> ProjectDocumentV1:
    found = False
    next_assemblies: list[Assembly] = []
    for assembly in body.tables.assemblies:
        if assembly.id == assembly_id:
            found = True
            next_assemblies.append(updater(assembly))
        else:
            next_assemblies.append(assembly)
    if not found:
        _not_found("assembly", assembly_id)
    return _replace_assemblies(body, next_assemblies)


def _update_layer(
    body: ProjectDocumentV1,
    assembly_id: str,
    layer_id: str,
    updater: Callable[[AssemblyLayer], AssemblyLayer],
) -> ProjectDocumentV1:
    def assembly_updater(assembly: Assembly) -> Assembly:
        found = False
        layers: list[AssemblyLayer] = []
        for layer in assembly.layers:
            if layer.id == layer_id:
                found = True
                layers.append(updater(layer))
            else:
                layers.append(layer)
        if not found:
            _not_found("layer", layer_id)
        return assembly.model_copy(update={"layers": layers})

    return _update_assembly(body, assembly_id, assembly_updater)


def _update_segment(
    body: ProjectDocumentV1,
    assembly_id: str,
    layer_id: str,
    segment_id: str,
    updater: Callable[[AssemblySegment], AssemblySegment],
) -> ProjectDocumentV1:
    def layer_updater(layer: AssemblyLayer) -> AssemblyLayer:
        found = False
        segments: list[AssemblySegment] = []
        for segment in layer.segments:
            if segment.id == segment_id:
                found = True
                segments.append(updater(segment))
            else:
                segments.append(segment)
        if not found:
            _not_found("segment", segment_id)
        return layer.model_copy(update={"segments": segments})

    return _update_layer(body, assembly_id, layer_id, layer_updater)


def _replace_assemblies(body: ProjectDocumentV1, assemblies: list[Assembly]) -> ProjectDocumentV1:
    raw = body.model_dump(mode="json")
    raw["tables"]["assemblies"] = [assembly.model_dump(mode="json") for assembly in assemblies]
    return validate_document(raw)


def _replace_project_materials(body: ProjectDocumentV1, materials: list[ProjectMaterial]) -> ProjectDocumentV1:
    if materials == body.tables.project_materials:
        return body
    raw = body.model_dump(mode="json")
    raw["tables"]["project_materials"] = [material.model_dump(mode="json") for material in materials]
    return validate_document(raw)


def _find_assembly(assemblies: list[Assembly], assembly_id: str) -> Assembly:
    for assembly in assemblies:
        if assembly.id == assembly_id:
            return assembly
    _not_found("assembly", assembly_id)


def _find_project_material(materials: list[ProjectMaterial], project_material_id: str) -> ProjectMaterial:
    for material in materials:
        if material.id == project_material_id:
            return material
    _not_found("project_material", project_material_id)


def _find_segment(
    body: ProjectDocumentV1,
    assembly_id: str,
    layer_id: str,
    segment_id: str,
) -> AssemblySegment:
    assembly = _find_assembly(body.tables.assemblies, assembly_id)
    for layer in assembly.layers:
        if layer.id != layer_id:
            continue
        for segment in layer.segments:
            if segment.id == segment_id:
                return segment
        _not_found("segment", segment_id)
    _not_found("layer", layer_id)


def _project_material_from_catalog(row: dict[str, Any]) -> ProjectMaterial:
    return ProjectMaterial(
        id=_new_id("pmat"),
        name=row["name"],
        category=row["category"],
        conductivity_w_mk=row["conductivity_w_mk"],
        density_kg_m3=row["density_kg_m3"],
        specific_heat_j_kgk=row["specific_heat_j_kgk"],
        emissivity=row["emissivity"],
        argb_color=row["argb_color"],
        specification_status="missing",
        datasheet_asset_ids=[],
        notes=row["notes"],
        catalog_origin=CatalogOrigin(
            catalog_table="materials",
            catalog_record_id=row["id"],
            catalog_version_id=row["current_version_id"],
            catalog_schema_version=row["catalog_schema_version"],
            synced_at=datetime.now(UTC),
            local_overrides=[],
        ),
    )


def _changed_project_material_values(material: ProjectMaterial, changed: dict[str, Any]) -> dict[str, Any]:
    update_values = dict(changed)
    if material.catalog_origin is None:
        return update_values

    overrides = set(material.catalog_origin.local_overrides)
    for field_name in PROJECT_MATERIAL_OVERRIDE_FIELDS.intersection(changed):
        if getattr(material, field_name) != changed[field_name]:
            overrides.add(field_name)
    update_values["catalog_origin"] = material.catalog_origin.model_copy(
        update={"local_overrides": sorted(overrides)}
    )
    return update_values


def _used_project_materials(body: ProjectDocumentV1) -> list[ProjectMaterial]:
    used_ids = {
        segment.project_material_id
        for assembly in body.tables.assemblies
        for layer in assembly.layers
        for segment in layer.segments
        if segment.project_material_id is not None
    }
    return [material for material in body.tables.project_materials if material.id in used_ids]


def _target_layer_index(
    layers: list[AssemblyLayer],
    target_layer_id: str | None,
    position: Literal["above", "below"],
) -> int:
    if target_layer_id is None:
        return len(layers)
    for index, layer in enumerate(layers):
        if layer.id == target_layer_id:
            return index if position == "above" else index + 1
    _not_found("layer", target_layer_id)


def _target_segment_index(
    segments: list[AssemblySegment],
    target_segment_id: str | None,
    position: Literal["left", "right"],
) -> int:
    if target_segment_id is None:
        return len(segments)
    for index, segment in enumerate(segments):
        if segment.id == target_segment_id:
            return index if position == "left" else index + 1
    _not_found("segment", target_segment_id)


def _renumber_layers(layers: list[AssemblyLayer]) -> list[AssemblyLayer]:
    return [layer.model_copy(update={"order": index}) for index, layer in enumerate(layers)]


def _renumber_segments(segments: list[AssemblySegment]) -> list[AssemblySegment]:
    return [segment.model_copy(update={"order": index}) for index, segment in enumerate(segments)]


def _flipped_orientation(assembly: Assembly) -> Assembly:
    orientation = "last_layer_outside" if assembly.orientation == "first_layer_outside" else "first_layer_outside"
    return assembly.model_copy(update={"orientation": orientation})


def _layer_width(layer: AssemblyLayer) -> float:
    return sum(segment.width_mm for segment in layer.segments)


def _ensure_project_material_exists(body: ProjectDocumentV1, project_material_id: str | None) -> None:
    if project_material_id is None:
        return
    if not any(material.id == project_material_id for material in body.tables.project_materials):
        raise api_error(
            status.HTTP_409_CONFLICT,
            "project_material_not_found",
            "The copied project material no longer exists.",
            {"project_material_id": project_material_id},
        )


def _ensure_unique_assembly_name(assemblies: list[Assembly], name: str) -> None:
    normalized = name.strip().casefold()
    if any(assembly.name.strip().casefold() == normalized for assembly in assemblies):
        raise api_error(
            status.HTTP_409_CONFLICT,
            "duplicate_assembly_name",
            "An assembly with that name already exists.",
            {"name": name},
        )


def _next_copy_name(assemblies: list[Assembly], source_name: str) -> str:
    names = {assembly.name.strip().casefold() for assembly in assemblies}
    base = f"{source_name} Copy"
    if base.casefold() not in names:
        return base
    for index in range(2, 1000):
        candidate = f"{base} {index}"
        if candidate.casefold() not in names:
            return candidate
    return f"{base} {_new_id('asm')}"


def _next_custom_material_name(materials: list[ProjectMaterial], source_name: str) -> str:
    names = {material.name.strip().casefold() for material in materials}
    base = f"{source_name} (Custom)"
    if base.casefold() not in names:
        return base
    for index in range(2, 1000):
        candidate = f"{base} {index}"
        if candidate.casefold() not in names:
            return candidate
    return f"{base} {_new_id('pmat')}"


def _new_id(prefix: str) -> str:
    return f"{prefix}_{''.join(secrets.choice(ID_ALPHABET) for _ in range(12))}"


def _not_found(entity: str, entity_id: str) -> NoReturn:
    raise api_error(
        status.HTTP_409_CONFLICT,
        f"{entity}_not_found",
        f"The target {entity} no longer exists.",
        {f"{entity}_id": entity_id},
    )

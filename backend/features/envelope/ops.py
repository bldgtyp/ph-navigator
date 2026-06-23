"""Shared document operations for envelope workflows."""

from __future__ import annotations

from collections.abc import Callable
from typing import Literal, NoReturn

from starlette import status

from features.project_document.document import (
    Assembly,
    AssemblyLayer,
    AssemblySegment,
    ProjectDocumentV1,
    ProjectMaterial,
)
from features.project_document.service import validate_document
from features.shared.errors import api_error


def update_assembly(
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
        not_found("assembly", assembly_id)
    return replace_assemblies(body, next_assemblies)


def update_layer(
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
            not_found("layer", layer_id)
        return assembly.model_copy(update={"layers": layers})

    return update_assembly(body, assembly_id, assembly_updater)


def update_segment(
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
            not_found("segment", segment_id)
        return layer.model_copy(update={"segments": segments})

    return update_layer(body, assembly_id, layer_id, layer_updater)


def replace_assemblies(body: ProjectDocumentV1, assemblies: list[Assembly]) -> ProjectDocumentV1:
    raw = body.model_dump(mode="json")
    raw["tables"]["assemblies"] = [assembly.model_dump(mode="json") for assembly in assemblies]
    return validate_document(raw)


def replace_project_materials(body: ProjectDocumentV1, materials: list[ProjectMaterial]) -> ProjectDocumentV1:
    if materials == body.tables.project_materials:
        return body
    raw = body.model_dump(mode="json")
    raw["tables"]["project_materials"] = [material.model_dump(mode="json") for material in materials]
    return validate_document(raw)


def replace_materials_and_assemblies(
    body: ProjectDocumentV1,
    materials: list[ProjectMaterial],
    assemblies: list[Assembly],
) -> ProjectDocumentV1:
    """Swap both tables in one pass so the document is validated only once.

    The combined document already carries the new materials, so the new
    assemblies' references resolve in a single ``validate_document`` — no
    intermediate dump+validate of a half-applied state (used by import).
    """
    raw = body.model_dump(mode="json")
    raw["tables"]["project_materials"] = [material.model_dump(mode="json") for material in materials]
    raw["tables"]["assemblies"] = [assembly.model_dump(mode="json") for assembly in assemblies]
    return validate_document(raw)


def find_assembly(assemblies: list[Assembly], assembly_id: str) -> Assembly:
    for assembly in assemblies:
        if assembly.id == assembly_id:
            return assembly
    not_found("assembly", assembly_id)


def find_project_material(materials: list[ProjectMaterial], project_material_id: str) -> ProjectMaterial:
    for material in materials:
        if material.id == project_material_id:
            return material
    not_found("project_material", project_material_id)


def find_segment(
    body: ProjectDocumentV1,
    assembly_id: str,
    layer_id: str,
    segment_id: str,
) -> AssemblySegment:
    assembly = find_assembly(body.tables.assemblies, assembly_id)
    for layer in assembly.layers:
        if layer.id != layer_id:
            continue
        for segment in layer.segments:
            if segment.id == segment_id:
                return segment
        not_found("segment", segment_id)
    not_found("layer", layer_id)


def target_layer_index(
    layers: list[AssemblyLayer],
    target_layer_id: str | None,
    position: Literal["above", "below"],
) -> int:
    if target_layer_id is None:
        return len(layers)
    for index, layer in enumerate(layers):
        if layer.id == target_layer_id:
            return index if position == "above" else index + 1
    not_found("layer", target_layer_id)


def target_segment_index(
    segments: list[AssemblySegment],
    target_segment_id: str | None,
    position: Literal["left", "right"],
) -> int:
    if target_segment_id is None:
        return len(segments)
    for index, segment in enumerate(segments):
        if segment.id == target_segment_id:
            return index if position == "left" else index + 1
    not_found("segment", target_segment_id)


def renumber_layers(layers: list[AssemblyLayer]) -> list[AssemblyLayer]:
    return [layer.model_copy(update={"order": index}) for index, layer in enumerate(layers)]


def renumber_segments(segments: list[AssemblySegment]) -> list[AssemblySegment]:
    return [segment.model_copy(update={"order": index}) for index, segment in enumerate(segments)]


def layer_width(layer: AssemblyLayer) -> float:
    return sum(segment.width_mm for segment in layer.segments)


def ensure_project_material_exists(body: ProjectDocumentV1, project_material_id: str | None) -> None:
    if project_material_id is None:
        return
    if not any(material.id == project_material_id for material in body.tables.project_materials):
        raise api_error(
            status.HTTP_409_CONFLICT,
            "project_material_not_found",
            "The copied project material no longer exists.",
            {"project_material_id": project_material_id},
        )


def ensure_unique_assembly_name(
    assemblies: list[Assembly],
    name: str,
    exclude_id: str | None = None,
) -> None:
    normalized = name.strip().casefold()
    for assembly in assemblies:
        if exclude_id is not None and assembly.id == exclude_id:
            continue
        if assembly.name.strip().casefold() == normalized:
            raise api_error(
                status.HTTP_409_CONFLICT,
                "duplicate_assembly_name",
                "An assembly with that name already exists.",
                {"name": name},
            )


def next_unique_name(existing: list[str], base: str, fallback_suffix: str) -> str:
    names = {name.strip().casefold() for name in existing}
    if base.casefold() not in names:
        return base
    # Human-readable suffixes cover normal use; after that, fall back to the ID keyspace.
    for index in range(2, 1000):
        candidate = f"{base} {index}"
        if candidate.casefold() not in names:
            return candidate
    return f"{base} {fallback_suffix}"


def not_found(entity: str, entity_id: str) -> NoReturn:
    raise api_error(
        status.HTTP_409_CONFLICT,
        f"{entity}_not_found",
        f"The target {entity} no longer exists.",
        {f"{entity}_id": entity_id},
    )

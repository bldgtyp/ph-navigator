"""Assembly-level envelope command handlers."""

from __future__ import annotations

from features.envelope import ops
from features.envelope.models import (
    CreateAssemblyCommand,
    DeleteAssemblyCommand,
    DuplicateAssemblyCommand,
    FlipLayersCommand,
    FlipOrientationCommand,
    RenameAssemblyCommand,
    UpdateAssemblyTypeCommand,
)
from features.project_document.document import Assembly, AssemblyLayer, AssemblySegment, ProjectDocumentV1


def create_assembly(body: ProjectDocumentV1, command: CreateAssemblyCommand) -> ProjectDocumentV1:
    ops.ensure_unique_assembly_name(body.tables.assemblies, command.name)
    assembly = Assembly(
        id=ops.new_id("asm"),
        name=command.name,
        type=command.type,
        orientation=command.orientation,
        layers=[
            AssemblyLayer(
                id=ops.new_id("lyr"),
                order=0,
                thickness_mm=command.thickness_mm,
                segments=[
                    AssemblySegment(
                        id=ops.new_id("seg"),
                        order=0,
                        width_mm=command.width_mm,
                    )
                ],
            )
        ],
    )
    return ops.replace_assemblies(body, [*body.tables.assemblies, assembly])


def rename_assembly(body: ProjectDocumentV1, command: RenameAssemblyCommand) -> ProjectDocumentV1:
    return ops.update_assembly(
        body,
        command.assembly_id,
        lambda assembly: assembly.model_copy(update={"name": command.name}),
    )


def update_assembly_type(body: ProjectDocumentV1, command: UpdateAssemblyTypeCommand) -> ProjectDocumentV1:
    return ops.update_assembly(
        body,
        command.assembly_id,
        lambda assembly: assembly.model_copy(update={"type": command.type}),
    )


def duplicate_assembly(body: ProjectDocumentV1, command: DuplicateAssemblyCommand) -> ProjectDocumentV1:
    source = ops.find_assembly(body.tables.assemblies, command.assembly_id)
    name = command.name.strip() if command.name else ops.next_copy_name(body.tables.assemblies, source.name)
    ops.ensure_unique_assembly_name(body.tables.assemblies, name)

    layers: list[AssemblyLayer] = []
    for layer in source.layers:
        segments = [
            segment.model_copy(
                update={
                    "id": ops.new_id("seg"),
                    "order": idx,
                    "photo_asset_ids": [],
                    "use_site_notes": None,
                }
            )
            for idx, segment in enumerate(layer.segments)
        ]
        layers.append(layer.model_copy(update={"id": ops.new_id("lyr"), "order": len(layers), "segments": segments}))

    copy = source.model_copy(update={"id": ops.new_id("asm"), "name": name, "layers": layers})
    return ops.replace_assemblies(body, [*body.tables.assemblies, copy])


def delete_assembly(body: ProjectDocumentV1, command: DeleteAssemblyCommand) -> ProjectDocumentV1:
    assemblies = body.tables.assemblies
    if not any(assembly.id == command.assembly_id for assembly in assemblies):
        ops.not_found("assembly", command.assembly_id)
    return ops.replace_assemblies(body, [assembly for assembly in assemblies if assembly.id != command.assembly_id])


def flip_orientation(body: ProjectDocumentV1, command: FlipOrientationCommand) -> ProjectDocumentV1:
    return ops.update_assembly(body, command.assembly_id, _flipped_orientation)


def flip_layers(body: ProjectDocumentV1, command: FlipLayersCommand) -> ProjectDocumentV1:
    return ops.update_assembly(
        body,
        command.assembly_id,
        lambda assembly: assembly.model_copy(update={"layers": ops.renumber_layers(list(reversed(assembly.layers)))}),
    )


def _flipped_orientation(assembly: Assembly) -> Assembly:
    orientation = "last_layer_outside" if assembly.orientation == "first_layer_outside" else "first_layer_outside"
    return assembly.model_copy(update={"orientation": orientation})

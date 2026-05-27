"""Layer and segment geometry command handlers."""

from __future__ import annotations

from starlette import status

from features.envelope import ops
from features.envelope.models import (
    AddLayerCommand,
    AddSegmentCommand,
    DeleteLayerCommand,
    DeleteSegmentCommand,
    UpdateLayerThicknessCommand,
    UpdateSegmentCommand,
    UpdateSegmentUseSiteNotesCommand,
)
from features.project_document.document import Assembly, AssemblyLayer, AssemblySegment, ProjectDocumentV1
from features.shared.errors import api_error


def add_layer(body: ProjectDocumentV1, command: AddLayerCommand) -> ProjectDocumentV1:
    def updater(assembly: Assembly) -> Assembly:
        target_index = ops.target_layer_index(assembly.layers, command.target_layer_id, command.position)
        width_mm = ops.layer_width(assembly.layers[max(0, min(target_index - 1, len(assembly.layers) - 1))])
        layer = AssemblyLayer(
            id=ops.new_id("lyr"),
            order=target_index,
            thickness_mm=command.thickness_mm,
            segments=[AssemblySegment(id=ops.new_id("seg"), order=0, width_mm=width_mm)],
        )
        layers = [*assembly.layers[:target_index], layer, *assembly.layers[target_index:]]
        return assembly.model_copy(update={"layers": ops.renumber_layers(layers)})

    return ops.update_assembly(body, command.assembly_id, updater)


def update_layer_thickness(body: ProjectDocumentV1, command: UpdateLayerThicknessCommand) -> ProjectDocumentV1:
    return ops.update_layer(
        body,
        command.assembly_id,
        command.layer_id,
        lambda layer: layer.model_copy(update={"thickness_mm": command.thickness_mm}),
    )


def delete_layer(body: ProjectDocumentV1, command: DeleteLayerCommand) -> ProjectDocumentV1:
    def updater(assembly: Assembly) -> Assembly:
        if len(assembly.layers) == 1:
            raise api_error(status.HTTP_409_CONFLICT, "last_layer", "An assembly must keep at least one layer.")
        if not any(layer.id == command.layer_id for layer in assembly.layers):
            ops.not_found("layer", command.layer_id)
        return assembly.model_copy(
            update={"layers": ops.renumber_layers([layer for layer in assembly.layers if layer.id != command.layer_id])}
        )

    return ops.update_assembly(body, command.assembly_id, updater)


def add_segment(body: ProjectDocumentV1, command: AddSegmentCommand) -> ProjectDocumentV1:
    def layer_updater(layer: AssemblyLayer) -> AssemblyLayer:
        target_index = ops.target_segment_index(layer.segments, command.target_segment_id, command.position)
        segment = AssemblySegment(id=ops.new_id("seg"), order=target_index, width_mm=command.width_mm)
        segments = [*layer.segments[:target_index], segment, *layer.segments[target_index:]]
        return layer.model_copy(update={"segments": ops.renumber_segments(segments)})

    return ops.update_layer(body, command.assembly_id, command.layer_id, layer_updater)


def update_segment(body: ProjectDocumentV1, command: UpdateSegmentCommand) -> ProjectDocumentV1:
    return ops.update_segment(
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


def delete_segment(body: ProjectDocumentV1, command: DeleteSegmentCommand) -> ProjectDocumentV1:
    def layer_updater(layer: AssemblyLayer) -> AssemblyLayer:
        if len(layer.segments) == 1:
            raise api_error(status.HTTP_409_CONFLICT, "last_segment", "A layer must keep at least one segment.")
        if not any(segment.id == command.segment_id for segment in layer.segments):
            ops.not_found("segment", command.segment_id)
        return layer.model_copy(
            update={"segments": ops.renumber_segments([seg for seg in layer.segments if seg.id != command.segment_id])}
        )

    return ops.update_layer(body, command.assembly_id, command.layer_id, layer_updater)


def update_segment_use_site_notes(
    body: ProjectDocumentV1,
    command: UpdateSegmentUseSiteNotesCommand,
) -> ProjectDocumentV1:
    return ops.update_segment(
        body,
        command.assembly_id,
        command.layer_id,
        command.segment_id,
        lambda segment: segment.model_copy(update={"use_site_notes": command.use_site_notes}),
    )

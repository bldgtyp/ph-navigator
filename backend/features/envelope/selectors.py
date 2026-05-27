"""Pure read-model selectors over the nested envelope document shape."""

from __future__ import annotations

from features.envelope.models import (
    AssemblyRead,
    AssemblySegmentTableRow,
    AssemblyThermalStatus,
    ProjectMaterialRead,
    ProjectMaterialUseSite,
)
from features.envelope.thermal import thermal_issues, thermal_status_from_issues
from features.project_document.document import Assembly, ProjectDocumentV1, ProjectMaterial


def build_envelope_read_parts(body: ProjectDocumentV1) -> tuple[list[AssemblyRead], list[ProjectMaterialRead]]:
    """Build Assembly Builder read DTOs from one pass over assemblies."""
    materials_by_id = {material.id: material for material in body.tables.project_materials}
    use_sites_by_material: dict[str, list[ProjectMaterialUseSite]] = {}
    assemblies: list[AssemblyRead] = []

    for assembly in body.tables.assemblies:
        assemblies.append(
            AssemblyRead(
                **assembly.model_dump(mode="python"),
                status=assembly_status(assembly, materials_by_id),
            )
        )
        for layer in assembly.layers:
            for segment in layer.segments:
                if segment.project_material_id is None:
                    continue
                use_sites_by_material.setdefault(segment.project_material_id, []).append(
                    ProjectMaterialUseSite(
                        assembly_id=assembly.id,
                        assembly_name=assembly.name,
                        layer_id=layer.id,
                        layer_order=layer.order,
                        segment_id=segment.id,
                        segment_order=segment.order,
                        use_site_notes=segment.use_site_notes,
                        photo_asset_ids=list(segment.photo_asset_ids),
                    )
                )

    materials = [
        ProjectMaterialRead(
            **material.model_dump(mode="python"),
            use_sites=use_sites_by_material.get(material.id, []),
        )
        for material in body.tables.project_materials
    ]
    return assemblies, materials


def assembly_status(
    assembly: Assembly,
    materials_by_id: dict[str, ProjectMaterial],
) -> AssemblyThermalStatus:
    """Compute early unfinished flags without doing thermal math."""
    return thermal_status_from_issues(thermal_issues(assembly, materials_by_id))


def flatten_assembly_segments(body: ProjectDocumentV1) -> list[AssemblySegmentTableRow]:
    """Flatten nested segments without making them the domain source."""
    materials_by_id = {material.id: material for material in body.tables.project_materials}
    rows: list[AssemblySegmentTableRow] = []
    for assembly in body.tables.assemblies:
        for layer in assembly.layers:
            for segment in layer.segments:
                material = materials_by_id.get(segment.project_material_id or "")
                rows.append(
                    AssemblySegmentTableRow(
                        id=segment.id,
                        assembly_id=assembly.id,
                        assembly_name=assembly.name,
                        layer_id=layer.id,
                        layer_order=layer.order,
                        segment_order=segment.order,
                        width_mm=segment.width_mm,
                        is_continuous_insulation=segment.is_continuous_insulation,
                        steel_stud_spacing_mm=segment.steel_stud_spacing_mm,
                        project_material_id=segment.project_material_id,
                        project_material_name=material.name if material is not None else None,
                        photo_asset_ids=list(segment.photo_asset_ids),
                        use_site_notes=segment.use_site_notes,
                    )
                )
    return rows

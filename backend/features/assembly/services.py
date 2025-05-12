# -*- Python Version: 3.11 (Render.com) -*

import json
import logging

from fastapi import Depends, Header, HTTPException, status
from honeybee_energy.construction.opaque import OpaqueConstruction
from honeybee_energy.material.opaque import EnergyMaterial
from sqlalchemy.orm import Session

from database import get_db
from db_entities.app import Project
from db_entities.assembly import Assembly, Layer, Material, Segment
from features.assembly.schema import (
    AddAssemblyRequest,
    AirTableMaterialSchema,
    AssemblyLayerSchema,
    AssemblySchema,
    CreateLayerRequest,
    CreateLayerSegmentRequest,
    DeleteAssemblyRequest,
    MaterialSchema,
    UpdateAssemblyNameRequest,
    UpdateLayerHeightRequest,
    UpdateSegmentMaterialRequest,
    UpdateSegmentWidthRequest,
)

logger = logging.getLogger(__name__)


async def get_all_assemblies(
    db: Session,
    project_bt_num: int,
) -> list[AssemblySchema]:
    """Get all assemblies for a specified project."""
    logger.info(f"get_assemblies_as_hbjson(project_bt_num={project_bt_num})")
    assemblies = (
        db.query(Assembly)
        .join(Project)
        .filter(Project.bt_number == project_bt_num)
        .all()
    )
    return [AssemblySchema.from_orm(assembly) for assembly in assemblies]


def get_layer_base_material(materials: list[EnergyMaterial]) -> EnergyMaterial:
    """Get the base material for a layer from a list of materials."""
    logger.info(f"get_layer_base_material(materials=[{len(materials)}])")
    if len(materials) == 1:
        return materials[0]

    # Return the material with the lowest conductivity
    min_conductivity_material = min(materials, key=lambda m: m.conductivity)

    # -- TODO: Pack the other materials into the ph-properties....
    return min_conductivity_material


def convert_assembly_layer_to_hb_material(layer: AssemblyLayerSchema) -> EnergyMaterial:
    """Convert an assembly layer to a Honeybee Energy Material."""
    # Create all of the HB Energy Materials
    segment_materials = [
        EnergyMaterial(
            identifier=segment.material.name,
            thickness=layer.thickness_mm,
            conductivity=segment.material.conductivity_w_mk,
            density=segment.material.density_kg_m3,
            specific_heat=segment.material.specific_heat_j_kgk,
        )
        for segment in layer.segments
    ]

    return get_layer_base_material(segment_materials)


async def convert_assemblies_to_hbjson(assemblies: list[AssemblySchema]) -> str:
    """Convert a list of assemblies to Honeybee JSON format."""
    logger.info(f"convert_assemblies_to_hbjson(assemblies=[{len(assemblies)}])")

    hb_constructions_ = (
        OpaqueConstruction(
            identifier=assembly.name,
            materials=[
                convert_assembly_layer_to_hb_material(layer)
                for layer in assembly.layers
            ],
        )
        for assembly in assemblies
    )

    return json.dumps([hb_const.to_dict() for hb_const in hb_constructions_])

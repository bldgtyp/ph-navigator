# -*- Python Version: 3.11 (Render.com) -*

import json
import logging

from honeybee_energy.construction.opaque import OpaqueConstruction
from sqlalchemy.orm import Session

from db_entities.app import Project
from db_entities.assembly import Assembly
from features.assembly.services.to_hbe_material_steel_stud import get_steel_stud_layers_as_hb_materials
from features.assembly.services.to_hbe_material_typical import convert_single_assembly_layer_to_hb_material

logger = logging.getLogger(__name__)


def convert_assemblies_to_hbe_constructions(assemblies: list[Assembly]) -> list[OpaqueConstruction]:
    """Convert a list of assemblies to Honeybee JSON format."""
    logger.info(f"convert_assemblies_to_hbe_constructions([{len(assemblies)}] assemblies)")

    constructions_ = []
    for assembly in assemblies:
        if assembly.is_steel_stud_assembly:
            materials = get_steel_stud_layers_as_hb_materials(assembly.layers)
        else:
            materials = [convert_single_assembly_layer_to_hb_material(layer) for layer in assembly.layers]

        # Create the OpaqueConstruction
        constructions_.append(OpaqueConstruction(identifier=assembly.name, materials=materials))

    return constructions_


def get_all_project_assemblies_as_hbjson(db: Session, bt_number: str) -> str:
    """Get all assemblies for a project and convert them to Honeybee JSON format."""
    logger.info(f"get_all_project_assemblies_as_hbjson({bt_number=})")

    # Get all the Assemblies for the project
    assemblies = db.query(Assembly).join(Project).filter(Project.bt_number == bt_number).all()

    # -- Convert the Assemblies to HBE-Constructions
    hbe_constructions = convert_assemblies_to_hbe_constructions(assemblies)

    # -- Convert the HBE-Constructions to JSON
    return json.dumps([hb_const.to_dict() for hb_const in hbe_constructions])

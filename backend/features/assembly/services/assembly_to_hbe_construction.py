# -*- Python Version: 3.11 (Render.com) -*

import logging

from honeybee_energy.construction.opaque import OpaqueConstruction

from db_entities.assembly import Assembly
from features.assembly.services.to_hbe_steel_stud_material import get_steel_stud_layers_as_hb_materials
from features.assembly.services.to_hbe_typical_material import convert_single_assembly_layer_to_hb_material

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

# -*- Python Version: 3.11 (Render.com) -*

import logging

from sqlalchemy.orm import Session

from honeybee import dictutil as hb_dict_util
from honeybee_energy.material.opaque import EnergyMaterial
from honeybee_energy import dictutil as energy_dict_util
from honeybee_energy.construction.opaque import OpaqueConstruction


from db_entities.assembly import Assembly, Layer, Segment, Material
from db_entities.app import Project


logger = logging.getLogger(__name__)


async def get_single_hb_construction_from_hbjson(data) -> OpaqueConstruction | None:
    """De-serialize a single HB OpaqueConstruction from HB-JSON data."""
    logger.info(f"get_single_hb_construction_from_json(data={data['type']}...)")

    hb_objs = hb_dict_util.dict_to_object(data, False)
    
    if hb_objs is None:  # try to re-serialize it as an energy object
        hb_objs = energy_dict_util.dict_to_object(data, False)

    if not isinstance(hb_objs, OpaqueConstruction):
        logger.warning(f"HB-Object provided of type: {type(hb_objs)} is not construction. Ignoring.")
        return None
    
    return hb_objs


async def get_hb_constructions_from_hbjson(data) -> list[OpaqueConstruction]:
    """De-serialize a list of HB OpaqueConstructions from HB-JSON data."""
    logger.info("hb_constructions_from_hbjson(data=...)")   

    hb_objs = []
    if 'type' in data:
        # Is a single object
        if hb_const:= await get_single_hb_construction_from_hbjson(data):
            hb_objs.append(hb_const)

    else:  
        # no 'type' key means it must be a group of objects
        for hb_dict in data.values():
            if hb_const:= await get_single_hb_construction_from_hbjson(hb_dict):
                hb_objs.append(hb_const)

    return hb_objs


async def get_material_from_hb_material(db: Session, hb_material: EnergyMaterial) -> Material:
    """Get a Material from the Database which matches the name of the HB-Material."""
    logger.info(f"get_material_from_hb_material(hb_material={hb_material.display_name})")

    if db_material := db.query(Material).filter_by(name=hb_material.display_name).first():
        return db_material
    
    raise ValueError(f"Material {hb_material.display_name} not found in database.")


async def create_segment_from_hb_material(db: Session, hb_material: EnergyMaterial) -> Segment:
    """Create a SegmentSchema from a Honeybee EnergyMaterial."""
    logger.info(f"create_segment_from_hb_material(hb_material={hb_material.display_name})")

    # Get the Segment-Material from the database
    db_material = await get_material_from_hb_material(db, hb_material)

    # Create a new Segment object
    new_segment = Segment(
        order=0,
        width_mm=1000,
    )
    db.add(new_segment)
    db.commit()
    db.refresh(new_segment)
    
    new_segment.material = db_material
    db.commit()
    db.refresh(new_segment)

    return new_segment


async def create_layer_from_hb_material(db: Session, hb_material: EnergyMaterial) -> Layer:
    """Create a new LayerSchema from a Honeybee EnergyMaterial."""
    logger.info(f"create_layer_from_hb_material(hb_material={hb_material.display_name})")
    
    # Create a new Segment from the Honeybee EnergyMaterial
    segment = await create_segment_from_hb_material(db, hb_material)

    # Create a new Layer object
    new_layer = Layer(
        order=0,
        thickness_mm=hb_material.thickness * 1000,
        segments=[],
    )
    db.add(new_layer)
    db.commit()
    db.refresh(new_layer)

    new_layer.segments.append(segment)
    db.commit()
    db.refresh(new_layer)

    return new_layer


async def create_assembly_from_hb_construction(db: Session, bt_number: int, hb_opaque_construction: OpaqueConstruction) -> Assembly:
    """Create an AssemblySchema from a Honeybee OpaqueConstruction."""
    logger.info(f"create_assembly_from_hb_construction(hb_opaque_construction={hb_opaque_construction.display_name})")
    
    # -- Check if the project exists
    project = db.query(Project).filter_by(bt_number=bt_number).first()
    if not project:
        raise ValueError(f"Project with id {bt_number} not found in database.")

    # -- Get or Create the Assembly
    if assembly := db.query(Assembly).filter_by(name=hb_opaque_construction.display_name, project_id=project.id).first():
        logger.warning(f"Assembly with name {assembly.name} already exists for project {project.id}. Updating.")
    else:
        logger.info(f"Creating new Assembly with name {hb_opaque_construction.display_name} for project {project.id}.") 
        assembly = Assembly(
            name=hb_opaque_construction.display_name,
            project=project,
            layers=[],
        )
        db.add(assembly)
        db.commit()
        db.refresh(assembly)

    # -- Build up all of the new Layers
    new_layers = []
    for m in hb_opaque_construction.materials:
        if not isinstance(m, EnergyMaterial):
            logger.warning(f"Material {getattr(m, 'display_name', str(m))} [{type(m)=}] is not an EnergyMaterial. Ignoring.")
            continue
        new_layers.append(await create_layer_from_hb_material(db, m))

    # -- Add the new layers to the Assembly
    assembly.remove_all_layers()
    db.commit()
    db.refresh(assembly)
    
    for layer in new_layers:
        assembly.layers.append(layer)

    db.commit()
    db.refresh(assembly)

    logger.info(f"Created / Updated Assembly: {assembly.name} with {len(assembly.layers)} layers.")

    return assembly


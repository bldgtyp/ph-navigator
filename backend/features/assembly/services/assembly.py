# -*- Python Version: 3.11 (Render.com) -*-

import json
import logging

from sqlalchemy.orm import Session

from db_entities.app import Project
from db_entities.assembly import Assembly, Layer, Segment
from features.app.services import get_project_by_bt_number
from features.assembly.services.assembly_to_hbe_construction import convert_assemblies_to_hbe_constructions
from features.assembly.services.layer import create_new_layer
from features.assembly.services.material import get_default_material
from features.assembly.services.segment import create_new_segment

logger = logging.getLogger(__name__)


class AssemblyNotFoundException(Exception):
    """Custom exception for missing assembly."""

    def __init__(self, assembly_id: int):
        logger.error(f"Assembly {assembly_id} not found.")
        super().__init__(f"Assembly {assembly_id} not found.")


def get_assembly_by_id(db: Session, assembly_id: int) -> Assembly:
    """Get an assembly by its ID."""
    logger.info(f"Fetching assembly with ID: {assembly_id}")

    assembly = db.query(Assembly).filter_by(id=assembly_id).first()
    if not assembly:
        raise AssemblyNotFoundException(assembly_id)
    return assembly


def get_all_project_assemblies(db: Session, bt_number: str) -> list[Assembly]:
    """Get all assemblies for a specific project by its bt_number."""
    logger.info(f"get_all_project_assemblies({bt_number=})")

    return db.query(Assembly).join(Project).filter(Project.bt_number == bt_number).all()


def get_all_project_assemblies_as_hbjson(db: Session, bt_number: str) -> str:

    # Get all the Assemblies for the project
    assemblies = db.query(Assembly).join(Project).filter(Project.bt_number == bt_number).all()

    # -- Convert the Assemblies to HBE-Constructions
    hbe_constructions = convert_assemblies_to_hbe_constructions(assemblies)

    # -- Convert the HBE-Constructions to JSON
    return json.dumps([hb_const.to_dict() for hb_const in hbe_constructions])


def create_new_assembly(
    db: Session,
    name: str,
    project_id: int,
) -> Assembly:
    """Add a new assembly to the database."""
    logger.info(f"create_new_assembly_in_db({name=}, {project_id=})")

    new_assembly = Assembly(
        name=name,
        project_id=project_id,
    )
    db.add(new_assembly)
    db.commit()
    db.refresh(new_assembly)
    return new_assembly


def create_new_assembly_on_project(
    db: Session,
    bt_number: str,
) -> Assembly:
    """Create a new assembly for a project identified by its bt_number."""
    logger.info(f"create_new_assembly_on_project({bt_number=})")

    project = get_project_by_bt_number(db, bt_number)
    new_assembly = Assembly.default(project=project, material=get_default_material(db))
    db.add(new_assembly)
    db.commit()
    db.refresh(new_assembly)

    return new_assembly


def add_layer_to_assembly(db: Session, assembly_id: int, layer: Layer) -> Assembly:
    """Add a layer to an assembly."""
    logger.info(f"add_layer_to_assembly({assembly_id=}, layer={layer.id})")

    assembly = get_assembly_by_id(db, assembly_id)

    # Shift the order of any existing layers
    db.query(Layer).filter(
        Layer.assembly_id == assembly.id,
        Layer.order >= layer.order,  # Shift only layers at or after the insertion point
    ).update({"order": Layer.order + 1}, synchronize_session="fetch")

    # Add the layer to the assembly
    assembly.layers.insert(layer.order, layer)
    db.commit()
    db.refresh(assembly)

    return assembly


def add_default_layer_to_assembly(db: Session, assembly_id: int, order: int) -> tuple[Assembly, Layer]:
    logger.info(f"add_default_layer_to_assembly({assembly_id=}, {order=})")

    THICKNESS_MM = 50.0
    WIDTH_MM = 812.8  # 32 inches

    assembly = get_assembly_by_id(db, assembly_id)
    mat = get_default_material(db)

    # Create a new Layer, new Segment
    layer = create_new_layer(db, assembly.id, THICKNESS_MM, order)
    seg = create_new_segment(db, layer.id, mat.id, WIDTH_MM, 0)

    add_layer_to_assembly(db, assembly.id, layer)

    return assembly, layer


def update_assembly_name(db: Session, assembly_id: int, new_name: str) -> Assembly:
    """Update the name of an Assembly."""
    logger.info(f"update_assembly_name({assembly_id=}, {new_name=})")

    assembly = get_assembly_by_id(db, assembly_id)
    assembly.name = new_name
    db.commit()
    db.refresh(assembly)

    return assembly


def delete_assembly(db: Session, assembly_id: int) -> None:
    """Delete an assembly and all its associated layers and segments."""
    logger.info(f"delete_assembly({assembly_id=})")

    assembly = get_assembly_by_id(db, assembly_id)

    # Delete all associated segments for each layer in the assembly
    db.query(Segment).filter(Segment.layer_id.in_(db.query(Layer.id).filter_by(assembly_id=assembly.id))).delete(
        synchronize_session="fetch"
    )

    # Delete all layers associated with the assembly
    db.query(Layer).filter_by(assembly_id=assembly.id).delete(synchronize_session="fetch")

    # Delete the assembly itself
    db.delete(assembly)
    db.commit()

    return None

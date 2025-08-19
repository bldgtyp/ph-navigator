# -*- Python Version: 3.11 -*-

import logging

from sqlalchemy.orm import Session

from db_entities.app import Project
from db_entities.assembly import Assembly, Layer, Segment
from features.app.services import get_project_by_bt_number
from features.assembly.services.layer import stage_duplicate_layer
from features.assembly.services.material import get_default_material

logger = logging.getLogger(__name__)


class AssemblyNotFoundException(Exception):
    """Custom exception for missing assembly."""

    def __init__(self, assembly_id: int):
        logger.error(f"Assembly {assembly_id} not found.")
        super().__init__(f"Assembly {assembly_id} not found.")


def get_assembly_by_id(db: Session, assembly_id: int) -> Assembly:
    """Get an assembly by its ID."""
    logger.info(f"get_assembly_by_id({assembly_id=})")

    assembly = db.query(Assembly).filter_by(id=assembly_id).first()
    if not assembly:
        raise AssemblyNotFoundException(assembly_id)
    return assembly


def get_assembly_by_name(db: Session, project_id: int, assembly_name: str) -> Assembly | None:
    """Get an assembly by its name and project ID."""
    logger.info(f"get_assembly_by_name({assembly_name=}, {project_id=})")

    return db.query(Assembly).filter_by(name=assembly_name, project_id=project_id).first()


def get_all_project_assemblies(db: Session, bt_number: str) -> list[Assembly]:
    """Get all assemblies for a specific project by its 'bt_number'."""
    logger.info(f"get_all_project_assemblies({bt_number=})")

    return db.query(Assembly).join(Project).filter(Project.bt_number == bt_number).order_by(Assembly.name.asc()).all()


def create_new_empty_assembly_on_project(
    db: Session,
    name: str,
    bt_number: str,
) -> Assembly:
    """Add a new assembly on the Project."""
    logger.info(f"create_new_empty_assembly_on_project({name=}, {bt_number=})")

    project = get_project_by_bt_number(db, bt_number)
    new_assembly = Assembly(name=name, project_id=project.id)
    db.add(new_assembly)
    db.commit()
    db.refresh(new_assembly)
    return new_assembly


def create_new_default_assembly_on_project(db: Session, bt_number: str) -> Assembly:
    """Create a new a default Assembly with a default Layer on the Project."""
    logger.info(f"create_new_assembly_on_project({bt_number=})")

    project = get_project_by_bt_number(db, bt_number)
    new_assembly = Assembly.default(project=project, material=get_default_material(db))
    db.add(new_assembly)
    db.commit()
    db.refresh(new_assembly)

    return new_assembly


def insert_layer_into_assembly(db: Session, assembly_id: int, layer: Layer) -> tuple[Assembly, Layer]:
    """Insert a Layer to an Assembly Layer list at a specific location."""
    logger.info(f"insert_layer_into_assembly({assembly_id=}, layer={layer.id})")

    assembly = get_assembly_by_id(db, assembly_id)

    # Ensure the layer is in the session (handles both new and existing layers)
    layer.assembly_id = assembly.id
    db.add(layer)

    # Insert the layer into the assembly
    assembly.layers.insert(layer.order, layer)

    db.commit()
    db.refresh(assembly)

    return assembly, layer


def append_layer_to_assembly(db: Session, assembly_id: int, layer: Layer) -> tuple[Assembly, Layer]:
    """Append a Layer to the end of an Assembly Layer list."""
    logger.info(f"append_layer_to_assembly({assembly_id=}, layer={layer.id})")

    assembly = get_assembly_by_id(db, assembly_id)

    # Append to the end of the Layers list
    layer.order = len(assembly.layers)

    return insert_layer_into_assembly(db, assembly.id, layer)


def insert_default_layer_into_assembly(db: Session, assembly_id: int, order: int) -> tuple[Assembly, Layer]:
    """Insert a default Layer to an Assembly Layer list at a specific location."""
    logger.info(f"insert_default_layer_into_assembly({assembly_id=}, {order=})")

    assembly, default_layer = insert_layer_into_assembly(
        db=db, assembly_id=get_assembly_by_id(db, assembly_id).id, layer=Layer.default(get_default_material(db), order)
    )

    return assembly, default_layer


def append_default_layer_to_assembly(db: Session, assembly_id: int) -> tuple[Assembly, Layer]:
    """Append a default Layer to the end of an Assembly Layer list."""
    logger.info(f"append_default_layer_to_assembly({assembly_id=})")

    assembly = get_assembly_by_id(db, assembly_id)

    return insert_default_layer_into_assembly(db, assembly.id, len(assembly.layers))


def update_assembly_name(db: Session, assembly_id: int, new_name: str) -> Assembly:
    """Update the name of an Assembly."""
    logger.info(f"update_assembly_name({assembly_id=}, {new_name=})")

    assembly = get_assembly_by_id(db, assembly_id)
    assembly.name = new_name
    db.commit()
    db.refresh(assembly)

    return assembly


def delete_assembly(db: Session, assembly_id: int) -> None:
    """Delete an Assembly and all its associated Layers and Segments."""
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


def flip_assembly_orientation(db: Session, assembly: Assembly) -> Assembly:
    """Flip the orientation of the Assembly."""
    logger.info(f"flip_assembly_orientation({assembly.name=})")

    assembly.flip_orientation()
    db.commit()
    db.refresh(assembly)

    return assembly


def flip_assembly_layers(db: Session, assembly: Assembly) -> Assembly:
    """Flip (reverse) the layers of the Assembly."""
    logger.info(f"flip_assembly_layers({assembly.name=})")

    if not assembly.layers:
        return assembly

    # First, explicitly set new order values for all layers in reverse
    total_layers = len(assembly.layers)
    for layer in assembly.layers:
        # Calculate new reversed order
        layer.order = total_layers - layer.order - 1

    # Force flush to make sure order changes are in the database
    db.flush()

    # Explicitly reorder the assembly.layers collection based on the new order values
    assembly.layers.sort(key=lambda l: l.order)

    # Commit the changes to the database
    db.commit()

    # Refresh DB objects
    db.refresh(assembly)
    for layer in assembly.layers:
        db.refresh(layer)

    return assembly


def duplicate_assembly(db: Session, assembly: Assembly) -> Assembly:
    """Duplicate an Assembly and its Layers."""
    logger.info(f"duplicate_assembly({assembly.name=})")

    duplicated_assembly = Assembly(name=f"{assembly.name} (Copy)", project_id=assembly.project_id)
    db.add(duplicated_assembly)
    db.flush()  # Get the ID without committing

    # Duplicate all layers
    for layer in assembly.layers:
        # Use non-committing version of duplicate_layer
        stage_duplicate_layer(db, layer, duplicated_assembly.id)

    # Commit only once at the end
    db.commit()
    db.refresh(duplicated_assembly)
    return duplicated_assembly

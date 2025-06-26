# -*- Python Version: 3.11 -*-

import logging

from sqlalchemy.orm import Session

from db_entities.assembly import Layer
from features.assembly.services.segment import stage_duplicate_segment

logger = logging.getLogger(__name__)


class LayerNotFoundException(Exception):
    """Custom exception for missing layer."""

    def __init__(self, layer_id: int):
        logger.error(f"Layer '{layer_id}' not found.")
        super().__init__(f"Layer '{layer_id}' not found.")


class LastLayerAssemblyException(Exception):
    """Exception raised when trying to delete the last layer in an assembly."""

    def __init__(self, layer_id: int, assembly_id: int):
        logger.error(f"Cannot delete Layer-{layer_id}. It is the last layer in Assembly-{assembly_id}.")
        super().__init__(f"Cannot delete Layer-{layer_id}. It is the last layer in Assembly-{assembly_id}.")


def get_layer_by_id(db: Session, layer_id: int) -> Layer:
    """Get a layer by its ID."""
    logger.info(f"get_layer_by_id({layer_id=})")

    layer = db.query(Layer).filter_by(id=layer_id).first()
    if not layer:
        raise LayerNotFoundException(layer_id)
    return layer


def create_new_layer(thickness_mm: float = 50.0, order: int = 0) -> Layer:
    """Create a new Layer instance. This new Layer must next be added to an assembly."""
    logger.info(f"create_new_layer({thickness_mm=}, {order=})")

    return Layer(thickness_mm=thickness_mm, order=order)


def update_layer_thickness(db: Session, layer_id: int, new_thickness_mm: float) -> Layer:
    """Update the thickness of an existing layer."""
    logger.info(f"Updating layer {layer_id} thickness to {new_thickness_mm} mm")

    layer = get_layer_by_id(db, layer_id)

    layer.thickness_mm = new_thickness_mm
    db.commit()
    db.refresh(layer)

    return layer


def delete_layer(db: Session, layer_id: int) -> None:
    """Delete a layer from the database."""
    logger.info(f"Deleting layer with ID: {layer_id}")

    layer = get_layer_by_id(db, layer_id)
    if len(layer.assembly.layers) <= 1:
        raise LastLayerAssemblyException(layer_id=layer_id, assembly_id=layer.assembly_id)

    # Adjust the order of the remaining Layers in the assembly
    db.query(Layer).filter(
        Layer.assembly_id == layer.assembly_id,
        Layer.order >= layer.order,  # Shift only layers at or after the current layer
    ).update({"order": Layer.order - 1}, synchronize_session="fetch")

    layer = get_layer_by_id(db, layer_id)
    db.delete(layer)
    db.commit()


def stage_duplicate_layer(db: Session, layer: Layer, new_assembly_id: int) -> Layer:
    """Duplicate a layer without committing."""
    new_layer = Layer(
        thickness_mm=layer.thickness_mm,
        order=layer.order,
        assembly_id=new_assembly_id,  # Use the passed assembly ID
    )
    db.add(new_layer)
    db.flush()  # Get ID but don't commit
    
    # Duplicate segments without committing
    for segment in layer.segments:
        stage_duplicate_segment(db, segment, new_layer.id)
    
    return new_layer

def duplicate_layer(db: Session, layer: Layer) -> Layer:
    """Duplicate a layer, along with all its segments and return the new layer."""
    logger.info(f"duplicate_layer({layer.id=})")

    new_layer = stage_duplicate_layer(db, layer, layer.assembly_id)
    db.commit()
    db.refresh(new_layer)
    return new_layer


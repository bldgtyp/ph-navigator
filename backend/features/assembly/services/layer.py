# -*- Python Version: 3.11 (Render.com) -*-

import logging

from sqlalchemy.orm import Session

from db_entities.assembly import Layer

logger = logging.getLogger(__name__)


class LayerNotFoundException(Exception):
    """Custom exception for missing layer."""

    def __init__(self, layer_id: int):
        logger.error(f"Layer {layer_id} not found.")
        super().__init__(f"Layer {layer_id} not found.")


class LastLayerAssemblyException(Exception):
    """Exception raised when trying to delete the last layer in an assembly."""

    def __init__(self, layer_id: int, assembly_id: int):
        self.layer_id = layer_id
        self.assembly_id = assembly_id
        super().__init__(
            f"Cannot delete Layer-{layer_id}. Tt is the last layer in Assembly-{assembly_id}."
        )


def get_layer_by_id(db: Session, layer_id: int) -> Layer:
    """Get a layer by its ID."""
    logger.info(f"Fetching layer with ID: {layer_id}")

    layer = db.query(Layer).filter_by(id=layer_id).first()
    if not layer:
        raise LayerNotFoundException(layer_id)
    return layer


def create_new_layer_in_db(
    db: Session,
    assembly_id: int,
    thickness_mm: float,
    order: int,
) -> Layer:
    """Add a new layer to the database."""
    logger.info(f"Adding new layer with thickness {thickness_mm} mm")

    new_layer = Layer(thickness_mm=thickness_mm, assembly_id=assembly_id, order=order)
    db.add(new_layer)
    db.commit()
    db.refresh(new_layer)

    return new_layer


def update_layer_thickness(
    db: Session,
    layer_id: int,
    new_thickness_mm: float,
) -> Layer:
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

    # Check if this is the last Layer in the Assembly
    assembly_layers = db.query(Layer).filter_by(layer_id=layer_id).all()
    if len(assembly_layers) <= 1:
        raise LastLayerAssemblyException(
            layer_id=layer_id, assembly_id=layer.assembly_id
        )

    # Adjust the order of the remaining Layers in the assembly
    db.query(Layer).filter(
        Layer.assembly_id == layer.assembly_id,
        Layer.order >= layer.order,  # Shift only layers at or after the current layer
    ).update({"order": Layer.order - 1}, synchronize_session="fetch")

    layer = get_layer_by_id(db, layer_id)
    db.delete(layer)
    db.commit()

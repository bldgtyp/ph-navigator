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


def get_layer_by_id(layer_id: int, db: Session) -> Layer:
    """Get a layer by its ID."""
    logger.info(f"Fetching layer with ID: {layer_id}")

    layer = db.query(Layer).filter_by(id=layer_id).first()
    if not layer:
        raise LayerNotFoundException(layer_id)
    return layer

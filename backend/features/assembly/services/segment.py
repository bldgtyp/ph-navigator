# -*- Python Version: 3.11 (Render.com) -*-

import logging

from sqlalchemy.orm import Session

from db_entities.assembly import Segment
from features.assembly.services.layer import get_layer_by_id
from features.assembly.services.material import get_material_by_id

logger = logging.getLogger(__name__)


def add_layer_segment_to_db(
    layer_id: int, material_id: str, width_mm: float, order: int, db: Session
) -> Segment:
    """Add a new segment to a layer in the database."""
    logger.info(
        f"Adding segment to layer {layer_id} with material {material_id}, width {width_mm}, order {order}"
    )

    layer = get_layer_by_id(layer_id, db)
    material = get_material_by_id(material_id, db)

    # Shift the order of any existing segments
    db.query(Segment).filter(
        Segment.layer_id == layer.id,
        Segment.order >= order,  # Shift only segments at or after the insertion point
    ).update({"order": Segment.order + 1}, synchronize_session="fetch")

    # Create the new LayerSegment and Add it to the database
    new_segment = Segment(
        layer_id=layer.id,
        material_id=material.id,
        width_mm=width_mm,
        order=order,
    )
    db.add(new_segment)
    db.commit()
    db.refresh(new_segment)

    return new_segment

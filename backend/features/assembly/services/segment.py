# -*- Python Version: 3.11 -*-

import logging

from sqlalchemy.orm import Session

from db_entities.assembly import Segment
from db_entities.assembly.segment import SpecificationStatus
from features.assembly.services.material import get_material_by_id

logger = logging.getLogger(__name__)


class SegmentNotFoundException(Exception):
    """Exception raised when a Segment is not found in the database."""

    def __init__(self, segment_id: int):
        self.message = f"Segment with ID {segment_id} not found."
        logger.error(self.message)
        super().__init__(self.message)


class LastSegmentInLayerException(Exception):
    """Exception raised when trying to pop the last segment in a layer."""

    def __init__(self, segment_id: int, layer_id: int):
        logger.error(f"Cannot pop Segment {segment_id} as it is the last segment in Layer {layer_id}.")
        super().__init__(f"Cannot pop Segment {segment_id} as it is the last segment in Layer {layer_id}.")


def get_segment_by_id(db: Session, segment_id: int) -> Segment:
    """Get a Segment by its ID or raise SegmentNotFoundException."""
    logger.info(f"get_segment_by_id({segment_id=})")

    if segment := db.query(Segment).filter_by(id=segment_id).first():
        return segment

    raise SegmentNotFoundException(segment_id)


def create_new_segment(db: Session, layer_id: int, material_id: str, width_mm: float, order: int) -> Segment:
    """Create a new segment in the database."""
    logger.info(f"Adding segment to layer {layer_id} with material {material_id}, width {width_mm}, order {order}")

    # Shift the order of any existing segments
    db.query(Segment).filter(
        Segment.layer_id == layer_id,
        Segment.order >= order,  # Shift only segments at or after the insertion point
    ).update({"order": Segment.order + 1}, synchronize_session="fetch")

    # Create the new LayerSegment and Add it to the database
    new_segment = Segment(
        layer_id=layer_id,
        material_id=material_id,
        width_mm=width_mm,
        order=order,
    )
    db.add(new_segment)
    db.commit()
    db.refresh(new_segment)

    return new_segment


def update_segment_material(db: Session, segment_id: int, material_id: str) -> Segment:
    """Update the Material of a Segment."""
    logger.info(f"update_segment_material({segment_id=}, {material_id=})")

    new_material = get_material_by_id(db, material_id)
    seg = get_segment_by_id(db, segment_id)
    seg.material_id = new_material.id
    db.commit()
    db.refresh(seg)

    return seg


def update_segment_width(db: Session, segment_id: int, width_mm: float) -> Segment:
    """Update the width (mm) of a Segment."""
    logger.info(f"update_segment_width({segment_id=}, {width_mm=})")

    seg = get_segment_by_id(db, segment_id)
    seg.width_mm = width_mm
    db.commit()
    db.refresh(seg)

    return seg


def update_segment_steel_stud_spacing(db: Session, segment_id: int, steel_stud_spacing_mm: float | None) -> Segment:
    """Update the steel stud spacing of a Segment."""
    logger.info(f"update_segment_steel_stud_spacing({segment_id=}, {steel_stud_spacing_mm=})")

    seg = get_segment_by_id(db, segment_id)
    seg.steel_stud_spacing_mm = steel_stud_spacing_mm
    db.commit()
    db.refresh(seg)

    return seg


def update_segment_is_continuous_insulation(
    db: Session,
    segment_id: int,
    is_continuous_insulation: bool,
) -> Segment:
    """Update the is_continuous_insulation of a Segment."""
    logger.info(f"update_segment_is_continuous_insulation({segment_id=}, {is_continuous_insulation=})")

    seg = get_segment_by_id(db, segment_id)
    seg.is_continuous_insulation = is_continuous_insulation
    db.commit()
    db.refresh(seg)

    return seg


def update_segment_specification_status(
    db: Session,
    segment_id: int,
    specification_status: str,
) -> Segment:
    """Update the specification status of a Segment."""
    logger.info(f"update_segment_specification_status({segment_id=}, {specification_status=})")

    seg = get_segment_by_id(db, segment_id)
    try:
        seg.specification_status = SpecificationStatus(specification_status)
    except ValueError as e:
        logger.error(f"Invalid specification status: '{specification_status}'")
        raise ValueError(f"Invalid specification status: {specification_status}") from e
    db.commit()
    db.refresh(seg)

    return seg


def update_segment_notes(db: Session, segment_id: int, notes: str | None) -> Segment:
    """Update the notes of a Segment."""
    logger.info(f"update_segment_notes({segment_id=}, {notes=})")

    seg = get_segment_by_id(db, segment_id)
    seg.notes = notes
    db.commit()
    db.refresh(seg)

    return seg


def delete_segment(db: Session, segment_id: int) -> Segment:
    """Remove a Segment and adjust the order of remaining segments on it's Host Layer."""
    logger.info(f"Popping Segment with ID: {segment_id}")

    seg = get_segment_by_id(db, segment_id)

    # Check if this is the last Segment in the Layer
    layer_segments = db.query(Segment).filter_by(layer_id=seg.layer_id).all()
    if len(layer_segments) <= 1:
        raise LastSegmentInLayerException(segment_id=seg.id, layer_id=seg.layer_id)

    # Adjust the order of remaining Segments in the same Layer
    db.query(Segment).filter(Segment.layer_id == seg.layer_id, Segment.order > seg.order).update(
        {"order": Segment.order - 1}, synchronize_session="fetch"
    )

    db.delete(seg)
    db.commit()

    return seg


def stage_duplicate_segment(db: Session, segment: Segment, new_layer_id: int) -> Segment:
    """Duplicate a segment without committing."""
    new_segment = Segment(
        layer_id=new_layer_id,  # Use the passed layer ID
        material_id=segment.material_id,
        width_mm=segment.width_mm,
        order=segment.order,
        steel_stud_spacing_mm=segment.steel_stud_spacing_mm,
        is_continuous_insulation=segment.is_continuous_insulation,
    )
    db.add(new_segment)
    return new_segment


def duplicate_segment(db: Session, segment: Segment) -> Segment:
    """Duplicate a segment and return the new segment."""
    logger.info(f"duplicate_segment{segment.id=}")

    new_segment = stage_duplicate_segment(db, segment, segment.layer_id)
    db.commit()
    db.refresh(new_segment)
    return new_segment

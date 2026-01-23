# -*- Python Version: 3.11 -*-

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from config import limiter
from database import get_db
from features.assembly.schemas.segment import (
    CreateSegmentRequest,
    SegmentSchema,
    UpdateSegmentIsContinuousInsulationRequest,
    UpdateSegmentMaterialRequest,
    UpdateSegmentNotesRequest,
    UpdateSegmentSpecificationStatusRequest,
    UpdateSegmentSteelStudSpacingRequest,
    UpdateSegmentWidthRequest,
)
from features.assembly.services.segment import (
    LastSegmentInLayerException,
    create_new_segment,
    delete_segment,
    update_segment_is_continuous_insulation,
    update_segment_material,
    update_segment_notes,
    update_segment_specification_status,
    update_segment_steel_stud_spacing,
    update_segment_width,
)

router = APIRouter(
    prefix="/assembly",
    tags=["assembly"],
)

logger = logging.getLogger(__name__)


@router.post(
    "/create-new-segment-on-layer/{layer_id}",
    response_model=SegmentSchema,
    status_code=status.HTTP_201_CREATED,
)
def create_new_segment_on_layer_route(
    request: CreateSegmentRequest, layer_id: int, db: Session = Depends(get_db)
) -> SegmentSchema:
    """Add a new LayerSegment to a Layer at a specific position."""
    logger.info(
        f"assembly/add-create_new_segment_on_layer_route({layer_id=}, {request.material_id=}, {request.width_mm=}, {request.order=})"
    )

    try:
        seg = create_new_segment(db, layer_id, request.material_id, request.width_mm, request.order)
        return SegmentSchema.from_orm(seg)
    except Exception as e:
        logger.error(f"Error creating new segment: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create new segment: {str(e)}",
        )


@router.patch("/update-segment-material/{segment_id}", response_model=SegmentSchema)
def update_segment_material_route(
    segment_id: int,
    request: UpdateSegmentMaterialRequest,
    db: Session = Depends(get_db),
) -> SegmentSchema:
    """Update the Material of a Layer Segment."""
    logger.info(f"assembly/update_segment_material_route({segment_id=}, {request.material_id=})")

    try:
        seg = update_segment_material(db, segment_id, request.material_id)
        return SegmentSchema.from_orm(seg)
    except Exception as e:
        logger.error(f"Error updating segment material: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update segment material: {str(e)}",
        )


@router.patch("/update-segment-width/{segment_id}", response_model=SegmentSchema)
def update_segment_width_route(
    segment_id: int, request: UpdateSegmentWidthRequest, db: Session = Depends(get_db)
) -> SegmentSchema:
    """Update the width (mm) of a Layer Segment."""
    logger.info(f"assembly/update_segment_width_route({segment_id=}, {request.width_mm=})")

    try:
        seg = update_segment_width(db, segment_id, request.width_mm)
        return SegmentSchema.from_orm(seg)
    except Exception as e:
        logger.error(f"Error updating segment width: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update segment width: {str(e)}",
        )


@router.patch("/update-segment-steel-stud-spacing/{segment_id}", response_model=SegmentSchema)
def update_segment_steel_stud_spacing_route(
    segment_id: int,
    request: UpdateSegmentSteelStudSpacingRequest,
    db: Session = Depends(get_db),
) -> SegmentSchema:
    """Update the steel stud spacing of a Layer Segment."""
    logger.info(f"assembly/update_segment_steel_stud_spacing_route({segment_id=}, {request.steel_stud_spacing_mm=})")

    try:
        seg = update_segment_steel_stud_spacing(db, segment_id, request.steel_stud_spacing_mm)
        return SegmentSchema.from_orm(seg)
    except Exception as e:
        logger.error(f"Error updating segment steel stud spacing: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update segment steel stud spacing: {str(e)}",
        )


@router.patch(
    "/update-segment-is-continuous-insulation/{segment_id}",
    response_model=SegmentSchema,
)
def update_segment_is_continuous_insulation_route(
    segment_id: int,
    request: UpdateSegmentIsContinuousInsulationRequest,
    db: Session = Depends(get_db),
) -> SegmentSchema:
    """Update the continuous insulation flag of a Layer Segment."""
    logger.info(
        f"assembly/update_segment_is_continuous_insulation_route({segment_id=}, {request.is_continuous_insulation=})"
    )

    try:
        seg = update_segment_is_continuous_insulation(db, segment_id, request.is_continuous_insulation)
        return SegmentSchema.from_orm(seg)
    except Exception as e:
        logger.error(f"Error updating segment continuous insulation: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update segment continuous insulation: {str(e)}",
        )


@router.patch("/update-segment-specification-status/{segment_id}", response_model=SegmentSchema)
def update_segment_specification_status_route(
    segment_id: int,
    request: UpdateSegmentSpecificationStatusRequest,
    db: Session = Depends(get_db),
) -> SegmentSchema:
    """Update the specification status of a Layer Segment."""
    logger.info(f"assembly/update_segment_specification_status_route({segment_id=}, {request.specification_status=})")

    try:
        seg = update_segment_specification_status(db, segment_id, request.specification_status)
        return SegmentSchema.from_orm(seg)
    except Exception as e:
        logger.error(f"Error updating segment specification status: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update segment specification status: {str(e)}",
        )


@router.patch("/update-segment-notes/{segment_id}", response_model=SegmentSchema)
def update_segment_notes_route(
    segment_id: int,
    request: UpdateSegmentNotesRequest,
    db: Session = Depends(get_db),
) -> SegmentSchema:
    """Update the notes of a Layer Segment."""
    logger.info(f"assembly/update_segment_notes_route({segment_id=}, notes={str(request.notes)[0:10]})...")

    try:
        seg = update_segment_notes(db, segment_id, request.notes)
        return SegmentSchema.from_orm(seg)
    except Exception as e:
        logger.error(f"Error updating segment notes: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update segment notes: {str(e)}",
        )


@router.delete("/delete-segment/{segment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_segment_route(segment_id: int, db: Session = Depends(get_db)) -> None:
    """Delete a LayerSegment and adjust the order of remaining segments."""
    logger.info(f"assembly/delete-segment_route({segment_id=})")

    try:
        delete_segment(db, segment_id)
        return None
    except LastSegmentInLayerException as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

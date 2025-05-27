# -*- Python Version: 3.11 (Render.com) -*-

import logging

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from config import limiter
from database import get_db
from features.assembly.schemas.segment import (
    CreateLayerSegmentRequest,
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


# TODO: Change all these responses to return a Pydantic object instead?
# Will need to check the frontend to see what it expects?


@router.post("/create-new-segment/")
async def add_segment_route(request: CreateLayerSegmentRequest, db: Session = Depends(get_db)) -> JSONResponse:
    """Add a new LayerSegment to a Layer at a specific position."""
    logger.info(
        f"add-add_segment_route(layer_id={request.layer_id}, material_id={request.material_id}, width_mm={request.width_mm}, order={request.order})"
    )

    seg = create_new_segment(db, request.layer_id, request.material_id, request.width_mm, request.order)

    return JSONResponse(
        content={
            "message": "LayerSegment added successfully.",
            "segment_id": seg.id,
        },
        status_code=201,
    )


@router.patch("/update-segment-material/{segment_id}")
async def update_segment_material_route(
    segment_id: int,
    request: UpdateSegmentMaterialRequest,
    db: Session = Depends(get_db),
) -> JSONResponse:
    """Update the Material of a Layer Segment."""
    logger.info(f"update_segment_material_route({segment_id=}, material_id={request.material_id})")

    seg = update_segment_material(db, segment_id, request.material_id)

    return JSONResponse(
        content={
            "message": f"Segment {segment_id} updated with material {request.material_id}.",
            "material_id": request.material_id,
            "material_name": seg.material.name,
            "material_argb_color": seg.material.argb_color,
        },
        status_code=200,
    )


@router.patch("/update-segment-width/{segment_id}")
async def update_segment_width_route(
    segment_id: int, request: UpdateSegmentWidthRequest, db: Session = Depends(get_db)
) -> JSONResponse:
    """Update the width (mm) of a Layer Segment."""
    logger.info(f"update_segment_width_route({segment_id=}, width_mm={request.width_mm})")

    seg = update_segment_width(db, segment_id, request.width_mm)

    return JSONResponse(
        content={"message": f"Segment {seg.id} updated to new width: {seg.width_mm} mm."},
        status_code=200,
    )


@router.patch("/update-segment-steel-stud-spacing/{segment_id}")
async def update_segment_steel_stud_spacing_route(
    segment_id: int,
    request: UpdateSegmentSteelStudSpacingRequest,
    db: Session = Depends(get_db),
) -> JSONResponse:
    """Update the steel stud spacing of a Layer Segment."""
    logger.info(
        f"update_segment_steel_stud_spacing_route({segment_id=}, steel_stud_spacing_mm={request.steel_stud_spacing_mm})"
    )

    seg = update_segment_steel_stud_spacing(db, segment_id, request.steel_stud_spacing_mm)

    return JSONResponse(
        content={"message": f"Segment {seg.id} updated with new steel stud spacing: {seg.steel_stud_spacing_mm} mm."},
        status_code=200,
    )


@router.patch("/update-segment-continuous-insulation/{segment_id}")
async def update_segment_continuous_insulation_route(
    segment_id: int,
    request: UpdateSegmentIsContinuousInsulationRequest,
    db: Session = Depends(get_db),
) -> JSONResponse:
    """Update the continuous insulation flag of a Layer Segment."""
    logger.info(
        f"update_segment_continuous_insulation_route(segment_id={segment_id}, is_continuous_insulation={request.is_continuous_insulation})"
    )

    seg = update_segment_is_continuous_insulation(db, segment_id, request.is_continuous_insulation)

    return JSONResponse(
        content={
            "message": f"Segment {seg.id} updated with new continuous insulation flag {seg.is_continuous_insulation}."
        },
        status_code=200,
    )


@router.patch("/update-segment-specification-status/{segment_id}")
async def update_segment_specification_status_route(
    segment_id: int,
    request: UpdateSegmentSpecificationStatusRequest,
    db: Session = Depends(get_db),
) -> JSONResponse:
    """Update the specification status of a Layer Segment."""
    logger.info(
        f"update_segment_specification_status_route(segment_id={segment_id}, specification_status={request.specification_status})"
    )

    seg = update_segment_specification_status(db, segment_id, request.specification_status)

    return JSONResponse(
        content={"message": f"Segment {seg.id} updated with new specification status {seg.specification_status}."},
        status_code=200,
    )


@router.patch("/update-segment-notes/{segment_id}")
async def update_segment_route(
    segment_id: int,
    request: UpdateSegmentNotesRequest,
    db: Session = Depends(get_db),
) -> JSONResponse:
    """Update the notes of a Layer Segment."""
    logger.info(f"update_segment_notes_route({segment_id=}, notes={str(request.notes)[0:10]})...")

    seg = update_segment_notes(db, segment_id, request.notes)

    return JSONResponse(
        content={"message": f"Segment {seg.id} updated with new notes: {str(seg.notes)[0:10]})..."},
        status_code=200,
    )


@router.delete("/delete-segment/{segment_id}")
async def delete_segment_route(segment_id: int, db: Session = Depends(get_db)) -> JSONResponse:
    """Delete a LayerSegment and adjust the order of remaining segments."""
    logger.info(f"delete-segment_route(segment_id={segment_id})")

    try:
        delete_segment(db, segment_id)
        return JSONResponse(
            content={"message": f"Segment {segment_id} deleted successfully."},
            status_code=200,
        )
    except LastSegmentInLayerException as e:
        raise HTTPException(
            status_code=400,
            detail=str(e),
        )

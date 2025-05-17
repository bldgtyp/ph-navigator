# -*- Python Version: 3.11 (Render.com) -*-

import logging

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from config import limiter
from database import get_db
from db_entities.assembly import Layer, Material, Segment
from features.assembly.schemas.segment import (
    CreateLayerSegmentRequest,
    UpdateSegmentIsContinuousInsulationRequest,
    UpdateSegmentMaterialRequest,
    UpdateSegmentSteelStudSpacingRequest,
    UpdateSegmentWidthRequest,
)

router = APIRouter(
    prefix="/assembly",
    tags=["assembly"],
)

logger = logging.getLogger(__name__)


@router.post("/add_layer_segment/")
async def add_layer_segment(
    request: CreateLayerSegmentRequest, db: Session = Depends(get_db)
) -> JSONResponse:
    """Add a new LayerSegment to a Layer at a specific position."""
    logger.info(
        f"add_layer_segment(layer_id={request.layer_id}, material_id={request.material_id}, width_mm={request.width_mm}, order={request.order})"
    )

    # Check if the layer exists
    layer = db.query(Layer).filter_by(id=request.layer_id).first()
    if not layer:
        raise HTTPException(
            status_code=404, detail=f"Layer with ID {request.layer_id} not found."
        )

    # Check if the material exists
    material = db.query(Material).filter_by(id=request.material_id).first()
    if not material:
        raise HTTPException(
            status_code=404, detail=f"Material with ID {request.material_id} not found."
        )

    # Shift the order of existing segments
    db.query(Segment).filter(
        Segment.layer_id == layer.id,
        Segment.order
        >= request.order,  # Shift only segments at or after the insertion point
    ).update({"order": Segment.order + 1}, synchronize_session="fetch")

    # Create the new LayerSegment
    new_segment = Segment(
        layer_id=layer.id,
        material_id=request.material_id,
        width_mm=request.width_mm,
        order=request.order,
    )
    db.add(new_segment)
    db.commit()
    db.refresh(new_segment)

    return JSONResponse(
        content={
            "message": "LayerSegment added successfully.",
            "segment_id": new_segment.id,
        },
        status_code=201,
    )


@router.patch("/update_segment_material/{segment_id}")
async def update_segment_material(
    segment_id: int,
    request: UpdateSegmentMaterialRequest,
    db: Session = Depends(get_db),
) -> JSONResponse:
    """Update the Material of a Layer Segment."""
    logger.info(
        f"update_segment_material(segment_id={segment_id}, material_id={request.material_id})"
    )

    # Get the right segment from the database
    segment = db.query(Segment).filter_by(id=segment_id).first()
    if not segment:
        return JSONResponse(
            content={"message": f"Segment with ID {segment_id} not found."},
            status_code=404,
        )

    # Get the right material from the database
    material = db.query(Material).filter_by(id=request.material_id).first()
    if not material:
        return JSONResponse(
            content={"message": f"Material with ID {request.material_id} not found."},
            status_code=404,
        )

    # Update the segment's material
    segment.material = material
    db.commit()

    return JSONResponse(
        content={
            "message": f"Segment {segment_id} updated with material {request.material_id}.",
            "material_id": request.material_id,
            "material_name": material.name,
            "material_argb_color": material.argb_color,
        },
        status_code=200,
    )


@router.patch("/update_segment_width/{segment_id}")
async def update_segment_width(
    segment_id: int, request: UpdateSegmentWidthRequest, db: Session = Depends(get_db)
) -> JSONResponse:
    """Update the width (mm) of a Layer Segment."""
    logger.info(
        f"update_segment_width(segment_id={segment_id}, width_mm={request.width_mm})"
    )

    # Get the right segment from the database
    segment = db.query(Segment).filter_by(id=segment_id).first()
    if not segment:
        return JSONResponse(
            content={"message": f"Segment with ID {segment_id} not found."},
            status_code=404,
        )

    # Update the segment's width
    segment.width_mm = request.width_mm
    db.commit()

    return JSONResponse(
        content={
            "message": f"Segment {segment_id} updated with new width {request.width_mm}."
        },
        status_code=200,
    )


@router.patch("/update_segment_steel_stud_spacing/{segment_id}")
async def update_segment_steel_stud_spacing(
    segment_id: int,
    request: UpdateSegmentSteelStudSpacingRequest,
    db: Session = Depends(get_db),
) -> JSONResponse:
    """Update the steel stud spacing of a Layer Segment."""
    logger.info(
        f"update_segment_steel_stud_spacing(segment_id={segment_id}, steel_stud_spacing_mm={request.steel_stud_spacing_mm})"
    )

    # Get the right segment from the database
    segment = db.query(Segment).filter_by(id=segment_id).first()
    if not segment:
        return JSONResponse(
            content={"message": f"Segment with ID {segment_id} not found."},
            status_code=404,
        )

    # Update the segment's steel stud spacing
    if request.steel_stud_spacing_mm is not None:
        segment.steel_stud_spacing_mm = request.steel_stud_spacing_mm
    else:
        segment.steel_stud_spacing_mm = None
    db.commit()
    db.refresh(segment)

    return JSONResponse(
        content={
            "message": f"Segment {segment_id} updated with new steel stud spacing {request.steel_stud_spacing_mm}."
        },
        status_code=200,
    )


@router.patch("/update_segment_continuous_insulation/{segment_id}")
async def update_segment_continuous_insulation(
    segment_id: int,
    request: UpdateSegmentIsContinuousInsulationRequest,
    db: Session = Depends(get_db),
) -> JSONResponse:
    """Update the continuous insulation flag of a Layer Segment."""
    logger.info(
        f"update_segment_continuous_insulation(segment_id={segment_id}, is_continuous_insulation={request.is_continuous_insulation})"
    )

    # Get the right segment from the database
    segment = db.query(Segment).filter_by(id=segment_id).first()
    if not segment:
        return JSONResponse(
            content={"message": f"Segment with ID {segment_id} not found."},
            status_code=404,
        )

    # Update the segment's continuous insulation flag
    segment.is_continuous_insulation = request.is_continuous_insulation
    db.commit()
    db.refresh(segment)

    return JSONResponse(
        content={
            "message": f"Segment {segment_id} updated with new continuous insulation flag {request.is_continuous_insulation}."
        },
        status_code=200,
    )


@router.delete("/delete_layer_segment/{segment_id}")
async def delete_layer_segment(
    segment_id: int, db: Session = Depends(get_db)
) -> JSONResponse:
    """Delete a LayerSegment and adjust the order of remaining segments."""
    logger.info(f"delete_layer_segment(segment_id={segment_id})")

    # Fetch the segment to be deleted
    segment = db.query(Segment).filter_by(id=segment_id).first()
    if not segment:
        raise HTTPException(
            status_code=404, detail=f"Segment with ID {segment_id} not found."
        )

    # Check if this is the last segment in the layer
    layer_segments = db.query(Segment).filter_by(layer_id=segment.layer_id).all()
    if len(layer_segments) <= 1:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete the last segment in the layer. Delete the Layer instead.",
        )

    # Adjust the order of remaining segments
    db.query(Segment).filter(
        Segment.layer_id == segment.layer_id, Segment.order > segment.order
    ).update({"order": Segment.order - 1}, synchronize_session="fetch")

    # Delete the segment
    db.delete(segment)
    db.commit()

    return JSONResponse(
        content={"message": f"Segment {segment_id} deleted successfully."},
        status_code=200,
    )

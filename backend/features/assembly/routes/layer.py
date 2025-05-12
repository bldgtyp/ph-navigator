# -*- Python Version: 3.11 (Render.com) -*-

import logging

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from config import limiter
from database import get_db
from db_entities.assembly import Assembly, Layer, Material, Segment
from features.assembly.schemas.layer import (
    AssemblyLayerSchema,
    CreateLayerRequest,
    UpdateLayerHeightRequest,
)

router = APIRouter(
    prefix="/assembly",
    tags=["assembly"],
)

logger = logging.getLogger(__name__)


@router.post("/add_layer/")
async def add_layer(
    request: CreateLayerRequest, db: Session = Depends(get_db)
) -> JSONResponse:
    """Add a new Layer to an Assembly."""
    logger.info(f"add_layer(assembly_id={request.assembly_id}, order={request.order})")

    # Check if the assembly exists
    assembly = db.query(Assembly).filter_by(id=request.assembly_id).first()
    if not assembly:
        raise HTTPException(
            status_code=404, detail=f"Assembly with ID {request.assembly_id} not found."
        )

    # Shift the order of existing layers
    db.query(Layer).filter(
        Layer.assembly_id == assembly.id,
        Layer.order
        >= request.order,  # Shift only layers at or after the insertion point
    ).update({"order": Layer.order + 1}, synchronize_session="fetch")

    # Create the new Layer
    layer = Layer(
        assembly_id=assembly.id, thickness_mm=request.thickness_mm, order=request.order
    )

    # Add the new layer to the database
    db.add(layer)
    db.commit()
    db.refresh(layer)

    # Create a default LayerSegment for the new Layer
    # Just get the first material from the database for simplicity
    default_material = db.query(Material).first()
    default_segment = Segment(
        width_mm=812.8,  # 32 inches
        order=0,  # First segment in the layer
        layer=layer,
    )
    # default_segment.set_layer(layer)
    default_segment.material = default_material
    db.add(default_segment)
    db.commit()

    return JSONResponse(
        content={
            "message": "Layer added successfully.",
            "layer_id": layer.id,
            "segment_id": default_segment.id,
        },
        status_code=201,
    )


@router.get("/get_layer/{layer_id}")
async def get_layer(
    layer_id: int, db: Session = Depends(get_db)
) -> AssemblyLayerSchema:
    """Get a specific layer by ID."""
    logger.info(f"get_layer(layer_id={layer_id})")
    layer = db.query(Layer).filter_by(id=layer_id).first()
    if not layer:
        raise HTTPException(
            status_code=404, detail=f"Layer with ID {layer_id} not found."
        )
    return AssemblyLayerSchema.from_orm(layer)


@router.patch("/update_layer_thickness/{layer_id}")
async def update_layer_thickness(
    layer_id: int, request: UpdateLayerHeightRequest, db: Session = Depends(get_db)
) -> JSONResponse:
    """Update the height (mm) of a Layer."""
    logger.info(
        f"update_layer_height(layer_id={layer_id}, height_mm={request.thickness_mm})"
    )

    # Get the right layer from the database
    layer = db.query(Layer).filter_by(id=layer_id).first()
    if not layer:
        return JSONResponse(
            content={"message": f"Layer with ID {layer_id} not found."}, status_code=404
        )

    # Update the layer's thickness (mm)
    layer.thickness_mm = request.thickness_mm
    db.commit()

    return JSONResponse(
        content={
            "message": f"Layer {layer_id} updated with new height {request.thickness_mm}."
        },
        status_code=200,
    )


@router.delete("/delete_layer/{layer_id}")
async def delete_layer(layer_id: int, db: Session = Depends(get_db)) -> JSONResponse:
    """Delete a Layer and adjust the order of remaining layers."""
    logger.info(f"delete_layer(layer_id={layer_id})")

    # Fetch the layer to be deleted
    layer = db.query(Layer).filter_by(id=layer_id).first()
    if not layer:
        raise HTTPException(
            status_code=404, detail=f"Layer with ID {layer_id} not found."
        )

    # Check if this is the last layer in the assembly
    assembly_layers = db.query(Layer).filter_by(assembly_id=layer.assembly_id).all()
    if len(assembly_layers) <= 1:
        raise HTTPException(
            status_code=400, detail="Cannot delete the last layer in the assembly."
        )

    # Delete all associated segments for the layer
    db.query(Segment).filter_by(layer_id=layer.id).delete()

    # Adjust the order of remaining layers
    db.query(Layer).filter(
        Layer.assembly_id == layer.assembly_id, Layer.order > layer.order
    ).update({"order": Layer.order - 1}, synchronize_session="fetch")

    # Delete the layer
    db.delete(layer)
    db.commit()

    return JSONResponse(
        content={"message": f"Layer {layer_id} deleted successfully."}, status_code=200
    )

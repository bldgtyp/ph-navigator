# -*- Python Version: 3.11 (Render.com) -*-

import logging

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from config import limiter
from database import get_db
from features.assembly.schemas.layer import AssemblyLayerSchema, CreateLayerRequest, UpdateLayerHeightRequest
from features.assembly.services.assembly import add_default_layer_to_assembly
from features.assembly.services.layer import (
    LastLayerAssemblyException,
    delete_layer,
    get_layer_by_id,
    update_layer_thickness,
)

router = APIRouter(
    prefix="/assembly",
    tags=["assembly"],
)

logger = logging.getLogger(__name__)

# TODO: Change all these responses to return a Pydantic object instead?
# Will need to check the frontend to see what it expects?


@router.post("/add-layer/")
async def add_layer_to_assembly_route(request: CreateLayerRequest, db: Session = Depends(get_db)) -> JSONResponse:
    """Add a new Layer to an Assembly."""
    logger.info(f"add_layer_to_assembly_route(assembly_id={request.assembly_id}, order={request.order})")

    assembly, layer = add_default_layer_to_assembly(db, request.assembly_id, request.order)

    return JSONResponse(
        content={
            "message": "Layer added successfully.",
            "layer_id": layer.id,
            "segment_id": layer.segments[0].id,
        },
        status_code=201,
    )


@router.get("/get-layer/{layer_id}")
async def get_layer_route(layer_id: int, db: Session = Depends(get_db)) -> AssemblyLayerSchema:
    """Get a specific layer by ID."""
    logger.info(f"get_layer_route(layer_id={layer_id})")

    layer = get_layer_by_id(db, layer_id)

    return AssemblyLayerSchema.from_orm(layer)


@router.patch("/update-layer-thickness/{layer_id}")
async def update_layer_thickness_route(
    layer_id: int, request: UpdateLayerHeightRequest, db: Session = Depends(get_db)
) -> JSONResponse:
    """Update the thickness (mm) of a Layer."""
    logger.info(f"update_layer_thickness_route(layer_id={layer_id}, thickness_mm={request.thickness_mm})")

    layer = update_layer_thickness(db, layer_id, request.thickness_mm)

    return JSONResponse(
        content={"message": f"Layer {layer.id} updated to thickness: {layer.thickness_mm}."},
        status_code=200,
    )


@router.delete("/delete-layer/{layer_id}")
async def delete_layer_route(layer_id: int, db: Session = Depends(get_db)) -> JSONResponse:
    """Delete a Layer and adjust the order of remaining layers."""
    logger.info(f"delete_layer_route(layer_id={layer_id})")

    try:
        delete_layer(db, layer_id)
        return JSONResponse(
            content={"message": f"Segment {layer_id} deleted successfully."},
            status_code=200,
        )
    except LastLayerAssemblyException as e:
        raise HTTPException(
            status_code=400,
            detail=str(e),
        )

# -*- Python Version: 3.11 -*-

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from config import limiter
from database import get_db
from features.assembly.schemas.layer import CreateLayerRequest, LayerSchema, UpdateLayerHeightRequest
from features.assembly.services.assembly import insert_default_layer_into_assembly
from features.assembly.services.layer import (
    LastLayerAssemblyException,
    LayerNotFoundException,
    delete_layer,
    get_layer_by_id,
    update_layer_thickness,
)

router = APIRouter(
    prefix="/assembly",
    tags=["assembly"],
)

logger = logging.getLogger(__name__)


@router.post("/create-new-layer/", response_model=LayerSchema)
async def create_new_default_layer_on_assembly_route(
    request: CreateLayerRequest, db: Session = Depends(get_db)
) -> LayerSchema:
    """Create a new Layer on a specified Assembly."""
    logger.info(f"create_new_default_layer_on_assembly_route(assembly_id={request.assembly_id}, order={request.order})")

    try:
        assembly, layer = insert_default_layer_into_assembly(db, request.assembly_id, request.order)
        return LayerSchema.from_orm(layer)
    except Exception as e:
        logger.error(f"Error creating new layer: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/get-layer/{layer_id}")
async def get_layer_route(layer_id: int, db: Session = Depends(get_db)) -> LayerSchema:
    """Get a specific layer by ID."""
    logger.info(f"get_layer_route(layer_id={layer_id})")

    try:
        layer = get_layer_by_id(db, layer_id)
        return LayerSchema.from_orm(layer)
    except LayerNotFoundException as e:
        logger.warning(f"Layer not found: {e}")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Error retrieving layer: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.patch("/update-layer-thickness/{layer_id}", response_model=LayerSchema)
async def update_layer_thickness_route(
    layer_id: int, request: UpdateLayerHeightRequest, db: Session = Depends(get_db)
) -> LayerSchema:
    """Update the thickness (mm) of a Layer."""
    logger.info(f"update_layer_thickness_route(layer_id={layer_id}, thickness_mm={request.thickness_mm})")

    try:
        layer = update_layer_thickness(db, layer_id, request.thickness_mm)
        return LayerSchema.from_orm(layer)
    except Exception as e:
        logger.error(f"Error updating layer thickness: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.delete("/delete-layer/{layer_id}")
async def delete_layer_route(layer_id: int, db: Session = Depends(get_db)) -> None:
    """Delete a Layer and adjust the order of remaining layers."""
    logger.info(f"delete_layer_route(layer_id={layer_id})")

    try:
        delete_layer(db, layer_id)
        return None
    except LastLayerAssemblyException as e:
        raise HTTPException(status_code=status.HTTP_200_OK, detail=str(e))
    except Exception as e:
        logger.error(f"Error deleting layer: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

# -*- Python Version: 3.11 -*-

import json
import logging

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from config import limiter
from database import get_db
from features.assembly.schemas.assembly import AssemblySchema, UpdateAssemblyNameRequest
from features.assembly.services.assembly import (
    create_new_default_assembly_on_project,
    delete_assembly,
    duplicate_assembly,
    flip_assembly_layers,
    flip_assembly_orientation,
    get_all_project_assemblies,
    get_assembly_by_id,
    update_assembly_name,
)
from features.assembly.services.assembly_from_hbjson import (
    MaterialNotFoundException,
    create_assembly_from_hb_construction,
    get_multiple_hb_constructions_from_hbjson,
)
from features.assembly.services.to_hbe_construction import get_all_project_assemblies_as_hbjson_string

router = APIRouter(
    prefix="/assembly",
    tags=["assembly"],
)

logger = logging.getLogger(__name__)


@router.post(
    "/create-new-assembly-on-project/{bt_number}", response_model=AssemblySchema, status_code=status.HTTP_201_CREATED
)
@limiter.limit("10/minute")
def create_new_assembly_on_project_route(
    request: Request, bt_number: str, db: Session = Depends(get_db)
) -> AssemblySchema:
    """Add a new Assembly to a Project."""
    logger.info(f"assembly/create_new_assembly_on_project_route({bt_number=})")

    try:
        new_assembly = create_new_default_assembly_on_project(db, bt_number)
        return AssemblySchema.from_orm(new_assembly)
    except Exception as e:
        logger.error(f"Failed to create new assembly for project {bt_number}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create new assembly")


@router.post("/add-assemblies-from-hbjson-constructions/{bt_number}", status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
async def add_assemblies_from_hbjson_constructions_route(
    request: Request,
    bt_number: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> None:
    logger.info(f"assembly/add_assemblies_from_hbjson_constructions_route(bt_number={bt_number})")

    # -- Read in the file contents as JSON
    contents = await file.read()
    try:
        data = json.loads(contents)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid HB-JSON file provided.")

    # -- Convert the JSON data to HBE-Constructions,
    try:
        hb_constructions = get_multiple_hb_constructions_from_hbjson(data)
    except Exception as e:
        logger.error(f"Failed to convert JSON data to HB-Constructions: {e}")
        raise HTTPException(status_code=400, detail="Invalid HB-JSON format provided.")

    # -- Create Assemblies from HB-Constructions, and add them to the database
    try:
        for hb_const in hb_constructions:
            create_assembly_from_hb_construction(db, bt_number, hb_const)
        return None
    except MaterialNotFoundException as e:
        # Return a 400 status with the specific error message about missing materials
        logger.warning(f"Material not found error: {str(e)}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        # Generic server error for other issues
        logger.error(f"Failed to add assemblies from HB-JSON: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to add assemblies from HB-JSON"
        )


@router.get("/get-assemblies/{bt_number}", response_model=list[AssemblySchema])
@limiter.limit("30/minute")
def get_project_assemblies_route(
    request: Request, bt_number: str, db: Session = Depends(get_db)
) -> list[AssemblySchema]:
    """Get all assemblies for a specific project from the database."""
    logger.info(f"assembly/get_project_assemblies_route({bt_number=})")

    try:
        assemblies = get_all_project_assemblies(db, bt_number)
        return [AssemblySchema.from_orm(assembly) for assembly in assemblies]
    except Exception as e:
        logger.error(f"Failed to get assemblies for project {bt_number}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve assemblies")


@router.patch("/update-assembly-name/{assembly_id}", response_model=AssemblySchema)
@limiter.limit("10/minute")
def update_assembly_name_route(
    request: Request, update_request: UpdateAssemblyNameRequest, assembly_id: int, db: Session = Depends(get_db)
) -> AssemblySchema:
    """Update the name of an Assembly."""
    logger.info(f"assembly/update_assembly_name_route(assembly_id={assembly_id}, new_name={update_request.new_name})")

    try:
        assembly = update_assembly_name(db, assembly_id, update_request.new_name)
        return AssemblySchema.from_orm(assembly)
    except Exception as e:
        logger.error(f"Failed to update '{assembly_id=}' name to: '{e}'")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update assembly name")


@router.delete("/delete-assembly/{assembly_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_assembly_route(assembly_id: int, db: Session = Depends(get_db)) -> None:
    """Delete an Assembly and all its associated layers and segments."""
    logger.info(f"assembly/delete_assembly_route({assembly_id=})")

    try:
        delete_assembly(db, assembly_id)
        return None
    except Exception as e:
        logger.error(f"Failed to delete {assembly_id=}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to delete assembly")


@router.get("/get-assemblies-as-hbjson/{bt_number}")
@limiter.limit("10/minute")
def get_project_assemblies_as_hbjson_object_route(
    request: Request,
    bt_number: str,
    offset: int = Query(0, description="The offset for the function"),
    db: Session = Depends(get_db),
) -> JSONResponse:
    """Get all of the Project's Assemblies as Honeybee JSON.

    The format will follow the HBJSON Dump Objects, which outputs a single object:

    hb_constructions = {
        "Assembly 1: {....},
        "Assembly 2: {....},
        ...
    }
    """
    logger.info(f"assembly/get_project_assemblies_as_hbjson_object_route({bt_number=}, {offset=})")

    hbe_construction_json = get_all_project_assemblies_as_hbjson_string(db, bt_number)

    return JSONResponse(
        content={
            "hb_constructions": hbe_construction_json,
        },
        status_code=200,
    )


@router.patch("/flip-assembly-orientation/{assembly_id}", response_model=AssemblySchema)
@limiter.limit("20/minute")
def flip_assembly_orientation_route(
    request: Request, assembly_id: int, db: Session = Depends(get_db)
) -> AssemblySchema:
    """Flip the orientation of the Assembly."""
    logger.info(f"assembly/flip_assembly_orientation_route({assembly_id=})")

    try:
        assembly = get_assembly_by_id(db, assembly_id)
        flipped_assembly = flip_assembly_orientation(db, assembly)
        return AssemblySchema.from_orm(flipped_assembly)
    except Exception as e:
        logger.error(f"Failed to update '{assembly_id=}' name to: '{e}'")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to flip assembly orientation"
        )


@router.patch("/flip-assembly-layers/{assembly_id}", response_model=AssemblySchema)
def flip_assembly_layers_route(assembly_id: int, db: Session = Depends(get_db)):
    """Flip (reverse) the Layers of the Assembly."""
    logger.info(f"assembly/flip_assembly_layers_route({assembly_id=})")

    try:
        assembly = get_assembly_by_id(db, assembly_id)
        flipped_assembly = flip_assembly_layers(db, assembly)
        return AssemblySchema.from_orm(flipped_assembly)
    except Exception as e:
        logger.error(f"Failed to update '{assembly_id=}' name to: '{e}'")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to flip assembly layers")


@router.post("/duplicate-assembly/{assembly_id}", response_model=AssemblySchema)
def duplicate_assembly_route(assembly_id: int, db: Session = Depends(get_db)) -> AssemblySchema:
    """Duplicate an Assembly."""
    logger.info(f"assembly/duplicate_assembly_route({assembly_id=})")

    try:
        assembly = get_assembly_by_id(db, assembly_id)
        duplicated_assembly = duplicate_assembly(db, assembly)
        return AssemblySchema.from_orm(duplicated_assembly)
    except Exception as e:
        logger.error(f"Failed to duplicate assembly {assembly_id}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to duplicate assembly")

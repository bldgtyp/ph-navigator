# -*- Python Version: 3.11 -*-

import json
import logging

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from config import limiter
from database import get_db
from features.assembly.schemas.assembly import AssemblySchema, DeleteAssemblyRequest, UpdateAssemblyNameRequest
from features.assembly.services.assembly import (
    create_new_default_assembly_on_project,
    delete_assembly,
    get_all_project_assemblies,
    update_assembly_name,
)
from features.assembly.services.assembly_from_hbjson import (
    create_assembly_from_hb_construction,
    get_hb_constructions_from_hbjson,
)

router = APIRouter(
    prefix="/assembly",
    tags=["assembly"],
)

logger = logging.getLogger(__name__)


@router.post(
    "/create-new-assembly-on-project/{bt_number}", response_model=AssemblySchema, status_code=status.HTTP_201_CREATED
)
async def create_new_assembly_on_project_route(bt_number: str, db: Session = Depends(get_db)) -> AssemblySchema:
    """Add a new Assembly to a Project."""
    logger.info(f"assembly/create_new_assembly_on_project_route({bt_number=})")

    new_assembly = create_new_default_assembly_on_project(db, bt_number)
    return AssemblySchema.from_orm(new_assembly)


@router.post("/add-assemblies-from-hbjson-constructions/{bt_number}", status_code=status.HTTP_201_CREATED)
async def add_assemblies_from_hbjson_constructions_route(
    bt_number: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> None:
    logger.info(f"assembly/add_assemblies_from_hbjson_constructions_route(bt_number={bt_number})")

    # Read in the file contents as JSON
    contents = await file.read()
    try:
        data = json.loads(contents)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid HB-JSON file provided.")

    # Convert the JSON data to HBE-Constructions, then create Assemblies
    for hb_const in get_hb_constructions_from_hbjson(data):
        create_assembly_from_hb_construction(db, bt_number, hb_const)
    return None


@router.get("/get-assemblies/{bt_number}", response_model=list[AssemblySchema])
async def get_project_assemblies_route(bt_number: str, db: Session = Depends(get_db)) -> list[AssemblySchema]:
    """Get all assemblies for a specific project from the database."""
    logger.info(f"assembly/get_project_assemblies_route({bt_number=})")

    assemblies = get_all_project_assemblies(db, bt_number)
    return [AssemblySchema.from_orm(assembly) for assembly in assemblies]


@router.patch("/update-assembly-name/", response_model=AssemblySchema)
async def update_assembly_name_route(
    request: UpdateAssemblyNameRequest, db: Session = Depends(get_db)
) -> AssemblySchema:
    """Update the name of an Assembly."""
    logger.info(f"assembly/update_assembly_name_route(assembly_id={request.assembly_id}, new_name={request.new_name})")

    assembly = update_assembly_name(db, request.assembly_id, request.new_name)
    return AssemblySchema.from_orm(assembly)


@router.delete("/delete-assembly/")
async def delete_assembly_route(request: DeleteAssemblyRequest, db: Session = Depends(get_db)) -> None:
    """Delete an Assembly and all its associated layers and segments."""
    logger.info(f"assembly/delete_assembly_route(assembly_id={request.assembly_id})")

    delete_assembly(db, request.assembly_id)
    return None


# TODO: no route uses this endpoint? Remove? Update?
# @router.get("/get_assemblies_as_hb_json/{bt_number}")
# async def get_project_assemblies_as_hb_json_route(
#     bt_number: str,
#     offset: int = Query(0, description="The offset for the test function"),
#     db: Session = Depends(get_db),
# ) -> JSONResponse:
#     """Test function to check if the module is working."""
#     logger.info(f"assembly/get_project_assemblies_as_hb_json_route({bt_number=}, {offset=})")

#     hbe_construction_json = get_all_project_assemblies_as_hbjson(db, bt_number)

#     return JSONResponse(
#         content={
#             "message": "Test successful.",
#             "hb_constructions": hbe_construction_json,
#         },
#         status_code=200,
#     )

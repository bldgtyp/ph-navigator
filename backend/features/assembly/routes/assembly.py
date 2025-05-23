# -*- Python Version: 3.11 (Render.com) -*-

import json
import logging

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from config import limiter
from database import get_db
from db_entities.app import Project
from db_entities.assembly import Assembly, Layer, Material, Segment
from features.assembly.schemas.assembly import (
    AddAssemblyRequest,
    AssemblySchema,
    DeleteAssemblyRequest,
    UpdateAssemblyNameRequest,
)
from features.assembly.services.assembly_from_hbjson import (
    create_assembly_from_hb_construction,
    get_hb_constructions_from_hbjson,
)
from features.assembly.services.to_hbe_construction import convert_assemblies_to_hbe_constructions

router = APIRouter(
    prefix="/assembly",
    tags=["assembly"],
)

logger = logging.getLogger(__name__)


@router.post("/add_assembly/")
async def add_assembly(request: AddAssemblyRequest, db: Session = Depends(get_db)) -> JSONResponse:
    """Add a new Assembly to a Project."""
    logger.info(f"add_assembly(bt_number={request.bt_number})")

    # Check if the project exists
    project = db.query(Project).filter_by(bt_number=request.bt_number).first()
    if not project:
        raise HTTPException(
            status_code=404,
            detail=f"Project with bt_number {request.bt_number} not found.",
        )

    # Just use the 'first' material in the database for simplicity
    default_material = db.query(Material).first()
    assert default_material, "No Materials found in the database."

    # Create the new Assembly
    new_assembly = Assembly.default(project=project, material=default_material)
    db.add(new_assembly)
    db.commit()
    db.refresh(new_assembly)

    return JSONResponse(
        content={
            "message": "Assembly added successfully.",
            "assembly": {
                "id": new_assembly.id,
                "project_id": new_assembly.project_id,
            },
        },
        status_code=201,
    )


@router.post("/add-assemblies-from-hbjson-constructions/{bt_number}")
async def add_assemblies_from_hbjson_constructions(
    bt_number: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    logger.info(f"add_assemblies_from_hbjson_constructions(bt_number={bt_number})")

    # Read in the file contents as JSON
    contents = await file.read()
    try:
        data = json.loads(contents)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON file provided.")

    hb_constructions = await get_hb_constructions_from_hbjson(data)
    logger.info(f"hb_constructions: {len(hb_constructions)}")
    for hb_const in hb_constructions:
        assembly = await create_assembly_from_hb_construction(db, bt_number, hb_const)

    return None


@router.get("/get_assemblies/{bt_number}")
async def get_assemblies(bt_number: str, db: Session = Depends(get_db)) -> list[AssemblySchema]:
    """Get all assemblies for a specific project from the database."""
    logger.info(f"get_assemblies(bt_number={bt_number})")
    assemblies = db.query(Assembly).join(Project).filter(Project.bt_number == bt_number).all()
    return [AssemblySchema.from_orm(assembly) for assembly in assemblies]


@router.patch("/update_assembly_name/")
async def update_assembly_name(request: UpdateAssemblyNameRequest, db: Session = Depends(get_db)) -> JSONResponse:
    """Update the name of an Assembly."""
    logger.info(f"update_assembly_name(assembly_id={request.assembly_id}, new_name={request.new_name})")

    # Fetch the assembly to be updated
    assembly = db.query(Assembly).filter_by(id=request.assembly_id).first()
    if not assembly:
        raise HTTPException(status_code=404, detail=f"Assembly with ID {request.assembly_id} not found.")

    # Update the name
    assembly.name = request.new_name
    db.commit()

    return JSONResponse(
        content={
            "message": f"Assembly {request.assembly_id} name updated successfully.",
            "new_name": request.new_name,
        },
        status_code=200,
    )


@router.delete("/delete_assembly/")
async def delete_assembly(request: DeleteAssemblyRequest, db: Session = Depends(get_db)) -> JSONResponse:
    """Delete an Assembly and all its associated layers and segments."""
    logger.info(f"delete_assembly(assembly_id={request.assembly_id})")

    # Fetch the assembly to be deleted
    assembly = db.query(Assembly).filter_by(id=request.assembly_id).first()
    if not assembly:
        raise HTTPException(status_code=404, detail=f"Assembly with ID {request.assembly_id} not found.")

    # Delete all associated segments for each layer in the assembly
    db.query(Segment).filter(Segment.layer_id.in_(db.query(Layer.id).filter_by(assembly_id=assembly.id))).delete(
        synchronize_session="fetch"
    )

    # Delete all layers associated with the assembly
    db.query(Layer).filter_by(assembly_id=assembly.id).delete(synchronize_session="fetch")

    # Delete the assembly itself
    db.delete(assembly)
    db.commit()

    return JSONResponse(
        content={"message": f"Assembly {request.assembly_id} deleted successfully."},
        status_code=200,
    )


@router.get("/get_assemblies_as_hb_json/{bt_number}")
async def get_assemblies_as_hb_json(
    bt_number: str,
    offset: int = Query(0, description="The offset for the test function"),
    db: Session = Depends(get_db),
) -> JSONResponse:
    """Test function to check if the module is working."""
    logger.info(f"get_assemblies_as_hb_json(bt_number={bt_number}, offset={offset})")

    # Get all the Assemblies for the project
    assemblies = db.query(Assembly).join(Project).filter(Project.bt_number == bt_number).all()
    assemblies = [AssemblySchema.from_orm(assembly) for assembly in assemblies]

    # -- Convert the Assemblies to HBE-Constructions
    hbe_constructions = await convert_assemblies_to_hbe_constructions(assemblies)

    # -- Convert the HBE-Constructions to JSON
    hbe_construction_json = json.dumps([hb_const.to_dict() for hb_const in hbe_constructions])

    return JSONResponse(
        content={
            "message": "Test successful.",
            "hb_constructions": hbe_construction_json,
        },
        status_code=200,
    )

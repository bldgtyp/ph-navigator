# -*- Python Version: 3.11 (Render.com) -*-

import logging

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from pyairtable import Api
from pyairtable.api.types import RecordDict
from sqlalchemy.orm import Session

from config import limiter, settings
from database import get_db
from features.assembly.schema import (
    AirTableMaterialSchema,
    AssemblySchema,
    AssemblyLayerSchema,
    MaterialSchema,
    UpdateSegmentMaterialRequest,
    UpdateSegmentWidthRequest,
    UpdateLayerHeightRequest,
    CreateLayerSegmentRequest,
    CreateLayerRequest,
)
from db_entities.assembly import Material, Assembly, Segment, Layer

router = APIRouter(
    prefix="/assembly",
    tags=["assembly"],
)

logger = logging.getLogger(__name__)



@router.get("/load_materials_from_air_table")
async def load_materials_from_air_table(db: Session = Depends(get_db)) -> JSONResponse:
    """Load all of the records from the AirTable into the Database."""
    logger.info(f"load_materials_from_air_table()")
    
    # -- Go get the Materials from AirTable
    api = Api(settings.AIRTABLE_MATERIAL_GET_TOKEN)
    table = api.table(settings.AIRTABLE_MATERIAL_BASE_ID, settings.AIRTABLE_MATERIAL_TABLE_ID)
    material_records: list[RecordDict] = table.all()

    # -- Convert the records to AirTableMaterialSchema for validation
    materials: list[AirTableMaterialSchema] = []
    for record in material_records:
        d = {}
        d = d | record["fields"]
        d["id"] = record["id"]
        new_mat = AirTableMaterialSchema(**d)
        materials.append(new_mat)
    
    # -- Add the Materials to the database
    materials_added = 0
    materials_updated = 0
    for material in materials:
        # Check if the material already exists
        existing_material = db.query(Material).filter_by(id=material.id).first()
        if existing_material:
            # Update the existing record
            for key, value in material.dict().items():
                setattr(existing_material, key, value)
            materials_updated += 1
            logger.info(f"Updated material with ID: {material.id}")
        else:
            # Add a new record
            db_material = Material(**material.dict())
            db.add(db_material)
            logger.info(f"Added new material with ID: {material.id}")
            materials_added += 1

    db.commit()

    return JSONResponse(
            content={
                "message": "Materials loaded successfully",
                "materials_number_added": materials_added,
                "materials_number_updated": materials_updated,
                "material_total_count": len(materials),
            },
            status_code=200
        )


@router.get("/get_materials")
async def get_materials_from_air_table(db: Session = Depends(get_db)) -> list[MaterialSchema]:
    """Return all of the records from the AirTable Materials DataBase."""
    logger.info(f"get_materials()")
    materials = db.query(Material).all()
    return [MaterialSchema.from_orm(material) for material in materials]


@router.get("/get_assemblies")
async def get_assemblies(db: Session = Depends(get_db)) -> list[AssemblySchema]:
    """Get all assemblies from the database."""
    logger.info(f"get_assemblies()")
    assemblies = db.query(Assembly).all()
    return [AssemblySchema.from_orm(assembly) for assembly in assemblies]


@router.get("/get_layer/{layer_id}")
async def get_layer(layer_id: int, db: Session = Depends(get_db)) -> AssemblyLayerSchema:
    """Get a specific layer by ID."""
    logger.info(f"get_layer(layer_id={layer_id})")
    layer = db.query(Layer).filter_by(id=layer_id).first()
    if not layer:
        raise HTTPException(status_code=404, detail=f"Layer with ID {layer_id} not found.")
    return AssemblyLayerSchema.from_orm(layer)


@router.patch("/update_segment_material/{segment_id}")
async def update_segment_material(
    segment_id: int,
    request: UpdateSegmentMaterialRequest,
    db: Session = Depends(get_db)
) -> JSONResponse:
    """Update the Material of a Layer Segment."""
    logger.info(f"update_segment_material(segment_id={segment_id}, material_id={request.material_id})")

    # Get the right segment from the database
    segment = db.query(Segment).filter_by(id=segment_id).first()
    if not segment:
        return JSONResponse(
            content={"message": f"Segment with ID {segment_id} not found."},
            status_code=404
        )
    
    # Get the right material from the database
    material = db.query(Material).filter_by(id=request.material_id).first()
    if not material:
        return JSONResponse(
            content={"message": f"Material with ID {request.material_id} not found."},
            status_code=404
        )

    # Update the segment's material
    segment.set_material(material)
    db.commit()

    return JSONResponse(
        content={
            "message": f"Segment {segment_id} updated with material {request.material_id}.",
            "material_id": request.material_id,
            "material_name": material.name,
            "material_argb_color": material.argb_color,
            },
        status_code=200
    )


@router.patch("/update_segment_width/{segment_id}")
async def update_segment_width(
    segment_id: int,
    request: UpdateSegmentWidthRequest,
    db: Session = Depends(get_db)
) -> JSONResponse:
    """Update the width (mm) of a Layer Segment."""
    logger.info(f"update_segment_width(segment_id={segment_id}, width_mm={request.width_mm})")

    # Get the right segment from the database
    segment = db.query(Segment).filter_by(id=segment_id).first()
    if not segment:
        return JSONResponse(
            content={"message": f"Segment with ID {segment_id} not found."},
            status_code=404
        )

    # Update the segment's width
    segment.width_mm = request.width_mm
    db.commit()

    return JSONResponse(
        content={"message": f"Segment {segment_id} updated with new width {request.width_mm}."},
        status_code=200
    )


@router.patch("/update_layer_thickness/{layer_id}")
async def update_layer_thickness(
    layer_id: int,
    request: UpdateLayerHeightRequest,
    db: Session = Depends(get_db)
) -> JSONResponse:
    """Update the height (mm) of a Layer."""
    logger.info(f"update_layer_height(layer_id={layer_id}, height_mm={request.thickness_mm})")

    # Get the right layer from the database
    layer = db.query(Layer).filter_by(id=layer_id).first()
    if not layer:
        return JSONResponse(
            content={"message": f"Layer with ID {layer_id} not found."},
            status_code=404
        )

    # Update the layer's thickness (mm)
    layer.thickness_mm = request.thickness_mm
    db.commit()

    return JSONResponse(
        content={"message": f"Layer {layer_id} updated with new height {request.thickness_mm}."},
        status_code=200
    )


@router.post("/add_layer_segment/")
async def add_layer_segment(
    request: CreateLayerSegmentRequest,
    db: Session = Depends(get_db)
) -> JSONResponse:
    """Add a new LayerSegment to a Layer at a specific position."""
    logger.info(f"add_layer_segment(layer_id={request.layer_id}, material_id={request.material_id}, width_mm={request.width_mm}, order={request.order})")

    # Check if the layer exists
    layer = db.query(Layer).filter_by(id=request.layer_id).first()
    if not layer:
        raise HTTPException(status_code=404, detail=f"Layer with ID {request.layer_id} not found.")

    # Check if the material exists
    material = db.query(Material).filter_by(id=request.material_id).first()
    if not material:
        raise HTTPException(status_code=404, detail=f"Material with ID {request.material_id} not found.")

    # Shift the order of existing segments
    db.query(Segment).filter(
        Segment.layer_id == layer.id,
        Segment.order >= request.order  # Shift only segments at or after the insertion point
    ).update({"order": Segment.order + 1}, synchronize_session="fetch")

    # Create the new LayerSegment
    new_segment = Segment(
        layer_id=layer.id,
        material_id=request.material_id,
        width_mm=request.width_mm,
        order=request.order
    )
    db.add(new_segment)
    db.commit()
    db.refresh(new_segment)

    return JSONResponse(
        content={"message": "LayerSegment added successfully.", "segment_id": new_segment.id},
        status_code=201
    )


@router.post("/add_layer/")
async def add_layer(
    request: CreateLayerRequest,
    db: Session = Depends(get_db)
) -> JSONResponse:
    """Add a new Layer to an Assembly."""
    logger.info(f"add_layer(assembly_id={request.assembly_id}, order={request.order})")

    # Check if the assembly exists
    assembly = db.query(Assembly).filter_by(id=request.assembly_id).first()
    if not assembly:
        raise HTTPException(status_code=404, detail=f"Assembly with ID {request.assembly_id} not found.")

    # Shift the order of existing layers
    db.query(Layer).filter(
        Layer.assembly_id == assembly.id,
        Layer.order >= request.order  # Shift only layers at or after the insertion point
    ).update({"order": Layer.order + 1}, synchronize_session="fetch")

    # Create the new Layer
    layer = Layer(
        assembly_id=assembly.id,
        thickness_mm=request.thickness_mm,
        order=request.order
    )

    # Add the new layer to the database
    db.add(layer)
    db.commit()
    db.refresh(layer)

    # Create a default LayerSegment for the new Layer
    # Just get the first material from the database for simplicity
    default_material = db.query(Material).first()
    default_segment = Segment(
        width_mm=812.8, # 32 inches
        order=0         # First segment in the layer
    )
    default_segment.set_layer(layer)
    default_segment.set_material(default_material)
    db.add(default_segment)
    db.commit()

    return JSONResponse(
        content={
            "message": "Layer added successfully.",
            "layer_id": layer.id,
            "segment_id": default_segment.id
        },
        status_code=201
    )


@router.delete("/delete_layer_segment/{segment_id}")
async def delete_layer_segment(
    segment_id: int,
    db: Session = Depends(get_db)
) -> JSONResponse:
    """Delete a LayerSegment and adjust the order of remaining segments."""
    logger.info(f"delete_layer_segment(segment_id={segment_id})")

    # Fetch the segment to be deleted
    segment = db.query(Segment).filter_by(id=segment_id).first()
    if not segment:
        raise HTTPException(status_code=404, detail=f"Segment with ID {segment_id} not found.")

    # Check if this is the last segment in the layer
    layer_segments = db.query(Segment).filter_by(layer_id=segment.layer_id).all()
    if len(layer_segments) <= 1:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete the last segment in the layer. Delete the Layer instead."
        )

    # Adjust the order of remaining segments
    db.query(Segment).filter(
        Segment.layer_id == segment.layer_id,
        Segment.order > segment.order
    ).update({"order": Segment.order - 1}, synchronize_session="fetch")

    # Delete the segment
    db.delete(segment)
    db.commit()

    return JSONResponse(
        content={"message": f"Segment {segment_id} deleted successfully."},
        status_code=200
    )


@router.delete("/delete_layer/{layer_id}")
async def delete_layer(
    layer_id: int,
    db: Session = Depends(get_db)
) -> JSONResponse:
    """Delete a Layer and adjust the order of remaining layers."""
    logger.info(f"delete_layer(layer_id={layer_id})")

    # Fetch the layer to be deleted
    layer = db.query(Layer).filter_by(id=layer_id).first()
    if not layer:
        raise HTTPException(status_code=404, detail=f"Layer with ID {layer_id} not found.")

    # Check if this is the last layer in the assembly
    assembly_layers = db.query(Layer).filter_by(assembly_id=layer.assembly_id).all()
    if len(assembly_layers) <= 1:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete the last layer in the assembly."
        )

    # Delete all associated segments for the layer
    db.query(Segment).filter_by(layer_id=layer.id).delete()

    # Adjust the order of remaining layers
    db.query(Layer).filter(
        Layer.assembly_id == layer.assembly_id,
        Layer.order > layer.order
    ).update({"order": Layer.order - 1}, synchronize_session="fetch")

    # Delete the layer
    db.delete(layer)
    db.commit()

    return JSONResponse(
        content={"message": f"Layer {layer_id} deleted successfully."},
        status_code=200
    )




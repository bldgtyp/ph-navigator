# -*- Python Version: 3.11 -*-https://www.dropbox.com/home

import logging

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from config import limiter
from database import get_db
from features.aperture.schemas import ApertureSchema
from features.aperture.schemas.aperture import (
    ColumnDeleteRequest,
    MergeApertureElementsRequest,
    RowDeleteRequest,
    SplitApertureElementRequest,
    UpdateApertureFrameRequest,
    UpdateColumnWidthRequest,
    UpdateGlazingRequest,
    UpdateNameRequest,
    UpdateRowHeightRequest,
    UpdateApertureElementNameRequest,
)
from features.aperture.services.aperture import (
    LastColumnException,
    LastRowException,
    add_column_to_aperture,
    add_new_aperture_on_project,
    add_row_to_aperture,
    delete_aperture,
    delete_column_from_aperture,
    delete_row_from_aperture,
    get_all_project_apertures_as_json_string,
    get_aperture_by_id,
    get_apertures_by_project_bt,
    merge_aperture_elements,
    split_aperture_element,
    update_aperture_column_width,
    update_aperture_element_frame,
    update_aperture_name,
    update_aperture_row_height,
    update_aperture_element_name,
    update_aperture_glazing,
)
from features.app.services import get_project_by_bt_number

router = APIRouter(
    prefix="/aperture",
    tags=["aperture"],
)

logger = logging.getLogger(__name__)


# @limiter.limit("10/minute")
@router.get("/get-apertures/{bt_number}", response_model=list[ApertureSchema])
def get_project_apertures_route(
    request: Request, bt_number: str, db: Session = Depends(get_db)
) -> list[ApertureSchema]:
    logger.info(f"get_project_apertures_route({bt_number})")

    try:
        apertures = get_apertures_by_project_bt(db, bt_number)
        return [ApertureSchema.from_orm(aperture) for aperture in apertures]
    except Exception as e:
        msg = f"Error retrieving apertures for project {bt_number=}: {e}"
        logger.error(msg)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=msg)


# @limiter.limit("10/minute")
@router.get("/get-apertures-as-json/{bt_number}")
def get_project_apertures_as_json_route(
    request: Request,
    bt_number: str,
    offset: int = Query(0, description="The offset for the function"),
    db: Session = Depends(get_db),
) -> JSONResponse:
    """Get all of the Project's Apertures as a single JSON Object.

    The format will follow the HBJSON Dump Objects, which outputs a single object:

    apertures = {
        "Aperture 1": {....},
        "Aperture 2": {....},
        ...
    }
    """
    logger.info(f"aperture/get_project_apertures_as_json_route({bt_number=}, {offset=})")

    apertures_json = get_all_project_apertures_as_json_string(db, bt_number)

    return JSONResponse(
        content={
            "apertures": apertures_json,
        },
        status_code=200,
    )


# @limiter.limit("1/second")
@router.get("/get-aperture/{aperture_id}", response_model=ApertureSchema)
def get_aperture_route(request: Request, aperture_id: int, db: Session = Depends(get_db)) -> ApertureSchema:
    logger.info(f"get_aperture({aperture_id})")

    try:
        aperture = get_aperture_by_id(db, aperture_id)
        return ApertureSchema.from_orm(aperture)
    except ValueError as e:
        msg = str(e)
        logger.error(msg)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=msg)
    except Exception as e:
        msg = f"Error retrieving aperture with ID {aperture_id}: {e}"
        logger.error(msg)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=msg)


# @limiter.limit("1/second")
@router.post("/create-new-aperture-on-project/{bt_number}", response_model=ApertureSchema)
def add_aperture_route(request: Request, bt_number: str, db: Session = Depends(get_db)) -> ApertureSchema:
    logger.info(f"add_aperture_route({bt_number=})")

    try:
        project = get_project_by_bt_number(db, bt_number)
        new_aperture = add_new_aperture_on_project(db, project)
        return ApertureSchema.from_orm(new_aperture)
    except Exception as e:
        msg = f"Failed to create new aperture for project {bt_number}: {e}"
        logger.error(msg)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=msg)


# @limiter.limit("1/second")
@router.patch("/update-aperture-name/{aperture_id}", response_model=ApertureSchema)
def update_aperture_name_route(
    request: Request, aperture_id: int, update_request: UpdateNameRequest, db: Session = Depends(get_db)
) -> ApertureSchema:
    logger.info(f"update_aperture_name_route({aperture_id=}, {update_request.new_name=})")

    try:
        updated_aperture = update_aperture_name(db, aperture_id, update_request.new_name)
        return ApertureSchema.from_orm(updated_aperture)
    except Exception as e:
        msg = f"Failed to update aperture name for ID {aperture_id}: {e}"
        logger.error(msg)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=msg)


# @limiter.limit("1/second")
@router.patch("/update-glazing/{element_id}", response_model=ApertureSchema)
def update_aperture_glazing_route(
    request: Request, element_id: int, update_request: UpdateGlazingRequest, db: Session = Depends(get_db)
) -> ApertureSchema:
    logger.info(f"update_aperture_glazing_route({element_id=}, {update_request=})")

    try:
        updated_aperture = update_aperture_glazing(db, element_id, update_request.glazing_id)
        return ApertureSchema.from_orm(updated_aperture)
    except Exception as e:
        msg = f"Failed to update aperture glazing for ID {element_id=} to {update_request.glazing_id=}: {e}"
        logger.error(msg)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=msg)


# @limiter.limit("1/second")
@router.patch("/update-column-width/{aperture_id}", response_model=ApertureSchema)
def update_aperture_column_width_route(
    request: Request, aperture_id: int, update_request: UpdateColumnWidthRequest, db: Session = Depends(get_db)
) -> ApertureSchema:
    logger.info(f"update_aperture_column_width_route({aperture_id=}, {update_request=})")

    try:
        updated_aperture = update_aperture_column_width(
            db, aperture_id, update_request.column_index, update_request.new_width_mm
        )
        return ApertureSchema.from_orm(updated_aperture)
    except Exception as e:
        msg = f"Failed to update aperture column width for ID {aperture_id}: {e}"
        logger.error(msg)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=msg)


# @limiter.limit("1/second")
@router.patch("/update-row-height/{aperture_id}", response_model=ApertureSchema)
def update_aperture_row_height_route(
    request: Request, aperture_id: int, update_request: UpdateRowHeightRequest, db: Session = Depends(get_db)
) -> ApertureSchema:
    logger.info(f"update_aperture_row_height_route({aperture_id=}, {update_request=})")

    try:
        updated_aperture = update_aperture_row_height(
            db, aperture_id, update_request.row_index, update_request.new_height_mm
        )
        return ApertureSchema.from_orm(updated_aperture)
    except Exception as e:
        msg = f"Failed to update aperture row height for ID {aperture_id}: {e}"
        logger.error(msg)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=msg)


# @limiter.limit("1/second")
@router.patch("/update-frame/{aperture_id}", response_model=ApertureSchema)
def update_frame_route(
    request: Request, aperture_id: int, update_request: UpdateApertureFrameRequest, db: Session = Depends(get_db)
):
    logger.info(f"update_frame_route({aperture_id=}, {update_request=})")

    try:
        updated_aperture = update_aperture_element_frame(
            db, update_request.element_id, update_request.side, update_request.frame_id
        )
        return ApertureSchema.from_orm(updated_aperture)
    except Exception as e:
        msg = f"Failed to update aperture frame for ID {aperture_id}: {e}"
        logger.error(msg)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=msg)


# @limiter.limit("1/second")
@router.patch("/add-row/{aperture_id}", response_model=ApertureSchema)
def add_row_to_aperture_route(request: Request, aperture_id: int, db: Session = Depends(get_db)) -> ApertureSchema:
    logger.info(f"add_row_to_aperture({aperture_id=})")

    try:
        return ApertureSchema.from_orm(add_row_to_aperture(db, aperture_id))
    except Exception as e:
        msg = str(e)
        logger.error(msg)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=msg)


# @limiter.limit("1/second")
@router.patch("/add-column/{aperture_id}", response_model=ApertureSchema)
def add_column_to_aperture_route(request: Request, aperture_id: int, db: Session = Depends(get_db)) -> ApertureSchema:
    logger.info(f"add_column_to_aperture({aperture_id=})")

    try:
        return ApertureSchema.from_orm(add_column_to_aperture(db, aperture_id))
    except Exception as e:
        msg = str(e)
        logger.error(msg)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=msg)


# @limiter.limit("1/second")
@router.patch("/merge-aperture-elements/{aperture_id}", response_model=ApertureSchema)
def merge_aperture_elements_route(
    request: Request, aperture_id: int, update_request: MergeApertureElementsRequest, db: Session = Depends(get_db)
) -> ApertureSchema:
    logger.info(f"merge_elements_route({aperture_id=}, {update_request=})")

    try:
        aperture = merge_aperture_elements(db, aperture_id, update_request.aperture_element_ids)
        return ApertureSchema.from_orm(aperture)
    except ValueError as e:
        msg = str(e)
        logger.error(msg)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg)
    except Exception as e:
        msg = f"Error merging elements: {str(e)}"
        logger.error(msg)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=msg)


# @limiter.limit("1/second")
@router.patch("/split-aperture-element/{aperture_id}", response_model=ApertureSchema)
def split_aperture_element_route(
    request: Request, aperture_id: int, update_request: SplitApertureElementRequest, db: Session = Depends(get_db)
) -> ApertureSchema:
    logger.info(f"split_aperture_element_route({aperture_id=}, {update_request=})")

    try:
        aperture = split_aperture_element(db, aperture_id, update_request.aperture_element_id)
        return ApertureSchema.from_orm(aperture)
    except ValueError as e:
        msg = str(e)
        logger.error(msg)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg)
    except Exception as e:
        msg = f"Error splitting element: {str(e)}"
        logger.error(msg)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=msg)


# @limiter.limit("1/second")
@router.patch("/update-aperture-element-name/{element_id}", response_model=ApertureSchema)
def update_aperture_element_name_route(
    request: Request, element_id: int, update_request: UpdateApertureElementNameRequest, db: Session = Depends(get_db)
) -> ApertureSchema:
    logger.info(f"update_aperture_element_name_route({element_id=}, {update_request.aperture_element_name=})")

    try:
        updated_aperture = update_aperture_element_name(db, element_id, update_request.aperture_element_name)
        return ApertureSchema.from_orm(updated_aperture)
    except Exception as e:
        msg = f"Failed to update aperture element name for ID {element_id}: {e}"
        logger.error(msg)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=msg)


# @limiter.limit("1/second")
@router.delete("/delete-aperture/{aperture_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_aperture_route(request: Request, aperture_id: int, db: Session = Depends(get_db)) -> None:
    logger.info(f"delete_aperture_route({aperture_id=})")

    try:
        delete_aperture(db, aperture_id)
        return None
    except Exception as e:
        msg = f"Failed to delete aperture with ID {aperture_id}: {e}"
        logger.error(msg)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=msg)


# @limiter.limit("1/second")
@router.delete("/delete-row/{aperture_id}", response_model=ApertureSchema)
def delete_row_on_aperture_route(
    request: Request, delete_request: RowDeleteRequest, aperture_id: int, db: Session = Depends(get_db)
) -> ApertureSchema:
    logger.info(f"delete_row_on_aperture({aperture_id=}, {delete_request=})")

    try:
        return ApertureSchema.from_orm(delete_row_from_aperture(db, aperture_id, delete_request.row_number))
    except LastRowException as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except Exception as e:
        msg = str(e)
        logger.error(msg)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=msg)


# @limiter.limit("1/second")
@router.delete("/delete-column/{aperture_id}", response_model=ApertureSchema)
def delete_column_on_aperture_route(
    request: Request, delete_request: ColumnDeleteRequest, aperture_id: int, db: Session = Depends(get_db)
) -> ApertureSchema:
    logger.info(f"delete_column_on_aperture({aperture_id=}, {delete_request=})")

    try:
        return ApertureSchema.from_orm(delete_column_from_aperture(db, aperture_id, delete_request.column_number))
    except LastColumnException as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except Exception as e:
        msg = str(e)
        logger.error(msg)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=msg)

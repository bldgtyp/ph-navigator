# -*- Python Version: 3.11 -*-

import logging
from http.client import HTTPResponse

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from config import limiter
from database import get_db
from features.aperture.schemas import ApertureSchema
from features.aperture.schemas.aperture import ColumnDeleteRequest, RowDeleteRequest, UpdateNameRequest
from features.aperture.services.aperture import (
    LastColumnException,
    LastRowException,
    add_column_to_aperture,
    add_new_aperture_on_project,
    add_row_to_aperture,
    delete_aperture,
    delete_column_from_aperture,
    delete_row_from_aperture,
    get_aperture_by_id,
    get_apertures_by_project_bt,
    update_aperture_name,
)
from features.app.services import get_project_by_bt_number

router = APIRouter(
    prefix="/aperture",
    tags=["aperture"],
)

logger = logging.getLogger(__name__)


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


@router.patch("/add-row/{aperture_id}", response_model=ApertureSchema)
def add_row_to_aperture_route(aperture_id: int, db: Session = Depends(get_db)) -> ApertureSchema:
    logger.info(f"add_row_to_aperture({aperture_id=})")

    try:
        return ApertureSchema.from_orm(add_row_to_aperture(db, aperture_id))
    except Exception as e:
        msg = str(e)
        logger.error(msg)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=msg)


@router.patch("/add-column/{aperture_id}", response_model=ApertureSchema)
def add_column_to_aperture_route(request: Request, aperture_id: int, db: Session = Depends(get_db)) -> ApertureSchema:
    logger.info(f"add_column_to_aperture({aperture_id=})")

    try:
        return ApertureSchema.from_orm(add_column_to_aperture(db, aperture_id))
    except Exception as e:
        msg = str(e)
        logger.error(msg)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=msg)


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

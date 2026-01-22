# -*- Python Version: 3.11 -*-

import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from features.aperture.schemas.manufacturer_filter import (
    ManufacturerFilterResponseSchema,
    ManufacturerFilterUpdateSchema,
)
from features.aperture.services.manufacturer_filter import (
    get_all_frame_manufacturers,
    get_all_glazing_manufacturers,
    get_enabled_manufacturers,
    get_project_by_bt_number,
    get_used_frame_manufacturers,
    get_used_glazing_manufacturers,
    has_any_filters,
    update_manufacturer_filters,
)

router = APIRouter(
    prefix="/aperture",
    tags=["aperture"],
)

logger = logging.getLogger(__name__)


@router.get("/manufacturer-filters/{bt_number}", response_model=ManufacturerFilterResponseSchema)
def get_manufacturer_filters_route(
    bt_number: str,
    db: Session = Depends(get_db),
) -> ManufacturerFilterResponseSchema:
    """Get manufacturer filter configuration for a project."""
    logger.info(f"aperture/get_manufacturer_filters_route({bt_number})")

    project = get_project_by_bt_number(db, bt_number)
    if not project:
        raise HTTPException(status_code=404, detail=f"Project {bt_number} not found")

    all_frame_manufacturers = get_all_frame_manufacturers(db)
    all_glazing_manufacturers = get_all_glazing_manufacturers(db)

    used_frame = get_used_frame_manufacturers(db, project.id)
    used_glazing = get_used_glazing_manufacturers(db, project.id)

    if has_any_filters(db, project.id, "frame"):
        enabled_frame = get_enabled_manufacturers(db, project.id, "frame")
    else:
        enabled_frame = all_frame_manufacturers

    if has_any_filters(db, project.id, "glazing"):
        enabled_glazing = get_enabled_manufacturers(db, project.id, "glazing")
    else:
        enabled_glazing = all_glazing_manufacturers

    enabled_frame = sorted(set(enabled_frame) | set(used_frame))
    enabled_glazing = sorted(set(enabled_glazing) | set(used_glazing))

    return ManufacturerFilterResponseSchema(
        available_frame_manufacturers=all_frame_manufacturers,
        enabled_frame_manufacturers=enabled_frame,
        available_glazing_manufacturers=all_glazing_manufacturers,
        enabled_glazing_manufacturers=enabled_glazing,
        used_frame_manufacturers=used_frame,
        used_glazing_manufacturers=used_glazing,
    )


@router.patch("/manufacturer-filters/{bt_number}", response_model=ManufacturerFilterResponseSchema)
def update_manufacturer_filters_route(
    bt_number: str,
    update_data: ManufacturerFilterUpdateSchema,
    db: Session = Depends(get_db),
) -> ManufacturerFilterResponseSchema:
    """Update manufacturer filter configuration for a project."""
    logger.info(f"aperture/update_manufacturer_filters_route({bt_number})")

    project = get_project_by_bt_number(db, bt_number)
    if not project:
        raise HTTPException(status_code=404, detail=f"Project {bt_number} not found")

    all_frame_manufacturers = get_all_frame_manufacturers(db)
    all_glazing_manufacturers = get_all_glazing_manufacturers(db)

    used_frame = get_used_frame_manufacturers(db, project.id)
    used_glazing = get_used_glazing_manufacturers(db, project.id)

    enabled_frame = sorted(set(update_data.enabled_frame_manufacturers) | set(used_frame))
    enabled_glazing = sorted(set(update_data.enabled_glazing_manufacturers) | set(used_glazing))

    update_manufacturer_filters(
        db,
        project.id,
        "frame",
        enabled_frame,
        all_frame_manufacturers,
    )
    update_manufacturer_filters(
        db,
        project.id,
        "glazing",
        enabled_glazing,
        all_glazing_manufacturers,
    )

    return ManufacturerFilterResponseSchema(
        available_frame_manufacturers=all_frame_manufacturers,
        enabled_frame_manufacturers=enabled_frame,
        available_glazing_manufacturers=all_glazing_manufacturers,
        enabled_glazing_manufacturers=enabled_glazing,
        used_frame_manufacturers=used_frame,
        used_glazing_manufacturers=used_glazing,
    )

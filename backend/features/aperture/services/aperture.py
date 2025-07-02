# -*- Python Version: 3.11 -*-

import logging

from sqlalchemy.orm import Session
from db_entities.aperture import Aperture
from features.app.services import get_project_by_bt_number

logger = logging.getLogger(__name__)

def get_apertures_by_project_bt(db: Session, bt_number: str) -> list[Aperture]:
    logger.info(f"get_apertures_by_project_bt({bt_number})")
    
    project = get_project_by_bt_number(db, bt_number)
    apertures = db.query(Aperture).filter(Aperture.project_id == project.id).all()
    return apertures

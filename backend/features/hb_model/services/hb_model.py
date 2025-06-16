# -*- Python Version: 3.11 -*-

from logging import getLogger

from fastapi import HTTPException, status
from honeybee.model import Model
from PHX.from_HBJSON import read_HBJSON_file
from pyairtable import Api
from sqlalchemy.orm import Session

from db_entities.app.project import Project

from ...air_table.services import download_hbjson_file, get_project_airtable_base_ref, get_airtable_table_ref_by_name
from ..cache import LimitedCache

logger = getLogger(__name__)

MODEL_CACHE = LimitedCache[Model]()


class MissingFileException(Exception):
    """Custom exception for missing HBJSON file."""

    def __init__(self, bt_number: str, file_type: str):
        super().__init__(f"MissingFileException: {file_type} file not found for Project ID: {bt_number}")


class HBJSONModelLoadError(Exception):
    """Custom exception for Honeybee-Model loading errors."""

    def __init__(self, bt_number: str, e: Exception):
        super().__init__(f"HBJSONModelLoadError: Failed to load Honeybee-Model for Project ID: {bt_number} | {e}")


def find_hbjson_file_url(db: Session, bt_number: str) -> str:
    """Given a Project ID, find the HBJSON file URL from the AirTable repository."""
    logger.info(f"find_hbjson_url({bt_number=})")

    # Get the Project
    project = db.query(Project).filter_by(bt_number=bt_number).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project {bt_number} not found.",
        )

    # Get the AirTable base
    if not project.airtable_base:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"AirTable base not found for Project {bt_number}.",
        )

    # Check the AirTable access token
    if not project.airtable_base.airtable_access_token:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"AirTable access token not found for Project {bt_number}.",
        )

    at_base_id = get_project_airtable_base_ref(db, bt_number)
    at_tbl_id = get_airtable_table_ref_by_name(db, bt_number, "HBJSON")

    try:
        api = Api(project.airtable_base.airtable_access_token)
        project_data_table = api.table(at_base_id, at_tbl_id)
        table_data = project_data_table.all()

        # Return the URL of the the most recent HBJSON file
        current_record = sorted(table_data, key=lambda x: x["fields"]["DATE"])[-1]
        current_record_hbjson_file = current_record.get("fields", {}).get("HBJSON_FILE", "")
        if not current_record_hbjson_file:
            logger.error(f"HBJSON file not found for BT-Number: {bt_number}")
            raise MissingFileException(bt_number, "HBJSON")

        # -- AirTable stores attachments as lists. So use the first one.
        hbjson_file_url = current_record_hbjson_file[0].get("url", "")

        return hbjson_file_url

    except Exception as e:
        logger.error(f"Error: {e}")
        raise Exception(e)


async def load_hb_model(db: Session, bt_number: str) -> Model:
    """Return a Honeybee-Model object for the specified Project"""
    logger.info(f"get_model({bt_number=})")

    if hb_model := MODEL_CACHE[bt_number]:
        logger.info(f"Model found in cache for BT-Number: {bt_number}")
        return hb_model

    # -- Get the HBJSON File URL from the database and download it
    hbjson_file_url = find_hbjson_file_url(db, bt_number)
    hb_model_dict = download_hbjson_file(hbjson_file_url)

    # -- Convert the HBJSON file to a Honeybee-Model object
    try:
        hb_model = read_HBJSON_file.convert_hbjson_dict_to_hb_model(hb_model_dict)
        MODEL_CACHE[bt_number] = hb_model
        return hb_model
    except Exception as e:
        logger.error(f"Error converting HBJSON to Honeybee-Model: {e}")
        raise HBJSONModelLoadError(bt_number, e)

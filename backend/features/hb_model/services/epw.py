# -*- Python Version: 3.11 -*-

from logging import getLogger

from fastapi import HTTPException, status
from ladybug.epw import EPW
from pyairtable import Api
from sqlalchemy.orm import Session

from db_entities.app.project import Project

from ...air_table.services import download_epw_file, get_project_airtable_base_ref, get_airtable_table_ref_by_name
from ..cache import LimitedCache

logger = getLogger(__name__)

EPW_CACHE = LimitedCache[EPW]()


class MissingFileException(Exception):
    """Custom exception for missing HBJSON file."""

    def __init__(self, bt_number: str, file_type: str):
        super().__init__(f"MissingFileException: {file_type} file not found for Project ID: {bt_number}")


def find_epw_file_url(db: Session, bt_number: str) -> str:
    """Given a BT-Number, find the EPW file URL from the AirTable repository."""
    logger.info(f"find_epw_file_url({bt_number=})")

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
        current_record_hbjson_file = current_record.get("fields", {}).get("EPW_FILE", "")
        if not current_record_hbjson_file:
            logger.error(f"HBJSON file not found for Project ID: {bt_number}")
            raise MissingFileException(bt_number, "EPW")

        # -- AirTable stores attachments as lists. So use the first one.
        epw_file_url = current_record_hbjson_file[0].get("url", "")

        return epw_file_url

    except Exception as e:
        logger.error(f"Error: {e}")
        raise Exception(e)


async def load_epw_object(db: Session, bt_number: str) -> EPW:
    """Return a Ladybug-EPW object for the specified Project."""
    logger.info(f"load_epw_object({bt_number=})")

    if epw_object := EPW_CACHE[bt_number]:
        logger.info(f"EPW object found in cache for Project ID: {bt_number}")
        return epw_object

    # -- Get the HBJSON File URL from the database and download it
    epw_file_url = find_epw_file_url(db, bt_number)
    epw_file = download_epw_file(epw_file_url)

    # -- Parse the EPW content into a Ladybug EPW object
    epw_object = EPW.from_file_string(epw_file)
    EPW_CACHE[bt_number] = epw_object

    return epw_object

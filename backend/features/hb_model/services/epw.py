# -*- Python Version: 3.11 -*-

from logging import getLogger

from ladybug import epw
from pyairtable import Api
from sqlalchemy.orm import Session

from config import settings

from ...air_table.services import download_epw_file, get_airtable_base_ref, get_airtable_table_ref

logger = getLogger(__name__)


class MissingFileException(Exception):
    """Custom exception for missing HBJSON file."""
    def __init__(self, project_id: int, file_type: str):
        super().__init__(f"MissingFileException: {file_type} file not found for Project ID: {project_id}")


async def find_epw_file_url(db: Session, project_id: int) -> str:
    """Given a Project ID, find the EPW file URL from the AirTable repository."""
    logger.info(f"find_epw_file_url({project_id=})")
    
    at_base_id = await get_airtable_base_ref(db, project_id)
    at_tbl_id = await get_airtable_table_ref(db, project_id, "HBJSON")
    
    try:
        api = Api(settings.AIRTABLE_GET_TOKEN)
        project_data_table = api.table(at_base_id, at_tbl_id)
        table_data = project_data_table.all()

        # Return the URL of the the most recent HBJSON file
        current_record = sorted(table_data, key=lambda x: x["fields"]["DATE"])[-1]
        current_record_hbjson_file = current_record.get("fields", {}).get("EPW_FILE", "")
        if not current_record_hbjson_file:
            logger.error(f"HBJSON file not found for Project ID: {project_id}")
            raise MissingFileException(project_id, "EPW")
        
        # -- AirTable stores attachments as lists. So use the first one.
        epw_file_url = current_record_hbjson_file[0].get("url", "")

        return epw_file_url
    
    except Exception as e:
        logger.error(f"Error: {e}")
        raise Exception(e)
    

async def load_epw_object(db: Session, project_id: int) -> epw.EPW:
    """Return a Ladybug-EPW object for the specified Project."""
    logger.info(f"load_epw_object({project_id=})")

    # -- Get the HBJSON File URL from the database and download it
    epw_file_url = await find_epw_file_url(db, project_id)
    epw_file = await download_epw_file(epw_file_url)

    # -- Parse the EPW content into a Ladybug EPW object
    epw_object = epw.EPW.from_file_string(epw_file)

    return epw_object


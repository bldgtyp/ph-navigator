# -*- Python Version: 3.11 -*-

from logging import getLogger

from honeybee.model import Model
from PHX.from_HBJSON import read_HBJSON_file
from pyairtable import Api
from sqlalchemy.orm import Session

from config import settings

from ...air_table.services import download_hbjson_file, get_airtable_base_ref, get_airtable_table_ref

logger = getLogger(__name__)


class MissingFileException(Exception):
    """Custom exception for missing HBJSON file."""
    def __init__(self, project_id: int, file_type: str):
        super().__init__(f"MissingFileException: {file_type} file not found for Project ID: {project_id}")


class HBJSONModelLoadError(Exception):
    """Custom exception for Honeybee-Model loading errors."""
    def __init__(self, project_id: int, e: Exception):
        super().__init__(f"HBJSONModelLoadError: Failed to load Honeybee-Model for Project ID: {project_id} | {e}")


async def find_hbjson_file_url(db: Session, project_id: int) -> str:
    """Given a Project ID, find the HBJSON file URL from the AirTable repository."""
    logger.info(f"find_hbjson_url({project_id=})")
    
    at_base_id = await get_airtable_base_ref(db, project_id)
    at_tbl_id = await get_airtable_table_ref(db, project_id, "HBJSON")
    
    try:
        api = Api(settings.AIRTABLE_GET_TOKEN)
        project_data_table = api.table(at_base_id, at_tbl_id)
        table_data = project_data_table.all()

        # Return the URL of the the most recent HBJSON file
        current_record = sorted(table_data, key=lambda x: x["fields"]["DATE"])[-1]
        current_record_hbjson_file = current_record.get("fields", {}).get("HBJSON_FILE", "")
        if not current_record_hbjson_file:
            logger.error(f"HBJSON file not found for Project ID: {project_id}")
            raise MissingFileException(project_id, "HBJSON")
        
        # -- AirTable stores attachments as lists. So use the first one.
        hbjson_file_url = current_record_hbjson_file[0].get("url", "")

        return hbjson_file_url
    
    except Exception as e:
        logger.error(f"Error: {e}")
        raise Exception(e)


async def load_hb_model(db: Session, project_id: int) -> Model:
    """Return a Honeybee-Model object for the specified Project"""
    logger.info(f"get_model({project_id=})")
    
    # -- Get the HBJSON File URL from the database and download it
    hbjson_file_url = await find_hbjson_file_url(db, project_id)
    hb_model_dict = await download_hbjson_file(hbjson_file_url)

    # -- Convert the HBJSON file to a Honeybee-Model object
    try:
        return read_HBJSON_file.convert_hbjson_dict_to_hb_model(hb_model_dict)
    except Exception as e:
        logger.error(f"Error converting HBJSON to Honeybee-Model: {e}")
        raise HBJSONModelLoadError(project_id, e)


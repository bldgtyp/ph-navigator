# -*- Python Version: 3.11 -*-

from logging import getLogger

from db_entities.app.project import Project
from fastapi import HTTPException, status
from honeybee.model import Model
from PHX.from_HBJSON import read_HBJSON_file
from pyairtable import Api
from sqlalchemy.orm import Session

from ...air_table.services import (
    download_hbjson_file,
    get_airtable_table_ref_by_name,
    get_project_airtable_base_ref,
)
from ..cache import LimitedCache

logger = getLogger(__name__)

MODEL_CACHE = LimitedCache[Model]()


class MissingFileException(Exception):
    """Custom exception for missing HBJSON file."""

    def __init__(self, bt_number: str, file_type: str):
        super().__init__(
            f"MissingFileException: {file_type} file not found for Project ID: {bt_number}"
        )


class RecordNotFoundException(Exception):
    """Custom exception for missing AirTable record."""

    def __init__(self, bt_number: str, record_id: str):
        super().__init__(
            f"RecordNotFoundException: Record {record_id} not found for Project ID: {bt_number}"
        )


class HBJSONModelLoadError(Exception):
    """Custom exception for Honeybee-Model loading errors."""

    def __init__(self, bt_number: str, e: Exception):
        super().__init__(
            f"HBJSONModelLoadError: Failed to load Honeybee-Model for Project ID: {bt_number} | {e}"
        )


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
        current_record_hbjson_file = current_record.get("fields", {}).get(
            "HBJSON_FILE", ""
        )
        if not current_record_hbjson_file:
            logger.error(f"HBJSON file not found for BT-Number: {bt_number}")
            raise MissingFileException(bt_number, "HBJSON")

        # -- AirTable stores attachments as lists. So use the first one.
        hbjson_file_url = current_record_hbjson_file[0].get("url", "")

        return hbjson_file_url

    except Exception as e:
        logger.error(f"Error: {e}")
        raise Exception(e)


def _get_project_with_airtable(db: Session, bt_number: str) -> Project:
    """Get project and validate AirTable access. Raises HTTPException if not found."""
    project = db.query(Project).filter_by(bt_number=bt_number).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project {bt_number} not found.",
        )
    if not project.airtable_base:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"AirTable base not found for Project {bt_number}.",
        )
    if not project.airtable_base.airtable_access_token:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"AirTable access token not found for Project {bt_number}.",
        )
    return project


def list_available_models(db: Session, bt_number: str) -> list[dict]:
    """Return metadata for all available HBJSON models for a project, sorted by date (newest first)."""
    logger.info(f"list_available_models({bt_number=})")

    project = _get_project_with_airtable(db, bt_number)
    at_base_id = get_project_airtable_base_ref(db, bt_number)
    at_tbl_id = get_airtable_table_ref_by_name(db, bt_number, "HBJSON")

    try:
        api = Api(project.airtable_base.airtable_access_token)
        project_data_table = api.table(at_base_id, at_tbl_id)
        table_data = project_data_table.all()

        # Extract record_id and date, sort by date descending (newest first)
        models = []
        for record in table_data:
            record_id = record.get("id", "")
            date_str = record.get("fields", {}).get("DATE", "")
            if record_id and date_str:
                models.append({"record_id": record_id, "date": date_str})

        # Sort by date descending (newest first)
        models.sort(key=lambda x: x["date"], reverse=True)
        return models

    except Exception as e:
        logger.error(f"Error listing available models: {e}")
        raise Exception(e)


def find_hbjson_file_url_by_record_id(
    db: Session, bt_number: str, record_id: str
) -> str:
    """Get the HBJSON file URL for a specific AirTable record."""
    logger.info(f"find_hbjson_file_url_by_record_id({bt_number=}, {record_id=})")

    project = _get_project_with_airtable(db, bt_number)
    at_base_id = get_project_airtable_base_ref(db, bt_number)
    at_tbl_id = get_airtable_table_ref_by_name(db, bt_number, "HBJSON")

    try:
        api = Api(project.airtable_base.airtable_access_token)
        project_data_table = api.table(at_base_id, at_tbl_id)

        # Get the specific record by ID
        record = project_data_table.get(record_id)
        if not record:
            raise RecordNotFoundException(bt_number, record_id)

        hbjson_file = record.get("fields", {}).get("HBJSON_FILE", "")
        if not hbjson_file:
            logger.error(f"HBJSON file not found for record: {record_id}")
            raise MissingFileException(bt_number, "HBJSON")

        # AirTable stores attachments as lists. Use the first one.
        hbjson_file_url = hbjson_file[0].get("url", "")
        return hbjson_file_url

    except RecordNotFoundException:
        raise
    except MissingFileException:
        raise
    except Exception as e:
        logger.error(f"Error: {e}")
        raise Exception(e)


def load_hb_model(
    db: Session,
    bt_number: str,
    record_id: str | None = None,
    force_refresh: bool = False,
) -> Model:
    """Return a Honeybee-Model object for the specified Project.

    Args:
        db: Database session
        bt_number: Project BT number
        record_id: Optional AirTable record ID. If None, loads the most recent model.
        force_refresh: If True, bypass cache and re-download from AirTable.

    Returns:
        Honeybee Model object
    """
    logger.info(f"load_hb_model({bt_number=}, {record_id=}, {force_refresh=})")

    # Use composite cache key: bt_number:record_id (or 'latest' if no record_id)
    cache_key = f"{bt_number}:{record_id or 'latest'}"

    if not force_refresh:
        if hb_model := MODEL_CACHE[cache_key]:
            logger.info(f"Model found in cache for key: {cache_key}")
            return hb_model

    # -- Get the HBJSON File URL from the database and download it
    if record_id:
        hbjson_file_url = find_hbjson_file_url_by_record_id(db, bt_number, record_id)
    else:
        hbjson_file_url = find_hbjson_file_url(db, bt_number)

    hb_model_dict = download_hbjson_file(hbjson_file_url)

    # -- Convert the HBJSON file to a Honeybee-Model object
    try:
        hb_model = read_HBJSON_file.convert_hbjson_dict_to_hb_model(hb_model_dict)
        MODEL_CACHE[cache_key] = hb_model
        return hb_model
    except Exception as e:
        logger.error(f"Error converting HBJSON to Honeybee-Model: {e}")
        raise HBJSONModelLoadError(bt_number, e)

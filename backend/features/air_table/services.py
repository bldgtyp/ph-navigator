# -*- Python Version: 3.11 -*-

from logging import getLogger

import requests
from config import settings
from db_entities.airtable.at_base import AirTableBase
from db_entities.airtable.at_table import AirTableTable
from db_entities.aperture.frame_type import ApertureFrameType
from db_entities.aperture.glazing_type import ApertureGlazingType
from db_entities.assembly import Material
from features.aperture.schemas.frame_type import FrameTypeSchema
from features.aperture.schemas.glazing_type import GlazingTypeSchema
from features.app.schema import AirTableTableUpdateSchema
from features.app.services import get_project_by_bt_number
from features.assembly.schemas.material import AirTableMaterialSchema
from pyairtable import Api, Base, Table
from pyairtable.models.schema import BaseSchema
from sqlalchemy.orm import Session

logger = getLogger(__name__)


class TableNotFoundException(Exception):
    """Custom exception for missing table in AirTable."""

    def __init__(self, table_identifier: str):
        self.table_name = table_identifier
        self.message = f"Table {table_identifier} not found in AirTable."
        logger.error(self.message)
        super().__init__(self.message)


class DownloadError(Exception):
    """Custom exception for download errors."""

    def __init__(self, url: str, message: str):
        logger.error(f"DownloadError: Failed to download from URL: {url} | {message}")
        super().__init__(
            f"DownloadError: Failed to download from URL: {url} | {message}"
        )


# ---------------------------------------------------------------------------------------
# -- Database Access Functions


def get_project_airtable_base_ref(db: Session, bt_number: str) -> str:
    """Get the AirTable Base Ref by the project-BT-number."""
    project = get_project_by_bt_number(db, bt_number)
    return project.airtable_base.id


def get_project_airtable_base(db: Session, bt_number: str) -> AirTableBase | None:
    """Get the AirTable Base object by the project-BT-number."""
    logger.info(f"get_airtable_base(bt_number={bt_number})")

    if project := get_project_by_bt_number(db, bt_number):
        return project.airtable_base
    else:
        return None


def get_all_project_tables(db: Session, bt_number: str) -> list[AirTableTable]:
    """Get all AirTable Tables for a given project-BT-number."""
    logger.info(f"get_all_project_tables(bt_number={bt_number})")

    # -- Find the Project
    project = get_project_by_bt_number(db, bt_number)

    # -- Return the AirTableBase tables
    if not project.airtable_base:
        raise ValueError(
            f"No AirTable Base found for project with BT number: {bt_number}"
        )

    return project.airtable_base.tables


def get_airtable_table_ref_by_name(db: Session, bt_number: str, table_name: str) -> str:
    """Get the AirTable Table Ref given a project-BT-number and table name."""

    # -- Find the Project
    project = get_project_by_bt_number(db, bt_number)

    # -- Find the Table
    table = (
        db.query(AirTableTable)
        .filter(
            AirTableTable.parent_base_id == project.airtable_base.id,
            AirTableTable.name == table_name.upper(),
        )
        .first()
    )
    if not table:
        raise TableNotFoundException(table_name)

    return table.at_ref


def get_airtable_table_by_id(
    db: Session, bt_number: str, table_id: int
) -> AirTableTable:
    """Get the AirTable Table object by its ID."""
    logger.info(f"get_airtable_table_by_id(bt_number={bt_number}, table_id={table_id})")

    # -- Find the Project
    project = get_project_by_bt_number(db, bt_number)

    # -- Find the Table
    table = (
        db.query(AirTableTable)
        .filter(
            AirTableTable.parent_base_id == project.airtable_base.id,
            AirTableTable.id == table_id,
        )
        .first()
    )
    if not table:
        raise TableNotFoundException(str(table_id))

    return table


def download_hbjson_file(url: str) -> dict:
    """Download the HBJSON File from the specified URL and return the content as JSON."""
    logger.info(f"download_hbjson_file(url={url[0:25]}...)")

    try:
        response = requests.get(url, timeout=(5, 30))  # 5s connect, 30s read
        response.raise_for_status()  # Raise an exception for HTTP errors
    except requests.exceptions.RequestException as e:
        logger.error(f"Failed to download {url}: {e}")
        raise DownloadError(url, str(e))
    return response.json()


def download_epw_file(url: str) -> str:
    """Download the EPW data from the specified URL and return the content as a string."""
    logger.info(f"download_epw_file(url={url[0:25]}...)")
    try:
        # -- Download the EPW File
        response = requests.get(url, timeout=(5, 30))  # 5s connect, 30s read
        response.raise_for_status()  # Raise an exception for HTTP errors
    except requests.exceptions.RequestException as e:
        logger.error(f"Failed to download {url}: {e}")
        raise DownloadError(url, str(e))

    try:
        # -- Decode the file content (EPW files are plain text)
        return str(response.content.decode("utf-8"))
    except UnicodeDecodeError as e:
        logger.error(f"Failed to decode EPW file content: {e}")
        raise DownloadError(url, str(e))


def add_tables_to_base(db: Session, base: AirTableBase, tables: list[Table]) -> None:
    """Add the tables to the AirTableBase object."""
    logger.info(f"add_tables_to_base(base={base.id}, tables=[{len(tables)}])")

    for table in tables:
        # -- Create a new AirTableTable object
        new_table = AirTableTable(
            name=table.name,
            at_ref=table.id,
            parent_base_id=base.id,
        )
        logger.info(
            f"Adding new table: {new_table.name} ({new_table.id=}, {new_table.at_ref=}, {new_table.parent_base_id=})"
        )
        db.add(new_table)
        db.commit()
        db.refresh(new_table)

        base.tables.append(new_table)

    return None


def remove_all_tables_from_base(db: Session, base: AirTableBase) -> None:
    """Remove all tables from the AirTableBase object."""
    logger.info(f"remove_all_tables_from_base(base={base.id})")

    # -- Remove all tables from the base
    for table in base.tables:
        logger.info(
            f"Removing table: {table.name} ({table.id=}, {table.at_ref=}, {table.parent_base_id=})"
        )
        db.delete(table)

    # -- Clear the tables list in the base
    base.tables.clear()
    db.commit()


def update_airtable_table(
    db: Session, bt_number: str, table_data: AirTableTableUpdateSchema
) -> None:
    """Update the AirTable Table data in the database."""
    logger.info(
        f"update_airtable_table(bt_number={bt_number}, table_data={table_data})"
    )
    # -- Find the Project
    project = get_project_by_bt_number(db, bt_number)
    if not project.airtable_base:
        raise ValueError(
            f"No AirTable Base found for project with BT number: {bt_number}"
        )

    # -- Find the Table
    table = get_airtable_table_by_id(db, bt_number, table_data.id)

    # -- Update the table data
    table.name = table_data.name
    table.at_ref = table_data.at_ref
    table.parent_base_id = table_data.parent_base_id
    db.commit()
    db.refresh(table)


# ---------------------------------------------------------------------------------------
# -- AirTable Remote Access Functions (Require API Key)


def get_all_material_from_airtable() -> list[Material]:
    """Get all of the materials from AirTable and return them as a list of Material objects."""
    logger.info("get_all_material_from_airtable()")

    api = Api(settings.AIRTABLE_MATERIAL_GET_TOKEN)
    table = api.table(
        settings.AIRTABLE_MATERIAL_BASE_ID,
        settings.AIRTABLE_MATERIAL_TABLE_ID,
    )

    return [
        Material(**AirTableMaterialSchema.fromAirTableRecordDict(record).model_dump())
        for record in table.all()
    ]

    # TODO: Make the AirTable call async....
    #  Use aiohttp directly since PyAirTable doesn't have async support
    # async with aiohttp.ClientSession() as session:
    #     url = f"https://api.airtable.com/v0/{settings.AIRTABLE_MATERIAL_BASE_ID}/{settings.AIRTABLE_MATERIAL_TABLE_ID}"
    #     headers = {"Authorization": f"Bearer {settings.AIRTABLE_MATERIAL_GET_TOKEN}"}

    #     async with session.get(url, headers=headers) as response:
    #         response.raise_for_status()
    #         data = await response.json()

    #         # AirTable returns data in a specific format, typically under a 'records' key
    #         records = data.get('records', [])
    #         return [Material(**AirTableMaterialSchema.fromAirTableRecordDict(record).model_dump()) for record in records]


def get_all_frame_types_from_airtable() -> list[ApertureFrameType]:
    """Get all of the frames from AirTable and return them as a list of ApertureElementFrameType objects."""
    logger.info("get_all_frame_types_from_airtable()")

    api = Api(settings.AIRTABLE_APERTURE_DATA_GET_TOKEN)
    table = api.table(
        settings.AIRTABLE_APERTURE_DATA_BASE_ID,
        settings.AIRTABLE_FRAME_DATA_TABLE_ID,
    )

    return [
        ApertureFrameType(**FrameTypeSchema.fromAirTableRecordDict(record).model_dump())
        for record in table.all()
    ]


def get_all_glazing_types_from_airtable() -> list[ApertureGlazingType]:
    """Get all of the glazings from AirTable and return them as a list of ApertureElementGlazingType objects."""
    logger.info("get_all_glazings_from_airtable()")

    api = Api(settings.AIRTABLE_APERTURE_DATA_GET_TOKEN)
    table = api.table(
        settings.AIRTABLE_APERTURE_DATA_BASE_ID,
        settings.AIRTABLE_GLAZING_DATA_TABLE_ID,
    )

    return [
        ApertureGlazingType(
            **GlazingTypeSchema.fromAirTableRecordDict(record).model_dump()
        )
        for record in table.all()
    ]


def _raise_for_airtable_status(status_code: int | None, error_msg: str = "") -> None:
    """Raise a user-friendly ValueError for common AirTable HTTP error codes."""
    if status_code == 401:
        raise ValueError(
            "The API key was rejected by AirTable. "
            "Please verify that the key is correct and has not expired."
        )
    elif status_code == 403:
        raise ValueError(
            "The API key does not have permission to access this base. "
            "Please check the key's scopes in AirTable Builder Hub."
        )
    elif status_code == 404:
        raise ValueError(
            "The Base Ref was not found. "
            "Please double-check the AirTable Base ID (starts with 'app...')."
        )
    else:
        raise ValueError(
            f"AirTable returned an error (HTTP {status_code}). "
            "Please verify the Base Ref and API key, then try again."
            + (f" AirTable error: {error_msg}" if error_msg else "")
        )


def get_base_from_airtable(airtable_base_api_key: str, airtable_base_ref: str) -> Base:
    """Get the AirTable Base object from the API key and base reference."""
    logger.info(
        f"get_base_from_airtable(airtable_base_api_key=..., airtable_base_ref={airtable_base_ref})"
    )

    try:
        api = Api(airtable_base_api_key)
    except ValueError:
        raise ValueError(
            "The API key provided does not appear to be valid. "
            "Please check the key and try again."
        )

    return api.base(airtable_base_ref)


def get_base_table_schemas_from_airtable(base: Base) -> list[Table]:
    """Get a list of all the Base's pyAirtable Table objects."""
    logger.info(f"get_base_table_schemas_from_airtable(base={base})")

    try:
        tables = base.tables()
    except requests.exceptions.HTTPError as e:
        status_code = e.response.status_code if e.response is not None else None
        try:
            error_body = e.response.json() if e.response is not None else {}
        except Exception:
            error_body = {}
        error_type = error_body.get("type", "")
        error_msg = error_body.get("message", "")
        logger.error(
            f"AirTable HTTP error ({status_code}): {e} | "
            f"type={error_type} message={error_msg}"
        )

        # 422 from base.tables() may be caused by the 'include=visibleFieldIds'
        # param that pyairtable hardcodes. Retry without it before giving up.
        if status_code == 422:
            logger.info("Retrying metadata fetch without 'include' parameter...")
            try:
                url = base.meta_url("tables")
                data = base.api.get(url)
                tables = [
                    Table(None, base, ts)
                    for ts in BaseSchema.from_api(
                        data, base.api, context=base
                    ).tables
                ]
            except Exception as retry_err:
                logger.error(f"Retry also failed: {retry_err}")
                raise ValueError(
                    "Failed to read table metadata from AirTable. "
                    "The token may need to be recreated. "
                    "Try creating a brand new Personal Access Token."
                )
        else:
            _raise_for_airtable_status(status_code, error_msg)
    except ValueError:
        raise
    except Exception as e:
        logger.error(f"Failed to validate access: {e}")
        raise

    logger.info(f"Tables in the base: [{len(tables)}]")
    if not tables:
        raise ValueError("The AirTable base appears to be empty (no tables found).")

    return tables


def connect_airtable_base_to_project(
    db: Session, bt_number: str, airtable_api_key: str, airtable_base_ref: str
) -> AirTableBase:
    """Connect an AirTable base to a project."""
    logger.info(
        f"connect_airtable_base_to_project(bt_number={bt_number}, airtable_api_key=..., airtable_base_ref={airtable_base_ref})"
    )

    # Get project
    project = get_project_by_bt_number(db, bt_number)

    # Get AirTable data
    at_base = get_base_from_airtable(airtable_api_key, airtable_base_ref)
    at_tables = get_base_table_schemas_from_airtable(at_base)

    # Set up database AirTable base
    db_base = get_project_airtable_base(db, bt_number)
    if db_base:
        remove_all_tables_from_base(db, db_base)
    else:
        db_base = AirTableBase(id=at_base.id)
        db_base.airtable_access_token = airtable_api_key
        db.add(db_base)

    # Connect to project
    project.airtable_base = db_base

    # Create tables
    add_tables_to_base(db, db_base, at_tables)

    return db_base

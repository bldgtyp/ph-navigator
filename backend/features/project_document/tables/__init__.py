"""Registered project-document table contracts."""

from features.project_document.tables.attachments import AttachmentRowsResponse
from features.project_document.tables.contracts import TableContract
from features.project_document.tables.pumps import PumpsSliceResponse
from features.project_document.tables.registry import (
    get_table_contract,
    get_table_contract_by_schema_slug,
    iter_table_contracts,
)
from features.project_document.tables.rooms import RoomsSliceResponse
from features.project_document.tables.window_types import WindowTypesSliceResponse

RegisteredTableResponse = RoomsSliceResponse | PumpsSliceResponse | WindowTypesSliceResponse | AttachmentRowsResponse

__all__ = [
    "AttachmentRowsResponse",
    "RegisteredTableResponse",
    "PumpsSliceResponse",
    "RoomsSliceResponse",
    "TableContract",
    "WindowTypesSliceResponse",
    "get_table_contract",
    "get_table_contract_by_schema_slug",
    "iter_table_contracts",
]

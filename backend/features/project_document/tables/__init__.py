"""Registered project-document table contracts."""

from features.project_document.tables.contracts import TableContract
from features.project_document.tables.registry import (
    get_table_contract,
    get_table_contract_by_schema_slug,
    iter_table_contracts,
)
from features.project_document.tables.rooms import RoomsSliceResponse
from features.project_document.tables.window_types import WindowTypesSliceResponse

RegisteredTableResponse = RoomsSliceResponse | WindowTypesSliceResponse

__all__ = [
    "RegisteredTableResponse",
    "RoomsSliceResponse",
    "TableContract",
    "WindowTypesSliceResponse",
    "get_table_contract",
    "get_table_contract_by_schema_slug",
    "iter_table_contracts",
]

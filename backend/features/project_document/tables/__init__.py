"""Registered project-document table contracts."""

from features.project_document.tables.contracts import TableContract
from features.project_document.tables.registry import get_table_contract, iter_table_contracts
from features.project_document.tables.rooms import RoomsSliceResponse

RegisteredTableResponse = RoomsSliceResponse

__all__ = ["RegisteredTableResponse", "TableContract", "get_table_contract", "iter_table_contracts"]

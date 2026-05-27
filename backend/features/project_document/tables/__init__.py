"""Registered project-document table contracts."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from features.project_document.tables.attachments import AttachmentRowsResponse
    from features.project_document.tables.contracts import TableContract, TableRowsResponse
    from features.project_document.tables.pumps import PumpsSliceResponse
    from features.project_document.tables.registry import (
        get_table_contract,
        get_table_contract_by_schema_slug,
        iter_table_contracts,
    )
    from features.project_document.tables.rooms import RoomsSliceResponse
    from features.project_document.tables.window_types import WindowTypesSliceResponse

    RegisteredTableResponse = RoomsSliceResponse | PumpsSliceResponse | WindowTypesSliceResponse | TableRowsResponse


def __getattr__(name: str) -> Any:
    if name == "AttachmentRowsResponse":
        from features.project_document.tables.attachments import AttachmentRowsResponse

        return AttachmentRowsResponse
    if name in {"TableContract", "TableRowsResponse"}:
        from features.project_document.tables import contracts

        return getattr(contracts, name)
    if name == "PumpsSliceResponse":
        from features.project_document.tables.pumps import PumpsSliceResponse

        return PumpsSliceResponse
    if name == "RoomsSliceResponse":
        from features.project_document.tables.rooms import RoomsSliceResponse

        return RoomsSliceResponse
    if name == "WindowTypesSliceResponse":
        from features.project_document.tables.window_types import WindowTypesSliceResponse

        return WindowTypesSliceResponse
    if name in {"get_table_contract", "get_table_contract_by_schema_slug", "iter_table_contracts"}:
        from features.project_document.tables import registry

        return getattr(registry, name)
    if name == "RegisteredTableResponse":
        from features.project_document.tables.contracts import TableRowsResponse
        from features.project_document.tables.pumps import PumpsSliceResponse
        from features.project_document.tables.rooms import RoomsSliceResponse
        from features.project_document.tables.window_types import WindowTypesSliceResponse

        return RoomsSliceResponse | PumpsSliceResponse | WindowTypesSliceResponse | TableRowsResponse
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")

__all__ = [
    "AttachmentRowsResponse",
    "RegisteredTableResponse",
    "PumpsSliceResponse",
    "RoomsSliceResponse",
    "TableContract",
    "TableRowsResponse",
    "WindowTypesSliceResponse",
    "get_table_contract",
    "get_table_contract_by_schema_slug",
    "iter_table_contracts",
]

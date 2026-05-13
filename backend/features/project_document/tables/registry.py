"""Registry for generic project-document table behavior."""

from __future__ import annotations

from collections.abc import Iterable

from starlette import status

from features.project_document.tables.contracts import TableContract
from features.project_document.tables.rooms import rooms_contract
from features.shared.errors import api_error


def get_table_contract(table_name: str) -> TableContract:
    contract = _TABLES.get(table_name)
    if contract is None:
        raise api_error(
            status.HTTP_404_NOT_FOUND,
            "document_table_not_found",
            "Document table not found.",
            {"table_name": table_name, "supported_tables": sorted(_TABLES)},
        )
    return contract


def iter_table_contracts() -> Iterable[TableContract]:
    return sorted(_TABLES.values(), key=lambda contract: contract.name)


_TABLES: dict[str, TableContract] = {rooms_contract.name: rooms_contract}

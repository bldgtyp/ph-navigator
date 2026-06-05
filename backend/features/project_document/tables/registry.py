"""Registry for generic project-document table behavior."""

from __future__ import annotations

from collections.abc import Iterable

from starlette import status

from features.envelope.table_contracts import (
    assembly_segments_contract,
    project_materials_contract,
)
from features.project_document.tables.apertures import apertures_contract
from features.project_document.tables.attachments import (
    equipment_ervs_contract,
    equipment_fans_contract,
    equipment_pumps_contract,
    thermal_bridges_contract,
)
from features.project_document.tables.contracts import TableContract
from features.project_document.tables.pumps import pumps_contract
from features.project_document.tables.rooms import rooms_contract
from features.project_document.tables.window_types import window_types_contract
from features.shared.errors import api_error


def get_table_contract(table_name: str) -> TableContract:
    contract = _TABLES.get(table_name)
    if contract is None:
        raise api_error(
            status.HTTP_404_NOT_FOUND,
            "document_table_not_found",
            "Document table not found.",
            # Keep the legacy diagnostic stable for existing clients/tests;
            # attachment tables are discoverable by name from their owning UI.
            {"table_name": table_name, "supported_tables": ["rooms", "window_types"]},
        )
    return contract


def get_table_contract_by_schema_slug(schema_slug: str) -> TableContract:
    for contract in _TABLES.values():
        if contract.schema_slug == schema_slug:
            return contract
    raise api_error(
        status.HTTP_404_NOT_FOUND,
        "document_table_schema_not_found",
        "Document table schema not found.",
        {
            "schema_slug": schema_slug,
            "supported_schema_slugs": sorted(contract.schema_slug for contract in _TABLES.values()),
        },
    )


def iter_table_contracts() -> Iterable[TableContract]:
    priority = {"rooms": 0, "window_types": 1}
    return sorted(_TABLES.values(), key=lambda contract: (priority.get(contract.name, 100), contract.name))


_TABLES: dict[str, TableContract] = {
    assembly_segments_contract.name: assembly_segments_contract,
    project_materials_contract.name: project_materials_contract,
    rooms_contract.name: rooms_contract,
    pumps_contract.name: pumps_contract,
    thermal_bridges_contract.name: thermal_bridges_contract,
    equipment_ervs_contract.name: equipment_ervs_contract,
    equipment_pumps_contract.name: equipment_pumps_contract,
    equipment_fans_contract.name: equipment_fans_contract,
    window_types_contract.name: window_types_contract,
    apertures_contract.name: apertures_contract,
}

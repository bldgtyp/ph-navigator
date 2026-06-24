"""Registry for generic project-document table behavior."""

from __future__ import annotations

from collections.abc import Iterable

from starlette import status

from features.envelope.table_contracts import (
    assembly_segments_contract,
    project_materials_contract,
)
from features.project_document.tables._status_field import STATUS_FIELD_KEY, STATUS_TABLE_NAMES
from features.project_document.tables.apertures import apertures_contract
from features.project_document.tables.appliances import appliances_contract
from features.project_document.tables.contracts import TableContract
from features.project_document.tables.electric_heaters import electric_heaters_contract
from features.project_document.tables.fans import fans_contract
from features.project_document.tables.heat_pumps import (
    heat_pumps_indoor_equip_contract,
    heat_pumps_indoor_units_contract,
    heat_pumps_outdoor_equip_contract,
    heat_pumps_outdoor_units_contract,
)
from features.project_document.tables.hot_water_heaters import hot_water_heaters_contract
from features.project_document.tables.hot_water_tanks import hot_water_tanks_contract
from features.project_document.tables.pumps import pumps_contract
from features.project_document.tables.rooms import rooms_contract
from features.project_document.tables.space_types import space_types_contract
from features.project_document.tables.thermal_bridges import thermal_bridges_contract
from features.project_document.tables.ventilators import ventilators_contract
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
            {"table_name": table_name, "supported_tables": ["rooms", "apertures"]},
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
    priority = {"rooms": 0, "apertures": 1}
    return sorted(_TABLES.values(), key=lambda contract: (priority.get(contract.name, 100), contract.name))


_TABLES: dict[str, TableContract] = {
    assembly_segments_contract.name: assembly_segments_contract,
    project_materials_contract.name: project_materials_contract,
    rooms_contract.name: rooms_contract,
    space_types_contract.name: space_types_contract,
    ventilators_contract.name: ventilators_contract,
    appliances_contract.name: appliances_contract,
    pumps_contract.name: pumps_contract,
    fans_contract.name: fans_contract,
    heat_pumps_outdoor_equip_contract.name: heat_pumps_outdoor_equip_contract,
    heat_pumps_indoor_equip_contract.name: heat_pumps_indoor_equip_contract,
    heat_pumps_outdoor_units_contract.name: heat_pumps_outdoor_units_contract,
    heat_pumps_indoor_units_contract.name: heat_pumps_indoor_units_contract,
    hot_water_heaters_contract.name: hot_water_heaters_contract,
    hot_water_tanks_contract.name: hot_water_tanks_contract,
    electric_heaters_contract.name: electric_heaters_contract,
    thermal_bridges_contract.name: thermal_bridges_contract,
    apertures_contract.name: apertures_contract,
}


# Drift guard: the set of tables whose built-in FieldDefs include the shared
# `status` field must exactly match `STATUS_TABLE_NAMES`. `empty_project_
# document` seeds a `<table>.status` option list for every name in that tuple,
# and the generic-table validator rejects a `custom_values.status` value with no
# matching option list — so a table that grows the field but is missing from the
# tuple (or vice versa) would break document validation. This module-load check
# keeps the two in sync, mirroring the per-table `record_id` seed assertion.
_tables_with_status_field = {
    contract.name
    for contract in _TABLES.values()
    if contract.field_registry is not None and STATUS_FIELD_KEY in contract.field_registry.field_keys
}
assert _tables_with_status_field == set(STATUS_TABLE_NAMES), (
    "STATUS_TABLE_NAMES is out of sync with the tables carrying the status field: "
    f"tables with field={sorted(_tables_with_status_field)}, "
    f"STATUS_TABLE_NAMES={sorted(STATUS_TABLE_NAMES)}"
)

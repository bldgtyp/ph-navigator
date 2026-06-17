"""Registered project-document table contracts."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from features.project_document.tables.apertures import AperturesSliceResponse
    from features.project_document.tables.appliances import AppliancesSliceResponse
    from features.project_document.tables.contracts import TableContract, TableRowsResponse
    from features.project_document.tables.electric_heaters import ElectricHeatersSliceResponse
    from features.project_document.tables.fans import FansSliceResponse
    from features.project_document.tables.heat_pumps import (
        IndoorEquipResponse,
        IndoorUnitsResponse,
        OutdoorEquipResponse,
        OutdoorUnitsResponse,
    )
    from features.project_document.tables.hot_water_heaters import HotWaterHeatersSliceResponse
    from features.project_document.tables.hot_water_tanks import HotWaterTanksSliceResponse
    from features.project_document.tables.pumps import PumpsSliceResponse
    from features.project_document.tables.registry import (
        get_table_contract,
        get_table_contract_by_schema_slug,
        iter_table_contracts,
    )
    from features.project_document.tables.rooms import RoomsSliceResponse
    from features.project_document.tables.space_types import SpaceTypesSliceResponse
    from features.project_document.tables.thermal_bridges import ThermalBridgesSliceResponse
    from features.project_document.tables.ventilators import VentilatorsSliceResponse

    RegisteredTableResponse = (
        RoomsSliceResponse
        | SpaceTypesSliceResponse
        | ThermalBridgesSliceResponse
        | AppliancesSliceResponse
        | ElectricHeatersSliceResponse
        | VentilatorsSliceResponse
        | PumpsSliceResponse
        | FansSliceResponse
        | OutdoorEquipResponse
        | IndoorEquipResponse
        | OutdoorUnitsResponse
        | IndoorUnitsResponse
        | HotWaterHeatersSliceResponse
        | HotWaterTanksSliceResponse
        | AperturesSliceResponse
        | TableRowsResponse
    )


def __getattr__(name: str) -> Any:
    if name == "AttachmentRowsResponse":
        from features.project_document.tables.contracts import TableRowsResponse

        return TableRowsResponse
    if name in {"TableContract", "TableRowsResponse"}:
        from features.project_document.tables import contracts

        return getattr(contracts, name)
    if name == "PumpsSliceResponse":
        from features.project_document.tables.pumps import PumpsSliceResponse

        return PumpsSliceResponse
    if name == "AppliancesSliceResponse":
        from features.project_document.tables.appliances import AppliancesSliceResponse

        return AppliancesSliceResponse
    if name == "FansSliceResponse":
        from features.project_document.tables.fans import FansSliceResponse

        return FansSliceResponse
    if name == "OutdoorEquipResponse":
        from features.project_document.tables.heat_pumps import OutdoorEquipResponse

        return OutdoorEquipResponse
    if name == "IndoorEquipResponse":
        from features.project_document.tables.heat_pumps import IndoorEquipResponse

        return IndoorEquipResponse
    if name == "OutdoorUnitsResponse":
        from features.project_document.tables.heat_pumps import OutdoorUnitsResponse

        return OutdoorUnitsResponse
    if name == "IndoorUnitsResponse":
        from features.project_document.tables.heat_pumps import IndoorUnitsResponse

        return IndoorUnitsResponse
    if name == "ElectricHeatersSliceResponse":
        from features.project_document.tables.electric_heaters import ElectricHeatersSliceResponse

        return ElectricHeatersSliceResponse
    if name == "HotWaterHeatersSliceResponse":
        from features.project_document.tables.hot_water_heaters import HotWaterHeatersSliceResponse

        return HotWaterHeatersSliceResponse
    if name == "HotWaterTanksSliceResponse":
        from features.project_document.tables.hot_water_tanks import HotWaterTanksSliceResponse

        return HotWaterTanksSliceResponse
    if name == "RoomsSliceResponse":
        from features.project_document.tables.rooms import RoomsSliceResponse

        return RoomsSliceResponse
    if name == "SpaceTypesSliceResponse":
        from features.project_document.tables.space_types import SpaceTypesSliceResponse

        return SpaceTypesSliceResponse
    if name == "VentilatorsSliceResponse":
        from features.project_document.tables.ventilators import VentilatorsSliceResponse

        return VentilatorsSliceResponse
    if name == "ThermalBridgesSliceResponse":
        from features.project_document.tables.thermal_bridges import ThermalBridgesSliceResponse

        return ThermalBridgesSliceResponse
    if name == "AperturesSliceResponse":
        from features.project_document.tables.apertures import AperturesSliceResponse

        return AperturesSliceResponse
    if name in {"get_table_contract", "get_table_contract_by_schema_slug", "iter_table_contracts"}:
        from features.project_document.tables import registry

        return getattr(registry, name)
    if name == "RegisteredTableResponse":
        from features.project_document.tables.apertures import AperturesSliceResponse
        from features.project_document.tables.appliances import AppliancesSliceResponse
        from features.project_document.tables.contracts import TableRowsResponse
        from features.project_document.tables.electric_heaters import ElectricHeatersSliceResponse
        from features.project_document.tables.fans import FansSliceResponse
        from features.project_document.tables.heat_pumps import (
            IndoorEquipResponse,
            IndoorUnitsResponse,
            OutdoorEquipResponse,
            OutdoorUnitsResponse,
        )
        from features.project_document.tables.hot_water_heaters import HotWaterHeatersSliceResponse
        from features.project_document.tables.hot_water_tanks import HotWaterTanksSliceResponse
        from features.project_document.tables.pumps import PumpsSliceResponse
        from features.project_document.tables.rooms import RoomsSliceResponse
        from features.project_document.tables.space_types import SpaceTypesSliceResponse
        from features.project_document.tables.thermal_bridges import ThermalBridgesSliceResponse
        from features.project_document.tables.ventilators import VentilatorsSliceResponse

        return (
            RoomsSliceResponse
            | SpaceTypesSliceResponse
            | ThermalBridgesSliceResponse
            | AppliancesSliceResponse
            | ElectricHeatersSliceResponse
            | VentilatorsSliceResponse
            | PumpsSliceResponse
            | FansSliceResponse
            | OutdoorEquipResponse
            | IndoorEquipResponse
            | OutdoorUnitsResponse
            | IndoorUnitsResponse
            | HotWaterHeatersSliceResponse
            | HotWaterTanksSliceResponse
            | AperturesSliceResponse
            | TableRowsResponse
        )
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


__all__ = [
    "AperturesSliceResponse",
    "AttachmentRowsResponse",
    "AppliancesSliceResponse",
    "ElectricHeatersSliceResponse",
    "RegisteredTableResponse",
    "FansSliceResponse",
    "HotWaterHeatersSliceResponse",
    "HotWaterTanksSliceResponse",
    "IndoorEquipResponse",
    "IndoorUnitsResponse",
    "OutdoorEquipResponse",
    "OutdoorUnitsResponse",
    "PumpsSliceResponse",
    "RoomsSliceResponse",
    "SpaceTypesSliceResponse",
    "TableContract",
    "TableRowsResponse",
    "ThermalBridgesSliceResponse",
    "VentilatorsSliceResponse",
    "get_table_contract",
    "get_table_contract_by_schema_slug",
    "iter_table_contracts",
]

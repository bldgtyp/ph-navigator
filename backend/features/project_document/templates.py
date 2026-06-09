"""Empty-document construction helpers for new projects."""

from __future__ import annotations

from features.heat_pumps.models import HeatPumpsTableSlice
from features.project_document.document import (
    APPLIANCE_ENERGY_STAR_OPTION_KEY,
    APPLIANCE_TYPE_OPTION_KEY,
    FAN_TYPE_OPTION_KEY,
    HOT_WATER_HEATER_TYPE_OPTION_KEY,
    HOT_WATER_TANK_TYPE_OPTION_KEY,
    THERMAL_BRIDGE_TYPE_OPTION_KEY,
    VENTILATOR_INSIDE_OUTSIDE_OPTION_KEY,
    AppliancesTableEnvelope,
    ElectricHeatersTableEnvelope,
    EmptyEquipmentTables,
    FansTableEnvelope,
    HotWaterHeatersTableEnvelope,
    HotWaterTanksTableEnvelope,
    ProjectDocumentProject,
    ProjectDocumentTables,
    ProjectDocumentV1,
    PumpsTableEnvelope,
    RoomsTableEnvelope,
    SingleSelectOption,
    ThermalBridgesTableEnvelope,
    VentilatorsTableEnvelope,
)
from features.project_document.tables.appliances import APPLIANCES_BUILT_IN_FIELD_DEFS
from features.project_document.tables.electric_heaters import ELECTRIC_HEATERS_BUILT_IN_FIELD_DEFS
from features.project_document.tables.fans import FANS_BUILT_IN_FIELD_DEFS
from features.project_document.tables.hot_water_heaters import HOT_WATER_HEATERS_BUILT_IN_FIELD_DEFS
from features.project_document.tables.hot_water_tanks import HOT_WATER_TANKS_BUILT_IN_FIELD_DEFS
from features.project_document.tables.pumps import PUMPS_BUILT_IN_FIELD_DEFS
from features.project_document.tables.rooms import ROOMS_BUILT_IN_FIELD_DEFS
from features.project_document.tables.thermal_bridges import THERMAL_BRIDGES_BUILT_IN_FIELD_DEFS
from features.project_document.tables.ventilators import VENTILATORS_BUILT_IN_FIELD_DEFS
from features.projects.models import CreateProjectRequest


def empty_project_document(payload: CreateProjectRequest) -> ProjectDocumentV1:
    # New projects land the built-in FieldDef seeds (incl. `record_id`)
    # into each FieldDef-capable table verbatim. `validate_document_
    # references` enforces "exactly one record_id" per table, so the
    # seeding has to happen here rather than at first save.
    return ProjectDocumentV1(
        project=ProjectDocumentProject(
            name=payload.name,
            bt_number=payload.bt_number,
            cert_programs=payload.cert_programs,
            phius_number=payload.phius_number,
            phius_dropbox_url=payload.phius_dropbox_url,
        ),
        tables=ProjectDocumentTables(
            rooms=RoomsTableEnvelope(field_defs=list(ROOMS_BUILT_IN_FIELD_DEFS)),
            thermal_bridges=ThermalBridgesTableEnvelope(field_defs=list(THERMAL_BRIDGES_BUILT_IN_FIELD_DEFS)),
            equipment=EmptyEquipmentTables(
                appliances=AppliancesTableEnvelope(field_defs=list(APPLIANCES_BUILT_IN_FIELD_DEFS)),
                electric_heaters=ElectricHeatersTableEnvelope(field_defs=list(ELECTRIC_HEATERS_BUILT_IN_FIELD_DEFS)),
                ervs=VentilatorsTableEnvelope(field_defs=list(VENTILATORS_BUILT_IN_FIELD_DEFS)),
                pumps=PumpsTableEnvelope(field_defs=list(PUMPS_BUILT_IN_FIELD_DEFS)),
                fans=FansTableEnvelope(field_defs=list(FANS_BUILT_IN_FIELD_DEFS)),
                hot_water_heaters=HotWaterHeatersTableEnvelope(field_defs=list(HOT_WATER_HEATERS_BUILT_IN_FIELD_DEFS)),
                hot_water_tanks=HotWaterTanksTableEnvelope(field_defs=list(HOT_WATER_TANKS_BUILT_IN_FIELD_DEFS)),
                heat_pumps=HeatPumpsTableSlice(),
            ),
        ),
        single_select_options={
            "rooms.floor_level": [],
            "rooms.building_zone": [],
            THERMAL_BRIDGE_TYPE_OPTION_KEY: [
                SingleSelectOption(id="opt_tb_ambient", label="15-Ambient", color="#0ea5e9", order=0),
                SingleSelectOption(id="opt_tb_perimeter", label="16-Perimeter", color="#f97316", order=1),
                SingleSelectOption(id="opt_tb_below_grade", label="17-Below-Grade", color="#64748b", order=2),
            ],
            "pumps.device_type": [
                SingleSelectOption(
                    id="opt_pump_heat_circulation", label="4-Heat Circulation Pump", color="#0ea5e9", order=0
                ),
                SingleSelectOption(
                    id="opt_pump_dhw_circulation", label="6-DHW Circulation Pump", color="#14b8a6", order=1
                ),
                SingleSelectOption(id="opt_pump_dhw_storage", label="7-DHW Storage Pump", color="#f97316", order=2),
                SingleSelectOption(id="opt_pump_other", label="10-Other", color="#64748b", order=3),
            ],
            VENTILATOR_INSIDE_OUTSIDE_OPTION_KEY: [
                SingleSelectOption(id="opt_vent_inside", label="Inside", color="#3b82f6", order=0),
                SingleSelectOption(id="opt_vent_outside", label="Outside", color="#10b981", order=1),
            ],
            FAN_TYPE_OPTION_KEY: [
                SingleSelectOption(id="opt_fan_dryer", label="1-Dryer", color="#f97316", order=0),
                SingleSelectOption(id="opt_fan_kitchen_hood", label="2-Kitchen Hood", color="#0ea5e9", order=1),
                SingleSelectOption(id="opt_fan_user_defined", label="3-User Defined", color="#8b5cf6", order=2),
            ],
            HOT_WATER_HEATER_TYPE_OPTION_KEY: [
                SingleSelectOption(id="opt_hwh_electric", label="1-Electric", color="#ef4444", order=0),
                SingleSelectOption(id="opt_hwh_boiler_gas_oil", label="2-Boiler (Gas/Oil)", color="#f97316", order=1),
                SingleSelectOption(id="opt_hwh_boiler_wood", label="3-Boiler (Wood)", color="#92400e", order=2),
                SingleSelectOption(id="opt_hwh_district", label="4-District", color="#6366f1", order=3),
                SingleSelectOption(
                    id="opt_hwh_heat_pump_annual_cop",
                    label="5-Heat Pump (Annual COP)",
                    color="#10b981",
                    order=4,
                ),
                SingleSelectOption(
                    id="opt_hwh_heat_pump_monthly_cop",
                    label="6-Heat Pump (Monthly COP)",
                    color="#14b8a6",
                    order=5,
                ),
                SingleSelectOption(
                    id="opt_hwh_heat_pump_inside",
                    label="7-Heat Pump (Inside)",
                    color="#0ea5e9",
                    order=6,
                ),
            ],
            HOT_WATER_TANK_TYPE_OPTION_KEY: [
                SingleSelectOption(id="opt_hwt_dhw_heating", label="1-DHW and Heating", color="#0ea5e9", order=0),
                SingleSelectOption(id="opt_hwt_dhw_only", label="2-DHW only", color="#14b8a6", order=1),
            ],
            APPLIANCE_TYPE_OPTION_KEY: [
                SingleSelectOption(id="opt_appl_dishwasher", label="1-dishwasher", color="#0ea5e9", order=0),
                SingleSelectOption(id="opt_appl_clothes_washer", label="2-clothes_washer", color="#14b8a6", order=1),
                SingleSelectOption(id="opt_appl_clothes_dryer", label="3-clothes_dryer", color="#f97316", order=2),
                SingleSelectOption(id="opt_appl_fridge", label="4-fridge", color="#3b82f6", order=3),
                SingleSelectOption(id="opt_appl_freezer", label="5-freezer", color="#6366f1", order=4),
                SingleSelectOption(id="opt_appl_fridge_freezer", label="6-fridge_freezer", color="#8b5cf6", order=5),
                SingleSelectOption(id="opt_appl_cooking", label="7-cooking", color="#ef4444", order=6),
                SingleSelectOption(id="opt_appl_phius_mel", label="13-PHIUS_MEL", color="#f59e0b", order=7),
                SingleSelectOption(
                    id="opt_appl_phius_lighting_int", label="14-PHIUS_Lighting_Int", color="#84cc16", order=8
                ),
                SingleSelectOption(
                    id="opt_appl_phius_lighting_ext", label="15-PHIUS_Lighting_Ext", color="#22c55e", order=9
                ),
                SingleSelectOption(
                    id="opt_appl_phius_lighting_garage", label="16-PHIUS_Lighting_Garage", color="#10b981", order=10
                ),
                SingleSelectOption(
                    id="opt_appl_custom_electric_per_year",
                    label="11-Custom_Electric_per_Year",
                    color="#06b6d4",
                    order=11,
                ),
                SingleSelectOption(
                    id="opt_appl_custom_electric_lighting_per_year",
                    label="17-Custom_Electric_Lighting_per_Year",
                    color="#6366f1",
                    order=12,
                ),
                SingleSelectOption(
                    id="opt_appl_custom_electric_mel_per_use",
                    label="18-Custom_Electric_MEL_per_Use",
                    color="#8b5cf6",
                    order=13,
                ),
                SingleSelectOption(
                    id="opt_appl_commercial_dishwasher", label="21-Commercial_Dishwasher", color="#a855f7", order=14
                ),
                SingleSelectOption(
                    id="opt_appl_commercial_refrigerator", label="22-Commercial_Refrigerator", color="#d946ef", order=15
                ),
                SingleSelectOption(
                    id="opt_appl_commercial_cooking", label="23-Commercial_Cooking", color="#ec4899", order=16
                ),
                SingleSelectOption(
                    id="opt_appl_commercial_custom", label="24-Commercial_Custom", color="#64748b", order=17
                ),
            ],
            APPLIANCE_ENERGY_STAR_OPTION_KEY: [
                SingleSelectOption(id="opt_appl_energy_star_yes", label="Yes", color="#10b981", order=0),
                SingleSelectOption(id="opt_appl_energy_star_no", label="No", color="#64748b", order=1),
            ],
        },
    )

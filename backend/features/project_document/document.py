"""Canonical ProjectDocumentV1 schema and table row contracts (v3).

Phase 1b: every built-in field-config lives in the persisted document
under the same per-table `field_defs` array that previously only held
custom fields. Mutable-type built-ins (Rooms: number/name/num_people/
num_bedrooms; Pumps: tag/use/manufacturer/model/volts/horse_power/
wattage/flow_gpm/runtime_khr_yr) live in the row's `custom_values` bag.
Locked-type built-ins (floor_level, building_zone, icfa_factor;
device_type, phase, link) keep their typed Pydantic columns so domain
invariants (ge=0, le=1.0, opt_*, etc.) survive.

Schema version is 3; no v2 reader is provided (pre-deploy posture).

Layout: this module now hosts the cross-table ProjectDocumentV1 model
plus the option-key constants and typed-column-key sets used by every
table feature. Row + envelope models live in ``rows.py``; envelope
(assemblies + apertures + materials) models live in ``envelope_models.py``;
the private invariant validators called by ``ProjectDocumentV1`` live
in ``_validators.py``. Every symbol previously importable from
``project_document.document`` is re-exported below so existing callers
keep working.
"""

from __future__ import annotations

from typing import Any, Literal, cast

from pydantic import BaseModel, ConfigDict, Field, model_validator

from features.project_document._validators import (
    collect_target_row_ids,
    index_table_field_defs,
    require_record_id_seeded,
    validate_default_option_ids,
    validate_envelope_references,
    validate_linked_record_field_defs,
    validate_rows_custom_links,
    validate_rows_custom_values,
    validate_unique_ids,
)
from features.project_document.custom_fields import RESERVED_FIELD_KEY_RECORD_ID, TableFieldDef, normalize_display_name
from features.project_document.envelope_models import (
    APERTURE_DEFAULT_FRAME_NAME,
    APERTURE_DEFAULT_GLAZING_NAME,
    CATALOG_RECORD_ID_PATTERN,
    CATALOG_VERSION_ID_PATTERN,
    ApertureElement,
    ApertureElementFrames,
    ApertureOperation,
    ApertureOperationDirection,
    ApertureOperationType,
    ApertureTypeEntry,
    Assembly,
    AssemblyLayer,
    AssemblyOrientation,
    AssemblySegment,
    AssemblyType,
    CatalogOrigin,
    CatalogTableName,
    FrameRef,
    GlazingRef,
    ProjectMaterial,
    SpecificationStatus,
    require_catalog_origin_family,
)
from features.project_document.rows import (
    ApplianceRow,
    AppliancesTableEnvelope,
    ElectricHeaterRow,
    ElectricHeatersTableEnvelope,
    EmptyEquipmentTables,
    FanRow,
    FansTableEnvelope,
    HotWaterHeaterRow,
    HotWaterHeatersTableEnvelope,
    HotWaterTankRow,
    HotWaterTanksTableEnvelope,
    PumpRow,
    PumpsTableEnvelope,
    RoomRow,
    RoomsTableEnvelope,
    RowWithCustomFields,
    SingleSelectOption,
    SpaceTypeRow,
    SpaceTypesTableEnvelope,
    ThermalBridgeRow,
    ThermalBridgesTableEnvelope,
    VentilatorRow,
    VentilatorsTableEnvelope,
)
from features.projects.models import CertificationProgram

ROOM_FLOOR_LEVEL_OPTION_KEY = "rooms.floor_level"
ROOM_BUILDING_ZONE_OPTION_KEY = "rooms.building_zone"
RoomOptionKey = Literal["rooms.floor_level", "rooms.building_zone"]
ROOM_OPTION_KEYS: tuple[RoomOptionKey, ...] = (
    ROOM_FLOOR_LEVEL_OPTION_KEY,
    ROOM_BUILDING_ZONE_OPTION_KEY,
)
PUMP_DEVICE_TYPE_OPTION_KEY = "pumps.device_type"
PumpOptionKey = Literal["pumps.device_type"]
PUMP_OPTION_KEYS: tuple[PumpOptionKey, ...] = (PUMP_DEVICE_TYPE_OPTION_KEY,)
VENTILATOR_INSIDE_OUTSIDE_OPTION_KEY = "ventilators.inside_outside"
VentilatorOptionKey = Literal["ventilators.inside_outside"]
VENTILATOR_OPTION_KEYS: tuple[VentilatorOptionKey, ...] = (VENTILATOR_INSIDE_OUTSIDE_OPTION_KEY,)
FAN_TYPE_OPTION_KEY = "fans.type"
FanOptionKey = Literal["fans.type"]
FAN_OPTION_KEYS: tuple[FanOptionKey, ...] = (FAN_TYPE_OPTION_KEY,)
HOT_WATER_HEATER_TYPE_OPTION_KEY = "hot_water_heaters.type"
HotWaterHeaterOptionKey = Literal["hot_water_heaters.type"]
HOT_WATER_HEATER_OPTION_KEYS: tuple[HotWaterHeaterOptionKey, ...] = (HOT_WATER_HEATER_TYPE_OPTION_KEY,)
HOT_WATER_TANK_TYPE_OPTION_KEY = "hot_water_tanks.type"
HotWaterTankOptionKey = Literal["hot_water_tanks.type"]
HOT_WATER_TANK_OPTION_KEYS: tuple[HotWaterTankOptionKey, ...] = (HOT_WATER_TANK_TYPE_OPTION_KEY,)
APPLIANCE_TYPE_OPTION_KEY = "appliances.type"
APPLIANCE_ENERGY_STAR_OPTION_KEY = "appliances.energy_star"
ApplianceOptionKey = Literal["appliances.type", "appliances.energy_star"]
APPLIANCE_OPTION_KEYS: tuple[ApplianceOptionKey, ...] = (
    APPLIANCE_TYPE_OPTION_KEY,
    APPLIANCE_ENERGY_STAR_OPTION_KEY,
)
THERMAL_BRIDGE_TYPE_OPTION_KEY = "thermal_bridges.type"
ThermalBridgeOptionKey = Literal["thermal_bridges.type"]
THERMAL_BRIDGE_OPTION_KEYS: tuple[ThermalBridgeOptionKey, ...] = (THERMAL_BRIDGE_TYPE_OPTION_KEY,)
ROOM_SPACE_TYPE_FIELD_KEY = "space_type_id"

# v7 wire shape: Rooms adds a built-in linked-record FieldDef
# (`space_type_id`) targeting Space-Types.
#
# v6 wire shape: Space-Types adds a first-class top-level table.
#
# v4 wire shape: Phase 2 promotes the pinned identifier to a real
# `record_id` FieldDef on every FieldDef-capable table; Pumps' `tag`
# entry is renamed to `record_id` (display label stays "Tag"). Pre-
# deploy posture (PRD §P3.6) — no v2/v3 reader is provided; dev DBs
# rebuild on the phase boundary.
CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION = 7

# Field keys that have a typed Pydantic column on the row model. Used
# to split read/write paths between typed columns and the
# `custom_values` bag. Every field on the table NOT in this set lives
# in `custom_values` — that includes all custom fields and any
# mutable-type built-in (Rooms: number/name/num_people/num_bedrooms;
# Pumps: tag/use/manufacturer/etc.).
#
# Source of truth is each row model's declared attribute set in
# ``rows.py``; these tuples enumerate the subset that the validator /
# formula accessors / catalog-refresh path needs to branch on.
ROOMS_TYPED_COLUMN_FIELD_KEYS: frozenset[str] = frozenset(
    {"id", "floor_level", "building_zone", "icfa_factor", "catalog_origin", "notes"}
)
PUMPS_TYPED_COLUMN_FIELD_KEYS: frozenset[str] = frozenset(
    {"id", "device_type", "phase", "link", "notes", "datasheet_asset_ids"}
)
VENTILATORS_TYPED_COLUMN_FIELD_KEYS: frozenset[str] = frozenset({"id", "inside_outside", "url", "notes"})
FANS_TYPED_COLUMN_FIELD_KEYS: frozenset[str] = frozenset(
    {"id", "fan_type", "phase", "url", "notes", "datasheet_asset_ids"}
)
HOT_WATER_HEATERS_TYPED_COLUMN_FIELD_KEYS: frozenset[str] = frozenset(
    {"id", "heater_type", "phase", "url", "notes", "datasheet_asset_ids"}
)
HOT_WATER_TANKS_TYPED_COLUMN_FIELD_KEYS: frozenset[str] = frozenset(
    {"id", "tank_type", "url", "notes", "datasheet_asset_ids"}
)
ELECTRIC_HEATERS_TYPED_COLUMN_FIELD_KEYS: frozenset[str] = frozenset({"id", "url", "notes"})
APPLIANCES_TYPED_COLUMN_FIELD_KEYS: frozenset[str] = frozenset(
    {"id", "appliance_type", "energy_star", "url", "notes", "datasheet_asset_ids"}
)
THERMAL_BRIDGES_TYPED_COLUMN_FIELD_KEYS: frozenset[str] = frozenset(
    {"id", "thermal_bridge_type", "pdf_report_asset_ids", "notes"}
)
SPACE_TYPES_TYPED_COLUMN_FIELD_KEYS: frozenset[str] = frozenset({"id"})


class ProjectDocumentProject(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str
    bt_number: str
    cert_programs: list[CertificationProgram] = Field(default_factory=list)
    phius_number: str | None = None
    phius_dropbox_url: str | None = None


class ManufacturerFilters(BaseModel):
    """Per-project manufacturer allow-lists for frame / glazing pickers.

    ``None`` (absence) for either field means "all manufacturers in the
    catalog are enabled" — the default empty state. The explicit
    ``[]`` empty list means "no manufacturer enabled" (the user has
    deliberately cleared the column). The two states are kept
    distinct on purpose: a missing key cannot be confused with an
    intentional clear-all.
    """

    model_config = ConfigDict(extra="forbid")

    frame_manufacturers_enabled: list[str] | None = None
    glazing_manufacturers_enabled: list[str] | None = None


class ProjectDocumentTables(BaseModel):
    model_config = ConfigDict(extra="forbid")

    assemblies: list[Assembly] = Field(default_factory=list)
    project_materials: list[ProjectMaterial] = Field(default_factory=list)
    apertures: list[ApertureTypeEntry] = Field(default_factory=list)
    rooms: RoomsTableEnvelope = Field(default_factory=RoomsTableEnvelope)
    space_types: SpaceTypesTableEnvelope = Field(default_factory=SpaceTypesTableEnvelope)
    thermal_bridges: ThermalBridgesTableEnvelope = Field(default_factory=ThermalBridgesTableEnvelope)
    equipment: EmptyEquipmentTables = Field(default_factory=EmptyEquipmentTables)
    manufacturer_filters: ManufacturerFilters | None = None

    @model_validator(mode="before")
    @classmethod
    def _migrate_legacy_manufacturer_filters(cls, data: object) -> object:
        # Earlier scaffold stored ``manufacturer_filters: []`` as a list
        # placeholder. Coerce that into ``None`` so existing dev
        # documents survive the schema upgrade.
        if not isinstance(data, dict):
            return data
        as_dict = cast(dict[str, Any], data)
        if isinstance(as_dict.get("manufacturer_filters"), list):
            return {**as_dict, "manufacturer_filters": None}
        return data


class ProjectDocumentV1(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schema_version: Literal[7] = CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION
    project: ProjectDocumentProject
    tables: ProjectDocumentTables = Field(default_factory=ProjectDocumentTables)
    single_select_options: dict[str, list[SingleSelectOption]] = Field(
        default_factory=lambda: {
            ROOM_FLOOR_LEVEL_OPTION_KEY: [],
            ROOM_BUILDING_ZONE_OPTION_KEY: [],
            PUMP_DEVICE_TYPE_OPTION_KEY: [],
            VENTILATOR_INSIDE_OUTSIDE_OPTION_KEY: [],
            FAN_TYPE_OPTION_KEY: [],
            HOT_WATER_HEATER_TYPE_OPTION_KEY: [],
            HOT_WATER_TANK_TYPE_OPTION_KEY: [],
            APPLIANCE_TYPE_OPTION_KEY: [],
            APPLIANCE_ENERGY_STAR_OPTION_KEY: [],
            THERMAL_BRIDGE_TYPE_OPTION_KEY: [],
        }
    )

    @model_validator(mode="after")
    def validate_document_references(self) -> ProjectDocumentV1:
        for key in ROOM_OPTION_KEYS:
            self.single_select_options.setdefault(key, [])
        for key in PUMP_OPTION_KEYS:
            self.single_select_options.setdefault(key, [])
        for key in VENTILATOR_OPTION_KEYS:
            self.single_select_options.setdefault(key, [])
        for key in FAN_OPTION_KEYS:
            self.single_select_options.setdefault(key, [])
        for key in HOT_WATER_HEATER_OPTION_KEYS:
            self.single_select_options.setdefault(key, [])
        for key in HOT_WATER_TANK_OPTION_KEYS:
            self.single_select_options.setdefault(key, [])
        for key in APPLIANCE_OPTION_KEYS:
            self.single_select_options.setdefault(key, [])
        for key in THERMAL_BRIDGE_OPTION_KEYS:
            self.single_select_options.setdefault(key, [])

        for key, options in self.single_select_options.items():
            option_ids: set[str] = set()
            labels: set[str] = set()
            for option in options:
                if option.id in option_ids:
                    raise ValueError(f"Duplicate option id in {key}: {option.id}")
                option_ids.add(option.id)
                normalized_label = normalize_display_name(option.label)
                if normalized_label in labels:
                    raise ValueError(f"Duplicate option label in {key}: {option.label}")
                labels.add(normalized_label)

        target_row_ids = collect_target_row_ids(self)

        rooms_field_defs_by_key = index_table_field_defs("rooms", self.tables.rooms.field_defs)
        require_record_id_seeded("rooms", rooms_field_defs_by_key)
        validate_linked_record_field_defs(
            table_label="rooms",
            table_path=("rooms",),
            field_defs_by_key=rooms_field_defs_by_key,
        )
        floor_option_ids = {option.id for option in self.single_select_options[ROOM_FLOOR_LEVEL_OPTION_KEY]}
        zone_option_ids = {option.id for option in self.single_select_options[ROOM_BUILDING_ZONE_OPTION_KEY]}
        room_ids: set[str] = set()
        for room in self.tables.rooms.rows:
            if room.id in room_ids:
                raise ValueError(f"Duplicate room id: {room.id}")
            room_ids.add(room.id)

            if room.floor_level is not None and room.floor_level not in floor_option_ids:
                raise ValueError(f"Missing floor-level option for room {room.id}: {room.floor_level}")
            if room.building_zone is not None and room.building_zone not in zone_option_ids:
                raise ValueError(f"Missing building-zone option for room {room.id}: {room.building_zone}")

        validate_rows_custom_values(
            table_label="rooms",
            row_label="room",
            rows=[(room.id, room.custom_values) for room in self.tables.rooms.rows],
            field_defs_by_key=rooms_field_defs_by_key,
            single_select_options=self.single_select_options,
        )
        validate_rows_custom_links(
            table_label="rooms",
            row_label="room",
            rows=[(room.id, room.custom_values, room.custom_links) for room in self.tables.rooms.rows],
            field_defs_by_key=rooms_field_defs_by_key,
            target_row_ids=target_row_ids,
        )
        validate_default_option_ids(
            table_label="rooms",
            field_defs_by_key=rooms_field_defs_by_key,
            single_select_options=self.single_select_options,
        )

        space_types_field_defs_by_key = index_table_field_defs("space_types", self.tables.space_types.field_defs)
        require_record_id_seeded("space_types", space_types_field_defs_by_key)
        validate_unique_ids("space type", [space_type.id for space_type in self.tables.space_types.rows])
        space_type_tags: set[str] = set()
        for space_type in self.tables.space_types.rows:
            tag = space_type.custom_values.get(RESERVED_FIELD_KEY_RECORD_ID)
            name = space_type.custom_values.get("name")
            normalized_tag = normalize_display_name(tag) if isinstance(tag, str) else ""
            normalized_name = normalize_display_name(name) if isinstance(name, str) else ""
            if not normalized_tag and normalized_name:
                raise ValueError(f"Space type {space_type.id} requires a Tag")
            if normalized_tag in space_type_tags:
                raise ValueError(f"Duplicate space type Tag: {tag}")
            if normalized_tag:
                space_type_tags.add(normalized_tag)

        validate_linked_record_field_defs(
            table_label="space_types",
            table_path=("space_types",),
            field_defs_by_key=space_types_field_defs_by_key,
        )
        validate_rows_custom_values(
            table_label="space_types",
            row_label="space type",
            rows=[(space_type.id, space_type.custom_values) for space_type in self.tables.space_types.rows],
            field_defs_by_key=space_types_field_defs_by_key,
            single_select_options=self.single_select_options,
        )
        validate_rows_custom_links(
            table_label="space_types",
            row_label="space type",
            rows=[
                (space_type.id, space_type.custom_values, space_type.custom_links)
                for space_type in self.tables.space_types.rows
            ],
            field_defs_by_key=space_types_field_defs_by_key,
            target_row_ids=target_row_ids,
        )
        validate_default_option_ids(
            table_label="space_types",
            field_defs_by_key=space_types_field_defs_by_key,
            single_select_options=self.single_select_options,
        )

        pumps_field_defs_by_key = index_table_field_defs("pumps", self.tables.equipment.pumps.field_defs)
        require_record_id_seeded("pumps", pumps_field_defs_by_key)
        pump_device_type_ids = {option.id for option in self.single_select_options[PUMP_DEVICE_TYPE_OPTION_KEY]}
        pump_ids: set[str] = set()
        for pump in self.tables.equipment.pumps.rows:
            if pump.id in pump_ids:
                raise ValueError(f"Duplicate pump id: {pump.id}")
            pump_ids.add(pump.id)
            if pump.device_type is not None and pump.device_type not in pump_device_type_ids:
                raise ValueError(f"Missing pump device-type option for pump {pump.id}: {pump.device_type}")

        validate_linked_record_field_defs(
            table_label="pumps",
            table_path=("equipment", "pumps"),
            field_defs_by_key=pumps_field_defs_by_key,
        )
        validate_rows_custom_values(
            table_label="pumps",
            row_label="pump",
            rows=[(pump.id, pump.custom_values) for pump in self.tables.equipment.pumps.rows],
            field_defs_by_key=pumps_field_defs_by_key,
            single_select_options=self.single_select_options,
        )
        validate_rows_custom_links(
            table_label="pumps",
            row_label="pump",
            rows=[(pump.id, pump.custom_values, pump.custom_links) for pump in self.tables.equipment.pumps.rows],
            field_defs_by_key=pumps_field_defs_by_key,
            target_row_ids=target_row_ids,
        )

        fans_field_defs_by_key = index_table_field_defs("fans", self.tables.equipment.fans.field_defs)
        require_record_id_seeded("fans", fans_field_defs_by_key)
        fan_type_ids = {option.id for option in self.single_select_options[FAN_TYPE_OPTION_KEY]}
        fan_ids: set[str] = set()
        for fan in self.tables.equipment.fans.rows:
            if fan.id in fan_ids:
                raise ValueError(f"Duplicate fan id: {fan.id}")
            fan_ids.add(fan.id)
            if fan.fan_type is not None and fan.fan_type not in fan_type_ids:
                raise ValueError(f"Missing fan type option for fan {fan.id}: {fan.fan_type}")

        validate_linked_record_field_defs(
            table_label="fans",
            table_path=("equipment", "fans"),
            field_defs_by_key=fans_field_defs_by_key,
        )
        validate_rows_custom_values(
            table_label="fans",
            row_label="fan",
            rows=[(fan.id, fan.custom_values) for fan in self.tables.equipment.fans.rows],
            field_defs_by_key=fans_field_defs_by_key,
            single_select_options=self.single_select_options,
        )
        validate_rows_custom_links(
            table_label="fans",
            row_label="fan",
            rows=[(fan.id, fan.custom_values, fan.custom_links) for fan in self.tables.equipment.fans.rows],
            field_defs_by_key=fans_field_defs_by_key,
            target_row_ids=target_row_ids,
        )

        hot_water_heaters_field_defs_by_key = index_table_field_defs(
            "hot_water_heaters", self.tables.equipment.hot_water_heaters.field_defs
        )
        require_record_id_seeded("hot_water_heaters", hot_water_heaters_field_defs_by_key)
        hot_water_heater_type_ids = {
            option.id for option in self.single_select_options[HOT_WATER_HEATER_TYPE_OPTION_KEY]
        }
        hot_water_heater_ids: set[str] = set()
        for heater in self.tables.equipment.hot_water_heaters.rows:
            if heater.id in hot_water_heater_ids:
                raise ValueError(f"Duplicate hot water heater id: {heater.id}")
            hot_water_heater_ids.add(heater.id)
            if heater.heater_type is not None and heater.heater_type not in hot_water_heater_type_ids:
                raise ValueError(f"Missing hot water heater type option for heater {heater.id}: {heater.heater_type}")

        validate_linked_record_field_defs(
            table_label="hot_water_heaters",
            table_path=("equipment", "hot_water_heaters"),
            field_defs_by_key=hot_water_heaters_field_defs_by_key,
        )
        validate_rows_custom_values(
            table_label="hot_water_heaters",
            row_label="hot water heater",
            rows=[(heater.id, heater.custom_values) for heater in self.tables.equipment.hot_water_heaters.rows],
            field_defs_by_key=hot_water_heaters_field_defs_by_key,
            single_select_options=self.single_select_options,
        )
        validate_rows_custom_links(
            table_label="hot_water_heaters",
            row_label="hot water heater",
            rows=[
                (heater.id, heater.custom_values, heater.custom_links)
                for heater in self.tables.equipment.hot_water_heaters.rows
            ],
            field_defs_by_key=hot_water_heaters_field_defs_by_key,
            target_row_ids=target_row_ids,
        )

        hot_water_tanks_field_defs_by_key = index_table_field_defs(
            "hot_water_tanks", self.tables.equipment.hot_water_tanks.field_defs
        )
        require_record_id_seeded("hot_water_tanks", hot_water_tanks_field_defs_by_key)
        hot_water_tank_type_ids = {option.id for option in self.single_select_options[HOT_WATER_TANK_TYPE_OPTION_KEY]}
        hot_water_tank_ids: set[str] = set()
        for tank in self.tables.equipment.hot_water_tanks.rows:
            if tank.id in hot_water_tank_ids:
                raise ValueError(f"Duplicate hot water tank id: {tank.id}")
            hot_water_tank_ids.add(tank.id)
            if tank.tank_type is not None and tank.tank_type not in hot_water_tank_type_ids:
                raise ValueError(f"Missing hot water tank type option for tank {tank.id}: {tank.tank_type}")
            heat_loss_rate = tank.custom_values.get("heat_loss_rate_w_k")
            if isinstance(heat_loss_rate, (int, float)) and heat_loss_rate < 0:
                raise ValueError(f"Hot water tank heat_loss_rate_w_k must be zero or greater: {tank.id}")

        validate_linked_record_field_defs(
            table_label="hot_water_tanks",
            table_path=("equipment", "hot_water_tanks"),
            field_defs_by_key=hot_water_tanks_field_defs_by_key,
        )
        validate_rows_custom_values(
            table_label="hot_water_tanks",
            row_label="hot water tank",
            rows=[(tank.id, tank.custom_values) for tank in self.tables.equipment.hot_water_tanks.rows],
            field_defs_by_key=hot_water_tanks_field_defs_by_key,
            single_select_options=self.single_select_options,
        )
        validate_rows_custom_links(
            table_label="hot_water_tanks",
            row_label="hot water tank",
            rows=[
                (tank.id, tank.custom_values, tank.custom_links) for tank in self.tables.equipment.hot_water_tanks.rows
            ],
            field_defs_by_key=hot_water_tanks_field_defs_by_key,
            target_row_ids=target_row_ids,
        )

        electric_heaters_field_defs_by_key = index_table_field_defs(
            "electric_heaters", self.tables.equipment.electric_heaters.field_defs
        )
        require_record_id_seeded("electric_heaters", electric_heaters_field_defs_by_key)
        electric_heater_ids: set[str] = set()
        for heater in self.tables.equipment.electric_heaters.rows:
            if heater.id in electric_heater_ids:
                raise ValueError(f"Duplicate electric heater id: {heater.id}")
            electric_heater_ids.add(heater.id)

        validate_linked_record_field_defs(
            table_label="electric_heaters",
            table_path=("equipment", "electric_heaters"),
            field_defs_by_key=electric_heaters_field_defs_by_key,
        )
        validate_rows_custom_values(
            table_label="electric_heaters",
            row_label="electric heater",
            rows=[(heater.id, heater.custom_values) for heater in self.tables.equipment.electric_heaters.rows],
            field_defs_by_key=electric_heaters_field_defs_by_key,
            single_select_options=self.single_select_options,
        )
        validate_rows_custom_links(
            table_label="electric_heaters",
            row_label="electric heater",
            rows=[
                (heater.id, heater.custom_values, heater.custom_links)
                for heater in self.tables.equipment.electric_heaters.rows
            ],
            field_defs_by_key=electric_heaters_field_defs_by_key,
            target_row_ids=target_row_ids,
        )

        appliances_field_defs_by_key = index_table_field_defs("appliances", self.tables.equipment.appliances.field_defs)
        require_record_id_seeded("appliances", appliances_field_defs_by_key)
        appliance_type_ids = {option.id for option in self.single_select_options[APPLIANCE_TYPE_OPTION_KEY]}
        appliance_energy_star_ids = {
            option.id for option in self.single_select_options[APPLIANCE_ENERGY_STAR_OPTION_KEY]
        }
        appliance_ids: set[str] = set()
        for appliance in self.tables.equipment.appliances.rows:
            if appliance.id in appliance_ids:
                raise ValueError(f"Duplicate appliance id: {appliance.id}")
            appliance_ids.add(appliance.id)
            if appliance.appliance_type is not None and appliance.appliance_type not in appliance_type_ids:
                raise ValueError(
                    f"Missing appliance type option for appliance {appliance.id}: {appliance.appliance_type}"
                )
            if appliance.energy_star is not None and appliance.energy_star not in appliance_energy_star_ids:
                raise ValueError(
                    f"Missing appliance EnergyStar option for appliance {appliance.id}: {appliance.energy_star}"
                )

        validate_linked_record_field_defs(
            table_label="appliances",
            table_path=("equipment", "appliances"),
            field_defs_by_key=appliances_field_defs_by_key,
        )
        validate_rows_custom_values(
            table_label="appliances",
            row_label="appliance",
            rows=[(appliance.id, appliance.custom_values) for appliance in self.tables.equipment.appliances.rows],
            field_defs_by_key=appliances_field_defs_by_key,
            single_select_options=self.single_select_options,
        )
        validate_rows_custom_links(
            table_label="appliances",
            row_label="appliance",
            rows=[
                (appliance.id, appliance.custom_values, appliance.custom_links)
                for appliance in self.tables.equipment.appliances.rows
            ],
            field_defs_by_key=appliances_field_defs_by_key,
            target_row_ids=target_row_ids,
        )

        ventilator_ids = {row.id for row in self.tables.equipment.ervs.rows}
        heat_pumps = self.tables.equipment.heat_pumps
        self._validate_heat_pump_table_ids_and_tags(
            "heat_pump_outdoor_equip",
            "model_number",
            [(row.id, row.model_number) for row in heat_pumps.outdoor_equip],
        )
        self._validate_heat_pump_table_ids_and_tags(
            "heat_pump_indoor_equip",
            "model_number",
            [(row.id, row.model_number) for row in heat_pumps.indoor_equip],
        )
        self._validate_heat_pump_table_ids_and_tags(
            "heat_pump_outdoor_units",
            "tag",
            [(row.id, row.tag) for row in heat_pumps.outdoor_units],
        )
        self._validate_heat_pump_table_ids_and_tags(
            "heat_pump_indoor_units",
            "tag",
            [(row.id, row.tag) for row in heat_pumps.indoor_units],
        )
        heat_pump_indoor_equip_ids = {row.id for row in heat_pumps.indoor_equip}
        heat_pump_outdoor_equip_ids = {row.id for row in heat_pumps.outdoor_equip}
        heat_pump_outdoor_unit_ids = {row.id for row in heat_pumps.outdoor_units}
        for row in heat_pumps.outdoor_equip:
            if row.paired_indoor_equip_id is not None and row.paired_indoor_equip_id not in heat_pump_indoor_equip_ids:
                raise ValueError(
                    f"Missing heat-pump indoor equip for outdoor equip {row.id}: {row.paired_indoor_equip_id}"
                )
        for row in heat_pumps.outdoor_units:
            if row.outdoor_equip_id not in heat_pump_outdoor_equip_ids:
                raise ValueError(f"Missing heat-pump outdoor equip for outdoor unit {row.id}: {row.outdoor_equip_id}")
        for row in heat_pumps.indoor_units:
            if row.indoor_equip_id not in heat_pump_indoor_equip_ids:
                raise ValueError(f"Missing heat-pump indoor equip for indoor unit {row.id}: {row.indoor_equip_id}")
            if row.outdoor_unit_id is not None and row.outdoor_unit_id not in heat_pump_outdoor_unit_ids:
                raise ValueError(f"Missing heat-pump outdoor unit for indoor unit {row.id}: {row.outdoor_unit_id}")
            if row.linked_erv_unit_id is not None and row.linked_erv_unit_id not in ventilator_ids:
                raise ValueError(f"Missing linked ERV for heat-pump indoor unit {row.id}: {row.linked_erv_unit_id}")
            missing_room_ids = [room_id for room_id in row.served_room_ids if room_id not in room_ids]
            if missing_room_ids:
                raise ValueError(f"Missing served room for heat-pump indoor unit {row.id}: {missing_room_ids[0]}")

        thermal_bridges_field_defs_by_key = index_table_field_defs(
            "thermal_bridges", self.tables.thermal_bridges.field_defs
        )
        require_record_id_seeded("thermal_bridges", thermal_bridges_field_defs_by_key)
        thermal_bridge_type_ids = {option.id for option in self.single_select_options[THERMAL_BRIDGE_TYPE_OPTION_KEY]}
        thermal_bridge_ids: set[str] = set()
        for thermal_bridge in self.tables.thermal_bridges.rows:
            if thermal_bridge.id in thermal_bridge_ids:
                raise ValueError(f"Duplicate thermal bridge id: {thermal_bridge.id}")
            thermal_bridge_ids.add(thermal_bridge.id)
            if (
                thermal_bridge.thermal_bridge_type is not None
                and thermal_bridge.thermal_bridge_type not in thermal_bridge_type_ids
            ):
                raise ValueError(
                    f"Missing thermal bridge type option for thermal bridge {thermal_bridge.id}: "
                    f"{thermal_bridge.thermal_bridge_type}"
                )
            psi_value = thermal_bridge.custom_values.get("psi_value_w_mk")
            if isinstance(psi_value, (int, float)) and psi_value < 0:
                raise ValueError(f"Thermal bridge psi_value_w_mk must be zero or greater: {thermal_bridge.id}")
            frsi_value = thermal_bridge.custom_values.get("frsi_value")
            if isinstance(frsi_value, (int, float)) and not 0 <= frsi_value <= 1:
                raise ValueError(f"Thermal bridge frsi_value must be between 0 and 1: {thermal_bridge.id}")

        validate_linked_record_field_defs(
            table_label="thermal_bridges",
            table_path=("thermal_bridges",),
            field_defs_by_key=thermal_bridges_field_defs_by_key,
        )
        validate_rows_custom_values(
            table_label="thermal_bridges",
            row_label="thermal bridge",
            rows=[
                (thermal_bridge.id, thermal_bridge.custom_values) for thermal_bridge in self.tables.thermal_bridges.rows
            ],
            field_defs_by_key=thermal_bridges_field_defs_by_key,
            single_select_options=self.single_select_options,
        )
        validate_rows_custom_links(
            table_label="thermal_bridges",
            row_label="thermal bridge",
            rows=[
                (thermal_bridge.id, thermal_bridge.custom_values, thermal_bridge.custom_links)
                for thermal_bridge in self.tables.thermal_bridges.rows
            ],
            field_defs_by_key=thermal_bridges_field_defs_by_key,
            target_row_ids=target_row_ids,
        )

        ventilators_field_defs_by_key = index_table_field_defs("ventilators", self.tables.equipment.ervs.field_defs)
        require_record_id_seeded("ventilators", ventilators_field_defs_by_key)
        inside_outside_ids = {option.id for option in self.single_select_options[VENTILATOR_INSIDE_OUTSIDE_OPTION_KEY]}
        ventilator_ids: set[str] = set()
        for ventilator in self.tables.equipment.ervs.rows:
            if ventilator.id in ventilator_ids:
                raise ValueError(f"Duplicate ventilator id: {ventilator.id}")
            ventilator_ids.add(ventilator.id)
            if ventilator.inside_outside is not None and ventilator.inside_outside not in inside_outside_ids:
                raise ValueError(
                    f"Missing ventilator inside/outside option for ventilator {ventilator.id}: "
                    f"{ventilator.inside_outside}"
                )

        validate_linked_record_field_defs(
            table_label="ventilators",
            table_path=("equipment", "ervs"),
            field_defs_by_key=ventilators_field_defs_by_key,
        )
        validate_rows_custom_values(
            table_label="ventilators",
            row_label="ventilator",
            rows=[(ventilator.id, ventilator.custom_values) for ventilator in self.tables.equipment.ervs.rows],
            field_defs_by_key=ventilators_field_defs_by_key,
            single_select_options=self.single_select_options,
        )
        validate_rows_custom_links(
            table_label="ventilators",
            row_label="ventilator",
            rows=[
                (ventilator.id, ventilator.custom_values, ventilator.custom_links)
                for ventilator in self.tables.equipment.ervs.rows
            ],
            field_defs_by_key=ventilators_field_defs_by_key,
            target_row_ids=target_row_ids,
        )

        aperture_ids: set[str] = set()
        aperture_names: set[str] = set()
        for aperture in self.tables.apertures:
            if aperture.id in aperture_ids:
                raise ValueError(f"Duplicate aperture id: {aperture.id}")
            aperture_ids.add(aperture.id)

            normalized_aperture_name = normalize_display_name(aperture.name)
            if normalized_aperture_name in aperture_names:
                raise ValueError(f"Duplicate aperture name: {aperture.name}")
            aperture_names.add(normalized_aperture_name)

        validate_envelope_references(self.tables.project_materials, self.tables.assemblies)
        self._validate_document_formula_graph()

        return self

    @staticmethod
    def _validate_heat_pump_table_ids_and_tags(
        table_label: str,
        tag_label: str,
        rows: list[tuple[str, str | None]],
    ) -> None:
        ids: set[str] = set()
        tags: set[str] = set()
        for row_id, tag in rows:
            if row_id in ids:
                raise ValueError(f"Duplicate {table_label} id: {row_id}")
            ids.add(row_id)
            if tag is None:
                continue
            normalized_tag = tag.strip().casefold()
            if normalized_tag in tags:
                raise ValueError(f"Duplicate {table_label} {tag_label}: {tag}")
            tags.add(normalized_tag)

    def _validate_rooms_formula_cycles(self, field_defs_by_key: dict[str, TableFieldDef]) -> None:
        _ = field_defs_by_key
        self._validate_document_formula_graph()

    def _validate_document_formula_graph(self) -> None:
        from features.project_document.formula import (
            FormulaCycleError,
            FormulaMissingRefError,
            FormulaTargetFieldNotLinkedError,
            FormulaUnknownTargetTableError,
            validate_document_formula_graph,
        )

        try:
            validate_document_formula_graph(self)
        except FormulaCycleError as exc:
            raise ValueError(f"Formula cycle detected: {' -> '.join(exc.cycle_path)}") from exc
        except FormulaUnknownTargetTableError as exc:
            raise ValueError(f"Formula references unknown target table: {'.'.join(exc.table_path)}") from exc
        except FormulaTargetFieldNotLinkedError as exc:
            field_path = ".".join((*exc.table_path, exc.field_key))
            expected = ".".join(exc.expected_target)
            raise ValueError(f"Formula linked field {field_path} does not link to {expected}") from exc
        except FormulaMissingRefError as exc:
            raise ValueError(f"Formula references unknown linked field: {exc.display_name}") from exc


# Backward-compatibility re-exports. Existing callers import every symbol
# above from ``features.project_document.document``; preserve that surface.
__all__ = [
    "APERTURE_DEFAULT_FRAME_NAME",
    "APERTURE_DEFAULT_GLAZING_NAME",
    "APPLIANCE_ENERGY_STAR_OPTION_KEY",
    "APPLIANCE_OPTION_KEYS",
    "APPLIANCE_TYPE_OPTION_KEY",
    "APPLIANCES_TYPED_COLUMN_FIELD_KEYS",
    "ApertureElement",
    "ApertureElementFrames",
    "ApertureOperation",
    "ApertureOperationDirection",
    "ApertureOperationType",
    "ApertureTypeEntry",
    "ApplianceOptionKey",
    "ApplianceRow",
    "AppliancesTableEnvelope",
    "Assembly",
    "AssemblyLayer",
    "AssemblyOrientation",
    "AssemblySegment",
    "AssemblyType",
    "CATALOG_RECORD_ID_PATTERN",
    "CATALOG_VERSION_ID_PATTERN",
    "CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION",
    "CatalogOrigin",
    "CatalogTableName",
    "ELECTRIC_HEATERS_TYPED_COLUMN_FIELD_KEYS",
    "ElectricHeaterRow",
    "ElectricHeatersTableEnvelope",
    "EmptyEquipmentTables",
    "FAN_OPTION_KEYS",
    "FAN_TYPE_OPTION_KEY",
    "FANS_TYPED_COLUMN_FIELD_KEYS",
    "FanOptionKey",
    "FanRow",
    "FansTableEnvelope",
    "FrameRef",
    "GlazingRef",
    "HOT_WATER_HEATER_OPTION_KEYS",
    "HOT_WATER_HEATER_TYPE_OPTION_KEY",
    "HOT_WATER_HEATERS_TYPED_COLUMN_FIELD_KEYS",
    "HOT_WATER_TANK_OPTION_KEYS",
    "HOT_WATER_TANK_TYPE_OPTION_KEY",
    "HOT_WATER_TANKS_TYPED_COLUMN_FIELD_KEYS",
    "HotWaterHeaterOptionKey",
    "HotWaterHeaterRow",
    "HotWaterHeatersTableEnvelope",
    "HotWaterTankOptionKey",
    "HotWaterTankRow",
    "HotWaterTanksTableEnvelope",
    "ManufacturerFilters",
    "PUMP_DEVICE_TYPE_OPTION_KEY",
    "PUMP_OPTION_KEYS",
    "PUMPS_TYPED_COLUMN_FIELD_KEYS",
    "ProjectDocumentProject",
    "ProjectDocumentTables",
    "ProjectDocumentV1",
    "ProjectMaterial",
    "PumpOptionKey",
    "PumpRow",
    "PumpsTableEnvelope",
    "ROOM_BUILDING_ZONE_OPTION_KEY",
    "ROOM_FLOOR_LEVEL_OPTION_KEY",
    "ROOM_OPTION_KEYS",
    "ROOMS_TYPED_COLUMN_FIELD_KEYS",
    "RoomOptionKey",
    "RoomRow",
    "RoomsTableEnvelope",
    "RowWithCustomFields",
    "SingleSelectOption",
    "SPACE_TYPES_TYPED_COLUMN_FIELD_KEYS",
    "SpaceTypeRow",
    "SpaceTypesTableEnvelope",
    "SpecificationStatus",
    "THERMAL_BRIDGE_OPTION_KEYS",
    "THERMAL_BRIDGE_TYPE_OPTION_KEY",
    "THERMAL_BRIDGES_TYPED_COLUMN_FIELD_KEYS",
    "ThermalBridgeOptionKey",
    "ThermalBridgeRow",
    "ThermalBridgesTableEnvelope",
    "VENTILATOR_INSIDE_OUTSIDE_OPTION_KEY",
    "VENTILATOR_OPTION_KEYS",
    "VENTILATORS_TYPED_COLUMN_FIELD_KEYS",
    "VentilatorOptionKey",
    "VentilatorRow",
    "VentilatorsTableEnvelope",
    "require_catalog_origin_family",
]

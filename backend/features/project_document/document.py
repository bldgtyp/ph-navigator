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

from collections.abc import Sequence
from typing import Any, Literal, cast

from pydantic import BaseModel, ConfigDict, Field, model_validator

from features.heat_pumps.models import (
    HEAT_PUMP_INSTALL_TYPE_OPTION_KEY,
    HEAT_PUMP_MANUFACTURER_OPTION_KEY,
    HEAT_PUMP_MODEL_TYPE_OPTION_KEY,
    HEAT_PUMP_REFRIGERANT_OPTION_KEY,
    HEAT_PUMP_SYSTEM_FAMILY_OPTION_KEY,
    HEAT_PUMP_VISIBLE_OPTION_KEYS,
    HeatPumpIndoorEquipRow,
    HeatPumpIndoorEquipTableEnvelope,
    HeatPumpIndoorUnitRow,
    HeatPumpIndoorUnitsTableEnvelope,
    HeatPumpOutdoorEquipRow,
    HeatPumpOutdoorEquipTableEnvelope,
    HeatPumpOutdoorUnitRow,
    HeatPumpOutdoorUnitsTableEnvelope,
    HeatPumpsTableSlice,
)
from features.project_document._validators import (
    RowWithIdentity,
    collect_target_row_ids,
    validate_envelope_references,
    validate_generic_table,
    validate_table_row_ids,
    validate_typed_option_refs,
)
from features.project_document.custom_fields import TableFieldDef, normalize_display_name
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
HOT_WATER_TANK_INSIDE_OUTSIDE_OPTION_KEY = "hot_water_tanks.inside_outside"
HotWaterTankOptionKey = Literal["hot_water_tanks.type", "hot_water_tanks.inside_outside"]
HOT_WATER_TANK_OPTION_KEYS: tuple[HotWaterTankOptionKey, ...] = (
    HOT_WATER_TANK_TYPE_OPTION_KEY,
    HOT_WATER_TANK_INSIDE_OUTSIDE_OPTION_KEY,
)
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
#
# v8 (record-identity model): the descriptive `name` becomes the pinned
# "Display Name" identifier on every table; `record_id` is demoted to an
# ordinary "Tag" field (still the {Number} — {Name} formula identifier on
# Rooms); Pumps gains an empty `name`. Built-in FieldDef labels are
# persisted per-document, so the bump forces pre-v8 dev docs into
# read-safe mode rather than silently showing stale labels — dev DBs
# reseed from the table-seed constants. No body-transform migration.
#
# v10 (data-table-consolidation Phase 05A): Heat Pumps moves from four
# flat row lists to four `{ field_defs, rows }` leaf envelopes under the
# existing `equipment.heat_pumps` aggregate. Pre-deploy posture: no
# compatibility reader for pre-v10 dev documents.
CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION = 10

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
    {"id", "tank_type", "inside_outside", "url", "notes", "datasheet_asset_ids"}
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

    schema_version: Literal[10] = CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION
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
            HOT_WATER_TANK_INSIDE_OUTSIDE_OPTION_KEY: [],
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
        for key in HEAT_PUMP_VISIBLE_OPTION_KEYS:
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

        # The hidden row.id is the only enforced-unique identity; guarantee
        # it on every generic DataTable in one place (record-identity model).
        validate_table_row_ids(self)

        target_row_ids = collect_target_row_ids(self)

        rooms = self.tables.rooms.rows
        room_ids = {room.id for room in rooms}
        floor_option_ids = {option.id for option in self.single_select_options[ROOM_FLOOR_LEVEL_OPTION_KEY]}
        zone_option_ids = {option.id for option in self.single_select_options[ROOM_BUILDING_ZONE_OPTION_KEY]}
        validate_typed_option_refs(
            rows=[(room.id, room.floor_level) for room in rooms],
            valid_option_ids=floor_option_ids,
            missing_message="Missing floor-level option for room {row_id}: {value}",
        )
        validate_typed_option_refs(
            rows=[(room.id, room.building_zone) for room in rooms],
            valid_option_ids=zone_option_ids,
            missing_message="Missing building-zone option for room {row_id}: {value}",
        )
        validate_generic_table(
            table_label="rooms",
            row_label="room",
            table_path=("rooms",),
            field_defs=self.tables.rooms.field_defs,
            rows=rooms,
            single_select_options=self.single_select_options,
            target_row_ids=target_row_ids,
            validate_defaults=True,
        )

        # Space-Types follows the generic identity model: row.id uniqueness is
        # guaranteed by validate_table_row_ids; the Tag (record_id) and Name
        # are ordinary, non-unique fields. No hard block on duplicate Tags or
        # on a named row without a Tag — duplicates warn via the chip.
        validate_generic_table(
            table_label="space_types",
            row_label="space type",
            table_path=("space_types",),
            field_defs=self.tables.space_types.field_defs,
            rows=self.tables.space_types.rows,
            single_select_options=self.single_select_options,
            target_row_ids=target_row_ids,
            validate_defaults=True,
        )

        pumps = self.tables.equipment.pumps.rows
        pump_device_type_ids = {option.id for option in self.single_select_options[PUMP_DEVICE_TYPE_OPTION_KEY]}
        validate_typed_option_refs(
            rows=[(pump.id, pump.device_type) for pump in pumps],
            valid_option_ids=pump_device_type_ids,
            missing_message="Missing pump device-type option for pump {row_id}: {value}",
        )
        validate_generic_table(
            table_label="pumps",
            row_label="pump",
            table_path=("equipment", "pumps"),
            field_defs=self.tables.equipment.pumps.field_defs,
            rows=pumps,
            single_select_options=self.single_select_options,
            target_row_ids=target_row_ids,
            non_negative_field_keys=frozenset({"volts", "horse_power", "wattage", "flow_gpm", "runtime_khr_yr"}),
        )

        fans = self.tables.equipment.fans.rows
        fan_type_ids = {option.id for option in self.single_select_options[FAN_TYPE_OPTION_KEY]}
        validate_typed_option_refs(
            rows=[(fan.id, fan.fan_type) for fan in fans],
            valid_option_ids=fan_type_ids,
            missing_message="Missing fan type option for fan {row_id}: {value}",
        )
        self._validate_unit_fraction(fans, "power_factor", "fan power_factor must be between 0 and 1: {row_id}")
        validate_generic_table(
            table_label="fans",
            row_label="fan",
            table_path=("equipment", "fans"),
            field_defs=self.tables.equipment.fans.field_defs,
            rows=fans,
            single_select_options=self.single_select_options,
            target_row_ids=target_row_ids,
            non_negative_field_keys=frozenset(
                {"quantity", "annual_runtime_min_yr", "airflow_m3h", "amps", "volts", "watts"}
            ),
        )

        hot_water_heaters = self.tables.equipment.hot_water_heaters.rows
        hot_water_heater_type_ids = {
            option.id for option in self.single_select_options[HOT_WATER_HEATER_TYPE_OPTION_KEY]
        }
        validate_typed_option_refs(
            rows=[(heater.id, heater.heater_type) for heater in hot_water_heaters],
            valid_option_ids=hot_water_heater_type_ids,
            missing_message="Missing hot water heater type option for heater {row_id}: {value}",
        )
        self._validate_unit_fraction(
            hot_water_heaters, "power_factor", "hot water heater power_factor must be between 0 and 1: {row_id}"
        )
        validate_generic_table(
            table_label="hot_water_heaters",
            row_label="hot water heater",
            table_path=("equipment", "hot_water_heaters"),
            field_defs=self.tables.equipment.hot_water_heaters.field_defs,
            rows=hot_water_heaters,
            single_select_options=self.single_select_options,
            target_row_ids=target_row_ids,
            non_negative_field_keys=frozenset({"quantity", "size_l", "amps", "volts", "watts", "uef"}),
        )

        hot_water_tanks = self.tables.equipment.hot_water_tanks.rows
        hot_water_tank_type_ids = {option.id for option in self.single_select_options[HOT_WATER_TANK_TYPE_OPTION_KEY]}
        hot_water_tank_inside_outside_ids = {
            option.id for option in self.single_select_options[HOT_WATER_TANK_INSIDE_OUTSIDE_OPTION_KEY]
        }
        validate_typed_option_refs(
            rows=[(tank.id, tank.tank_type) for tank in hot_water_tanks],
            valid_option_ids=hot_water_tank_type_ids,
            missing_message="Missing hot water tank type option for tank {row_id}: {value}",
        )
        validate_typed_option_refs(
            rows=[(tank.id, tank.inside_outside) for tank in hot_water_tanks],
            valid_option_ids=hot_water_tank_inside_outside_ids,
            missing_message="Missing hot water tank inside/outside option for tank {row_id}: {value}",
        )
        validate_generic_table(
            table_label="hot_water_tanks",
            row_label="hot water tank",
            table_path=("equipment", "hot_water_tanks"),
            field_defs=self.tables.equipment.hot_water_tanks.field_defs,
            rows=hot_water_tanks,
            single_select_options=self.single_select_options,
            target_row_ids=target_row_ids,
            non_negative_field_keys=frozenset({"quantity", "size_l", "heat_loss_rate_w_k"}),
        )

        validate_generic_table(
            table_label="electric_heaters",
            row_label="electric heater",
            table_path=("equipment", "electric_heaters"),
            field_defs=self.tables.equipment.electric_heaters.field_defs,
            rows=self.tables.equipment.electric_heaters.rows,
            single_select_options=self.single_select_options,
            target_row_ids=target_row_ids,
        )

        appliances = self.tables.equipment.appliances.rows
        appliance_type_ids = {option.id for option in self.single_select_options[APPLIANCE_TYPE_OPTION_KEY]}
        appliance_energy_star_ids = {
            option.id for option in self.single_select_options[APPLIANCE_ENERGY_STAR_OPTION_KEY]
        }
        validate_typed_option_refs(
            rows=[(appliance.id, appliance.appliance_type) for appliance in appliances],
            valid_option_ids=appliance_type_ids,
            missing_message="Missing appliance type option for appliance {row_id}: {value}",
        )
        validate_typed_option_refs(
            rows=[(appliance.id, appliance.energy_star) for appliance in appliances],
            valid_option_ids=appliance_energy_star_ids,
            missing_message="Missing appliance EnergyStar option for appliance {row_id}: {value}",
        )
        validate_generic_table(
            table_label="appliances",
            row_label="appliance",
            table_path=("equipment", "appliances"),
            field_defs=self.tables.equipment.appliances.field_defs,
            rows=appliances,
            single_select_options=self.single_select_options,
            target_row_ids=target_row_ids,
            non_negative_field_keys=frozenset({"quantity", "capacity_m3", "cef", "imef", "mef", "annual_energy_kwh"}),
        )

        ventilator_ids = {row.id for row in self.tables.equipment.ervs.rows}
        heat_pumps = self.tables.equipment.heat_pumps
        heat_pump_indoor_equip_ids = {row.id for row in heat_pumps.indoor_equip.rows}
        heat_pump_outdoor_equip_ids = {row.id for row in heat_pumps.outdoor_equip.rows}
        heat_pump_outdoor_unit_ids = {row.id for row in heat_pumps.outdoor_units.rows}
        heat_pump_option_ids_by_key = {
            key: {option.id for option in self.single_select_options[key]} for key in HEAT_PUMP_VISIBLE_OPTION_KEYS
        }
        for row in heat_pumps.outdoor_equip.rows:
            self._validate_heat_pump_option(
                heat_pump_option_ids_by_key, HEAT_PUMP_MANUFACTURER_OPTION_KEY, row.manufacturer, row.id
            )
            self._validate_heat_pump_option(
                heat_pump_option_ids_by_key, HEAT_PUMP_SYSTEM_FAMILY_OPTION_KEY, row.system_family, row.id
            )
            self._validate_heat_pump_option(
                heat_pump_option_ids_by_key, HEAT_PUMP_REFRIGERANT_OPTION_KEY, row.refrigerant, row.id
            )
            if row.paired_indoor_equip_id is not None and row.paired_indoor_equip_id not in heat_pump_indoor_equip_ids:
                raise ValueError(
                    f"Missing heat-pump indoor equip for outdoor equip {row.id}: {row.paired_indoor_equip_id}"
                )
        for row in heat_pumps.indoor_equip.rows:
            self._validate_heat_pump_option(
                heat_pump_option_ids_by_key, HEAT_PUMP_MANUFACTURER_OPTION_KEY, row.manufacturer, row.id
            )
            self._validate_heat_pump_option(
                heat_pump_option_ids_by_key, HEAT_PUMP_MODEL_TYPE_OPTION_KEY, row.model_type, row.id
            )
            self._validate_heat_pump_option(
                heat_pump_option_ids_by_key, HEAT_PUMP_INSTALL_TYPE_OPTION_KEY, row.install_type, row.id
            )
        for row in heat_pumps.outdoor_units.rows:
            if row.outdoor_equip_id not in heat_pump_outdoor_equip_ids:
                raise ValueError(f"Missing heat-pump outdoor equip for outdoor unit {row.id}: {row.outdoor_equip_id}")
        for row in heat_pumps.indoor_units.rows:
            if row.indoor_equip_id not in heat_pump_indoor_equip_ids:
                raise ValueError(f"Missing heat-pump indoor equip for indoor unit {row.id}: {row.indoor_equip_id}")
            if row.outdoor_unit_id is not None and row.outdoor_unit_id not in heat_pump_outdoor_unit_ids:
                raise ValueError(f"Missing heat-pump outdoor unit for indoor unit {row.id}: {row.outdoor_unit_id}")
            if row.linked_erv_unit_id is not None and row.linked_erv_unit_id not in ventilator_ids:
                raise ValueError(f"Missing linked ERV for heat-pump indoor unit {row.id}: {row.linked_erv_unit_id}")
            missing_room_ids = [room_id for room_id in row.served_room_ids if room_id not in room_ids]
            if missing_room_ids:
                raise ValueError(f"Missing served room for heat-pump indoor unit {row.id}: {missing_room_ids[0]}")

        from features.project_document.tables.contracts import read_table_envelope
        from features.project_document.tables.heat_pumps import HEAT_PUMP_LEAF_VALIDATION_SPECS

        for spec in HEAT_PUMP_LEAF_VALIDATION_SPECS:
            envelope = cast(Any, read_table_envelope(self, spec.contract.table_path))
            validate_generic_table(
                table_label=spec.table_label,
                row_label=spec.row_label,
                table_path=spec.contract.table_path,
                field_defs=envelope.field_defs,
                rows=envelope.rows,
                single_select_options=self.single_select_options,
                target_row_ids=target_row_ids,
            )

        thermal_bridges = self.tables.thermal_bridges.rows
        thermal_bridge_type_ids = {option.id for option in self.single_select_options[THERMAL_BRIDGE_TYPE_OPTION_KEY]}
        validate_typed_option_refs(
            rows=[(thermal_bridge.id, thermal_bridge.thermal_bridge_type) for thermal_bridge in thermal_bridges],
            valid_option_ids=thermal_bridge_type_ids,
            missing_message="Missing thermal bridge type option for thermal bridge {row_id}: {value}",
        )
        self._validate_min_zero(
            thermal_bridges, "psi_value_w_mk", "Thermal bridge psi_value_w_mk must be zero or greater: {row_id}"
        )
        self._validate_unit_fraction(
            thermal_bridges, "frsi_value", "Thermal bridge frsi_value must be between 0 and 1: {row_id}"
        )
        validate_generic_table(
            table_label="thermal_bridges",
            row_label="thermal bridge",
            table_path=("thermal_bridges",),
            field_defs=self.tables.thermal_bridges.field_defs,
            rows=thermal_bridges,
            single_select_options=self.single_select_options,
            target_row_ids=target_row_ids,
        )

        ventilators = self.tables.equipment.ervs.rows
        inside_outside_ids = {option.id for option in self.single_select_options[VENTILATOR_INSIDE_OUTSIDE_OPTION_KEY]}
        validate_typed_option_refs(
            rows=[(ventilator.id, ventilator.inside_outside) for ventilator in ventilators],
            valid_option_ids=inside_outside_ids,
            missing_message="Missing ventilator inside/outside option for ventilator {row_id}: {value}",
        )
        validate_generic_table(
            table_label="ventilators",
            row_label="ventilator",
            table_path=("equipment", "ervs"),
            field_defs=self.tables.equipment.ervs.field_defs,
            rows=ventilators,
            single_select_options=self.single_select_options,
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

    def _validate_heat_pump_option(
        self,
        option_ids_by_key: dict[str, set[str]],
        option_key: str,
        option_id: str | None,
        row_id: str,
    ) -> None:
        if option_id is None:
            return
        if option_id not in option_ids_by_key[option_key]:
            raise ValueError(f"Missing heat-pump option {option_key} for row {row_id}: {option_id}")

    @staticmethod
    def _validate_min_zero(rows: Sequence[RowWithIdentity], field_key: str, message: str) -> None:
        """Reject a numeric ``custom_values`` field that is below zero.
        ``message`` is a ``str.format`` template with a ``{row_id}`` placeholder."""
        for row in rows:
            value = row.custom_values.get(field_key)
            if isinstance(value, (int, float)) and value < 0:
                raise ValueError(message.format(row_id=row.id))

    @staticmethod
    def _validate_unit_fraction(rows: Sequence[RowWithIdentity], field_key: str, message: str) -> None:
        """Reject a numeric ``custom_values`` field that falls outside ``0..1``.
        ``message`` is a ``str.format`` template with a ``{row_id}`` placeholder."""
        for row in rows:
            value = row.custom_values.get(field_key)
            if isinstance(value, (int, float)) and not 0 <= value <= 1:
                raise ValueError(message.format(row_id=row.id))

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
    "HOT_WATER_TANK_INSIDE_OUTSIDE_OPTION_KEY",
    "HOT_WATER_TANK_TYPE_OPTION_KEY",
    "HOT_WATER_TANKS_TYPED_COLUMN_FIELD_KEYS",
    "HotWaterHeaterOptionKey",
    "HotWaterHeaterRow",
    "HotWaterHeatersTableEnvelope",
    "HotWaterTankOptionKey",
    "HotWaterTankRow",
    "HotWaterTanksTableEnvelope",
    "ManufacturerFilters",
    "HeatPumpIndoorEquipRow",
    "HeatPumpIndoorEquipTableEnvelope",
    "HeatPumpIndoorUnitRow",
    "HeatPumpIndoorUnitsTableEnvelope",
    "HeatPumpOutdoorEquipRow",
    "HeatPumpOutdoorEquipTableEnvelope",
    "HeatPumpOutdoorUnitRow",
    "HeatPumpOutdoorUnitsTableEnvelope",
    "HeatPumpsTableSlice",
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

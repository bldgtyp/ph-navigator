"""Canonical ProjectDocumentV1 schema and table row contracts.

Schema version is a clean pre-deploy v1 baseline with no read-time migration
reader. Current shape includes Space-Types, record identity, heat-pump table
envelopes, datasheet fields, and flat aperture glazing/frame FK tables.

Layout: this module now hosts the cross-table ProjectDocumentV1 model
plus the option-key constants and typed-column-key sets used by every
table feature. Row + envelope models live in ``rows.py``; envelope
(assemblies + apertures + materials) models live in ``envelope_models.py``;
low-level invariant helpers live in ``_validators.py`` and cross-table
validation lives in ``document_validation.py``. Every symbol previously importable from
``project_document.document`` is re-exported below so existing callers
keep working.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from features.heat_pumps.models import (
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
from features.project_document.envelope_models import (
    APERTURE_DEFAULT_FRAME_ID,
    APERTURE_DEFAULT_FRAME_NAME,
    APERTURE_DEFAULT_GLAZING_ID,
    APERTURE_DEFAULT_GLAZING_NAME,
    CATALOG_RECORD_ID_PATTERN,
    CATALOG_VERSION_ID_PATTERN,
    SPECIFICATION_STATUSES,
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
    EvidenceStatus,
    FrameRef,
    GlazingRef,
    ProjectFrame,
    ProjectGlazing,
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
# Built-in `status` option keys. The string literals must equal
# `status_option_key(<table_label>)` from `tables._status_field`. They are
# hardcoded here (rather than imported) because `_status_field` imports
# `SingleSelectOption` from this module — importing back would form a cycle.
PUMP_DEVICE_TYPE_OPTION_KEY = "pumps.device_type"
PUMP_INSIDE_OUTSIDE_OPTION_KEY = "pumps.inside_outside"
PUMP_STATUS_OPTION_KEY = "pumps.status"
PumpOptionKey = Literal["pumps.device_type", "pumps.inside_outside", "pumps.status"]
PUMP_OPTION_KEYS: tuple[PumpOptionKey, ...] = (
    PUMP_DEVICE_TYPE_OPTION_KEY,
    PUMP_INSIDE_OUTSIDE_OPTION_KEY,
    PUMP_STATUS_OPTION_KEY,
)
VENTILATOR_INSIDE_OUTSIDE_OPTION_KEY = "ventilators.inside_outside"
VENTILATOR_FROST_PROTECTION_OPTION_KEY = "ventilators.frost_protection"
VENTILATOR_STATUS_OPTION_KEY = "ventilators.status"
VentilatorOptionKey = Literal["ventilators.inside_outside", "ventilators.frost_protection", "ventilators.status"]
VENTILATOR_OPTION_KEYS: tuple[VentilatorOptionKey, ...] = (
    VENTILATOR_INSIDE_OUTSIDE_OPTION_KEY,
    VENTILATOR_FROST_PROTECTION_OPTION_KEY,
    VENTILATOR_STATUS_OPTION_KEY,
)
FAN_TYPE_OPTION_KEY = "fans.type"
FAN_STATUS_OPTION_KEY = "fans.status"
FanOptionKey = Literal["fans.type", "fans.status"]
FAN_OPTION_KEYS: tuple[FanOptionKey, ...] = (FAN_TYPE_OPTION_KEY, FAN_STATUS_OPTION_KEY)
HOT_WATER_HEATER_TYPE_OPTION_KEY = "hot_water_heaters.type"
HOT_WATER_HEATER_STATUS_OPTION_KEY = "hot_water_heaters.status"
HotWaterHeaterOptionKey = Literal["hot_water_heaters.type", "hot_water_heaters.status"]
HOT_WATER_HEATER_OPTION_KEYS: tuple[HotWaterHeaterOptionKey, ...] = (
    HOT_WATER_HEATER_TYPE_OPTION_KEY,
    HOT_WATER_HEATER_STATUS_OPTION_KEY,
)
HOT_WATER_TANK_TYPE_OPTION_KEY = "hot_water_tanks.type"
HOT_WATER_TANK_INSIDE_OUTSIDE_OPTION_KEY = "hot_water_tanks.inside_outside"
HOT_WATER_TANK_STATUS_OPTION_KEY = "hot_water_tanks.status"
HotWaterTankOptionKey = Literal["hot_water_tanks.type", "hot_water_tanks.inside_outside", "hot_water_tanks.status"]
HOT_WATER_TANK_OPTION_KEYS: tuple[HotWaterTankOptionKey, ...] = (
    HOT_WATER_TANK_TYPE_OPTION_KEY,
    HOT_WATER_TANK_INSIDE_OUTSIDE_OPTION_KEY,
    HOT_WATER_TANK_STATUS_OPTION_KEY,
)
APPLIANCE_TYPE_OPTION_KEY = "appliances.type"
APPLIANCE_ENERGY_STAR_OPTION_KEY = "appliances.energy_star"
APPLIANCE_STATUS_OPTION_KEY = "appliances.status"
ApplianceOptionKey = Literal["appliances.type", "appliances.energy_star", "appliances.status"]
APPLIANCE_OPTION_KEYS: tuple[ApplianceOptionKey, ...] = (
    APPLIANCE_TYPE_OPTION_KEY,
    APPLIANCE_ENERGY_STAR_OPTION_KEY,
    APPLIANCE_STATUS_OPTION_KEY,
)
THERMAL_BRIDGE_TYPE_OPTION_KEY = "thermal_bridges.type"
THERMAL_BRIDGE_STATUS_OPTION_KEY = "thermal_bridges.status"
ThermalBridgeOptionKey = Literal["thermal_bridges.type", "thermal_bridges.status"]
THERMAL_BRIDGE_OPTION_KEYS: tuple[ThermalBridgeOptionKey, ...] = (
    THERMAL_BRIDGE_TYPE_OPTION_KEY,
    THERMAL_BRIDGE_STATUS_OPTION_KEY,
)
ROOM_SPACE_TYPE_FIELD_KEY = "space_type_id"
ROOM_VENTILATOR_FIELD_KEY = "ventilator_id"

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
#
# v11: Electric Heaters and Ventilators gain the shared Datasheet
# attachment field (`datasheet_asset_ids`) to match the other Equipment
# tables.
#
# v4: Rooms adds the built-in `ventilator_id` linked-record FieldDef. This
# explicitly upgrades existing v3 documents; new template documents already
# receive the current Rooms built-in field seed.
#
# v12: aperture glazings/frames move from inline element snapshots to flat,
# documented project tables (`project_glazings` / `project_frames`) referenced
# by FK ids from each aperture element.
#
# v3: rooms, thermal bridges, ventilators, pumps, and hot-water tanks gain
# downstream-consumer built-ins (ceiling height, quantities, frost protection,
# annual energy, heat-gain utilization, and tank temperature/location fields).
#
# v7: Documentation-page redesign Phase 01 adds persisted Datasheet/Photo
# evidence status columns (`needed`, `complete`, `na`) so those axes can be
# manually marked Needed even when attachments remain present.
#
# v6: Documentation-tab Phase 01 adds per-record site-photo attachment arrays
# plus derived-axis waiver flags to equipment, heat-pump leaves, aperture
# product tables, thermal bridges, project materials, and assembly segments.
# Equipment/TB/HP FieldDef seeds gain `photo_asset_ids`, Thermal Bridges gains
# the missing `datasheet_asset_ids`, and the shared `status` display label
# becomes "Specification Status" while keeping field_key="status".
#
# v5: the four Heat Pump leaves gain the built-in `name` ("Display Name")
# FieldDef like every other equipment table; the upgrade backfills
# `custom_values["name"]` from the typed `tag` so no row renders a blank
# identity.
#
# v8: the built-in specification status of project materials, glazings, and
# frames renames its "missing" member to "needed" so those typed literals match
# the Equipment/Thermal-Bridges `opt_status_needed` option and the Needed label
# the UI has always shown. Value replacement only — no row is added, dropped, or
# re-derived. External Honeybee `MISSING` stays `MISSING` behind named adapters.
CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION = 8

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
    {
        "id",
        "device_type",
        "phase",
        "link",
        "notes",
        "datasheet_asset_ids",
        "photo_asset_ids",
        "datasheet_status",
        "photo_status",
    }
)
VENTILATORS_TYPED_COLUMN_FIELD_KEYS: frozenset[str] = frozenset(
    {
        "id",
        "inside_outside",
        "url",
        "notes",
        "datasheet_asset_ids",
        "photo_asset_ids",
        "datasheet_status",
        "photo_status",
    }
)
FANS_TYPED_COLUMN_FIELD_KEYS: frozenset[str] = frozenset(
    {
        "id",
        "fan_type",
        "phase",
        "url",
        "notes",
        "datasheet_asset_ids",
        "photo_asset_ids",
        "datasheet_status",
        "photo_status",
    }
)
HOT_WATER_HEATERS_TYPED_COLUMN_FIELD_KEYS: frozenset[str] = frozenset(
    {
        "id",
        "heater_type",
        "phase",
        "url",
        "notes",
        "datasheet_asset_ids",
        "photo_asset_ids",
        "datasheet_status",
        "photo_status",
    }
)
HOT_WATER_TANKS_TYPED_COLUMN_FIELD_KEYS: frozenset[str] = frozenset(
    {
        "id",
        "tank_type",
        "inside_outside",
        "url",
        "notes",
        "datasheet_asset_ids",
        "photo_asset_ids",
        "datasheet_status",
        "photo_status",
    }
)
ELECTRIC_HEATERS_TYPED_COLUMN_FIELD_KEYS: frozenset[str] = frozenset(
    {"id", "url", "notes", "datasheet_asset_ids", "photo_asset_ids", "datasheet_status", "photo_status"}
)
APPLIANCES_TYPED_COLUMN_FIELD_KEYS: frozenset[str] = frozenset(
    {
        "id",
        "appliance_type",
        "energy_star",
        "url",
        "notes",
        "datasheet_asset_ids",
        "photo_asset_ids",
        "datasheet_status",
        "photo_status",
    }
)
THERMAL_BRIDGES_TYPED_COLUMN_FIELD_KEYS: frozenset[str] = frozenset(
    {
        "id",
        "thermal_bridge_type",
        "pdf_report_asset_ids",
        "datasheet_asset_ids",
        "photo_asset_ids",
        "datasheet_status",
        "photo_status",
        "notes",
    }
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
    project_glazings: list[ProjectGlazing] = Field(default_factory=list)
    project_frames: list[ProjectFrame] = Field(default_factory=list)
    apertures: list[ApertureTypeEntry] = Field(default_factory=list)
    rooms: RoomsTableEnvelope = Field(default_factory=RoomsTableEnvelope)
    space_types: SpaceTypesTableEnvelope = Field(default_factory=SpaceTypesTableEnvelope)
    thermal_bridges: ThermalBridgesTableEnvelope = Field(default_factory=ThermalBridgesTableEnvelope)
    equipment: EmptyEquipmentTables = Field(default_factory=EmptyEquipmentTables)
    manufacturer_filters: ManufacturerFilters | None = None


class ProjectDocumentV1(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schema_version: Literal[8] = CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION
    project: ProjectDocumentProject
    tables: ProjectDocumentTables = Field(default_factory=ProjectDocumentTables)
    single_select_options: dict[str, list[SingleSelectOption]] = Field(
        default_factory=lambda: {
            ROOM_FLOOR_LEVEL_OPTION_KEY: [],
            ROOM_BUILDING_ZONE_OPTION_KEY: [],
            PUMP_DEVICE_TYPE_OPTION_KEY: [],
            PUMP_INSIDE_OUTSIDE_OPTION_KEY: [],
            VENTILATOR_INSIDE_OUTSIDE_OPTION_KEY: [],
            VENTILATOR_FROST_PROTECTION_OPTION_KEY: [],
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
        from features.project_document.document_validation import validate_document_references

        return validate_document_references(self)


# Backward-compatibility re-exports. Existing callers import every symbol
# above from ``features.project_document.document``; preserve that surface.
__all__ = [
    "APERTURE_DEFAULT_FRAME_ID",
    "APERTURE_DEFAULT_FRAME_NAME",
    "APERTURE_DEFAULT_GLAZING_ID",
    "APERTURE_DEFAULT_GLAZING_NAME",
    "APPLIANCE_ENERGY_STAR_OPTION_KEY",
    "APPLIANCE_OPTION_KEYS",
    "APPLIANCE_STATUS_OPTION_KEY",
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
    "EvidenceStatus",
    "ElectricHeaterRow",
    "ElectricHeatersTableEnvelope",
    "EmptyEquipmentTables",
    "FAN_OPTION_KEYS",
    "FAN_STATUS_OPTION_KEY",
    "FAN_TYPE_OPTION_KEY",
    "FANS_TYPED_COLUMN_FIELD_KEYS",
    "FanOptionKey",
    "FanRow",
    "FansTableEnvelope",
    "FrameRef",
    "GlazingRef",
    "HOT_WATER_HEATER_OPTION_KEYS",
    "HOT_WATER_HEATER_STATUS_OPTION_KEY",
    "HOT_WATER_HEATER_TYPE_OPTION_KEY",
    "HOT_WATER_HEATERS_TYPED_COLUMN_FIELD_KEYS",
    "HOT_WATER_TANK_OPTION_KEYS",
    "HOT_WATER_TANK_INSIDE_OUTSIDE_OPTION_KEY",
    "HOT_WATER_TANK_STATUS_OPTION_KEY",
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
    "PUMP_INSIDE_OUTSIDE_OPTION_KEY",
    "PUMP_OPTION_KEYS",
    "PUMP_STATUS_OPTION_KEY",
    "PUMPS_TYPED_COLUMN_FIELD_KEYS",
    "ProjectDocumentProject",
    "ProjectDocumentTables",
    "ProjectDocumentV1",
    "ProjectFrame",
    "ProjectGlazing",
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
    "SPECIFICATION_STATUSES",
    "SpecificationStatus",
    "THERMAL_BRIDGE_OPTION_KEYS",
    "THERMAL_BRIDGE_STATUS_OPTION_KEY",
    "THERMAL_BRIDGE_TYPE_OPTION_KEY",
    "THERMAL_BRIDGES_TYPED_COLUMN_FIELD_KEYS",
    "ThermalBridgeOptionKey",
    "ThermalBridgeRow",
    "ThermalBridgesTableEnvelope",
    "VENTILATOR_INSIDE_OUTSIDE_OPTION_KEY",
    "VENTILATOR_FROST_PROTECTION_OPTION_KEY",
    "VENTILATOR_STATUS_OPTION_KEY",
    "VENTILATOR_OPTION_KEYS",
    "VENTILATORS_TYPED_COLUMN_FIELD_KEYS",
    "VentilatorOptionKey",
    "VentilatorRow",
    "VentilatorsTableEnvelope",
    "require_catalog_origin_family",
]

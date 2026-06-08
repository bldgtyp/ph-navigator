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
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, cast

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from features.project_document.custom_fields import (
    RESERVED_FIELD_KEY_RECORD_ID,
    CustomFieldType,
    CustomValue,
    TableFieldDef,
    coerce_custom_value,
    normalize_display_name,
)
from features.projects.models import CertificationProgram
from features.shared.colors import normalize_optional_hex_color

CatalogTableName = Literal["materials", "frame_types", "glazing_types"]
CATALOG_RECORD_ID_PATTERN = r"^rec[A-Za-z0-9]{14}$"
CATALOG_VERSION_ID_PATTERN = r"^(matv|framev|glazingv)_[A-Za-z0-9_-]+$"
AssemblyType = Literal["wall", "floor", "roof", "other"]
AssemblyOrientation = Literal["first_layer_outside", "last_layer_outside"]
SpecificationStatus = Literal["complete", "missing", "question", "na"]

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

# v4 wire shape: Phase 2 promotes the pinned identifier to a real
# `record_id` FieldDef on every FieldDef-capable table; Pumps' `tag`
# entry is renamed to `record_id` (display label stays "Tag"). Pre-
# deploy posture (PRD §P3.6) — no v2/v3 reader is provided; dev DBs
# rebuild on the phase boundary.
CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION = 4

# Field keys that have a typed Pydantic column on the row model. Used
# to split read/write paths between typed columns and the
# `custom_values` bag. Every field on the table NOT in this set lives
# in `custom_values` — that includes all custom fields and any
# mutable-type built-in (Rooms: number/name/num_people/num_bedrooms;
# Pumps: tag/use/manufacturer/etc.).
#
# Source of truth is each row model's declared attribute set below;
# these tuples enumerate the subset that the validator / formula
# accessors / catalog-refresh path needs to branch on.
ROOMS_TYPED_COLUMN_FIELD_KEYS: frozenset[str] = frozenset(
    {"id", "floor_level", "building_zone", "icfa_factor", "erv_unit_ids", "catalog_origin", "notes"}
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
ELECTRIC_HEATERS_TYPED_COLUMN_FIELD_KEYS: frozenset[str] = frozenset({"id", "url", "notes"})
APPLIANCES_TYPED_COLUMN_FIELD_KEYS: frozenset[str] = frozenset(
    {"id", "appliance_type", "energy_star", "url", "notes", "datasheet_asset_ids"}
)
THERMAL_BRIDGES_TYPED_COLUMN_FIELD_KEYS: frozenset[str] = frozenset(
    {"id", "thermal_bridge_type", "pdf_report_asset_ids", "notes"}
)


class SingleSelectOption(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(pattern=r"^opt_[A-Za-z0-9_-]+$", max_length=80)
    label: str = Field(min_length=1, max_length=120)
    color: str = Field(pattern=r"^#[0-9A-Fa-f]{6}$")
    order: float

    @field_validator("label", mode="before")
    @classmethod
    def strip_label(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip()
        return value


class RoomRow(BaseModel):
    """A row in the Rooms table (v3 mixed-storage).

    Only locked-type built-ins keep typed columns. Mutable-type built-ins
    (`number`, `name`, `num_people`, `num_bedrooms`) and all custom
    fields live in `custom_values`, keyed by `field_key`.
    """

    model_config = ConfigDict(extra="forbid")

    id: str = Field(pattern=r"^rm_[A-Za-z0-9_-]+$", max_length=80)
    floor_level: str | None = Field(default=None, pattern=r"^opt_[A-Za-z0-9_-]+$", max_length=80)
    building_zone: str | None = Field(default=None, pattern=r"^opt_[A-Za-z0-9_-]+$", max_length=80)
    icfa_factor: float = Field(default=1.0, ge=0.0, le=1.0)
    erv_unit_ids: list[str] = Field(default_factory=list)
    catalog_origin: dict[str, object] | None = None
    notes: str | None = Field(default=None, max_length=4000)
    # Mutable-type built-in + custom field values, keyed by `field_key`.
    custom_values: dict[str, CustomValue] = Field(default_factory=dict)

    @field_validator("notes", mode="before")
    @classmethod
    def strip_optional_notes(cls, value: object) -> object:
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value


class PumpRow(BaseModel):
    """A row in the Pumps table (v3 mixed-storage).

    Locked-type built-ins keep typed columns: `device_type`, `phase`,
    `link`, `notes`, `datasheet_asset_ids`. Mutable-type built-ins
    (`tag`, `use`, `manufacturer`, `model`, `volts`, `horse_power`,
    `wattage`, `flow_gpm`, `runtime_khr_yr`) live in `custom_values`.
    """

    model_config = ConfigDict(extra="forbid")

    id: str = Field(pattern=r"^pmp_[A-Za-z0-9_-]+$", max_length=80)
    device_type: str | None = Field(default=None, pattern=r"^opt_[A-Za-z0-9_-]+$", max_length=80)
    phase: int | None = None
    link: str | None = Field(default=None, max_length=2000)
    notes: str | None = Field(default=None, max_length=4000)
    datasheet_asset_ids: list[str] = Field(default_factory=list)
    custom_values: dict[str, CustomValue] = Field(default_factory=dict)

    @field_validator("notes", "link", mode="before")
    @classmethod
    def strip_optional_strings(cls, value: object) -> object:
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value

    @field_validator("phase")
    @classmethod
    def validate_phase(cls, value: int | None) -> int | None:
        if value is not None and value not in {1, 3}:
            raise ValueError("phase must be 1 or 3")
        return value

    @field_validator("link")
    @classmethod
    def validate_link(cls, value: str | None) -> str | None:
        if value is not None and not (value.startswith("http://") or value.startswith("https://")):
            raise ValueError("link must start with http:// or https://")
        return value


class PumpsTableEnvelope(BaseModel):
    """`{ field_defs, rows }` envelope around the Pumps table.

    Phase 1b adds the persisted FieldDef registry on Pumps. Phase 1b is
    storage-only for Pumps — schema-mutation capability is wired in a
    follow-up phase when Pumps gets `record_id`.
    """

    model_config = ConfigDict(extra="forbid")

    field_defs: list[TableFieldDef] = Field(default_factory=list)
    rows: list[PumpRow] = Field(default_factory=list)


class VentilatorRow(BaseModel):
    """A row in the Ventilators / ERVs equipment table."""

    model_config = ConfigDict(extra="forbid")

    id: str = Field(pattern=r"^vent_[A-Za-z0-9_-]+$", max_length=80)
    inside_outside: str | None = Field(default=None, pattern=r"^opt_[A-Za-z0-9_-]+$", max_length=80)
    url: str | None = Field(default=None, max_length=2000)
    notes: str | None = Field(default=None, max_length=4000)
    custom_values: dict[str, CustomValue] = Field(default_factory=dict)

    @field_validator("url", "notes", mode="before")
    @classmethod
    def strip_optional_strings(cls, value: object) -> object:
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value

    @field_validator("url")
    @classmethod
    def validate_url(cls, value: str | None) -> str | None:
        if value is not None and not (value.startswith("http://") or value.startswith("https://")):
            raise ValueError("url must start with http:// or https://")
        return value


class VentilatorsTableEnvelope(BaseModel):
    model_config = ConfigDict(extra="forbid")

    field_defs: list[TableFieldDef] = Field(default_factory=list)
    rows: list[VentilatorRow] = Field(default_factory=list)


class FanRow(BaseModel):
    """A row in the Fans equipment table."""

    model_config = ConfigDict(extra="forbid")

    id: str = Field(pattern=r"^fan_[A-Za-z0-9_-]+$", max_length=80)
    fan_type: str | None = Field(default=None, pattern=r"^opt_[A-Za-z0-9_-]+$", max_length=80)
    phase: int | None = None
    url: str | None = Field(default=None, max_length=2000)
    notes: str | None = Field(default=None, max_length=4000)
    datasheet_asset_ids: list[str] = Field(default_factory=list)
    custom_values: dict[str, CustomValue] = Field(default_factory=dict)

    @field_validator("url", "notes", mode="before")
    @classmethod
    def strip_optional_strings(cls, value: object) -> object:
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value

    @field_validator("phase")
    @classmethod
    def validate_phase(cls, value: int | None) -> int | None:
        if value is not None and value not in {1, 3}:
            raise ValueError("phase must be 1 or 3")
        return value

    @field_validator("url")
    @classmethod
    def validate_url(cls, value: str | None) -> str | None:
        if value is not None and not (value.startswith("http://") or value.startswith("https://")):
            raise ValueError("url must start with http:// or https://")
        return value


class FansTableEnvelope(BaseModel):
    model_config = ConfigDict(extra="forbid")

    field_defs: list[TableFieldDef] = Field(default_factory=list)
    rows: list[FanRow] = Field(default_factory=list)


class HotWaterHeaterRow(BaseModel):
    """A row in the Hot Water Heaters equipment table."""

    model_config = ConfigDict(extra="forbid")

    id: str = Field(pattern=r"^(hwh|hwt)_[A-Za-z0-9_-]+$", max_length=80)
    heater_type: str | None = Field(default=None, pattern=r"^opt_[A-Za-z0-9_-]+$", max_length=80)
    phase: int | None = None
    url: str | None = Field(default=None, max_length=2000)
    notes: str | None = Field(default=None, max_length=4000)
    datasheet_asset_ids: list[str] = Field(default_factory=list)
    custom_values: dict[str, CustomValue] = Field(default_factory=dict)

    @field_validator("url", "notes", mode="before")
    @classmethod
    def strip_optional_strings(cls, value: object) -> object:
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value

    @field_validator("phase")
    @classmethod
    def validate_phase(cls, value: int | None) -> int | None:
        if value is not None and value not in {1, 3}:
            raise ValueError("phase must be 1 or 3")
        return value

    @field_validator("url")
    @classmethod
    def validate_url(cls, value: str | None) -> str | None:
        if value is not None and not (value.startswith("http://") or value.startswith("https://")):
            raise ValueError("url must start with http:// or https://")
        return value


class HotWaterHeatersTableEnvelope(BaseModel):
    model_config = ConfigDict(extra="forbid")

    field_defs: list[TableFieldDef] = Field(default_factory=list)
    rows: list[HotWaterHeaterRow] = Field(default_factory=list)


class ElectricHeaterRow(BaseModel):
    """A row in the Electric Heaters equipment table."""

    model_config = ConfigDict(extra="forbid")

    id: str = Field(pattern=r"^heatr_[A-Za-z0-9_-]+$", max_length=80)
    url: str | None = Field(default=None, max_length=2000)
    notes: str | None = Field(default=None, max_length=4000)
    custom_values: dict[str, CustomValue] = Field(default_factory=dict)

    @field_validator("url", "notes", mode="before")
    @classmethod
    def strip_optional_strings(cls, value: object) -> object:
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value

    @field_validator("url")
    @classmethod
    def validate_url(cls, value: str | None) -> str | None:
        if value is not None and not (value.startswith("http://") or value.startswith("https://")):
            raise ValueError("url must start with http:// or https://")
        return value


class ElectricHeatersTableEnvelope(BaseModel):
    model_config = ConfigDict(extra="forbid")

    field_defs: list[TableFieldDef] = Field(default_factory=list)
    rows: list[ElectricHeaterRow] = Field(default_factory=list)


class ApplianceRow(BaseModel):
    """A row in the Appliances equipment table."""

    model_config = ConfigDict(extra="forbid")

    id: str = Field(pattern=r"^appl_[A-Za-z0-9_-]+$", max_length=80)
    appliance_type: str | None = Field(default=None, pattern=r"^opt_[A-Za-z0-9_-]+$", max_length=80)
    energy_star: str | None = Field(default=None, pattern=r"^opt_[A-Za-z0-9_-]+$", max_length=80)
    url: str | None = Field(default=None, max_length=2000)
    notes: str | None = Field(default=None, max_length=4000)
    datasheet_asset_ids: list[str] = Field(default_factory=list)
    custom_values: dict[str, CustomValue] = Field(default_factory=dict)

    @field_validator("url", "notes", mode="before")
    @classmethod
    def strip_optional_strings(cls, value: object) -> object:
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value

    @field_validator("url")
    @classmethod
    def validate_url(cls, value: str | None) -> str | None:
        if value is not None and not (value.startswith("http://") or value.startswith("https://")):
            raise ValueError("url must start with http:// or https://")
        return value


class AppliancesTableEnvelope(BaseModel):
    model_config = ConfigDict(extra="forbid")

    field_defs: list[TableFieldDef] = Field(default_factory=list)
    rows: list[ApplianceRow] = Field(default_factory=list)


class ThermalBridgeRow(BaseModel):
    """A linear thermal-bridge record for the project document."""

    model_config = ConfigDict(extra="forbid")

    id: str = Field(pattern=r"^tb_[A-Za-z0-9_-]+$", max_length=80)
    thermal_bridge_type: str | None = Field(default=None, pattern=r"^opt_[A-Za-z0-9_-]+$", max_length=80)
    pdf_report_asset_ids: list[str] = Field(default_factory=list)
    notes: str | None = Field(default=None, max_length=4000)
    custom_values: dict[str, CustomValue] = Field(default_factory=dict)

    @field_validator("notes", mode="before")
    @classmethod
    def strip_optional_strings(cls, value: object) -> object:
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value


class ThermalBridgesTableEnvelope(BaseModel):
    model_config = ConfigDict(extra="forbid")

    field_defs: list[TableFieldDef] = Field(default_factory=list)
    rows: list[ThermalBridgeRow] = Field(default_factory=list)


class EmptyEquipmentTables(BaseModel):
    model_config = ConfigDict(extra="forbid")

    appliances: AppliancesTableEnvelope = Field(default_factory=AppliancesTableEnvelope)
    electric_heaters: ElectricHeatersTableEnvelope = Field(default_factory=ElectricHeatersTableEnvelope)
    fans: FansTableEnvelope = Field(default_factory=FansTableEnvelope)
    hot_water_heaters: HotWaterHeatersTableEnvelope = Field(default_factory=HotWaterHeatersTableEnvelope)
    pumps: PumpsTableEnvelope = Field(default_factory=PumpsTableEnvelope)
    ervs: VentilatorsTableEnvelope = Field(default_factory=VentilatorsTableEnvelope)


class CatalogOrigin(BaseModel):
    """Bookshelf-copy provenance stamped at pick time."""

    model_config = ConfigDict(extra="forbid")

    catalog_table: CatalogTableName
    catalog_record_id: str = Field(pattern=CATALOG_RECORD_ID_PATTERN)
    # ``catalog_version_id`` / ``catalog_schema_version`` are legacy fields
    # from the per-version row layer. All v1 catalogs (materials, glazing,
    # frames) are now flat; new origins always leave both null. The fields
    # stay nullable on the model so older documents that still carry a
    # stamped version id round-trip cleanly.
    catalog_version_id: str | None = Field(default=None, pattern=CATALOG_VERSION_ID_PATTERN)
    catalog_schema_version: int | None = Field(default=None, ge=1)
    synced_at: datetime
    local_overrides: list[str] = Field(default_factory=list)


def _require_catalog_origin_family(
    origin: CatalogOrigin | None,
    *,
    expected_table: CatalogTableName,
    expected_version_prefix: str | None,
) -> None:
    if origin is None:
        return
    if origin.catalog_table != expected_table:
        raise ValueError(f"catalog_origin.catalog_table must be {expected_table!r}, got {origin.catalog_table!r}")
    version_id = origin.catalog_version_id
    if expected_version_prefix is None:
        # Catalogs without a version layer (materials) must not stamp a
        # version id; surface that mismatch instead of silently ignoring it.
        if version_id is not None:
            raise ValueError(f"catalog_origin.catalog_version_id must be null for {expected_table!r}")
        return
    if version_id is None or not version_id.startswith(expected_version_prefix):
        raise ValueError(f"catalog_origin.catalog_version_id must start with {expected_version_prefix!r}")


def _normalize_legacy_hot_water_heater_envelope(value: object) -> object:
    if not isinstance(value, dict):
        return value
    envelope = dict(value)
    field_defs = envelope.get("field_defs")
    if isinstance(field_defs, list):
        envelope["field_defs"] = [
            {**field, "field_key": "heater_type"}
            if isinstance(field, dict) and field.get("field_key") == "tank_type"
            else field
            for field in field_defs
        ]
    rows = envelope.get("rows")
    if isinstance(rows, list):
        envelope["rows"] = [_normalize_legacy_hot_water_heater_row(row) for row in rows]
    return envelope


def _normalize_legacy_hot_water_heater_row(value: object) -> object:
    if not isinstance(value, dict):
        return value
    row = dict(value)
    legacy_type = row.pop("tank_type", None)
    row.setdefault("heater_type", legacy_type)
    return row


class FrameRef(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=200)
    manufacturer: str | None = Field(default=None, max_length=200)
    brand: str | None = Field(default=None, max_length=200)
    use: str | None = Field(default=None, max_length=40)
    operation: str | None = Field(default=None, max_length=40)
    location: str | None = Field(default=None, max_length=40)
    mull_type: str | None = Field(default=None, max_length=40)
    prefix: str | None = Field(default=None, max_length=80)
    suffix: str | None = Field(default=None, max_length=80)
    material: str | None = Field(default=None, max_length=80)
    width_mm: float | None = Field(default=None, ge=0)
    u_value_w_m2k: float | None = Field(default=None, ge=0)
    psi_g_w_mk: float | None = Field(default=None, ge=0)
    psi_install_w_mk: float | None = Field(default=None, ge=0)
    color: str | None = Field(default=None, max_length=40)
    source: str | None = Field(default=None, max_length=400)
    datasheet_url: str | None = Field(default=None, max_length=400)
    comments: str | None = Field(default=None, max_length=4000)
    catalog_origin: CatalogOrigin | None = None

    @field_validator("color", mode="before")
    @classmethod
    def _normalize_color(cls, value: object) -> object:
        return normalize_optional_hex_color(value)

    @model_validator(mode="after")
    def _validate_catalog_origin_family(self) -> FrameRef:
        _require_catalog_origin_family(
            self.catalog_origin,
            expected_table="frame_types",
            expected_version_prefix=None,
        )
        return self


class GlazingRef(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=200)
    manufacturer: str | None = Field(default=None, max_length=200)
    brand: str | None = Field(default=None, max_length=200)
    suffix: str | None = Field(default=None, max_length=80)
    u_value_w_m2k: float | None = Field(default=None, ge=0)
    g_value: float | None = Field(default=None, ge=0.0, le=1.0)
    color: str | None = Field(default=None, max_length=40)
    source: str | None = Field(default=None, max_length=400)
    datasheet_url: str | None = Field(default=None, max_length=400)
    comments: str | None = Field(default=None, max_length=4000)
    catalog_origin: CatalogOrigin | None = None

    @field_validator("color", mode="before")
    @classmethod
    def _normalize_color(cls, value: object) -> object:
        return normalize_optional_hex_color(value)

    @model_validator(mode="after")
    def _validate_catalog_origin_family(self) -> GlazingRef:
        _require_catalog_origin_family(
            self.catalog_origin,
            expected_table="glazing_types",
            expected_version_prefix=None,
        )
        return self


class AssemblySegment(BaseModel):
    """A side-by-side material slot inside one assembly layer."""

    model_config = ConfigDict(extra="forbid")

    id: str = Field(pattern=r"^seg_[A-Za-z0-9_-]+$", max_length=80)
    order: int = Field(ge=0)
    width_mm: float = Field(gt=0, allow_inf_nan=False)
    is_continuous_insulation: bool = False
    steel_stud_spacing_mm: float | None = Field(default=None, gt=0, allow_inf_nan=False)
    project_material_id: str | None = Field(default=None, pattern=r"^pmat_[A-Za-z0-9_-]+$", max_length=80)
    photo_asset_ids: list[str] = Field(default_factory=list)
    use_site_notes: str | None = Field(default=None, max_length=4000)

    @field_validator("use_site_notes", mode="before")
    @classmethod
    def _strip_optional_notes(cls, value: object) -> object:
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value


class AssemblyLayer(BaseModel):
    """One ordered horizontal strip in an assembly cross-section."""

    model_config = ConfigDict(extra="forbid")

    id: str = Field(pattern=r"^lyr_[A-Za-z0-9_-]+$", max_length=80)
    order: int = Field(ge=0)
    thickness_mm: float = Field(gt=0, allow_inf_nan=False)
    segments: list[AssemblySegment] = Field(min_length=1)

    @model_validator(mode="after")
    def _validate_segments(self) -> AssemblyLayer:
        _validate_unique_ids("segment", [segment.id for segment in self.segments])
        _validate_contiguous_orders("segment", [(segment.id, segment.order) for segment in self.segments])
        return self


class Assembly(BaseModel):
    """A project-owned opaque construction assembly."""

    model_config = ConfigDict(extra="forbid")

    id: str = Field(pattern=r"^asm_[A-Za-z0-9_-]+$", max_length=80)
    name: str = Field(min_length=1, max_length=200)
    type: AssemblyType
    orientation: AssemblyOrientation
    layers: list[AssemblyLayer] = Field(min_length=1)

    @field_validator("name", mode="before")
    @classmethod
    def _strip_name(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip()
        return value

    @model_validator(mode="after")
    def _validate_layers(self) -> Assembly:
        _validate_unique_ids("layer", [layer.id for layer in self.layers])
        _validate_contiguous_orders("layer", [(layer.id, layer.order) for layer in self.layers])
        return self


class ProjectMaterial(BaseModel):
    """A project-owned material/product record referenced by segments.

    Catalog-sourced fields mirror ``CatalogMaterialPublic``; the project
    side adds ``id``, ``specification_status``, ``datasheet_asset_ids``,
    and ``catalog_origin``.
    """

    model_config = ConfigDict(extra="forbid")

    id: str = Field(pattern=r"^pmat_[A-Za-z0-9_-]+$", max_length=80)
    name: str = Field(min_length=1, max_length=200)
    category: str = Field(min_length=1, max_length=120)
    density_kg_m3: float | None = Field(default=None, ge=0, allow_inf_nan=False)
    specific_heat_j_kgk: float | None = Field(default=None, ge=0, allow_inf_nan=False)
    conductivity_w_mk: float | None = Field(default=None, gt=0, allow_inf_nan=False)
    emissivity: float | None = Field(default=None, ge=0, le=1, allow_inf_nan=False)
    color: str | None = Field(default=None, max_length=40)
    source: str | None = Field(default=None, max_length=400)
    url: str | None = Field(default=None, max_length=2000)
    comments: str | None = Field(default=None, max_length=4000)
    specification_status: SpecificationStatus = "missing"
    datasheet_asset_ids: list[str] = Field(default_factory=list)
    catalog_origin: CatalogOrigin | None = None

    @field_validator("name", "category", mode="before")
    @classmethod
    def _strip_required_strings(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip()
        return value

    @field_validator("source", "url", "comments", mode="before")
    @classmethod
    def _strip_optional_text(cls, value: object) -> object:
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value

    @field_validator("color", mode="before")
    @classmethod
    def _normalize_color(cls, value: object) -> object:
        return normalize_optional_hex_color(value)

    @model_validator(mode="after")
    def _validate_catalog_origin_family(self) -> ProjectMaterial:
        _require_catalog_origin_family(
            self.catalog_origin,
            expected_table="materials",
            expected_version_prefix=None,
        )
        return self


APERTURE_DEFAULT_FRAME_NAME = "PHN-Default-Frame"
APERTURE_DEFAULT_GLAZING_NAME = "PHN-Default-Glazing"

ApertureOperationType = Literal["swing", "slide"]
ApertureOperationDirection = Literal["left", "right", "up", "down"]


class ApertureOperation(BaseModel):
    """Aperture-element operation (Fixed when omitted at the element level).

    `swing` (hinge) and `slide` (track) are the two parametric families.
    `directions` is the per-leaf set of hinge or slide directions. Multiple
    directions remain valid for compound operations such as tilt-turn.
    """

    model_config = ConfigDict(extra="forbid")

    type: ApertureOperationType
    directions: list[ApertureOperationDirection] = Field(default_factory=list)

    @model_validator(mode="after")
    def _validate_directions(self) -> ApertureOperation:
        if len(self.directions) != len(set(self.directions)):
            raise ValueError("ApertureOperation.directions must be unique")
        return self


class ApertureElementFrames(BaseModel):
    """Four-sided per-element frame slots (top/right/bottom/left)."""

    model_config = ConfigDict(extra="forbid")

    top: FrameRef | None = None
    right: FrameRef | None = None
    bottom: FrameRef | None = None
    left: FrameRef | None = None


class ApertureElement(BaseModel):
    """One sash inside an aperture type, spanning a contiguous grid rectangle.

    `name` defaults to "Unnamed" so newly created elements are valid
    without an explicit label; empty / whitespace-only names are rejected
    at validation time. `operation=None` means Fixed. `row_span` /
    `column_span` are inclusive on both ends; coverage of the aperture
    grid is enforced by `check_aperture_coverage` (no holes, no overlaps).
    """

    model_config = ConfigDict(extra="forbid")

    id: str = Field(pattern=r"^aptel_[A-Za-z0-9_-]+$", max_length=80)
    name: str = Field(default="Unnamed", min_length=1, max_length=200)
    row_span: tuple[int, int]
    column_span: tuple[int, int]
    frames: ApertureElementFrames = Field(default_factory=ApertureElementFrames)
    glazing: GlazingRef | None = None
    operation: ApertureOperation | None = None

    @field_validator("name", mode="before")
    @classmethod
    def _strip_name(cls, value: object) -> object:
        if isinstance(value, str):
            stripped = value.strip()
            if not stripped:
                raise ValueError("ApertureElement.name must not be empty")
            return stripped
        return value

    @field_validator("row_span", "column_span")
    @classmethod
    def _validate_span(cls, value: tuple[int, int]) -> tuple[int, int]:
        start, end = value
        if start < 0 or end < 0:
            raise ValueError("span indices must be >= 0")
        if start > end:
            raise ValueError("span start must be <= end")
        return value


class ApertureTypeEntry(BaseModel):
    """A named aperture type — grid + element layout + per-element refs.

    The `coverage invariant` is enforced here: every grid cell
    `(r, c)` for `0 <= r < R`, `0 <= c < C` must be covered by exactly
    one element. Holes and overlaps both raise validation errors. The
    pure check lives in `apertures/coverage.py` so the merge/split and
    add-row/add-column command handlers (later phases) can reuse it.
    """

    model_config = ConfigDict(extra="forbid")

    id: str = Field(pattern=r"^apt_[A-Za-z0-9_-]+$", max_length=80)
    name: str = Field(min_length=1, max_length=200)
    row_heights_mm: list[float] = Field(min_length=1)
    column_widths_mm: list[float] = Field(min_length=1)
    elements: list[ApertureElement] = Field(min_length=1)

    @field_validator("name", mode="before")
    @classmethod
    def _strip_name(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip()
        return value

    @field_validator("row_heights_mm", "column_widths_mm")
    @classmethod
    def _positive_dimensions(cls, value: list[float]) -> list[float]:
        for dim in value:
            if dim <= 0:
                raise ValueError("grid dimensions must be > 0")
        return value

    @model_validator(mode="after")
    def _validate_coverage(self) -> ApertureTypeEntry:
        # Lazy-import to keep the coverage check independent of the
        # document module — apertures/coverage.py imports
        # `ApertureTypeEntry` for typing, so a top-level import would
        # cycle.
        from features.project_document.apertures.coverage import check_aperture_coverage

        check_aperture_coverage(self)
        return self


class RoomsTableEnvelope(BaseModel):
    """`{ field_defs, rows }` envelope around the Rooms table.

    Phase 1b: every field on the table — built-in or custom — lives in
    the persisted `field_defs` list. Mutable-type built-in values plus
    all custom values live in each row's `custom_values` bag.
    """

    model_config = ConfigDict(extra="forbid")

    field_defs: list[TableFieldDef] = Field(default_factory=list)
    rows: list[RoomRow] = Field(default_factory=list)


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

    schema_version: Literal[4] = CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION
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
            APPLIANCE_TYPE_OPTION_KEY: [],
            APPLIANCE_ENERGY_STAR_OPTION_KEY: [],
            THERMAL_BRIDGE_TYPE_OPTION_KEY: [],
        }
    )

    @model_validator(mode="before")
    @classmethod
    def normalize_legacy_hot_water_heater_table(cls, value: object) -> object:
        if not isinstance(value, dict):
            return value
        body = dict(value)
        tables = body.get("tables")
        if isinstance(tables, dict):
            tables = dict(tables)
            equipment = tables.get("equipment")
            if isinstance(equipment, dict):
                equipment = dict(equipment)
                legacy = equipment.pop("hot_water_tanks", None)
                if "hot_water_heaters" not in equipment and legacy is not None:
                    equipment["hot_water_heaters"] = _normalize_legacy_hot_water_heater_envelope(legacy)
                tables["equipment"] = equipment
            body["tables"] = tables
        options = body.get("single_select_options")
        if isinstance(options, dict) and HOT_WATER_HEATER_TYPE_OPTION_KEY not in options:
            options = dict(options)
            legacy_options = options.pop("hot_water_tanks.type", None)
            if legacy_options is not None:
                options[HOT_WATER_HEATER_TYPE_OPTION_KEY] = legacy_options
            body["single_select_options"] = options
        return body

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

        rooms_field_defs_by_key = _index_table_field_defs("rooms", self.tables.rooms.field_defs)
        _require_record_id_seeded("rooms", rooms_field_defs_by_key)
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
            if room.erv_unit_ids:
                raise ValueError(f"Room ERV assignments are deferred until the ERV table is available: {room.id}")

        _validate_rows_custom_values(
            table_label="rooms",
            row_label="room",
            rows=[(room.id, room.custom_values) for room in self.tables.rooms.rows],
            field_defs_by_key=rooms_field_defs_by_key,
            single_select_options=self.single_select_options,
        )
        _validate_default_option_ids(
            table_label="rooms",
            field_defs_by_key=rooms_field_defs_by_key,
            single_select_options=self.single_select_options,
        )
        # Formula cycle detection across the Rooms table's formula
        # fields. Missing refs are *silently absorbed* (per plan-13 D2)
        # — the evaluator surfaces them per-row at read time. Cycles
        # are a hard validation failure.
        self._validate_rooms_formula_cycles(rooms_field_defs_by_key)

        pumps_field_defs_by_key = _index_table_field_defs("pumps", self.tables.equipment.pumps.field_defs)
        _require_record_id_seeded("pumps", pumps_field_defs_by_key)
        pump_device_type_ids = {option.id for option in self.single_select_options[PUMP_DEVICE_TYPE_OPTION_KEY]}
        pump_ids: set[str] = set()
        for pump in self.tables.equipment.pumps.rows:
            if pump.id in pump_ids:
                raise ValueError(f"Duplicate pump id: {pump.id}")
            pump_ids.add(pump.id)
            if pump.device_type is not None and pump.device_type not in pump_device_type_ids:
                raise ValueError(f"Missing pump device-type option for pump {pump.id}: {pump.device_type}")

        _validate_rows_custom_values(
            table_label="pumps",
            row_label="pump",
            rows=[(pump.id, pump.custom_values) for pump in self.tables.equipment.pumps.rows],
            field_defs_by_key=pumps_field_defs_by_key,
            single_select_options=self.single_select_options,
        )

        fans_field_defs_by_key = _index_table_field_defs("fans", self.tables.equipment.fans.field_defs)
        _require_record_id_seeded("fans", fans_field_defs_by_key)
        fan_type_ids = {option.id for option in self.single_select_options[FAN_TYPE_OPTION_KEY]}
        fan_ids: set[str] = set()
        for fan in self.tables.equipment.fans.rows:
            if fan.id in fan_ids:
                raise ValueError(f"Duplicate fan id: {fan.id}")
            fan_ids.add(fan.id)
            if fan.fan_type is not None and fan.fan_type not in fan_type_ids:
                raise ValueError(f"Missing fan type option for fan {fan.id}: {fan.fan_type}")

        _validate_rows_custom_values(
            table_label="fans",
            row_label="fan",
            rows=[(fan.id, fan.custom_values) for fan in self.tables.equipment.fans.rows],
            field_defs_by_key=fans_field_defs_by_key,
            single_select_options=self.single_select_options,
        )

        hot_water_heaters_field_defs_by_key = _index_table_field_defs(
            "hot_water_heaters", self.tables.equipment.hot_water_heaters.field_defs
        )
        _require_record_id_seeded("hot_water_heaters", hot_water_heaters_field_defs_by_key)
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

        _validate_rows_custom_values(
            table_label="hot_water_heaters",
            row_label="hot water heater",
            rows=[(heater.id, heater.custom_values) for heater in self.tables.equipment.hot_water_heaters.rows],
            field_defs_by_key=hot_water_heaters_field_defs_by_key,
            single_select_options=self.single_select_options,
        )

        electric_heaters_field_defs_by_key = _index_table_field_defs(
            "electric_heaters", self.tables.equipment.electric_heaters.field_defs
        )
        _require_record_id_seeded("electric_heaters", electric_heaters_field_defs_by_key)
        electric_heater_ids: set[str] = set()
        for heater in self.tables.equipment.electric_heaters.rows:
            if heater.id in electric_heater_ids:
                raise ValueError(f"Duplicate electric heater id: {heater.id}")
            electric_heater_ids.add(heater.id)

        _validate_rows_custom_values(
            table_label="electric_heaters",
            row_label="electric heater",
            rows=[(heater.id, heater.custom_values) for heater in self.tables.equipment.electric_heaters.rows],
            field_defs_by_key=electric_heaters_field_defs_by_key,
            single_select_options=self.single_select_options,
        )

        appliances_field_defs_by_key = _index_table_field_defs(
            "appliances", self.tables.equipment.appliances.field_defs
        )
        _require_record_id_seeded("appliances", appliances_field_defs_by_key)
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

        _validate_rows_custom_values(
            table_label="appliances",
            row_label="appliance",
            rows=[(appliance.id, appliance.custom_values) for appliance in self.tables.equipment.appliances.rows],
            field_defs_by_key=appliances_field_defs_by_key,
            single_select_options=self.single_select_options,
        )

        thermal_bridges_field_defs_by_key = _index_table_field_defs(
            "thermal_bridges", self.tables.thermal_bridges.field_defs
        )
        _require_record_id_seeded("thermal_bridges", thermal_bridges_field_defs_by_key)
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

        _validate_rows_custom_values(
            table_label="thermal_bridges",
            row_label="thermal bridge",
            rows=[
                (thermal_bridge.id, thermal_bridge.custom_values) for thermal_bridge in self.tables.thermal_bridges.rows
            ],
            field_defs_by_key=thermal_bridges_field_defs_by_key,
            single_select_options=self.single_select_options,
        )

        ventilators_field_defs_by_key = _index_table_field_defs("ventilators", self.tables.equipment.ervs.field_defs)
        _require_record_id_seeded("ventilators", ventilators_field_defs_by_key)
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

        _validate_rows_custom_values(
            table_label="ventilators",
            row_label="ventilator",
            rows=[(ventilator.id, ventilator.custom_values) for ventilator in self.tables.equipment.ervs.rows],
            field_defs_by_key=ventilators_field_defs_by_key,
            single_select_options=self.single_select_options,
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

        _validate_envelope_references(self.tables.project_materials, self.tables.assemblies)

        return self

    def _validate_rooms_formula_cycles(self, field_defs_by_key: dict[str, TableFieldDef]) -> None:
        # Lazy-import to keep the document module free of formula deps
        # for callers that don't touch formula fields.
        from features.project_document.formula import (
            FormulaAST,
            FormulaCycleError,
            ast_from_json,
            detect_cycles,
        )

        formula_fields = [f for f in field_defs_by_key.values() if f.field_type is CustomFieldType.formula]
        if not formula_fields:
            return

        asts_by_key: dict[str, FormulaAST] = {}
        for f in formula_fields:
            stored = f.config.get("ast")
            if stored is None:
                continue
            try:
                asts_by_key[f.field_key] = ast_from_json(stored)
            except (ValueError, TypeError):
                continue

        for f in formula_fields:
            stored = asts_by_key.get(f.field_key)
            if stored is None:
                continue
            others = {k: v for k, v in asts_by_key.items() if k != f.field_key}
            try:
                detect_cycles(f.field_key, stored, others)
            except FormulaCycleError as exc:
                raise ValueError(f"Rooms formula cycle for {f.display_name!r}: {' -> '.join(exc.cycle_path)}") from exc


def _require_record_id_seeded(
    table_label: str,
    field_defs_by_key: dict[str, TableFieldDef],
) -> None:
    """Enforce PRD §P4.3 identifier invariant: every FieldDef-capable
    table carries a `record_id` entry. Uniqueness is already enforced
    upstream by `_index_table_field_defs`, so a membership check is
    sufficient.
    """
    if RESERVED_FIELD_KEY_RECORD_ID not in field_defs_by_key:
        raise ValueError(f"{table_label}.field_defs must contain a record_id entry")


def _validate_unique_ids(label: str, ids: list[str]) -> None:
    seen: set[str] = set()
    for item_id in ids:
        if item_id in seen:
            raise ValueError(f"Duplicate {label} id: {item_id}")
        seen.add(item_id)


def _validate_contiguous_orders(label: str, ordered_ids: list[tuple[str, int]]) -> None:
    expected = list(range(len(ordered_ids)))
    actual = sorted(order for _item_id, order in ordered_ids)
    if actual != expected:
        raise ValueError(f"{label} orders must be contiguous from 0")


def _validate_envelope_references(project_materials: list[ProjectMaterial], assemblies: list[Assembly]) -> None:
    project_material_ids = {material.id for material in project_materials}
    if len(project_material_ids) != len(project_materials):
        raise ValueError("Duplicate project material id")

    assembly_ids: set[str] = set()
    assembly_names: set[str] = set()
    for assembly in assemblies:
        if assembly.id in assembly_ids:
            raise ValueError(f"Duplicate assembly id: {assembly.id}")
        assembly_ids.add(assembly.id)

        normalized_name = normalize_display_name(assembly.name)
        if normalized_name in assembly_names:
            raise ValueError(f"Duplicate assembly name: {assembly.name}")
        assembly_names.add(normalized_name)

        for layer in assembly.layers:
            for segment in layer.segments:
                if segment.project_material_id is not None and segment.project_material_id not in project_material_ids:
                    raise ValueError(
                        f"Unknown project_material_id {segment.project_material_id!r} on segment {segment.id}"
                    )


def _index_table_field_defs(
    table_label: str,
    field_defs: list[TableFieldDef],
) -> dict[str, TableFieldDef]:
    """Build a `field_key → FieldDef` map while enforcing uniqueness of
    both `field_key` (identity) and `display_name` (case-insensitive,
    trimmed)."""
    by_key: dict[str, TableFieldDef] = {}
    name_seen: dict[str, str] = {}
    for field_def in field_defs:
        if field_def.field_key in by_key:
            raise ValueError(f"Duplicate field_key in {table_label}.field_defs: {field_def.field_key}")
        by_key[field_def.field_key] = field_def
        normalized_name = normalize_display_name(field_def.display_name)
        if normalized_name in name_seen:
            existing = name_seen[normalized_name]
            raise ValueError(
                f"Duplicate field name in {table_label}: {field_def.display_name!r} collides with {existing!r}"
            )
        name_seen[normalized_name] = field_def.display_name
    return by_key


def _validate_rows_custom_values(
    *,
    table_label: str,
    row_label: str,
    rows: list[tuple[str, dict[str, CustomValue]]],
    field_defs_by_key: dict[str, TableFieldDef],
    single_select_options: dict[str, list[SingleSelectOption]],
) -> None:
    """Coerce every `(row_id, custom_values)` pair against its
    FieldDef's declared type. Single-select option lists are resolved
    once per field_key, not per row."""
    option_list_by_field_key: dict[str, list[SingleSelectOption]] = {}
    for field_key, field_def in field_defs_by_key.items():
        if field_def.field_type is CustomFieldType.single_select:
            option_list_by_field_key[field_key] = single_select_options.get(f"{table_label}.{field_key}", [])

    for row_id, custom_values in rows:
        for field_key, value in custom_values.items():
            field_def = field_defs_by_key.get(field_key)
            if field_def is None:
                raise ValueError(f"Unknown field_key on {row_label} {row_id}: {field_key}")
            try:
                coerce_custom_value(
                    value,
                    field_def.field_type,
                    option_list=option_list_by_field_key.get(field_key),
                )
            except ValueError as exc:
                raise ValueError(
                    f"Invalid value for {field_def.display_name!r} on {row_label} {row_id}: {exc}"
                ) from exc


def _validate_default_option_ids(
    *,
    table_label: str,
    field_defs_by_key: dict[str, TableFieldDef],
    single_select_options: dict[str, list[SingleSelectOption]],
) -> None:
    """`config.default_option_id`, when set, must reference an option in
    the field's namespaced list. Only valid on single_select fields."""
    for field_def in field_defs_by_key.values():
        default_raw = field_def.config.get("default_option_id")
        if default_raw is None:
            continue
        if field_def.field_type is not CustomFieldType.single_select:
            raise ValueError(
                f"default_option_id is only valid for single_select fields "
                f"(field {field_def.field_key!r}, type {field_def.field_type.value!r})"
            )
        if not isinstance(default_raw, str):
            raise ValueError(f"default_option_id for {field_def.field_key!r} must be a string option id")
        namespace_key = f"{table_label}.{field_def.field_key}"
        default_option_ids = {option.id for option in single_select_options.get(namespace_key, [])}
        if default_raw not in default_option_ids:
            raise ValueError(
                f"default_option_id {default_raw!r} for {field_def.field_key!r} "
                "does not reference an option in the field's option list"
            )

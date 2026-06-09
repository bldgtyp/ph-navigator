"""Row and envelope schemas for every FieldDef-capable project-document table.

Split out of the original ``document.py`` so the central
``ProjectDocumentV1`` module can focus on cross-table invariants. These
types are leaf Pydantic models with no document-level dependencies —
they import only ``TableFieldDef`` and ``CustomValue`` from the
``custom_fields`` module.

Every Row type inherits from ``RowWithCustomFields`` and follows the
same v3 mixed-storage rule: locked-type built-ins keep typed columns;
mutable-type built-ins plus every custom field live in
``custom_values`` / ``custom_links``.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field, field_validator

from features.heat_pumps.models import HeatPumpsTableSlice
from features.project_document.custom_fields import CustomValue, TableFieldDef


class RowWithCustomFields(BaseModel):
    """Shared bag fields for every FieldDef-capable table row.

    `custom_values` holds scalar values for mutable-type built-ins and
    every non-`linked_record` custom field. `custom_links` holds id
    arrays for `linked_record` custom fields. A given `field_key`
    appears in exactly one of the two bags (PRD Q16, enforced by
    `validate_rows_custom_links`).
    """

    custom_values: dict[str, CustomValue] = Field(default_factory=dict)
    custom_links: dict[str, list[str]] = Field(default_factory=dict)


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


class RoomRow(RowWithCustomFields):
    """A row in the Rooms table (v3 mixed-storage).

    Only locked-type built-ins keep typed columns. Mutable-type built-ins
    (`number`, `name`, `num_people`, `num_bedrooms`) and all custom
    fields live in `custom_values` / `custom_links` (inherited).
    """

    model_config = ConfigDict(extra="forbid")

    id: str = Field(pattern=r"^rm_[A-Za-z0-9_-]+$", max_length=80)
    floor_level: str | None = Field(default=None, pattern=r"^opt_[A-Za-z0-9_-]+$", max_length=80)
    building_zone: str | None = Field(default=None, pattern=r"^opt_[A-Za-z0-9_-]+$", max_length=80)
    icfa_factor: float = Field(default=1.0, ge=0.0, le=1.0)
    catalog_origin: dict[str, object] | None = None
    notes: str | None = Field(default=None, max_length=4000)

    @field_validator("notes", mode="before")
    @classmethod
    def strip_optional_notes(cls, value: object) -> object:
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value


class RoomsTableEnvelope(BaseModel):
    """`{ field_defs, rows }` envelope around the Rooms table.

    Phase 1b: every field on the table — built-in or custom — lives in
    the persisted `field_defs` list. Mutable-type built-in values plus
    all custom values live in each row's `custom_values` bag.
    """

    model_config = ConfigDict(extra="forbid")

    field_defs: list[TableFieldDef] = Field(default_factory=list)
    rows: list[RoomRow] = Field(default_factory=list)


class PumpRow(RowWithCustomFields):
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


class VentilatorRow(RowWithCustomFields):
    """A row in the Ventilators / ERVs equipment table."""

    model_config = ConfigDict(extra="forbid")

    id: str = Field(pattern=r"^vent_[A-Za-z0-9_-]+$", max_length=80)
    inside_outside: str | None = Field(default=None, pattern=r"^opt_[A-Za-z0-9_-]+$", max_length=80)
    url: str | None = Field(default=None, max_length=2000)
    notes: str | None = Field(default=None, max_length=4000)

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


class FanRow(RowWithCustomFields):
    """A row in the Fans equipment table."""

    model_config = ConfigDict(extra="forbid")

    id: str = Field(pattern=r"^fan_[A-Za-z0-9_-]+$", max_length=80)
    fan_type: str | None = Field(default=None, pattern=r"^opt_[A-Za-z0-9_-]+$", max_length=80)
    phase: int | None = None
    url: str | None = Field(default=None, max_length=2000)
    notes: str | None = Field(default=None, max_length=4000)
    datasheet_asset_ids: list[str] = Field(default_factory=list)

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


class HotWaterHeaterRow(RowWithCustomFields):
    """A row in the Hot Water Heaters equipment table."""

    model_config = ConfigDict(extra="forbid")

    id: str = Field(pattern=r"^hwh_[A-Za-z0-9_-]+$", max_length=80)
    heater_type: str | None = Field(default=None, pattern=r"^opt_[A-Za-z0-9_-]+$", max_length=80)
    phase: int | None = None
    url: str | None = Field(default=None, max_length=2000)
    notes: str | None = Field(default=None, max_length=4000)
    datasheet_asset_ids: list[str] = Field(default_factory=list)

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


class HotWaterTankRow(RowWithCustomFields):
    """A row in the Hot Water Tanks equipment table."""

    model_config = ConfigDict(extra="forbid")

    id: str = Field(pattern=r"^hwt_[A-Za-z0-9_-]+$", max_length=80)
    tank_type: str | None = Field(default=None, pattern=r"^opt_[A-Za-z0-9_-]+$", max_length=80)
    url: str | None = Field(default=None, max_length=2000)
    notes: str | None = Field(default=None, max_length=4000)
    datasheet_asset_ids: list[str] = Field(default_factory=list)

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


class HotWaterTanksTableEnvelope(BaseModel):
    model_config = ConfigDict(extra="forbid")

    field_defs: list[TableFieldDef] = Field(default_factory=list)
    rows: list[HotWaterTankRow] = Field(default_factory=list)


class ElectricHeaterRow(RowWithCustomFields):
    """A row in the Electric Heaters equipment table."""

    model_config = ConfigDict(extra="forbid")

    id: str = Field(pattern=r"^heatr_[A-Za-z0-9_-]+$", max_length=80)
    url: str | None = Field(default=None, max_length=2000)
    notes: str | None = Field(default=None, max_length=4000)

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


class ApplianceRow(RowWithCustomFields):
    """A row in the Appliances equipment table."""

    model_config = ConfigDict(extra="forbid")

    id: str = Field(pattern=r"^appl_[A-Za-z0-9_-]+$", max_length=80)
    appliance_type: str | None = Field(default=None, pattern=r"^opt_[A-Za-z0-9_-]+$", max_length=80)
    energy_star: str | None = Field(default=None, pattern=r"^opt_[A-Za-z0-9_-]+$", max_length=80)
    url: str | None = Field(default=None, max_length=2000)
    notes: str | None = Field(default=None, max_length=4000)
    datasheet_asset_ids: list[str] = Field(default_factory=list)

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


class ThermalBridgeRow(RowWithCustomFields):
    """A linear thermal-bridge record for the project document."""

    model_config = ConfigDict(extra="forbid")

    id: str = Field(pattern=r"^tb_[A-Za-z0-9_-]+$", max_length=80)
    thermal_bridge_type: str | None = Field(default=None, pattern=r"^opt_[A-Za-z0-9_-]+$", max_length=80)
    pdf_report_asset_ids: list[str] = Field(default_factory=list)
    notes: str | None = Field(default=None, max_length=4000)

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
    hot_water_tanks: HotWaterTanksTableEnvelope = Field(default_factory=HotWaterTanksTableEnvelope)
    pumps: PumpsTableEnvelope = Field(default_factory=PumpsTableEnvelope)
    ervs: VentilatorsTableEnvelope = Field(default_factory=VentilatorsTableEnvelope)
    heat_pumps: HeatPumpsTableSlice = Field(default_factory=HeatPumpsTableSlice)

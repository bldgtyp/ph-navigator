"""Pydantic models for project heat-pump equipment tables."""

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from features.project_document.custom_fields import TableFieldDef
from features.project_document.envelope_models import EvidenceStatus
from features.project_document.row_base import RowWithCustomFields

# Phius Multiple HP Performance Estimator dropdown values, used both
# as the discriminator stored on each outdoor-equip row and as the
# verbatim cell text emitted by the export. Renaming these would
# silently break paste-into-Phius — they must match the calc strings.
HeatingDataType = Literal["COPs", "HSPF", "HSPF2"]
CoolingDataType = Literal["EER/SEER", "EER2/SEER2", "IEER"]

ULID_SUFFIX_PATTERN = r"[0-9A-HJKMNP-TV-Z]{26}"


def _strip_optional_string(value: object) -> object:
    if isinstance(value, str):
        stripped = value.strip()
        return stripped or None
    return value


def _strip_required_string(value: object) -> object:
    if isinstance(value, str):
        return value.strip()
    return value


OptionId = Annotated[str, Field(pattern=r"^opt_[A-Za-z0-9_-]+$", max_length=80)]
NonNegativeFloat = Annotated[float, Field(ge=0)]
PositiveFloat = Annotated[float, Field(gt=0)]


class HeatPumpOutdoorEquipRow(RowWithCustomFields):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(pattern=rf"^hpoe_{ULID_SUFFIX_PATTERN}$")
    tag: str = Field(min_length=1, max_length=80)
    manufacturer: OptionId | None = None
    model_number: str | None = Field(default=None, max_length=160)
    paired_indoor_equip_id: str | None = Field(default=None, pattern=rf"^hpie_{ULID_SUFFIX_PATTERN}$")
    system_family: OptionId | None = None
    refrigerant: OptionId | None = None
    heating_cap_kw_17f: NonNegativeFloat | None = None
    heating_cap_kw_47f: NonNegativeFloat | None = None
    heating_data_type: HeatingDataType | None = None
    heating_cop_17f: PositiveFloat | None = None
    heating_cop_47f: PositiveFloat | None = None
    # Single seasonal-heating efficiency value; whether it represents the
    # legacy HSPF rating or the AHRI-2023 HSPF2 rating is determined by
    # ``heating_data_type``.
    hspf: NonNegativeFloat | None = None
    cooling_cap_kw_95f: NonNegativeFloat | None = None
    cooling_data_type: CoolingDataType | None = None
    # ``eer`` and ``seer`` hold the cooling-efficiency values; whether they
    # are the legacy EER/SEER or the AHRI-2023 EER2/SEER2 is determined by
    # ``cooling_data_type``. ``ieer`` is used only when cooling_data_type=IEER.
    eer: NonNegativeFloat | None = None
    seer: NonNegativeFloat | None = None
    ieer: NonNegativeFloat | None = None
    datasheet_asset_ids: list[str] = Field(default_factory=list)
    photo_asset_ids: list[str] = Field(default_factory=list)
    datasheet_status: EvidenceStatus = "needed"
    photo_status: EvidenceStatus = "needed"
    datasheet_not_required: bool = False
    photo_not_required: bool = False
    notes: str | None = Field(default=None, max_length=4000)
    catalog_origin: dict[str, object] | None = None

    @field_validator("tag", mode="before")
    @classmethod
    def strip_tag(cls, value: object) -> object:
        return _strip_required_string(value)

    @field_validator("model_number", "notes", mode="before")
    @classmethod
    def strip_optional_strings(cls, value: object) -> object:
        return _strip_optional_string(value)


class HeatPumpIndoorEquipRow(RowWithCustomFields):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(pattern=rf"^hpie_{ULID_SUFFIX_PATTERN}$")
    tag: str = Field(min_length=1, max_length=80)
    manufacturer: OptionId | None = None
    model_type: OptionId | None = None
    model_number: str | None = Field(default=None, max_length=160)
    install_type: OptionId | None = None
    nominal_tons: NonNegativeFloat | None = None
    fan_speed_cfm: NonNegativeFloat | None = None
    cooling_btuh: NonNegativeFloat | None = None
    heating_btuh_47f: NonNegativeFloat | None = None
    heating_btuh_17f: NonNegativeFloat | None = None
    heating_cop: PositiveFloat | None = None
    seer: NonNegativeFloat | None = None
    eer: NonNegativeFloat | None = None
    hspf: NonNegativeFloat | None = None
    datasheet_asset_ids: list[str] = Field(default_factory=list)
    photo_asset_ids: list[str] = Field(default_factory=list)
    datasheet_status: EvidenceStatus = "needed"
    photo_status: EvidenceStatus = "needed"
    datasheet_not_required: bool = False
    photo_not_required: bool = False
    notes: str | None = Field(default=None, max_length=4000)
    catalog_origin: dict[str, object] | None = None

    @field_validator("tag", mode="before")
    @classmethod
    def strip_tag(cls, value: object) -> object:
        return _strip_required_string(value)

    @field_validator("model_number", "notes", mode="before")
    @classmethod
    def strip_optional_strings(cls, value: object) -> object:
        return _strip_optional_string(value)


class HeatPumpOutdoorUnitRow(RowWithCustomFields):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(pattern=rf"^hpou_{ULID_SUFFIX_PATTERN}$")
    tag: str = Field(min_length=1, max_length=80)
    outdoor_equip_id: str = Field(pattern=rf"^hpoe_{ULID_SUFFIX_PATTERN}$")
    datasheet_asset_ids: list[str] = Field(default_factory=list)
    photo_asset_ids: list[str] = Field(default_factory=list)
    datasheet_status: EvidenceStatus = "needed"
    photo_status: EvidenceStatus = "needed"
    datasheet_not_required: bool = False
    photo_not_required: bool = False
    notes: str | None = Field(default=None, max_length=4000)

    @field_validator("tag", mode="before")
    @classmethod
    def strip_tag(cls, value: object) -> object:
        return _strip_required_string(value)

    @field_validator("notes", mode="before")
    @classmethod
    def strip_notes(cls, value: object) -> object:
        return _strip_optional_string(value)


class HeatPumpIndoorUnitRow(RowWithCustomFields):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(pattern=rf"^hpiu_{ULID_SUFFIX_PATTERN}$")
    tag: str = Field(min_length=1, max_length=80)
    indoor_equip_id: str = Field(pattern=rf"^hpie_{ULID_SUFFIX_PATTERN}$")
    outdoor_unit_id: str | None = Field(default=None, pattern=rf"^hpou_{ULID_SUFFIX_PATTERN}$")
    linked_erv_unit_id: str | None = Field(default=None, pattern=r"^vent_[A-Za-z0-9_-]+$")
    served_room_ids: list[str] = Field(default_factory=list)
    datasheet_asset_ids: list[str] = Field(default_factory=list)
    photo_asset_ids: list[str] = Field(default_factory=list)
    datasheet_status: EvidenceStatus = "needed"
    photo_status: EvidenceStatus = "needed"
    datasheet_not_required: bool = False
    photo_not_required: bool = False
    notes: str | None = Field(default=None, max_length=4000)

    @field_validator("tag", mode="before")
    @classmethod
    def strip_tag(cls, value: object) -> object:
        return _strip_required_string(value)

    @field_validator("notes", mode="before")
    @classmethod
    def strip_notes(cls, value: object) -> object:
        return _strip_optional_string(value)


class HeatPumpOutdoorEquipTableEnvelope(BaseModel):
    model_config = ConfigDict(extra="forbid")

    field_defs: list[TableFieldDef] = Field(default_factory=list)
    rows: list[HeatPumpOutdoorEquipRow] = Field(default_factory=list)


class HeatPumpIndoorEquipTableEnvelope(BaseModel):
    model_config = ConfigDict(extra="forbid")

    field_defs: list[TableFieldDef] = Field(default_factory=list)
    rows: list[HeatPumpIndoorEquipRow] = Field(default_factory=list)


class HeatPumpOutdoorUnitsTableEnvelope(BaseModel):
    model_config = ConfigDict(extra="forbid")

    field_defs: list[TableFieldDef] = Field(default_factory=list)
    rows: list[HeatPumpOutdoorUnitRow] = Field(default_factory=list)


class HeatPumpIndoorUnitsTableEnvelope(BaseModel):
    model_config = ConfigDict(extra="forbid")

    field_defs: list[TableFieldDef] = Field(default_factory=list)
    rows: list[HeatPumpIndoorUnitRow] = Field(default_factory=list)


class HeatPumpsTableSlice(BaseModel):
    model_config = ConfigDict(extra="forbid")

    outdoor_equip: HeatPumpOutdoorEquipTableEnvelope = Field(default_factory=HeatPumpOutdoorEquipTableEnvelope)
    indoor_equip: HeatPumpIndoorEquipTableEnvelope = Field(default_factory=HeatPumpIndoorEquipTableEnvelope)
    outdoor_units: HeatPumpOutdoorUnitsTableEnvelope = Field(default_factory=HeatPumpOutdoorUnitsTableEnvelope)
    indoor_units: HeatPumpIndoorUnitsTableEnvelope = Field(default_factory=HeatPumpIndoorUnitsTableEnvelope)


# Single-select option keys consumed by heat-pump tables. Stored in the
# document-level `body.single_select_options` map (same shape as
# appliances/ventilators).
HEAT_PUMP_MANUFACTURER_OPTION_KEY = "heat_pumps.manufacturer"
HEAT_PUMP_SYSTEM_FAMILY_OPTION_KEY = "heat_pumps.system_family"
HEAT_PUMP_REFRIGERANT_OPTION_KEY = "heat_pumps.refrigerant"
HEAT_PUMP_MODEL_TYPE_OPTION_KEY = "heat_pumps.model_type"
HEAT_PUMP_INSTALL_TYPE_OPTION_KEY = "heat_pumps.install_type"

# Keys writable through the heat-pumps options endpoint.
HEAT_PUMP_OWNED_OPTION_KEYS: tuple[str, ...] = (
    HEAT_PUMP_MANUFACTURER_OPTION_KEY,
    HEAT_PUMP_SYSTEM_FAMILY_OPTION_KEY,
    HEAT_PUMP_REFRIGERANT_OPTION_KEY,
    HEAT_PUMP_MODEL_TYPE_OPTION_KEY,
    HEAT_PUMP_INSTALL_TYPE_OPTION_KEY,
)

# All keys exposed on the heat-pumps slice response so the UI can render
# manufacturer/system_family/etc. labels alongside rows.
HEAT_PUMP_VISIBLE_OPTION_KEYS: tuple[str, ...] = HEAT_PUMP_OWNED_OPTION_KEYS

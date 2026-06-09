"""Pydantic models for project heat-pump equipment tables."""

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

ULID_SUFFIX_PATTERN = r"[0-9A-HJKMNP-TV-Z]{26}"
HeatingDataType = Literal["cops", "hspf2"]
CoolingDataType = Literal["eer2_seer2", "ieer"]


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


class HeatPumpOutdoorEquipRow(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(pattern=rf"^hpoe_{ULID_SUFFIX_PATTERN}$")
    manufacturer: OptionId | None = None
    model_number: str = Field(min_length=1, max_length=160)
    paired_indoor_equip_id: str | None = Field(default=None, pattern=rf"^hpie_{ULID_SUFFIX_PATTERN}$")
    system_family: OptionId | None = None
    refrigerant: OptionId | None = None
    heating_data_type: HeatingDataType | None = None
    heating_cap_kbtuh_17f: NonNegativeFloat | None = None
    heating_cap_kbtuh_47f: NonNegativeFloat | None = None
    heating_cop_17f: PositiveFloat | None = None
    heating_cop_47f: PositiveFloat | None = None
    hspf2: NonNegativeFloat | None = None
    hspf: NonNegativeFloat | None = None
    cooling_data_type: CoolingDataType | None = None
    cooling_cap_kbtuh_95f: NonNegativeFloat | None = None
    eer2: NonNegativeFloat | None = None
    seer2: NonNegativeFloat | None = None
    ieer: NonNegativeFloat | None = None
    eer: NonNegativeFloat | None = None
    seer: NonNegativeFloat | None = None
    datasheet_asset_ids: list[str] = Field(default_factory=list)
    notes: str | None = Field(default=None, max_length=4000)
    catalog_origin: dict[str, object] | None = None

    @field_validator("model_number", mode="before")
    @classmethod
    def strip_model_number(cls, value: object) -> object:
        return _strip_required_string(value)

    @field_validator("notes", mode="before")
    @classmethod
    def strip_notes(cls, value: object) -> object:
        return _strip_optional_string(value)


class HeatPumpIndoorEquipRow(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(pattern=rf"^hpie_{ULID_SUFFIX_PATTERN}$")
    manufacturer: OptionId | None = None
    model_type: OptionId | None = None
    model_number: str = Field(min_length=1, max_length=160)
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
    notes: str | None = Field(default=None, max_length=4000)
    catalog_origin: dict[str, object] | None = None

    @field_validator("model_number", mode="before")
    @classmethod
    def strip_model_number(cls, value: object) -> object:
        return _strip_required_string(value)

    @field_validator("notes", mode="before")
    @classmethod
    def strip_notes(cls, value: object) -> object:
        return _strip_optional_string(value)


class HeatPumpOutdoorUnitRow(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(pattern=rf"^hpou_{ULID_SUFFIX_PATTERN}$")
    tag: str = Field(min_length=1, max_length=80)
    outdoor_equip_id: str = Field(pattern=rf"^hpoe_{ULID_SUFFIX_PATTERN}$")
    building_zone: OptionId | None = None
    datasheet_asset_ids: list[str] = Field(default_factory=list)
    notes: str | None = Field(default=None, max_length=4000)

    @field_validator("tag", mode="before")
    @classmethod
    def strip_tag(cls, value: object) -> object:
        return _strip_required_string(value)

    @field_validator("notes", mode="before")
    @classmethod
    def strip_notes(cls, value: object) -> object:
        return _strip_optional_string(value)


class HeatPumpIndoorUnitRow(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(pattern=rf"^hpiu_{ULID_SUFFIX_PATTERN}$")
    tag: str = Field(min_length=1, max_length=80)
    indoor_equip_id: str = Field(pattern=rf"^hpie_{ULID_SUFFIX_PATTERN}$")
    outdoor_unit_id: str | None = Field(default=None, pattern=rf"^hpou_{ULID_SUFFIX_PATTERN}$")
    linked_erv_unit_id: str | None = Field(default=None, pattern=r"^vent_[A-Za-z0-9_-]+$")
    served_room_ids: list[str] = Field(default_factory=list)
    floor_level: OptionId | None = None
    area_served: str | None = Field(default=None, max_length=400)
    datasheet_asset_ids: list[str] = Field(default_factory=list)
    notes: str | None = Field(default=None, max_length=4000)

    @field_validator("tag", mode="before")
    @classmethod
    def strip_tag(cls, value: object) -> object:
        return _strip_required_string(value)

    @field_validator("area_served", "notes", mode="before")
    @classmethod
    def strip_optional_strings(cls, value: object) -> object:
        return _strip_optional_string(value)


class HeatPumpsTableSlice(BaseModel):
    model_config = ConfigDict(extra="forbid")

    outdoor_equip: list[HeatPumpOutdoorEquipRow] = Field(default_factory=list)
    indoor_equip: list[HeatPumpIndoorEquipRow] = Field(default_factory=list)
    outdoor_units: list[HeatPumpOutdoorUnitRow] = Field(default_factory=list)
    indoor_units: list[HeatPumpIndoorUnitRow] = Field(default_factory=list)

"""Canonical ProjectDocumentV1 schema and table row contracts."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from features.projects.models import CertificationProgram

ROOM_FLOOR_LEVEL_OPTION_KEY = "rooms.floor_level"
ROOM_BUILDING_ZONE_OPTION_KEY = "rooms.building_zone"
RoomOptionKey = Literal["rooms.floor_level", "rooms.building_zone"]
ROOM_OPTION_KEYS: tuple[RoomOptionKey, ...] = (
    ROOM_FLOOR_LEVEL_OPTION_KEY,
    ROOM_BUILDING_ZONE_OPTION_KEY,
)
CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION = 1


class EmptyEquipmentTables(BaseModel):
    model_config = ConfigDict(extra="forbid")

    fans: list[dict[str, object]] = Field(default_factory=list)
    pumps: list[dict[str, object]] = Field(default_factory=list)
    ervs: list[dict[str, object]] = Field(default_factory=list)


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
    model_config = ConfigDict(extra="forbid")

    id: str = Field(pattern=r"^rm_[A-Za-z0-9_-]+$", max_length=80)
    number: str = Field(min_length=1, max_length=80)
    name: str = Field(min_length=1, max_length=200)
    floor_level: str = Field(pattern=r"^opt_[A-Za-z0-9_-]+$", max_length=80)
    building_zone: str | None = Field(default=None, pattern=r"^opt_[A-Za-z0-9_-]+$", max_length=80)
    num_people: int = Field(default=0, ge=0)
    num_bedrooms: int = Field(default=0, ge=0)
    icfa_factor: float = Field(default=1.0, ge=0.0, le=1.0)
    erv_unit_ids: list[str] = Field(default_factory=list)
    catalog_origin: dict[str, object] | None = None
    notes: str | None = Field(default=None, max_length=4000)

    @field_validator("number", "name", mode="before")
    @classmethod
    def strip_required_strings(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip()
        return value

    @field_validator("notes", mode="before")
    @classmethod
    def strip_optional_notes(cls, value: object) -> object:
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value


class ProjectDocumentProject(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str
    bt_number: str
    cert_programs: list[CertificationProgram] = Field(default_factory=list)
    phius_number: str | None = None
    phius_dropbox_url: str | None = None


class ProjectDocumentTables(BaseModel):
    model_config = ConfigDict(extra="forbid")

    assemblies: list[dict[str, object]] = Field(default_factory=list)
    project_materials: list[dict[str, object]] = Field(default_factory=list)
    window_types: list[dict[str, object]] = Field(default_factory=list)
    rooms: list[RoomRow] = Field(default_factory=list)
    thermal_bridges: list[dict[str, object]] = Field(default_factory=list)
    equipment: EmptyEquipmentTables = Field(default_factory=EmptyEquipmentTables)
    manufacturer_filters: list[dict[str, object]] = Field(default_factory=list)


class ProjectDocumentV1(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schema_version: Literal[1] = CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION
    project: ProjectDocumentProject
    tables: ProjectDocumentTables = Field(default_factory=ProjectDocumentTables)
    single_select_options: dict[str, list[SingleSelectOption]] = Field(
        default_factory=lambda: {ROOM_FLOOR_LEVEL_OPTION_KEY: [], ROOM_BUILDING_ZONE_OPTION_KEY: []}
    )

    @model_validator(mode="after")
    def validate_document_references(self) -> ProjectDocumentV1:
        for key in ROOM_OPTION_KEYS:
            self.single_select_options.setdefault(key, [])

        for key, options in self.single_select_options.items():
            option_ids: set[str] = set()
            labels: set[str] = set()
            for option in options:
                if option.id in option_ids:
                    raise ValueError(f"Duplicate option id in {key}: {option.id}")
                option_ids.add(option.id)
                normalized_label = option.label.strip().casefold()
                if normalized_label in labels:
                    raise ValueError(f"Duplicate option label in {key}: {option.label}")
                labels.add(normalized_label)

        room_ids: set[str] = set()
        room_numbers: set[str] = set()
        floor_option_ids = {option.id for option in self.single_select_options[ROOM_FLOOR_LEVEL_OPTION_KEY]}
        zone_option_ids = {option.id for option in self.single_select_options[ROOM_BUILDING_ZONE_OPTION_KEY]}
        for room in self.tables.rooms:
            if room.id in room_ids:
                raise ValueError(f"Duplicate room id: {room.id}")
            room_ids.add(room.id)

            normalized_number = room.number.strip().casefold()
            if normalized_number in room_numbers:
                raise ValueError(f"Duplicate room number: {room.number}")
            room_numbers.add(normalized_number)

            if room.floor_level not in floor_option_ids:
                raise ValueError(f"Missing floor-level option for room {room.id}: {room.floor_level}")
            if room.building_zone is not None and room.building_zone not in zone_option_ids:
                raise ValueError(f"Missing building-zone option for room {room.id}: {room.building_zone}")
            if room.erv_unit_ids:
                raise ValueError(f"Room ERV assignments are deferred until the ERV table is available: {room.id}")

        return self

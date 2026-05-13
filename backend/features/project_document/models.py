"""Pydantic contracts for project-document draft slices."""

from __future__ import annotations

from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from features.project_document.document import (
    ROOM_BUILDING_ZONE_OPTION_KEY,
    ROOM_FLOOR_LEVEL_OPTION_KEY,
    ProjectDocumentV1,
    RoomOptionKey,
    RoomRow,
    SingleSelectOption,
)

RoomsSliceSource = Literal["version", "draft"]


class RoomsSliceReplaceRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    rooms: list[RoomRow]
    single_select_options: RoomsSliceOptions


class RoomsSliceOptions(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    rooms_floor_level: list[SingleSelectOption] = Field(alias=ROOM_FLOOR_LEVEL_OPTION_KEY)
    rooms_building_zone: list[SingleSelectOption] = Field(alias=ROOM_BUILDING_ZONE_OPTION_KEY)

    def by_option_key(self) -> dict[RoomOptionKey, list[SingleSelectOption]]:
        return {
            ROOM_FLOOR_LEVEL_OPTION_KEY: self.rooms_floor_level,
            ROOM_BUILDING_ZONE_OPTION_KEY: self.rooms_building_zone,
        }


class RoomsSliceResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    project_id: UUID
    version_id: UUID
    source: RoomsSliceSource
    version_etag: str
    draft_etag: str | None
    rooms: list[RoomRow]
    single_select_options: dict[RoomOptionKey, list[SingleSelectOption]]


class ProjectDocumentView(BaseModel):
    model_config = ConfigDict(extra="forbid")

    project_id: UUID
    version_id: UUID
    source: RoomsSliceSource
    version_etag: str
    draft_etag: str | None
    body: ProjectDocumentV1

"""Rooms table contract for the project document registry."""

from __future__ import annotations

from typing import cast
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from features.project_document.document import (
    ROOM_BUILDING_ZONE_OPTION_KEY,
    ROOM_FLOOR_LEVEL_OPTION_KEY,
    ROOM_OPTION_KEYS,
    ProjectDocumentV1,
    RoomOptionKey,
    RoomRow,
    SingleSelectOption,
)
from features.project_document.models import ProjectDocumentSource
from features.project_document.tables.contracts import TableContract
from features.project_document.validation import validate_document

ROOMS_TABLE_NAME = "rooms"


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
    source: ProjectDocumentSource
    version_etag: str
    draft_etag: str | None
    rooms: list[RoomRow]
    single_select_options: dict[RoomOptionKey, list[SingleSelectOption]]


def apply_rooms_replace(body: ProjectDocumentV1, payload: BaseModel) -> ProjectDocumentV1:
    rooms_payload = cast(RoomsSliceReplaceRequest, payload)
    room_options = rooms_payload.single_select_options.by_option_key()
    if body.tables.rooms == rooms_payload.rooms and all(
        body.single_select_options.get(key, []) == room_options[key] for key in ROOM_OPTION_KEYS
    ):
        return body

    options = dict(body.single_select_options)
    for key in ROOM_OPTION_KEYS:
        options[key] = room_options[key]
    next_tables = body.tables.model_copy(update={"rooms": rooms_payload.rooms})
    next_body = body.model_copy(update={"tables": next_tables, "single_select_options": options})
    return validate_document(next_body.model_dump(mode="json"))


def rooms_response(
    project_id: UUID,
    version_id: UUID,
    source: ProjectDocumentSource,
    version_etag: str,
    draft_etag: str | None,
    body: ProjectDocumentV1,
) -> RoomsSliceResponse:
    return RoomsSliceResponse(
        project_id=project_id,
        version_id=version_id,
        source=source,
        version_etag=version_etag,
        draft_etag=draft_etag,
        rooms=body.tables.rooms,
        single_select_options={key: body.single_select_options.get(key, []) for key in ROOM_OPTION_KEYS},
    )


def extract_room_rows(body: ProjectDocumentV1) -> list[object]:
    return [room.model_dump(mode="json") for room in body.tables.rooms]


def extract_rooms_diff_value(body: ProjectDocumentV1) -> dict[str, object]:
    return {
        "rooms": extract_room_rows(body),
        "single_select_options": {
            key: [option.model_dump(mode="json") for option in body.single_select_options.get(key, [])]
            for key in ROOM_OPTION_KEYS
        },
    }


rooms_contract = TableContract(
    name=ROOMS_TABLE_NAME,
    schema_slug="room",
    schema_model=RoomRow,
    replace_request_model=RoomsSliceReplaceRequest,
    build_response=rooms_response,
    apply_replace=apply_rooms_replace,
    extract_rows=extract_room_rows,
    extract_diff_value=extract_rooms_diff_value,
)

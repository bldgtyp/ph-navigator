"""Rooms table contract for the project document registry."""

from __future__ import annotations

from typing import TYPE_CHECKING, cast
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from features.project_document.custom_fields import CustomFieldDef, CustomValue
from features.project_document.document import (
    ROOM_BUILDING_ZONE_OPTION_KEY,
    ROOM_FLOOR_LEVEL_OPTION_KEY,
    ROOM_OPTION_KEYS,
    ROOMS_CORE_DISPLAY_NAMES,
    ProjectDocumentV1,
    RoomOptionKey,
    RoomRow,
    RoomsTableEnvelope,
    SingleSelectOption,
)
from features.project_document.models import ProjectDocumentSource
from features.project_document.tables._fingerprint import compute_table_schema_fingerprint
from features.project_document.tables.contracts import CustomFieldCapability, TableContract
from features.project_document.validation import validate_document

if TYPE_CHECKING:
    # schema_mutations imports CustomFieldCapability from contracts at
    # module load; the apply/validate hooks here lazy-import to avoid
    # the cycle at module init time.
    from features.project_document.schema_mutations import FieldSchemaMutation

# Mirrors `RoomRow` attribute order — consumed by the schema fingerprint
# and the formula-ref / schema-editor registry.
ROOMS_CORE_FIELD_KEYS: tuple[str, ...] = (
    "id",
    "number",
    "name",
    "floor_level",
    "building_zone",
    "num_people",
    "num_bedrooms",
    "icfa_factor",
    "erv_unit_ids",
    "catalog_origin",
    "notes",
)

ROOMS_TABLE_NAME = "rooms"


class RoomsSliceReplaceRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    rooms: list[RoomRow]
    single_select_options: RoomsSliceOptions
    # Whole-table replace accepts the `custom_fields` envelope verbatim;
    # schema-mutation writes use the typed `FieldSchemaMutation` surface.
    custom_fields: list[CustomFieldDef] = Field(default_factory=list)


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
    custom_fields: list[CustomFieldDef]
    single_select_options: dict[RoomOptionKey, list[SingleSelectOption]]


def apply_rooms_replace(body: ProjectDocumentV1, payload: BaseModel) -> ProjectDocumentV1:
    rooms_payload = cast(RoomsSliceReplaceRequest, payload)
    room_options = rooms_payload.single_select_options.by_option_key()
    if (
        body.tables.rooms.rows == rooms_payload.rooms
        and body.tables.rooms.custom_fields == rooms_payload.custom_fields
        and all(body.single_select_options.get(key, []) == room_options[key] for key in ROOM_OPTION_KEYS)
    ):
        return body

    options = dict(body.single_select_options)
    for key in ROOM_OPTION_KEYS:
        options[key] = room_options[key]
    next_envelope = RoomsTableEnvelope(
        custom_fields=rooms_payload.custom_fields,
        rows=rooms_payload.rooms,
    )
    next_tables = body.tables.model_copy(update={"rooms": next_envelope})
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
        rooms=body.tables.rooms.rows,
        custom_fields=body.tables.rooms.custom_fields,
        single_select_options={key: body.single_select_options.get(key, []) for key in ROOM_OPTION_KEYS},
    )


def extract_rooms_envelope(body: ProjectDocumentV1) -> dict[str, object]:
    """Return the Rooms table envelope as a JSON-serializable dict.

    Downloads / MCP `get_table` / diff inputs consume the
    `{custom_fields, rows}` shape; MCP's `McpTableEnvelope.rows` is
    typed `object` to accept this envelope alongside the bare row lists
    used by tables that don't opt into custom fields.
    """
    return {
        "custom_fields": [field.model_dump(mode="json") for field in body.tables.rooms.custom_fields],
        "rows": [room.model_dump(mode="json") for room in body.tables.rooms.rows],
    }


def extract_rooms_diff_value(body: ProjectDocumentV1) -> dict[str, object]:
    return {
        "rooms": extract_rooms_envelope(body),
        "single_select_options": {
            key: [option.model_dump(mode="json") for option in body.single_select_options.get(key, [])]
            for key in ROOM_OPTION_KEYS
        },
    }


def _read_rooms_custom_fields(body: ProjectDocumentV1) -> list[CustomFieldDef]:
    return list(body.tables.rooms.custom_fields)


def _replace_rooms_custom_fields(
    body: ProjectDocumentV1,
    custom_fields: list[CustomFieldDef],
) -> ProjectDocumentV1:
    # No validate_document here — apply_schema_mutation runs a single
    # final validation pass over the fully-mutated body.
    next_envelope = body.tables.rooms.model_copy(update={"custom_fields": list(custom_fields)})
    next_tables = body.tables.model_copy(update={"rooms": next_envelope})
    return body.model_copy(update={"tables": next_tables})


def _read_room_row_custom(row: object) -> dict[str, CustomValue]:
    if not isinstance(row, RoomRow):
        raise TypeError(f"expected RoomRow, got {type(row).__name__}")
    # Return the live dict (read-only contract). Callers must not mutate it —
    # construct a new dict and pass it to `set_row_custom` instead.
    return row.custom


def _set_room_row_custom(row: object, custom: dict[str, CustomValue]) -> object:
    if not isinstance(row, RoomRow):
        raise TypeError(f"expected RoomRow, got {type(row).__name__}")
    return row.model_copy(update={"custom": dict(custom)})


def _compute_rooms_schema_fingerprint(body: ProjectDocumentV1) -> str:
    return compute_table_schema_fingerprint(
        ROOMS_CORE_FIELD_KEYS,
        body.tables.rooms.custom_fields,
    )


def _apply_rooms_schema_mutation(
    body: ProjectDocumentV1,
    mutation: FieldSchemaMutation,
    actor_user_id: str,
) -> tuple[ProjectDocumentV1, dict[str, object]]:
    # Lazy import — see the `TYPE_CHECKING` block above for why.
    from features.project_document.schema_mutations import apply_schema_mutation

    return apply_schema_mutation(
        body,
        mutation,
        actor_user_id=actor_user_id,
        capability=rooms_custom_fields,
    )


def _validate_rooms_schema_mutation(
    body: ProjectDocumentV1,
    mutation: FieldSchemaMutation,
) -> None:
    # Lazy import — see the `TYPE_CHECKING` block above for why.
    from features.project_document.schema_mutations import validate_schema_mutation

    validate_schema_mutation(
        body,
        mutation,
        capability=rooms_custom_fields,
    )


rooms_custom_fields = CustomFieldCapability(
    core_field_keys=ROOMS_CORE_FIELD_KEYS,
    core_display_names=ROOMS_CORE_DISPLAY_NAMES,
    option_list_namespace_prefix="rooms",
    read_custom_fields=_read_rooms_custom_fields,
    replace_custom_fields=_replace_rooms_custom_fields,
    read_row_custom=_read_room_row_custom,
    set_row_custom=_set_room_row_custom,
    compute_schema_fingerprint=_compute_rooms_schema_fingerprint,
    apply_schema_mutation=_apply_rooms_schema_mutation,
    validate_schema_mutation=_validate_rooms_schema_mutation,
)


rooms_contract = TableContract(
    name=ROOMS_TABLE_NAME,
    schema_slug="room",
    schema_model=RoomRow,
    replace_request_model=RoomsSliceReplaceRequest,
    build_response=rooms_response,
    apply_replace=apply_rooms_replace,
    extract_rows=extract_rooms_envelope,
    extract_diff_value=extract_rooms_diff_value,
    table_path=(ROOMS_TABLE_NAME,),
    custom_fields=rooms_custom_fields,
)

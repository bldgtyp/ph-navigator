"""Rooms table contract for the project document registry."""

from __future__ import annotations

from typing import TYPE_CHECKING, Literal, cast
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

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
from features.project_document.options import (
    option_list_key,
    read_option_list,
    replace_option_list,
)
from features.project_document.tables._fingerprint import compute_table_schema_fingerprint
from features.project_document.tables.contracts import (
    CustomFieldCapability,
    TableContract,
    default_attach_computed_overlay,
)
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
    # `extra="allow"` to admit namespaced custom single-select keys
    # (`rooms.cf_*`). The model_validator below coerces those extras to
    # `list[SingleSelectOption]` and rejects any other key — keeps the
    # forbid-by-default discipline while letting custom option lists
    # round-trip through cell / row / option whole-table replace.
    model_config = ConfigDict(extra="allow", populate_by_name=True)

    rooms_floor_level: list[SingleSelectOption] = Field(alias=ROOM_FLOOR_LEVEL_OPTION_KEY)
    rooms_building_zone: list[SingleSelectOption] = Field(alias=ROOM_BUILDING_ZONE_OPTION_KEY)

    @model_validator(mode="after")
    def _validate_namespaced_extras(self) -> RoomsSliceOptions:
        extras = self.__pydantic_extra__ or {}
        coerced: dict[str, list[SingleSelectOption]] = {}
        for key, raw_value in extras.items():
            if not key.startswith(f"{ROOMS_TABLE_NAME}.cf_"):
                raise ValueError(
                    f"Unsupported option key in rooms slice payload: {key!r} "
                    "(only the two core keys and `rooms.cf_*` are accepted)"
                )
            if not isinstance(raw_value, list):
                raise ValueError(f"Option list for {key!r} must be a list")
            coerced[key] = [SingleSelectOption.model_validate(option) for option in raw_value]
        if coerced:
            self.__pydantic_extra__ = coerced
        return self

    def by_option_key(self) -> dict[RoomOptionKey, list[SingleSelectOption]]:
        return {
            ROOM_FLOOR_LEVEL_OPTION_KEY: self.rooms_floor_level,
            ROOM_BUILDING_ZONE_OPTION_KEY: self.rooms_building_zone,
        }

    def custom_option_lists(self) -> dict[str, list[SingleSelectOption]]:
        """Return the `rooms.cf_*` option lists from the payload, if any."""
        return dict(self.__pydantic_extra__ or {})


class RoomsSliceResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    project_id: UUID
    version_id: UUID
    source: ProjectDocumentSource
    version_etag: str
    draft_etag: str | None
    rooms: list[RoomRow]
    custom_fields: list[CustomFieldDef]
    # String-keyed so `rooms.<cf_id>` custom option lists ride alongside
    # the two core option keys in one response envelope.
    single_select_options: dict[str, list[SingleSelectOption]]
    # Plan-17 P4.4 computed read overlay: `{row_id: {cf_id: value}}`
    # for every formula custom field. Always present; empty per-row
    # dict when no formula fields exist.
    rows_computed: dict[str, dict[str, object]] = Field(default_factory=dict)


def apply_rooms_replace(body: ProjectDocumentV1, payload: BaseModel) -> ProjectDocumentV1:
    rooms_payload = cast(RoomsSliceReplaceRequest, payload)
    room_options = rooms_payload.single_select_options.by_option_key()
    custom_option_lists = rooms_payload.single_select_options.custom_option_lists()
    if (
        body.tables.rooms.rows == rooms_payload.rooms
        and body.tables.rooms.custom_fields == rooms_payload.custom_fields
        and all(body.single_select_options.get(key, []) == room_options[key] for key in ROOM_OPTION_KEYS)
        and all(
            body.single_select_options.get(key, []) == value
            for key, value in custom_option_lists.items()
        )
    ):
        return body

    options = dict(body.single_select_options)
    for key in ROOM_OPTION_KEYS:
        options[key] = room_options[key]
    # Overwrite each `rooms.cf_*` key the payload carries. Custom option
    # lists not mentioned in the payload are preserved from `body` —
    # schema-mutation endpoints remain the authoritative path for
    # creating / deleting them.
    for key, value in custom_option_lists.items():
        options[key] = value
    next_envelope = RoomsTableEnvelope(
        custom_fields=rooms_payload.custom_fields,
        rows=rooms_payload.rooms,
    )
    next_tables = body.tables.model_copy(update={"rooms": next_envelope})
    next_body = body.model_copy(update={"tables": next_tables, "single_select_options": options})
    return validate_document(next_body.model_dump(mode="json"))


def _rooms_single_select_options(body: ProjectDocumentV1) -> dict[str, list[SingleSelectOption]]:
    """Return all `rooms.*` option lists — core keys plus custom `rooms.cf_*`."""
    custom_keys = {f"rooms.{field.id}" for field in body.tables.rooms.custom_fields}
    out: dict[str, list[SingleSelectOption]] = {key: [] for key in ROOM_OPTION_KEYS}
    for key, value in body.single_select_options.items():
        if key in ROOM_OPTION_KEYS or key in custom_keys:
            out[key] = list(value)
    return out


def rooms_response(
    project_id: UUID,
    version_id: UUID,
    source: ProjectDocumentSource,
    version_etag: str,
    draft_etag: str | None,
    body: ProjectDocumentV1,
) -> RoomsSliceResponse:
    # Lazy-import to avoid a Rooms→formula→Rooms circular at module
    # load time.
    from features.project_document.formula import evaluate_table_formulas

    rows_computed = evaluate_table_formulas(rooms_custom_fields, body)
    return RoomsSliceResponse(
        project_id=project_id,
        version_id=version_id,
        source=source,
        version_etag=version_etag,
        draft_etag=draft_etag,
        rooms=body.tables.rooms.rows,
        custom_fields=body.tables.rooms.custom_fields,
        single_select_options=_rooms_single_select_options(body),
        rows_computed=rows_computed,
    )


def extract_rooms_envelope(body: ProjectDocumentV1) -> dict[str, object]:
    """Return the Rooms table envelope as a JSON-serializable dict.

    Downloads / MCP `get_table` / diff inputs consume the
    `{custom_fields, rows}` shape; MCP's `McpTableEnvelope.rows` is
    typed `object` to accept this envelope alongside the bare row lists
    used by tables that don't opt into custom fields.

    Phase 4 P4.4: every row carries a `computed` overlay (`{}` when
    no formula fields exist) holding evaluated formula values.
    """
    from features.project_document.formula import evaluate_table_formulas

    overlay = evaluate_table_formulas(rooms_custom_fields, body)
    row_dicts = [room.model_dump(mode="json") for room in body.tables.rooms.rows]
    rows_with_overlay = rooms_custom_fields.attach_computed_overlay(row_dicts, overlay)
    return {
        "custom_fields": [field.model_dump(mode="json") for field in body.tables.rooms.custom_fields],
        "rows": rows_with_overlay,
    }


def extract_rooms_diff_value(body: ProjectDocumentV1) -> dict[str, object]:
    options = _rooms_single_select_options(body)
    return {
        "rooms": extract_rooms_envelope(body),
        "single_select_options": {
            key: [option.model_dump(mode="json") for option in values] for key, values in options.items()
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


_ROOMS_TABLE_PATH: tuple[str, ...] = (ROOMS_TABLE_NAME,)


# Maps core single-select field id (python attribute on RoomRow) to the
# namespaced option-list key. EditOptionsMutation dispatches by
# `field_id` for both core and custom single-selects.
ROOMS_CORE_OPTION_KEY_BY_FIELD_ID: dict[str, str] = {
    "floor_level": ROOM_FLOOR_LEVEL_OPTION_KEY,
    "building_zone": ROOM_BUILDING_ZONE_OPTION_KEY,
}

# Required core single-selects reject deletes-to-clear; the apply path
# must require an explicit replacement option id.
ROOMS_REQUIRED_CORE_SELECT_FIELDS: frozenset[str] = frozenset({"floor_level"})


def _read_rooms_field_option_list(body: ProjectDocumentV1, field_id: str) -> list[SingleSelectOption]:
    """Read a custom single-select field's option list under the Rooms namespace."""
    return read_option_list(body, option_list_key(_ROOMS_TABLE_PATH, field_id))


def _replace_rooms_field_option_list(
    body: ProjectDocumentV1,
    field_id: str,
    options: list[SingleSelectOption],
) -> ProjectDocumentV1:
    return replace_option_list(body, option_list_key(_ROOMS_TABLE_PATH, field_id), options)


def _read_rooms_core_option_value(row: object, field_id: str) -> str | None:
    if not isinstance(row, RoomRow):
        raise TypeError(f"expected RoomRow, got {type(row).__name__}")
    if field_id == "floor_level":
        return row.floor_level
    if field_id == "building_zone":
        return row.building_zone
    raise ValueError(f"unknown core single-select field: {field_id}")


# Formula-facing types for each core Rooms field. The registry uses
# this to type-check formula refs against core fields. List-valued or
# struct-valued cores (`erv_unit_ids`, `catalog_origin`) return None;
# the parser still accepts a `{ERVs}` ref but the evaluator will treat
# the value as opaque ("text") for now.
_MISSING = object()  # sentinel for the assertion below


RoomFormulaType = Literal["text", "number", "single_select", "bool"]
ROOMS_CORE_FORMULA_TYPES: dict[str, RoomFormulaType] = {
    "id": "text",
    "number": "text",
    "name": "text",
    "floor_level": "single_select",
    "building_zone": "single_select",
    "num_people": "number",
    "num_bedrooms": "number",
    "icfa_factor": "number",
    "erv_unit_ids": "text",
    "catalog_origin": "text",
    "notes": "text",
}


_missing_formula_type_keys = [
    key for key in ROOMS_CORE_FIELD_KEYS if ROOMS_CORE_FORMULA_TYPES.get(key, _MISSING) is _MISSING
]
if _missing_formula_type_keys:
    raise RuntimeError(
        f"ROOMS_CORE_FORMULA_TYPES missing entries for: {_missing_formula_type_keys!r}"
    )


def _read_rooms_core_field_for_formula(row: object, field_id: str) -> object | None:
    if not isinstance(row, RoomRow):
        return None
    if field_id not in ROOMS_CORE_FIELD_KEYS:
        return None
    value = getattr(row, field_id, None)
    # Render list-valued cores as a comma-joined string so they have a
    # tractable formula type. Phase 5 may revisit this for richer
    # collection support.
    if isinstance(value, list):
        return ", ".join(str(v) for v in value)
    if value is None:
        return None
    if isinstance(value, (str, int, float, bool)):
        return value
    return str(value)


def _rooms_core_field_type_for_formula(field_id: str) -> RoomFormulaType | None:
    return ROOMS_CORE_FORMULA_TYPES.get(field_id)


def _set_rooms_core_option_value(row: object, field_id: str, value: str | None) -> object:
    if not isinstance(row, RoomRow):
        raise TypeError(f"expected RoomRow, got {type(row).__name__}")
    if field_id == "floor_level":
        if value is None:
            raise ValueError("rooms.floor_level cannot be set to None")
        return row.model_copy(update={"floor_level": value})
    if field_id == "building_zone":
        return row.model_copy(update={"building_zone": value})
    raise ValueError(f"unknown core single-select field: {field_id}")


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
    table_path=_ROOMS_TABLE_PATH,
    read_custom_fields=_read_rooms_custom_fields,
    replace_custom_fields=_replace_rooms_custom_fields,
    read_row_custom=_read_room_row_custom,
    set_row_custom=_set_room_row_custom,
    compute_schema_fingerprint=_compute_rooms_schema_fingerprint,
    apply_schema_mutation=_apply_rooms_schema_mutation,
    validate_schema_mutation=_validate_rooms_schema_mutation,
    read_field_option_list=_read_rooms_field_option_list,
    replace_field_option_list=_replace_rooms_field_option_list,
    core_option_key_by_field_id=ROOMS_CORE_OPTION_KEY_BY_FIELD_ID,
    required_core_select_fields=ROOMS_REQUIRED_CORE_SELECT_FIELDS,
    read_core_option_value=_read_rooms_core_option_value,
    set_core_option_value=_set_rooms_core_option_value,
    core_field_value_for_formula=_read_rooms_core_field_for_formula,
    core_field_type_for_formula=_rooms_core_field_type_for_formula,  # type: ignore[arg-type]
    attach_computed_overlay=default_attach_computed_overlay,
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

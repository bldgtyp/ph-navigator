"""Rooms table contract for the project document registry (v3).

Phase 1b: every field on the Rooms table — built-in or custom —
lives in `rooms.field_defs`. Mutable-type built-in values
(`number`, `name`, `num_people`, `num_bedrooms`) and all custom-field
values live in `RoomRow.custom_values`. Locked-type built-ins
(`floor_level`, `building_zone`, `icfa_factor`) keep typed Pydantic
columns so their domain validators (`opt_*`, `ge=0, le=1.0`) survive.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Literal, cast
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from features.project_document.custom_fields import (
    CustomFieldType,
    CustomValue,
    TableFieldDef,
)
from features.project_document.document import (
    ROOM_BUILDING_ZONE_OPTION_KEY,
    ROOM_FLOOR_LEVEL_OPTION_KEY,
    ROOM_OPTION_KEYS,
    ROOMS_TYPED_COLUMN_FIELD_KEYS,
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
from features.project_document.tables._built_in_seeds import built_in_field_def
from features.project_document.tables._fingerprint import compute_table_schema_fingerprint
from features.project_document.tables.contracts import (
    TableContract,
    TableFieldRegistry,
    default_attach_computed_overlay,
)
from features.project_document.validation import validate_document

if TYPE_CHECKING:
    # schema_mutations imports TableFieldRegistry from contracts at
    # module load; the apply/validate hooks here lazy-import to avoid
    # the cycle at module init time.
    from features.project_document.schema_mutations import FieldSchemaMutation


ROOMS_TABLE_NAME = "rooms"
_ROOMS_TABLE_PATH: tuple[str, ...] = (ROOMS_TABLE_NAME,)


# Feature-author-declared built-in FieldDef seeds for Rooms. New
# projects land this verbatim into `rooms.field_defs` on first save.
# Order is fingerprint-significant (changes invalidate persisted view
# state). Per PRD §P5.1; `record_id` lands in Phase 2.
ROOMS_BUILT_IN_FIELD_DEFS: tuple[TableFieldDef, ...] = (
    built_in_field_def(field_key="number", display_name="Number", field_type=CustomFieldType.short_text, default=""),
    built_in_field_def(field_key="name", display_name="Name", field_type=CustomFieldType.short_text, default=""),
    built_in_field_def(field_key="floor_level", display_name="Floor", field_type=CustomFieldType.single_select),
    built_in_field_def(field_key="building_zone", display_name="Zone", field_type=CustomFieldType.single_select),
    built_in_field_def(field_key="num_people", display_name="People", field_type=CustomFieldType.number, default=0),
    built_in_field_def(field_key="num_bedrooms", display_name="Bedrooms", field_type=CustomFieldType.number, default=0),
    built_in_field_def(field_key="icfa_factor", display_name="iCFA", field_type=CustomFieldType.number, default=1.0),
)

# Canonical built-in field_keys in seed order. Drives the field-key
# registry; mutable-type values live in `custom_values`, locked-type
# values live in typed RoomRow columns.
ROOMS_BUILT_IN_FIELD_KEYS: tuple[str, ...] = tuple(f.field_key for f in ROOMS_BUILT_IN_FIELD_DEFS)


class RoomsSliceOptions(BaseModel):
    # `extra="allow"` to admit namespaced custom single-select keys
    # (`rooms.cf_*`). The model_validator below coerces those extras to
    # `list[SingleSelectOption]` and rejects any other key.
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
                    "(only the two built-in keys and `rooms.cf_*` are accepted)"
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


class RoomsSliceReplaceRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    rooms: list[RoomRow]
    single_select_options: RoomsSliceOptions
    # Whole-table replace accepts the full FieldDef list verbatim
    # (built-in + custom); schema-mutation writes use the typed
    # `FieldSchemaMutation` surface.
    field_defs: list[TableFieldDef] = Field(default_factory=list)


class RoomsSliceResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    project_id: UUID
    version_id: UUID
    source: ProjectDocumentSource
    version_etag: str
    draft_etag: str | None
    rooms: list[RoomRow]
    field_defs: list[TableFieldDef]
    # String-keyed so `rooms.<field_key>` custom option lists ride
    # alongside the two built-in option keys in one response envelope.
    single_select_options: dict[str, list[SingleSelectOption]]
    # Computed read overlay: `{row_id: {field_key: value}}` for every
    # formula field. Always present; empty per-row dict when no formula
    # fields exist.
    rows_computed: dict[str, dict[str, object]] = Field(default_factory=dict)


def apply_rooms_replace(body: ProjectDocumentV1, payload: BaseModel) -> ProjectDocumentV1:
    rooms_payload = cast(RoomsSliceReplaceRequest, payload)
    room_options = rooms_payload.single_select_options.by_option_key()
    custom_option_lists = rooms_payload.single_select_options.custom_option_lists()

    # default_option_id forward fill. For any room in the incoming
    # payload whose `id` did not exist in the previous body, pre-fill
    # `custom_values[field_key]` for every single_select field that
    # carries a `config.default_option_id` AND whose key is absent
    # from that row's bag. Explicit `None` is preserved.
    # Pre-existing rows are never backfilled (forward-only).
    prior_row_ids = {room.id for room in body.tables.rooms.rows}
    defaults_by_field_key: dict[str, str] = {}
    for field in rooms_payload.field_defs:
        if field.field_type.value != "single_select":
            continue
        default_raw = field.config.get("default_option_id")
        if isinstance(default_raw, str) and default_raw:
            defaults_by_field_key[field.field_key] = default_raw

    if defaults_by_field_key:
        filled_rooms: list[RoomRow] = []
        any_filled = False
        for room in rooms_payload.rooms:
            if room.id in prior_row_ids:
                filled_rooms.append(room)
                continue
            missing = {
                key: default
                for key, default in defaults_by_field_key.items()
                if key not in room.custom_values
            }
            if not missing:
                filled_rooms.append(room)
                continue
            any_filled = True
            next_custom_values = dict(room.custom_values)
            next_custom_values.update(missing)
            filled_rooms.append(room.model_copy(update={"custom_values": next_custom_values}))
        if any_filled:
            rooms_payload = rooms_payload.model_copy(update={"rooms": filled_rooms})

    if (
        body.tables.rooms.rows == rooms_payload.rooms
        and body.tables.rooms.field_defs == rooms_payload.field_defs
        and all(body.single_select_options.get(key, []) == room_options[key] for key in ROOM_OPTION_KEYS)
        and all(body.single_select_options.get(key, []) == value for key, value in custom_option_lists.items())
    ):
        return body

    options = dict(body.single_select_options)
    for key in ROOM_OPTION_KEYS:
        options[key] = room_options[key]
    # Overwrite each `rooms.cf_*` key the payload carries. Custom option
    # lists not mentioned in the payload are preserved — schema-mutation
    # endpoints remain the authoritative path for creating / deleting
    # them.
    for key, value in custom_option_lists.items():
        options[key] = value
    next_envelope = RoomsTableEnvelope(
        field_defs=rooms_payload.field_defs,
        rows=rooms_payload.rooms,
    )
    next_tables = body.tables.model_copy(update={"rooms": next_envelope})
    next_body = body.model_copy(update={"tables": next_tables, "single_select_options": options})
    return validate_document(next_body.model_dump(mode="json"))


def _rooms_single_select_options(body: ProjectDocumentV1) -> dict[str, list[SingleSelectOption]]:
    """Return all `rooms.*` option lists — built-in keys plus customs."""
    field_keys_in_use = {f"rooms.{field.field_key}" for field in body.tables.rooms.field_defs}
    out: dict[str, list[SingleSelectOption]] = {key: [] for key in ROOM_OPTION_KEYS}
    for key, value in body.single_select_options.items():
        if key in ROOM_OPTION_KEYS or key in field_keys_in_use:
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

    rows_computed = evaluate_table_formulas(rooms_field_registry, body)
    return RoomsSliceResponse(
        project_id=project_id,
        version_id=version_id,
        source=source,
        version_etag=version_etag,
        draft_etag=draft_etag,
        rooms=body.tables.rooms.rows,
        field_defs=body.tables.rooms.field_defs,
        single_select_options=_rooms_single_select_options(body),
        rows_computed=rows_computed,
    )


def extract_rooms_envelope(body: ProjectDocumentV1) -> dict[str, object]:
    """Return the Rooms table envelope as a JSON-serializable dict."""
    from features.project_document.formula import evaluate_table_formulas

    overlay = evaluate_table_formulas(rooms_field_registry, body)
    row_dicts = [room.model_dump(mode="json") for room in body.tables.rooms.rows]
    rows_with_overlay = rooms_field_registry.attach_computed_overlay(row_dicts, overlay)
    return {
        "field_defs": [field.model_dump(mode="json") for field in body.tables.rooms.field_defs],
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


def _read_rooms_field_defs(body: ProjectDocumentV1) -> list[TableFieldDef]:
    return list(body.tables.rooms.field_defs)


def _replace_rooms_field_defs(
    body: ProjectDocumentV1,
    field_defs: list[TableFieldDef],
) -> ProjectDocumentV1:
    # No validate_document here — apply_schema_mutation runs a single
    # final validation pass over the fully-mutated body.
    next_envelope = body.tables.rooms.model_copy(update={"field_defs": list(field_defs)})
    next_tables = body.tables.model_copy(update={"rooms": next_envelope})
    return body.model_copy(update={"tables": next_tables})


def _read_room_row_custom_values(row: object) -> dict[str, CustomValue]:
    if not isinstance(row, RoomRow):
        raise TypeError(f"expected RoomRow, got {type(row).__name__}")
    return row.custom_values


def _set_room_row_custom_values(row: object, custom_values: dict[str, CustomValue]) -> object:
    if not isinstance(row, RoomRow):
        raise TypeError(f"expected RoomRow, got {type(row).__name__}")
    return row.model_copy(update={"custom_values": dict(custom_values)})


def _compute_rooms_schema_fingerprint(body: ProjectDocumentV1) -> str:
    return compute_table_schema_fingerprint(body.tables.rooms.field_defs)


# Maps locked-type built-in single-select field_keys (the typed Pydantic
# columns on RoomRow) to the namespaced option-list key.
# EditOptionsMutation dispatches by `field_key`.
ROOMS_BUILT_IN_OPTION_KEY_BY_FIELD_KEY: dict[str, str] = {
    "floor_level": ROOM_FLOOR_LEVEL_OPTION_KEY,
    "building_zone": ROOM_BUILDING_ZONE_OPTION_KEY,
}

# Required built-in single-selects reject deletes-to-clear; the apply
# path must require an explicit replacement option id.
ROOMS_REQUIRED_FIELD_KEYS: frozenset[str] = frozenset({"floor_level"})


def _read_rooms_field_option_list(body: ProjectDocumentV1, field_key: str) -> list[SingleSelectOption]:
    """Read a single-select field's option list under the Rooms namespace."""
    return read_option_list(body, option_list_key(_ROOMS_TABLE_PATH, field_key))


def _replace_rooms_field_option_list(
    body: ProjectDocumentV1,
    field_key: str,
    options: list[SingleSelectOption],
) -> ProjectDocumentV1:
    return replace_option_list(body, option_list_key(_ROOMS_TABLE_PATH, field_key), options)


def _read_rooms_built_in_option_value(row: object, field_key: str) -> str | None:
    if not isinstance(row, RoomRow):
        raise TypeError(f"expected RoomRow, got {type(row).__name__}")
    if field_key == "floor_level":
        return row.floor_level
    if field_key == "building_zone":
        return row.building_zone
    raise ValueError(f"unknown built-in single-select field: {field_key}")


def _set_rooms_built_in_option_value(row: object, field_key: str, value: str | None) -> object:
    if not isinstance(row, RoomRow):
        raise TypeError(f"expected RoomRow, got {type(row).__name__}")
    if field_key == "floor_level":
        if value is None:
            raise ValueError("rooms.floor_level cannot be set to None")
        return row.model_copy(update={"floor_level": value})
    if field_key == "building_zone":
        return row.model_copy(update={"building_zone": value})
    raise ValueError(f"unknown built-in single-select field: {field_key}")


# Formula-facing type for locked-type built-in keys (the typed Pydantic
# columns). Mutable-type built-ins resolve their type from the persisted
# FieldDef list at request time.
RoomFormulaType = Literal["text", "number", "single_select", "bool"]
ROOMS_TYPED_COLUMN_FORMULA_TYPES: dict[str, RoomFormulaType] = {
    "id": "text",
    "floor_level": "single_select",
    "building_zone": "single_select",
    "icfa_factor": "number",
    "erv_unit_ids": "text",
    "catalog_origin": "text",
    "notes": "text",
}

# Drift guard: a new typed column on `RoomRow` must declare a formula
# type here too.
assert set(ROOMS_TYPED_COLUMN_FORMULA_TYPES) == ROOMS_TYPED_COLUMN_FIELD_KEYS, (
    "ROOMS_TYPED_COLUMN_FORMULA_TYPES out of sync with ROOMS_TYPED_COLUMN_FIELD_KEYS: "
    f"{set(ROOMS_TYPED_COLUMN_FORMULA_TYPES) ^ ROOMS_TYPED_COLUMN_FIELD_KEYS}"
)


def _read_rooms_field_for_formula(row: object, field_key: str) -> object | None:
    """Read a row's value for `field_key`, whether it lives in a typed
    column or in `custom_values`."""
    if not isinstance(row, RoomRow):
        return None
    if field_key not in ROOMS_TYPED_COLUMN_FIELD_KEYS:
        return row.custom_values.get(field_key)
    value = getattr(row, field_key, None)
    if isinstance(value, list):
        return ", ".join(str(v) for v in value)
    if value is None:
        return None
    if isinstance(value, (str, int, float, bool)):
        return value
    return str(value)


def _rooms_field_type_for_formula(field_key: str) -> RoomFormulaType | None:
    """Return the formula-evaluator-facing type for a Rooms field_key.

    For locked-type built-ins, returns the static type. For mutable-type
    built-ins and customs, returns the type from the persisted FieldDef
    list (resolved by the caller through the registry-driven flow). The
    registry consumer (`build_field_registry` in `formula/resolver.py`)
    walks `body.tables.rooms.field_defs` for non-typed-column entries,
    so this helper covers only the typed-column slice.
    """
    return ROOMS_TYPED_COLUMN_FORMULA_TYPES.get(field_key)


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
        capability=rooms_field_registry,
    )


def _validate_rooms_schema_mutation(
    body: ProjectDocumentV1,
    mutation: FieldSchemaMutation,
) -> None:
    from features.project_document.schema_mutations import validate_schema_mutation

    validate_schema_mutation(
        body,
        mutation,
        capability=rooms_field_registry,
    )


rooms_field_registry = TableFieldRegistry(
    field_keys=ROOMS_BUILT_IN_FIELD_KEYS,
    option_list_namespace_prefix="rooms",
    table_path=_ROOMS_TABLE_PATH,
    read_field_defs=_read_rooms_field_defs,
    replace_field_defs=_replace_rooms_field_defs,
    read_row_custom_values=_read_room_row_custom_values,
    set_row_custom_values=_set_room_row_custom_values,
    compute_schema_fingerprint=_compute_rooms_schema_fingerprint,
    apply_schema_mutation=_apply_rooms_schema_mutation,
    validate_schema_mutation=_validate_rooms_schema_mutation,
    read_field_option_list=_read_rooms_field_option_list,
    replace_field_option_list=_replace_rooms_field_option_list,
    built_in_option_key_by_field_key=ROOMS_BUILT_IN_OPTION_KEY_BY_FIELD_KEY,
    required_field_keys=ROOMS_REQUIRED_FIELD_KEYS,
    read_built_in_option_value=_read_rooms_built_in_option_value,
    set_built_in_option_value=_set_rooms_built_in_option_value,
    field_value_for_formula=_read_rooms_field_for_formula,
    field_type_for_formula=_rooms_field_type_for_formula,  # type: ignore[arg-type]
    attach_computed_overlay=default_attach_computed_overlay,
)


# Back-compat alias for callers still importing `rooms_custom_fields`.
# Remove once every caller has migrated to `rooms_field_registry`.
rooms_custom_fields = rooms_field_registry


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
    field_registry=rooms_field_registry,
)

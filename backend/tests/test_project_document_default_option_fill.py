"""Tests for `default_option_id` row-creation fill (plan-21 P5a.0).

`apply_rooms_replace` is the only place rows enter the document
today (whole-table replace). New rows (ids not in the prior body)
whose `custom.<cf_id>` is *omitted* for a single_select field
carrying `config.default_option_id` get the default pre-filled.
Explicit `None` in the payload is preserved (R5). Pre-existing
rows with `None` are not backfilled when a default is later set
(R6 — forward-only).
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import cast

from features.project_document.custom_fields import (
    CustomFieldDef,
    CustomFieldType,
    CustomValue,
)
from features.project_document.document import (
    ROOM_BUILDING_ZONE_OPTION_KEY,
    ROOM_FLOOR_LEVEL_OPTION_KEY,
    ProjectDocumentProject,
    ProjectDocumentV1,
    RoomRow,
    RoomsTableEnvelope,
    SingleSelectOption,
)
from features.project_document.tables.rooms import (
    RoomsSliceOptions,
    RoomsSliceReplaceRequest,
    apply_rooms_replace,
)


def _body_with_default_field() -> ProjectDocumentV1:
    floor_opt = SingleSelectOption(id="opt_L1", label="L1", color="#aabbcc", order=1.0)
    cf_opts = [
        SingleSelectOption(id="opt_a", label="A", color="#111111", order=1.0),
        SingleSelectOption(id="opt_b", label="B", color="#222222", order=2.0),
    ]
    field = CustomFieldDef(
        id="cf_ss",
        display_name="Status",
        field_type=CustomFieldType.single_select,
        config={"default_option_id": "opt_b"},
        created_at=datetime(2026, 5, 25, 12, 0, tzinfo=UTC),
        created_by=None,
    )
    envelope = RoomsTableEnvelope(custom_fields=[field], rows=[])
    body = ProjectDocumentV1(
        project=ProjectDocumentProject(name="t", bt_number="1", cert_programs=[]),
        single_select_options={
            ROOM_FLOOR_LEVEL_OPTION_KEY: [floor_opt],
            ROOM_BUILDING_ZONE_OPTION_KEY: [],
            "rooms.cf_ss": cf_opts,
        },
    )
    return body.model_copy(update={"tables": body.tables.model_copy(update={"rooms": envelope})})


def _make_room(
    room_id: str,
    number: str,
    floor_level: str,
    custom: dict[str, CustomValue] | None = None,
) -> RoomRow:
    return RoomRow(
        id=room_id,
        number=number,
        name=f"Room {number}",
        floor_level=floor_level,
        building_zone=None,
        num_people=0,
        num_bedrooms=0,
        icfa_factor=1.0,
        erv_unit_ids=[],
        catalog_origin=None,
        notes=None,
        custom=cast(dict[str, str | int | float | bool | None], custom or {}),
    )


def _build_payload(body: ProjectDocumentV1, rooms: list[RoomRow]) -> RoomsSliceReplaceRequest:
    options = RoomsSliceOptions.model_validate(
        {
            ROOM_FLOOR_LEVEL_OPTION_KEY: [
                opt.model_dump() for opt in body.single_select_options[ROOM_FLOOR_LEVEL_OPTION_KEY]
            ],
            ROOM_BUILDING_ZONE_OPTION_KEY: [
                opt.model_dump() for opt in body.single_select_options[ROOM_BUILDING_ZONE_OPTION_KEY]
            ],
            "rooms.cf_ss": [opt.model_dump() for opt in body.single_select_options["rooms.cf_ss"]],
        }
    )
    return RoomsSliceReplaceRequest(
        rooms=rooms,
        single_select_options=options,
        custom_fields=body.tables.rooms.custom_fields,
    )


def test_new_row_omitting_custom_key_gets_default_filled() -> None:
    body = _body_with_default_field()
    new_room = _make_room("rm_new", "101", "opt_L1", custom={})
    payload = _build_payload(body, [new_room])
    next_body = apply_rooms_replace(body, payload)
    assert next_body.tables.rooms.rows[0].custom == {"cf_ss": "opt_b"}


def test_new_row_explicit_null_is_preserved() -> None:
    body = _body_with_default_field()
    new_room = _make_room("rm_new", "101", "opt_L1", custom={"cf_ss": None})
    payload = _build_payload(body, [new_room])
    next_body = apply_rooms_replace(body, payload)
    # Explicit null wins — default does NOT overwrite (R5).
    assert next_body.tables.rooms.rows[0].custom == {"cf_ss": None}


def test_new_row_explicit_value_is_preserved() -> None:
    body = _body_with_default_field()
    new_room = _make_room("rm_new", "101", "opt_L1", custom={"cf_ss": "opt_a"})
    payload = _build_payload(body, [new_room])
    next_body = apply_rooms_replace(body, payload)
    assert next_body.tables.rooms.rows[0].custom == {"cf_ss": "opt_a"}


def test_existing_row_not_backfilled_when_default_now_set() -> None:
    """Pre-existing rows with null custom are not backfilled (R6 — forward-only)."""
    body = _body_with_default_field()
    pre_existing = _make_room("rm_existing", "101", "opt_L1", custom={})
    envelope = body.tables.rooms.model_copy(update={"rows": [pre_existing]})
    body = body.model_copy(update={"tables": body.tables.model_copy(update={"rooms": envelope})})
    # Now apply a replace that contains the same pre-existing row with no
    # change — the default must not be silently injected.
    payload = _build_payload(body, [pre_existing])
    next_body = apply_rooms_replace(body, payload)
    assert next_body.tables.rooms.rows[0].custom == {}


def test_default_fill_skipped_when_no_default_configured() -> None:
    body = _body_with_default_field()
    # Clear the default on the field.
    field = body.tables.rooms.custom_fields[0]
    next_field = field.model_copy(update={"config": {}})
    envelope = body.tables.rooms.model_copy(update={"custom_fields": [next_field]})
    body = body.model_copy(update={"tables": body.tables.model_copy(update={"rooms": envelope})})
    new_room = _make_room("rm_new", "101", "opt_L1", custom={})
    payload = _build_payload(body, [new_room])
    next_body = apply_rooms_replace(body, payload)
    assert next_body.tables.rooms.rows[0].custom == {}

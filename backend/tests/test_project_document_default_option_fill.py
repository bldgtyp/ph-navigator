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

from features.project_document.custom_fields import CustomFieldType, CustomValue, TableFieldDef
from features.project_document.document import (
    ROOM_BUILDING_ZONE_OPTION_KEY,
    ROOM_FLOOR_LEVEL_OPTION_KEY,
    ProjectDocumentProject,
    ProjectDocumentV1,
    RoomRow,
    RoomsTableEnvelope,
    SingleSelectOption,
    SpaceTypesTableEnvelope,
    ThermalBridgesTableEnvelope,
)
from features.project_document.tables.appliances import APPLIANCES_BUILT_IN_FIELD_DEFS
from features.project_document.tables.electric_heaters import ELECTRIC_HEATERS_BUILT_IN_FIELD_DEFS
from features.project_document.tables.fans import FANS_BUILT_IN_FIELD_DEFS
from features.project_document.tables.hot_water_heaters import HOT_WATER_HEATERS_BUILT_IN_FIELD_DEFS
from features.project_document.tables.hot_water_tanks import HOT_WATER_TANKS_BUILT_IN_FIELD_DEFS
from features.project_document.tables.pumps import PUMPS_BUILT_IN_FIELD_DEFS
from features.project_document.tables.rooms import (
    ROOMS_BUILT_IN_FIELD_DEFS,
    RoomsSliceOptions,
    RoomsSliceReplaceRequest,
    apply_rooms_replace,
)
from features.project_document.tables.space_types import SPACE_TYPES_BUILT_IN_FIELD_DEFS
from features.project_document.tables.thermal_bridges import THERMAL_BRIDGES_BUILT_IN_FIELD_DEFS
from features.project_document.tables.ventilators import VENTILATORS_BUILT_IN_FIELD_DEFS
from tests.project_document_helpers import empty_required_tables


def _body_with_default_field() -> ProjectDocumentV1:
    floor_opt = SingleSelectOption(id="opt_L1", label="L1", color="#aabbcc", order=1.0)
    cf_opts = [
        SingleSelectOption(id="opt_a", label="A", color="#111111", order=1.0),
        SingleSelectOption(id="opt_b", label="B", color="#222222", order=2.0),
    ]
    field = TableFieldDef(
        field_key="cf_ss",
        display_name="Status",
        field_type=CustomFieldType.single_select,
        config={"default_option_id": "opt_b"},
        created_at=datetime(2026, 5, 25, 12, 0, tzinfo=UTC),
        created_by=None,
    )
    envelope = RoomsTableEnvelope(field_defs=[*ROOMS_BUILT_IN_FIELD_DEFS, field], rows=[])
    heat_pumps = empty_required_tables()["equipment"]["heat_pumps"]
    return ProjectDocumentV1.model_validate(
        {
            "schema_version": 10,
            "project": ProjectDocumentProject(name="t", bt_number="1", cert_programs=[]).model_dump(mode="json"),
            "tables": {
                "rooms": envelope.model_dump(mode="json"),
                "space_types": SpaceTypesTableEnvelope(
                    field_defs=list(SPACE_TYPES_BUILT_IN_FIELD_DEFS),
                    rows=[],
                ).model_dump(mode="json"),
                "thermal_bridges": ThermalBridgesTableEnvelope(
                    field_defs=list(THERMAL_BRIDGES_BUILT_IN_FIELD_DEFS),
                    rows=[],
                ).model_dump(mode="json"),
                "equipment": {
                    "appliances": {
                        "field_defs": [field.model_dump(mode="json") for field in APPLIANCES_BUILT_IN_FIELD_DEFS],
                        "rows": [],
                    },
                    "pumps": {
                        "field_defs": [field.model_dump(mode="json") for field in PUMPS_BUILT_IN_FIELD_DEFS],
                        "rows": [],
                    },
                    "electric_heaters": {
                        "field_defs": [field.model_dump(mode="json") for field in ELECTRIC_HEATERS_BUILT_IN_FIELD_DEFS],
                        "rows": [],
                    },
                    "ervs": {
                        "field_defs": [field.model_dump(mode="json") for field in VENTILATORS_BUILT_IN_FIELD_DEFS],
                        "rows": [],
                    },
                    "fans": {
                        "field_defs": [field.model_dump(mode="json") for field in FANS_BUILT_IN_FIELD_DEFS],
                        "rows": [],
                    },
                    "hot_water_heaters": {
                        "field_defs": [
                            field.model_dump(mode="json") for field in HOT_WATER_HEATERS_BUILT_IN_FIELD_DEFS
                        ],
                        "rows": [],
                    },
                    "hot_water_tanks": {
                        "field_defs": [field.model_dump(mode="json") for field in HOT_WATER_TANKS_BUILT_IN_FIELD_DEFS],
                        "rows": [],
                    },
                    "heat_pumps": heat_pumps,
                },
            },
            "single_select_options": {
                ROOM_FLOOR_LEVEL_OPTION_KEY: [floor_opt.model_dump(mode="json")],
                ROOM_BUILDING_ZONE_OPTION_KEY: [],
                "pumps.device_type": [],
                "ventilators.inside_outside": [],
                "fans.type": [],
                "hot_water_heaters.type": [],
                "hot_water_tanks.type": [],
                "appliances.type": [],
                "appliances.energy_star": [],
                "rooms.cf_ss": [opt.model_dump(mode="json") for opt in cf_opts],
            },
        }
    )


def _make_room(
    room_id: str,
    number: str,
    floor_level: str,
    custom: dict[str, CustomValue] | None = None,
) -> RoomRow:
    return RoomRow(
        id=room_id,
        floor_level=floor_level,
        building_zone=None,
        icfa_factor=1.0,
        catalog_origin=None,
        notes=None,
        custom_values={
            "number": number,
            "name": f"Room {number}",
            "num_people": 0,
            "num_bedrooms": 0,
            **cast(dict[str, str | int | float | bool | None], custom or {}),
        },
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
        field_defs=body.tables.rooms.field_defs,
    )


def test_new_row_omitting_custom_key_gets_default_filled() -> None:
    body = _body_with_default_field()
    new_room = _make_room("rm_new", "101", "opt_L1", custom={})
    payload = _build_payload(body, [new_room])
    next_body = apply_rooms_replace(body, payload)
    assert next_body.tables.rooms.rows[0].custom_values["cf_ss"] == "opt_b"


def test_new_row_explicit_null_is_preserved() -> None:
    body = _body_with_default_field()
    new_room = _make_room("rm_new", "101", "opt_L1", custom={"cf_ss": None})
    payload = _build_payload(body, [new_room])
    next_body = apply_rooms_replace(body, payload)
    # Explicit null wins — default does NOT overwrite (R5).
    assert next_body.tables.rooms.rows[0].custom_values["cf_ss"] is None


def test_new_row_explicit_value_is_preserved() -> None:
    body = _body_with_default_field()
    new_room = _make_room("rm_new", "101", "opt_L1", custom={"cf_ss": "opt_a"})
    payload = _build_payload(body, [new_room])
    next_body = apply_rooms_replace(body, payload)
    assert next_body.tables.rooms.rows[0].custom_values["cf_ss"] == "opt_a"


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
    assert "cf_ss" not in next_body.tables.rooms.rows[0].custom_values


def test_default_fill_skipped_when_no_default_configured() -> None:
    body = _body_with_default_field()
    # Clear the default on the field.
    target_field = next(field for field in body.tables.rooms.field_defs if field.field_key == "cf_ss")
    next_field = target_field.model_copy(update={"config": {}})
    envelope = body.tables.rooms.model_copy(
        update={
            "field_defs": [
                next_field if existing.field_key == "cf_ss" else existing for existing in body.tables.rooms.field_defs
            ]
        }
    )
    body = body.model_copy(update={"tables": body.tables.model_copy(update={"rooms": envelope})})
    new_room = _make_room("rm_new", "101", "opt_L1", custom={})
    payload = _build_payload(body, [new_room])
    next_body = apply_rooms_replace(body, payload)
    assert "cf_ss" not in next_body.tables.rooms.rows[0].custom_values

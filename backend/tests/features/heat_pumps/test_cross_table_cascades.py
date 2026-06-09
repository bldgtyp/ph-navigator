"""Phase 4 cross-table cascade tests for Heat Pumps ↔ ERVs/Rooms.

Deleting an ERV (Ventilator) must silently null `linked_erv_unit_id`
on every HP indoor unit that pointed at it; deleting a Room must
silently filter its id out of every HP indoor unit's
`served_room_ids[]`. Without these cascades, the document validator
would reject the slice-replace with a dangling-reference ValueError
the moment the user removed the last referencing row.
"""

from __future__ import annotations

from typing import Any
from uuid import uuid4

from features.project_document.document import ProjectDocumentV1, RoomRow
from features.project_document.tables.rooms import (
    ROOM_BUILDING_ZONE_OPTION_KEY,
    ROOM_FLOOR_LEVEL_OPTION_KEY,
    RoomsSliceReplaceRequest,
    apply_rooms_replace,
)
from features.project_document.tables.ventilators import (
    VENTILATOR_INSIDE_OUTSIDE_OPTION_KEY,
    VentilatorsSliceReplaceRequest,
    apply_ventilators_replace,
)
from tests.project_document_helpers import empty_required_tables

HPIE_1 = "hpie_01HX0000000000000000000001"
HPIU_1 = "hpiu_01HX0000000000000000000001"
HPIU_2 = "hpiu_01HX0000000000000000000002"
VENT_KEEP = "vent_kept_01"
VENT_DELETE = "vent_deleted_01"
ROOM_KEEP = "rm_kept_01"
ROOM_DELETE = "rm_deleted_01"
ROOM_OTHER = "rm_other_01"


def _indoor_equip() -> dict[str, Any]:
    return {
        "id": HPIE_1,
        "manufacturer": None,
        "model_type": None,
        "model_number": "PLA-A12EA8",
        "install_type": None,
        "nominal_tons": 1.0,
        "fan_speed_cfm": 425.0,
        "cooling_btuh": 12000.0,
        "heating_btuh_47f": 14000.0,
        "heating_btuh_17f": 10000.0,
        "heating_cop": 3.1,
        "seer": None,
        "eer": None,
        "hspf": None,
        "datasheet_asset_ids": [],
        "notes": None,
        "catalog_origin": None,
    }


def _indoor_unit(unit_id: str, **overrides: object) -> dict[str, Any]:
    row: dict[str, Any] = {
        "id": unit_id,
        "tag": f"AHU-{unit_id[-1]}",
        "indoor_equip_id": HPIE_1,
        "outdoor_unit_id": None,
        "linked_erv_unit_id": None,
        "served_room_ids": [],
        "floor_level": None,
        "area_served": None,
        "datasheet_asset_ids": [],
        "notes": None,
    }
    row.update(overrides)
    return row


def _ventilator(vent_id: str, record_id: str) -> dict[str, Any]:
    return {
        "id": vent_id,
        "inside_outside": "opt_vent_inside",
        "url": None,
        "notes": None,
        "custom_values": {
            "record_id": record_id,
            "name": f"ERV {record_id}",
            "airflow_rate_m3h": 400.0,
            "model": "Q350",
            "manufacturer": "Zehnder",
            "heat_recovery_percent": 80,
            "moisture_recovery_percent": 60,
            "electrical_efficiency_wh_m3": 0.4,
            "filter_merv_rating": 13,
        },
    }


def _room(room_id: str, number: str) -> dict[str, Any]:
    return RoomRow(
        id=room_id,
        floor_level=None,
        building_zone=None,
        icfa_factor=1.0,
        catalog_origin=None,
        notes=None,
        custom_values={
            "number": number,
            "name": f"Room {number}",
            "num_people": 0,
            "num_bedrooms": 0,
        },
    ).model_dump(mode="json")


def _build_body(
    *,
    ventilators: list[dict[str, Any]],
    rooms: list[dict[str, Any]],
    indoor_units: list[dict[str, Any]],
) -> ProjectDocumentV1:
    tables = empty_required_tables()
    tables["equipment"]["ervs"]["rows"] = ventilators
    tables["rooms"]["rows"] = rooms
    tables["equipment"]["heat_pumps"]["indoor_equip"] = [_indoor_equip()]
    tables["equipment"]["heat_pumps"]["indoor_units"] = indoor_units

    inside_outside_options = (
        [
            {"id": "opt_vent_inside", "label": "Inside", "color": "#3b82f6", "order": 0},
            {"id": "opt_vent_outside", "label": "Outside", "color": "#10b981", "order": 1},
        ]
        if ventilators
        else []
    )

    return ProjectDocumentV1.model_validate(
        {
            "schema_version": 5,
            "project": {"name": "p", "bt_number": str(uuid4()), "cert_programs": []},
            "tables": tables,
            "single_select_options": {
                ROOM_FLOOR_LEVEL_OPTION_KEY: [],
                ROOM_BUILDING_ZONE_OPTION_KEY: [],
                "pumps.device_type": [],
                VENTILATOR_INSIDE_OUTSIDE_OPTION_KEY: inside_outside_options,
            },
        }
    )


def _ventilators_payload(body: ProjectDocumentV1, ventilators: list[dict[str, Any]]) -> VentilatorsSliceReplaceRequest:
    # Build via model_validate so dict rows get coerced through
    # `VentilatorRow.model_validate`. Constructing the model directly
    # would refuse `list[dict[str, Any]]` at type-check time.
    return VentilatorsSliceReplaceRequest.model_validate(
        {
            "ventilators": ventilators,
            "single_select_options": {
                VENTILATOR_INSIDE_OUTSIDE_OPTION_KEY: [
                    opt.model_dump() for opt in body.single_select_options[VENTILATOR_INSIDE_OUTSIDE_OPTION_KEY]
                ],
            },
            "field_defs": [field.model_dump(mode="json") for field in body.tables.equipment.ervs.field_defs],
        }
    )


def _rooms_payload(body: ProjectDocumentV1, rooms: list[dict[str, Any]]) -> RoomsSliceReplaceRequest:
    return RoomsSliceReplaceRequest.model_validate(
        {
            "rooms": rooms,
            "single_select_options": {
                ROOM_FLOOR_LEVEL_OPTION_KEY: [
                    opt.model_dump() for opt in body.single_select_options[ROOM_FLOOR_LEVEL_OPTION_KEY]
                ],
                ROOM_BUILDING_ZONE_OPTION_KEY: [
                    opt.model_dump() for opt in body.single_select_options[ROOM_BUILDING_ZONE_OPTION_KEY]
                ],
            },
            "field_defs": [field.model_dump(mode="json") for field in body.tables.rooms.field_defs],
        }
    )


def test_ventilator_delete_nulls_linked_erv_unit_id_on_referencing_hp_indoor_unit() -> None:
    body = _build_body(
        ventilators=[_ventilator(VENT_KEEP, "ERV-1"), _ventilator(VENT_DELETE, "ERV-2")],
        rooms=[],
        indoor_units=[
            _indoor_unit(HPIU_1, linked_erv_unit_id=VENT_DELETE),
            _indoor_unit(HPIU_2, linked_erv_unit_id=VENT_KEEP),
        ],
    )
    payload = _ventilators_payload(body, [_ventilator(VENT_KEEP, "ERV-1")])

    next_body = apply_ventilators_replace(body, payload)

    indoor_units = {row.id: row for row in next_body.tables.equipment.heat_pumps.indoor_units}
    assert indoor_units[HPIU_1].linked_erv_unit_id is None, "deleted ERV must cascade-null"
    assert indoor_units[HPIU_2].linked_erv_unit_id == VENT_KEEP, "untouched ERV must remain linked"
    assert [v.id for v in next_body.tables.equipment.ervs.rows] == [VENT_KEEP]


def test_ventilator_replace_without_deletion_leaves_hp_indoor_unit_alone() -> None:
    body = _build_body(
        ventilators=[_ventilator(VENT_KEEP, "ERV-1")],
        rooms=[],
        indoor_units=[_indoor_unit(HPIU_1, linked_erv_unit_id=VENT_KEEP)],
    )
    renamed = _ventilator(VENT_KEEP, "ERV-1")
    renamed["custom_values"]["name"] = "Apartment ERV (renamed)"
    payload = _ventilators_payload(body, [renamed])

    next_body = apply_ventilators_replace(body, payload)

    assert next_body.tables.equipment.heat_pumps.indoor_units[0].linked_erv_unit_id == VENT_KEEP


def test_room_delete_filters_served_room_ids_on_referencing_hp_indoor_unit() -> None:
    body = _build_body(
        ventilators=[],
        rooms=[_room(ROOM_KEEP, "101"), _room(ROOM_DELETE, "102"), _room(ROOM_OTHER, "103")],
        indoor_units=[
            _indoor_unit(HPIU_1, served_room_ids=[ROOM_KEEP, ROOM_DELETE]),
            _indoor_unit(HPIU_2, served_room_ids=[ROOM_DELETE, ROOM_OTHER]),
        ],
    )
    payload = _rooms_payload(body, [_room(ROOM_KEEP, "101"), _room(ROOM_OTHER, "103")])

    next_body = apply_rooms_replace(body, payload)

    indoor_units = {row.id: row for row in next_body.tables.equipment.heat_pumps.indoor_units}
    assert indoor_units[HPIU_1].served_room_ids == [ROOM_KEEP]
    assert indoor_units[HPIU_2].served_room_ids == [ROOM_OTHER]
    assert {room.id for room in next_body.tables.rooms.rows} == {ROOM_KEEP, ROOM_OTHER}


def test_room_replace_without_deletion_leaves_hp_indoor_unit_alone() -> None:
    body = _build_body(
        ventilators=[],
        rooms=[_room(ROOM_KEEP, "101")],
        indoor_units=[_indoor_unit(HPIU_1, served_room_ids=[ROOM_KEEP])],
    )
    payload = _rooms_payload(body, [_room(ROOM_KEEP, "101")])

    next_body = apply_rooms_replace(body, payload)

    assert next_body.tables.equipment.heat_pumps.indoor_units[0].served_room_ids == [ROOM_KEEP]


def test_simultaneous_ventilator_deletes_cascade_each_referencing_hp_indoor_unit() -> None:
    """Guards against a 'first removed id only' refactor passing the single-row tests."""
    vent_a = "vent_a_01"
    vent_b = "vent_b_01"
    vent_c = "vent_c_01"
    body = _build_body(
        ventilators=[_ventilator(vent_a, "ERV-A"), _ventilator(vent_b, "ERV-B"), _ventilator(vent_c, "ERV-C")],
        rooms=[],
        indoor_units=[
            _indoor_unit(HPIU_1, linked_erv_unit_id=vent_a),
            _indoor_unit(HPIU_2, linked_erv_unit_id=vent_b),
        ],
    )
    # Both A and B removed in one replace; C survives.
    payload = _ventilators_payload(body, [_ventilator(vent_c, "ERV-C")])

    next_body = apply_ventilators_replace(body, payload)

    indoor_units = {row.id: row for row in next_body.tables.equipment.heat_pumps.indoor_units}
    assert indoor_units[HPIU_1].linked_erv_unit_id is None
    assert indoor_units[HPIU_2].linked_erv_unit_id is None


def test_simultaneous_room_deletes_cascade_each_referencing_hp_indoor_unit() -> None:
    """Guards against a 'first removed id only' refactor on the rooms side."""
    rm_a = "rm_a_01"
    rm_b = "rm_b_01"
    rm_c = "rm_c_01"
    body = _build_body(
        ventilators=[],
        rooms=[_room(rm_a, "101"), _room(rm_b, "102"), _room(rm_c, "103")],
        indoor_units=[
            _indoor_unit(HPIU_1, served_room_ids=[rm_a, rm_c]),
            _indoor_unit(HPIU_2, served_room_ids=[rm_b, rm_c]),
        ],
    )
    # Drop both A and B in one replace; C survives.
    payload = _rooms_payload(body, [_room(rm_c, "103")])

    next_body = apply_rooms_replace(body, payload)

    indoor_units = {row.id: row for row in next_body.tables.equipment.heat_pumps.indoor_units}
    assert indoor_units[HPIU_1].served_room_ids == [rm_c]
    assert indoor_units[HPIU_2].served_room_ids == [rm_c]


def test_room_cascade_dedupes_existing_duplicate_served_room_ids() -> None:
    """If upstream data ever leaks duplicate ids into the array, the cascade scrubs them."""
    body = _build_body(
        ventilators=[],
        rooms=[_room(ROOM_KEEP, "101"), _room(ROOM_DELETE, "102"), _room(ROOM_OTHER, "103")],
        # HPIU_1 has duplicate ROOM_KEEP plus a referenced-then-deleted ROOM_DELETE.
        indoor_units=[_indoor_unit(HPIU_1, served_room_ids=[ROOM_KEEP, ROOM_DELETE, ROOM_KEEP, ROOM_OTHER])],
    )
    payload = _rooms_payload(body, [_room(ROOM_KEEP, "101"), _room(ROOM_OTHER, "103")])

    next_body = apply_rooms_replace(body, payload)

    # Survivors are ordered first-seen-wins and de-duplicated.
    assert next_body.tables.equipment.heat_pumps.indoor_units[0].served_room_ids == [ROOM_KEEP, ROOM_OTHER]

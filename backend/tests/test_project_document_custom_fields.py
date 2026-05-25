"""Custom-fields contract + fingerprint tests for plan-14 P1.2."""

from __future__ import annotations

from datetime import UTC, datetime

from features.project_document.custom_fields import CustomFieldDef, CustomFieldType
from features.project_document.document import ProjectDocumentProject, ProjectDocumentV1, RoomsTableEnvelope
from features.project_document.tables import get_table_contract
from features.project_document.tables._fingerprint import compute_table_schema_fingerprint
from features.project_document.tables.rooms import ROOMS_CORE_FIELD_KEYS


def _empty_body() -> ProjectDocumentV1:
    return ProjectDocumentV1(
        project=ProjectDocumentProject(
            name="t",
            bt_number="1",
            cert_programs=[],
        ),
    )


def _make_custom_field(field_id: str, display_name: str = "Notes") -> CustomFieldDef:
    return CustomFieldDef(
        id=field_id,
        display_name=display_name,
        field_type=CustomFieldType.short_text,
        created_at=datetime(2026, 5, 24, 12, 0, tzinfo=UTC),
        created_by=None,
    )


def test_rooms_contract_exposes_custom_field_capability() -> None:
    rooms = get_table_contract("rooms")
    window_types = get_table_contract("window_types")

    assert rooms.custom_fields is not None
    assert rooms.table_path == ("rooms",)
    assert rooms.custom_fields.core_field_keys == ROOMS_CORE_FIELD_KEYS
    assert rooms.custom_fields.option_list_namespace_prefix == "rooms"

    assert window_types.custom_fields is None
    assert window_types.table_path == ("window_types",)


def test_rooms_fingerprint_changes_when_custom_field_added() -> None:
    rooms = get_table_contract("rooms")
    assert rooms.custom_fields is not None

    empty = _empty_body()
    empty_fp = rooms.custom_fields.compute_schema_fingerprint(empty)

    with_field = empty.model_copy(
        update={
            "tables": empty.tables.model_copy(
                update={
                    "rooms": RoomsTableEnvelope(
                        custom_fields=[_make_custom_field("cf_notes")],
                        rows=[],
                    )
                }
            )
        }
    )
    populated_fp = rooms.custom_fields.compute_schema_fingerprint(with_field)

    assert empty_fp != populated_fp


def test_fingerprint_independent_of_display_name_changes() -> None:
    a = compute_table_schema_fingerprint(ROOMS_CORE_FIELD_KEYS, [_make_custom_field("cf_x", "Alpha")])
    b = compute_table_schema_fingerprint(ROOMS_CORE_FIELD_KEYS, [_make_custom_field("cf_x", "Beta")])
    assert a == b


def test_fingerprint_changes_when_field_type_changes() -> None:
    short_field = _make_custom_field("cf_x", "Notes")
    number_field = short_field.model_copy(update={"field_type": CustomFieldType.number})
    a = compute_table_schema_fingerprint(ROOMS_CORE_FIELD_KEYS, [short_field])
    b = compute_table_schema_fingerprint(ROOMS_CORE_FIELD_KEYS, [number_field])
    assert a != b


def test_empty_fingerprint_matches_pinned_parity_digest() -> None:
    """Pin the empty-table digest so the backend + frontend SHA-256
    parity is enforced on both sides. The matching frontend assertion
    lives in `useTableSchema.test.ts`."""
    assert compute_table_schema_fingerprint([], []) == (
        "772b20d9f9c95ebdcfa91c32911c49bb11afca08bf70c61e2838c429cc5873b5"
    )


def test_rooms_capability_replace_round_trips_custom_fields() -> None:
    rooms = get_table_contract("rooms")
    assert rooms.custom_fields is not None
    body = _empty_body()
    next_body = rooms.custom_fields.replace_custom_fields(body, [_make_custom_field("cf_a")])
    assert rooms.custom_fields.read_custom_fields(next_body) == [_make_custom_field("cf_a")]

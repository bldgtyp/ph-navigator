"""Field registry contract + fingerprint tests for plan-14 P1.2."""

from __future__ import annotations

from datetime import UTC, datetime

from features.project_document.custom_fields import CustomFieldType, TableFieldDef
from features.project_document.document import ProjectDocumentV1
from features.project_document.tables import get_table_contract
from features.project_document.tables._fingerprint import compute_table_schema_fingerprint
from features.project_document.tables.rooms import ROOMS_BUILT_IN_FIELD_KEYS, rooms_field_registry
from features.projects.models import CreateProjectRequest
from features.projects.service import empty_project_document


def _empty_body() -> ProjectDocumentV1:
    return empty_project_document(
        CreateProjectRequest(
            name="t",
            bt_number="1",
            cert_programs=[],
        )
    )


def _make_custom_field(field_key: str, display_name: str = "Notes") -> TableFieldDef:
    return TableFieldDef(
        field_key=field_key,
        display_name=display_name,
        field_type=CustomFieldType.short_text,
        created_at=datetime(2026, 5, 24, 12, 0, tzinfo=UTC),
        created_by=None,
    )


def test_rooms_contract_exposes_field_registry() -> None:
    rooms = get_table_contract("rooms")
    window_types = get_table_contract("window_types")

    assert rooms.field_registry is not None
    assert rooms.table_path == ("rooms",)
    assert rooms.field_registry.field_keys == ROOMS_BUILT_IN_FIELD_KEYS
    assert rooms.field_registry.option_list_namespace_prefix == "rooms"

    assert window_types.field_registry is None
    assert window_types.table_path == ("window_types",)


def test_rooms_fingerprint_changes_when_custom_field_added() -> None:
    rooms = get_table_contract("rooms")
    assert rooms.field_registry is not None

    empty = _empty_body()
    empty_fp = rooms.field_registry.compute_schema_fingerprint(empty)

    with_field = rooms.field_registry.replace_field_defs(
        empty,
        [*rooms.field_registry.read_field_defs(empty), _make_custom_field("cf_notes")],
    )
    populated_fp = rooms.field_registry.compute_schema_fingerprint(with_field)

    assert empty_fp != populated_fp


def test_fingerprint_independent_of_display_name_changes() -> None:
    a = compute_table_schema_fingerprint([_make_custom_field("cf_x", "Alpha")])
    b = compute_table_schema_fingerprint([_make_custom_field("cf_x", "Beta")])
    assert a == b


def test_fingerprint_changes_when_field_type_changes() -> None:
    short_field = _make_custom_field("cf_x", "Notes")
    number_field = short_field.model_copy(update={"field_type": CustomFieldType.number})
    a = compute_table_schema_fingerprint([short_field])
    b = compute_table_schema_fingerprint([number_field])
    assert a != b


def test_empty_fingerprint_matches_pinned_parity_digest() -> None:
    """Pin the empty-table digest so the backend + frontend SHA-256
    parity is enforced on both sides. The matching frontend assertion
    lives in `useTableSchema.test.ts`."""
    assert compute_table_schema_fingerprint([]) == "7bb25519cabb2abaf1a6c64ca8ce25f69cd16d656604bfb58509adb79187ce90"


def test_rooms_registry_replace_round_trips_field_defs() -> None:
    body = _empty_body()
    field_defs = [*rooms_field_registry.read_field_defs(body), _make_custom_field("cf_a")]

    next_body = rooms_field_registry.replace_field_defs(body, field_defs)

    assert rooms_field_registry.read_field_defs(next_body) == field_defs

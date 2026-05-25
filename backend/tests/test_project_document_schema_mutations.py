"""Tests for the custom-field schema-mutation service (plan-15 P2.1).

Service-internal coverage: every mutation kind is exercised against
the Rooms capability, every reject branch in the ADR error taxonomy
is asserted, and the full-document re-validation pass is verified
through a monkeypatched validator.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import cast

import pytest
from fastapi import HTTPException

from features.project_document import schema_mutations
from features.project_document.custom_fields import (
    CUSTOM_FIELD_DESCRIPTION_MAX,
    CustomFieldDef,
    CustomFieldType,
)
from features.project_document.document import (
    ROOM_FLOOR_LEVEL_OPTION_KEY,
    ProjectDocumentProject,
    ProjectDocumentV1,
    RoomRow,
    RoomsTableEnvelope,
    SingleSelectOption,
)
from features.project_document.schema_mutations import (
    AddFieldMutation,
    ChangeTypeMutation,
    DeleteFieldMutation,
    DuplicateFieldMutation,
    RenameFieldMutation,
    SetDescriptionMutation,
    SetFormulaMutation,
    apply_schema_mutation,
)
from features.project_document.tables.rooms import rooms_custom_fields

ACTOR = "user_acceptance"


def test_module_imports() -> None:
    """Plan-15 P2.0 smoke kept as a parity check after P2.1's flesh-out."""
    assert schema_mutations.apply_schema_mutation is not None


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


def _empty_body() -> ProjectDocumentV1:
    return ProjectDocumentV1(
        project=ProjectDocumentProject(
            name="t",
            bt_number="1",
            cert_programs=[],
        ),
    )


def _make_custom_field(
    field_id: str,
    display_name: str = "Notes",
    field_type: CustomFieldType = CustomFieldType.short_text,
    description: str | None = None,
) -> CustomFieldDef:
    return CustomFieldDef(
        id=field_id,
        display_name=display_name,
        field_type=field_type,
        description=description,
        created_at=datetime(2026, 5, 24, 12, 0, tzinfo=UTC),
        created_by=None,
    )


def _seed_floor_option(body: ProjectDocumentV1, option_id: str = "opt_L1") -> ProjectDocumentV1:
    next_options = dict(body.single_select_options)
    next_options[ROOM_FLOOR_LEVEL_OPTION_KEY] = [
        SingleSelectOption(id=option_id, label="L1", color="#aabbcc", order=1.0),
    ]
    return body.model_copy(update={"single_select_options": next_options})


def _with_room(
    body: ProjectDocumentV1,
    *,
    room_id: str = "rm_1",
    number: str = "101",
    custom: dict[str, object] | None = None,
) -> ProjectDocumentV1:
    floor_opts = body.single_select_options.get(ROOM_FLOOR_LEVEL_OPTION_KEY, [])
    assert floor_opts, "fixture: seed a floor option before adding a room"
    rooms = list(body.tables.rooms.rows)
    rooms.append(
        RoomRow(
            id=room_id,
            number=number,
            name=f"Room {number}",
            floor_level=floor_opts[0].id,
            building_zone=None,
            num_people=0,
            num_bedrooms=0,
            icfa_factor=1.0,
            erv_unit_ids=[],
            catalog_origin=None,
            notes=None,
            custom=cast(dict[str, str | int | float | bool | None], custom or {}),
        )
    )
    envelope = body.tables.rooms.model_copy(update={"rows": rooms})
    next_tables = body.tables.model_copy(update={"rooms": envelope})
    return body.model_copy(update={"tables": next_tables})


def _with_field(body: ProjectDocumentV1, field: CustomFieldDef) -> ProjectDocumentV1:
    envelope = RoomsTableEnvelope(
        custom_fields=[*body.tables.rooms.custom_fields, field],
        rows=list(body.tables.rooms.rows),
    )
    next_tables = body.tables.model_copy(update={"rooms": envelope})
    return body.model_copy(update={"tables": next_tables})


def _fingerprint(body: ProjectDocumentV1) -> str:
    return rooms_custom_fields.compute_schema_fingerprint(body)


def _apply(body: ProjectDocumentV1, mutation: object) -> tuple[ProjectDocumentV1, dict[str, object]]:
    return apply_schema_mutation(
        body,
        cast(schema_mutations.FieldSchemaMutation, mutation),
        actor_user_id=ACTOR,
        capability=rooms_custom_fields,
    )


# ---------------------------------------------------------------------------
# addField
# ---------------------------------------------------------------------------


def test_add_field_rejects_stale_fingerprint() -> None:
    body = _empty_body()
    mutation = AddFieldMutation(
        kind="addField",
        table_key="rooms",
        after=_make_custom_field("cf_notes"),
        expected_schema_fingerprint="not-the-real-fingerprint",
    )
    with pytest.raises(HTTPException) as excinfo:
        _apply(body, mutation)
    assert excinfo.value.status_code == 409
    detail = cast(dict[str, object], excinfo.value.detail)
    assert detail["error_code"] == "custom_field_stale_schema_fingerprint"
    details = cast(dict[str, object], detail["details"])
    assert details["expected_fingerprint"] == "not-the-real-fingerprint"
    assert details["actual_fingerprint"] == _fingerprint(body)


def test_add_field_rejects_duplicate_display_name_against_custom() -> None:
    body = _with_field(_empty_body(), _make_custom_field("cf_a", display_name="Notes"))
    mutation = AddFieldMutation(
        kind="addField",
        table_key="rooms",
        after=_make_custom_field("cf_b", display_name="  notes  "),
        expected_schema_fingerprint=_fingerprint(body),
    )
    with pytest.raises(HTTPException) as excinfo:
        _apply(body, mutation)
    assert excinfo.value.status_code == 422
    detail = cast(dict[str, object], excinfo.value.detail)
    assert detail["error_code"] == "custom_field_duplicate_name"
    details = cast(dict[str, object], detail["details"])
    assert details["colliding_field_id"] == "cf_a"
    assert details["colliding_field_origin"] == "custom"


def test_add_field_rejects_duplicate_display_name_against_core() -> None:
    body = _empty_body()
    mutation = AddFieldMutation(
        kind="addField",
        table_key="rooms",
        after=_make_custom_field("cf_x", display_name="name"),  # collides with core "Name"
        expected_schema_fingerprint=_fingerprint(body),
    )
    with pytest.raises(HTTPException) as excinfo:
        _apply(body, mutation)
    assert excinfo.value.status_code == 422
    detail = cast(dict[str, object], excinfo.value.detail)
    assert detail["error_code"] == "custom_field_duplicate_name"
    details = cast(dict[str, object], detail["details"])
    assert details["colliding_field_origin"] == "core"


def test_add_field_inserts_after_specified_field() -> None:
    body = _with_field(_empty_body(), _make_custom_field("cf_first", display_name="First"))
    body = _with_field(body, _make_custom_field("cf_third", display_name="Third"))

    mutation = AddFieldMutation(
        kind="addField",
        table_key="rooms",
        after=_make_custom_field("cf_second", display_name="Second"),
        insert_after_field_id="cf_first",
        expected_schema_fingerprint=_fingerprint(body),
    )
    next_body, audit = _apply(body, mutation)
    ids = [field.id for field in next_body.tables.rooms.custom_fields]
    assert ids == ["cf_first", "cf_second", "cf_third"]
    assert audit["kind"] == "addField"
    assert audit["field_id"] == "cf_second"

    # actor_user_id is stamped onto the added field, overwriting the
    # `None` the caller-built CustomFieldDef carried.
    added = next_body.tables.rooms.custom_fields[1]
    assert added.created_by == ACTOR


def test_add_field_appends_when_anchor_omitted() -> None:
    body = _with_field(_empty_body(), _make_custom_field("cf_a", display_name="A"))
    mutation = AddFieldMutation(
        kind="addField",
        table_key="rooms",
        after=_make_custom_field("cf_b", display_name="B"),
        expected_schema_fingerprint=_fingerprint(body),
    )
    next_body, _ = _apply(body, mutation)
    ids = [field.id for field in next_body.tables.rooms.custom_fields]
    assert ids == ["cf_a", "cf_b"]


def test_add_field_rejects_unknown_anchor() -> None:
    body = _empty_body()
    mutation = AddFieldMutation(
        kind="addField",
        table_key="rooms",
        after=_make_custom_field("cf_a", display_name="A"),
        insert_after_field_id="cf_missing",
        expected_schema_fingerprint=_fingerprint(body),
    )
    with pytest.raises(HTTPException) as excinfo:
        _apply(body, mutation)
    assert excinfo.value.status_code == 422
    detail = cast(dict[str, object], excinfo.value.detail)
    assert detail["error_code"] == "custom_field_invalid_field_id"


def test_add_field_rejects_id_collision() -> None:
    body = _with_field(_empty_body(), _make_custom_field("cf_a", display_name="A"))
    mutation = AddFieldMutation(
        kind="addField",
        table_key="rooms",
        after=_make_custom_field("cf_a", display_name="A-prime"),
        expected_schema_fingerprint=_fingerprint(body),
    )
    with pytest.raises(HTTPException) as excinfo:
        _apply(body, mutation)
    assert excinfo.value.status_code == 422
    detail = cast(dict[str, object], excinfo.value.detail)
    assert detail["error_code"] == "custom_field_invalid_field_id"


# ---------------------------------------------------------------------------
# renameField
# ---------------------------------------------------------------------------


def test_rename_field_preserves_cf_id_and_row_values() -> None:
    body = _seed_floor_option(_empty_body())
    body = _with_field(body, _make_custom_field("cf_notes", display_name="Notes"))
    body = _with_room(body, custom={"cf_notes": "needs paint"})

    mutation = RenameFieldMutation(
        kind="renameField",
        table_key="rooms",
        field_id="cf_notes",
        display_name="Punch list",
        expected_schema_fingerprint=_fingerprint(body),
    )
    next_body, audit = _apply(body, mutation)
    field = next_body.tables.rooms.custom_fields[0]
    assert field.id == "cf_notes"
    assert field.display_name == "Punch list"
    assert next_body.tables.rooms.rows[0].custom == {"cf_notes": "needs paint"}
    assert audit["old_display_name"] == "Notes"
    assert audit["new_display_name"] == "Punch list"


def test_rename_field_rejects_duplicate_name() -> None:
    body = _empty_body()
    body = _with_field(body, _make_custom_field("cf_a", display_name="Notes"))
    body = _with_field(body, _make_custom_field("cf_b", display_name="Other"))
    mutation = RenameFieldMutation(
        kind="renameField",
        table_key="rooms",
        field_id="cf_b",
        display_name="notes",  # collides with cf_a (case-insensitive)
        expected_schema_fingerprint=_fingerprint(body),
    )
    with pytest.raises(HTTPException) as excinfo:
        _apply(body, mutation)
    detail = cast(dict[str, object], excinfo.value.detail)
    assert detail["error_code"] == "custom_field_duplicate_name"
    details = cast(dict[str, object], detail["details"])
    assert details["colliding_field_id"] == "cf_a"


def test_rename_field_allows_same_name_on_same_field() -> None:
    """A no-op rename to the existing name must not trip the dup-name
    check (the rename rule excludes the field being renamed)."""
    body = _with_field(_empty_body(), _make_custom_field("cf_a", display_name="Notes"))
    mutation = RenameFieldMutation(
        kind="renameField",
        table_key="rooms",
        field_id="cf_a",
        display_name="Notes",
        expected_schema_fingerprint=_fingerprint(body),
    )
    next_body, _ = _apply(body, mutation)
    assert next_body.tables.rooms.custom_fields[0].display_name == "Notes"


def test_rename_field_rejects_unknown_id() -> None:
    body = _empty_body()
    mutation = RenameFieldMutation(
        kind="renameField",
        table_key="rooms",
        field_id="cf_missing",
        display_name="Anything",
        expected_schema_fingerprint=_fingerprint(body),
    )
    with pytest.raises(HTTPException) as excinfo:
        _apply(body, mutation)
    detail = cast(dict[str, object], excinfo.value.detail)
    assert detail["error_code"] == "custom_field_invalid_field_id"


# ---------------------------------------------------------------------------
# deleteField
# ---------------------------------------------------------------------------


def test_delete_field_strips_row_values() -> None:
    body = _seed_floor_option(_empty_body())
    body = _with_field(body, _make_custom_field("cf_notes", display_name="Notes"))
    body = _with_room(body, room_id="rm_1", number="101", custom={"cf_notes": "v1"})
    body = _with_room(body, room_id="rm_2", number="102", custom={"cf_notes": "v2"})
    body = _with_room(body, room_id="rm_3", number="103", custom={})

    mutation = DeleteFieldMutation(
        kind="deleteField",
        table_key="rooms",
        field_id="cf_notes",
        expected_schema_fingerprint=_fingerprint(body),
    )
    next_body, audit = _apply(body, mutation)
    assert next_body.tables.rooms.custom_fields == []
    assert all(row.custom == {} for row in next_body.tables.rooms.rows)
    assert audit["cleared_row_count"] == 2


def test_delete_field_rejects_unknown_id() -> None:
    body = _empty_body()
    mutation = DeleteFieldMutation(
        kind="deleteField",
        table_key="rooms",
        field_id="cf_missing",
        expected_schema_fingerprint=_fingerprint(body),
    )
    with pytest.raises(HTTPException) as excinfo:
        _apply(body, mutation)
    detail = cast(dict[str, object], excinfo.value.detail)
    assert detail["error_code"] == "custom_field_invalid_field_id"


# ---------------------------------------------------------------------------
# duplicateField
# ---------------------------------------------------------------------------


def test_duplicate_field_creates_independent_def_with_empty_row_values() -> None:
    body = _seed_floor_option(_empty_body())
    body = _with_field(
        body,
        _make_custom_field("cf_src", display_name="Notes", description="Original"),
    )
    body = _with_room(body, custom={"cf_src": "value-on-source"})

    duplicate_after = _make_custom_field(
        "cf_dup",
        display_name="Notes copy",
        description="Original",
    )
    mutation = DuplicateFieldMutation(
        kind="duplicateField",
        table_key="rooms",
        source_field_id="cf_src",
        after=duplicate_after,
        expected_schema_fingerprint=_fingerprint(body),
    )
    next_body, audit = _apply(body, mutation)
    ids = [field.id for field in next_body.tables.rooms.custom_fields]
    assert ids == ["cf_src", "cf_dup"]  # inserted immediately after source
    assert next_body.tables.rooms.custom_fields[1].description == "Original"
    assert next_body.tables.rooms.custom_fields[1].created_by == ACTOR

    # Row values are NOT copied — the destination field starts empty.
    assert next_body.tables.rooms.rows[0].custom == {"cf_src": "value-on-source"}
    assert audit["new_field_id"] == "cf_dup"


def test_duplicate_field_rejects_id_collision_with_source() -> None:
    body = _with_field(_empty_body(), _make_custom_field("cf_src", display_name="Notes"))
    mutation = DuplicateFieldMutation(
        kind="duplicateField",
        table_key="rooms",
        source_field_id="cf_src",
        after=_make_custom_field("cf_src", display_name="Notes copy"),
        expected_schema_fingerprint=_fingerprint(body),
    )
    with pytest.raises(HTTPException) as excinfo:
        _apply(body, mutation)
    detail = cast(dict[str, object], excinfo.value.detail)
    assert detail["error_code"] == "custom_field_invalid_field_id"


def test_duplicate_field_rejects_unknown_source() -> None:
    body = _empty_body()
    mutation = DuplicateFieldMutation(
        kind="duplicateField",
        table_key="rooms",
        source_field_id="cf_missing",
        after=_make_custom_field("cf_new", display_name="x"),
        expected_schema_fingerprint=_fingerprint(body),
    )
    with pytest.raises(HTTPException) as excinfo:
        _apply(body, mutation)
    detail = cast(dict[str, object], excinfo.value.detail)
    assert detail["error_code"] == "custom_field_invalid_field_id"


# ---------------------------------------------------------------------------
# setDescription
# ---------------------------------------------------------------------------


def test_set_description_round_trips_and_clamps_max_length() -> None:
    body = _with_field(_empty_body(), _make_custom_field("cf_a", display_name="A"))

    too_long = "x" * (CUSTOM_FIELD_DESCRIPTION_MAX + 50)
    mutation = SetDescriptionMutation(
        kind="setDescription",
        table_key="rooms",
        field_id="cf_a",
        description=too_long,
        expected_schema_fingerprint=_fingerprint(body),
    )
    next_body, _ = _apply(body, mutation)
    stored = next_body.tables.rooms.custom_fields[0].description
    assert stored is not None
    assert len(stored) == CUSTOM_FIELD_DESCRIPTION_MAX

    # Round-trip a sane value, then clear with None.
    mutation_sane = SetDescriptionMutation(
        kind="setDescription",
        table_key="rooms",
        field_id="cf_a",
        description="What this column tracks.",
        expected_schema_fingerprint=_fingerprint(next_body),
    )
    next_body, _ = _apply(next_body, mutation_sane)
    assert next_body.tables.rooms.custom_fields[0].description == "What this column tracks."

    mutation_clear = SetDescriptionMutation(
        kind="setDescription",
        table_key="rooms",
        field_id="cf_a",
        description=None,
        expected_schema_fingerprint=_fingerprint(next_body),
    )
    next_body, _ = _apply(next_body, mutation_clear)
    assert next_body.tables.rooms.custom_fields[0].description is None


# ---------------------------------------------------------------------------
# Unsupported (Phase 3 / 4) mutations
# ---------------------------------------------------------------------------


def test_change_type_and_set_formula_raise_unsupported() -> None:
    body = _with_field(_empty_body(), _make_custom_field("cf_a", display_name="A"))

    change = ChangeTypeMutation(
        kind="changeType",
        table_key="rooms",
        field_id="cf_a",
        after=_make_custom_field("cf_a", display_name="A", field_type=CustomFieldType.number),
        cell_writes=[],
        expected_schema_fingerprint=_fingerprint(body),
    )
    with pytest.raises(HTTPException) as excinfo:
        _apply(body, change)
    assert excinfo.value.status_code == 422
    detail = cast(dict[str, object], excinfo.value.detail)
    assert detail["error_code"] == "custom_field_unsupported_mutation"
    details = cast(dict[str, object], detail["details"])
    assert details["kind"] == "changeType"
    assert details["available_in_phase"] == "Phase 3"

    formula = SetFormulaMutation(
        kind="setFormula",
        table_key="rooms",
        field_id="cf_a",
        config={"source": "{Name}"},
        expected_schema_fingerprint=_fingerprint(body),
    )
    with pytest.raises(HTTPException) as excinfo:
        _apply(body, formula)
    detail = cast(dict[str, object], excinfo.value.detail)
    assert detail["error_code"] == "custom_field_unsupported_mutation"
    details = cast(dict[str, object], detail["details"])
    assert details["available_in_phase"] == "Phase 4"


# ---------------------------------------------------------------------------
# Full-document re-validation
# ---------------------------------------------------------------------------


def test_apply_schema_mutation_runs_full_document_validation(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """`apply_schema_mutation` must round-trip the next body through
    `validate_document` so any whole-document reference rule the per-table
    preflight missed still fires before the draft is updated."""
    body = _empty_body()
    calls: list[object] = []
    real_validate = schema_mutations.validate_document

    def spy(raw_body: object) -> ProjectDocumentV1:
        calls.append(raw_body)
        return real_validate(raw_body)

    monkeypatch.setattr(schema_mutations, "validate_document", spy)

    mutation = AddFieldMutation(
        kind="addField",
        table_key="rooms",
        after=_make_custom_field("cf_validated", display_name="Validated"),
        expected_schema_fingerprint=_fingerprint(body),
    )
    next_body, _ = _apply(body, mutation)
    assert len(calls) == 1
    assert isinstance(next_body, ProjectDocumentV1)


def test_validate_schema_mutation_delegates_to_apply() -> None:
    body = _empty_body()
    mutation = AddFieldMutation(
        kind="addField",
        table_key="rooms",
        after=_make_custom_field("cf_v"),
        expected_schema_fingerprint="stale",
    )
    with pytest.raises(HTTPException) as excinfo:
        schema_mutations.validate_schema_mutation(
            body,
            cast(schema_mutations.FieldSchemaMutation, mutation),
            capability=rooms_custom_fields,
        )
    detail = cast(dict[str, object], excinfo.value.detail)
    assert detail["error_code"] == "custom_field_stale_schema_fingerprint"


def test_capability_hook_is_wired_on_rooms_contract() -> None:
    assert rooms_custom_fields.apply_schema_mutation is not None
    assert rooms_custom_fields.validate_schema_mutation is not None

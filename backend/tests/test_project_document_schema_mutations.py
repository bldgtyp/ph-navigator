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
    CustomFieldType,
    TableFieldDef,
)
from features.project_document.document import (
    ROOM_FLOOR_LEVEL_OPTION_KEY,
    ProjectDocumentV1,
    RoomRow,
    SingleSelectOption,
)
from features.project_document.mutations import dispatcher as mutations_dispatcher
from features.project_document.schema_mutations import (
    AddFieldMutation,
    ChangeTypeMutation,
    DeleteFieldMutation,
    DuplicateFieldMutation,
    EditOptionsMutation,
    RenameFieldMutation,
    SetDescriptionMutation,
    SetFormulaMutation,
    apply_schema_mutation,
)
from features.project_document.tables.rooms import rooms_custom_fields, rooms_field_registry
from features.projects.models import CreateProjectRequest
from features.projects.service import empty_project_document

ACTOR = "user_acceptance"


def test_module_imports() -> None:
    """Plan-15 P2.0 smoke kept as a parity check after P2.1's flesh-out."""
    assert schema_mutations.apply_schema_mutation is not None


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


def _empty_body() -> ProjectDocumentV1:
    return empty_project_document(
        CreateProjectRequest(
            name="t",
            bt_number="1",
            cert_programs=[],
        )
    )


def _make_custom_field(
    field_key: str,
    display_name: str = "Notes",
    field_type: CustomFieldType = CustomFieldType.short_text,
    description: str | None = None,
) -> TableFieldDef:
    return TableFieldDef(
        field_key=field_key,
        display_name=display_name,
        field_type=field_type,
        description=description,
        origin="custom",
        created_at=datetime(2026, 5, 24, 12, 0, tzinfo=UTC),
        created_by=None,
    )


def _custom_fields(body: ProjectDocumentV1) -> list[TableFieldDef]:
    return [field for field in rooms_field_registry.read_field_defs(body) if field.origin == "custom"]


def _row_custom_values(body: ProjectDocumentV1, row: RoomRow) -> dict[str, object]:
    custom_field_keys = {field.field_key for field in _custom_fields(body)}
    return {key: value for key, value in row.custom_values.items() if key in custom_field_keys}


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
            floor_level=floor_opts[0].id,
            building_zone=None,
            icfa_factor=1.0,
            erv_unit_ids=[],
            catalog_origin=None,
            notes=None,
            custom_values=cast(
                dict[str, str | int | float | bool | None],
                {
                    "number": number,
                    "name": f"Room {number}",
                    "num_people": 0,
                    "num_bedrooms": 0,
                    **(custom or {}),
                },
            ),
        )
    )
    envelope = body.tables.rooms.model_copy(update={"rows": rooms})
    next_tables = body.tables.model_copy(update={"rooms": envelope})
    return body.model_copy(update={"tables": next_tables})


def _with_field(body: ProjectDocumentV1, field: TableFieldDef) -> ProjectDocumentV1:
    return rooms_field_registry.replace_field_defs(
        body,
        [*rooms_field_registry.read_field_defs(body), field],
    )


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
    assert details["colliding_field_origin"] == "built_in"


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
    ids = [field.field_key for field in _custom_fields(next_body)]
    assert ids == ["cf_first", "cf_second", "cf_third"]
    assert audit["kind"] == "addField"
    assert audit["field_id"] == "cf_second"

    # actor_user_id is stamped onto the added field, overwriting the
    # `None` the caller-built TableFieldDef carried.
    added = _custom_fields(next_body)[1]
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
    ids = [field.field_key for field in _custom_fields(next_body)]
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
    field = _custom_fields(next_body)[0]
    assert field.field_key == "cf_notes"
    assert field.display_name == "Punch list"
    assert _row_custom_values(next_body, next_body.tables.rooms.rows[0]) == {"cf_notes": "needs paint"}
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
    assert _custom_fields(next_body)[0].display_name == "Notes"


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
    assert _custom_fields(next_body) == []
    assert all(_row_custom_values(next_body, row) == {} for row in next_body.tables.rooms.rows)
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
    ids = [field.field_key for field in _custom_fields(next_body)]
    assert ids == ["cf_src", "cf_dup"]  # inserted immediately after source
    assert _custom_fields(next_body)[1].description == "Original"
    assert _custom_fields(next_body)[1].created_by == ACTOR

    # Row values are NOT copied — the destination field starts empty.
    assert _row_custom_values(next_body, next_body.tables.rooms.rows[0]) == {"cf_src": "value-on-source"}
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
    stored = _custom_fields(next_body)[0].description
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
    assert _custom_fields(next_body)[0].description == "What this column tracks."

    mutation_clear = SetDescriptionMutation(
        kind="setDescription",
        table_key="rooms",
        field_id="cf_a",
        description=None,
        expected_schema_fingerprint=_fingerprint(next_body),
    )
    next_body, _ = _apply(next_body, mutation_clear)
    assert _custom_fields(next_body)[0].description is None


# ---------------------------------------------------------------------------
# Phase 4 — setFormula
# ---------------------------------------------------------------------------


def test_set_formula_round_trip() -> None:
    """Happy path: setFormula parses, resolves, and stores
    {source, ast, deps, result_type} atomically."""
    body = _with_field(
        _empty_body(),
        _make_custom_field("cf_a", display_name="Label", field_type=CustomFieldType.formula),
    )

    mutation = SetFormulaMutation(
        kind="setFormula",
        table_key="rooms",
        field_id="cf_a",
        source='concat({Number}, " - ", upper({Name}))',
        expected_schema_fingerprint=_fingerprint(body),
    )
    next_body, audit = _apply(body, mutation)
    config = _custom_fields(next_body)[0].config
    assert config["source"] == 'concat({Number}, " - ", upper({Name}))'
    assert isinstance(config["ast"], dict)
    deps = cast(list[str], config["deps"])
    assert sorted(deps) == ["name", "number"]
    assert config["result_type"] == "text"
    assert audit["kind"] == "setFormula"
    assert audit["deps"] == config["deps"]


def test_set_formula_rejects_parse_error() -> None:
    body = _with_field(
        _empty_body(),
        _make_custom_field("cf_a", display_name="Label", field_type=CustomFieldType.formula),
    )
    mutation = SetFormulaMutation(
        kind="setFormula",
        table_key="rooms",
        field_id="cf_a",
        source="concat({Name}, ",
        expected_schema_fingerprint=_fingerprint(body),
    )
    with pytest.raises(HTTPException) as excinfo:
        _apply(body, mutation)
    detail = cast(dict[str, object], excinfo.value.detail)
    assert detail["error_code"] == "custom_field_formula_parse_error"


def test_set_formula_rejects_missing_ref() -> None:
    body = _with_field(
        _empty_body(),
        _make_custom_field("cf_a", display_name="Label", field_type=CustomFieldType.formula),
    )
    mutation = SetFormulaMutation(
        kind="setFormula",
        table_key="rooms",
        field_id="cf_a",
        source="{Does Not Exist}",
        expected_schema_fingerprint=_fingerprint(body),
    )
    with pytest.raises(HTTPException) as excinfo:
        _apply(body, mutation)
    detail = cast(dict[str, object], excinfo.value.detail)
    assert detail["error_code"] == "custom_field_formula_missing_ref"


def test_set_formula_rejects_self_reference_cycle() -> None:
    body = _with_field(
        _empty_body(),
        _make_custom_field("cf_a", display_name="Self", field_type=CustomFieldType.formula),
    )
    mutation = SetFormulaMutation(
        kind="setFormula",
        table_key="rooms",
        field_id="cf_a",
        source="{Self}",
        expected_schema_fingerprint=_fingerprint(body),
    )
    with pytest.raises(HTTPException) as excinfo:
        _apply(body, mutation)
    detail = cast(dict[str, object], excinfo.value.detail)
    assert detail["error_code"] == "custom_field_formula_cycle"


def test_set_formula_rejects_non_formula_field() -> None:
    body = _with_field(
        _empty_body(),
        _make_custom_field("cf_a", display_name="Plain Text"),  # short_text default
    )
    mutation = SetFormulaMutation(
        kind="setFormula",
        table_key="rooms",
        field_id="cf_a",
        source="{Name}",
        expected_schema_fingerprint=_fingerprint(body),
    )
    with pytest.raises(HTTPException) as excinfo:
        _apply(body, mutation)
    detail = cast(dict[str, object], excinfo.value.detail)
    assert detail["error_code"] == "custom_field_invalid_field_id"


def test_set_formula_rejects_unsupported_function() -> None:
    body = _with_field(
        _empty_body(),
        _make_custom_field("cf_a", display_name="F", field_type=CustomFieldType.formula),
    )
    mutation = SetFormulaMutation(
        kind="setFormula",
        table_key="rooms",
        field_id="cf_a",
        source="sum({Name})",
        expected_schema_fingerprint=_fingerprint(body),
    )
    with pytest.raises(HTTPException) as excinfo:
        _apply(body, mutation)
    detail = cast(dict[str, object], excinfo.value.detail)
    assert detail["error_code"] == "custom_field_formula_unsupported_function"


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
    real_validate = mutations_dispatcher.validate_document

    def spy(raw_body: object) -> ProjectDocumentV1:
        calls.append(raw_body)
        return real_validate(raw_body)

    monkeypatch.setattr(mutations_dispatcher, "validate_document", spy)

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


# ---------------------------------------------------------------------------
# editOptions (P3.2)
# ---------------------------------------------------------------------------


def _seed_custom_single_select(
    body: ProjectDocumentV1,
    *,
    field_key: str = "cf_ss",
    display_name: str = "Status",
    options: list[SingleSelectOption] | None = None,
) -> ProjectDocumentV1:
    field = _make_custom_field(field_key, display_name=display_name, field_type=CustomFieldType.single_select)
    body = _with_field(body, field)
    next_options = dict(body.single_select_options)
    next_options[f"rooms.{field_key}"] = options or [
        SingleSelectOption(id="opt_a", label="A", color="#111111", order=1.0),
        SingleSelectOption(id="opt_b", label="B", color="#222222", order=2.0),
    ]
    return body.model_copy(update={"single_select_options": next_options})


def test_edit_options_adds_renames_recolors_reorders_no_row_impact() -> None:
    body = _seed_floor_option(_empty_body())
    body = _seed_custom_single_select(body)
    body = _with_room(body, custom={"cf_ss": "opt_a"})

    mutation = EditOptionsMutation(
        kind="editOptions",
        table_key="rooms",
        field_id="cf_ss",
        next_options=[
            SingleSelectOption(id="opt_a", label="Renamed", color="#333333", order=2.0),
            SingleSelectOption(id="opt_b", label="B", color="#222222", order=1.0),
            SingleSelectOption(id="opt_c", label="C", color="#444444", order=3.0),
        ],
        expected_schema_fingerprint=_fingerprint(body),
    )
    next_body, audit = _apply(body, mutation)
    assert _row_custom_values(next_body, next_body.tables.rooms.rows[0]) == {"cf_ss": "opt_a"}
    assert audit["cleared_row_count"] == 0
    assert audit["added_option_ids"] == ["opt_c"]
    assert audit["deleted_option_ids"] == []


def test_edit_options_delete_cascades_to_row_clears() -> None:
    body = _seed_floor_option(_empty_body())
    body = _seed_custom_single_select(body)
    body = _with_room(body, room_id="rm_1", number="101", custom={"cf_ss": "opt_a"})
    body = _with_room(body, room_id="rm_2", number="102", custom={"cf_ss": "opt_a"})
    body = _with_room(body, room_id="rm_3", number="103", custom={"cf_ss": "opt_b"})

    mutation = EditOptionsMutation(
        kind="editOptions",
        table_key="rooms",
        field_id="cf_ss",
        next_options=[
            SingleSelectOption(id="opt_b", label="B", color="#222222", order=1.0),
        ],
        expected_schema_fingerprint=_fingerprint(body),
    )
    next_body, audit = _apply(body, mutation)
    assert audit["cleared_row_count"] == 2
    assert audit["deleted_option_ids"] == ["opt_a"]
    assert _row_custom_values(next_body, next_body.tables.rooms.rows[0]) == {"cf_ss": None}
    assert _row_custom_values(next_body, next_body.tables.rooms.rows[1]) == {"cf_ss": None}
    assert _row_custom_values(next_body, next_body.tables.rooms.rows[2]) == {"cf_ss": "opt_b"}


def test_edit_options_rejects_duplicate_labels() -> None:
    body = _seed_custom_single_select(_empty_body())
    mutation = EditOptionsMutation(
        kind="editOptions",
        table_key="rooms",
        field_id="cf_ss",
        next_options=[
            SingleSelectOption(id="opt_a", label="Same", color="#111111", order=1.0),
            SingleSelectOption(id="opt_b", label="same", color="#222222", order=2.0),
        ],
        expected_schema_fingerprint=_fingerprint(body),
    )
    with pytest.raises(HTTPException) as excinfo:
        _apply(body, mutation)
    detail = cast(dict[str, object], excinfo.value.detail)
    assert detail["error_code"] == "custom_field_option_list_invalid"


def test_edit_options_rejects_field_with_wrong_type() -> None:
    body = _with_field(_empty_body(), _make_custom_field("cf_text", display_name="Text"))
    mutation = EditOptionsMutation(
        kind="editOptions",
        table_key="rooms",
        field_id="cf_text",
        next_options=[SingleSelectOption(id="opt_a", label="A", color="#111111", order=1.0)],
        expected_schema_fingerprint=_fingerprint(body),
    )
    with pytest.raises(HTTPException) as excinfo:
        _apply(body, mutation)
    detail = cast(dict[str, object], excinfo.value.detail)
    assert detail["error_code"] == "custom_field_invalid_field_id"


def test_edit_options_works_for_core_single_select_rename_no_row_impact() -> None:
    body = _seed_floor_option(_empty_body())
    body = _with_room(body, custom={})
    mutation = EditOptionsMutation(
        kind="editOptions",
        table_key="rooms",
        field_id="floor_level",
        next_options=[
            SingleSelectOption(id="opt_L1", label="Level 1 Renamed", color="#abcdef", order=1.0),
        ],
        expected_schema_fingerprint=_fingerprint(body),
    )
    next_body, audit = _apply(body, mutation)
    assert audit["cleared_row_count"] == 0
    assert next_body.tables.rooms.rows[0].floor_level == "opt_L1"


def test_edit_options_delete_cascades_to_nullable_core_select_row_clears() -> None:
    body = _seed_floor_option(_empty_body())
    body = _with_room(body, custom={})
    mutation = EditOptionsMutation(
        kind="editOptions",
        table_key="rooms",
        field_id="floor_level",
        next_options=[],
        expected_schema_fingerprint=_fingerprint(body),
    )
    next_body, audit = _apply(body, mutation)
    assert audit["cleared_row_count"] == 1
    assert audit["deleted_option_ids"] == ["opt_L1"]
    assert next_body.tables.rooms.rows[0].floor_level is None


# ---------------------------------------------------------------------------
# changeType (P3.3)
# ---------------------------------------------------------------------------


def _make_change_type_target(
    field_key: str,
    from_field: TableFieldDef,
    to_type: CustomFieldType,
) -> TableFieldDef:
    """Build a ChangeTypeMutation `after` preserving identity + metadata."""
    return TableFieldDef(
        field_key=field_key,
        display_name=from_field.display_name,
        field_type=to_type,
        config={},
        description=from_field.description,
        origin=from_field.origin,
        created_at=from_field.created_at,
        created_by=from_field.created_by,
    )


def test_change_type_text_to_number_preflight_clean() -> None:
    body = _seed_floor_option(_empty_body())
    body = _with_field(body, _make_custom_field("cf_v", display_name="Val", field_type=CustomFieldType.short_text))
    body = _with_room(body, room_id="rm_1", number="101", custom={"cf_v": "12.5"})
    body = _with_room(body, room_id="rm_2", number="102", custom={"cf_v": "0"})

    field = _custom_fields(body)[0]
    mutation = ChangeTypeMutation(
        kind="changeType",
        table_key="rooms",
        field_id="cf_v",
        after=_make_change_type_target("cf_v", field, CustomFieldType.number),
        expected_schema_fingerprint=_fingerprint(body),
    )
    next_body, audit = _apply(body, mutation)
    assert _custom_fields(next_body)[0].field_type is CustomFieldType.number
    assert next_body.tables.rooms.rows[0].custom_values["cf_v"] == 12.5
    assert next_body.tables.rooms.rows[1].custom_values["cf_v"] == 0
    assert audit["cleared_row_count"] == 0


def test_change_type_text_to_number_requires_acknowledgement_on_failure() -> None:
    body = _seed_floor_option(_empty_body())
    body = _with_field(body, _make_custom_field("cf_v", display_name="Val"))
    body = _with_room(body, room_id="rm_1", number="101", custom={"cf_v": "abc"})
    body = _with_room(body, room_id="rm_2", number="102", custom={"cf_v": "42"})

    field = _custom_fields(body)[0]
    mutation = ChangeTypeMutation(
        kind="changeType",
        table_key="rooms",
        field_id="cf_v",
        after=_make_change_type_target("cf_v", field, CustomFieldType.number),
        expected_schema_fingerprint=_fingerprint(body),
    )
    with pytest.raises(HTTPException) as excinfo:
        _apply(body, mutation)
    assert excinfo.value.status_code == 422
    detail = cast(dict[str, object], excinfo.value.detail)
    assert detail["error_code"] == "custom_field_coercion_preflight_required"
    details = cast(dict[str, object], detail["details"])
    assert details["incompatible_row_count"] == 1
    assert details["total_row_count"] == 2
    incompatible_rows = cast(list[dict[str, object]], details["incompatible_rows"])
    assert incompatible_rows[0]["row_id"] == "rm_1"

    ack = ChangeTypeMutation(
        kind="changeType",
        table_key="rooms",
        field_id="cf_v",
        after=_make_change_type_target("cf_v", field, CustomFieldType.number),
        acknowledge_destructive=True,
        expected_schema_fingerprint=_fingerprint(body),
    )
    next_body, audit = _apply(body, ack)
    assert audit["cleared_row_count"] == 1
    # rm_1 cleared, rm_2 coerced
    custom_by_id = {row.id: row.custom_values for row in next_body.tables.rooms.rows}
    assert "cf_v" not in custom_by_id["rm_1"]
    assert custom_by_id["rm_2"]["cf_v"] == 42


def test_change_type_text_to_url_validates_url() -> None:
    body = _seed_floor_option(_empty_body())
    body = _with_field(body, _make_custom_field("cf_u", display_name="URL field"))
    body = _with_room(body, room_id="rm_1", number="101", custom={"cf_u": "https://example.com"})
    body = _with_room(body, room_id="rm_2", number="102", custom={"cf_u": "not a url"})

    field = _custom_fields(body)[0]
    mutation = ChangeTypeMutation(
        kind="changeType",
        table_key="rooms",
        field_id="cf_u",
        after=_make_change_type_target("cf_u", field, CustomFieldType.url),
        acknowledge_destructive=True,
        expected_schema_fingerprint=_fingerprint(body),
    )
    next_body, audit = _apply(body, mutation)
    assert audit["cleared_row_count"] == 1
    custom = {row.id: row.custom_values for row in next_body.tables.rooms.rows}
    assert custom["rm_1"]["cf_u"] == "https://example.com"
    assert "cf_u" not in custom["rm_2"]


def test_change_type_text_to_single_select_auto_creates_options() -> None:
    body = _seed_floor_option(_empty_body())
    body = _with_field(body, _make_custom_field("cf_s", display_name="Status"))
    body = _with_room(body, room_id="rm_1", number="101", custom={"cf_s": "Open"})
    body = _with_room(body, room_id="rm_2", number="102", custom={"cf_s": "open"})  # dup label
    body = _with_room(body, room_id="rm_3", number="103", custom={"cf_s": "Closed"})

    field = _custom_fields(body)[0]
    mutation = ChangeTypeMutation(
        kind="changeType",
        table_key="rooms",
        field_id="cf_s",
        after=_make_change_type_target("cf_s", field, CustomFieldType.single_select),
        expected_schema_fingerprint=_fingerprint(body),
    )
    next_body, audit = _apply(body, mutation)
    new_options = next_body.single_select_options["rooms.cf_s"]
    assert [opt.label for opt in new_options] == ["Open", "Closed"]
    open_id = new_options[0].id
    closed_id = new_options[1].id
    rows = {row.id: row.custom_values for row in next_body.tables.rooms.rows}
    assert rows["rm_1"]["cf_s"] == open_id
    assert rows["rm_2"]["cf_s"] == open_id
    assert rows["rm_3"]["cf_s"] == closed_id
    assert audit["created_option_count"] == 2


def test_change_type_single_select_to_text_substitutes_label() -> None:
    body = _seed_floor_option(_empty_body())
    body = _seed_custom_single_select(body)
    body = _with_room(body, room_id="rm_1", number="101", custom={"cf_ss": "opt_a"})
    body = _with_room(body, room_id="rm_2", number="102", custom={"cf_ss": "opt_b"})

    field = _custom_fields(body)[0]
    mutation = ChangeTypeMutation(
        kind="changeType",
        table_key="rooms",
        field_id="cf_ss",
        after=_make_change_type_target("cf_ss", field, CustomFieldType.short_text),
        expected_schema_fingerprint=_fingerprint(body),
    )
    next_body, audit = _apply(body, mutation)
    rows = {row.id: row.custom_values for row in next_body.tables.rooms.rows}
    assert rows["rm_1"]["cf_ss"] == "A"
    assert rows["rm_2"]["cf_ss"] == "B"
    assert "rooms.cf_ss" not in next_body.single_select_options
    assert audit["cleared_row_count"] == 0


def test_change_type_single_select_to_number_coerces_numeric_labels() -> None:
    # Labels "10" and "20" should parse as numbers; label "A" should clear.
    body = _seed_floor_option(_empty_body())
    body = _seed_custom_single_select(
        body,
        options=[
            SingleSelectOption(id="opt_ten", label="10", color="#111111", order=1.0),
            SingleSelectOption(id="opt_twenty", label="20", color="#222222", order=2.0),
            SingleSelectOption(id="opt_a", label="A", color="#333333", order=3.0),
        ],
    )
    body = _with_room(body, room_id="rm_1", number="101", custom={"cf_ss": "opt_ten"})
    body = _with_room(body, room_id="rm_2", number="102", custom={"cf_ss": "opt_twenty"})
    body = _with_room(body, room_id="rm_3", number="103", custom={"cf_ss": "opt_a"})

    field = _custom_fields(body)[0]
    # First call: ack required since "A" can't parse.
    mutation = ChangeTypeMutation(
        kind="changeType",
        table_key="rooms",
        field_id="cf_ss",
        after=_make_change_type_target("cf_ss", field, CustomFieldType.number),
        expected_schema_fingerprint=_fingerprint(body),
    )
    with pytest.raises(HTTPException) as excinfo:
        _apply(body, mutation)
    assert excinfo.value.status_code == 422
    detail = cast(dict[str, object], excinfo.value.detail)
    assert detail["error_code"] == "custom_field_coercion_preflight_required"
    details = cast(dict[str, object], detail["details"])
    assert details["incompatible_row_count"] == 1

    ack = ChangeTypeMutation(
        kind="changeType",
        table_key="rooms",
        field_id="cf_ss",
        after=_make_change_type_target("cf_ss", field, CustomFieldType.number),
        acknowledge_destructive=True,
        expected_schema_fingerprint=_fingerprint(body),
    )
    next_body, audit = _apply(body, ack)
    assert _custom_fields(next_body)[0].field_type is CustomFieldType.number
    rows = {row.id: row.custom_values for row in next_body.tables.rooms.rows}
    assert rows["rm_1"]["cf_ss"] == 10
    assert rows["rm_2"]["cf_ss"] == 20
    assert "cf_ss" not in rows["rm_3"]
    # Option list is dropped when leaving single_select.
    assert "rooms.cf_ss" not in next_body.single_select_options
    assert audit["cleared_row_count"] == 1


def test_change_type_rejects_illegal_pair_number_to_url() -> None:
    body = _seed_floor_option(_empty_body())
    body = _with_field(body, _make_custom_field("cf_n", display_name="N", field_type=CustomFieldType.number))
    field = _custom_fields(body)[0]
    mutation = ChangeTypeMutation(
        kind="changeType",
        table_key="rooms",
        field_id="cf_n",
        after=_make_change_type_target("cf_n", field, CustomFieldType.url),
        expected_schema_fingerprint=_fingerprint(body),
    )
    with pytest.raises(HTTPException) as excinfo:
        _apply(body, mutation)
    detail = cast(dict[str, object], excinfo.value.detail)
    assert detail["error_code"] == "custom_field_illegal_type_conversion"


def test_change_type_rejects_no_op_same_type() -> None:
    body = _with_field(_empty_body(), _make_custom_field("cf_a", display_name="A"))
    field = _custom_fields(body)[0]
    mutation = ChangeTypeMutation(
        kind="changeType",
        table_key="rooms",
        field_id="cf_a",
        after=_make_change_type_target("cf_a", field, CustomFieldType.short_text),
        expected_schema_fingerprint=_fingerprint(body),
    )
    with pytest.raises(HTTPException) as excinfo:
        _apply(body, mutation)
    detail = cast(dict[str, object], excinfo.value.detail)
    assert detail["error_code"] == "custom_field_invalid_field_id"


def test_change_type_rejects_metadata_rewrite() -> None:
    body = _with_field(_empty_body(), _make_custom_field("cf_a", display_name="A"))
    field = _custom_fields(body)[0]
    # Attempt to rewrite display_name during changeType.
    after = TableFieldDef(
        field_key=field.field_key,
        display_name="A renamed",
        field_type=CustomFieldType.number,
        config={},
        description=field.description,
        origin=field.origin,
        created_at=field.created_at,
        created_by=field.created_by,
    )
    mutation = ChangeTypeMutation(
        kind="changeType",
        table_key="rooms",
        field_id="cf_a",
        after=after,
        expected_schema_fingerprint=_fingerprint(body),
    )
    with pytest.raises(HTTPException) as excinfo:
        _apply(body, mutation)
    detail = cast(dict[str, object], excinfo.value.detail)
    assert detail["error_code"] == "custom_field_invalid_field_id"
    details = cast(dict[str, object], detail["details"])
    assert details["disallowed_attribute"] == "display_name"


def test_duplicate_single_select_field_deep_copies_option_list() -> None:
    body = _seed_floor_option(_empty_body())
    body = _seed_custom_single_select(body)

    duplicate_after = _make_custom_field(
        "cf_dup",
        display_name="Status copy",
        field_type=CustomFieldType.single_select,
    )
    mutation = DuplicateFieldMutation(
        kind="duplicateField",
        table_key="rooms",
        source_field_id="cf_ss",
        after=duplicate_after,
        expected_schema_fingerprint=_fingerprint(body),
    )
    next_body, audit = _apply(body, mutation)
    src_options = next_body.single_select_options["rooms.cf_ss"]
    dup_options = next_body.single_select_options["rooms.cf_dup"]
    assert len(dup_options) == len(src_options)
    assert [o.label for o in dup_options] == [o.label for o in src_options]
    assert [o.color for o in dup_options] == [o.color for o in src_options]
    # Fresh ids
    assert {o.id for o in dup_options}.isdisjoint({o.id for o in src_options})
    assert audit["duplicated_option_count"] == len(src_options)


# ---------------------------------------------------------------------------
# editFieldBundle (plan-21 P5a.0)
# ---------------------------------------------------------------------------


from features.project_document.schema_mutations import EditFieldBundleMutation  # noqa: E402


def _make_bundle_after(
    field: TableFieldDef,
    *,
    display_name: str | None = None,
    description: str | None | object = ...,
    field_type: CustomFieldType | None = None,
    config: dict[str, object] | None = None,
) -> TableFieldDef:
    return field.model_copy(
        update={
            "display_name": display_name if display_name is not None else field.display_name,
            "description": (field.description if description is ... else cast(str | None, description)),
            "field_type": field_type or field.field_type,
            "config": dict(field.config) if config is None else config,
        }
    )


def test_edit_field_bundle_renames_and_updates_description() -> None:
    body = _seed_floor_option(_empty_body())
    field = _make_custom_field("cf_notes", display_name="Notes", description="old")
    body = _with_field(body, field)
    body = _with_room(body, custom={"cf_notes": "needs paint"})
    after = _make_bundle_after(field, display_name="Punch list", description="updated")
    mutation = EditFieldBundleMutation(
        kind="editFieldBundle",
        table_key="rooms",
        field_id="cf_notes",
        after=after,
        expected_schema_fingerprint=_fingerprint(body),
    )
    next_body, audit = _apply(body, mutation)
    f = _custom_fields(next_body)[0]
    assert f.display_name == "Punch list"
    assert f.description == "updated"
    assert _row_custom_values(next_body, next_body.tables.rooms.rows[0]) == {"cf_notes": "needs paint"}
    assert audit["kind"] == "editFieldBundle"
    changed = cast(list[str], audit["properties_changed"])
    assert set(changed) == {"display_name", "description"}


def test_edit_field_bundle_noop_when_diff_empty() -> None:
    body = _seed_floor_option(_empty_body())
    field = _make_custom_field("cf_notes", display_name="Notes")
    body = _with_field(body, field)
    mutation = EditFieldBundleMutation(
        kind="editFieldBundle",
        table_key="rooms",
        field_id="cf_notes",
        after=_make_bundle_after(field),
        expected_schema_fingerprint=_fingerprint(body),
    )
    next_body, audit = _apply(body, mutation)
    assert next_body == body
    assert audit["properties_changed"] == []


def test_edit_field_bundle_rejects_stale_fingerprint() -> None:
    body = _seed_floor_option(_empty_body())
    field = _make_custom_field("cf_notes", display_name="Notes")
    body = _with_field(body, field)
    mutation = EditFieldBundleMutation(
        kind="editFieldBundle",
        table_key="rooms",
        field_id="cf_notes",
        after=_make_bundle_after(field, display_name="Renamed"),
        expected_schema_fingerprint="stale",
    )
    with pytest.raises(HTTPException) as excinfo:
        _apply(body, mutation)
    assert excinfo.value.status_code == 409


def test_edit_field_bundle_rejects_identity_violation() -> None:
    body = _seed_floor_option(_empty_body())
    field = _make_custom_field("cf_notes", display_name="Notes")
    body = _with_field(body, field)
    after = field.model_copy(update={"field_key": "cf_other", "display_name": "X"})
    mutation = EditFieldBundleMutation(
        kind="editFieldBundle",
        table_key="rooms",
        field_id="cf_notes",
        after=after,
        expected_schema_fingerprint=_fingerprint(body),
    )
    with pytest.raises(HTTPException) as excinfo:
        _apply(body, mutation)
    detail = cast(dict[str, object], excinfo.value.detail)
    assert detail["error_code"] == "custom_field_invalid_field_id"


def test_edit_field_bundle_rejects_duplicate_display_name() -> None:
    body = _seed_floor_option(_empty_body())
    body = _with_field(body, _make_custom_field("cf_a", display_name="A"))
    body = _with_field(body, _make_custom_field("cf_b", display_name="B"))
    target = _custom_fields(body)[1]
    mutation = EditFieldBundleMutation(
        kind="editFieldBundle",
        table_key="rooms",
        field_id="cf_b",
        after=_make_bundle_after(target, display_name="a"),  # case-insensitive collision
        expected_schema_fingerprint=_fingerprint(body),
    )
    with pytest.raises(HTTPException) as excinfo:
        _apply(body, mutation)
    detail = cast(dict[str, object], excinfo.value.detail)
    assert detail["error_code"] == "custom_field_duplicate_name"


def test_edit_field_bundle_clamps_description() -> None:
    body = _seed_floor_option(_empty_body())
    field = _make_custom_field("cf_notes", display_name="Notes")
    body = _with_field(body, field)
    long_desc = "x" * (CUSTOM_FIELD_DESCRIPTION_MAX + 50)
    mutation = EditFieldBundleMutation(
        kind="editFieldBundle",
        table_key="rooms",
        field_id="cf_notes",
        after=_make_bundle_after(field, description=long_desc),
        expected_schema_fingerprint=_fingerprint(body),
    )
    next_body, _ = _apply(body, mutation)
    f = _custom_fields(next_body)[0]
    assert f.description is not None
    assert len(f.description) == CUSTOM_FIELD_DESCRIPTION_MAX


def test_edit_field_bundle_changes_type_with_ack() -> None:
    body = _seed_floor_option(_empty_body())
    field = _make_custom_field("cf_v", display_name="Value", field_type=CustomFieldType.short_text)
    body = _with_field(body, field)
    body = _with_room(body, room_id="rm_1", number="101", custom={"cf_v": "abc"})  # incompatible
    body = _with_room(body, room_id="rm_2", number="102", custom={"cf_v": "42"})

    after = _make_bundle_after(field, field_type=CustomFieldType.number, config={})
    # Without ack: should be rejected with preflight required.
    mutation = EditFieldBundleMutation(
        kind="editFieldBundle",
        table_key="rooms",
        field_id="cf_v",
        after=after,
        expected_schema_fingerprint=_fingerprint(body),
    )
    with pytest.raises(HTTPException) as excinfo:
        _apply(body, mutation)
    detail = cast(dict[str, object], excinfo.value.detail)
    assert detail["error_code"] == "custom_field_coercion_preflight_required"

    # With ack: applies, clears incompatible rows.
    mutation_ack = EditFieldBundleMutation(
        kind="editFieldBundle",
        table_key="rooms",
        field_id="cf_v",
        after=after,
        acknowledge_destructive=True,
        expected_schema_fingerprint=_fingerprint(body),
    )
    next_body, audit = _apply(body, mutation_ack)
    f = _custom_fields(next_body)[0]
    assert f.field_type is CustomFieldType.number
    changed = cast(list[str], audit["properties_changed"])
    assert "field_type" in changed
    assert audit["cleared_row_count"] == 1


def test_edit_field_bundle_text_to_single_select_uses_client_options() -> None:
    # Modal pre-populates derived options and lets the user rename /
    # drop them before saving. The bundle must use the client's list as
    # authoritative instead of re-materializing from the raw row values.
    body = _seed_floor_option(_empty_body())
    field = _make_custom_field("cf_s", display_name="Status", field_type=CustomFieldType.short_text)
    body = _with_field(body, field)
    body = _with_room(body, room_id="rm_1", number="101", custom={"cf_s": "Open"})
    body = _with_room(body, room_id="rm_2", number="102", custom={"cf_s": "Closed"})
    body = _with_room(body, room_id="rm_3", number="103", custom={"cf_s": "Pending"})

    # User-edited list: kept "Open" but renamed "Closed" → "Done" and
    # dropped "Pending" entirely. "Pending" rows should be cleared
    # (covered by the preflight ack).
    client_options = [
        SingleSelectOption(id="opt_open", label="Open", color="#3b82f6", order=0.0),
        SingleSelectOption(id="opt_done", label="Done", color="#10b981", order=1.0),
    ]
    after = _make_bundle_after(field, field_type=CustomFieldType.single_select, config={})
    mutation = EditFieldBundleMutation(
        kind="editFieldBundle",
        table_key="rooms",
        field_id="cf_s",
        after=after,
        next_options=client_options,
        acknowledge_destructive=True,
        expected_schema_fingerprint=_fingerprint(body),
    )
    next_body, audit = _apply(body, mutation)
    stored_options = next_body.single_select_options["rooms.cf_s"]
    assert [(o.id, o.label) for o in stored_options] == [
        ("opt_open", "Open"),
        ("opt_done", "Done"),
    ]
    rows = {row.id: row.custom_values for row in next_body.tables.rooms.rows}
    assert rows["rm_1"]["cf_s"] == "opt_open"
    # "Closed" matches the renamed "Done"? No — label match is case-
    # insensitive on the trimmed text; "Closed" ≠ "Done", so it clears.
    assert rows["rm_2"].get("cf_s") is None
    assert rows["rm_3"].get("cf_s") is None
    assert audit["cleared_row_count"] == 2


def test_edit_field_bundle_rejects_forbidden_type_change() -> None:
    # number -> url is not in CONVERSION_MATRIX.
    body = _seed_floor_option(_empty_body())
    field = _make_custom_field("cf_t", display_name="T", field_type=CustomFieldType.number)
    body = _with_field(body, field)
    after = _make_bundle_after(field, field_type=CustomFieldType.url, config={})
    mutation = EditFieldBundleMutation(
        kind="editFieldBundle",
        table_key="rooms",
        field_id="cf_t",
        after=after,
        expected_schema_fingerprint=_fingerprint(body),
    )
    with pytest.raises(HTTPException) as excinfo:
        _apply(body, mutation)
    detail = cast(dict[str, object], excinfo.value.detail)
    assert detail["error_code"] == "custom_field_illegal_type_conversion"


def test_edit_field_bundle_edits_options_and_sets_default() -> None:
    body = _seed_floor_option(_empty_body())
    body = _seed_custom_single_select(body)
    field = _custom_fields(body)[0]
    next_options = [
        SingleSelectOption(id="opt_a", label="A", color="#111111", order=1.0),
        SingleSelectOption(id="opt_b", label="B", color="#222222", order=2.0),
        SingleSelectOption(id="opt_c", label="C", color="#333333", order=3.0),
    ]
    after = _make_bundle_after(field, config={"default_option_id": "opt_b"})
    mutation = EditFieldBundleMutation(
        kind="editFieldBundle",
        table_key="rooms",
        field_id="cf_ss",
        after=after,
        next_options=next_options,
        expected_schema_fingerprint=_fingerprint(body),
    )
    next_body, audit = _apply(body, mutation)
    final_field = _custom_fields(next_body)[0]
    assert final_field.config.get("default_option_id") == "opt_b"
    final_options = next_body.single_select_options["rooms.cf_ss"]
    assert [o.id for o in final_options] == ["opt_a", "opt_b", "opt_c"]
    changed = cast(list[str], audit["properties_changed"])
    assert "options" in changed
    assert "default_option_id" in changed


def test_edit_field_bundle_rejects_default_not_in_options() -> None:
    body = _seed_floor_option(_empty_body())
    body = _seed_custom_single_select(body)
    field = _custom_fields(body)[0]
    after = _make_bundle_after(field, config={"default_option_id": "opt_nonexistent"})
    mutation = EditFieldBundleMutation(
        kind="editFieldBundle",
        table_key="rooms",
        field_id="cf_ss",
        after=after,
        expected_schema_fingerprint=_fingerprint(body),
    )
    with pytest.raises(HTTPException) as excinfo:
        _apply(body, mutation)
    detail = cast(dict[str, object], excinfo.value.detail)
    assert detail["error_code"] == "custom_field_option_list_invalid"
    details = cast(dict[str, object], detail["details"])
    assert details["reason"] == "default_option_id_not_in_options"


def test_edit_field_bundle_rejects_default_outside_single_select() -> None:
    body = _seed_floor_option(_empty_body())
    field = _make_custom_field("cf_t", display_name="T", field_type=CustomFieldType.short_text)
    body = _with_field(body, field)
    after = _make_bundle_after(field, config={"default_option_id": "opt_a"})
    mutation = EditFieldBundleMutation(
        kind="editFieldBundle",
        table_key="rooms",
        field_id="cf_t",
        after=after,
        expected_schema_fingerprint=_fingerprint(body),
    )
    with pytest.raises(HTTPException) as excinfo:
        _apply(body, mutation)
    detail = cast(dict[str, object], excinfo.value.detail)
    assert detail["error_code"] == "custom_field_option_list_invalid"


def test_edit_field_bundle_rename_plus_options_plus_default_single_audit() -> None:
    body = _seed_floor_option(_empty_body())
    body = _seed_custom_single_select(body)
    field = _custom_fields(body)[0]
    next_options = [
        SingleSelectOption(id="opt_a", label="Alpha", color="#111111", order=1.0),
        SingleSelectOption(id="opt_b", label="Beta", color="#222222", order=2.0),
    ]
    after = _make_bundle_after(
        field,
        display_name="Status (renamed)",
        description="now with default",
        config={"default_option_id": "opt_a"},
    )
    mutation = EditFieldBundleMutation(
        kind="editFieldBundle",
        table_key="rooms",
        field_id="cf_ss",
        after=after,
        next_options=next_options,
        expected_schema_fingerprint=_fingerprint(body),
    )
    next_body, audit = _apply(body, mutation)
    final_field = _custom_fields(next_body)[0]
    assert final_field.display_name == "Status (renamed)"
    assert final_field.description == "now with default"
    assert final_field.config.get("default_option_id") == "opt_a"
    changed = cast(list[str], audit["properties_changed"])
    # All four properties should be present in a single audit row.
    assert "display_name" in changed
    assert "description" in changed
    assert "options" in changed  # option labels changed (A->Alpha)
    assert "default_option_id" in changed

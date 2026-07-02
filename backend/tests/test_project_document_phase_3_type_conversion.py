"""Phase 3 — built-in field type changes (plan-31-phase-3).

Focused service-internal coverage for the new conversion-matrix entries
(`formula` source + target) and the lock-list guard. Uses the
`empty_project_document` service factory so the test fixture stays in
lockstep with the production seeding path — no separate _empty_body()
helper that drifts away from the production shape.

These tests are independent of the broader Phase 1c test-fixture rewrite
(task #12 / `tests/test_project_document_schema_mutations.py`); they
exercise only the dispatchers and apply paths added in Phase 3.
"""

from __future__ import annotations

from dataclasses import replace
from datetime import UTC, datetime
from typing import cast

import pytest
from fastapi import HTTPException

from features.project_document.custom_fields import (
    CustomFieldType,
    TableFieldDef,
)
from features.project_document.document import (
    ROOM_FLOOR_LEVEL_OPTION_KEY,
    ProjectDocumentV1,
    RoomRow,
    SingleSelectOption,
)
from features.project_document.mutations.models import (
    CONVERSION_MATRIX,
    ChangeTypeMutation,
    EditFieldBundleMutation,
    EditOptionsMutation,
    FieldSchemaMutation,
)
from features.project_document.mutations.options_ops import apply_edit_options
from features.project_document.schema_mutations import apply_schema_mutation
from features.project_document.tables.pumps import pumps_field_registry
from features.project_document.tables.rooms import (
    rooms_custom_fields,
    rooms_field_registry,
)
from features.projects.models import CreateProjectRequest
from features.projects.service import empty_project_document

ACTOR = "user_acceptance"


def _seed_body() -> ProjectDocumentV1:
    """Produce a valid v4 empty document via the production factory.

    `empty_project_document` already seeds the built-in FieldDefs
    (including `record_id`) on both Rooms and Pumps, so the result
    passes the `validate_document_references` "record_id required"
    check immediately.
    """
    return empty_project_document(CreateProjectRequest(name="t", bt_number="t-1", cert_programs=[]))


def _with_custom_field(
    body: ProjectDocumentV1,
    field_key: str,
    *,
    display_name: str,
    field_type: CustomFieldType = CustomFieldType.short_text,
    config: dict[str, object] | None = None,
) -> ProjectDocumentV1:
    field = TableFieldDef(
        field_key=field_key,
        display_name=display_name,
        field_type=field_type,
        config=config or {},
        origin="custom",
        created_at=datetime(2026, 5, 26, 12, 0, tzinfo=UTC),
        created_by=None,
    )
    envelope = body.tables.rooms
    next_envelope = envelope.model_copy(update={"field_defs": [*envelope.field_defs, field]})
    return body.model_copy(update={"tables": body.tables.model_copy(update={"rooms": next_envelope})})


def _with_room(
    body: ProjectDocumentV1,
    *,
    room_id: str,
    floor_option_id: str = "opt_L1",
    custom_values: dict[str, object] | None = None,
) -> ProjectDocumentV1:
    row = RoomRow(
        id=room_id,
        floor_level=floor_option_id,
        building_zone=None,
        icfa_factor=1.0,
        catalog_origin=None,
        notes=None,
        custom_values=cast(
            dict[str, str | int | float | bool | None],
            custom_values or {},
        ),
    )
    envelope = body.tables.rooms
    next_envelope = envelope.model_copy(update={"rows": [*envelope.rows, row]})
    return body.model_copy(update={"tables": body.tables.model_copy(update={"rooms": next_envelope})})


def _with_floor_options(
    body: ProjectDocumentV1,
    options: list[SingleSelectOption],
) -> ProjectDocumentV1:
    return body.model_copy(
        update={
            "single_select_options": {
                **body.single_select_options,
                ROOM_FLOOR_LEVEL_OPTION_KEY: options,
            }
        }
    )


def _fingerprint(body: ProjectDocumentV1) -> str:
    return rooms_custom_fields.compute_schema_fingerprint(body)


def _apply(body: ProjectDocumentV1, mutation: object) -> tuple[ProjectDocumentV1, dict[str, object]]:
    return apply_schema_mutation(
        body,
        cast(FieldSchemaMutation, mutation),
        actor_user_id=ACTOR,
        capability=rooms_custom_fields,
    )


# ---------------------------------------------------------------------------
# Matrix conformance
# ---------------------------------------------------------------------------


def test_conversion_matrix_covers_formula_targets_for_every_primitive() -> None:
    """Every primitive source can be converted to formula via the
    `discard_then_author` policy (PRD §P4.5)."""
    for source in (
        CustomFieldType.short_text,
        CustomFieldType.long_text,
        CustomFieldType.number,
        CustomFieldType.url,
        CustomFieldType.single_select,
        CustomFieldType.color,
    ):
        policy = CONVERSION_MATRIX.get((source, CustomFieldType.formula))
        assert policy == "discard_then_author", f"{source.value} → formula must be discard_then_author, got {policy!r}"


def test_conversion_matrix_covers_formula_to_each_primitive() -> None:
    """A formula field can be converted back to every primitive type."""
    expected = {
        CustomFieldType.short_text: "lossless",
        CustomFieldType.long_text: "lossless",
        CustomFieldType.number: "lossy",
        CustomFieldType.url: "lossy",
        CustomFieldType.single_select: "create_options",
        CustomFieldType.color: "lossy",
    }
    for target, policy in expected.items():
        actual = CONVERSION_MATRIX.get((CustomFieldType.formula, target))
        assert actual == policy, f"formula → {target.value} expected {policy!r}, got {actual!r}"


def test_conversion_matrix_rejects_formula_to_formula() -> None:
    """`formula → formula` is not a conversion — `setFormula` handles
    re-authoring a formula source in-place."""
    assert (CustomFieldType.formula, CustomFieldType.formula) not in CONVERSION_MATRIX


# ---------------------------------------------------------------------------
# Lock-list guard (defense-in-depth against MCP / hand-crafted writes)
# ---------------------------------------------------------------------------


def test_change_type_rejected_on_field_type_locked_built_in() -> None:
    """The Rooms `floor_level` field is `field_type`-locked in the
    registry; a `changeType` attempt must surface
    `custom_field_field_type_locked` even if the matrix would otherwise
    allow the conversion."""
    body = _seed_body()
    locked = sorted(rooms_field_registry.field_type_locked_keys)
    assert "floor_level" in locked, "Rooms must lock floor_level field_type"
    mutation = ChangeTypeMutation(
        kind="changeType",
        table_key="rooms",
        field_id="floor_level",
        after=TableFieldDef(
            field_key="floor_level",
            display_name="Floor",
            field_type=CustomFieldType.short_text,
            config={},
            origin="built_in",
            created_at=datetime(2026, 5, 26, 12, 0, tzinfo=UTC),
            created_by=None,
        ),
        expected_schema_fingerprint=_fingerprint(body),
    )
    with pytest.raises(HTTPException) as excinfo:
        _apply(body, mutation)
    assert excinfo.value.status_code == 422
    detail = cast(dict[str, object], excinfo.value.detail)
    assert detail["error_code"] == "custom_field_field_type_locked"


def test_change_type_allowed_on_unlocked_built_in() -> None:
    """The Rooms `number` field is NOT `field_type`-locked — a change
    to `long_text` should proceed (lossless conversion, ack not
    required for empty table)."""
    body = _seed_body()
    assert "number" not in rooms_field_registry.field_type_locked_keys
    mutation = ChangeTypeMutation(
        kind="changeType",
        table_key="rooms",
        field_id="number",
        after=TableFieldDef(
            field_key="number",
            display_name="Number",
            field_type=CustomFieldType.long_text,
            config={},
            origin="built_in",
            created_at=datetime(2026, 5, 26, 12, 0, tzinfo=UTC),
            created_by=None,
        ),
        expected_schema_fingerprint=_fingerprint(body),
    )
    next_body, audit = _apply(body, mutation)
    number_field = next(f for f in next_body.tables.rooms.field_defs if f.field_key == "number")
    assert number_field.field_type is CustomFieldType.long_text
    assert audit["kind"] == "changeType"
    assert audit["from_type"] == "short_text"
    assert audit["to_type"] == "long_text"


def test_edit_options_allowed_on_option_editable_rooms_builtin() -> None:
    body = _seed_body()
    option = SingleSelectOption(id="opt_roof", label="Roof", color="#3b82f6", order=0)
    mutation = EditOptionsMutation(
        kind="editOptions",
        table_key="rooms",
        field_id="floor_level",
        next_options=[option],
        expected_schema_fingerprint=_fingerprint(body),
    )

    next_body, audit = apply_edit_options(body, mutation, rooms_field_registry)

    assert next_body.single_select_options[ROOM_FLOOR_LEVEL_OPTION_KEY] == [option]
    assert audit["kind"] == "editOptions"
    assert audit["field_id"] == "floor_level"


def test_edit_field_bundle_edits_option_editable_rooms_builtin_options() -> None:
    body = _seed_body()
    floor = next(field for field in body.tables.rooms.field_defs if field.field_key == "floor_level")
    option = SingleSelectOption(id="opt_roof", label="Roof", color="#3b82f6", order=0)
    mutation = EditFieldBundleMutation(
        kind="editFieldBundle",
        table_key="rooms",
        field_id="floor_level",
        after=floor,
        next_options=[option],
        expected_schema_fingerprint=_fingerprint(body),
    )

    next_body, audit = _apply(body, mutation)

    assert next_body.single_select_options[ROOM_FLOOR_LEVEL_OPTION_KEY] == [option]
    assert audit["kind"] == "editFieldBundle"
    assert "options" in audit["properties_changed"]


def test_edit_field_bundle_deleting_nullable_rooms_builtin_option_clears_refs() -> None:
    option_l1 = SingleSelectOption(id="opt_L1", label="L1", color="#3b82f6", order=0)
    option_l2 = SingleSelectOption(id="opt_L2", label="L2", color="#22c55e", order=1)
    body = _with_floor_options(_seed_body(), [option_l1, option_l2])
    body = _with_room(body, room_id="rm_1", floor_option_id="opt_L1")
    floor = next(field for field in body.tables.rooms.field_defs if field.field_key == "floor_level")
    mutation = EditFieldBundleMutation(
        kind="editFieldBundle",
        table_key="rooms",
        field_id="floor_level",
        after=floor,
        next_options=[option_l2],
        expected_schema_fingerprint=_fingerprint(body),
    )

    next_body, audit = _apply(body, mutation)

    assert next_body.tables.rooms.rows[0].floor_level is None
    assert next_body.single_select_options[ROOM_FLOOR_LEVEL_OPTION_KEY] == [option_l2]
    assert audit["cleared_row_count"] == 1


def test_edit_field_bundle_required_builtin_option_delete_rewrites_to_replacement() -> None:
    option_l1 = SingleSelectOption(id="opt_L1", label="L1", color="#3b82f6", order=0)
    option_l2 = SingleSelectOption(id="opt_L2", label="L2", color="#22c55e", order=1)
    body = _with_floor_options(_seed_body(), [option_l1, option_l2])
    body = _with_room(body, room_id="rm_1", floor_option_id="opt_L1")
    floor = next(field for field in body.tables.rooms.field_defs if field.field_key == "floor_level")
    required_registry = replace(rooms_custom_fields, required_field_keys=frozenset({"floor_level"}))
    mutation = EditFieldBundleMutation(
        kind="editFieldBundle",
        table_key="rooms",
        field_id="floor_level",
        after=floor,
        next_options=[option_l2],
        option_replacements={"opt_L1": "opt_L2"},
        expected_schema_fingerprint=required_registry.compute_schema_fingerprint(body),
    )

    next_body, audit = apply_schema_mutation(
        body,
        mutation,
        actor_user_id=ACTOR,
        capability=required_registry,
    )

    assert next_body.tables.rooms.rows[0].floor_level == "opt_L2"
    assert next_body.single_select_options[ROOM_FLOOR_LEVEL_OPTION_KEY] == [option_l2]
    assert audit["cleared_row_count"] == 1


def test_edit_field_bundle_required_builtin_option_delete_requires_replacement() -> None:
    option_l1 = SingleSelectOption(id="opt_L1", label="L1", color="#3b82f6", order=0)
    option_l2 = SingleSelectOption(id="opt_L2", label="L2", color="#22c55e", order=1)
    body = _with_floor_options(_seed_body(), [option_l1, option_l2])
    body = _with_room(body, room_id="rm_1", floor_option_id="opt_L1")
    floor = next(field for field in body.tables.rooms.field_defs if field.field_key == "floor_level")
    required_registry = replace(rooms_custom_fields, required_field_keys=frozenset({"floor_level"}))
    mutation = EditFieldBundleMutation(
        kind="editFieldBundle",
        table_key="rooms",
        field_id="floor_level",
        after=floor,
        next_options=[option_l2],
        expected_schema_fingerprint=required_registry.compute_schema_fingerprint(body),
    )

    with pytest.raises(HTTPException) as excinfo:
        apply_schema_mutation(body, mutation, actor_user_id=ACTOR, capability=required_registry)

    assert excinfo.value.status_code == 422
    detail = cast(dict[str, object], excinfo.value.detail)
    assert detail["error_code"] == "custom_field_option_list_invalid"
    assert detail["details"]["reason"] == "required_built_in_select_delete_without_replacement"


def test_edit_options_rejected_on_locked_builtin_status() -> None:
    body = _seed_body()
    next_options = [
        *body.single_select_options["pumps.status"],
        SingleSelectOption(id="opt_status_custom", label="Custom", color="#111111", order=99),
    ]
    mutation = EditOptionsMutation(
        kind="editOptions",
        table_key="pumps",
        field_id="status",
        next_options=next_options,
        expected_schema_fingerprint=pumps_field_registry.compute_schema_fingerprint(body),
    )

    with pytest.raises(HTTPException) as excinfo:
        apply_edit_options(body, mutation, pumps_field_registry)
    assert excinfo.value.status_code == 422
    detail = cast(dict[str, object], excinfo.value.detail)
    assert detail["error_code"] == "custom_field_options_locked"


# ---------------------------------------------------------------------------
# primitive → formula (discard_then_author)
# ---------------------------------------------------------------------------


def test_primitive_to_formula_requires_ack_when_rows_non_empty() -> None:
    """Converting a populated custom text field to formula must surface
    the preflight error until the client re-submits with
    `acknowledge_destructive=True`."""
    body = _seed_body()
    body = _with_custom_field(body, "cf_label", display_name="Label")
    body = body.model_copy(
        update={
            "single_select_options": {
                ROOM_FLOOR_LEVEL_OPTION_KEY: [
                    SingleSelectOption(id="opt_L1", label="L1", color="#aabbcc", order=1.0),
                ],
            }
        }
    )
    body = _with_room(body, room_id="rm_1", custom_values={"cf_label": "Conference Room"})

    bundle = EditFieldBundleMutation(
        kind="editFieldBundle",
        table_key="rooms",
        field_id="cf_label",
        after=TableFieldDef(
            field_key="cf_label",
            display_name="Label",
            field_type=CustomFieldType.formula,
            config={},
            origin="custom",
            created_at=datetime(2026, 5, 26, 12, 0, tzinfo=UTC),
            created_by=None,
        ),
        formula_source="upper({Name})",
        expected_schema_fingerprint=_fingerprint(body),
    )
    with pytest.raises(HTTPException) as excinfo:
        _apply(body, bundle)
    assert excinfo.value.status_code == 422
    detail = cast(dict[str, object], excinfo.value.detail)
    assert detail["error_code"] == "custom_field_coercion_preflight_required"


# ---------------------------------------------------------------------------
# formula → primitive snapshot
# ---------------------------------------------------------------------------


def test_formula_to_short_text_snapshots_computed_values() -> None:
    """Changing a formula field to a primitive snapshots the current
    computed overlay into stored custom_values for the shared table path."""
    body = _seed_body()
    body = _with_custom_field(body, "cf_label", display_name="Label")
    body = body.model_copy(
        update={
            "single_select_options": {
                ROOM_FLOOR_LEVEL_OPTION_KEY: [
                    SingleSelectOption(id="opt_L1", label="L1", color="#aabbcc", order=1.0),
                ],
            }
        }
    )
    body = _with_room(body, room_id="rm_1", custom_values={"name": "Living", "cf_label": "discard me"})

    to_formula = EditFieldBundleMutation(
        kind="editFieldBundle",
        table_key="rooms",
        field_id="cf_label",
        after=TableFieldDef(
            field_key="cf_label",
            display_name="Label",
            field_type=CustomFieldType.formula,
            config={},
            origin="custom",
            created_at=datetime(2026, 5, 26, 12, 0, tzinfo=UTC),
            created_by=None,
        ),
        acknowledge_destructive=True,
        formula_source='concat("Room: ", {Name})',
        expected_schema_fingerprint=_fingerprint(body),
    )
    formula_body, _ = _apply(body, to_formula)

    to_text = EditFieldBundleMutation(
        kind="editFieldBundle",
        table_key="rooms",
        field_id="cf_label",
        after=TableFieldDef(
            field_key="cf_label",
            display_name="Label",
            field_type=CustomFieldType.short_text,
            config={},
            origin="custom",
            created_at=datetime(2026, 5, 26, 12, 0, tzinfo=UTC),
            created_by=None,
        ),
        expected_schema_fingerprint=_fingerprint(formula_body),
    )
    next_body, audit = _apply(formula_body, to_text)

    assert audit["kind"] == "editFieldBundle"
    assert audit["properties_changed"] == ["field_type"]
    assert next_body.tables.rooms.field_defs[-1].field_type is CustomFieldType.short_text
    assert next_body.tables.rooms.rows[0].custom_values["cf_label"] == "Room: Living"


# ---------------------------------------------------------------------------
# Audit log per-row before/after
# ---------------------------------------------------------------------------


def test_audit_payload_contains_row_changes_with_before_after() -> None:
    """Successful conversions on populated tables capture per-row
    before/after pairs in the audit payload (capped at AUDIT_ROW_CAP)."""
    body = _seed_body()
    body = _with_custom_field(body, "cf_count", display_name="Count", field_type=CustomFieldType.short_text)
    body = body.model_copy(
        update={
            "single_select_options": {
                ROOM_FLOOR_LEVEL_OPTION_KEY: [
                    SingleSelectOption(id="opt_L1", label="L1", color="#aabbcc", order=1.0),
                ],
            }
        }
    )
    body = _with_room(body, room_id="rm_1", custom_values={"cf_count": "42"})
    body = _with_room(body, room_id="rm_2", custom_values={"cf_count": "7"})

    mutation = ChangeTypeMutation(
        kind="changeType",
        table_key="rooms",
        field_id="cf_count",
        after=TableFieldDef(
            field_key="cf_count",
            display_name="Count",
            field_type=CustomFieldType.number,
            config={},
            origin="custom",
            created_at=datetime(2026, 5, 26, 12, 0, tzinfo=UTC),
            created_by=None,
        ),
        expected_schema_fingerprint=_fingerprint(body),
    )
    _next, audit = _apply(body, mutation)
    assert "row_changes" in audit, "audit payload must include row_changes"
    row_changes = cast(list[dict[str, object]], audit["row_changes"])
    assert len(row_changes) == 2
    by_row = {change["row_id"]: change for change in row_changes}
    assert by_row["rm_1"]["before"] == "42"
    assert by_row["rm_1"]["after"] == 42
    assert by_row["rm_2"]["before"] == "7"
    assert by_row["rm_2"]["after"] == 7
    # Truncation flag should NOT be present for a 2-row table.
    assert "row_changes_truncated" not in audit

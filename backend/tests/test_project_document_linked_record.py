"""Tests for the record-linking Phase 1 wire shape.

Covers `linked_record` enum admission, `coerce_link_value`,
`validate_link_config`, the document-level `_validate_rows_custom_links`
helper (bag exclusivity + dedupe + orphan strip + cap), and the
`linked_record_wipe` changeType path.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import cast

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from features.project_document.custom_fields import (
    CustomFieldType,
    TableFieldDef,
    coerce_link_value,
    validate_link_config,
)
from features.project_document.document import ProjectDocumentV1, PumpRow, RoomRow
from features.project_document.schema_mutations import (
    ChangeTypeMutation,
    FieldSchemaMutation,
    apply_schema_mutation,
)
from features.project_document.tables.rooms import (
    rooms_custom_fields,
    rooms_field_registry,
)
from features.projects.models import CreateProjectRequest
from features.projects.service import empty_project_document


def _empty_body() -> ProjectDocumentV1:
    return empty_project_document(
        CreateProjectRequest(
            name="t",
            bt_number="1",
            cert_programs=[],
            phius_number=None,
            phius_dropbox_url=None,
        )
    )


def _linked_record_field_def(
    *,
    field_key: str = "cf_pumps",
    display_name: str = "Pump",
    target_table_path: list[str] | None = None,
    max_links: int | None = 1,
) -> TableFieldDef:
    return TableFieldDef(
        field_key=field_key,
        display_name=display_name,
        field_type=CustomFieldType.linked_record,
        config={
            "target_table_path": target_table_path or ["equipment", "pumps"],
            "max_links": max_links,
        },
        created_at=datetime.now(UTC),
        origin="custom",
    )


class TestEnumAndHelpers:
    def test_linked_record_member_exists(self) -> None:
        assert CustomFieldType.linked_record.value == "linked_record"

    def test_coerce_link_value_dedupes_silently(self) -> None:
        assert coerce_link_value(["pmp_a", "pmp_a", "pmp_b"], max_links=None) == [
            "pmp_a",
            "pmp_b",
        ]

    def test_coerce_link_value_rejects_over_cap(self) -> None:
        with pytest.raises(ValueError, match="exceeds max_links"):
            coerce_link_value(["pmp_a", "pmp_b"], max_links=1)

    def test_coerce_link_value_rejects_non_strings(self) -> None:
        with pytest.raises(ValueError, match="must be strings"):
            coerce_link_value(["pmp_a", 42], max_links=None)

    def test_coerce_link_value_treats_none_as_empty(self) -> None:
        assert coerce_link_value(None, max_links=None) == []

    def test_validate_link_config_accepts_valid_shape(self) -> None:
        config = validate_link_config(
            CustomFieldType.linked_record,
            {"target_table_path": ["equipment", "pumps"], "max_links": None},
        )
        assert config["target_table_path"] == ["equipment", "pumps"]
        assert config["max_links"] is None

    def test_validate_link_config_rejects_missing_target(self) -> None:
        with pytest.raises(ValueError, match="non-empty target_table_path"):
            validate_link_config(CustomFieldType.linked_record, {})

    def test_validate_link_config_rejects_disallowed_max_links(self) -> None:
        with pytest.raises(ValueError, match="max_links must be 1 or null"):
            validate_link_config(
                CustomFieldType.linked_record,
                {"target_table_path": ["equipment", "pumps"], "max_links": 5},
            )

    def test_validate_link_config_rejects_on_non_linked_record(self) -> None:
        with pytest.raises(ValueError, match="only valid for linked_record"):
            validate_link_config(
                CustomFieldType.short_text,
                {"target_table_path": ["equipment", "pumps"]},
            )


class TestFieldDefValidation:
    def test_linked_record_field_def_round_trips(self) -> None:
        field = _linked_record_field_def()
        assert field.config["target_table_path"] == ["equipment", "pumps"]

    def test_linked_record_field_def_rejects_invalid_config_at_model_validate(self) -> None:
        with pytest.raises(ValidationError):
            TableFieldDef.model_validate(
                {
                    "field_key": "cf_x",
                    "display_name": "X",
                    "field_type": "linked_record",
                    "config": {"max_links": 5},
                    "created_at": datetime.now(UTC).isoformat(),
                    "origin": "custom",
                },
            )


class TestDocumentValidation:
    def test_rooms_with_valid_custom_links_pass(self) -> None:
        body = _empty_body()
        room = RoomRow(id="rm_x")
        room.custom_links["cf_pumps"] = ["pmp_a"]
        body = body.model_copy(
            update={
                "tables": body.tables.model_copy(
                    update={
                        "rooms": body.tables.rooms.model_copy(
                            update={
                                "field_defs": [
                                    *body.tables.rooms.field_defs,
                                    _linked_record_field_def(),
                                ],
                                "rows": [room],
                            }
                        ),
                        "equipment": body.tables.equipment.model_copy(
                            update={
                                "pumps": body.tables.equipment.pumps.model_copy(
                                    update={
                                        "rows": [
                                            # Use the live PumpRow factory so a
                                            # schema migration on PumpRow
                                            # naturally fails this test.
                                            __import__(
                                                "features.project_document.document",
                                                fromlist=["PumpRow"],
                                            ).PumpRow(id="pmp_a")
                                        ]
                                    }
                                )
                            }
                        ),
                    }
                )
            }
        )
        revalidated = ProjectDocumentV1.model_validate(body.model_dump(mode="json"))
        assert revalidated.tables.rooms.rows[0].custom_links["cf_pumps"] == ["pmp_a"]

    def test_orphan_link_ids_are_silently_stripped(self) -> None:
        body = _empty_body()
        room = RoomRow(id="rm_x")
        room.custom_links["cf_pumps"] = ["pmp_missing"]
        body = body.model_copy(
            update={
                "tables": body.tables.model_copy(
                    update={
                        "rooms": body.tables.rooms.model_copy(
                            update={
                                "field_defs": [
                                    *body.tables.rooms.field_defs,
                                    _linked_record_field_def(max_links=None),
                                ],
                                "rows": [room],
                            }
                        )
                    }
                )
            }
        )
        revalidated = ProjectDocumentV1.model_validate(body.model_dump(mode="json"))
        assert revalidated.tables.rooms.rows[0].custom_links["cf_pumps"] == []

    def test_self_targeting_linked_record_field_rejects(self) -> None:
        body = _empty_body()
        bad_field = _linked_record_field_def(
            field_key="cf_self",
            display_name="Self",
            target_table_path=["rooms"],
        )
        next_body = body.model_copy(
            update={
                "tables": body.tables.model_copy(
                    update={
                        "rooms": body.tables.rooms.model_copy(
                            update={
                                "field_defs": [
                                    *body.tables.rooms.field_defs,
                                    bad_field,
                                ],
                                "rows": [],
                            }
                        )
                    }
                )
            }
        )
        with pytest.raises(ValidationError, match="self-links are not permitted"):
            ProjectDocumentV1.model_validate(next_body.model_dump(mode="json"))

    def test_unknown_target_path_rejects(self) -> None:
        body = _empty_body()
        bad_field = _linked_record_field_def(
            field_key="cf_unknown",
            display_name="Unknown",
            target_table_path=["nope"],
        )
        next_body = body.model_copy(
            update={
                "tables": body.tables.model_copy(
                    update={
                        "rooms": body.tables.rooms.model_copy(
                            update={
                                "field_defs": [
                                    *body.tables.rooms.field_defs,
                                    bad_field,
                                ],
                                "rows": [],
                            }
                        )
                    }
                )
            }
        )
        with pytest.raises(ValidationError, match="unknown target_table_path"):
            ProjectDocumentV1.model_validate(next_body.model_dump(mode="json"))

    def test_bag_co_existence_rejects(self) -> None:
        body = _empty_body()
        room = RoomRow(id="rm_x")
        room.custom_values["cf_pumps"] = "PUMP-A"  # type: ignore[index]
        room.custom_links["cf_pumps"] = ["pmp_a"]
        next_body = body.model_copy(
            update={
                "tables": body.tables.model_copy(
                    update={
                        "rooms": body.tables.rooms.model_copy(
                            update={
                                "field_defs": [
                                    *body.tables.rooms.field_defs,
                                    _linked_record_field_def(),
                                ],
                                "rows": [room],
                            }
                        )
                    }
                )
            }
        )
        # The custom_values pass catches this first: coerce_custom_value
        # for linked_record raises ("ids are stored in custom_links").
        # Either path satisfies the bag-exclusivity invariant (PRD Q16).
        with pytest.raises(ValidationError, match="linked_record|appears in both"):
            ProjectDocumentV1.model_validate(next_body.model_dump(mode="json"))

    def test_max_links_cap_rejects(self) -> None:
        body = _empty_body()
        room = RoomRow(id="rm_x")
        room.custom_links["cf_pumps"] = ["pmp_a", "pmp_b"]
        body = body.model_copy(
            update={
                "tables": body.tables.model_copy(
                    update={
                        "rooms": body.tables.rooms.model_copy(
                            update={
                                "field_defs": [
                                    *body.tables.rooms.field_defs,
                                    _linked_record_field_def(max_links=1),
                                ],
                                "rows": [room],
                            }
                        )
                    }
                )
            }
        )
        with pytest.raises(ValidationError, match="exceeds max_links"):
            ProjectDocumentV1.model_validate(body.model_dump(mode="json"))


# ---------------------------------------------------------------------------
# changeType dispatcher (linked_record_wipe policy)
# ---------------------------------------------------------------------------


def _seed_pump(body: ProjectDocumentV1, pump_id: str = "pmp_a") -> ProjectDocumentV1:
    pumps = list(body.tables.equipment.pumps.rows)
    pumps.append(PumpRow(id=pump_id))
    return body.model_copy(
        update={
            "tables": body.tables.model_copy(
                update={
                    "equipment": body.tables.equipment.model_copy(
                        update={"pumps": body.tables.equipment.pumps.model_copy(update={"rows": pumps})}
                    )
                }
            )
        }
    )


def _seed_room_with_links(
    body: ProjectDocumentV1,
    *,
    room_id: str,
    field_key: str,
    pump_ids: list[str],
) -> ProjectDocumentV1:
    room = RoomRow(id=room_id)
    if pump_ids:
        room.custom_links[field_key] = list(pump_ids)
    rooms = [*body.tables.rooms.rows, room]
    return body.model_copy(
        update={
            "tables": body.tables.model_copy(update={"rooms": body.tables.rooms.model_copy(update={"rows": rooms})})
        }
    )


def _seed_linked_field(body: ProjectDocumentV1, field: TableFieldDef) -> ProjectDocumentV1:
    return rooms_field_registry.replace_field_defs(
        body,
        [*rooms_field_registry.read_field_defs(body), field],
    )


def _to_short_text_target(field: TableFieldDef) -> TableFieldDef:
    return TableFieldDef(
        field_key=field.field_key,
        display_name=field.display_name,
        field_type=CustomFieldType.short_text,
        config={},
        description=field.description,
        origin=field.origin,
        created_at=field.created_at,
        created_by=field.created_by,
    )


def _apply_mutation(
    body: ProjectDocumentV1, mutation: FieldSchemaMutation
) -> tuple[ProjectDocumentV1, dict[str, object]]:
    return apply_schema_mutation(
        body,
        mutation,
        actor_user_id="user_test",
        capability=rooms_custom_fields,
    )


class TestChangeTypeDispatcher:
    def test_linked_record_to_short_text_requires_acknowledge(self) -> None:
        body = _seed_pump(_empty_body(), pump_id="pmp_a")
        body = _seed_linked_field(body, _linked_record_field_def())
        body = _seed_room_with_links(body, room_id="rm_1", field_key="cf_pumps", pump_ids=["pmp_a"])
        existing = next(f for f in rooms_field_registry.read_field_defs(body) if f.field_key == "cf_pumps")
        mutation = ChangeTypeMutation(
            kind="changeType",
            table_key="rooms",
            field_id="cf_pumps",
            after=_to_short_text_target(existing),
            expected_schema_fingerprint=rooms_custom_fields.compute_schema_fingerprint(body),
        )
        with pytest.raises(HTTPException) as excinfo:
            _apply_mutation(body, mutation)
        assert excinfo.value.status_code == 422
        detail = cast(dict[str, object], excinfo.value.detail)
        assert detail["error_code"] == "custom_field_coercion_preflight_required"
        details = cast(dict[str, object], detail["details"])
        assert details["incompatible_row_count"] == 1

    def test_linked_record_to_short_text_wipes_both_bags(self) -> None:
        body = _seed_pump(_empty_body(), pump_id="pmp_a")
        body = _seed_linked_field(body, _linked_record_field_def())
        body = _seed_room_with_links(body, room_id="rm_1", field_key="cf_pumps", pump_ids=["pmp_a"])
        body = _seed_room_with_links(body, room_id="rm_2", field_key="cf_pumps", pump_ids=[])
        existing = next(f for f in rooms_field_registry.read_field_defs(body) if f.field_key == "cf_pumps")
        mutation = ChangeTypeMutation(
            kind="changeType",
            table_key="rooms",
            field_id="cf_pumps",
            after=_to_short_text_target(existing),
            acknowledge_destructive=True,
            expected_schema_fingerprint=rooms_custom_fields.compute_schema_fingerprint(body),
        )
        next_body, audit = _apply_mutation(body, mutation)
        assert audit["cleared_row_count"] == 1
        assert audit["compatible_row_count"] == 1
        for row in next_body.tables.rooms.rows:
            assert "cf_pumps" not in row.custom_links
            assert "cf_pumps" not in row.custom_values
        new_field = next(f for f in rooms_field_registry.read_field_defs(next_body) if f.field_key == "cf_pumps")
        assert new_field.field_type is CustomFieldType.short_text

    def test_short_text_to_linked_record_wipes_custom_values(self) -> None:
        body = _seed_pump(_empty_body(), pump_id="pmp_a")
        text_field = TableFieldDef(
            field_key="cf_note",
            display_name="Note",
            field_type=CustomFieldType.short_text,
            config={},
            created_at=datetime.now(UTC),
            origin="custom",
        )
        body = _seed_linked_field(body, text_field)
        room = RoomRow(id="rm_1")
        room.custom_values["cf_note"] = "hello"  # type: ignore[assignment]
        body = body.model_copy(
            update={
                "tables": body.tables.model_copy(
                    update={"rooms": body.tables.rooms.model_copy(update={"rows": [*body.tables.rooms.rows, room]})}
                )
            }
        )
        after_field = TableFieldDef(
            field_key="cf_note",
            display_name="Note",
            field_type=CustomFieldType.linked_record,
            config={"target_table_path": ["equipment", "pumps"], "max_links": 1},
            description=text_field.description,
            origin=text_field.origin,
            created_at=text_field.created_at,
            created_by=text_field.created_by,
        )
        mutation = ChangeTypeMutation(
            kind="changeType",
            table_key="rooms",
            field_id="cf_note",
            after=after_field,
            acknowledge_destructive=True,
            expected_schema_fingerprint=rooms_custom_fields.compute_schema_fingerprint(body),
        )
        next_body, audit = _apply_mutation(body, mutation)
        assert audit["cleared_row_count"] == 1
        for row in next_body.tables.rooms.rows:
            assert "cf_note" not in row.custom_values
            assert "cf_note" not in row.custom_links
        new_field = next(f for f in rooms_field_registry.read_field_defs(next_body) if f.field_key == "cf_note")
        assert new_field.field_type is CustomFieldType.linked_record

    def test_linked_record_to_short_text_clean_when_no_links(self) -> None:
        body = _seed_pump(_empty_body(), pump_id="pmp_a")
        body = _seed_linked_field(body, _linked_record_field_def())
        body = _seed_room_with_links(body, room_id="rm_1", field_key="cf_pumps", pump_ids=[])
        existing = next(f for f in rooms_field_registry.read_field_defs(body) if f.field_key == "cf_pumps")
        mutation = ChangeTypeMutation(
            kind="changeType",
            table_key="rooms",
            field_id="cf_pumps",
            after=_to_short_text_target(existing),
            expected_schema_fingerprint=rooms_custom_fields.compute_schema_fingerprint(body),
        )
        next_body, audit = _apply_mutation(body, mutation)
        assert audit["cleared_row_count"] == 0
        assert audit["compatible_row_count"] == 1
        new_field = next(f for f in rooms_field_registry.read_field_defs(next_body) if f.field_key == "cf_pumps")
        assert new_field.field_type is CustomFieldType.short_text

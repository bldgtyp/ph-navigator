"""Record-linking Phase 2 inverse-view tests."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

from features.project_document.custom_fields import CustomFieldType, TableFieldDef
from features.project_document.document import ProjectDocumentV1, PumpRow, RoomRow
from features.project_document.inverse_view import (
    build_inverse_links,
    build_snapshot_row_ids,
    inverse_fingerprint_for_table,
)
from features.project_document.tables.pumps import pumps_response
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
    max_links: int | None = None,
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


def _body_with_rooms_to_pumps() -> ProjectDocumentV1:
    body = _empty_body()
    rooms = [
        RoomRow(id="rm_a", custom_links={"cf_pumps": ["pmp_a"]}),
        RoomRow(id="rm_b", custom_links={"cf_pumps": ["pmp_a", "pmp_missing"]}),
        RoomRow(id="rm_c", custom_links={"cf_pumps": ["pmp_b"]}),
    ]
    pumps = [PumpRow(id="pmp_a"), PumpRow(id="pmp_b")]
    return body.model_copy(
        update={
            "tables": body.tables.model_copy(
                update={
                    "rooms": body.tables.rooms.model_copy(
                        update={
                            "field_defs": [*body.tables.rooms.field_defs, _linked_record_field_def()],
                            "rows": rooms,
                        }
                    ),
                    "equipment": body.tables.equipment.model_copy(
                        update={
                            "pumps": body.tables.equipment.pumps.model_copy(update={"rows": pumps}),
                        }
                    ),
                }
            )
        }
    )


def test_build_inverse_links_projects_source_rows_to_target_rows() -> None:
    inverse = build_inverse_links(_body_with_rooms_to_pumps())

    assert inverse[("equipment", "pumps")]["pmp_a"]["rooms.cf_pumps"] == ["rm_a", "rm_b"]
    assert inverse[("equipment", "pumps")]["pmp_b"]["rooms.cf_pumps"] == ["rm_c"]
    assert "pmp_missing" not in inverse[("equipment", "pumps")]


def test_build_inverse_links_keeps_multiple_source_fields_distinct() -> None:
    body = _empty_body()
    room = RoomRow(id="rm_a", custom_links={"cf_primary": ["pmp_a"], "cf_backup": ["pmp_a"]})
    body = body.model_copy(
        update={
            "tables": body.tables.model_copy(
                update={
                    "rooms": body.tables.rooms.model_copy(
                        update={
                            "field_defs": [
                                *body.tables.rooms.field_defs,
                                _linked_record_field_def(field_key="cf_primary", display_name="Primary Pump"),
                                _linked_record_field_def(field_key="cf_backup", display_name="Backup Pump"),
                            ],
                            "rows": [room],
                        }
                    ),
                    "equipment": body.tables.equipment.model_copy(
                        update={"pumps": body.tables.equipment.pumps.model_copy(update={"rows": [PumpRow(id="pmp_a")]})}
                    ),
                }
            )
        }
    )

    inverse = build_inverse_links(body)
    assert inverse[("equipment", "pumps")]["pmp_a"] == {
        "rooms.cf_primary": ["rm_a"],
        "rooms.cf_backup": ["rm_a"],
    }


def test_build_inverse_links_filters_against_explicit_snapshot_row_ids() -> None:
    body = _body_with_rooms_to_pumps()
    snapshot = build_snapshot_row_ids(body)
    snapshot[("equipment", "pumps")] = frozenset({"pmp_b"})

    inverse = build_inverse_links(body, snapshot_row_ids=snapshot)

    assert "pmp_a" not in inverse.get(("equipment", "pumps"), {})
    assert inverse[("equipment", "pumps")]["pmp_b"]["rooms.cf_pumps"] == ["rm_c"]


def test_empty_document_has_no_inverse_links() -> None:
    assert build_inverse_links(_empty_body()) == {}


def test_pumps_response_includes_inverse_overlay_and_metadata() -> None:
    body = _body_with_rooms_to_pumps()

    response = pumps_response(
        project_id=uuid4(),
        version_id=uuid4(),
        source="version",
        version_etag="v",
        draft_etag=None,
        body=body,
    )

    assert response.inverse_links["pmp_a"]["rooms.cf_pumps"] == ["rm_a", "rm_b"]
    assert response.inverse_link_fields[0].source_key == "rooms.cf_pumps"
    assert response.inverse_link_fields[0].source_table_display == "Rooms"
    assert response.inverse_link_fields[0].source_field_display_name == "Pump"
    assert response.inverse_links_fingerprint == inverse_fingerprint_for_table(body, ("equipment", "pumps"))


def test_inverse_fingerprint_changes_only_when_target_incoming_links_change() -> None:
    body = _body_with_rooms_to_pumps()
    baseline = inverse_fingerprint_for_table(body, ("equipment", "pumps"))

    value_change = body.model_copy(
        update={
            "tables": body.tables.model_copy(
                update={
                    "rooms": body.tables.rooms.model_copy(
                        update={
                            "rows": [
                                body.tables.rooms.rows[0].model_copy(update={"notes": "changed"}),
                                *body.tables.rooms.rows[1:],
                            ]
                        }
                    )
                }
            )
        }
    )
    assert inverse_fingerprint_for_table(value_change, ("equipment", "pumps")) == baseline

    link_change = body.model_copy(
        update={
            "tables": body.tables.model_copy(
                update={
                    "rooms": body.tables.rooms.model_copy(
                        update={
                            "rows": [
                                body.tables.rooms.rows[0].model_copy(update={"custom_links": {"cf_pumps": ["pmp_b"]}}),
                                *body.tables.rooms.rows[1:],
                            ]
                        }
                    )
                }
            )
        }
    )
    assert inverse_fingerprint_for_table(link_change, ("equipment", "pumps")) != baseline

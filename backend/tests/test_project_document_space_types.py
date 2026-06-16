"""Space-Types document shape and table contract tests."""

from __future__ import annotations

from typing import Any, cast

import pytest
from pydantic import ValidationError

from features.project_document.document import (
    CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION,
    ROOM_SPACE_TYPE_FIELD_KEY,
    ProjectDocumentV1,
    RoomRow,
    SpaceTypeRow,
)
from features.project_document.tables.registry import get_table_contract
from features.project_document.tables.space_types import (
    SpaceTypesSliceReplaceRequest,
    apply_space_types_replace,
    space_types_response,
)
from tests.project_document_helpers import empty_required_tables, empty_space_types_table
from tests.test_project_document import ORIGIN, create_project, signed_in_client


def saved_space_types_url(project_id: object, version_id: object) -> str:
    return f"/api/v1/projects/{project_id}/versions/{version_id}/document/tables/space_types"


def draft_space_types_url(project_id: object, version_id: object) -> str:
    return f"/api/v1/projects/{project_id}/versions/{version_id}/draft/tables/space_types"


def space_type_payload() -> dict[str, Any]:
    return {
        "field_defs": empty_space_types_table()["field_defs"],
        "space_types": [
            {
                "id": "st_corridor",
                "custom_values": {"record_id": "Corridor", "name": "Common Corridor"},
                "custom_links": {},
            }
        ],
        "single_select_options": {},
    }


def test_space_type_row_accepts_custom_values_only() -> None:
    row = SpaceTypeRow.model_validate(space_type_payload()["space_types"][0])

    assert row.id == "st_corridor"
    assert row.custom_values["record_id"] == "Corridor"


def test_new_project_document_seeds_empty_space_types_table(clean_document_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]

    saved = client.get(saved_space_types_url(project_id, version_id))

    assert saved.status_code == 200
    body = saved.json()
    assert body["space_types"] == []
    assert [field["field_key"] for field in body["field_defs"]] == ["record_id", "name"]
    assert [field["display_name"] for field in body["field_defs"]] == ["Tag", "Name"]


def test_new_project_document_seeds_rooms_space_type_link_field(clean_document_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]

    saved = client.get(f"/api/v1/projects/{project_id}/versions/{version_id}/document/tables/rooms")

    assert saved.status_code == 200
    field = next(field for field in saved.json()["field_defs"] if field["field_key"] == ROOM_SPACE_TYPE_FIELD_KEY)
    assert field["display_name"] == "Space Type"
    assert field["field_type"] == "linked_record"
    assert field["config"] == {"target_table_path": ["space_types"], "max_links": 1}


def test_space_types_replace_lazily_creates_draft(clean_document_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]
    initial = client.get(draft_space_types_url(project_id, version_id))

    updated = client.put(
        draft_space_types_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match-Version": initial.json()["version_etag"]},
        json=space_type_payload(),
    )

    assert updated.status_code == 200
    body = updated.json()
    assert body["source"] == "draft"
    assert body["draft_etag"]
    assert body["space_types"][0]["custom_values"]["record_id"] == "Corridor"


def test_space_types_rejects_unscoped_option_keys(clean_document_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]
    initial = client.get(draft_space_types_url(project_id, version_id))
    payload = space_type_payload()
    payload["single_select_options"] = {"rooms.floor_level": []}

    response = client.put(
        draft_space_types_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match-Version": initial.json()["version_etag"]},
        json=payload,
    )

    assert response.status_code == 422
    assert response.json()["error_code"] == "validation_error"


def test_space_types_contract_extracts_table_envelope() -> None:
    row = space_type_payload()["space_types"][0]
    tables = empty_required_tables()
    body = ProjectDocumentV1.model_validate(
        {
            "schema_version": CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION,
            "project": {"name": "p", "bt_number": "1", "cert_programs": []},
            "tables": {**tables, "space_types": empty_space_types_table(rows=[row])},
            "single_select_options": {"rooms.floor_level": [], "rooms.building_zone": []},
        }
    )
    contract = get_table_contract("space_types")

    extracted = cast(dict[str, Any], contract.extract_rows(body))

    assert extracted["field_defs"][0]["display_name"] == "Tag"
    assert extracted["rows"][0]["custom_values"]["name"] == "Common Corridor"


def test_space_types_reject_duplicate_tags_trim_case_insensitive() -> None:
    tables = empty_required_tables()
    first = {
        "id": "st_corridor",
        "custom_values": {"record_id": " Corridor ", "name": "Common Corridor"},
        "custom_links": {},
    }
    second = {
        "id": "st_corridor_alt",
        "custom_values": {"record_id": "corridor", "name": "Secondary Corridor"},
        "custom_links": {},
    }

    with pytest.raises(ValidationError, match="Duplicate space type Tag"):
        ProjectDocumentV1.model_validate(
            {
                "schema_version": CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION,
                "project": {"name": "p", "bt_number": "1", "cert_programs": []},
                "tables": {**tables, "space_types": empty_space_types_table(rows=[first, second])},
                "single_select_options": {"rooms.floor_level": [], "rooms.building_zone": []},
            }
        )


def test_space_types_reject_named_row_without_tag() -> None:
    tables = empty_required_tables()
    row = {
        "id": "st_corridor",
        "custom_values": {"name": "Common Corridor"},
        "custom_links": {},
    }

    with pytest.raises(ValidationError, match="requires a Tag"):
        ProjectDocumentV1.model_validate(
            {
                "schema_version": CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION,
                "project": {"name": "p", "bt_number": "1", "cert_programs": []},
                "tables": {**tables, "space_types": empty_space_types_table(rows=[row])},
                "single_select_options": {"rooms.floor_level": [], "rooms.building_zone": []},
            }
        )


def test_rooms_can_link_to_one_space_type_and_space_types_show_inverse() -> None:
    tables = empty_required_tables()
    space_type = {
        "id": "st_living",
        "custom_values": {"record_id": "LIVING", "name": "Living / Dining"},
        "custom_links": {},
    }
    room = RoomRow(id="rm_101", custom_links={ROOM_SPACE_TYPE_FIELD_KEY: ["st_living"]})
    body = ProjectDocumentV1.model_validate(
        {
            "schema_version": CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION,
            "project": {"name": "p", "bt_number": "1", "cert_programs": []},
            "tables": {
                **tables,
                "rooms": {**tables["rooms"], "rows": [room.model_dump(mode="json")]},
                "space_types": empty_space_types_table(rows=[space_type]),
            },
            "single_select_options": {"rooms.floor_level": [], "rooms.building_zone": []},
        }
    )

    response = space_types_response(
        project_id=cast(Any, "00000000-0000-0000-0000-000000000001"),
        version_id=cast(Any, "00000000-0000-0000-0000-000000000002"),
        source="version",
        version_etag="v",
        draft_etag=None,
        body=body,
    )

    assert body.tables.rooms.rows[0].custom_links[ROOM_SPACE_TYPE_FIELD_KEY] == ["st_living"]
    assert response.inverse_links["st_living"][f"rooms.{ROOM_SPACE_TYPE_FIELD_KEY}"] == ["rm_101"]
    assert response.inverse_link_fields[0].source_field_key == ROOM_SPACE_TYPE_FIELD_KEY
    assert response.inverse_link_fields[0].source_field_display_name == "Space Type"


def test_rooms_space_type_link_rejects_two_links() -> None:
    tables = empty_required_tables()
    space_types = [
        {"id": "st_living", "custom_values": {"record_id": "LIVING"}, "custom_links": {}},
        {"id": "st_bedroom", "custom_values": {"record_id": "BEDROOM"}, "custom_links": {}},
    ]
    room = RoomRow(id="rm_101", custom_links={ROOM_SPACE_TYPE_FIELD_KEY: ["st_living", "st_bedroom"]})

    with pytest.raises(ValidationError, match="exceeds max_links=1"):
        ProjectDocumentV1.model_validate(
            {
                "schema_version": CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION,
                "project": {"name": "p", "bt_number": "1", "cert_programs": []},
                "tables": {
                    **tables,
                    "rooms": {**tables["rooms"], "rows": [room.model_dump(mode="json")]},
                    "space_types": empty_space_types_table(rows=space_types),
                },
                "single_select_options": {"rooms.floor_level": [], "rooms.building_zone": []},
            }
        )


def test_rooms_space_type_link_rejects_missing_target() -> None:
    tables = empty_required_tables()
    room = RoomRow(id="rm_101", custom_links={ROOM_SPACE_TYPE_FIELD_KEY: ["st_missing"]})

    with pytest.raises(ValidationError, match="references missing target ids"):
        ProjectDocumentV1.model_validate(
            {
                "schema_version": CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION,
                "project": {"name": "p", "bt_number": "1", "cert_programs": []},
                "tables": {
                    **tables,
                    "rooms": {**tables["rooms"], "rows": [room.model_dump(mode="json")]},
                    "space_types": empty_space_types_table(),
                },
                "single_select_options": {"rooms.floor_level": [], "rooms.building_zone": []},
            }
        )


def test_space_type_delete_clears_referencing_rooms_links() -> None:
    tables = empty_required_tables()
    living = {"id": "st_living", "custom_values": {"record_id": "LIVING"}, "custom_links": {}}
    bath = {"id": "st_bath", "custom_values": {"record_id": "BATH"}, "custom_links": {}}
    rooms = [
        RoomRow(id="rm_101", custom_links={ROOM_SPACE_TYPE_FIELD_KEY: ["st_living"]}),
        RoomRow(id="rm_102", custom_links={ROOM_SPACE_TYPE_FIELD_KEY: ["st_bath"]}),
    ]
    body = ProjectDocumentV1.model_validate(
        {
            "schema_version": CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION,
            "project": {"name": "p", "bt_number": "1", "cert_programs": []},
            "tables": {
                **tables,
                "rooms": {**tables["rooms"], "rows": [room.model_dump(mode="json") for room in rooms]},
                "space_types": empty_space_types_table(rows=[living, bath]),
            },
            "single_select_options": {"rooms.floor_level": [], "rooms.building_zone": []},
        }
    )
    payload = SpaceTypesSliceReplaceRequest.model_validate(
        {
            "field_defs": body.tables.space_types.field_defs,
            "space_types": [bath],
            "single_select_options": {},
        }
    )

    updated = apply_space_types_replace(body, payload)

    assert ROOM_SPACE_TYPE_FIELD_KEY not in updated.tables.rooms.rows[0].custom_links
    assert updated.tables.rooms.rows[1].custom_links[ROOM_SPACE_TYPE_FIELD_KEY] == ["st_bath"]

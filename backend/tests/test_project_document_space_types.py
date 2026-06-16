"""Space-Types document shape and table contract tests."""

from __future__ import annotations

from typing import Any, cast

import pytest
from pydantic import ValidationError

from features.project_document.document import CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION, ProjectDocumentV1, SpaceTypeRow
from features.project_document.tables.registry import get_table_contract
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

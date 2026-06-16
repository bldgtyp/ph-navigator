"""Schema and OpenAPI endpoint contract tests."""

from __future__ import annotations

from fastapi.testclient import TestClient

from features.project_document.document import CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION
from main import app


def test_project_document_and_room_json_schemas_are_exposed() -> None:
    client = TestClient(app)

    project_schema = client.get(
        "/api/v1/schemas/project-document/v1.json",
        headers={"X-Request-ID": "schema-project"},
    )
    room_schema = client.get(
        "/api/v1/schemas/room/v1.json",
        headers={"X-Request-ID": "schema-room"},
    )

    assert project_schema.status_code == 200
    assert project_schema.headers["X-Request-ID"] == "schema-project"
    project_body = project_schema.json()
    assert project_body["title"] == "ProjectDocumentV1"
    assert project_body["properties"]["schema_version"]["const"] == CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION
    assert "ProjectDocumentTables" in project_body["$defs"]

    assert room_schema.status_code == 200
    assert room_schema.headers["X-Request-ID"] == "schema-room"
    room_body = room_schema.json()
    assert room_body["title"] == "RoomRow"
    assert room_body["required"] == ["id"]
    assert room_body["properties"]["id"]["pattern"] == "^rm_[A-Za-z0-9_-]+$"


def test_schemas_rooms_table_v1_endpoint_publishes_envelope_shape() -> None:
    client = TestClient(app)

    response = client.get(
        "/api/v1/schemas/rooms-table/v1.json",
        headers={"X-Request-ID": "schema-rooms-table"},
    )
    assert response.status_code == 200
    assert response.headers["X-Request-ID"] == "schema-rooms-table"
    body = response.json()
    assert body["title"] == "RoomsTableEnvelope"

    field_def = body["$defs"]["TableFieldDef"]
    # Plan-13 §4.7: TableFieldDef is closed — additionalProperties must be false.
    assert field_def["additionalProperties"] is False
    assert set(field_def["required"]) >= {"field_key", "display_name", "field_type", "created_at"}

    # Each row's `custom_values` dict is intentionally open (user-keyed).
    room_def = body["$defs"]["RoomRow"]
    custom_property = room_def["properties"]["custom_values"]
    assert custom_property["additionalProperties"] is not False


def test_versioned_openapi_endpoint_includes_schema_and_inspectability_routes() -> None:
    client = TestClient(app)

    response = client.get(
        "/api/v1/openapi.json",
        headers={"X-Request-ID": "openapi-schema"},
    )

    assert response.status_code == 200
    assert response.headers["X-Request-ID"] == "openapi-schema"
    body = response.json()
    assert body["info"]["title"] == "PH-Navigator V2"
    paths = body["paths"]
    assert "/api/v1/schemas/project-document/v1.json" in paths
    assert "/api/v1/schemas/room/v1.json" in paths
    assert "/api/v1/schemas/rooms-table/v1.json" in paths
    assert "/api/v1/schemas/{schema_slug}/v1.json" in paths
    assert "/api/v1/projects/{project_id}/diff" in paths
    assert "/api/v1/projects/{project_id}/versions/{version_id}/download" in paths


def test_unversioned_openapi_route_does_not_exist() -> None:
    client = TestClient(app)

    response = client.get("/openapi.json")

    assert response.status_code == 404

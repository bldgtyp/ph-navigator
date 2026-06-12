"""Project location contract tests."""

from __future__ import annotations

from typing import cast

import pytest
from fastapi.testclient import TestClient
from mcp.server.fastmcp import Context
from mcp.server.fastmcp.exceptions import ToolError

from features.project_location.mcp import tool_get_project_location
from features.project_location.models import UpdateProjectLocationRequest
from main import app
from tests.test_mcp import ORIGIN, clean_mcp_tables, create_project, signed_in_client

__all__ = ["clean_mcp_tables"]


def issue_mcp_token(client: TestClient, project_id: str) -> str:
    response = client.post(
        f"/api/v1/projects/{project_id}/mcp-tokens",
        headers={"Origin": ORIGIN},
        json={"label": "Location reader", "scopes": ["project:read"]},
    )
    assert response.status_code == 201
    return cast(str, response.json()["token"])


def test_location_model_validates_ranges_and_time_zone() -> None:
    valid = UpdateProjectLocationRequest(
        latitude=-90,
        longitude=180,
        elevation_m=9000,
        true_north_deg=359.999,
        time_zone="America/New_York",
    )
    assert valid.latitude == -90

    invalid_builders = [
        lambda: UpdateProjectLocationRequest(latitude=-90.1),
        lambda: UpdateProjectLocationRequest(longitude=180.1),
        lambda: UpdateProjectLocationRequest(elevation_m=9000.1),
        lambda: UpdateProjectLocationRequest(true_north_deg=360),
        lambda: UpdateProjectLocationRequest(time_zone="New York"),
    ]
    for build_invalid in invalid_builders:
        with pytest.raises(ValueError):
            build_invalid()


def test_public_get_returns_unset_shape(clean_mcp_tables: None) -> None:
    editor = signed_in_client()
    project = create_project(editor)

    response = TestClient(app).get(f"/api/v1/projects/{project['id']}/location")

    assert response.status_code == 200
    assert response.json() == {
        "latitude": None,
        "longitude": None,
        "elevation_m": None,
        "time_zone": None,
        "true_north_deg": None,
        "site_address": None,
        "city": None,
        "state": None,
        "epw_asset_id": None,
        "epw_source_url": None,
        "is_set": False,
        "updated_at": None,
        "epw": None,
    }


def test_editor_can_upsert_and_clear_location_fields(clean_mcp_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = cast(str, project["id"])

    created = client.put(
        f"/api/v1/projects/{project_id}/location",
        headers={"Origin": ORIGIN},
        json={
            "latitude": 42.325,
            "longitude": -73.367,
            "elevation_m": 260.0,
            "time_zone": "America/New_York",
            "true_north_deg": 12.5,
            "site_address": "West Stockbridge, MA",
            "city": "West Stockbridge",
            "state": "MA",
        },
    )

    assert created.status_code == 200
    created_body = created.json()
    assert created_body["warnings"] == []
    assert created_body["location"]["is_set"] is True
    assert created_body["location"]["latitude"] == 42.325
    assert created_body["location"]["updated_at"] is not None

    cleared = client.put(
        f"/api/v1/projects/{project_id}/location",
        headers={"Origin": ORIGIN},
        json={"elevation_m": None, "city": "  "},
    )

    assert cleared.status_code == 200
    location = cleared.json()["location"]
    assert location["latitude"] == 42.325
    assert location["elevation_m"] is None
    assert location["city"] is None
    assert location["is_set"] is True


def test_location_write_requires_editor_session(clean_mcp_tables: None) -> None:
    editor = signed_in_client()
    project = create_project(editor)

    response = TestClient(app).put(
        f"/api/v1/projects/{project['id']}/location",
        headers={"Origin": ORIGIN},
        json={"latitude": 42.0},
    )

    assert response.status_code == 401
    assert response.json()["error_code"] == "not_authenticated"


def test_mcp_get_project_location_reads_saved_location(
    clean_mcp_tables: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = cast(str, project["id"])
    saved = client.put(
        f"/api/v1/projects/{project_id}/location",
        headers={"Origin": ORIGIN},
        json={"latitude": 42.325, "longitude": -73.367, "time_zone": "America/New_York"},
    )
    assert saved.status_code == 200
    monkeypatch.setenv("PHN_MCP_TOKEN", issue_mcp_token(client, project_id))

    result = tool_get_project_location(project_id, cast(Context, None), allow_env_token=True)

    assert result["is_set"] is True
    assert result["latitude"] == 42.325
    assert result["longitude"] == -73.367
    assert result["time_zone"] == "America/New_York"


def test_mcp_get_project_location_enforces_project_scope(
    clean_mcp_tables: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = signed_in_client()
    first = create_project(client, "2426")
    second = create_project(client, "2427")
    monkeypatch.setenv("PHN_MCP_TOKEN", issue_mcp_token(client, cast(str, first["id"])))

    with pytest.raises(ToolError, match="mcp_project_scope_mismatch"):
        tool_get_project_location(cast(str, second["id"]), cast(Context, None), allow_env_token=True)

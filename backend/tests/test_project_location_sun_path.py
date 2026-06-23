"""Sun-path service contract tests.

The north-sign fixture (`test_*_north_sign_*`) is the load-bearing
correctness check for the whole sun-path line of work (D-PL-4): a wrong sign
silently rotates the diagram.
"""

from __future__ import annotations

from typing import cast

import pytest
from fastapi.testclient import TestClient
from mcp.server.fastmcp import Context
from mcp.server.fastmcp.exceptions import ToolError

from features.project_location.mcp import tool_get_project_sun_path
from features.project_location.sun_path import build_sun_path, utc_offset_hours
from main import app
from tests.test_mcp import ORIGIN, clean_mcp_tables, create_project, signed_in_client

__all__ = ["clean_mcp_tables"]

# A northern-hemisphere site (West Stockbridge, MA) -- solar noon sun is due
# south, which lands on -Y when true north is +Y.
_LAT = 42.325
_LON = -73.367


def issue_mcp_token(client: TestClient, project_id: str) -> str:
    response = client.post(
        f"/api/v1/projects/{project_id}/mcp-tokens",
        headers={"Origin": ORIGIN},
        json={"label": "Sun-path reader", "scopes": ["project:read"]},
    )
    assert response.status_code == 201
    return cast(str, response.json()["token"])


def save_location(client: TestClient, project_id: str, **fields: object) -> None:
    saved = client.put(
        f"/api/v1/projects/{project_id}/location",
        headers={"Origin": ORIGIN},
        json=fields,
    )
    assert saved.status_code == 200


# --- Pure builder -----------------------------------------------------------


def test_builder_returns_populated_diagram() -> None:
    diagram = build_sun_path(
        latitude=_LAT,
        longitude=_LON,
        elevation_m=260.0,
        true_north_deg=0.0,
        time_zone="America/New_York",
    )

    assert len(diagram.sunpath.hourly_analemma_polyline3d) > 0
    assert len(diagram.sunpath.monthly_day_arc3d) == 12
    assert len(diagram.compass.all_boundary_circles) > 0
    assert len(diagram.compass.major_azimuth_ticks) == 4


def test_builder_north_sign_is_identity() -> None:
    """`true_north_deg` maps to ladybug `north_angle` by identity (D-PL-4).

    The compass major ticks are ordered [N, E, S, W]. With true north at +Y
    (0 deg) the North tick points +Y; rotating true north to 90 deg -- which
    our stored convention calls West -- must swing the North tick to -X
    (counter-clockwise). A sign flip would send it to +X and fail here.
    """
    north_at_zero = build_sun_path(
        latitude=_LAT, longitude=_LON, elevation_m=0.0, true_north_deg=0.0, time_zone="America/New_York"
    )
    north_tick_zero = north_at_zero.compass.major_azimuth_ticks[0].p
    assert north_tick_zero[0] == pytest.approx(0.0, abs=1e-6)
    assert north_tick_zero[1] == pytest.approx(1.0, abs=1e-6)

    north_at_ninety = build_sun_path(
        latitude=_LAT, longitude=_LON, elevation_m=0.0, true_north_deg=90.0, time_zone="America/New_York"
    )
    north_tick_ninety = north_at_ninety.compass.major_azimuth_ticks[0].p
    assert north_tick_ninety[0] == pytest.approx(-1.0, abs=1e-6)
    assert north_tick_ninety[1] == pytest.approx(0.0, abs=1e-6)


def test_utc_offset_strips_daylight_saving() -> None:
    # Standard meridian offset, not the summer DST offset.
    assert utc_offset_hours("America/New_York", _LON) == -5.0
    assert utc_offset_hours("Australia/Sydney", 151.0) == 10.0
    # No zone -> the meridian implied by longitude.
    assert utc_offset_hours(None, _LON) == -5.0


# --- Route ------------------------------------------------------------------


def test_route_returns_null_without_location(clean_mcp_tables: None) -> None:
    editor = signed_in_client()
    project = create_project(editor)

    response = TestClient(app).get(f"/api/v1/projects/{project['id']}/sun-path")

    assert response.status_code == 200
    assert response.json() is None


def test_route_returns_null_when_coordinates_unset(clean_mcp_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = cast(str, project["id"])
    # Elevation set but latitude/longitude left unset -> still null.
    save_location(client, project_id, elevation_m=260.0, time_zone="America/New_York")

    response = TestClient(app).get(f"/api/v1/projects/{project_id}/sun-path")

    assert response.status_code == 200
    assert response.json() is None


def test_route_returns_diagram_for_located_project(clean_mcp_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = cast(str, project["id"])
    save_location(
        client,
        project_id,
        latitude=_LAT,
        longitude=_LON,
        elevation_m=260.0,
        true_north_deg=0.0,
        time_zone="America/New_York",
    )

    response = TestClient(app).get(f"/api/v1/projects/{project_id}/sun-path")

    assert response.status_code == 200
    assert response.headers["cache-control"] == "private, max-age=0"
    body = response.json()
    assert len(body["sunpath"]["monthly_day_arc3d"]) == 12
    assert len(body["compass"]["major_azimuth_ticks"]) == 4


# --- MCP parity -------------------------------------------------------------


def test_mcp_sun_path_matches_route(clean_mcp_tables: None, monkeypatch: pytest.MonkeyPatch) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = cast(str, project["id"])
    save_location(
        client,
        project_id,
        latitude=_LAT,
        longitude=_LON,
        elevation_m=260.0,
        true_north_deg=0.0,
        time_zone="America/New_York",
    )
    monkeypatch.setenv("PHN_MCP_TOKEN", issue_mcp_token(client, project_id))

    result = tool_get_project_sun_path(project_id, cast(Context, None), allow_env_token=True)
    route_body = TestClient(app).get(f"/api/v1/projects/{project_id}/sun-path").json()

    assert result == route_body


def test_mcp_sun_path_null_without_location(clean_mcp_tables: None, monkeypatch: pytest.MonkeyPatch) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = cast(str, project["id"])
    monkeypatch.setenv("PHN_MCP_TOKEN", issue_mcp_token(client, project_id))

    assert tool_get_project_sun_path(project_id, cast(Context, None), allow_env_token=True) is None


def test_mcp_sun_path_enforces_project_scope(clean_mcp_tables: None, monkeypatch: pytest.MonkeyPatch) -> None:
    client = signed_in_client()
    first = create_project(client, "2426")
    second = create_project(client, "2427")
    monkeypatch.setenv("PHN_MCP_TOKEN", issue_mcp_token(client, cast(str, first["id"])))

    with pytest.raises(ToolError, match="mcp_project_scope_mismatch"):
        tool_get_project_sun_path(cast(str, second["id"]), cast(Context, None), allow_env_token=True)

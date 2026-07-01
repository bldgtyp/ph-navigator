"""Sun-path service contract tests.

The north-sign fixture (`test_*_north_sign_*`) is the load-bearing
correctness check for the whole sun-path line of work (D-PL-4): a wrong sign
silently rotates the diagram.
"""

from __future__ import annotations

import math
from typing import cast

import pytest
from fastapi.testclient import TestClient
from mcp.server.fastmcp import Context
from mcp.server.fastmcp.exceptions import ToolError

from features.project_location.mcp import tool_get_project_sun_path
from features.project_location.sun_path import build_sun_path, utc_offset_hours
from features.project_location.sun_path_schemas import SunPathAndCompassDTOSchema
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


# --- Solar-position grid (sun study) ----------------------------------------


def _build_test_diagram() -> SunPathAndCompassDTOSchema:
    return build_sun_path(
        latitude=_LAT,
        longitude=_LON,
        elevation_m=260.0,
        true_north_deg=0.0,
        time_zone="America/New_York",
    )


def test_grid_shape_and_unit_length() -> None:
    grid = _build_test_diagram().sun_positions

    assert grid.hours == [float(h) for h in range(24)]
    assert grid.days == list(range(1, 366))
    assert len(grid.unit_vectors) == 365 * 24
    assert len(grid.sunrise_sunset) == 365
    # Rounded to 4 decimals, vectors stay unit length within rounding error.
    for x, y, z in grid.unit_vectors[::365]:
        assert math.hypot(x, y, z) == pytest.approx(1.0, abs=2e-4)


def test_grid_golden_summer_solstice_noon() -> None:
    """Jun 21 solar noon: altitude ~= 90 - |lat - 23.45|, azimuth due south.

    LST noon is within ~15 min of solar noon at this longitude, so the noon
    grid vector is a good proxy; tolerance covers the offset.
    """
    grid = _build_test_diagram().sun_positions
    jun_21 = 172  # day-of-year, non-leap year
    x, y, z = grid.unit_vectors[(jun_21 - 1) * 24 + 12]

    altitude_deg = math.degrees(math.asin(z))
    assert altitude_deg == pytest.approx(90.0 - abs(_LAT - 23.45), abs=1.5)
    # Due south == -Y when true north is +Y; allow the LST-vs-solar-noon skew.
    assert y < 0
    assert abs(x) < 0.12


def test_grid_below_horizon_vectors_included() -> None:
    grid = _build_test_diagram().sun_positions
    # Midnight on Jan 1: the sun is far below the horizon (z < 0), and the
    # vector is still shipped so hour interpolation stays smooth.
    x, y, z = grid.unit_vectors[0]
    assert z < -0.5


def test_grid_matches_analemma_frame() -> None:
    """The grid vector at (Jun 21, hour) coincides with the hourly-analemma
    position from the same build (locks D-2's same-frame guarantee).

    ladybug draws analemma vertices at the 21st of each month, so compare
    against a freshly-computed sun at the same datetime rather than parsing
    polyline vertices (the polylines are clipped to daytime portions).
    """
    from ladybug.location import Location
    from ladybug.sunpath import Sunpath

    diagram = _build_test_diagram()
    location = Location(latitude=_LAT, longitude=_LON, time_zone=-5.0, elevation=260.0)
    sun_path = Sunpath.from_location(location, 0.0, None)
    jun_21 = 172

    for hour in (8, 12, 16):
        grid_vector = diagram.sun_positions.unit_vectors[(jun_21 - 1) * 24 + hour]
        sun = sun_path.calculate_sun(6, 21, hour)
        point = sun.position_3d(radius=1)
        assert grid_vector[0] == pytest.approx(point.x, abs=1e-4)
        assert grid_vector[1] == pytest.approx(point.y, abs=1e-4)
        assert grid_vector[2] == pytest.approx(point.z, abs=1e-4)


def test_grid_sunrise_sunset_sanity() -> None:
    """Jun 21 at West Stockbridge: sunrise ~04:19 / sunset ~19:32 LST
    (published values are EDT = LST + 1h: ~05:17 / ~20:32)."""
    grid = _build_test_diagram().sun_positions
    sunrise, sunset = grid.sunrise_sunset[172 - 1]

    assert sunrise is not None and sunset is not None
    assert sunrise == pytest.approx(4.32, abs=0.34)  # ~20 min tolerance
    assert sunset == pytest.approx(19.53, abs=0.34)
    # Winter photoperiod is much shorter than summer.
    win_rise, win_set = grid.sunrise_sunset[355 - 1]
    assert win_rise is not None and win_set is not None
    assert (win_set - win_rise) < (sunset - sunrise) - 5.0


def test_grid_polar_latitude_tolerates_no_sunrise() -> None:
    diagram = build_sun_path(
        latitude=78.0,  # Svalbard-ish: polar night and midnight sun
        longitude=15.0,
        elevation_m=0.0,
        true_north_deg=0.0,
        time_zone=None,
    )
    pairs = diagram.sun_positions.sunrise_sunset

    assert any(sunrise is None for sunrise, _sunset in pairs)
    assert len(pairs) == 365  # schema still carries every day


def test_grid_payload_size_bounded() -> None:
    """Regression bound: the serialized diagram (dome + grid) stays under
    ~500 KB raw JSON (PRD estimated ~180 KB growth for the grid alone)."""
    diagram = _build_test_diagram()
    raw = diagram.model_dump_json()
    assert len(raw) < 500_000


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

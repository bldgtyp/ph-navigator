"""Project-scoped climate-source contract tests (Climate Phase 3b).

Covers source CRUD, per-kind validation (phius ref existence + provider match,
custom record validation, epw asset ref), project-scoping isolation,
editor/viewer gating, and MCP list parity.
"""

from __future__ import annotations

from typing import cast

import httpx
import pytest
from fastapi.testclient import TestClient
from mcp.server.fastmcp import Context

from features.climate.ashrae_meteo import AshraeMeteoResult
from features.climate.design_conditions import ClimateDesignConditions
from features.project_climate_source.mcp import tool_list_project_climate_sources
from main import app
from tests.test_climate_datasets import (
    _STATION_FILE,
    _seed_two_locations,
    clean_climate_tables,
)
from tests.test_mcp import ORIGIN, clean_mcp_tables, create_project, signed_in_client

__all__ = ["clean_climate_tables", "clean_mcp_tables"]

_SOURCES = "/api/v1/projects/{project_id}/climate/sources"


def _issue_token(client: TestClient, project_id: str, scopes: list[str]) -> str:
    response = client.post(
        f"/api/v1/projects/{project_id}/mcp-tokens",
        headers={"Origin": ORIGIN},
        json={"label": "Climate source token", "scopes": scopes},
    )
    assert response.status_code == 201
    return cast(str, response.json()["token"])


def _post(client: TestClient, project_id: str, body: dict[str, object]) -> httpx.Response:
    return client.post(_SOURCES.format(project_id=project_id), headers={"Origin": ORIGIN}, json=body)


def _create(client: TestClient, project_id: str, body: dict[str, object]) -> dict[str, object]:
    response = _post(client, project_id, body)
    assert response.status_code == 201, response.text
    return cast(dict[str, object], response.json())


def _list(client: TestClient, project_id: str) -> list[dict[str, object]]:
    response = client.get(_SOURCES.format(project_id=project_id))
    assert response.status_code == 200, response.text
    return cast(list[dict[str, object]], response.json()["items"])


def _set_location(
    client: TestClient,
    project_id: str,
    *,
    latitude: float,
    longitude: float,
    elevation_m: float | None = None,
    state: str | None = None,
) -> None:
    body: dict[str, object] = {"latitude": latitude, "longitude": longitude}
    if elevation_m is not None:
        body["elevation_m"] = elevation_m
    if state is not None:
        body["state"] = state
    response = client.put(
        f"/api/v1/projects/{project_id}/location",
        headers={"Origin": ORIGIN},
        json=body,
    )
    assert response.status_code == 200, response.text


def _first_phius_location_id(client: TestClient) -> str:
    datasets = client.get("/api/v1/climate/datasets").json()["items"]
    dataset_id = datasets[0]["id"]
    locations = client.get(f"/api/v1/climate/datasets/{dataset_id}/locations").json()["items"]
    return cast(str, locations[0]["id"])


def test_create_and_list_sources(clean_mcp_tables: None) -> None:
    client = signed_in_client()
    project_id = cast(str, create_project(client)["id"])

    first = _create(client, project_id, {"kind": "ashrae", "ref": "725060", "label": "ASHRAE A"})
    second = _create(client, project_id, {"kind": "ashrae", "ref": "725070", "label": "ASHRAE B"})
    assert "is_default" not in first
    assert "is_default" not in second

    # Sources are listed newest first.
    items = _list(client, project_id)
    assert [item["id"] for item in items] == [second["id"], first["id"]]


def test_phius_source_validates_ref_and_provider(clean_mcp_tables: None, clean_climate_tables: None) -> None:
    _seed_two_locations()
    client = signed_in_client()
    project_id = cast(str, create_project(client)["id"])
    # A manual PH attach recomputes proximity server-side, so it needs a site.
    _set_location(client, project_id, latitude=40.0, longitude=-75.0)
    location_id = _first_phius_location_id(client)

    created = _create(client, project_id, {"kind": "phius", "ref": location_id, "label": "Worcester"})
    assert created["ref"] == location_id

    missing = _post(client, project_id, {"kind": "phius", "ref": "00000000-0000-0000-0000-000000000000"})
    assert missing.status_code == 422
    assert missing.json()["error_code"] == "climate_source_ref_not_found"

    # The location is a Phius location; attaching it as a PHI source is rejected.
    mismatch = _post(client, project_id, {"kind": "phi", "ref": location_id})
    assert mismatch.status_code == 422
    assert mismatch.json()["error_code"] == "climate_source_provider_mismatch"


def test_custom_source_record_validation(clean_mcp_tables: None) -> None:
    from features.climate.importers.phius import parse_phius_mon_file

    client = signed_in_client()
    project_id = cast(str, create_project(client)["id"])

    invalid = _post(client, project_id, {"kind": "custom", "data": {"not": "a record"}})
    assert invalid.status_code == 422
    assert invalid.json()["error_code"] == "climate_source_record_invalid"

    record = parse_phius_mon_file(_STATION_FILE).model_dump(mode="json")
    created = _create(client, project_id, {"kind": "custom", "data": record, "label": "Custom site"})
    assert created["kind"] == "custom" and created["ref"] is None


def test_epw_source_requires_existing_asset(clean_mcp_tables: None) -> None:
    client = signed_in_client()
    project_id = cast(str, create_project(client)["id"])

    response = _post(client, project_id, {"kind": "epw", "ref": "asset_missing"})
    assert response.status_code == 422
    assert response.json()["error_code"] == "climate_source_ref_not_found"


def test_refresh_ashrae_design_conditions_uses_project_location(
    clean_mcp_tables: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def fake_fetch(*, latitude: float, longitude: float, ashrae_version: str) -> AshraeMeteoResult:
        assert latitude == 42.325
        assert longitude == -73.367
        assert ashrae_version == "2025"
        return AshraeMeteoResult(
            station_id="744104",
            label="PITTSFIELD MUNI AP",
            url="https://ashrae-meteo.info/v3.0/index.php?ashrae_version=2025&wmo=744104",
            design_conditions=ClimateDesignConditions(
                basis="ASHRAE Meteo 2025 / PITTSFIELD MUNI AP",
                source="ashrae-meteo",
                edition="2025",
                heating_996_db_c=-18.8,
                heating_990_db_c=-16.0,
                cooling_010_db_c=28.5,
                cooling_010_mcwb_c=20.8,
            ),
        )

    monkeypatch.setattr("features.project_climate_source.service.fetch_nearest_ashrae_station_conditions", fake_fetch)
    client = signed_in_client()
    project_id = cast(str, create_project(client)["id"])
    saved = client.put(
        f"/api/v1/projects/{project_id}/location",
        headers={"Origin": ORIGIN},
        json={"latitude": 42.325, "longitude": -73.367},
    )
    assert saved.status_code == 200

    response = client.post(
        f"{_SOURCES.format(project_id=project_id)}/ashrae/current",
        headers={"Origin": ORIGIN},
        json={"ashrae_version": "2025"},
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["kind"] == "ashrae"
    assert body["ref"] == "744104"
    assert body["data"]["provider"] == "ashrae_meteo"
    assert body["data"]["design_conditions"]["heating_996_db_c"] == -18.8


def test_sources_are_project_scoped(clean_mcp_tables: None) -> None:
    client = signed_in_client()
    project_a = cast(str, create_project(client, bt_number="2426")["id"])
    project_b = cast(str, create_project(client, bt_number="2427")["id"])

    source = _create(client, project_a, {"kind": "ashrae", "ref": "725060"})

    assert _list(client, project_b) == []

    # B's URL cannot see or mutate A's source.
    cross = client.patch(
        f"{_SOURCES.format(project_id=project_b)}/{source['id']}",
        headers={"Origin": ORIGIN},
        json={"label": "hijack"},
    )
    assert cross.status_code == 404
    cross_delete = client.delete(f"{_SOURCES.format(project_id=project_b)}/{source['id']}", headers={"Origin": ORIGIN})
    assert cross_delete.status_code == 404


def test_patch_and_delete(clean_mcp_tables: None) -> None:
    client = signed_in_client()
    project_id = cast(str, create_project(client)["id"])
    source = _create(client, project_id, {"kind": "ashrae", "ref": "725060", "label": "Before"})

    patched = client.patch(
        f"{_SOURCES.format(project_id=project_id)}/{source['id']}",
        headers={"Origin": ORIGIN},
        json={"label": "After"},
    )
    assert patched.status_code == 200
    assert patched.json()["label"] == "After"

    deleted = client.delete(f"{_SOURCES.format(project_id=project_id)}/{source['id']}", headers={"Origin": ORIGIN})
    assert deleted.status_code == 204
    assert _list(client, project_id) == []


def test_viewer_cannot_write(clean_mcp_tables: None) -> None:
    client = signed_in_client()
    project_id = cast(str, create_project(client)["id"])

    anon = TestClient(app)
    # Read is public...
    assert anon.get(_SOURCES.format(project_id=project_id)).status_code == 200
    # ...write requires an editor.
    response = _post(anon, project_id, {"kind": "ashrae", "ref": "725060"})
    assert response.status_code == 401


def test_mcp_list_project_climate_sources(clean_mcp_tables: None, monkeypatch: pytest.MonkeyPatch) -> None:
    client = signed_in_client()
    project_id = cast(str, create_project(client)["id"])
    first = _create(client, project_id, {"kind": "ashrae", "ref": "725060", "label": "A"})
    second = _create(client, project_id, {"kind": "ashrae", "ref": "725070", "label": "B"})
    ctx = cast(Context, None)

    monkeypatch.setenv("PHN_MCP_TOKEN", _issue_token(client, project_id, ["project:read", "project:write"]))

    listed = tool_list_project_climate_sources(project_id, ctx, allow_env_token=True)
    listed_items = cast(list[dict[str, object]], listed["items"])
    assert {item["id"] for item in listed_items} == {first["id"], second["id"]}

"""Project-scoped climate-source contract tests (Climate Phase 3b).

Covers source CRUD, the one-default-per-project rule, per-kind validation
(phius ref existence + provider match, custom record validation, epw asset
ref), project-scoping isolation, editor/viewer gating, and MCP parity +
scope gating for the list / set-default tools.
"""

from __future__ import annotations

from typing import cast

import httpx
import pytest
from fastapi.testclient import TestClient
from mcp.server.fastmcp import Context
from mcp.server.fastmcp.exceptions import ToolError

from features.project_climate_source.mcp import (
    tool_list_project_climate_sources,
    tool_set_project_climate_source_default,
)
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


def _first_phius_location_id(client: TestClient) -> str:
    datasets = client.get("/api/v1/climate/datasets").json()["items"]
    dataset_id = datasets[0]["id"]
    locations = client.get(f"/api/v1/climate/datasets/{dataset_id}/locations").json()["items"]
    return cast(str, locations[0]["id"])


def test_create_list_and_set_default(clean_mcp_tables: None) -> None:
    client = signed_in_client()
    project_id = cast(str, create_project(client)["id"])

    first = _create(client, project_id, {"kind": "ashrae", "ref": "725060", "label": "ASHRAE A"})
    second = _create(
        client,
        project_id,
        {"kind": "ashrae", "ref": "725070", "label": "ASHRAE B", "is_default": True},
    )
    assert first["is_default"] is False
    assert second["is_default"] is True

    # Default is listed first.
    items = _list(client, project_id)
    assert [item["id"] for item in items] == [second["id"], first["id"]]

    # Re-point the default; the prior default flips off (one default rule).
    response = client.put(
        f"{_SOURCES.format(project_id=project_id)}/{first['id']}/default",
        headers={"Origin": ORIGIN},
    )
    assert response.status_code == 200
    assert response.json()["is_default"] is True
    defaults = [item["id"] for item in _list(client, project_id) if item["is_default"]]
    assert defaults == [first["id"]]


def test_phius_source_validates_ref_and_provider(clean_mcp_tables: None, clean_climate_tables: None) -> None:
    _seed_two_locations()
    client = signed_in_client()
    project_id = cast(str, create_project(client)["id"])
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


def test_mcp_list_and_set_default(clean_mcp_tables: None, monkeypatch: pytest.MonkeyPatch) -> None:
    client = signed_in_client()
    project_id = cast(str, create_project(client)["id"])
    first = _create(client, project_id, {"kind": "ashrae", "ref": "725060", "label": "A"})
    second = _create(client, project_id, {"kind": "ashrae", "ref": "725070", "label": "B"})
    ctx = cast(Context, None)

    monkeypatch.setenv("PHN_MCP_TOKEN", _issue_token(client, project_id, ["project:read", "project:write"]))

    listed = tool_list_project_climate_sources(project_id, ctx, allow_env_token=True)
    listed_items = cast(list[dict[str, object]], listed["items"])
    assert {item["id"] for item in listed_items} == {first["id"], second["id"]}

    result = tool_set_project_climate_source_default(project_id, cast(str, second["id"]), ctx, allow_env_token=True)
    assert result["is_default"] is True
    assert [item["id"] for item in _list(client, project_id) if item["is_default"]] == [second["id"]]


def test_mcp_set_default_requires_write_scope(clean_mcp_tables: None, monkeypatch: pytest.MonkeyPatch) -> None:
    client = signed_in_client()
    project_id = cast(str, create_project(client)["id"])
    source = _create(client, project_id, {"kind": "ashrae", "ref": "725060"})
    ctx = cast(Context, None)

    monkeypatch.setenv("PHN_MCP_TOKEN", _issue_token(client, project_id, ["project:read"]))

    with pytest.raises(ToolError):
        tool_set_project_climate_source_default(project_id, cast(str, source["id"]), ctx, allow_env_token=True)

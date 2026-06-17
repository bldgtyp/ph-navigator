"""Permission and partial-failure contract tests for the MCP asset tools.

The asset tools funnel through the same ``AssetService`` the browser
uses. These tests verify the MCP wiring: read tools require
``asset:read``, write tools require ``asset:write``, insufficient scopes
raise ``mcp_scope_insufficient``, and ``bulk_attach`` / ``bulk_detach``
report per-item partial failures rather than aborting the batch.
"""

from __future__ import annotations

import hashlib
from typing import Any, cast

import pytest
from fastapi.testclient import TestClient
from mcp.server.fastmcp import Context
from mcp.server.fastmcp.exceptions import ToolError

from features.assets.routes import get_asset_service
from features.assets.service import AssetService
from features.mcp.tools import (
    tool_bulk_attach,
    tool_bulk_detach,
    tool_get_asset_url,
    tool_list_assets,
    tool_resolve_asset_urls,
    tool_start_bulk_download,
)
from features.project_document.tables.pumps import PUMPS_BUILT_IN_FIELD_DEFS
from main import app
from tests.test_assets_service import FakeR2Client, NoopThumbnailer
from tests.test_mcp import ORIGIN, clean_mcp_tables, create_project, signed_in_client

__all__ = ["clean_mcp_tables"]

PDF_MAGIC = b"%PDF-1.4\n"
CTX = cast(Context, None)


def _issue_token(client: TestClient, project_id: object, monkeypatch: pytest.MonkeyPatch, scopes: list[str]) -> None:
    issued = client.post(
        f"/api/v1/projects/{project_id}/mcp-tokens",
        headers={"Origin": ORIGIN},
        json={"label": "Assets MCP test", "scopes": scopes},
    )
    assert issued.status_code in (200, 201), issued.text
    monkeypatch.setenv("PHN_MCP_TOKEN", issued.json()["token"])


def _install_fake_service(monkeypatch: pytest.MonkeyPatch, fake_r2: FakeR2Client) -> AssetService:
    """Point both the FastAPI route DI and the MCP tools at one fake-backed service."""
    service = AssetService(fake_r2, NoopThumbnailer())
    app.dependency_overrides[get_asset_service] = lambda: service
    monkeypatch.setattr("features.mcp.tools.get_asset_service", lambda: service)
    return service


def _clear_fake_service() -> None:
    app.dependency_overrides.pop(get_asset_service, None)


def _draft_pumps_url(project_id: object, version_id: object) -> str:
    return f"/api/v1/projects/{project_id}/versions/{version_id}/draft/tables/pumps"


def _upload_pdf(client: TestClient, project_id: object, fake_r2: FakeR2Client, body: bytes, filename: str) -> str:
    intent = client.post(
        f"/api/v1/projects/{project_id}/assets/upload-intent",
        headers={"Origin": ORIGIN},
        json={
            "asset_kind": "datasheet",
            "original_filename": filename,
            "display_name": filename,
            "content_type": "application/pdf",
            "size_bytes": len(body),
            "content_hash_sha256": hashlib.sha256(body).hexdigest(),
        },
    )
    assert intent.status_code == 200, intent.text
    asset = intent.json()["asset"]
    fake_r2.put_object(asset["object_key"], body, asset["content_type"])
    complete = client.post(
        f"/api/v1/projects/{project_id}/assets/{asset['id']}/complete-upload",
        headers={"Origin": ORIGIN},
    )
    assert complete.status_code == 200, complete.text
    return str(asset["id"])


def _save_pump_row(client: TestClient, project_id: object, version_id: object, datasheet_asset_ids: list[str]) -> str:
    """Save one Pumps row into the active *version* (no lingering draft).

    The MCP bulk tools pass no draft ETag, so the attach/detach basis must
    be the saved version body, not an open draft. Returns the saved
    version ETag for ``if_match_version``.
    """
    initial = client.get(_draft_pumps_url(project_id, version_id)).json()
    row: dict[str, Any] = {
        "id": "pmp_1",
        "device_type": "opt_circ",
        "phase": 1,
        "notes": None,
        "link": None,
        "datasheet_asset_ids": datasheet_asset_ids,
        "custom_values": {
            "use": "DHW recirc",
            "record_id": "P-1",
            "manufacturer": "Taco",
            "model": "0015e3",
            "volts": 120,
            "wattage": 45,
            "flow_gpm": 15.141647136,
            "runtime_khr_yr": 2.5,
        },
    }
    put = client.put(
        _draft_pumps_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match-Version": initial["version_etag"]},
        json={
            "pumps": [row],
            "field_defs": [field.model_dump(mode="json") for field in PUMPS_BUILT_IN_FIELD_DEFS],
            "single_select_options": {
                "pumps.device_type": [{"id": "opt_circ", "label": "Circulator", "color": "#3b82f6", "order": 0}]
            },
        },
    )
    assert put.status_code == 200, put.text
    save = client.post(
        f"/api/v1/projects/{project_id}/versions/{version_id}/draft/save",
        headers={"Origin": ORIGIN, "If-Match": initial["version_etag"]},
    )
    assert save.status_code == 200, save.text
    return str(client.get(_draft_pumps_url(project_id, version_id)).json()["version_etag"])


# --------------------------- scope enforcement ----------------------------


def test_read_tools_reject_token_without_asset_read(clean_mcp_tables: None, monkeypatch: pytest.MonkeyPatch) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = cast(str, project["id"])
    _issue_token(client, project_id, monkeypatch, ["project:read"])

    with pytest.raises(ToolError, match="mcp_scope_insufficient"):
        tool_list_assets(project_id, CTX, allow_env_token=True)
    with pytest.raises(ToolError, match="mcp_scope_insufficient"):
        tool_resolve_asset_urls(project_id, ["asset_x"], CTX, allow_env_token=True)
    with pytest.raises(ToolError, match="mcp_scope_insufficient"):
        tool_get_asset_url(project_id, "asset_x", CTX, allow_env_token=True)
    with pytest.raises(ToolError, match="mcp_scope_insufficient"):
        tool_start_bulk_download(project_id, CTX, allow_env_token=True)


def test_write_tools_reject_token_without_asset_write(clean_mcp_tables: None, monkeypatch: pytest.MonkeyPatch) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = cast(str, project["id"])
    version_id = cast(str, project["active_version_id"])
    # asset:read is not enough for write tools.
    _issue_token(client, project_id, monkeypatch, ["project:read", "asset:read"])

    with pytest.raises(ToolError, match="mcp_scope_insufficient"):
        tool_bulk_attach(project_id, version_id, [], CTX, allow_env_token=True)
    with pytest.raises(ToolError, match="mcp_scope_insufficient"):
        tool_bulk_detach(project_id, version_id, [], CTX, allow_env_token=True)


def test_list_assets_allows_asset_read(clean_mcp_tables: None, monkeypatch: pytest.MonkeyPatch) -> None:
    fake_r2 = FakeR2Client()
    _install_fake_service(monkeypatch, fake_r2)
    try:
        client = signed_in_client()
        project = create_project(client)
        project_id = cast(str, project["id"])
        asset_id = _upload_pdf(client, project_id, fake_r2, PDF_MAGIC + b"alpha", "a.pdf")
        _issue_token(client, project_id, monkeypatch, ["project:read", "asset:read"])

        result = cast(dict[str, Any], tool_list_assets(project_id, CTX, allow_env_token=True))
        assert [asset["id"] for asset in result["assets"]] == [asset_id]
    finally:
        _clear_fake_service()


# --------------------------- partial failures -----------------------------


def test_bulk_attach_reports_partial_failure(clean_mcp_tables: None, monkeypatch: pytest.MonkeyPatch) -> None:
    fake_r2 = FakeR2Client()
    _install_fake_service(monkeypatch, fake_r2)
    try:
        client = signed_in_client()
        project = create_project(client)
        project_id = cast(str, project["id"])
        version_id = cast(str, project["active_version_id"])
        asset_id = _upload_pdf(client, project_id, fake_r2, PDF_MAGIC + b"alpha", "a.pdf")
        version_etag = _save_pump_row(client, project_id, version_id, [])
        _issue_token(client, project_id, monkeypatch, ["project:read", "project:write", "asset:write"])

        result = cast(
            dict[str, Any],
            tool_bulk_attach(
                project_id,
                version_id,
                [
                    {
                        "asset_id": asset_id,
                        "table_key": "pumps",
                        "row_id": "pmp_1",
                        "field_key": "datasheet_asset_ids",
                        "if_match_version": version_etag,
                    },
                    {
                        "asset_id": "asset_missing",
                        "table_key": "pumps",
                        "row_id": "pmp_1",
                        "field_key": "datasheet_asset_ids",
                        "if_match_version": version_etag,
                    },
                ],
                CTX,
                allow_env_token=True,
            ),
        )

        assert result["partial_failure"] is True
        assert result["items"][0]["ok"] is True
        assert result["items"][0]["result"]["asset_ids"] == [asset_id]
        assert result["items"][1]["ok"] is False
        assert result["items"][1]["index"] == 1
    finally:
        _clear_fake_service()


def test_bulk_detach_reports_partial_failure(clean_mcp_tables: None, monkeypatch: pytest.MonkeyPatch) -> None:
    fake_r2 = FakeR2Client()
    _install_fake_service(monkeypatch, fake_r2)
    try:
        client = signed_in_client()
        project = create_project(client)
        project_id = cast(str, project["id"])
        version_id = cast(str, project["active_version_id"])
        asset_id = _upload_pdf(client, project_id, fake_r2, PDF_MAGIC + b"alpha", "a.pdf")
        # Save the row with the asset already attached, then detach it.
        version_etag = _save_pump_row(client, project_id, version_id, [asset_id])
        _issue_token(client, project_id, monkeypatch, ["project:read", "project:write", "asset:write"])

        result = cast(
            dict[str, Any],
            tool_bulk_detach(
                project_id,
                version_id,
                [
                    {
                        "asset_id": asset_id,
                        "table_key": "pumps",
                        "row_id": "pmp_1",
                        "field_key": "datasheet_asset_ids",
                        "if_match_version": version_etag,
                    },
                    {
                        "asset_id": "asset_missing",
                        "table_key": "pumps",
                        "row_id": "pmp_1",
                        "field_key": "datasheet_asset_ids",
                        "if_match_version": version_etag,
                    },
                ],
                CTX,
                allow_env_token=True,
            ),
        )

        assert result["partial_failure"] is True
        assert result["items"][0]["ok"] is True
        assert result["items"][0]["result"]["asset_ids"] == []
        assert result["items"][1]["ok"] is False
    finally:
        _clear_fake_service()

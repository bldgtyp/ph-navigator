"""Model Viewer Phase 2: extraction job + `/model_data` artifact workflow.

Covers D-13 (upload-time geometry summary), D-15 (precomputed immutable
artifact, self-healing), and D-16 (permanent vs. transient error
taxonomy) end to end through the REST routes and the MCP tools. The pure
extraction contract (golden counts, SI wire) lives in
`test_model_viewer_extraction.py`.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, cast

import pytest
from fastapi.testclient import TestClient
from mcp.server.fastmcp import Context
from mcp.server.fastmcp.exceptions import ToolError

import features.mcp.tools_model_viewer as mcp_tools
from database import connection, transaction
from features.assets.service import AssetService
from features.model_viewer.model_data import model_data_object_key
from main import app
from tests.test_assets_service import NoopThumbnailer
from tests.test_mcp import clean_mcp_tables
from tests.test_model_viewer_files import (
    FakeR2Client,
    _files_url,
    _link_file,
    _upload_hbjson_asset,
    fake_r2,
)
from tests.test_project_document import ORIGIN, create_project, signed_in_client

__all__ = ["clean_mcp_tables", "fake_r2"]

PRIMARY_BYTES = (Path(__file__).parent / "fixtures" / "ph_nav_v2_example.hbjson").read_bytes()
# Valid JSON (passes the upload magic check) but not a parseable Model —
# the D-16 permanent-failure case, with a deliberately alien version.
JUNK_HBJSON = json.dumps({"type": "Model", "identifier": "junk", "version": "99.0.0"}).encode()


def _linked_file(
    client: TestClient,
    storage: FakeR2Client,
    project_id: object,
    body: bytes,
    filename: str = "model.hbjson",
) -> dict[str, Any]:
    asset = _upload_hbjson_asset(client, storage, project_id, body, filename)["asset"]
    response = _link_file(client, project_id, asset["id"])
    assert response.status_code == 201
    return cast(dict[str, Any], response.json())


def _model_data_url(project_id: object, file_id: object, suffix: str = "") -> str:
    return _files_url(project_id, f"/{file_id}/model_data{suffix}")


# --------------------------- extraction job --------------------------------


def test_link_runs_extraction_job_and_persists_artifact(clean_document_tables: None, fake_r2: FakeR2Client) -> None:
    """One parse at link time does both D-13 jobs: summary columns AND the
    R2 artifact. The link response itself still says 'pending' (the job
    runs after the response)."""
    client = signed_in_client()
    project = create_project(client)
    file_row = _linked_file(client, fake_r2, project["id"], PRIMARY_BYTES)
    assert file_row["extraction_status"] == "pending"

    listed = client.get(_files_url(project["id"])).json()["items"][0]
    assert listed["extraction_status"] == "success"
    assert listed["extraction_error"] is None

    with connection() as conn:
        row = conn.execute(
            """
            SELECT asset_id, extracted_volume_m3, extracted_envelope_area_m2,
                   extracted_floor_area_m2, extracted_at
            FROM project_hbjson_files WHERE id = %(id)s
            """,
            {"id": file_row["id"]},
        ).fetchone()
    assert row is not None
    assert row["extracted_volume_m3"] == pytest.approx(1129.65, abs=0.5)
    assert row["extracted_envelope_area_m2"] == pytest.approx(832.32, abs=0.5)
    assert row["extracted_floor_area_m2"] == pytest.approx(376.55, abs=0.5)
    assert row["extracted_at"] is not None
    assert model_data_object_key(row["asset_id"]) in fake_r2.objects


def test_relink_after_delete_keeps_extraction_result(clean_document_tables: None, fake_r2: FakeR2Client) -> None:
    """Restored rows keep their extraction (same bytes, same outcome) —
    the job short-circuits anything not 'pending'."""
    client = signed_in_client()
    project = create_project(client)
    first = _linked_file(client, fake_r2, project["id"], PRIMARY_BYTES)
    assert client.get(_files_url(project["id"])).json()["items"][0]["extraction_status"] == "success"

    deleted = client.delete(_files_url(project["id"], f"/{first['id']}"), headers={"Origin": ORIGIN})
    assert deleted.status_code == 204

    relinked = _linked_file(client, fake_r2, project["id"], PRIMARY_BYTES)
    assert relinked["id"] == first["id"]
    assert relinked["extraction_status"] == "success"


# ------------------------- /model_data serving -----------------------------


def test_model_data_round_trip_headers_and_payload(clean_document_tables: None, fake_r2: FakeR2Client) -> None:
    client = signed_in_client()
    project = create_project(client)
    file_row = _linked_file(client, fake_r2, project["id"], PRIMARY_BYTES)

    response = client.get(_model_data_url(project["id"], file_row["id"]))
    assert response.status_code == 200
    assert response.headers["cache-control"] == "private, max-age=31536000, immutable"
    assert response.headers["content-encoding"] == "gzip"
    etag = response.headers["etag"]

    payload = response.json()
    summary = payload["load_summary"]
    assert summary["faces_extracted"] == 25
    assert summary["spaces_extracted"] == 4
    assert summary["shade_groups_extracted"] == 5
    assert summary["air_boundaries_skipped"] == 0
    assert payload["sun_path"] is None

    # D-12: all four thermal fields, opaque + window, on the wire.
    construction = payload["faces"][0]["properties"]["energy"]["construction"]
    assert {"u_factor", "u_value", "r_factor", "r_value"} <= construction.keys()
    aperture = next(a for f in payload["faces"] for a in f["apertures"])
    window = aperture["properties"]["energy"]["construction"]
    assert {"u_factor", "u_value", "r_factor", "r_value"} <= window.keys()

    # V1 alias names for airflow (m³/s semantics asserted in extraction tests).
    assert {"_v_sup", "_v_eta", "_v_tran"} <= payload["spaces"][0]["properties"]["ph"].keys()

    revalidated = client.get(_model_data_url(project["id"], file_row["id"]), headers={"If-None-Match": etag})
    assert revalidated.status_code == 304


def test_per_feature_routes_return_model_data_subsets(clean_document_tables: None, fake_r2: FakeR2Client) -> None:
    client = signed_in_client()
    project = create_project(client)
    file_row = _linked_file(client, fake_r2, project["id"], PRIMARY_BYTES)
    bulk = client.get(_model_data_url(project["id"], file_row["id"])).json()

    for key in ("faces", "spaces", "ventilation_systems", "hot_water_systems", "shading_elements"):
        subset = client.get(_files_url(project["id"], f"/{file_row['id']}/{key}"))
        assert subset.status_code == 200
        assert subset.json() == bulk[key]


def test_anonymous_viewer_can_read_model_data(clean_document_tables: None, fake_r2: FakeR2Client) -> None:
    """US-VIEW-7 crit. 12: read endpoints are view-access (share-the-URL)."""
    editor = signed_in_client()
    project = create_project(editor)
    file_row = _linked_file(editor, fake_r2, project["id"], PRIMARY_BYTES)

    viewer = TestClient(app)
    assert viewer.get(_model_data_url(project["id"], file_row["id"])).status_code == 200
    assert viewer.get(_files_url(project["id"], f"/{file_row['id']}/spaces")).status_code == 200


def test_model_data_unknown_file_404(clean_document_tables: None, fake_r2: FakeR2Client) -> None:
    client = signed_in_client()
    project = create_project(client)
    missing = client.get(_model_data_url(project["id"], "00000000-0000-0000-0000-000000000000"))
    assert missing.status_code == 404
    assert missing.json()["error_code"] == "hbjson_file_not_found"


# --------------------------- D-16 error taxonomy ---------------------------


def test_unparseable_file_yields_permanent_error(clean_document_tables: None, fake_r2: FakeR2Client) -> None:
    client = signed_in_client()
    project = create_project(client)
    file_row = _linked_file(client, fake_r2, project["id"], JUNK_HBJSON, "junk.hbjson")

    listed = client.get(_files_url(project["id"])).json()["items"][0]
    assert listed["extraction_status"] == "failed"
    assert "99.0.0" in listed["extraction_error"]
    assert "honeybee-schema" in listed["extraction_error"]

    response = client.get(_model_data_url(project["id"], file_row["id"]))
    assert response.status_code == 422
    body = response.json()
    assert body["error_code"] == "model_data_extraction_failed"
    assert body["details"] == {"kind": "permanent"}
    assert "99.0.0" in body["message"]

    # A broken file stays manageable: rename and delete still work.
    renamed = client.patch(
        _files_url(project["id"], f"/{file_row['id']}"),
        headers={"Origin": ORIGIN},
        json={"display_name": "broken upload"},
    )
    assert renamed.status_code == 200


def test_storage_outage_is_transient_then_self_heals(
    clean_document_tables: None, fake_r2: FakeR2Client, monkeypatch: pytest.MonkeyPatch
) -> None:
    client = signed_in_client()
    project = create_project(client)
    asset = _upload_hbjson_asset(client, fake_r2, project["id"], PRIMARY_BYTES)["asset"]

    def broken_get_object(object_key: str) -> bytes:
        raise ConnectionError("simulated R2 outage")

    monkeypatch.setattr(fake_r2, "get_object", broken_get_object)
    link = _link_file(client, project["id"], asset["id"])
    assert link.status_code == 201

    # The job failed transiently: the row must stay 'pending', not 'failed'.
    listed = client.get(_files_url(project["id"])).json()["items"][0]
    assert listed["extraction_status"] == "pending"

    response = client.get(_model_data_url(project["id"], listed["id"]))
    assert response.status_code == 503
    assert response.json()["error_code"] == "model_data_unavailable"
    assert response.json()["details"] == {"kind": "transient"}

    # Outage over: the read path extracts synchronously and persists.
    monkeypatch.undo()
    healed = client.get(_model_data_url(project["id"], listed["id"]))
    assert healed.status_code == 200
    assert client.get(_files_url(project["id"])).json()["items"][0]["extraction_status"] == "success"


def test_missing_artifact_self_heals_on_read(clean_document_tables: None, fake_r2: FakeR2Client) -> None:
    """status='success' but the derived object is gone (R2 lost it, or a
    pending row the job never reached) → re-extract, persist, serve."""
    client = signed_in_client()
    project = create_project(client)
    file_row = _linked_file(client, fake_r2, project["id"], PRIMARY_BYTES)
    artifact_key = model_data_object_key(file_row["asset_id"])
    assert artifact_key in fake_r2.objects

    del fake_r2.objects[artifact_key]
    healed = client.get(_model_data_url(project["id"], file_row["id"]))
    assert healed.status_code == 200
    assert artifact_key in fake_r2.objects

    # Same again from a 'pending' row (job never ran).
    del fake_r2.objects[artifact_key]
    with transaction() as conn:
        conn.execute(
            "UPDATE project_hbjson_files SET extraction_status = 'pending', extracted_at = NULL WHERE id = %(id)s",
            {"id": file_row["id"]},
        )
    healed_again = client.get(_model_data_url(project["id"], file_row["id"]))
    assert healed_again.status_code == 200
    assert client.get(_files_url(project["id"])).json()["items"][0]["extraction_status"] == "success"


# ------------------------------- MCP tools ---------------------------------


@pytest.fixture()
def mcp_fake_asset_service(fake_r2: FakeR2Client, monkeypatch: pytest.MonkeyPatch) -> FakeR2Client:
    """The MCP tools build their own AssetService (no FastAPI DI) — point
    them at the same fake storage the REST fixture uses."""
    monkeypatch.setattr(mcp_tools, "get_asset_service", lambda: AssetService(fake_r2, NoopThumbnailer()))
    return fake_r2


def _issue_read_token(client: TestClient, project_id: object, monkeypatch: pytest.MonkeyPatch) -> None:
    issued = client.post(
        f"/api/v1/projects/{project_id}/mcp-tokens",
        headers={"Origin": ORIGIN},
        json={"label": "Model data MCP test", "scopes": ["project:read", "asset:read"]},
    )
    assert issued.status_code == 201, issued.text
    monkeypatch.setenv("PHN_MCP_TOKEN", issued.json()["token"])


def test_mcp_model_data_tools(
    clean_mcp_tables: None, mcp_fake_asset_service: FakeR2Client, monkeypatch: pytest.MonkeyPatch
) -> None:
    client = signed_in_client()
    project = create_project(client)
    file_row = _linked_file(client, mcp_fake_asset_service, project["id"], PRIMARY_BYTES)
    project_id, file_id = str(project["id"]), str(file_row["id"])
    _issue_read_token(client, project_id, monkeypatch)
    ctx = cast(Context, None)

    spaces = mcp_tools.tool_list_hbjson_spaces(project_id, file_id, ctx, allow_env_token=True)
    assert len(cast(list[Any], spaces["items"])) == 4

    faces = mcp_tools.tool_list_hbjson_faces(project_id, file_id, ctx, allow_env_token=True)
    assert len(cast(list[Any], faces["items"])) == 25

    bulk = mcp_tools.tool_get_hbjson_model_data(project_id, file_id, ctx, allow_env_token=True)
    assert cast(dict[str, Any], bulk["load_summary"])["faces_extracted"] == 25

    for tool, expected in (
        (mcp_tools.tool_list_hbjson_ventilation_systems, 1),
        (mcp_tools.tool_list_hbjson_hot_water_systems, 1),
        (mcp_tools.tool_list_hbjson_shading_elements, 5),
    ):
        result = tool(project_id, file_id, ctx, allow_env_token=True)
        assert len(cast(list[Any], result["items"])) == expected


def test_mcp_model_data_tool_reports_permanent_failure(
    clean_mcp_tables: None, mcp_fake_asset_service: FakeR2Client, monkeypatch: pytest.MonkeyPatch
) -> None:
    client = signed_in_client()
    project = create_project(client)
    file_row = _linked_file(client, mcp_fake_asset_service, project["id"], JUNK_HBJSON, "junk.hbjson")
    _issue_read_token(client, project["id"], monkeypatch)

    with pytest.raises(ToolError, match="model_data_extraction_failed"):
        mcp_tools.tool_list_hbjson_spaces(
            str(project["id"]), str(file_row["id"]), cast(Context, None), allow_env_token=True
        )

"""Contract tests for the Phase 13 MCP tools.

Read tools (list, get, drift, U-values) and the write tool
(``apply_aperture_command``) all funnel through the same services the
browser uses; these tests verify the wiring rather than re-cover the
underlying behavior.
"""

from __future__ import annotations

import json
from typing import cast

import pytest
from mcp.server.fastmcp import Context
from mcp.server.fastmcp.exceptions import ToolError
from psycopg.types.json import Jsonb

from config import settings
from database import connection, transaction
from features.apertures_mcp.tools import (
    tool_apply_aperture_command,
    tool_calculate_aperture_u_values,
    tool_get_aperture_type,
    tool_get_aperture_u_value_report,
    tool_list_aperture_types,
    tool_report_aperture_catalog_drift,
)
from features.project_document.document import ProjectDocumentV1
from features.project_document.validation import document_etag
from tests.test_mcp import ORIGIN, clean_mcp_tables, create_project, signed_in_client

__all__ = ["clean_mcp_tables"]


def _issue_token(client, project_id: str, monkeypatch: pytest.MonkeyPatch, scopes: list[str]) -> None:
    issued = client.post(
        f"/api/v1/projects/{project_id}/mcp-tokens",
        headers={"Origin": ORIGIN},
        json={"label": "Apertures MCP test", "scopes": scopes},
    )
    monkeypatch.setenv("PHN_MCP_TOKEN", issued.json()["token"])


def _seed_aperture(version_id: str) -> dict[str, object]:
    """Write a one-aperture body into the saved version and return it."""
    with connection() as conn:
        row = conn.execute(
            "SELECT body FROM project_versions WHERE id = %(version_id)s",
            {"version_id": version_id},
        ).fetchone()
    assert row is not None
    body = cast(dict[str, object], row["body"])
    tables = cast(dict[str, object], body["tables"])
    tables["apertures"] = [
        {
            "id": "apt_A",
            "name": "Type A",
            "row_heights_mm": [1000.0],
            "column_widths_mm": [1000.0],
            "elements": [
                {
                    "id": "aptel_A1",
                    "name": "One",
                    "row_span": [0, 0],
                    "column_span": [0, 0],
                    "frames": {"top": None, "right": None, "bottom": None, "left": None},
                    "glazing_id": None,
                    "operation": None,
                }
            ],
        }
    ]
    with transaction() as conn:
        conn.execute(
            "UPDATE project_versions SET body = %(body)s WHERE id = %(version_id)s",
            {"body": Jsonb(body), "version_id": version_id},
        )
    return body


# ----------------------------- read tools ---------------------------------


def test_list_aperture_types_distinguishes_total_and_glazed_element_counts(
    clean_mcp_tables: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = cast(str, project["id"])
    version_id = cast(str, project["active_version_id"])
    body = _seed_aperture(version_id)
    tables = cast(dict[str, object], body["tables"])
    aperture = cast(list[dict[str, object]], tables["apertures"])[0]
    cast(list[float], aperture["column_widths_mm"]).append(1000.0)
    cast(list[dict[str, object]], aperture["elements"]).append(
        {
            "id": "aptel_A2",
            "name": "Empty",
            "kind": "void",
            "row_span": [0, 0],
            "column_span": [1, 1],
            "frames": {"top": None, "right": None, "bottom": None, "left": None},
            "glazing_id": None,
            "operation": None,
        }
    )
    with transaction() as conn:
        conn.execute(
            "UPDATE project_versions SET body = %(body)s WHERE id = %(version_id)s",
            {"body": Jsonb(body), "version_id": version_id},
        )
    _issue_token(client, project_id, monkeypatch, ["project:read"])

    result = tool_list_aperture_types(
        project_id, version_id, cast(Context, None), allow_env_token=True, source="version"
    )
    apertures = cast(list[dict[str, object]], result["apertures"])
    assert apertures == [
        {
            "id": "apt_A",
            "name": "Type A",
            "element_count": 2,
            "glazed_element_count": 1,
        }
    ]


def test_get_aperture_type_returns_full_entry(
    clean_mcp_tables: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = cast(str, project["id"])
    version_id = cast(str, project["active_version_id"])
    _seed_aperture(version_id)
    _issue_token(client, project_id, monkeypatch, ["project:read"])

    entry = tool_get_aperture_type(
        project_id, version_id, "apt_A", cast(Context, None), allow_env_token=True, source="version"
    )
    assert entry["id"] == "apt_A"
    assert entry["name"] == "Type A"
    assert len(cast(list[object], entry["elements"])) == 1


def test_get_aperture_type_unknown_id_returns_fatal_error(
    clean_mcp_tables: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = cast(str, project["id"])
    version_id = cast(str, project["active_version_id"])
    _seed_aperture(version_id)
    _issue_token(client, project_id, monkeypatch, ["project:read"])

    with pytest.raises(ToolError, match="aperture_type_not_found"):
        tool_get_aperture_type(
            project_id,
            version_id,
            "apt_MISSING",
            cast(Context, None),
            allow_env_token=True,
            source="version",
        )


def test_calculate_aperture_u_values_returns_results_per_id(
    clean_mcp_tables: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = cast(str, project["id"])
    version_id = cast(str, project["active_version_id"])
    _seed_aperture(version_id)
    _issue_token(client, project_id, monkeypatch, ["project:read"])

    result = tool_calculate_aperture_u_values(
        project_id,
        version_id,
        cast(Context, None),
        allow_env_token=True,
        source="version",
    )
    apertures = cast(list[dict[str, object]], result["apertures"])
    assert len(apertures) == 1
    assert apertures[0]["aperture_type_id"] == "apt_A"


def test_get_aperture_u_value_report_returns_named_audit_detail(
    clean_mcp_tables: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = cast(str, project["id"])
    version_id = cast(str, project["active_version_id"])
    _seed_aperture(version_id)
    _issue_token(client, project_id, monkeypatch, ["project:read"])

    result = tool_get_aperture_u_value_report(
        project_id,
        version_id,
        cast(Context, None),
        allow_env_token=True,
        aperture_type_ids=["apt_A"],
        source="version",
    )
    apertures = cast(list[dict[str, object]], result["apertures"])
    assert len(apertures) == 1
    assert apertures[0]["name"] == "Type A"
    assert apertures[0]["unfinished_count"] == 1
    assert result["source"] == "version"

    deduplicated = tool_get_aperture_u_value_report(
        project_id,
        version_id,
        cast(Context, None),
        allow_env_token=True,
        aperture_type_ids=["apt_A", "apt_A"],
        source="version",
    )
    assert len(cast(list[object], deduplicated["apertures"])) == 1

    with pytest.raises(ToolError, match="aperture_type_filter_too_large"):
        tool_get_aperture_u_value_report(
            project_id,
            version_id,
            cast(Context, None),
            allow_env_token=True,
            aperture_type_ids=[f"apt_{index}" for index in range(101)],
            source="version",
        )


def test_report_aperture_catalog_drift_returns_empty_entries_when_clean(
    clean_mcp_tables: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = cast(str, project["id"])
    version_id = cast(str, project["active_version_id"])
    _seed_aperture(version_id)
    _issue_token(client, project_id, monkeypatch, ["project:read"])

    result = tool_report_aperture_catalog_drift(
        project_id, version_id, cast(Context, None), allow_env_token=True, source="version"
    )
    assert result == {"entries": []}


# ----------------------------- write tool ---------------------------------


def test_apply_aperture_command_renames_aperture_and_tags_audit_with_mcp(
    clean_mcp_tables: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = cast(str, project["id"])
    version_id = cast(str, project["active_version_id"])
    body = _seed_aperture(version_id)
    saved_etag = document_etag(ProjectDocumentV1.model_validate(body))
    _issue_token(client, project_id, monkeypatch, ["project:read", "project:write"])

    result = tool_apply_aperture_command(
        project_id,
        version_id,
        {"kind": "renameApertureType", "aperture_type_id": "apt_A", "new_name": "Type A MCP"},
        cast(Context, None),
        allow_env_token=True,
        if_match_version=saved_etag,
    )
    response = cast(dict[str, object], result["response"])
    audit = cast(dict[str, object], result["audit"])
    assert response["source"] == "draft"
    apertures = cast(list[dict[str, object]], response["apertures"])
    assert apertures[0]["name"] == "Type A MCP"
    assert audit["action_kind"] == "project_version_aperture_type_rename"

    with connection() as conn:
        draft = conn.execute(
            "SELECT updated_via FROM project_version_drafts WHERE version_id = %(version_id)s",
            {"version_id": version_id},
        ).fetchone()
    assert draft is not None
    assert draft["updated_via"] == "mcp"


def test_apply_aperture_command_sets_element_kind_through_mcp(
    clean_mcp_tables: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = cast(str, project["id"])
    version_id = cast(str, project["active_version_id"])
    body = _seed_aperture(version_id)
    saved_etag = document_etag(ProjectDocumentV1.model_validate(body))
    _issue_token(client, project_id, monkeypatch, ["project:read", "project:write"])

    result = tool_apply_aperture_command(
        project_id,
        version_id,
        {
            "kind": "setElementKind",
            "aperture_type_id": "apt_A",
            "element_ids": ["aptel_A1"],
            "element_kind": "void",
        },
        cast(Context, None),
        allow_env_token=True,
        if_match_version=saved_etag,
    )

    response = cast(dict[str, object], result["response"])
    apertures = cast(list[dict[str, object]], response["apertures"])
    elements = cast(list[dict[str, object]], apertures[0]["elements"])
    assert elements[0]["kind"] == "void"
    audit = cast(dict[str, object], result["audit"])
    assert audit["action_kind"] == "project_version_aperture_element_set_kind"


def test_apply_aperture_command_rejects_project_document_over_size_limit(
    clean_mcp_tables: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The shared write spine enforces the body-size guard on the aperture/MCP surface."""
    client = signed_in_client()
    project = create_project(client)
    project_id = cast(str, project["id"])
    version_id = cast(str, project["active_version_id"])
    body = _seed_aperture(version_id)
    saved_etag = document_etag(ProjectDocumentV1.model_validate(body))
    _issue_token(client, project_id, monkeypatch, ["project:read", "project:write"])
    monkeypatch.setattr(settings, "project_document_max_body_bytes", 1)

    with pytest.raises(ToolError, match="project_document_too_large"):
        tool_apply_aperture_command(
            project_id,
            version_id,
            {"kind": "renameApertureType", "aperture_type_id": "apt_A", "new_name": "Type A MCP"},
            cast(Context, None),
            allow_env_token=True,
            if_match_version=saved_etag,
        )


def test_apply_aperture_command_validation_error_is_fatal(
    clean_mcp_tables: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = cast(str, project["id"])
    version_id = cast(str, project["active_version_id"])
    _seed_aperture(version_id)
    _issue_token(client, project_id, monkeypatch, ["project:read", "project:write"])

    with pytest.raises(ToolError, match="validation_error"):
        tool_apply_aperture_command(
            project_id,
            version_id,
            {"kind": "renameApertureType"},  # missing required fields
            cast(Context, None),
            allow_env_token=True,
        )


def test_apply_aperture_command_etag_mismatch_returns_refresh_error(
    clean_mcp_tables: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = cast(str, project["id"])
    version_id = cast(str, project["active_version_id"])
    _seed_aperture(version_id)
    _issue_token(client, project_id, monkeypatch, ["project:read", "project:write"])

    with pytest.raises(ToolError, match="etag_mismatch"):
        tool_apply_aperture_command(
            project_id,
            version_id,
            {"kind": "renameApertureType", "aperture_type_id": "apt_A", "new_name": "X"},
            cast(Context, None),
            allow_env_token=True,
            if_match="stale-draft-etag",
        )


def test_apply_aperture_command_rejects_missing_catalog_frame_and_glazing_ids(
    clean_mcp_tables: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = cast(str, project["id"])
    version_id = cast(str, project["active_version_id"])
    body = _seed_aperture(version_id)
    saved_etag = document_etag(ProjectDocumentV1.model_validate(body))
    _issue_token(client, project_id, monkeypatch, ["project:read", "project:write"])

    with pytest.raises(ToolError, match="aperture_pick_catalog_row_not_found") as frame_exc:
        tool_apply_aperture_command(
            project_id,
            version_id,
            {
                "kind": "pickFrame",
                "aperture_type_id": "apt_A",
                "element_id": "aptel_A1",
                "side": "top",
                "frame": {
                    "name": "Missing Frame",
                    "width_mm": 60.0,
                    "u_value_w_m2k": 1.1,
                    "psi_g_w_mk": 0.035,
                    "catalog_origin": {
                        "catalog_table": "frame_types",
                        "catalog_record_id": "recMissingFrm0001",
                        "catalog_schema_version": 1,
                        "synced_at": "2026-10-28T00:00:00Z",
                    },
                },
            },
            cast(Context, None),
            allow_env_token=True,
            if_match_version=saved_etag,
        )
    frame_err = json.loads(str(frame_exc.value))
    assert frame_err["code"] == "aperture_pick_catalog_row_not_found"
    assert frame_err["recoverability"] == "fatal"
    assert "recMissingFrm0001" in frame_err["message"]

    with pytest.raises(ToolError, match="aperture_pick_catalog_row_not_found") as glazing_exc:
        tool_apply_aperture_command(
            project_id,
            version_id,
            {
                "kind": "pickGlazing",
                "aperture_type_id": "apt_A",
                "element_id": "aptel_A1",
                "glazing": {
                    "name": "Missing Glazing",
                    "u_value_w_m2k": 0.7,
                    "g_value": 0.45,
                    "catalog_origin": {
                        "catalog_table": "glazing_types",
                        "catalog_record_id": "recMissingGlz0001",
                        "catalog_schema_version": 1,
                        "synced_at": "2026-10-28T00:00:00Z",
                    },
                },
            },
            cast(Context, None),
            allow_env_token=True,
            if_match_version=saved_etag,
        )
    glazing_err = json.loads(str(glazing_exc.value))
    assert glazing_err["code"] == "aperture_pick_catalog_row_not_found"
    assert glazing_err["recoverability"] == "fatal"
    assert "recMissingGlz0001" in glazing_err["message"]


def test_apply_aperture_command_accepts_existing_catalog_frame_and_glazing_ids(
    clean_mcp_tables: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = cast(str, project["id"])
    version_id = cast(str, project["active_version_id"])
    body = _seed_aperture(version_id)
    saved_etag = document_etag(ProjectDocumentV1.model_validate(body))
    _issue_token(client, project_id, monkeypatch, ["project:read", "project:write"])

    with transaction() as conn:
        conn.execute(
            """
            INSERT INTO catalog_frame_types (id, name, width_mm, u_value_w_m2k, psi_g_w_mk)
            VALUES ('recLiveFrame00001', 'Live Frame', 50.0, 1.5, 0.04)
            """
        )
        conn.execute(
            """
            INSERT INTO catalog_frame_types (id, name, width_mm, u_value_w_m2k, psi_g_w_mk, deleted_at)
            VALUES ('recDeadFrame00001', 'Deleted Frame', 50.0, 1.5, 0.04, NOW())
            """
        )
        conn.execute(
            """
            INSERT INTO catalog_glazing_types (id, name, u_value_w_m2k, g_value)
            VALUES ('recLiveGlaz000001', 'Live Glazing', 1.0, 0.5)
            """
        )
        conn.execute(
            """
            INSERT INTO catalog_glazing_types (id, name, u_value_w_m2k, g_value, deleted_at)
            VALUES ('recDeadGlaz000001', 'Deleted Glazing', 1.0, 0.5, NOW())
            """
        )

    with pytest.raises(ToolError, match="aperture_pick_catalog_row_not_found") as dead_frame_exc:
        tool_apply_aperture_command(
            project_id,
            version_id,
            {
                "kind": "pickFrame",
                "aperture_type_id": "apt_A",
                "element_id": "aptel_A1",
                "side": "top",
                "frame": {
                    "name": "Deleted Frame",
                    "width_mm": 50.0,
                    "u_value_w_m2k": 1.5,
                    "psi_g_w_mk": 0.04,
                    "catalog_origin": {
                        "catalog_table": "frame_types",
                        "catalog_record_id": "recDeadFrame00001",
                        "catalog_schema_version": 1,
                        "synced_at": "2026-10-28T00:00:00Z",
                    },
                },
            },
            cast(Context, None),
            allow_env_token=True,
            if_match_version=saved_etag,
        )
    dead_frame_err = json.loads(str(dead_frame_exc.value))
    assert dead_frame_err["code"] == "aperture_pick_catalog_row_not_found"
    assert dead_frame_err["recoverability"] == "fatal"
    assert "recDeadFrame00001" in dead_frame_err["message"]

    with pytest.raises(ToolError, match="aperture_pick_catalog_row_not_found") as dead_glazing_exc:
        tool_apply_aperture_command(
            project_id,
            version_id,
            {
                "kind": "pickGlazing",
                "aperture_type_id": "apt_A",
                "element_id": "aptel_A1",
                "glazing": {
                    "name": "Deleted Glazing",
                    "u_value_w_m2k": 1.0,
                    "g_value": 0.5,
                    "catalog_origin": {
                        "catalog_table": "glazing_types",
                        "catalog_record_id": "recDeadGlaz000001",
                        "catalog_schema_version": 1,
                        "synced_at": "2026-10-28T00:00:00Z",
                    },
                },
            },
            cast(Context, None),
            allow_env_token=True,
            if_match_version=saved_etag,
        )
    dead_glazing_err = json.loads(str(dead_glazing_exc.value))
    assert dead_glazing_err["code"] == "aperture_pick_catalog_row_not_found"
    assert dead_glazing_err["recoverability"] == "fatal"
    assert "recDeadGlaz000001" in dead_glazing_err["message"]

    frame_result = tool_apply_aperture_command(
        project_id,
        version_id,
        {
            "kind": "pickFrame",
            "aperture_type_id": "apt_A",
            "element_id": "aptel_A1",
            "side": "top",
            "frame": {
                "name": "Live Frame",
                "width_mm": 50.0,
                "u_value_w_m2k": 1.5,
                "psi_g_w_mk": 0.04,
                "catalog_origin": {
                    "catalog_table": "frame_types",
                    "catalog_record_id": "recLiveFrame00001",
                    "catalog_schema_version": 1,
                    "synced_at": "2026-10-28T00:00:00Z",
                },
            },
        },
        cast(Context, None),
        allow_env_token=True,
        if_match_version=saved_etag,
    )
    frame_response = cast(dict[str, object], frame_result["response"])
    draft_etag = cast(str, frame_response["draft_etag"])

    glazing_result = tool_apply_aperture_command(
        project_id,
        version_id,
        {
            "kind": "pickGlazing",
            "aperture_type_id": "apt_A",
            "element_id": "aptel_A1",
            "glazing": {
                "name": "Live Glazing",
                "u_value_w_m2k": 1.0,
                "g_value": 0.5,
                "catalog_origin": {
                    "catalog_table": "glazing_types",
                    "catalog_record_id": "recLiveGlaz000001",
                    "catalog_schema_version": 1,
                    "synced_at": "2026-10-28T00:00:00Z",
                },
            },
        },
        cast(Context, None),
        allow_env_token=True,
        if_match=draft_etag,
    )
    glazing_response = cast(dict[str, object], glazing_result["response"])
    assert glazing_response["source"] == "draft"
    assert glazing_response["draft_etag"] != draft_etag
    apertures = cast(list[dict[str, object]], glazing_response["apertures"])
    elements = cast(list[dict[str, object]], apertures[0]["elements"])
    assigned_glazing_id = cast(str, elements[0]["glazing_id"])
    project_glazings = cast(list[dict[str, object]], glazing_response["project_glazings"])
    assigned_glazing = next(row for row in project_glazings if row["id"] == assigned_glazing_id)
    assert cast(dict[str, object], assigned_glazing["catalog_origin"])["catalog_record_id"] == "recLiveGlaz000001"


@pytest.mark.parametrize(
    ("target", "record_id", "command"),
    [
        (
            "frame",
            "recRestMissFrm001",
            {
                "kind": "pickFrame",
                "aperture_type_id": "apt_A",
                "element_id": "aptel_A1",
                "side": "top",
                "frame": {
                    "name": "Missing Frame",
                    "width_mm": 60.0,
                    "u_value_w_m2k": 1.1,
                    "psi_g_w_mk": 0.035,
                    "catalog_origin": {
                        "catalog_table": "frame_types",
                        "catalog_record_id": "recRestMissFrm001",
                        "catalog_schema_version": 1,
                        "synced_at": "2026-10-28T00:00:00Z",
                    },
                },
            },
        ),
        (
            "glazing",
            "recRestMissGlz001",
            {
                "kind": "pickGlazing",
                "aperture_type_id": "apt_A",
                "element_id": "aptel_A1",
                "glazing": {
                    "name": "Missing Glazing",
                    "u_value_w_m2k": 0.7,
                    "g_value": 0.45,
                    "catalog_origin": {
                        "catalog_table": "glazing_types",
                        "catalog_record_id": "recRestMissGlz001",
                        "catalog_schema_version": 1,
                        "synced_at": "2026-10-28T00:00:00Z",
                    },
                },
            },
        ),
    ],
)
def test_rest_aperture_command_returns_422_for_missing_catalog_pick(
    clean_mcp_tables: None,
    target: str,
    record_id: str,
    command: dict[str, object],
) -> None:
    from tests.test_project_document import ORIGIN

    client = signed_in_client()
    project = create_project(client)
    project_id = cast(str, project["id"])
    version_id = cast(str, project["active_version_id"])
    body = _seed_aperture(version_id)
    saved_etag = document_etag(ProjectDocumentV1.model_validate(body))

    response = client.post(
        f"/api/v1/projects/{project_id}/versions/{version_id}/apertures/command",
        headers={"Origin": ORIGIN, "If-Match-Version": saved_etag},
        json=command,
    )
    assert response.status_code == 422, response.text
    payload = response.json()
    assert payload["error_code"] == "aperture_pick_catalog_row_not_found"
    assert payload["details"] == {"target": target, "catalog_record_id": record_id}

"""Contract tests for the Phase 13 MCP tools.

Read tools (list, get, drift, U-values) and the write tool
(``apply_aperture_command``) all funnel through the same services the
browser uses; these tests verify the wiring rather than re-cover the
underlying behavior.
"""

from __future__ import annotations

from typing import cast

import pytest
from mcp.server.fastmcp import Context
from mcp.server.fastmcp.exceptions import ToolError
from psycopg.types.json import Jsonb

from database import connection, transaction
from features.apertures_mcp.tools import (
    tool_apply_aperture_command,
    tool_calculate_aperture_u_values,
    tool_get_aperture_type,
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


def test_list_aperture_types_returns_id_name_and_element_count(
    clean_mcp_tables: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = cast(str, project["id"])
    version_id = cast(str, project["active_version_id"])
    _seed_aperture(version_id)
    _issue_token(client, project_id, monkeypatch, ["project:read"])

    result = tool_list_aperture_types(
        project_id, version_id, cast(Context, None), allow_env_token=True, source="version"
    )
    apertures = cast(list[dict[str, object]], result["apertures"])
    assert apertures == [{"id": "apt_A", "name": "Type A", "element_count": 1}]


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

"""Contract tests for shared-catalog MCP read tools (#99, #111)."""

from __future__ import annotations

import json
from typing import cast

import pytest
from mcp.server.fastmcp.exceptions import ToolError

from database import transaction
from features.mcp.server import build_mcp_server
from tests.test_mcp import ORIGIN, clean_mcp_tables, issue_mcp_token
from tests.test_project_document import create_project, signed_in_client

__all__ = ["clean_mcp_tables"]


@pytest.mark.anyio
async def test_mcp_search_catalog_materials_filters_active_rows_and_validates_args(
    clean_mcp_tables: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = cast(str, project["id"])
    token = issue_mcp_token(client, project_id, scopes=["project:read"])
    monkeypatch.setenv("PHN_MCP_TOKEN", token)

    test_ids = ["recMcpMatIns00001", "recMcpMatIns00002", "recMcpMatMem00001", "recMcpMatDead0001"]

    def _cleanup() -> None:
        with transaction() as conn:
            conn.execute("DELETE FROM catalog_materials WHERE id = ANY(%(ids)s)", {"ids": test_ids})

    _cleanup()
    try:
        with transaction() as conn:
            conn.execute(
                """
                INSERT INTO catalog_materials (
                    id, name, category, conductivity_w_mk, density_kg_m3, source, deleted_at
                )
                VALUES
                    ('recMcpMatIns00001', 'ZIP-R Polyiso McpCatTok', 'insulation', 0.023, 32.0, 'Huber Test', NULL),
                    ('recMcpMatIns00002', 'Mineral Wool McpCatTok', 'insulation', 0.036, 45.0, 'Rockwool Test', NULL),
                    ('recMcpMatMem00001', 'Intello Plus McpCatTok', 'membrane', NULL, NULL, 'Pro Clima Test', NULL),
                    ('recMcpMatDead0001', 'ZIP-R Inactive McpCatTok', 'insulation', 0.023, 32.0, 'Huber Test', NOW())
                """
            )

        server = build_mcp_server(allow_env_token=True)

        # Case-insensitive query matches active rows only (excludes deleted_at IS NOT NULL).
        _, by_query = await server.call_tool("search_catalog_materials", {"query": "zip-r"})
        by_query_payload = cast(dict[str, object], by_query)
        items = cast(list[dict[str, object]], by_query_payload["items"])
        assert [row["id"] for row in items] == ["recMcpMatIns00001"]
        assert items[0]["name"] == "ZIP-R Polyiso McpCatTok"
        assert items[0]["category"] == "insulation"
        assert items[0]["conductivity_w_mk"] == pytest.approx(0.023)
        assert items[0]["density_kg_m3"] == pytest.approx(32.0)
        assert items[0]["source"] == "Huber Test"
        assert items[0]["is_active"] is True
        assert by_query_payload["total_matched"] == 1
        assert by_query_payload["truncated"] is False

        # Fixture-specific query matches 3 active rows across categories; category filter
        # narrows to the exact 2 insulation rows, and limit=1 truncates to 1.
        _, by_cat = await server.call_tool(
            "search_catalog_materials",
            {"category": "insulation", "query": "McpCatTok", "limit": 1},
        )
        by_cat_payload = cast(dict[str, object], by_cat)
        by_cat_items = cast(list[dict[str, object]], by_cat_payload["items"])
        assert len(by_cat_items) == 1
        assert by_cat_items[0]["category"] == "insulation"
        assert by_cat_payload["total_matched"] == 2
        assert by_cat_payload["truncated"] is True

        # Source matching works as well.
        _, by_source = await server.call_tool("search_catalog_materials", {"query": "pro clima test"})
        source_items = cast(list[dict[str, object]], cast(dict[str, object], by_source)["items"])
        assert [row["id"] for row in source_items] == ["recMcpMatMem00001"]

        # Invalid or blank category returns fatal validation_error.
        for bad_category in ("not_a_category", "", "   "):
            with pytest.raises(ToolError) as bad_cat_exc:
                await server.call_tool("search_catalog_materials", {"category": bad_category})
            bad_cat_err = json.loads(
                str(bad_cat_exc.value).removeprefix("Error executing tool search_catalog_materials: ")
            )
            assert bad_cat_err["code"] == "validation_error"
            assert bad_cat_err["recoverability"] == "fatal"
            assert bad_cat_err["details"]["field"] == "category"

        # Out-of-range limits return structured fatal validation_error; 500 is accepted.
        _, max_limit_res = await server.call_tool("search_catalog_materials", {"query": "zip-r", "limit": 500})
        assert cast(dict[str, object], max_limit_res)["total_matched"] == 1
        for bad_int_limit in (0, 501):
            with pytest.raises(ToolError) as bad_limit_exc:
                await server.call_tool("search_catalog_materials", {"limit": bad_int_limit})
            bad_limit_err = json.loads(
                str(bad_limit_exc.value).removeprefix("Error executing tool search_catalog_materials: ")
            )
            assert bad_limit_err["code"] == "validation_error"
            assert bad_limit_err["recoverability"] == "fatal"
            assert bad_limit_err["details"]["field"] == "limit"

        # Malformed non-int limits (bool / numeric string) are rejected at the tool boundary.
        for bad_limit in (True, "5"):
            with pytest.raises(ToolError):
                await server.call_tool("search_catalog_materials", {"limit": bad_limit})
    finally:
        _cleanup()


@pytest.mark.anyio
async def test_mcp_list_catalog_frame_and_glazing_types_filter_active_rows(
    clean_mcp_tables: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = cast(str, project["id"])
    token = issue_mcp_token(client, project_id, scopes=["project:read"])
    monkeypatch.setenv("PHN_MCP_TOKEN", token)

    frame_ids = [
        "recMcpFrmLive0001",
        "recMcpFrmLive0002",
        "recMcpFrmLive0003",
        "recMcpFrmLive0004",
        "recMcpFrmLive0005",
        "recMcpFrmLive0006",
        "recMcpFrmDead0001",
    ]
    glazing_ids = [
        "recMcpGlzLive0001",
        "recMcpGlzLive0002",
        "recMcpGlzLive0003",
        "recMcpGlzDead0001",
    ]

    def _cleanup() -> None:
        with transaction() as conn:
            conn.execute("DELETE FROM catalog_frame_types WHERE id = ANY(%(ids)s)", {"ids": frame_ids})
            conn.execute("DELETE FROM catalog_glazing_types WHERE id = ANY(%(ids)s)", {"ids": glazing_ids})

    _cleanup()
    try:
        with transaction() as conn:
            conn.execute(
                """
                INSERT INTO catalog_frame_types (
                    id, name, manufacturer, brand, location, operation, use,
                    width_mm, u_value_w_m2k, psi_g_w_mk, deleted_at
                )
                VALUES
                    (
                        'recMcpFrmLive0001', 'McpFrmTok Alpha Head', 'AlphaMfg', 'McpSeries1',
                        'Head', 'Fixed', 'Window', 70.0, 1.1, 0.035, NULL
                    ),
                    (
                        'recMcpFrmLive0002', 'McpFrmTok Beta Head', 'BetaMfg', 'McpSeries1',
                        'Head', 'Fixed', 'Window', 70.0, 1.1, 0.035, NULL
                    ),
                    (
                        'recMcpFrmLive0003', 'McpFrmTok Alpha Sill', 'AlphaMfg', 'McpSeries1',
                        'Sill', 'Fixed', 'Window', 70.0, 1.1, 0.035, NULL
                    ),
                    (
                        'recMcpFrmLive0004', 'McpFrmTok Alpha Casement', 'AlphaMfg', 'McpSeries1',
                        'Head', 'Casement', 'Window', 70.0, 1.1, 0.035, NULL
                    ),
                    (
                        'recMcpFrmLive0005', 'McpFrmTok Alpha Door', 'AlphaMfg', 'McpSeries1',
                        'Head', 'Fixed', 'Door', 70.0, 1.1, 0.035, NULL
                    ),
                    (
                        'recMcpFrmLive0006', 'McpFrmTok Alpha OtherBrand', 'AlphaMfg', 'McpSeries2',
                        'Head', 'Fixed', 'Window', 70.0, 1.1, 0.035, NULL
                    ),
                    (
                        'recMcpFrmDead0001', 'McpFrmTok Alpha Dead', 'AlphaMfg', 'McpSeries1',
                        'Head', 'Fixed', 'Window', 70.0, 1.1, 0.035, NOW()
                    )
                """
            )
            conn.execute(
                """
                INSERT INTO catalog_glazing_types (
                    id, name, manufacturer, brand, u_value_w_m2k, g_value, deleted_at
                )
                VALUES
                    ('recMcpGlzLive0001', 'McpGlzTok Triple', 'AlphaMfg', 'LowE', 0.65, 0.42, NULL),
                    ('recMcpGlzLive0002', 'McpGlzTok Triple', 'BetaMfg', 'LowE', 0.65, 0.42, NULL),
                    ('recMcpGlzLive0003', 'McpGlzTok Double', 'AlphaMfg', 'LowE', 1.10, 0.55, NULL),
                    ('recMcpGlzDead0001', 'McpGlzTok Triple', 'AlphaMfg', 'LowE', 0.65, 0.42, NOW())
                """
            )

        server = build_mcp_server(allow_env_token=True)

        # Discriminating frame filter: each non-matching row fails exactly one predicate.
        _, frame_res = await server.call_tool(
            "list_catalog_frame_types",
            {
                "manufacturers": ["AlphaMfg"],
                "location": "Head",
                "operation": "Fixed",
                "use": "Window",
                "query": "mcpseries1",
            },
        )
        frame_payload = cast(dict[str, object], frame_res)
        frame_items = cast(list[dict[str, object]], frame_payload["items"])
        assert frame_payload["catalog_schema_version"] == 1
        assert [row["id"] for row in frame_items] == ["recMcpFrmLive0001"]
        assert frame_items[0]["u_value_w_m2k"] == pytest.approx(1.1)
        assert frame_payload["total_matched"] == 1
        assert frame_payload["truncated"] is False

        # Empty manufacturer allow-list returns 0 rows; omitted manufacturers returns both active manufacturers.
        _, frame_empty = await server.call_tool(
            "list_catalog_frame_types",
            {"manufacturers": [], "query": "McpFrmTok"},
        )
        frame_empty_payload = cast(dict[str, object], frame_empty)
        assert frame_empty_payload["items"] == []
        assert frame_empty_payload["total_matched"] == 0

        _, frame_unfiltered = await server.call_tool(
            "list_catalog_frame_types",
            {"location": "Head", "operation": "Fixed", "use": "Window", "query": "mcpseries1"},
        )
        frame_unfiltered_ids = {
            cast(str, row["id"])
            for row in cast(list[dict[str, object]], cast(dict[str, object], frame_unfiltered)["items"])
        }
        assert frame_unfiltered_ids == {"recMcpFrmLive0001", "recMcpFrmLive0002"}

        # Discriminating glazing filter: inactive row matches both query and manufacturer.
        _, glazing_res = await server.call_tool(
            "list_catalog_glazing_types",
            {"manufacturers": ["AlphaMfg"], "query": "McpGlzTok Triple"},
        )
        glazing_payload = cast(dict[str, object], glazing_res)
        glazing_items = cast(list[dict[str, object]], glazing_payload["items"])
        assert glazing_payload["catalog_schema_version"] == 1
        assert [row["id"] for row in glazing_items] == ["recMcpGlzLive0001"]
        assert glazing_items[0]["g_value"] == pytest.approx(0.42)
        assert glazing_payload["total_matched"] == 1
        assert glazing_payload["truncated"] is False

        # Empty manufacturer allow-list returns 0 rows; omitted returns both active manufacturers.
        _, glazing_empty = await server.call_tool(
            "list_catalog_glazing_types",
            {"manufacturers": [], "query": "McpGlzTok"},
        )
        glazing_empty_payload = cast(dict[str, object], glazing_empty)
        assert glazing_empty_payload["items"] == []
        assert glazing_empty_payload["total_matched"] == 0

        _, glazing_unfiltered = await server.call_tool(
            "list_catalog_glazing_types",
            {"query": "McpGlzTok Triple"},
        )
        glazing_unfiltered_ids = {
            cast(str, row["id"])
            for row in cast(list[dict[str, object]], cast(dict[str, object], glazing_unfiltered)["items"])
        }
        assert glazing_unfiltered_ids == {"recMcpGlzLive0001", "recMcpGlzLive0002"}

        # Truncation on two-match fixtures with limit=1, plus 0/500/501 bounds and malformed limits.
        _, frame_trunc = await server.call_tool(
            "list_catalog_frame_types",
            {"location": "Head", "operation": "Fixed", "use": "Window", "query": "mcpseries1", "limit": 1},
        )
        frame_trunc_payload = cast(dict[str, object], frame_trunc)
        assert len(cast(list[object], frame_trunc_payload["items"])) == 1
        assert frame_trunc_payload["total_matched"] == 2
        assert frame_trunc_payload["truncated"] is True

        _, glazing_trunc = await server.call_tool(
            "list_catalog_glazing_types",
            {"query": "McpGlzTok Triple", "limit": 1},
        )
        glazing_trunc_payload = cast(dict[str, object], glazing_trunc)
        assert len(cast(list[object], glazing_trunc_payload["items"])) == 1
        assert glazing_trunc_payload["total_matched"] == 2
        assert glazing_trunc_payload["truncated"] is True

        for tool_name in ("list_catalog_frame_types", "list_catalog_glazing_types"):
            _, max_res = await server.call_tool(tool_name, {"limit": 500})
            assert isinstance(cast(dict[str, object], max_res)["items"], list)
            for bad_int_limit in (0, 501):
                with pytest.raises(ToolError) as bad_limit_exc:
                    await server.call_tool(tool_name, {"limit": bad_int_limit})
                bad_limit_err = json.loads(str(bad_limit_exc.value).removeprefix(f"Error executing tool {tool_name}: "))
                assert bad_limit_err["code"] == "validation_error"
                assert bad_limit_err["recoverability"] == "fatal"
                assert bad_limit_err["details"]["field"] == "limit"
            for bad_limit in (True, "5"):
                with pytest.raises(ToolError):
                    await server.call_tool(tool_name, {"limit": bad_limit})
    finally:
        _cleanup()


@pytest.mark.anyio
async def test_mcp_catalog_tools_reject_missing_and_revoked_tokens(
    clean_mcp_tables: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = cast(str, project["id"])
    issued = client.post(
        f"/api/v1/projects/{project_id}/mcp-tokens",
        headers={"Origin": ORIGIN},
        json={"label": "Catalog Auth Test", "scopes": ["project:read"]},
    )
    assert issued.status_code == 201
    token_id = cast(str, issued.json()["token_record"]["id"])
    token = cast(str, issued.json()["token"])

    server = build_mcp_server(allow_env_token=True)

    # Missing token is rejected on all three catalog tools.
    monkeypatch.delenv("PHN_MCP_TOKEN", raising=False)
    for tool_name in ("search_catalog_materials", "list_catalog_frame_types", "list_catalog_glazing_types"):
        with pytest.raises(ToolError) as missing_exc:
            await server.call_tool(tool_name, {})
        missing_err = json.loads(str(missing_exc.value).removeprefix(f"Error executing tool {tool_name}: "))
        assert missing_err["code"] == "not_authenticated"

    # Revoked token is rejected on all three catalog tools.
    revoked = client.post(
        f"/api/v1/projects/{project_id}/mcp-tokens/{token_id}/revoke",
        headers={"Origin": ORIGIN},
    )
    assert revoked.status_code == 200
    monkeypatch.setenv("PHN_MCP_TOKEN", token)
    for tool_name in ("search_catalog_materials", "list_catalog_frame_types", "list_catalog_glazing_types"):
        with pytest.raises(ToolError) as revoked_exc:
            await server.call_tool(tool_name, {})
        revoked_err = json.loads(str(revoked_exc.value).removeprefix(f"Error executing tool {tool_name}: "))
        assert revoked_err["code"] == "not_authenticated"

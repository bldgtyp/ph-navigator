"""Contract tests for shared-catalog MCP read tools (#99, #111)."""

from __future__ import annotations

import json
from typing import cast

import pytest
from mcp.server.fastmcp.exceptions import ToolError

from database import transaction
from features.mcp.server import build_mcp_server
from tests.test_mcp import clean_mcp_tables, issue_mcp_token
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
                    ('recMcpMatIns00001', 'ZIP-R Polyiso Test', 'insulation', 0.023, 32.0, 'Huber Test', NULL),
                    ('recMcpMatIns00002', 'Mineral Wool Test', 'insulation', 0.036, 45.0, 'Rockwool Test', NULL),
                    ('recMcpMatMem00001', 'Intello Plus Test', 'membrane', NULL, NULL, 'Pro Clima Test', NULL),
                    ('recMcpMatDead0001', 'ZIP-R Inactive Test', 'insulation', 0.023, 32.0, 'Huber Test', NOW())
                """
            )

        server = build_mcp_server(allow_env_token=True)

        # Case-insensitive query matches active rows only (excludes is_active=FALSE).
        _, by_query = await server.call_tool("search_catalog_materials", {"query": "zip-r"})
        by_query_payload = cast(dict[str, object], by_query)
        items = cast(list[dict[str, object]], by_query_payload["items"])
        assert [row["id"] for row in items] == ["recMcpMatIns00001"]
        assert items[0]["name"] == "ZIP-R Polyiso Test"
        assert items[0]["category"] == "insulation"
        assert items[0]["conductivity_w_mk"] == pytest.approx(0.023)
        assert items[0]["density_kg_m3"] == pytest.approx(32.0)
        assert items[0]["source"] == "Huber Test"
        assert items[0]["is_active"] is True
        assert by_query_payload["total_matched"] == 1
        assert by_query_payload["truncated"] is False

        # Category filter + limit truncation.
        _, by_cat = await server.call_tool(
            "search_catalog_materials",
            {"category": "insulation", "query": "Test", "limit": 1},
        )
        by_cat_payload = cast(dict[str, object], by_cat)
        assert len(cast(list[object], by_cat_payload["items"])) == 1
        assert cast(int, by_cat_payload["total_matched"]) >= 2
        assert by_cat_payload["truncated"] is True

        # Source matching works as well.
        _, by_source = await server.call_tool("search_catalog_materials", {"query": "pro clima test"})
        source_items = cast(list[dict[str, object]], cast(dict[str, object], by_source)["items"])
        assert [row["id"] for row in source_items] == ["recMcpMatMem00001"]

        # Invalid category returns fatal validation_error.
        with pytest.raises(ToolError) as bad_cat_exc:
            await server.call_tool("search_catalog_materials", {"category": "not_a_category"})
        bad_cat_err = json.loads(str(bad_cat_exc.value).removeprefix("Error executing tool search_catalog_materials: "))
        assert bad_cat_err["code"] == "validation_error"
        assert bad_cat_err["recoverability"] == "fatal"
        assert bad_cat_err["details"]["field"] == "category"

        # Invalid limit returns fatal validation_error.
        with pytest.raises(ToolError) as bad_limit_exc:
            await server.call_tool("search_catalog_materials", {"limit": 0})
        bad_limit_err = json.loads(
            str(bad_limit_exc.value).removeprefix("Error executing tool search_catalog_materials: ")
        )
        assert bad_limit_err["code"] == "validation_error"
        assert bad_limit_err["recoverability"] == "fatal"
        assert bad_limit_err["details"]["field"] == "limit"
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

    frame_ids = ["recMcpFrmLive0001", "recMcpFrmLive0002", "recMcpFrmDead0001"]
    glazing_ids = ["recMcpGlzLive0001", "recMcpGlzDead0001"]

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
                        'recMcpFrmLive0001', 'Alpha Head Test', 'AlphaMfg', 'Series1',
                        'Head', 'Fixed', 'Window', 70.0, 1.1, 0.035, NULL
                    ),
                    (
                        'recMcpFrmLive0002', 'Beta Sill Test', 'BetaMfg', 'Series2',
                        'Sill', 'Casement', 'Window', 80.0, 1.2, 0.04, NULL
                    ),
                    (
                        'recMcpFrmDead0001', 'Alpha Dead Test', 'AlphaMfg', 'Series1',
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
                    ('recMcpGlzLive0001', 'Alpha Triple Test', 'AlphaMfg', 'LowE', 0.65, 0.42, NULL),
                    ('recMcpGlzDead0001', 'Alpha Dead Glazing', 'AlphaMfg', 'LowE', 0.65, 0.42, NOW())
                """
            )

        server = build_mcp_server(allow_env_token=True)

        _, frame_res = await server.call_tool(
            "list_catalog_frame_types",
            {"manufacturers": ["AlphaMfg"], "location": "Head", "query": "series1"},
        )
        frame_payload = cast(dict[str, object], frame_res)
        frame_items = cast(list[dict[str, object]], frame_payload["items"])
        assert frame_payload["catalog_schema_version"] == 1
        assert [row["id"] for row in frame_items] == ["recMcpFrmLive0001"]
        assert frame_items[0]["u_value_w_m2k"] == pytest.approx(1.1)
        assert frame_payload["total_matched"] == 1
        assert frame_payload["truncated"] is False

        _, glazing_res = await server.call_tool(
            "list_catalog_glazing_types",
            {"manufacturers": ["AlphaMfg"], "query": "triple"},
        )
        glazing_payload = cast(dict[str, object], glazing_res)
        glazing_items = cast(list[dict[str, object]], glazing_payload["items"])
        assert glazing_payload["catalog_schema_version"] == 1
        assert [row["id"] for row in glazing_items] == ["recMcpGlzLive0001"]
        assert glazing_items[0]["g_value"] == pytest.approx(0.42)
        assert glazing_payload["total_matched"] == 1
        assert glazing_payload["truncated"] is False
    finally:
        _cleanup()

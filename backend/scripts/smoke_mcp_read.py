"""Smoke a PH-Navigator MCP read-only token against Streamable HTTP."""

from __future__ import annotations

import argparse
import asyncio
import json
from pathlib import Path
from typing import Any, cast

import httpx
from mcp import ClientSession
from mcp.client.streamable_http import streamable_http_client
from mcp.types import TextContent


def expected_tool_names() -> set[str]:
    doc_path = Path(__file__).resolve().parents[2] / "context" / "mcp.md"
    lines = doc_path.read_text().splitlines()
    start = lines.index("<!-- mcp-tool-inventory:start -->")
    end = lines.index("<!-- mcp-tool-inventory:end -->")
    return {line.strip().removeprefix("- `").removesuffix("`") for line in lines[start + 1 : end] if line.strip()}


def tool_json(result) -> dict[str, Any]:
    if result.content and isinstance(result.content[0], TextContent):
        return json.loads(result.content[0].text)
    raise SystemExit(f"Expected text JSON tool response, got {result!r}")


async def smoke(url: str, token: str, *, write_round_trip: bool) -> None:
    headers = {"Authorization": f"Bearer {token}"}
    async with httpx.AsyncClient(headers=headers, timeout=20) as http_client:
        async with streamable_http_client(url, http_client=http_client) as (read, write, _):
            async with ClientSession(read, write) as session:
                await session.initialize()
                tools = await session.list_tools()
                names = {tool.name for tool in tools.tools}
                expected = expected_tool_names()
                if names != expected:
                    raise SystemExit(
                        "MCP tool inventory mismatch: "
                        f"missing={sorted(expected - names)} extra={sorted(names - expected)}"
                    )

                projects = await session.call_tool("list_projects", {})
                project_payload = tool_json(projects)
                print(json.dumps(project_payload))

                if write_round_trip:
                    projects = project_payload.get("projects")
                    if not isinstance(projects, list) or not projects or not isinstance(projects[0], dict):
                        raise SystemExit("Unexpected list_projects shape.")
                    project = cast(dict[str, Any], projects[0])
                    project_id = str(project["id"])
                    version_id = str(project["active_version_id"])
                    table = tool_json(
                        await session.call_tool(
                            "get_table",
                            {"project_id": project_id, "version_id": version_id, "table_name": "rooms"},
                        )
                    )
                    replaced = tool_json(
                        await session.call_tool(
                            "replace_table",
                            {
                                "project_id": project_id,
                                "version_id": version_id,
                                "table_name": "rooms",
                                "rows": table["rows"],
                                "base_version_etag": table["version_body_etag"],
                            },
                        )
                    )
                    await session.call_tool(
                        "save_draft",
                        {
                            "project_id": project_id,
                            "version_id": version_id,
                            "if_match": table["version_body_etag"],
                        },
                    )
                    verified = tool_json(
                        await session.call_tool(
                            "get_table",
                            {"project_id": project_id, "version_id": version_id, "table_name": "rooms"},
                        )
                    )
                    print(
                        json.dumps(
                            {
                                "write_round_trip": "ok",
                                "project_id": project_id,
                                "version_id": version_id,
                                "draft_etag_after_replace": replaced["draft_etag"],
                                "verified_source": verified["source"],
                            }
                        )
                    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default="http://127.0.0.1:8000/mcp/")
    parser.add_argument("--token", required=True)
    parser.add_argument(
        "--write-round-trip",
        action="store_true",
        help="With a project:write token, replace the Rooms table with its current payload and save the draft.",
    )
    args = parser.parse_args()
    asyncio.run(smoke(args.url, args.token, write_round_trip=args.write_round_trip))


if __name__ == "__main__":
    main()

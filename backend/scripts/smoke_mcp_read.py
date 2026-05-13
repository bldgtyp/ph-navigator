"""Smoke a PH-Navigator MCP read-only token against Streamable HTTP."""

from __future__ import annotations

import argparse
import asyncio

import httpx
from mcp import ClientSession
from mcp.client.streamable_http import streamable_http_client
from mcp.types import TextContent


async def smoke(url: str, token: str) -> None:
    headers = {"Authorization": f"Bearer {token}"}
    async with httpx.AsyncClient(headers=headers, timeout=20) as http_client:
        async with streamable_http_client(url, http_client=http_client) as (read, write, _):
            async with ClientSession(read, write) as session:
                await session.initialize()
                tools = await session.list_tools()
                names = {tool.name for tool in tools.tools}
                required = {
                    "list_projects",
                    "get_project",
                    "list_versions",
                    "list_status_items",
                    "get_document",
                    "get_table",
                }
                missing = required - names
                if missing:
                    raise SystemExit(f"Missing MCP tools: {sorted(missing)}")

                projects = await session.call_tool("list_projects", {})
                if projects.content and isinstance(projects.content[0], TextContent):
                    print(projects.content[0].text)
                else:
                    print(projects)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default="http://127.0.0.1:8000/mcp/")
    parser.add_argument("--token", required=True)
    args = parser.parse_args()
    asyncio.run(smoke(args.url, args.token))


if __name__ == "__main__":
    main()

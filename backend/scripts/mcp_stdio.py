"""Run the PH-Navigator MCP server over stdio.

Set PHN_MCP_TOKEN to a project-scoped token before starting this script.
"""

from __future__ import annotations

from features.mcp.server import build_mcp_server


def main() -> None:
    mcp = build_mcp_server(allow_env_token=True)
    mcp.run(transport="stdio")


if __name__ == "__main__":
    main()

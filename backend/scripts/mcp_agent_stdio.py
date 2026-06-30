"""Run local PH-Navigator MCP over stdio for agents.

If `PHN_MCP_TOKEN` is absent, this launcher creates a local-only agent fixture
and issues an ephemeral project-scoped token before starting the MCP server.
"""

from __future__ import annotations

import os
import sys

from features.mcp.server import build_mcp_server
from scripts.issue_agent_mcp_token import issue_agent_mcp_token


def main() -> None:
    if not os.getenv("PHN_MCP_TOKEN"):
        issued = issue_agent_mcp_token(label="Auto local agent MCP")
        os.environ["PHN_MCP_TOKEN"] = issued.token
        print(
            "PHN MCP auto-issued local token "
            f"{issued.token_prefix} for {issued.fixture_bt_number} ({issued.fixture_project_id}).",
            file=sys.stderr,
        )

    mcp = build_mcp_server(allow_env_token=True)
    mcp.run(transport="stdio")


if __name__ == "__main__":
    main()

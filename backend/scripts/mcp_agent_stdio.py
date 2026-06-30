"""Run local PH-Navigator MCP over stdio for agents.

If `PHN_MCP_TOKEN` is absent, this launcher reuses a gitignored local token
file. When the file is missing or stale after a DB reset, it creates a local
agent fixture, issues a fresh token, stores it locally, then starts MCP.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any

from features.mcp.server import build_mcp_server
from features.mcp.service import authenticate_plaintext_token
from scripts.issue_agent_mcp_token import issue_agent_mcp_token

TOKEN_FILE = Path(__file__).resolve().parents[1] / ".agent-mcp-token.json"


def main() -> None:
    if not os.getenv("PHN_MCP_TOKEN"):
        os.environ["PHN_MCP_TOKEN"] = _load_or_issue_token()

    mcp = build_mcp_server(allow_env_token=True)
    mcp.run(transport="stdio")


def _load_or_issue_token() -> str:
    stored = _read_stored_token()
    if stored and authenticate_plaintext_token(stored):
        print("PHN MCP using stored local agent token.", file=sys.stderr)
        return stored

    issued = issue_agent_mcp_token(label="Stored local agent MCP")
    _write_stored_token(
        {
            "token": issued.token,
            "token_prefix": issued.token_prefix,
            "project_id": issued.fixture_project_id,
            "version_id": issued.fixture_version_id,
            "bt_number": issued.fixture_bt_number,
            "scopes": issued.scopes,
        }
    )
    print(
        "PHN MCP stored new local agent token "
        f"{issued.token_prefix} for {issued.fixture_bt_number} ({issued.fixture_project_id}).",
        file=sys.stderr,
    )
    return issued.token


def _read_stored_token() -> str | None:
    try:
        payload = json.loads(TOKEN_FILE.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        return None
    token = payload.get("token") if isinstance(payload, dict) else None
    return token if isinstance(token, str) and token.startswith("phn_mcp_") else None


def _write_stored_token(payload: dict[str, Any]) -> None:
    TOKEN_FILE.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    try:
        TOKEN_FILE.chmod(0o600)
    except OSError:
        pass


if __name__ == "__main__":
    main()

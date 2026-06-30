"""Issue a local PH-Navigator MCP token for agent development."""

from __future__ import annotations

import argparse
from typing import cast

from fastapi import Request

from database import connection
from features.auth import repository as auth_repository
from features.auth.service import public_user
from features.mcp.models import McpScope, McpTokenIssueRequest
from features.mcp.service import issue_token
from features.projects import repository as projects_repository
from features.projects.access import project_access_for_user
from features.projects.models import ProjectSummary
from scripts.seed_agent_browser_fixture import (
    DEFAULT_BT_NUMBER,
    DEFAULT_DISPLAY_NAME,
    DEFAULT_EMAIL,
    DEFAULT_PASSWORD,
    seed_agent_browser_fixture,
)

DEFAULT_SCOPES: tuple[McpScope, ...] = ("project:read", "project:write", "asset:read", "asset:write")


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Seed the local Codex/agent project fixture, issue a project-scoped "
            "MCP token, and print copy-pasteable local agent config values."
        )
    )
    parser.add_argument("--email", default=DEFAULT_EMAIL)
    parser.add_argument("--display-name", default=DEFAULT_DISPLAY_NAME)
    parser.add_argument("--password", default=DEFAULT_PASSWORD)
    parser.add_argument("--bt-number", default=DEFAULT_BT_NUMBER)
    parser.add_argument("--label", default="Local agent MCP")
    parser.add_argument(
        "--scope",
        action="append",
        choices=["project:read", "project:write", "asset:read", "asset:write"],
        dest="scopes",
        help="Repeat to override default full local-dev scopes.",
    )
    parser.add_argument("--expires-at", default=None, help="Optional ISO datetime, e.g. 2026-07-15T12:00:00-04:00.")
    args = parser.parse_args()

    fixture = seed_agent_browser_fixture(
        email=args.email,
        display_name=args.display_name,
        password=args.password,
        bt_number=args.bt_number,
    )
    scopes = cast(list[McpScope], args.scopes or list(DEFAULT_SCOPES))

    with connection() as conn:
        user_row = auth_repository.get_user_by_email(conn, args.email)
        project_row = projects_repository.get_project_by_id_including_deleted(conn, fixture.project_id)

    if user_row is None:
        raise SystemExit(f"User not found after fixture seed: {args.email}")
    if project_row is None:
        raise SystemExit(f"Project not found after fixture seed: {fixture.project_id}")
    if project_row["deleted_at"] is not None:
        raise SystemExit(f"Project is deleted after fixture seed: {fixture.project_id}")

    user = public_user(user_row)
    project = ProjectSummary.model_validate({field: project_row[field] for field in ProjectSummary.model_fields})
    access = project_access_for_user(user, project, "edit")
    payload = McpTokenIssueRequest(label=args.label, scopes=scopes, expires_at=args.expires_at)
    request = Request(
        {
            "type": "http",
            "method": "POST",
            "path": "/scripts/issue-agent-mcp-token",
            "headers": [(b"user-agent", b"scripts.issue_agent_mcp_token")],
            "client": ("127.0.0.1", 0),
            "query_string": b"",
        }
    )
    issued = issue_token(payload, access, request)

    print("Issued local PH-Navigator MCP token:")
    print(f"  project: {fixture.bt_number} ({fixture.project_id})")
    print(f"  version: {fixture.version_id}")
    print(f"  scopes: {', '.join(issued.token_record.scopes)}")
    print(f"  token prefix: {issued.token_record.token_prefix}")
    print("")
    print("Use this only in your local shell/session; plaintext is shown once:")
    print(f"  export PHN_MCP_TOKEN='{issued.token}'")
    print("")
    print("Local MCP endpoint:")
    print("  http://localhost:8000/mcp/")
    print("")
    print("Local stdio command:")
    print("  cd backend && uv run python -m scripts.mcp_stdio")


if __name__ == "__main__":
    main()

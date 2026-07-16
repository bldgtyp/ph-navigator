"""Issue a local PH-Navigator MCP token for agent development."""

from __future__ import annotations

import argparse
from dataclasses import dataclass
from datetime import datetime
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


@dataclass(frozen=True)
class IssuedAgentMcpToken:
    fixture_project_id: str
    fixture_version_id: str
    fixture_bt_number: str
    token: str
    token_prefix: str
    scopes: list[McpScope]


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
    parser.add_argument(
        "--expires-at",
        default=None,
        type=datetime.fromisoformat,
        help="Optional ISO datetime, e.g. 2026-07-15T12:00:00-04:00.",
    )
    args = parser.parse_args()

    issued = issue_agent_mcp_token(
        email=args.email,
        display_name=args.display_name,
        password=args.password,
        bt_number=args.bt_number,
        label=args.label,
        scopes=cast(list[McpScope] | None, args.scopes),
        expires_at=args.expires_at,
    )

    print("Issued local PH-Navigator MCP token:")
    print(f"  project: {issued.fixture_bt_number} ({issued.fixture_project_id})")
    print(f"  version: {issued.fixture_version_id}")
    print(f"  scopes: {', '.join(issued.scopes)}")
    print(f"  token prefix: {issued.token_prefix}")
    print("")
    print("Use this only in your local shell/session; plaintext is shown once:")
    print(f"  export PHN_MCP_TOKEN='{issued.token}'")
    print("")
    print("Local MCP endpoint:")
    print("  http://localhost:8000/mcp/")
    print("")
    print("Local stdio command:")
    print("  cd backend && uv run python -m scripts.mcp_stdio")


def issue_agent_mcp_token(
    *,
    email: str = DEFAULT_EMAIL,
    display_name: str = DEFAULT_DISPLAY_NAME,
    password: str = DEFAULT_PASSWORD,
    bt_number: str = DEFAULT_BT_NUMBER,
    label: str = "Local agent MCP",
    scopes: list[McpScope] | None = None,
    expires_at: datetime | None = None,
) -> IssuedAgentMcpToken:
    """Seed the local agent fixture and issue a project-scoped MCP token."""
    fixture = seed_agent_browser_fixture(
        email=email,
        display_name=display_name,
        password=password,
        bt_number=bt_number,
    )
    resolved_scopes = scopes or list(DEFAULT_SCOPES)

    with connection() as conn:
        user_row = auth_repository.get_user_by_email(conn, email)
        project_row = projects_repository.get_project_by_id_including_deleted(conn, fixture.project_id)

    if user_row is None:
        raise RuntimeError(f"User not found after fixture seed: {email}")
    if project_row is None:
        raise RuntimeError(f"Project not found after fixture seed: {fixture.project_id}")
    if project_row["deleted_at"] is not None:
        raise RuntimeError(f"Project is deleted after fixture seed: {fixture.project_id}")

    user = public_user(user_row)
    project = ProjectSummary.model_validate(
        {field: project_row[field] for field in ProjectSummary.model_fields if field in project_row}
    )
    access = project_access_for_user(user, project, "edit")
    payload = McpTokenIssueRequest(label=label, scopes=resolved_scopes, expires_at=expires_at)
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
    return IssuedAgentMcpToken(
        fixture_project_id=str(fixture.project_id),
        fixture_version_id=str(fixture.version_id),
        fixture_bt_number=fixture.bt_number,
        token=issued.token,
        token_prefix=issued.token_record.token_prefix,
        scopes=issued.token_record.scopes,
    )


if __name__ == "__main__":
    main()

"""FastMCP server definition for PH-Navigator V2."""

from __future__ import annotations

import json
import os
from typing import Literal, NoReturn
from uuid import UUID

from fastapi import HTTPException
from mcp.server.auth.middleware.auth_context import get_access_token
from mcp.server.auth.settings import AuthSettings
from mcp.server.fastmcp import Context, FastMCP
from mcp.server.fastmcp.exceptions import ToolError
from pydantic import AnyHttpUrl

from config import settings
from features.mcp.models import (
    McpDocumentEnvelope,
    McpProjectEnvelope,
    McpProjectListEnvelope,
    McpScope,
    McpStatusItemListEnvelope,
    McpStructuredError,
    McpTableEnvelope,
    McpTokenRecord,
    McpVersionListEnvelope,
)
from features.mcp.service import (
    PhNavigatorTokenVerifier,
    authenticate_plaintext_token,
    get_active_token_by_id,
    project_access_for_token,
    require_token_scope,
)
from features.project_document.models import ProjectDocumentView
from features.project_document.service import get_current_document_view
from features.project_status.service import list_project_status_items
from features.projects.access import ProjectAccess
from features.projects.models import ProjectSummary
from features.projects.service import get_project_detail


def build_mcp_server(allow_env_token: bool = False) -> FastMCP:
    """Create the MCP tool server used by HTTP and stdio transports."""
    mcp = FastMCP(
        "PH-Navigator V2",
        instructions="Project-scoped PH-Navigator V2 tools. All tokens are scoped to one project.",
        json_response=True,
        streamable_http_path="/",
        stateless_http=True,
        token_verifier=PhNavigatorTokenVerifier(),
        auth=AuthSettings(
            issuer_url=AnyHttpUrl(settings.mcp_issuer_url),
            resource_server_url=AnyHttpUrl(settings.mcp_resource_server_url),
            required_scopes=["project:read"],
        ),
    )

    @mcp.tool()
    def list_projects(ctx: Context) -> McpProjectListEnvelope:
        """Return the one project visible to the project-scoped token."""
        token = current_token(ctx, allow_env_token)
        detail = get_project_detail(token.project_id, access_mode="viewer")
        project = ProjectSummary.model_validate(
            detail.model_dump(exclude={"versions", "active_version", "access_mode"})
        )
        return McpProjectListEnvelope(projects=[project])

    @mcp.tool()
    def get_project(project_id: str, ctx: Context) -> McpProjectEnvelope:
        """Return project metadata plus version list."""
        parsed_project_id = parse_uuid(project_id, "project_id", ctx)
        token = current_token(ctx, allow_env_token)
        require_token_scope_or_error(token, parsed_project_id, "project:read", ctx)
        detail = get_project_detail(parsed_project_id, access_mode="editor")
        return McpProjectEnvelope(
            project=ProjectSummary.model_validate(
                detail.model_dump(exclude={"versions", "active_version", "access_mode"})
            ),
            active_version=detail.active_version,
            versions=detail.versions,
        )

    @mcp.tool()
    def list_versions(project_id: str, ctx: Context) -> McpVersionListEnvelope:
        """Return version metadata for a token-visible project."""
        parsed_project_id = parse_uuid(project_id, "project_id", ctx)
        token = current_token(ctx, allow_env_token)
        require_token_scope_or_error(token, parsed_project_id, "project:read", ctx)
        detail = get_project_detail(parsed_project_id, access_mode="editor")
        return McpVersionListEnvelope(versions=detail.versions)

    @mcp.tool()
    def list_status_items(project_id: str, ctx: Context) -> McpStatusItemListEnvelope:
        """Return the relational status tracker for a token-visible project."""
        parsed_project_id = parse_uuid(project_id, "project_id", ctx)
        token = current_token(ctx, allow_env_token)
        access = project_access_or_error(token, parsed_project_id, "project:read", ctx)
        response = list_project_status_items(access)
        return McpStatusItemListEnvelope(items=response.items)

    @mcp.tool()
    def get_document(project_id: str, version_id: str, ctx: Context) -> McpDocumentEnvelope:
        """Return the current saved document view, or token owner's draft if present."""
        parsed_project_id = parse_uuid(project_id, "project_id", ctx)
        parsed_version_id = parse_uuid(version_id, "version_id", ctx)
        token = current_token(ctx, allow_env_token)
        access = project_access_or_error(token, parsed_project_id, "project:read", ctx)
        document = current_document_view_or_error(parsed_version_id, access, ctx)
        return McpDocumentEnvelope(
            project_id=document.project_id,
            version_id=document.version_id,
            source=document.source,
            version_body_etag=document.version_etag,
            draft_etag=document.draft_etag,
            body=document.body.model_dump(mode="json"),
        )

    @mcp.tool()
    def get_table(project_id: str, version_id: str, table_name: str, ctx: Context) -> McpTableEnvelope:
        """Return one project-document table from the token owner's current document view.

        This TB-04b read primitive is intentionally narrower than the future typed `query_table` tool.
        """
        parsed_project_id = parse_uuid(project_id, "project_id", ctx)
        parsed_version_id = parse_uuid(version_id, "version_id", ctx)
        token = current_token(ctx, allow_env_token)
        access = project_access_or_error(token, parsed_project_id, "project:read", ctx)
        document = current_document_view_or_error(parsed_version_id, access, ctx)
        table_payload = document.body.tables.model_dump(mode="json", include={table_name})
        rows = table_payload.get(table_name)
        if not isinstance(rows, list):
            raise_mcp_error("document_table_not_found", "Document table not found.", "refresh", ctx)
        return McpTableEnvelope(
            project_id=document.project_id,
            version_id=document.version_id,
            source=document.source,
            version_body_etag=document.version_etag,
            draft_etag=document.draft_etag,
            table_name=table_name,
            rows=rows,
        )

    @mcp.tool()
    def replace_table(
        project_id: str,
        version_id: str,
        table_name: str,
        ctx: Context,
        rows: list[dict[str, object]] | None = None,
        draft_etag: str | None = None,
        base_version_etag: str | None = None,
    ) -> dict[str, object]:
        """Reject write attempts until TB-17 ships MCP draft writes.

        The write-contract arguments are accepted now to keep the tool signature
        aligned with the planned TB-17 client contract.
        """
        parsed_project_id = parse_uuid(project_id, "project_id", ctx)
        _parsed_version_id = parse_uuid(version_id, "version_id", ctx)
        token = current_token(ctx, allow_env_token)
        require_token_scope_or_error(token, parsed_project_id, "project:write", ctx)
        raise_mcp_error(
            "mcp_write_deferred",
            f"MCP writes are deferred until TB-17; table '{table_name}' was not changed.",
            "fatal",
            ctx,
        )

    return mcp


def current_token(ctx: Context, allow_env_token: bool = False) -> McpTokenRecord:
    access_token = get_access_token()
    if access_token is not None:
        token_id = parse_uuid(access_token.client_id, "token_id", ctx)
        token = get_active_token_by_id(token_id)
        if token is None:
            raise_mcp_error("invalid_token", "MCP token is revoked, expired, or unknown.", "reauthenticate", ctx)
        return token

    plaintext = os.getenv("PHN_MCP_TOKEN") if allow_env_token else None
    if plaintext:
        token = authenticate_plaintext_token(plaintext)
        if token is not None:
            return token

    raise_mcp_error("not_authenticated", "MCP bearer token is required.", "reauthenticate", ctx)


def parse_uuid(value: str, field_name: str, ctx: Context) -> UUID:
    try:
        return UUID(value)
    except ValueError:
        raise_mcp_error(
            "validation_error",
            f"{field_name} must be a UUID.",
            "fatal",
            ctx,
            {"field": field_name},
        )


def require_token_scope_or_error(token: McpTokenRecord, project_id: UUID, scope: McpScope, ctx: Context) -> None:
    try:
        require_token_scope(token, project_id, scope)
    except PermissionError as exc:
        code = str(exc)
        if code == "mcp_scope_insufficient":
            raise_mcp_error("mcp_scope_insufficient", f"MCP token requires scope '{scope}'.", "forbidden", ctx)
        raise_mcp_error("mcp_project_scope_mismatch", "MCP token cannot access this project.", "forbidden", ctx)


def project_access_or_error(token: McpTokenRecord, project_id: UUID, scope: McpScope, ctx: Context) -> ProjectAccess:
    try:
        return project_access_for_token(token, project_id, scope)
    except LookupError:
        raise_mcp_error("project_not_found", "Project not found.", "refresh", ctx)
    except PermissionError as exc:
        code = str(exc)
        if code == "mcp_scope_insufficient":
            raise_mcp_error("mcp_scope_insufficient", f"MCP token requires scope '{scope}'.", "forbidden", ctx)
        raise_mcp_error("mcp_project_scope_mismatch", "MCP token cannot access this project.", "forbidden", ctx)


def current_document_view_or_error(version_id: UUID, access: ProjectAccess, ctx: Context) -> ProjectDocumentView:
    try:
        return get_current_document_view(version_id, access)
    except HTTPException as exc:
        detail = exc.detail if isinstance(exc.detail, dict) else {}
        code = str(detail.get("error_code", "project_document_error"))
        message = str(detail.get("message", "Project document could not be loaded."))
        details = detail.get("details", {})
        raise_mcp_error(
            code,
            message,
            "refresh" if code == "project_version_not_found" else "fatal",
            ctx,
            details if isinstance(details, dict) else {},
        )


def raise_mcp_error(
    code: str,
    message: str,
    recoverability: Literal["retry", "refresh", "reauthenticate", "forbidden", "fatal"],
    ctx: Context,
    details: dict[str, object] | None = None,
) -> NoReturn:
    request_id = getattr(ctx, "request_id", "")
    envelope = McpStructuredError(
        code=code,
        message=message,
        request_id=request_id,
        recoverability=recoverability,
        details=details or {},
    )
    raise ToolError(json.dumps(envelope.model_dump(mode="json"), separators=(",", ":")))


mcp = build_mcp_server()

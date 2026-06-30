"""Project document/table MCP tools."""

from __future__ import annotations

from fastapi import HTTPException
from mcp.server.fastmcp import Context

from features.mcp.helpers import (
    current_document_view_or_error,
    current_token,
    parse_uuid,
    project_access_or_error,
    raise_http_exception_as_mcp_error,
    raise_mcp_error,
    require_token_scope_or_error,
    table_contract_or_error,
)
from features.mcp.models import McpDocumentEnvelope, McpRecoverability, McpTableEnvelope
from features.project_document.models import DiscardDraftResponse, SaveDraftResponse
from features.project_document.service import discard_draft, save_draft

__all__ = [
    "tool_discard_draft",
    "tool_get_document",
    "tool_get_table",
    "tool_replace_table",
    "tool_save_draft",
]


_DRAFT_LIFECYCLE_RECOVERABILITY: dict[str, McpRecoverability] = {
    "version_locked": "refresh",
    "version_etag_mismatch": "refresh",
    "draft_etag_mismatch": "refresh",
    "project_version_not_found": "refresh",
    "draft_not_found": "refresh",
    "no_draft_to_save": "refresh",
}


def tool_get_document(project_id: str, version_id: str, ctx: Context, *, allow_env_token: bool) -> McpDocumentEnvelope:
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


def tool_get_table(
    project_id: str,
    version_id: str,
    table_name: str,
    ctx: Context,
    *,
    allow_env_token: bool,
) -> McpTableEnvelope:
    parsed_project_id = parse_uuid(project_id, "project_id", ctx)
    parsed_version_id = parse_uuid(version_id, "version_id", ctx)
    token = current_token(ctx, allow_env_token)
    access = project_access_or_error(token, parsed_project_id, "project:read", ctx)
    contract = table_contract_or_error(table_name, ctx)
    document = current_document_view_or_error(parsed_version_id, access, ctx)
    return McpTableEnvelope(
        project_id=document.project_id,
        version_id=document.version_id,
        source=document.source,
        version_body_etag=document.version_etag,
        draft_etag=document.draft_etag,
        table_name=table_name,
        rows=contract.extract_rows(document.body),
    )


def tool_save_draft(
    project_id: str,
    version_id: str,
    ctx: Context,
    *,
    allow_env_token: bool,
    if_match: str | None = None,
) -> SaveDraftResponse:
    parsed_project_id = parse_uuid(project_id, "project_id", ctx)
    parsed_version_id = parse_uuid(version_id, "version_id", ctx)
    token = current_token(ctx, allow_env_token)
    access = project_access_or_error(token, parsed_project_id, "project:write", ctx)
    try:
        return save_draft(parsed_version_id, access, if_match=if_match, request=None, updated_via="mcp")
    except HTTPException as exc:
        raise_http_exception_as_mcp_error(
            exc,
            ctx,
            default_code="project_document_error",
            default_message="Draft could not be saved.",
            default_recoverability="fatal",
            recoverability_by_code=_DRAFT_LIFECYCLE_RECOVERABILITY,
        )


def tool_discard_draft(
    project_id: str,
    version_id: str,
    ctx: Context,
    *,
    allow_env_token: bool,
) -> DiscardDraftResponse:
    parsed_project_id = parse_uuid(project_id, "project_id", ctx)
    parsed_version_id = parse_uuid(version_id, "version_id", ctx)
    token = current_token(ctx, allow_env_token)
    access = project_access_or_error(token, parsed_project_id, "project:write", ctx)
    try:
        return discard_draft(parsed_version_id, access)
    except HTTPException as exc:
        raise_http_exception_as_mcp_error(
            exc,
            ctx,
            default_code="project_document_error",
            default_message="Draft could not be discarded.",
            default_recoverability="fatal",
            recoverability_by_code=_DRAFT_LIFECYCLE_RECOVERABILITY,
        )


def tool_replace_table(
    project_id: str,
    version_id: str,
    table_name: str,
    ctx: Context,
    *,
    allow_env_token: bool,
    rows: list[dict[str, object]] | None = None,
    draft_etag: str | None = None,
    base_version_etag: str | None = None,
) -> dict[str, object]:
    # TB-17 — MCP draft writes are deferred. The write-contract args are
    # accepted now so the tool signature aligns with the planned contract.
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

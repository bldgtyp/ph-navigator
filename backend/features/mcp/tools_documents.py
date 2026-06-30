"""Project document/table MCP tools."""

from __future__ import annotations

from collections.abc import Callable
from typing import cast

from fastapi import HTTPException
from mcp.server.fastmcp import Context
from pydantic import ValidationError

from features.mcp.helpers import (
    current_document_view_or_error,
    current_token,
    parse_uuid,
    project_access_or_error,
    raise_http_exception_as_mcp_error,
    raise_mcp_error,
    table_contract_or_error,
)
from features.mcp.models import McpDocumentEnvelope, McpRecoverability, McpTableEnvelope
from features.project_document.models import (
    DiscardDraftResponse,
    ProjectDiffResponse,
    ProjectDocumentView,
    SaveAsDraftRequest,
    SaveDraftResponse,
    VersionPatchRequest,
)
from features.project_document.service import (
    discard_draft,
    get_project_diff,
    patch_version,
    preview_table_replace,
    replace_table_slice,
    save_draft,
    save_draft_as,
)
from features.project_document.tables.contracts import TableContract, TableReplacePreviewResponse
from features.projects.models import ProjectDetail, VersionKind

__all__ = [
    "tool_discard_draft",
    "tool_diff_versions",
    "tool_get_document",
    "tool_get_table",
    "tool_preview_replace_table",
    "tool_replace_table",
    "tool_save_draft_as",
    "tool_save_draft",
    "tool_update_project",
]


_DRAFT_LIFECYCLE_RECOVERABILITY: dict[str, McpRecoverability] = {
    "version_locked": "refresh",
    "version_etag_mismatch": "refresh",
    "draft_etag_mismatch": "refresh",
    "project_version_not_found": "refresh",
    "draft_not_found": "refresh",
    "no_draft_to_save": "refresh",
}

_TABLE_REPLACE_RECOVERABILITY: dict[str, McpRecoverability] = {
    "version_locked": "refresh",
    "draft_etag_mismatch": "refresh",
    "version_etag_mismatch": "refresh",
    "project_version_not_found": "refresh",
}

_READ_ONLY_ENVELOPE_KEYS = frozenset(
    {
        "computed",
        "inverse_link_fields",
        "inverse_links",
        "inverse_links_fingerprint",
        "rows_computed",
    }
)


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


def tool_save_draft_as(
    project_id: str,
    version_id: str,
    name: str,
    ctx: Context,
    *,
    allow_env_token: bool,
    kind: VersionKind = "working",
    locked: bool = False,
) -> SaveDraftResponse:
    parsed_project_id = parse_uuid(project_id, "project_id", ctx)
    parsed_version_id = parse_uuid(version_id, "version_id", ctx)
    token = current_token(ctx, allow_env_token)
    access = project_access_or_error(token, parsed_project_id, "project:write", ctx)
    try:
        payload = SaveAsDraftRequest(name=name, kind=kind, locked=locked)
        return save_draft_as(parsed_version_id, payload, access, request=None)
    except ValidationError as exc:
        raise_mcp_error(
            "validation_error",
            "Save As payload is invalid.",
            "fatal",
            ctx,
            {"errors": exc.errors(include_url=False)},
        )
    except HTTPException as exc:
        raise_http_exception_as_mcp_error(
            exc,
            ctx,
            default_code="project_document_error",
            default_message="Draft could not be saved as a new version.",
            default_recoverability="fatal",
            recoverability_by_code=_DRAFT_LIFECYCLE_RECOVERABILITY,
        )


def tool_update_project(
    project_id: str,
    version_id: str,
    ctx: Context,
    *,
    allow_env_token: bool,
    locked: bool | None = None,
    make_active: bool | None = None,
) -> ProjectDetail:
    parsed_project_id = parse_uuid(project_id, "project_id", ctx)
    parsed_version_id = parse_uuid(version_id, "version_id", ctx)
    token = current_token(ctx, allow_env_token)
    access = project_access_or_error(token, parsed_project_id, "project:write", ctx)
    try:
        payload = VersionPatchRequest(locked=locked, make_active=make_active)
        return patch_version(parsed_version_id, payload, access, request=None)
    except HTTPException as exc:
        raise_http_exception_as_mcp_error(
            exc,
            ctx,
            default_code="project_document_error",
            default_message="Project version metadata could not be updated.",
            default_recoverability="fatal",
            recoverability_by_code={"project_version_not_found": "refresh"},
        )


def tool_diff_versions(
    project_id: str,
    from_version_id: str,
    to: str,
    ctx: Context,
    *,
    allow_env_token: bool,
) -> ProjectDiffResponse:
    parsed_project_id = parse_uuid(project_id, "project_id", ctx)
    parsed_from_version_id = parse_uuid(from_version_id, "from_version_id", ctx)
    token = current_token(ctx, allow_env_token)
    access = project_access_or_error(token, parsed_project_id, "project:read", ctx)
    try:
        return get_project_diff(parsed_from_version_id, to, access)
    except HTTPException as exc:
        raise_http_exception_as_mcp_error(
            exc,
            ctx,
            default_code="project_document_error",
            default_message="Project version diff could not be loaded.",
            default_recoverability="fatal",
            recoverability_by_code={"project_version_not_found": "refresh"},
        )


def tool_replace_table(
    project_id: str,
    version_id: str,
    table_name: str,
    ctx: Context,
    *,
    allow_env_token: bool,
    rows: object | None = None,
    draft_etag: str | None = None,
    base_version_etag: str | None = None,
) -> dict[str, object]:
    parsed_project_id = parse_uuid(project_id, "project_id", ctx)
    parsed_version_id = parse_uuid(version_id, "version_id", ctx)
    token = current_token(ctx, allow_env_token)
    access = project_access_or_error(token, parsed_project_id, "project:write", ctx)
    contract = table_contract_or_error(table_name, ctx)
    raw_payload = _replace_payload_from_rows_arg(
        contract,
        rows,
        ctx,
        load_document=lambda: current_document_view_or_error(parsed_version_id, access, ctx),
    )
    try:
        response = replace_table_slice(
            parsed_version_id,
            table_name,
            raw_payload,
            access,
            if_match=draft_etag,
            if_match_version=base_version_etag,
        )
    except HTTPException as exc:
        raise_http_exception_as_mcp_error(
            exc,
            ctx,
            default_code="project_document_error",
            default_message="Table replace failed.",
            default_recoverability="fatal",
            recoverability_by_code=_TABLE_REPLACE_RECOVERABILITY,
        )
    return response.model_dump(mode="json")


def tool_preview_replace_table(
    project_id: str,
    version_id: str,
    table_name: str,
    ctx: Context,
    *,
    allow_env_token: bool,
    rows: object | None = None,
    draft_etag: str | None = None,
    base_version_etag: str | None = None,
) -> TableReplacePreviewResponse:
    parsed_project_id = parse_uuid(project_id, "project_id", ctx)
    parsed_version_id = parse_uuid(version_id, "version_id", ctx)
    token = current_token(ctx, allow_env_token)
    access = project_access_or_error(token, parsed_project_id, "project:write", ctx)
    contract = table_contract_or_error(table_name, ctx)
    raw_payload = _replace_payload_from_rows_arg(
        contract,
        rows,
        ctx,
        load_document=lambda: current_document_view_or_error(parsed_version_id, access, ctx),
    )
    try:
        return preview_table_replace(
            parsed_version_id,
            table_name,
            raw_payload,
            access,
            if_match=draft_etag,
            if_match_version=base_version_etag,
        )
    except HTTPException as exc:
        raise_http_exception_as_mcp_error(
            exc,
            ctx,
            default_code="project_document_error",
            default_message="Table replace preview failed.",
            default_recoverability="fatal",
            recoverability_by_code=_TABLE_REPLACE_RECOVERABILITY,
        )


def _replace_payload_from_rows_arg(
    contract: TableContract,
    rows: object | None,
    ctx: Context,
    *,
    load_document: Callable[[], ProjectDocumentView],
) -> object:
    if rows is None:
        raise_mcp_error(
            "validation_error",
            "`rows` is required for whole-table replacement.",
            "fatal",
            ctx,
        )
    row_field = _single_row_field(contract, ctx)
    if isinstance(rows, dict):
        rows_payload = cast(dict[str, object], rows)
        if row_field in rows_payload:
            return rows_payload
        if "rows" in rows_payload:
            allowed_envelope_keys = (
                set(contract.replace_request_model.model_fields) | {"rows"} | _READ_ONLY_ENVELOPE_KEYS
            )
            extra_keys = sorted(set(rows_payload) - allowed_envelope_keys)
            if extra_keys:
                raise_mcp_error(
                    "validation_error",
                    "Table replace envelope has unsupported keys.",
                    "fatal",
                    ctx,
                    {"table_name": contract.name, "unsupported_keys": extra_keys},
                )
            document = load_document()
            response_payload = _current_replace_payload(contract, document)
            for field_name in contract.replace_request_model.model_fields:
                if field_name in rows_payload:
                    response_payload[field_name] = rows_payload[field_name]
            response_payload[row_field] = rows_payload["rows"]
            return response_payload
        return rows_payload
    document = load_document()
    response_payload = _current_replace_payload(contract, document)
    response_payload[row_field] = rows
    return response_payload


def _current_replace_payload(contract: TableContract, document: ProjectDocumentView) -> dict[str, object]:
    current_response = contract.build_response(
        document.project_id,
        document.version_id,
        document.source,
        document.version_etag,
        document.draft_etag,
        document.body,
    )
    current_dump = current_response.model_dump(mode="json")
    return {
        field_name: current_dump[field_name]
        for field_name in contract.replace_request_model.model_fields
        if field_name in current_dump
    }


def _single_row_field(contract: TableContract, ctx: Context) -> str:
    row_fields = [
        field_name
        for field_name in contract.replace_request_model.model_fields
        if field_name not in {"field_defs", "single_select_options"}
    ]
    if len(row_fields) != 1:
        raise_mcp_error(
            "validation_error",
            "Table replace payload must have exactly one row-list field.",
            "fatal",
            ctx,
            {"table_name": contract.name, "row_fields": row_fields},
        )
    return row_fields[0]

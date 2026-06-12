"""MCP tools for the Model tab (US-VIEW-1 crit. 14 + US-VIEW-7 crit. 10).

Upload-intent and complete-upload are asset-level concerns already covered
by the generic asset tools; the file tools cover the viewer metadata
lifecycle and the model-data tools expose the extraction reads
(NEW-LLM-API-1: "list all spaces with v_sup < X"-style agent queries hit
the per-feature subsets; the bulk payload is also available).
"""

from __future__ import annotations

from typing import NoReturn

from fastapi import HTTPException
from mcp.server.fastmcp import Context
from pydantic import ValidationError

from features.assets.routes import get_asset_service
from features.mcp.helpers import (
    current_token,
    parse_uuid,
    project_access_or_error,
    raise_http_exception_as_mcp_error,
    raise_mcp_error,
)
from features.mcp.models import McpRecoverability
from features.model_viewer import model_data
from features.model_viewer.models import HbjsonFileCreateRequest, HbjsonFileUpdateRequest
from features.model_viewer.service import (
    create_file,
    delete_file,
    get_download_urls,
    list_files,
    update_file,
)

__all__ = [
    "tool_create_hbjson_file",
    "tool_delete_hbjson_file",
    "tool_get_hbjson_file_download_url",
    "tool_get_hbjson_model_data",
    "tool_list_hbjson_faces",
    "tool_list_hbjson_files",
    "tool_list_hbjson_hot_water_systems",
    "tool_list_hbjson_shading_elements",
    "tool_list_hbjson_spaces",
    "tool_list_hbjson_ventilation_systems",
    "tool_rename_hbjson_file",
]

# `hbjson_duplicate_file` is "refresh": the right agent move is to re-list
# the files and switch to the named existing upload, not retry the link.
# D-16 taxonomy maps directly: permanent parse failures are fatal,
# transient storage failures are retryable.
_HBJSON_RECOVERABILITY: dict[str, McpRecoverability] = {
    "hbjson_file_not_found": "refresh",
    "hbjson_asset_not_found": "refresh",
    "hbjson_duplicate_file": "refresh",
    "asset_upload_incomplete": "retry",
    "model_data_extraction_failed": "fatal",
    "model_data_unavailable": "retry",
}


def tool_list_hbjson_files(project_id: str, ctx: Context, *, allow_env_token: bool) -> dict[str, object]:
    parsed_project_id = parse_uuid(project_id, "project_id", ctx)
    token = current_token(ctx, allow_env_token)
    access = project_access_or_error(token, parsed_project_id, "asset:read", ctx)
    response = list_files(access)
    return {"items": [item.model_dump(mode="json") for item in response.items]}


def tool_create_hbjson_file(
    project_id: str,
    asset_id: str,
    ctx: Context,
    *,
    allow_env_token: bool,
    display_name: str | None = None,
    notes: str | None = None,
) -> dict[str, object]:
    parsed_project_id = parse_uuid(project_id, "project_id", ctx)
    token = current_token(ctx, allow_env_token)
    access = project_access_or_error(token, parsed_project_id, "asset:write", ctx)
    try:
        payload = HbjsonFileCreateRequest(asset_id=asset_id, display_name=display_name, notes=notes)
    except ValidationError as exc:
        raise_mcp_error(
            "validation_error",
            "HBJSON file link request failed validation.",
            "fatal",
            ctx,
            {"errors": [str(error["msg"]) for error in exc.errors()]},
        )
    try:
        return create_file(payload, access).model_dump(mode="json")
    except HTTPException as exc:
        _raise_hbjson_error(exc, ctx)


def tool_rename_hbjson_file(
    project_id: str,
    file_id: str,
    ctx: Context,
    *,
    allow_env_token: bool,
    display_name: str | None = None,
    notes: str | None = None,
) -> dict[str, object]:
    parsed_project_id = parse_uuid(project_id, "project_id", ctx)
    parsed_file_id = parse_uuid(file_id, "file_id", ctx)
    token = current_token(ctx, allow_env_token)
    access = project_access_or_error(token, parsed_project_id, "asset:write", ctx)
    try:
        payload = HbjsonFileUpdateRequest.model_validate(
            {key: value for key, value in (("display_name", display_name), ("notes", notes)) if value is not None}
        )
    except ValidationError as exc:
        raise_mcp_error(
            "validation_error",
            "HBJSON file update failed validation.",
            "fatal",
            ctx,
            {"errors": [str(error["msg"]) for error in exc.errors()]},
        )
    try:
        return update_file(parsed_file_id, payload, access).model_dump(mode="json")
    except HTTPException as exc:
        _raise_hbjson_error(exc, ctx)


def tool_delete_hbjson_file(project_id: str, file_id: str, ctx: Context, *, allow_env_token: bool) -> dict[str, object]:
    parsed_project_id = parse_uuid(project_id, "project_id", ctx)
    parsed_file_id = parse_uuid(file_id, "file_id", ctx)
    token = current_token(ctx, allow_env_token)
    access = project_access_or_error(token, parsed_project_id, "asset:write", ctx)
    try:
        delete_file(parsed_file_id, access)
    except HTTPException as exc:
        _raise_hbjson_error(exc, ctx)
    return {"deleted": True, "file_id": file_id}


def tool_get_hbjson_file_download_url(
    project_id: str,
    file_id: str,
    ctx: Context,
    *,
    allow_env_token: bool,
) -> dict[str, object]:
    parsed_project_id = parse_uuid(project_id, "project_id", ctx)
    parsed_file_id = parse_uuid(file_id, "file_id", ctx)
    token = current_token(ctx, allow_env_token)
    access = project_access_or_error(token, parsed_project_id, "asset:read", ctx)
    try:
        return get_download_urls(parsed_file_id, access, get_asset_service()).model_dump(mode="json")
    except HTTPException as exc:
        _raise_hbjson_error(exc, ctx)


def _read_model_data_payload(
    project_id: str, file_id: str, ctx: Context, *, allow_env_token: bool
) -> dict[str, object]:
    """Shared auth + artifact load for all six model-data read tools."""
    parsed_project_id = parse_uuid(project_id, "project_id", ctx)
    parsed_file_id = parse_uuid(file_id, "file_id", ctx)
    token = current_token(ctx, allow_env_token)
    access = project_access_or_error(token, parsed_project_id, "asset:read", ctx)
    try:
        return model_data.read_model_data_payload(parsed_file_id, access, get_asset_service().r2)
    except HTTPException as exc:
        _raise_hbjson_error(exc, ctx)


def tool_get_hbjson_model_data(
    project_id: str,
    file_id: str,
    ctx: Context,
    *,
    allow_env_token: bool,
) -> dict[str, object]:
    """Full CombinedModelData payload. Large — prefer the per-feature
    list tools unless the whole model is genuinely needed."""
    return _read_model_data_payload(project_id, file_id, ctx, allow_env_token=allow_env_token)


def _tool_model_data_subset(
    project_id: str,
    file_id: str,
    ctx: Context,
    *,
    allow_env_token: bool,
    key: str,
) -> dict[str, object]:
    payload = _read_model_data_payload(project_id, file_id, ctx, allow_env_token=allow_env_token)
    return {"items": payload[key]}


def tool_list_hbjson_faces(project_id: str, file_id: str, ctx: Context, *, allow_env_token: bool) -> dict[str, object]:
    return _tool_model_data_subset(project_id, file_id, ctx, allow_env_token=allow_env_token, key="faces")


def tool_list_hbjson_spaces(project_id: str, file_id: str, ctx: Context, *, allow_env_token: bool) -> dict[str, object]:
    return _tool_model_data_subset(project_id, file_id, ctx, allow_env_token=allow_env_token, key="spaces")


def tool_list_hbjson_ventilation_systems(
    project_id: str, file_id: str, ctx: Context, *, allow_env_token: bool
) -> dict[str, object]:
    return _tool_model_data_subset(project_id, file_id, ctx, allow_env_token=allow_env_token, key="ventilation_systems")


def tool_list_hbjson_hot_water_systems(
    project_id: str, file_id: str, ctx: Context, *, allow_env_token: bool
) -> dict[str, object]:
    return _tool_model_data_subset(project_id, file_id, ctx, allow_env_token=allow_env_token, key="hot_water_systems")


def tool_list_hbjson_shading_elements(
    project_id: str, file_id: str, ctx: Context, *, allow_env_token: bool
) -> dict[str, object]:
    return _tool_model_data_subset(project_id, file_id, ctx, allow_env_token=allow_env_token, key="shading_elements")


def _raise_hbjson_error(exc: HTTPException, ctx: Context) -> NoReturn:
    raise_http_exception_as_mcp_error(
        exc,
        ctx,
        default_code="hbjson_file_error",
        default_message="HBJSON file operation failed.",
        default_recoverability="fatal",
        recoverability_by_code=_HBJSON_RECOVERABILITY,
    )

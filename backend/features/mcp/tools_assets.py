"""Asset MCP tools."""

from __future__ import annotations

from typing import Any

from mcp.server.fastmcp import Context

from features.assets.models import AttachAssetRequest, BulkDownloadFilter, BulkDownloadRequest, DetachAssetRequest
from features.assets.routes import get_asset_service as _route_get_asset_service
from features.mcp.helpers import current_token, parse_uuid, project_access_or_error

__all__ = [
    "get_asset_service",
    "tool_bulk_attach",
    "tool_bulk_detach",
    "tool_get_asset_url",
    "tool_get_job",
    "tool_list_assets",
    "tool_resolve_asset_urls",
    "tool_start_bulk_download",
]


def get_asset_service() -> Any:
    """Return the asset service, preserving the legacy MCP shim patch point."""

    from features.mcp import tools as compat_tools

    compat_factory = getattr(compat_tools, "get_asset_service", None)
    if compat_factory is not None and compat_factory is not get_asset_service:
        return compat_factory()
    return _route_get_asset_service()


def tool_list_assets(
    project_id: str,
    ctx: Context,
    *,
    allow_env_token: bool,
    version_id: str | None = None,
    filter: dict[str, object] | None = None,
) -> dict[str, object]:
    parsed_project_id = parse_uuid(project_id, "project_id", ctx)
    token = current_token(ctx, allow_env_token)
    access = project_access_or_error(token, parsed_project_id, "asset:read", ctx)
    kind = str((filter or {}).get("kind")) if (filter or {}).get("kind") else None
    assets = get_asset_service().list_assets(access, kind=kind)
    return {"assets": [asset.model_dump(mode="json") for asset in assets], "version_id": version_id}


def tool_get_asset_url(project_id: str, asset_id: str, ctx: Context, *, allow_env_token: bool) -> dict[str, object]:
    parsed_project_id = parse_uuid(project_id, "project_id", ctx)
    token = current_token(ctx, allow_env_token)
    access = project_access_or_error(token, parsed_project_id, "asset:read", ctx)
    return get_asset_service().get_asset_urls(access, asset_id).model_dump(mode="json")


def tool_resolve_asset_urls(
    project_id: str,
    asset_ids: list[str],
    ctx: Context,
    *,
    allow_env_token: bool,
) -> dict[str, object]:
    parsed_project_id = parse_uuid(project_id, "project_id", ctx)
    token = current_token(ctx, allow_env_token)
    access = project_access_or_error(token, parsed_project_id, "asset:read", ctx)
    return {"items": [item.model_dump(mode="json") for item in get_asset_service().bulk_urls(access, asset_ids)]}


def tool_start_bulk_download(
    project_id: str,
    ctx: Context,
    *,
    allow_env_token: bool,
    filter: dict[str, object] | None = None,
    filename_pattern: str | None = None,
    include_manifest_csv: bool = True,
) -> dict[str, object]:
    parsed_project_id = parse_uuid(project_id, "project_id", ctx)
    token = current_token(ctx, allow_env_token)
    access = project_access_or_error(token, parsed_project_id, "asset:read", ctx)
    payload = BulkDownloadRequest(
        filter=BulkDownloadFilter.model_validate(filter or {}),
        filename_pattern=filename_pattern or "{table}/{row.name}__{filename}",
        include_manifest_csv=include_manifest_csv,
    )
    return get_asset_service().start_bulk_download(access, payload).model_dump(mode="json")


def tool_get_job(project_id: str, job_id: str, ctx: Context, *, allow_env_token: bool) -> dict[str, object]:
    parsed_project_id = parse_uuid(project_id, "project_id", ctx)
    token = current_token(ctx, allow_env_token)
    access = project_access_or_error(token, parsed_project_id, "asset:read", ctx)
    return get_asset_service().get_job(access, job_id).model_dump(mode="json")


def tool_bulk_attach(
    project_id: str,
    version_id: str,
    attachments: list[dict[str, object]],
    ctx: Context,
    *,
    allow_env_token: bool,
) -> dict[str, object]:
    parsed_project_id = parse_uuid(project_id, "project_id", ctx)
    token = current_token(ctx, allow_env_token)
    access = project_access_or_error(token, parsed_project_id, "asset:write", ctx)
    service = get_asset_service()
    results: list[dict[str, object]] = []
    for index, item in enumerate(attachments):
        try:
            asset_id = str(item["asset_id"])
            # ``asset_id`` is addressed positionally by the service, not a
            # field of the request model (which forbids extras), so drop it
            # before validating the per-item attach payload.
            fields = {key: value for key, value in item.items() if key != "asset_id"}
            payload = AttachAssetRequest.model_validate({**fields, "version_id": version_id})
            results.append({"index": index, "ok": True, "result": service.attach_asset(access, asset_id, payload)})
        except Exception as exc:
            results.append({"index": index, "ok": False, "error": str(exc)})
    return {"items": results, "partial_failure": any(not item["ok"] for item in results)}


def tool_bulk_detach(
    project_id: str,
    version_id: str,
    asset_refs: list[dict[str, object]],
    ctx: Context,
    *,
    allow_env_token: bool,
) -> dict[str, object]:
    parsed_project_id = parse_uuid(project_id, "project_id", ctx)
    token = current_token(ctx, allow_env_token)
    access = project_access_or_error(token, parsed_project_id, "asset:write", ctx)
    service = get_asset_service()
    results: list[dict[str, object]] = []
    for index, item in enumerate(asset_refs):
        try:
            asset_id = str(item["asset_id"])
            # See ``tool_bulk_attach``: strip the positional ``asset_id``
            # before validating against the extra-forbidding request model.
            fields = {key: value for key, value in item.items() if key != "asset_id"}
            payload = DetachAssetRequest.model_validate({**fields, "version_id": version_id})
            results.append({"index": index, "ok": True, "result": service.detach_asset(access, asset_id, payload)})
        except Exception as exc:
            results.append({"index": index, "ok": False, "error": str(exc)})
    return {"items": results, "partial_failure": any(not item["ok"] for item in results)}

"""MCP tool implementations.

Each `tool_*` function is the body that previously lived inside a
`@mcp.tool()` closure in `server.py`. Lifting them out makes each tool
independently importable / testable and shrinks `build_mcp_server()` to
a stub-registration list.

`allow_env_token` is threaded explicitly through every tool that needs
to resolve the caller's token, replacing the closure capture from the
factory. Tests can call any tool function directly with
`allow_env_token=False` (the production default).
"""

from __future__ import annotations

from typing import cast
from uuid import UUID

from fastapi import HTTPException

# `Context` is imported lazily inside the tool signatures via the
# fastmcp runtime; we import here to keep type annotations resolvable.
from mcp.server.fastmcp import Context
from pydantic import ValidationError

from database import connection
from features.assets.routes import get_asset_service
from features.assets.schemas import AttachAssetRequest, BulkDownloadFilter, BulkDownloadRequest, DetachAssetRequest
from features.auth import repository as auth_repository
from features.auth.models import UserPublic
from features.auth.service import public_user
from features.climate.mcp import (
    tool_get_climate_location,
    tool_list_climate_datasets,
    tool_search_climate_locations,
)
from features.envelope.models import EnvelopeCommandRequest
from features.envelope.service import (
    apply_envelope_command,
    get_envelope_read_model,
    get_project_material_drift_report,
)
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
from features.mcp.models import (
    McpDocumentEnvelope,
    McpProjectEnvelope,
    McpProjectListEnvelope,
    McpRecoverability,
    McpStatusItemListEnvelope,
    McpTableEnvelope,
    McpVersionListEnvelope,
)

# Custom-field schema-mutation tools live in `tools_custom_fields.py`.
# Re-export them so existing
# `from features.mcp.tools import tool_*_custom_field*` callers keep working.
from features.mcp.tools_custom_fields import (
    tool_add_custom_field,
    tool_change_custom_field_type,
    tool_delete_custom_field,
    tool_duplicate_custom_field,
    tool_edit_custom_field_options,
    tool_rename_custom_field,
    tool_set_custom_field_description,
    tool_set_custom_field_formula,
)

# Model-viewer HBJSON file tools live in `tools_model_viewer.py`.
# Re-export them so `from features.mcp.tools import tool_*` callers keep
# one import surface.
from features.mcp.tools_model_viewer import (
    tool_create_hbjson_file,
    tool_delete_hbjson_file,
    tool_get_hbjson_file_download_url,
    tool_get_hbjson_model_data,
    tool_list_hbjson_faces,
    tool_list_hbjson_files,
    tool_list_hbjson_hot_water_systems,
    tool_list_hbjson_shading_elements,
    tool_list_hbjson_spaces,
    tool_list_hbjson_ventilation_systems,
    tool_rename_hbjson_file,
)
from features.project_document.models import ProjectDocumentSource
from features.project_location.mcp import tool_get_project_location, tool_get_project_sun_path
from features.project_status.service import list_project_status_items
from features.projects.models import (
    AccessMode,
    ProjectDeleteRequest,
    ProjectDetail,
    ProjectHardDeleteRequest,
    ProjectSummary,
)
from features.projects.service import (
    delete_project as soft_delete_project,
)
from features.projects.service import (
    get_project_detail,
    hard_delete_project,
    restore_project,
)

__all__ = [
    "tool_add_custom_field",
    "tool_change_custom_field_type",
    "tool_create_hbjson_file",
    "tool_delete_custom_field",
    "tool_delete_hbjson_file",
    "tool_delete_project",
    "tool_get_hbjson_file_download_url",
    "tool_get_hbjson_model_data",
    "tool_list_hbjson_faces",
    "tool_list_hbjson_files",
    "tool_list_hbjson_hot_water_systems",
    "tool_list_hbjson_shading_elements",
    "tool_list_hbjson_spaces",
    "tool_list_hbjson_ventilation_systems",
    "tool_rename_hbjson_file",
    "tool_duplicate_custom_field",
    "tool_edit_custom_field_options",
    "tool_get_climate_location",
    "tool_get_document",
    "tool_get_project",
    "tool_get_project_location",
    "tool_get_project_sun_path",
    "tool_list_climate_datasets",
    "tool_search_climate_locations",
    "tool_get_table",
    "tool_list_projects",
    "tool_list_status_items",
    "tool_list_versions",
    "tool_rename_custom_field",
    "tool_replace_table",
    "tool_get_asset_url",
    "tool_get_job",
    "tool_apply_envelope_command",
    "tool_bulk_attach",
    "tool_bulk_detach",
    "tool_list_assets",
    "tool_list_envelope_assemblies",
    "tool_list_project_materials",
    "tool_query_unfinished_envelope_work",
    "tool_report_material_catalog_drift",
    "tool_report_missing_envelope_evidence",
    "tool_resolve_asset_urls",
    "tool_restore_project",
    "tool_start_bulk_download",
    "tool_hard_delete_project",
    "tool_set_custom_field_description",
    "tool_set_custom_field_formula",
]


# ---------------------------------------------------------------------------
# Read tools
# ---------------------------------------------------------------------------


def _get_project_detail_or_error(project_id: UUID, access_mode: AccessMode, ctx: Context) -> ProjectDetail:
    try:
        return get_project_detail(project_id, access_mode=access_mode)
    except HTTPException as exc:
        raise_http_exception_as_mcp_error(
            exc,
            ctx,
            default_code="project_error",
            default_message="Project could not be loaded.",
            default_recoverability="refresh",
            recoverability_by_code={"project_deleted": "refresh", "project_not_found": "refresh"},
        )


def _token_user_or_error(user_id: UUID, ctx: Context) -> UserPublic:
    with connection() as conn:
        row = auth_repository.get_user_by_id(conn, user_id)
    if row is None or not row["is_active"]:
        raise_mcp_error(
            "mcp_issuing_user_not_found",
            "MCP token issuing user is no longer active.",
            "reauthenticate",
            ctx,
        )
    return public_user(row)


def tool_list_projects(ctx: Context, *, allow_env_token: bool) -> McpProjectListEnvelope:
    token = current_token(ctx, allow_env_token)
    detail = _get_project_detail_or_error(token.project_id, "viewer", ctx)
    project = ProjectSummary.model_validate(
        detail.model_dump(exclude={"versions", "active_version", "access_mode", "owner_display_name"})
    )
    return McpProjectListEnvelope(projects=[project])


def tool_get_project(project_id: str, ctx: Context, *, allow_env_token: bool) -> McpProjectEnvelope:
    parsed_project_id = parse_uuid(project_id, "project_id", ctx)
    token = current_token(ctx, allow_env_token)
    require_token_scope_or_error(token, parsed_project_id, "project:read", ctx)
    detail = _get_project_detail_or_error(parsed_project_id, "editor", ctx)
    return McpProjectEnvelope(
        project=ProjectSummary.model_validate(
            detail.model_dump(exclude={"versions", "active_version", "access_mode", "owner_display_name"})
        ),
        active_version=detail.active_version,
        versions=detail.versions,
    )


def tool_list_versions(project_id: str, ctx: Context, *, allow_env_token: bool) -> McpVersionListEnvelope:
    parsed_project_id = parse_uuid(project_id, "project_id", ctx)
    token = current_token(ctx, allow_env_token)
    require_token_scope_or_error(token, parsed_project_id, "project:read", ctx)
    detail = _get_project_detail_or_error(parsed_project_id, "editor", ctx)
    return McpVersionListEnvelope(versions=detail.versions)


def tool_delete_project(project_id: str, ctx: Context, *, allow_env_token: bool) -> dict[str, object]:
    parsed_project_id = parse_uuid(project_id, "project_id", ctx)
    token = current_token(ctx, allow_env_token)
    require_token_scope_or_error(token, parsed_project_id, "project:write", ctx)
    user = _token_user_or_error(token.issued_by_user_id, ctx)
    try:
        return soft_delete_project(
            parsed_project_id,
            ProjectDeleteRequest(confirm=True),
            user,
            request_meta=None,
        ).model_dump(mode="json")
    except HTTPException as exc:
        raise_http_exception_as_mcp_error(
            exc,
            ctx,
            default_code="project_delete_failed",
            default_message="Project delete failed.",
            default_recoverability="fatal",
        )


def tool_restore_project(project_id: str, ctx: Context, *, allow_env_token: bool) -> dict[str, object]:
    parsed_project_id = parse_uuid(project_id, "project_id", ctx)
    token = current_token(ctx, allow_env_token)
    require_token_scope_or_error(token, parsed_project_id, "project:write", ctx)
    user = _token_user_or_error(token.issued_by_user_id, ctx)
    try:
        return restore_project(parsed_project_id, user, request_meta=None).model_dump(mode="json")
    except HTTPException as exc:
        raise_http_exception_as_mcp_error(
            exc,
            ctx,
            default_code="project_restore_failed",
            default_message="Project restore failed.",
            default_recoverability="fatal",
            recoverability_by_code={"project_restore_expired": "fatal", "project_not_found": "refresh"},
        )


def tool_hard_delete_project(
    project_id: str,
    confirm_project_name: str,
    confirm_bt_number: str,
    ctx: Context,
    *,
    allow_env_token: bool,
) -> dict[str, object]:
    parsed_project_id = parse_uuid(project_id, "project_id", ctx)
    token = current_token(ctx, allow_env_token)
    require_token_scope_or_error(token, parsed_project_id, "project:write", ctx)
    user = _token_user_or_error(token.issued_by_user_id, ctx)
    try:
        return hard_delete_project(
            parsed_project_id,
            ProjectHardDeleteRequest(
                confirm_project_name=confirm_project_name,
                confirm_bt_number=confirm_bt_number,
            ),
            user=user,
            request_meta=None,
        ).model_dump(mode="json")
    except HTTPException as exc:
        raise_http_exception_as_mcp_error(
            exc,
            ctx,
            default_code="project_hard_delete_failed",
            default_message="Project hard-delete failed.",
            default_recoverability="fatal",
            recoverability_by_code={
                "project_not_found": "refresh",
                "project_hard_delete_storage_partial_failure": "retry",
            },
        )


def tool_list_status_items(project_id: str, ctx: Context, *, allow_env_token: bool) -> McpStatusItemListEnvelope:
    parsed_project_id = parse_uuid(project_id, "project_id", ctx)
    token = current_token(ctx, allow_env_token)
    access = project_access_or_error(token, parsed_project_id, "project:read", ctx)
    response = list_project_status_items(access)
    return McpStatusItemListEnvelope(items=response.items)


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


def tool_list_envelope_assemblies(
    project_id: str,
    version_id: str,
    ctx: Context,
    *,
    allow_env_token: bool,
    source: ProjectDocumentSource = "draft",
) -> dict[str, object]:
    parsed_project_id = parse_uuid(project_id, "project_id", ctx)
    parsed_version_id = parse_uuid(version_id, "version_id", ctx)
    token = current_token(ctx, allow_env_token)
    access = project_access_or_error(token, parsed_project_id, "project:read", ctx)
    try:
        response = get_envelope_read_model(parsed_version_id, access, source)
    except HTTPException as exc:
        raise_http_exception_as_mcp_error(
            exc,
            ctx,
            default_code="envelope_read_failed",
            default_message="Envelope assemblies could not be loaded.",
            default_recoverability="refresh",
            recoverability_by_code=_ENVELOPE_RECOVERABILITY,
        )
    return {
        "project_id": str(response.project_id),
        "version_id": str(response.version_id),
        "source": response.source,
        "version_etag": response.version_etag,
        "draft_etag": response.draft_etag,
        "assemblies": [assembly.model_dump(mode="json") for assembly in response.assemblies],
    }


def tool_list_project_materials(
    project_id: str,
    version_id: str,
    ctx: Context,
    *,
    allow_env_token: bool,
    source: ProjectDocumentSource = "draft",
) -> dict[str, object]:
    parsed_project_id = parse_uuid(project_id, "project_id", ctx)
    parsed_version_id = parse_uuid(version_id, "version_id", ctx)
    token = current_token(ctx, allow_env_token)
    access = project_access_or_error(token, parsed_project_id, "project:read", ctx)
    try:
        response = get_envelope_read_model(parsed_version_id, access, source)
    except HTTPException as exc:
        raise_http_exception_as_mcp_error(
            exc,
            ctx,
            default_code="envelope_read_failed",
            default_message="Project materials could not be loaded.",
            default_recoverability="refresh",
            recoverability_by_code=_ENVELOPE_RECOVERABILITY,
        )
    return {
        "project_id": str(response.project_id),
        "version_id": str(response.version_id),
        "source": response.source,
        "version_etag": response.version_etag,
        "draft_etag": response.draft_etag,
        "project_materials": [material.model_dump(mode="json") for material in response.project_materials],
    }


def tool_report_material_catalog_drift(
    project_id: str,
    version_id: str,
    ctx: Context,
    *,
    allow_env_token: bool,
    source: ProjectDocumentSource = "draft",
) -> dict[str, object]:
    parsed_project_id = parse_uuid(project_id, "project_id", ctx)
    parsed_version_id = parse_uuid(version_id, "version_id", ctx)
    token = current_token(ctx, allow_env_token)
    access = project_access_or_error(token, parsed_project_id, "project:read", ctx)
    try:
        return get_project_material_drift_report(parsed_version_id, access, source).model_dump(mode="json")
    except HTTPException as exc:
        raise_http_exception_as_mcp_error(
            exc,
            ctx,
            default_code="envelope_drift_failed",
            default_message="Material catalog drift could not be loaded.",
            default_recoverability="refresh",
            recoverability_by_code=_ENVELOPE_RECOVERABILITY,
        )


def tool_report_missing_envelope_evidence(
    project_id: str,
    version_id: str,
    ctx: Context,
    *,
    allow_env_token: bool,
    source: ProjectDocumentSource = "draft",
) -> dict[str, object]:
    read = tool_list_project_materials(project_id, version_id, ctx, allow_env_token=allow_env_token, source=source)
    missing_datasheets: list[dict[str, object]] = []
    missing_site_photos: list[dict[str, object]] = []
    for material in _dict_items(read.get("project_materials")):
        if not material.get("datasheet_asset_ids"):
            missing_datasheets.append(
                {
                    "project_material_id": material.get("id"),
                    "project_material_name": material.get("name"),
                    "specification_status": material.get("specification_status"),
                }
            )
        use_sites = material.get("use_sites")
        for site in _dict_items(use_sites):
            if not site.get("photo_asset_ids"):
                missing_site_photos.append(
                    {
                        "project_material_id": material.get("id"),
                        "project_material_name": material.get("name"),
                        "assembly_id": site.get("assembly_id"),
                        "assembly_name": site.get("assembly_name"),
                        "layer_id": site.get("layer_id"),
                        "segment_id": site.get("segment_id"),
                    }
                )
    return {
        **{key: read[key] for key in ("project_id", "version_id", "source", "version_etag", "draft_etag")},
        "missing_datasheet_count": len(missing_datasheets),
        "missing_site_photo_count": len(missing_site_photos),
        "missing_datasheets": missing_datasheets,
        "missing_site_photos": missing_site_photos,
    }


def tool_query_unfinished_envelope_work(
    project_id: str,
    version_id: str,
    ctx: Context,
    *,
    allow_env_token: bool,
    source: ProjectDocumentSource = "draft",
) -> dict[str, object]:
    assemblies = tool_list_envelope_assemblies(
        project_id,
        version_id,
        ctx,
        allow_env_token=allow_env_token,
        source=source,
    )
    materials = tool_list_project_materials(project_id, version_id, ctx, allow_env_token=allow_env_token, source=source)
    evidence = tool_report_missing_envelope_evidence(
        project_id,
        version_id,
        ctx,
        allow_env_token=allow_env_token,
        source=source,
    )
    drift = tool_report_material_catalog_drift(
        project_id,
        version_id,
        ctx,
        allow_env_token=allow_env_token,
        source=source,
    )
    missing_materials: list[dict[str, object]] = []
    missing_conductivity: list[dict[str, object]] = []
    referenced_material_ids: set[str] = set()
    material_by_id: dict[str, dict[str, object]] = {
        str(material.get("id")): material
        for material in _dict_items(materials.get("project_materials"))
        if material.get("id") is not None
    }
    for assembly in _dict_items(assemblies.get("assemblies")):
        for layer in _dict_items(assembly.get("layers")):
            for segment in _dict_items(layer.get("segments")):
                material_id = segment.get("project_material_id")
                if material_id is None:
                    missing_materials.append(_segment_work_item(assembly, layer, segment))
                    continue
                material_id_str = str(material_id)
                referenced_material_ids.add(material_id_str)
                material = material_by_id.get(material_id_str)
                if material is not None and material.get("conductivity_w_mk") is None:
                    missing_conductivity.append(
                        {
                            **_segment_work_item(assembly, layer, segment),
                            "project_material_id": material_id_str,
                            "project_material_name": material.get("name"),
                        }
                    )
    unused_materials = [
        {"project_material_id": material_id, "project_material_name": material.get("name")}
        for material_id, material in material_by_id.items()
        if material_id not in referenced_material_ids
    ]
    drifted = [
        item for item in _dict_items(drift.get("materials")) if item.get("state") not in {"in_sync", "customized"}
    ]
    return {
        "project_id": assemblies["project_id"],
        "version_id": assemblies["version_id"],
        "source": assemblies["source"],
        "version_etag": assemblies["version_etag"],
        "draft_etag": assemblies["draft_etag"],
        "counts": {
            "missing_materials": len(missing_materials),
            "missing_conductivity": len(missing_conductivity),
            "missing_datasheets": evidence["missing_datasheet_count"],
            "missing_site_photos": evidence["missing_site_photo_count"],
            "unused_materials": len(unused_materials),
            "catalog_drift": len(drifted),
        },
        "missing_materials": missing_materials,
        "missing_conductivity": missing_conductivity,
        "missing_datasheets": evidence["missing_datasheets"],
        "missing_site_photos": evidence["missing_site_photos"],
        "unused_materials": unused_materials,
        "catalog_drift": drifted,
    }


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
            payload = AttachAssetRequest.model_validate({**item, "version_id": version_id})
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
            payload = DetachAssetRequest.model_validate({**item, "version_id": version_id})
            results.append({"index": index, "ok": True, "result": service.detach_asset(access, asset_id, payload)})
        except Exception as exc:
            results.append({"index": index, "ok": False, "error": str(exc)})
    return {"items": results, "partial_failure": any(not item["ok"] for item in results)}


# ---------------------------------------------------------------------------
# Write tools
# ---------------------------------------------------------------------------


def tool_apply_envelope_command(
    project_id: str,
    version_id: str,
    command: dict[str, object],
    ctx: Context,
    *,
    allow_env_token: bool,
    if_match: str | None = None,
    if_match_version: str | None = None,
) -> dict[str, object]:
    parsed_project_id = parse_uuid(project_id, "project_id", ctx)
    parsed_version_id = parse_uuid(version_id, "version_id", ctx)
    token = current_token(ctx, allow_env_token)
    access = project_access_or_error(token, parsed_project_id, "project:write", ctx)
    try:
        payload = EnvelopeCommandRequest.model_validate({"command": command})
        response = apply_envelope_command(
            parsed_version_id,
            access,
            payload.command,
            if_match=if_match,
            if_match_version=if_match_version,
            updated_via="mcp",
        )
    except ValidationError as exc:
        raise_mcp_error(
            "validation_error",
            "Envelope command failed validation.",
            "fatal",
            ctx,
            {"errors": [str(error["msg"]) for error in exc.errors()]},
        )
    except HTTPException as exc:
        raise_http_exception_as_mcp_error(
            exc,
            ctx,
            default_code="envelope_command_failed",
            default_message="Envelope command failed.",
            default_recoverability="fatal",
            recoverability_by_code=_ENVELOPE_RECOVERABILITY,
        )
    return response.model_dump(mode="json")


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


_ENVELOPE_RECOVERABILITY: dict[str, McpRecoverability] = {
    "project_version_not_found": "refresh",
    "version_locked": "refresh",
    "draft_etag_mismatch": "refresh",
    "version_etag_mismatch": "refresh",
    "duplicate_assembly_name": "fatal",
    "last_layer": "fatal",
    "last_segment": "fatal",
    "assembly_not_found": "refresh",
    "layer_not_found": "refresh",
    "segment_not_found": "refresh",
    "project_material_not_found": "refresh",
    "catalog_material_not_found": "refresh",
    "ambiguous_catalog_material": "fatal",
    "project_material_has_no_catalog_origin": "refresh",
    "catalog_material_source_missing": "refresh",
    "catalog_material_source_deactivated": "refresh",
}


def _dict_items(value: object) -> list[dict[str, object]]:
    if not isinstance(value, list):
        return []
    return [cast(dict[str, object], item) for item in value if isinstance(item, dict)]


def _segment_work_item(
    assembly: dict[str, object],
    layer: dict[str, object],
    segment: dict[str, object],
) -> dict[str, object]:
    return {
        "assembly_id": assembly.get("id"),
        "assembly_name": assembly.get("name"),
        "layer_id": layer.get("id"),
        "layer_order": layer.get("order"),
        "segment_id": segment.get("id"),
        "segment_order": segment.get("order"),
    }

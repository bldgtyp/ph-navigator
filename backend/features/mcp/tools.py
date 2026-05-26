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

# `Context` is imported lazily inside the tool signatures via the
# fastmcp runtime; we import here to keep type annotations resolvable.
from mcp.server.fastmcp import Context

from features.assets.routes import get_asset_service
from features.assets.schemas import AttachAssetRequest, BulkDownloadFilter, BulkDownloadRequest, DetachAssetRequest
from features.mcp.helpers import (
    apply_mcp_schema_mutation,
    apply_mcp_schema_mutation_with_audit,
    build_schema_mutation,
    current_document_view_or_error,
    current_token,
    custom_field_response,
    parse_uuid,
    project_access_or_error,
    raise_mcp_error,
    require_token_scope_or_error,
    table_contract_or_error,
)
from features.mcp.models import (
    McpDocumentEnvelope,
    McpProjectEnvelope,
    McpProjectListEnvelope,
    McpStatusItemListEnvelope,
    McpTableEnvelope,
    McpVersionListEnvelope,
)
from features.project_document.schema_mutations import (
    AddFieldMutation,
    ChangeTypeMutation,
    DeleteFieldMutation,
    DuplicateFieldMutation,
    EditOptionsMutation,
    RenameFieldMutation,
    SetDescriptionMutation,
    SetFormulaMutation,
)
from features.project_status.service import list_project_status_items
from features.projects.models import ProjectSummary
from features.projects.service import get_project_detail

__all__ = [
    "tool_add_custom_field",
    "tool_change_custom_field_type",
    "tool_delete_custom_field",
    "tool_duplicate_custom_field",
    "tool_edit_custom_field_options",
    "tool_get_document",
    "tool_get_project",
    "tool_get_table",
    "tool_list_projects",
    "tool_list_status_items",
    "tool_list_versions",
    "tool_rename_custom_field",
    "tool_replace_table",
    "tool_get_asset_url",
    "tool_get_job",
    "tool_bulk_attach",
    "tool_bulk_detach",
    "tool_list_assets",
    "tool_resolve_asset_urls",
    "tool_start_bulk_download",
    "tool_set_custom_field_description",
    "tool_set_custom_field_formula",
]


# ---------------------------------------------------------------------------
# Read tools
# ---------------------------------------------------------------------------


def tool_list_projects(ctx: Context, *, allow_env_token: bool) -> McpProjectListEnvelope:
    token = current_token(ctx, allow_env_token)
    detail = get_project_detail(token.project_id, access_mode="viewer")
    project = ProjectSummary.model_validate(
        detail.model_dump(exclude={"versions", "active_version", "access_mode", "owner_display_name"})
    )
    return McpProjectListEnvelope(projects=[project])


def tool_get_project(project_id: str, ctx: Context, *, allow_env_token: bool) -> McpProjectEnvelope:
    parsed_project_id = parse_uuid(project_id, "project_id", ctx)
    token = current_token(ctx, allow_env_token)
    require_token_scope_or_error(token, parsed_project_id, "project:read", ctx)
    detail = get_project_detail(parsed_project_id, access_mode="editor")
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
    detail = get_project_detail(parsed_project_id, access_mode="editor")
    return McpVersionListEnvelope(versions=detail.versions)


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


def tool_add_custom_field(
    project_id: str,
    version_id: str,
    table_key: str,
    after: dict[str, object],
    expected_schema_fingerprint: str,
    ctx: Context,
    *,
    allow_env_token: bool,
    insert_after_field_id: str | None = None,
    if_match: str | None = None,
    if_match_version: str | None = None,
) -> dict[str, object]:
    mutation = build_schema_mutation(
        ctx,
        AddFieldMutation,
        kind="addField",
        table_key=table_key,
        after=after,
        expected_schema_fingerprint=expected_schema_fingerprint,
        insert_after_field_id=insert_after_field_id,
    )
    response = apply_mcp_schema_mutation(
        ctx,
        project_id,
        version_id,
        table_key,
        mutation,
        if_match=if_match,
        if_match_version=if_match_version,
        allow_env_token=allow_env_token,
    )
    return custom_field_response(response, mutation.after.id, ctx)


def tool_rename_custom_field(
    project_id: str,
    version_id: str,
    table_key: str,
    field_id: str,
    display_name: str,
    expected_schema_fingerprint: str,
    ctx: Context,
    *,
    allow_env_token: bool,
    if_match: str | None = None,
    if_match_version: str | None = None,
) -> dict[str, object]:
    mutation = build_schema_mutation(
        ctx,
        RenameFieldMutation,
        kind="renameField",
        table_key=table_key,
        field_id=field_id,
        display_name=display_name,
        expected_schema_fingerprint=expected_schema_fingerprint,
    )
    response = apply_mcp_schema_mutation(
        ctx,
        project_id,
        version_id,
        table_key,
        mutation,
        if_match=if_match,
        if_match_version=if_match_version,
        allow_env_token=allow_env_token,
    )
    return custom_field_response(response, field_id, ctx)


def tool_delete_custom_field(
    project_id: str,
    version_id: str,
    table_key: str,
    field_id: str,
    expected_schema_fingerprint: str,
    ctx: Context,
    *,
    allow_env_token: bool,
    if_match: str | None = None,
    if_match_version: str | None = None,
) -> dict[str, object]:
    mutation = build_schema_mutation(
        ctx,
        DeleteFieldMutation,
        kind="deleteField",
        table_key=table_key,
        field_id=field_id,
        expected_schema_fingerprint=expected_schema_fingerprint,
    )
    _response, audit_payload = apply_mcp_schema_mutation_with_audit(
        ctx,
        project_id,
        version_id,
        table_key,
        mutation,
        if_match=if_match,
        if_match_version=if_match_version,
        allow_env_token=allow_env_token,
    )
    return {
        "removed_field_id": field_id,
        "cleared_row_count": audit_payload.get("cleared_row_count", 0),
    }


def tool_duplicate_custom_field(
    project_id: str,
    version_id: str,
    table_key: str,
    source_field_id: str,
    after: dict[str, object],
    expected_schema_fingerprint: str,
    ctx: Context,
    *,
    allow_env_token: bool,
    if_match: str | None = None,
    if_match_version: str | None = None,
) -> dict[str, object]:
    mutation = build_schema_mutation(
        ctx,
        DuplicateFieldMutation,
        kind="duplicateField",
        table_key=table_key,
        source_field_id=source_field_id,
        after=after,
        expected_schema_fingerprint=expected_schema_fingerprint,
    )
    response = apply_mcp_schema_mutation(
        ctx,
        project_id,
        version_id,
        table_key,
        mutation,
        if_match=if_match,
        if_match_version=if_match_version,
        allow_env_token=allow_env_token,
    )
    return custom_field_response(response, mutation.after.id, ctx)


def tool_change_custom_field_type(
    project_id: str,
    version_id: str,
    table_key: str,
    field_id: str,
    after: dict[str, object],
    expected_schema_fingerprint: str,
    ctx: Context,
    *,
    allow_env_token: bool,
    acknowledge_destructive: bool = False,
    if_match: str | None = None,
    if_match_version: str | None = None,
) -> dict[str, object]:
    mutation = build_schema_mutation(
        ctx,
        ChangeTypeMutation,
        kind="changeType",
        table_key=table_key,
        field_id=field_id,
        after=after,
        expected_schema_fingerprint=expected_schema_fingerprint,
        acknowledge_destructive=acknowledge_destructive,
    )
    response, audit_payload = apply_mcp_schema_mutation_with_audit(
        ctx,
        project_id,
        version_id,
        table_key,
        mutation,
        if_match=if_match,
        if_match_version=if_match_version,
        allow_env_token=allow_env_token,
    )
    return {
        "field": custom_field_response(response, field_id, ctx),
        "audit": audit_payload,
    }


def tool_edit_custom_field_options(
    project_id: str,
    version_id: str,
    table_key: str,
    field_id: str,
    next_options: list[dict[str, object]],
    expected_schema_fingerprint: str,
    ctx: Context,
    *,
    allow_env_token: bool,
    replacements: dict[str, str] | None = None,
    if_match: str | None = None,
    if_match_version: str | None = None,
) -> dict[str, object]:
    mutation = build_schema_mutation(
        ctx,
        EditOptionsMutation,
        kind="editOptions",
        table_key=table_key,
        field_id=field_id,
        next_options=next_options,
        replacements=replacements or {},
        expected_schema_fingerprint=expected_schema_fingerprint,
    )
    _response, audit_payload = apply_mcp_schema_mutation_with_audit(
        ctx,
        project_id,
        version_id,
        table_key,
        mutation,
        if_match=if_match,
        if_match_version=if_match_version,
        allow_env_token=allow_env_token,
    )
    return {
        "field_id": field_id,
        "added_option_ids": audit_payload.get("added_option_ids", []),
        "deleted_option_ids": audit_payload.get("deleted_option_ids", []),
        "cleared_row_count": audit_payload.get("cleared_row_count", 0),
    }


def tool_set_custom_field_description(
    project_id: str,
    version_id: str,
    table_key: str,
    field_id: str,
    description: str | None,
    expected_schema_fingerprint: str,
    ctx: Context,
    *,
    allow_env_token: bool,
    if_match: str | None = None,
    if_match_version: str | None = None,
) -> dict[str, object]:
    mutation = build_schema_mutation(
        ctx,
        SetDescriptionMutation,
        kind="setDescription",
        table_key=table_key,
        field_id=field_id,
        description=description,
        expected_schema_fingerprint=expected_schema_fingerprint,
    )
    response = apply_mcp_schema_mutation(
        ctx,
        project_id,
        version_id,
        table_key,
        mutation,
        if_match=if_match,
        if_match_version=if_match_version,
        allow_env_token=allow_env_token,
    )
    return custom_field_response(response, field_id, ctx)


def tool_set_custom_field_formula(
    project_id: str,
    version_id: str,
    table_key: str,
    field_id: str,
    source: str,
    expected_schema_fingerprint: str,
    ctx: Context,
    *,
    allow_env_token: bool,
    if_match: str | None = None,
    if_match_version: str | None = None,
) -> dict[str, object]:
    mutation = build_schema_mutation(
        ctx,
        SetFormulaMutation,
        kind="setFormula",
        table_key=table_key,
        field_id=field_id,
        source=source,
        expected_schema_fingerprint=expected_schema_fingerprint,
    )
    response = apply_mcp_schema_mutation(
        ctx,
        project_id,
        version_id,
        table_key,
        mutation,
        if_match=if_match,
        if_match_version=if_match_version,
        allow_env_token=allow_env_token,
    )
    return custom_field_response(response, field_id, ctx)

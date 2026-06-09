"""MCP tool implementations for custom-field schema mutations.

Split out of ``tools.py`` so the schema-mutation surface (8 tools, ~330
lines) lives in its own module. Every tool is a thin glue between the
``build_schema_mutation`` / ``apply_mcp_schema_mutation*`` helpers and a
specific ``*Mutation`` Pydantic envelope.
"""

from __future__ import annotations

from mcp.server.fastmcp import Context

from features.mcp.helpers import (
    apply_mcp_schema_mutation,
    apply_mcp_schema_mutation_with_audit,
    build_schema_mutation,
    custom_field_response,
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

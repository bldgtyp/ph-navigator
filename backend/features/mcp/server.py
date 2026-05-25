"""FastMCP server definition for PH-Navigator V2."""

from __future__ import annotations

import json
import os
from typing import NoReturn, TypeVar, cast
from uuid import UUID

from fastapi import HTTPException
from mcp.server.auth.middleware.auth_context import get_access_token
from mcp.server.auth.settings import AuthSettings
from mcp.server.fastmcp import Context, FastMCP
from mcp.server.fastmcp.exceptions import ToolError
from mcp.server.streamable_http import TransportSecuritySettings
from pydantic import AnyHttpUrl, BaseModel, ValidationError

from config import settings
from features.mcp.models import (
    McpDocumentEnvelope,
    McpProjectEnvelope,
    McpProjectListEnvelope,
    McpRecoverability,
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
from features.project_document.schema_mutations import (
    AddFieldMutation,
    ChangeTypeMutation,
    DeleteFieldMutation,
    DuplicateFieldMutation,
    EditOptionsMutation,
    FieldSchemaMutation,
    RenameFieldMutation,
    SetDescriptionMutation,
    SetFormulaMutation,
)
from features.project_document.service import (
    apply_schema_mutation_to_draft,
    get_current_document_view,
)
from features.project_document.tables import TableContract, get_table_contract
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
        transport_security=TransportSecuritySettings(
            enable_dns_rebinding_protection=settings.mcp_enable_dns_rebinding_protection,
            allowed_hosts=settings.mcp_allowed_hosts_list,
            allowed_origins=settings.mcp_allowed_origins_list,
        ),
    )

    @mcp.tool()
    def list_projects(ctx: Context) -> McpProjectListEnvelope:
        """Return the one project visible to the project-scoped token."""
        token = current_token(ctx, allow_env_token)
        detail = get_project_detail(token.project_id, access_mode="viewer")
        project = ProjectSummary.model_validate(
            detail.model_dump(exclude={"versions", "active_version", "access_mode", "owner_display_name"})
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
                detail.model_dump(exclude={"versions", "active_version", "access_mode", "owner_display_name"})
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

        Custom-field-capable tables (e.g. Rooms) ship the
        ``{custom_fields, rows}`` envelope under the `rows` field:
        callers must look at ``response.rows.rows`` for the row list and
        ``response.rows.custom_fields`` for the per-table custom-field
        registry. Tables without custom fields still emit a bare row
        list under `rows`.
        """
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

    @mcp.tool()
    def add_custom_field(
        project_id: str,
        version_id: str,
        table_key: str,
        after: dict[str, object],
        expected_schema_fingerprint: str,
        ctx: Context,
        insert_after_field_id: str | None = None,
        if_match: str | None = None,
        if_match_version: str | None = None,
    ) -> dict[str, object]:
        """Add a custom field to the token owner's draft.

        `after` is the full ``CustomFieldDef`` payload (id, display_name,
        field_type, config, description, created_at, created_by). The
        token's user id overwrites ``created_by`` server-side.
        Optimistic concurrency rides on ``expected_schema_fingerprint``;
        a stale fingerprint returns ``custom_field_stale_schema_fingerprint``
        with recoverability ``refresh``.
        """
        mutation = _build_schema_mutation(
            ctx,
            AddFieldMutation,
            kind="addField",
            table_key=table_key,
            after=after,
            expected_schema_fingerprint=expected_schema_fingerprint,
            insert_after_field_id=insert_after_field_id,
        )
        response = _apply_mcp_schema_mutation(
            ctx,
            project_id,
            version_id,
            table_key,
            mutation,
            if_match=if_match,
            if_match_version=if_match_version,
            allow_env_token=allow_env_token,
        )
        return _custom_field_response(response, mutation.after.id, ctx)

    @mcp.tool()
    def rename_custom_field(
        project_id: str,
        version_id: str,
        table_key: str,
        field_id: str,
        display_name: str,
        expected_schema_fingerprint: str,
        ctx: Context,
        if_match: str | None = None,
        if_match_version: str | None = None,
    ) -> dict[str, object]:
        """Rename a custom field. The stable ``cf_*`` id is preserved."""
        mutation = _build_schema_mutation(
            ctx,
            RenameFieldMutation,
            kind="renameField",
            table_key=table_key,
            field_id=field_id,
            display_name=display_name,
            expected_schema_fingerprint=expected_schema_fingerprint,
        )
        response = _apply_mcp_schema_mutation(
            ctx,
            project_id,
            version_id,
            table_key,
            mutation,
            if_match=if_match,
            if_match_version=if_match_version,
            allow_env_token=allow_env_token,
        )
        return _custom_field_response(response, field_id, ctx)

    @mcp.tool()
    def delete_custom_field(
        project_id: str,
        version_id: str,
        table_key: str,
        field_id: str,
        expected_schema_fingerprint: str,
        ctx: Context,
        if_match: str | None = None,
        if_match_version: str | None = None,
    ) -> dict[str, object]:
        """Delete a custom field and strip its values from every row.

        Returns ``{ removed_field_id, cleared_row_count }``.
        """
        mutation = _build_schema_mutation(
            ctx,
            DeleteFieldMutation,
            kind="deleteField",
            table_key=table_key,
            field_id=field_id,
            expected_schema_fingerprint=expected_schema_fingerprint,
        )
        _response, audit_payload = _apply_mcp_schema_mutation_with_audit(
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

    @mcp.tool()
    def duplicate_custom_field(
        project_id: str,
        version_id: str,
        table_key: str,
        source_field_id: str,
        after: dict[str, object],
        expected_schema_fingerprint: str,
        ctx: Context,
        if_match: str | None = None,
        if_match_version: str | None = None,
    ) -> dict[str, object]:
        """Duplicate an existing custom field with a fresh ``cf_*`` id.

        ``after`` is the full duplicate ``CustomFieldDef`` payload —
        caller deep-copies ``field_type`` / ``config`` / ``description``
        from the source. Row values are not copied.
        """
        mutation = _build_schema_mutation(
            ctx,
            DuplicateFieldMutation,
            kind="duplicateField",
            table_key=table_key,
            source_field_id=source_field_id,
            after=after,
            expected_schema_fingerprint=expected_schema_fingerprint,
        )
        response = _apply_mcp_schema_mutation(
            ctx,
            project_id,
            version_id,
            table_key,
            mutation,
            if_match=if_match,
            if_match_version=if_match_version,
            allow_env_token=allow_env_token,
        )
        return _custom_field_response(response, mutation.after.id, ctx)

    @mcp.tool()
    def change_custom_field_type(
        project_id: str,
        version_id: str,
        table_key: str,
        field_id: str,
        after: dict[str, object],
        expected_schema_fingerprint: str,
        ctx: Context,
        acknowledge_destructive: bool = False,
        if_match: str | None = None,
        if_match_version: str | None = None,
    ) -> dict[str, object]:
        """Change a custom field's type. If the conversion would clear
        cells and ``acknowledge_destructive`` is False, returns a
        structured ``custom_field_coercion_preflight_required`` error
        carrying the preflight diagnostics so the caller can surface
        them and re-issue with the ack flag."""
        mutation = _build_schema_mutation(
            ctx,
            ChangeTypeMutation,
            kind="changeType",
            table_key=table_key,
            field_id=field_id,
            after=after,
            expected_schema_fingerprint=expected_schema_fingerprint,
            acknowledge_destructive=acknowledge_destructive,
        )
        response, audit_payload = _apply_mcp_schema_mutation_with_audit(
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
            "field": _custom_field_response(response, field_id, ctx),
            "audit": audit_payload,
        }

    @mcp.tool()
    def edit_custom_field_options(
        project_id: str,
        version_id: str,
        table_key: str,
        field_id: str,
        next_options: list[dict[str, object]],
        expected_schema_fingerprint: str,
        ctx: Context,
        replacements: dict[str, str] | None = None,
        if_match: str | None = None,
        if_match_version: str | None = None,
    ) -> dict[str, object]:
        """Add / rename / reorder / recolor / delete single-select options.

        Works for both custom (``cf_*``) and core single-select fields.
        Deletes cascade to row clears; the response carries
        ``cleared_row_count``. Required core single-select fields
        (e.g. ``rooms.floor_level``) reject deletes without an explicit
        ``replacements[old_option_id] = new_option_id`` mapping.
        """
        mutation = _build_schema_mutation(
            ctx,
            EditOptionsMutation,
            kind="editOptions",
            table_key=table_key,
            field_id=field_id,
            next_options=next_options,
            replacements=replacements or {},
            expected_schema_fingerprint=expected_schema_fingerprint,
        )
        _response, audit_payload = _apply_mcp_schema_mutation_with_audit(
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

    @mcp.tool()
    def set_custom_field_description(
        project_id: str,
        version_id: str,
        table_key: str,
        field_id: str,
        description: str | None,
        expected_schema_fingerprint: str,
        ctx: Context,
        if_match: str | None = None,
        if_match_version: str | None = None,
    ) -> dict[str, object]:
        """Set or clear a custom field's description.

        ``None`` clears the description; over-long values are clamped
        to ``CUSTOM_FIELD_DESCRIPTION_MAX`` (280) server-side.
        """
        mutation = _build_schema_mutation(
            ctx,
            SetDescriptionMutation,
            kind="setDescription",
            table_key=table_key,
            field_id=field_id,
            description=description,
            expected_schema_fingerprint=expected_schema_fingerprint,
        )
        response = _apply_mcp_schema_mutation(
            ctx,
            project_id,
            version_id,
            table_key,
            mutation,
            if_match=if_match,
            if_match_version=if_match_version,
            allow_env_token=allow_env_token,
        )
        return _custom_field_response(response, field_id, ctx)

    @mcp.tool()
    def set_custom_field_formula(
        project_id: str,
        version_id: str,
        table_key: str,
        field_id: str,
        source: str,
        expected_schema_fingerprint: str,
        ctx: Context,
        if_match: str | None = None,
        if_match_version: str | None = None,
    ) -> dict[str, object]:
        """Set or replace the formula source on a custom formula field.

        The server parses, resolves refs, and cycle-checks before
        accepting. The response carries the updated `CustomFieldDef`
        with the resolved AST + dep list in `config`.
        """
        mutation = _build_schema_mutation(
            ctx,
            SetFormulaMutation,
            kind="setFormula",
            table_key=table_key,
            field_id=field_id,
            source=source,
            expected_schema_fingerprint=expected_schema_fingerprint,
        )
        response = _apply_mcp_schema_mutation(
            ctx,
            project_id,
            version_id,
            table_key,
            mutation,
            if_match=if_match,
            if_match_version=if_match_version,
            allow_env_token=allow_env_token,
        )
        return _custom_field_response(response, field_id, ctx)

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
        raise_http_exception_as_mcp_error(
            exc,
            ctx,
            default_code="project_document_error",
            default_message="Project document could not be loaded.",
            default_recoverability="fatal",
            recoverability_by_code={"project_version_not_found": "refresh"},
        )


def table_contract_or_error(table_name: str, ctx: Context) -> TableContract:
    try:
        return get_table_contract(table_name)
    except HTTPException as exc:
        raise_http_exception_as_mcp_error(
            exc,
            ctx,
            default_code="document_table_not_found",
            default_message="Document table not found.",
            default_recoverability="refresh",
        )


def raise_http_exception_as_mcp_error(
    exc: HTTPException,
    ctx: Context,
    default_code: str,
    default_message: str,
    default_recoverability: McpRecoverability,
    recoverability_by_code: dict[str, McpRecoverability] | None = None,
) -> NoReturn:
    detail = exc.detail if isinstance(exc.detail, dict) else {}
    code = str(detail.get("error_code", default_code))
    message = str(detail.get("message", default_message))
    details = detail.get("details", {})
    recoverability = (recoverability_by_code or {}).get(code, default_recoverability)
    raise_mcp_error(
        code,
        message,
        recoverability,
        ctx,
        details if isinstance(details, dict) else {},
    )


# Per-error-code recoverability map for the schema-mutation tools.
# Codes not listed default to `"fatal"` so callers don't auto-retry on
# their own bugs.
_SCHEMA_MUTATION_RECOVERABILITY: dict[str, McpRecoverability] = {
    "custom_field_stale_schema_fingerprint": "refresh",
    "version_locked": "refresh",
    "draft_etag_mismatch": "refresh",
    "version_etag_mismatch": "refresh",
    "custom_field_illegal_type_conversion": "fatal",
    "custom_field_coercion_preflight_required": "fatal",
    "custom_field_option_id_unknown": "fatal",
    "custom_field_option_list_invalid": "fatal",
    "custom_field_formula_parse_error": "fatal",
    "custom_field_formula_cycle": "fatal",
    "custom_field_formula_missing_ref": "fatal",
    "custom_field_formula_resource_limit": "fatal",
    "custom_field_formula_unsupported_function": "fatal",
}


_MutationT = TypeVar("_MutationT", bound=BaseModel)


def _build_schema_mutation(
    ctx: Context,
    mutation_cls: type[_MutationT],
    **fields: object,
) -> _MutationT:
    """Build a typed `FieldSchemaMutation` member or raise a structured MCP error.

    Centralizes the ``ValidationError → mcp_error("validation_error",
    "fatal")`` translation so every schema-mutation tool surfaces
    malformed args identically. `None` values are dropped from
    `fields` so a missing optional kwarg falls back to the Pydantic
    default — except `description`, where `None` is the explicit
    "clear" signal for `SetDescriptionMutation`.
    """
    cleaned = {key: value for key, value in fields.items() if value is not None or key == "description"}
    try:
        return mutation_cls.model_validate(cleaned)
    except ValidationError as exc:
        raise_mcp_error(
            "validation_error",
            "Custom-field mutation failed validation.",
            "fatal",
            ctx,
            {"errors": [str(error["msg"]) for error in exc.errors()]},
        )


def _apply_mcp_schema_mutation(
    ctx: Context,
    project_id: str,
    version_id: str,
    table_key: str,
    mutation: BaseModel,
    *,
    if_match: str | None,
    if_match_version: str | None,
    allow_env_token: bool,
) -> BaseModel:
    """Variant that discards the audit payload for tools that don't need it."""
    response, _ = _apply_mcp_schema_mutation_with_audit(
        ctx,
        project_id,
        version_id,
        table_key,
        mutation,
        if_match=if_match,
        if_match_version=if_match_version,
        allow_env_token=allow_env_token,
    )
    return response


def _apply_mcp_schema_mutation_with_audit(
    ctx: Context,
    project_id: str,
    version_id: str,
    table_key: str,
    mutation: BaseModel,
    *,
    if_match: str | None,
    if_match_version: str | None,
    allow_env_token: bool,
) -> tuple[BaseModel, dict[str, object]]:
    """Resolve the token, gate on `project:write`, dispatch through
    ``apply_schema_mutation_to_draft`` with ``updated_via='mcp'``, and
    map any ``HTTPException`` to a structured MCP error envelope.

    ``updated_via='mcp'`` tags the draft row and audit log so the
    browser-side lease indicator can show that an MCP agent is editing.
    """
    parsed_project_id = parse_uuid(project_id, "project_id", ctx)
    parsed_version_id = parse_uuid(version_id, "version_id", ctx)
    token = current_token(ctx, allow_env_token)
    access = project_access_or_error(token, parsed_project_id, "project:write", ctx)
    try:
        response, audit_payload = apply_schema_mutation_to_draft(
            parsed_version_id,
            table_key,
            cast(FieldSchemaMutation, mutation),
            access,
            if_match=if_match,
            if_match_version=if_match_version,
            request=None,
            updated_via="mcp",
        )
    except HTTPException as exc:
        raise_http_exception_as_mcp_error(
            exc,
            ctx,
            default_code="project_document_error",
            default_message="Custom-field schema mutation failed.",
            default_recoverability="fatal",
            recoverability_by_code=_SCHEMA_MUTATION_RECOVERABILITY,
        )
    return response, audit_payload


def _custom_field_response(
    response: BaseModel,
    field_id: str,
    ctx: Context,
) -> dict[str, object]:
    """Pull the named `CustomFieldDef` out of the table envelope.

    Raises ``custom_field_invalid_field_id`` if the field is missing —
    defensive guard, shouldn't fire since apply validated id existence.
    """
    custom_fields = getattr(response, "custom_fields", None)
    if custom_fields is None:
        raise_mcp_error(
            "custom_field_unsupported_table",
            "Response envelope does not expose custom_fields.",
            "fatal",
            ctx,
            {"field_id": field_id},
        )
    for field in custom_fields:
        if field.id == field_id:
            return field.model_dump(mode="json")
    raise_mcp_error(
        "custom_field_invalid_field_id",
        "Mutated field id not present in the response envelope.",
        "fatal",
        ctx,
        {"field_id": field_id},
    )


def raise_mcp_error(
    code: str,
    message: str,
    recoverability: McpRecoverability,
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

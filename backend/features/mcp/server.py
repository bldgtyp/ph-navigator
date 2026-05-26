"""FastMCP server definition for PH-Navigator V2.

Tool implementations live in `features.mcp.tools`; helpers live in
`features.mcp.helpers`. `build_mcp_server` here is the wiring layer:
construct the `FastMCP` instance, then register each tool as a thin
stub closure that forwards to the matching `tool_*` function with
`allow_env_token` already bound. The stubs preserve the public tool
signature and docstring (used by MCP clients to discover and describe
tools); each stub is one line of forwarding.
"""

from __future__ import annotations

from mcp.server.auth.settings import AuthSettings
from mcp.server.fastmcp import Context, FastMCP
from mcp.server.streamable_http import TransportSecuritySettings
from pydantic import AnyHttpUrl

from config import settings
from features.mcp.models import (
    McpDocumentEnvelope,
    McpProjectEnvelope,
    McpProjectListEnvelope,
    McpStatusItemListEnvelope,
    McpTableEnvelope,
    McpVersionListEnvelope,
)
from features.mcp.service import PhNavigatorTokenVerifier
from features.mcp.tools import (
    tool_add_custom_field,
    tool_bulk_attach,
    tool_bulk_detach,
    tool_change_custom_field_type,
    tool_delete_custom_field,
    tool_duplicate_custom_field,
    tool_edit_custom_field_options,
    tool_get_asset_url,
    tool_get_document,
    tool_get_job,
    tool_get_project,
    tool_get_table,
    tool_list_assets,
    tool_list_projects,
    tool_list_status_items,
    tool_list_versions,
    tool_rename_custom_field,
    tool_replace_table,
    tool_resolve_asset_urls,
    tool_set_custom_field_description,
    tool_set_custom_field_formula,
    tool_start_bulk_download,
)

__all__ = ["build_mcp_server", "mcp"]


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

    # Each registration is a stub closure that captures `allow_env_token`
    # and forwards to the matching module-level tool function. The
    # docstring on each stub is the MCP-visible tool description.

    @mcp.tool()
    def list_projects(ctx: Context) -> McpProjectListEnvelope:
        """Return the one project visible to the project-scoped token."""
        return tool_list_projects(ctx, allow_env_token=allow_env_token)

    @mcp.tool()
    def get_project(project_id: str, ctx: Context) -> McpProjectEnvelope:
        """Return project metadata plus version list."""
        return tool_get_project(project_id, ctx, allow_env_token=allow_env_token)

    @mcp.tool()
    def list_versions(project_id: str, ctx: Context) -> McpVersionListEnvelope:
        """Return version metadata for a token-visible project."""
        return tool_list_versions(project_id, ctx, allow_env_token=allow_env_token)

    @mcp.tool()
    def list_status_items(project_id: str, ctx: Context) -> McpStatusItemListEnvelope:
        """Return the relational status tracker for a token-visible project."""
        return tool_list_status_items(project_id, ctx, allow_env_token=allow_env_token)

    @mcp.tool()
    def get_document(project_id: str, version_id: str, ctx: Context) -> McpDocumentEnvelope:
        """Return the current saved document view, or token owner's draft if present."""
        return tool_get_document(project_id, version_id, ctx, allow_env_token=allow_env_token)

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
        return tool_get_table(project_id, version_id, table_name, ctx, allow_env_token=allow_env_token)

    @mcp.tool()
    def list_assets(
        project_id: str,
        ctx: Context,
        version_id: str | None = None,
        filter: dict[str, object] | None = None,
    ) -> dict[str, object]:
        """List uploaded project assets, optionally filtered by kind."""
        return tool_list_assets(project_id, ctx, allow_env_token=allow_env_token, version_id=version_id, filter=filter)

    @mcp.tool()
    def get_asset_url(project_id: str, asset_id: str, ctx: Context) -> dict[str, object]:
        """Return signed preview, download, and thumbnail URLs for one asset."""
        return tool_get_asset_url(project_id, asset_id, ctx, allow_env_token=allow_env_token)

    @mcp.tool()
    def resolve_asset_urls(project_id: str, asset_ids: list[str], ctx: Context) -> dict[str, object]:
        """Return signed preview, download, and thumbnail URLs for up to 100 assets."""
        return tool_resolve_asset_urls(project_id, asset_ids, ctx, allow_env_token=allow_env_token)

    @mcp.tool()
    def start_bulk_download(
        project_id: str,
        ctx: Context,
        filter: dict[str, object] | None = None,
        filename_pattern: str | None = None,
        include_manifest_csv: bool = True,
    ) -> dict[str, object]:
        """Start a deterministic zip export for matching project assets."""
        return tool_start_bulk_download(
            project_id,
            ctx,
            allow_env_token=allow_env_token,
            filter=filter,
            filename_pattern=filename_pattern,
            include_manifest_csv=include_manifest_csv,
        )

    @mcp.tool()
    def get_job(project_id: str, job_id: str, ctx: Context) -> dict[str, object]:
        """Return project-scoped asset job status."""
        return tool_get_job(project_id, job_id, ctx, allow_env_token=allow_env_token)

    @mcp.tool()
    def bulk_attach(
        project_id: str,
        version_id: str,
        attachments: list[dict[str, object]],
        ctx: Context,
    ) -> dict[str, object]:
        """Attach multiple uploaded assets to locked PHN attachment fields."""
        return tool_bulk_attach(project_id, version_id, attachments, ctx, allow_env_token=allow_env_token)

    @mcp.tool()
    def bulk_detach(
        project_id: str,
        version_id: str,
        asset_refs: list[dict[str, object]],
        ctx: Context,
    ) -> dict[str, object]:
        """Detach multiple uploaded assets from locked PHN attachment fields."""
        return tool_bulk_detach(project_id, version_id, asset_refs, ctx, allow_env_token=allow_env_token)

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
        return tool_replace_table(
            project_id,
            version_id,
            table_name,
            ctx,
            allow_env_token=allow_env_token,
            rows=rows,
            draft_etag=draft_etag,
            base_version_etag=base_version_etag,
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
        return tool_add_custom_field(
            project_id,
            version_id,
            table_key,
            after,
            expected_schema_fingerprint,
            ctx,
            allow_env_token=allow_env_token,
            insert_after_field_id=insert_after_field_id,
            if_match=if_match,
            if_match_version=if_match_version,
        )

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
        return tool_rename_custom_field(
            project_id,
            version_id,
            table_key,
            field_id,
            display_name,
            expected_schema_fingerprint,
            ctx,
            allow_env_token=allow_env_token,
            if_match=if_match,
            if_match_version=if_match_version,
        )

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
        return tool_delete_custom_field(
            project_id,
            version_id,
            table_key,
            field_id,
            expected_schema_fingerprint,
            ctx,
            allow_env_token=allow_env_token,
            if_match=if_match,
            if_match_version=if_match_version,
        )

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
        return tool_duplicate_custom_field(
            project_id,
            version_id,
            table_key,
            source_field_id,
            after,
            expected_schema_fingerprint,
            ctx,
            allow_env_token=allow_env_token,
            if_match=if_match,
            if_match_version=if_match_version,
        )

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
        return tool_change_custom_field_type(
            project_id,
            version_id,
            table_key,
            field_id,
            after,
            expected_schema_fingerprint,
            ctx,
            allow_env_token=allow_env_token,
            acknowledge_destructive=acknowledge_destructive,
            if_match=if_match,
            if_match_version=if_match_version,
        )

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
        return tool_edit_custom_field_options(
            project_id,
            version_id,
            table_key,
            field_id,
            next_options,
            expected_schema_fingerprint,
            ctx,
            allow_env_token=allow_env_token,
            replacements=replacements,
            if_match=if_match,
            if_match_version=if_match_version,
        )

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
        return tool_set_custom_field_description(
            project_id,
            version_id,
            table_key,
            field_id,
            description,
            expected_schema_fingerprint,
            ctx,
            allow_env_token=allow_env_token,
            if_match=if_match,
            if_match_version=if_match_version,
        )

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
        return tool_set_custom_field_formula(
            project_id,
            version_id,
            table_key,
            field_id,
            source,
            expected_schema_fingerprint,
            ctx,
            allow_env_token=allow_env_token,
            if_match=if_match,
            if_match_version=if_match_version,
        )

    return mcp


mcp = build_mcp_server()

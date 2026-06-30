"""FastMCP server definition for PH-Navigator.

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
from features.aperture_hbjson_export.mcp import tool_get_aperture_window_constructions
from features.apertures_mcp.tools import (
    tool_apply_aperture_command,
    tool_calculate_aperture_u_values,
    tool_get_aperture_type,
    tool_list_aperture_types,
    tool_report_aperture_catalog_drift,
)
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
    tool_apply_envelope_command,
    tool_bulk_attach,
    tool_bulk_detach,
    tool_change_custom_field_type,
    tool_create_hbjson_file,
    tool_delete_custom_field,
    tool_delete_hbjson_file,
    tool_delete_project,
    tool_diff_versions,
    tool_discard_draft,
    tool_duplicate_custom_field,
    tool_edit_custom_field_options,
    tool_get_asset_url,
    tool_get_climate_location,
    tool_get_document,
    tool_get_hbjson_file_download_url,
    tool_get_hbjson_model_data,
    tool_get_job,
    tool_get_project,
    tool_get_project_location,
    tool_get_project_sun_path,
    tool_get_table,
    tool_hard_delete_project,
    tool_list_assets,
    tool_list_climate_datasets,
    tool_list_envelope_assemblies,
    tool_list_hbjson_faces,
    tool_list_hbjson_files,
    tool_list_hbjson_hot_water_systems,
    tool_list_hbjson_shading_elements,
    tool_list_hbjson_spaces,
    tool_list_hbjson_ventilation_systems,
    tool_list_project_climate_sources,
    tool_list_project_materials,
    tool_list_projects,
    tool_list_status_items,
    tool_list_versions,
    tool_preview_replace_table,
    tool_query_unfinished_envelope_work,
    tool_rename_custom_field,
    tool_rename_hbjson_file,
    tool_replace_table,
    tool_report_material_catalog_drift,
    tool_report_missing_envelope_evidence,
    tool_resolve_asset_urls,
    tool_restore_project,
    tool_save_draft,
    tool_save_draft_as,
    tool_search_climate_locations,
    tool_set_custom_field_description,
    tool_set_custom_field_formula,
    tool_start_bulk_download,
    tool_update_project,
)
from features.project_document.models import DiscardDraftResponse, ProjectDiffResponse, SaveDraftResponse
from features.project_document.tables.contracts import TableReplacePreviewResponse
from features.projects.models import ProjectDetail, VersionKind

__all__ = ["build_mcp_server", "mcp"]


def build_mcp_server(allow_env_token: bool = False) -> FastMCP:
    """Create the MCP tool server used by HTTP and stdio transports."""
    mcp = FastMCP(
        "PH-Navigator",
        instructions=(
            "Project-scoped PH-Navigator tools. Tokens are scoped to one project; "
            "read tools require project:read and write tools require project:write. "
            "Document writes land in the issuing editor's draft, never directly in "
            "the saved version: read current data first, write with the latest "
            "version/draft etag, then call save_draft to persist or discard_draft "
            "to drop unsaved work. Use semantic command tools for envelope and "
            "aperture structure; use replace_table for whole-table browser-parity "
            "table replacement. save_draft_as is the locked-version escape hatch."
        ),
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
    def get_project_location(project_id: str, ctx: Context) -> dict[str, object]:
        """Return SI-canonical project location metadata."""
        return tool_get_project_location(project_id, ctx, allow_env_token=allow_env_token)

    @mcp.tool()
    def get_project_sun_path(project_id: str, ctx: Context) -> dict[str, object] | None:
        """Return the project's sun-path + compass diagram (origin-centered, unit radius), or null when unset."""
        return tool_get_project_sun_path(project_id, ctx, allow_env_token=allow_env_token)

    @mcp.tool()
    def list_project_climate_sources(project_id: str, ctx: Context) -> dict[str, object]:
        """List the climate sources attached to one token-visible project."""
        return tool_list_project_climate_sources(project_id, ctx, allow_env_token=allow_env_token)

    # App-wide climate reference datasets (Phius/PHI). These require a
    # valid token but gate on no single project — the datasets are shared.

    @mcp.tool()
    def list_climate_datasets(ctx: Context) -> list[dict[str, object]]:
        """List the available climate reference datasets (provider/version)."""
        return tool_list_climate_datasets(ctx, allow_env_token=allow_env_token)

    @mcp.tool()
    def search_climate_locations(
        dataset_id: str,
        ctx: Context,
        country: str | None = None,
        region: str | None = None,
        near: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> dict[str, object]:
        """Search a dataset's locations by country/region, or nearest to `lat,long`."""
        return tool_search_climate_locations(
            dataset_id,
            ctx,
            allow_env_token=allow_env_token,
            country=country,
            region=region,
            near=near,
            limit=limit,
            offset=offset,
        )

    @mcp.tool()
    def get_climate_location(location_id: str, ctx: Context) -> dict[str, object] | None:
        """Return one climate-dataset location's standardized record, or null if unknown."""
        return tool_get_climate_location(location_id, ctx, allow_env_token=allow_env_token)

    @mcp.tool()
    def delete_project(project_id: str, ctx: Context) -> dict[str, object]:
        """Soft-delete the token-scoped project after explicit project:write authorization."""
        return tool_delete_project(project_id, ctx, allow_env_token=allow_env_token)

    @mcp.tool()
    def restore_project(project_id: str, ctx: Context) -> dict[str, object]:
        """Restore the token-scoped project during its soft-delete recovery window."""
        return tool_restore_project(project_id, ctx, allow_env_token=allow_env_token)

    @mcp.tool()
    def hard_delete_project(
        project_id: str,
        confirm_project_name: str,
        confirm_bt_number: str,
        ctx: Context,
    ) -> dict[str, object]:
        """Permanently delete the token-scoped project after exact name and BT number confirmation."""
        return tool_hard_delete_project(
            project_id,
            confirm_project_name,
            confirm_bt_number,
            ctx,
            allow_env_token=allow_env_token,
        )

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
    def save_draft(
        project_id: str,
        version_id: str,
        ctx: Context,
        if_match: str | None = None,
    ) -> SaveDraftResponse:
        """Commit the token owner's current draft to the active version.

        Mutating MCP tools write into a draft first. Pass the version_body_etag
        seen when the draft was opened as `if_match`; stale or locked versions
        return a structured refreshable error. If the version is locked, use
        `save_draft_as` to create an unlocked copy instead.
        """
        return tool_save_draft(project_id, version_id, ctx, allow_env_token=allow_env_token, if_match=if_match)

    @mcp.tool()
    def save_draft_as(
        project_id: str,
        version_id: str,
        name: str,
        ctx: Context,
        kind: VersionKind = "working",
        locked: bool = False,
    ) -> SaveDraftResponse:
        """Create a new active version from the token owner's draft or saved body.

        This is the locked-version escape hatch: source versions may be locked,
        and submitted/closed target versions are auto-locked by the service.
        """
        return tool_save_draft_as(
            project_id,
            version_id,
            name,
            ctx,
            allow_env_token=allow_env_token,
            kind=kind,
            locked=locked,
        )

    @mcp.tool()
    def discard_draft(project_id: str, version_id: str, ctx: Context) -> DiscardDraftResponse:
        """Drop the token owner's unsaved draft changes.

        Discard is safe to call when no draft exists; the response reports
        `discarded=false` rather than raising.
        """
        return tool_discard_draft(project_id, version_id, ctx, allow_env_token=allow_env_token)

    @mcp.tool()
    def update_project(
        project_id: str,
        version_id: str,
        ctx: Context,
        locked: bool | None = None,
        make_active: bool | None = None,
    ) -> ProjectDetail:
        """Patch version metadata for REST parity.

        Current shipped fields are `locked` and `make_active`; project/version
        naming is not accepted by the underlying REST service.
        """
        return tool_update_project(
            project_id,
            version_id,
            ctx,
            allow_env_token=allow_env_token,
            locked=locked,
            make_active=make_active,
        )

    @mcp.tool()
    def diff_versions(project_id: str, from_version_id: str, to: str, ctx: Context) -> ProjectDiffResponse:
        """Return per-table changed paths for a version-vs-version or version-vs-draft diff."""
        return tool_diff_versions(project_id, from_version_id, to, ctx, allow_env_token=allow_env_token)

    @mcp.tool()
    def list_envelope_assemblies(
        project_id: str,
        version_id: str,
        ctx: Context,
        source: str = "draft",
    ) -> dict[str, object]:
        """List Assembly Builder assemblies with layers, segments, and status flags."""
        return tool_list_envelope_assemblies(
            project_id,
            version_id,
            ctx,
            allow_env_token=allow_env_token,
            source="version" if source == "version" else "draft",
        )

    @mcp.tool()
    def list_project_materials(
        project_id: str,
        version_id: str,
        ctx: Context,
        source: str = "draft",
    ) -> dict[str, object]:
        """List Assembly Builder project materials with use-sites and evidence ids."""
        return tool_list_project_materials(
            project_id,
            version_id,
            ctx,
            allow_env_token=allow_env_token,
            source="version" if source == "version" else "draft",
        )

    @mcp.tool()
    def query_unfinished_envelope_work(
        project_id: str,
        version_id: str,
        ctx: Context,
        source: str = "draft",
    ) -> dict[str, object]:
        """Report missing material, conductivity, evidence, unused material, and drift work."""
        return tool_query_unfinished_envelope_work(
            project_id,
            version_id,
            ctx,
            allow_env_token=allow_env_token,
            source="version" if source == "version" else "draft",
        )

    @mcp.tool()
    def report_material_catalog_drift(
        project_id: str,
        version_id: str,
        ctx: Context,
        source: str = "draft",
    ) -> dict[str, object]:
        """Report material catalog drift for catalog-origin project materials without writing."""
        return tool_report_material_catalog_drift(
            project_id,
            version_id,
            ctx,
            allow_env_token=allow_env_token,
            source="version" if source == "version" else "draft",
        )

    @mcp.tool()
    def report_missing_envelope_evidence(
        project_id: str,
        version_id: str,
        ctx: Context,
        source: str = "draft",
    ) -> dict[str, object]:
        """Report project materials without datasheets and segment use-sites without photos."""
        return tool_report_missing_envelope_evidence(
            project_id,
            version_id,
            ctx,
            allow_env_token=allow_env_token,
            source="version" if source == "version" else "draft",
        )

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
    def list_hbjson_files(project_id: str, ctx: Context) -> dict[str, object]:
        """List the Model tab's HBJSON files, newest first."""
        return tool_list_hbjson_files(project_id, ctx, allow_env_token=allow_env_token)

    @mcp.tool()
    def create_hbjson_file(
        project_id: str,
        asset_id: str,
        ctx: Context,
        display_name: str | None = None,
        notes: str | None = None,
    ) -> dict[str, object]:
        """Link an uploaded hbjson asset into the Model tab file list (the post-upload link step)."""
        return tool_create_hbjson_file(
            project_id,
            asset_id,
            ctx,
            allow_env_token=allow_env_token,
            display_name=display_name,
            notes=notes,
        )

    @mcp.tool()
    def rename_hbjson_file(
        project_id: str,
        file_id: str,
        ctx: Context,
        display_name: str | None = None,
        notes: str | None = None,
    ) -> dict[str, object]:
        """Rename an HBJSON file and/or update its notes."""
        return tool_rename_hbjson_file(
            project_id,
            file_id,
            ctx,
            allow_env_token=allow_env_token,
            display_name=display_name,
            notes=notes,
        )

    @mcp.tool()
    def delete_hbjson_file(project_id: str, file_id: str, ctx: Context) -> dict[str, object]:
        """Soft-delete an HBJSON file from the Model tab list."""
        return tool_delete_hbjson_file(project_id, file_id, ctx, allow_env_token=allow_env_token)

    @mcp.tool()
    def get_hbjson_file_download_url(project_id: str, file_id: str, ctx: Context) -> dict[str, object]:
        """Return signed download URLs for one HBJSON file."""
        return tool_get_hbjson_file_download_url(project_id, file_id, ctx, allow_env_token=allow_env_token)

    @mcp.tool()
    def get_hbjson_model_data(project_id: str, file_id: str, ctx: Context) -> dict[str, object]:
        """Full extracted 3D-model payload for one HBJSON file (faces, spaces,
        ventilation, hot water, shading, load_summary; SI units). Large —
        prefer the list_hbjson_* subset tools unless you need everything."""
        return tool_get_hbjson_model_data(project_id, file_id, ctx, allow_env_token=allow_env_token)

    @mcp.tool()
    def list_hbjson_faces(project_id: str, file_id: str, ctx: Context) -> dict[str, object]:
        """Opaque faces (with apertures + constructions) from one HBJSON file. SI units."""
        return tool_list_hbjson_faces(project_id, file_id, ctx, allow_env_token=allow_env_token)

    @mcp.tool()
    def list_hbjson_spaces(project_id: str, file_id: str, ctx: Context) -> dict[str, object]:
        """PH spaces (floor segments, airflow in m³/s) from one HBJSON file."""
        return tool_list_hbjson_spaces(project_id, file_id, ctx, allow_env_token=allow_env_token)

    @mcp.tool()
    def list_hbjson_ventilation_systems(project_id: str, file_id: str, ctx: Context) -> dict[str, object]:
        """Ventilation systems (supply/exhaust ducting) from one HBJSON file."""
        return tool_list_hbjson_ventilation_systems(project_id, file_id, ctx, allow_env_token=allow_env_token)

    @mcp.tool()
    def list_hbjson_hot_water_systems(project_id: str, file_id: str, ctx: Context) -> dict[str, object]:
        """Hot-water systems (distribution tree + recirc piping) from one HBJSON file."""
        return tool_list_hbjson_hot_water_systems(project_id, file_id, ctx, allow_env_token=allow_env_token)

    @mcp.tool()
    def list_hbjson_shading_elements(project_id: str, file_id: str, ctx: Context) -> dict[str, object]:
        """Merged shade groups from one HBJSON file."""
        return tool_list_hbjson_shading_elements(project_id, file_id, ctx, allow_env_token=allow_env_token)

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
    def apply_envelope_command(
        project_id: str,
        version_id: str,
        command: dict[str, object],
        ctx: Context,
        if_match: str | None = None,
        if_match_version: str | None = None,
    ) -> dict[str, object]:
        """Apply one semantic Assembly Builder command through the same backend boundary as the browser."""
        return tool_apply_envelope_command(
            project_id,
            version_id,
            command,
            ctx,
            allow_env_token=allow_env_token,
            if_match=if_match,
            if_match_version=if_match_version,
        )

    @mcp.tool()
    def replace_table(
        project_id: str,
        version_id: str,
        table_name: str,
        ctx: Context,
        rows: object | None = None,
        draft_etag: str | None = None,
        base_version_etag: str | None = None,
    ) -> dict[str, object]:
        """Replace one registered table in the token owner's draft.

        This is a whole-table write. Read first, submit the full intended row
        set or full table payload, then call `save_draft` to persist. For
        structural envelope/aperture edits, prefer the semantic command tools;
        this lower-level primitive mirrors the browser table PUT.
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
    def preview_replace_table(
        project_id: str,
        version_id: str,
        table_name: str,
        ctx: Context,
        rows: object | None = None,
        draft_etag: str | None = None,
        base_version_etag: str | None = None,
    ) -> TableReplacePreviewResponse:
        """Dry-run a whole-table replace and report dependent-link cascades.

        Use before destructive `replace_table` calls. The preview validates the
        same payload and etags but does not persist a draft.
        """
        return tool_preview_replace_table(
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
        ``cleared_row_count``. Table registries may mark built-in
        single-select fields as requiring explicit replacement instead
        of clear-to-null; those fields reject deletes without a
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

    @mcp.tool()
    def get_aperture_window_constructions(
        project_id: str,
        version_id: str,
        ctx: Context,
        source: str = "draft",
    ) -> dict[str, dict[str, object]]:
        """Return HBJSON-shaped WindowConstruction dicts keyed by escaped aperture-element id.

        Mirrors the REST `GET /apertures/hbjson` endpoint. Use this when a Rhino /
        Grasshopper component needs the same payload via MCP. Identifier collisions
        and empty-escaped names surface as structured fatal errors.
        """
        return tool_get_aperture_window_constructions(
            project_id,
            version_id,
            ctx,
            allow_env_token=allow_env_token,
            source="version" if source == "version" else "draft",
        )

    @mcp.tool()
    def list_aperture_types(
        project_id: str,
        version_id: str,
        ctx: Context,
        source: str = "draft",
    ) -> dict[str, object]:
        """Return ``{ apertures: [{ id, name, element_count }] }`` for the draft / version."""
        return tool_list_aperture_types(
            project_id,
            version_id,
            ctx,
            allow_env_token=allow_env_token,
            source="version" if source == "version" else "draft",
        )

    @mcp.tool()
    def get_aperture_type(
        project_id: str,
        version_id: str,
        aperture_type_id: str,
        ctx: Context,
        source: str = "draft",
    ) -> dict[str, object]:
        """Return the full ApertureTypeEntry for one aperture type id."""
        return tool_get_aperture_type(
            project_id,
            version_id,
            aperture_type_id,
            ctx,
            allow_env_token=allow_env_token,
            source="version" if source == "version" else "draft",
        )

    @mcp.tool()
    def calculate_aperture_u_values(
        project_id: str,
        version_id: str,
        ctx: Context,
        aperture_type_ids: list[str] | None = None,
        source: str = "draft",
    ) -> dict[str, object]:
        """Return per-aperture composite U-Value results; null `aperture_type_ids` returns every aperture."""
        return tool_calculate_aperture_u_values(
            project_id,
            version_id,
            ctx,
            allow_env_token=allow_env_token,
            aperture_type_ids=aperture_type_ids,
            source="version" if source == "version" else "draft",
        )

    @mcp.tool()
    def report_aperture_catalog_drift(
        project_id: str,
        version_id: str,
        ctx: Context,
        source: str = "draft",
    ) -> dict[str, object]:
        """Return the per-project drift report (field-delta + catalog_row_missing)."""
        return tool_report_aperture_catalog_drift(
            project_id,
            version_id,
            ctx,
            allow_env_token=allow_env_token,
            source="version" if source == "version" else "draft",
        )

    @mcp.tool()
    def apply_aperture_command(
        project_id: str,
        version_id: str,
        command: dict[str, object],
        ctx: Context,
        if_match: str | None = None,
        if_match_version: str | None = None,
    ) -> dict[str, object]:
        """Apply one semantic aperture command through the same draft-buffer dispatcher the browser uses."""
        return tool_apply_aperture_command(
            project_id,
            version_id,
            command,
            ctx,
            allow_env_token=allow_env_token,
            if_match=if_match,
            if_match_version=if_match_version,
        )

    return mcp


mcp = build_mcp_server()

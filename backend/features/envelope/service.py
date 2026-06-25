"""Envelope read and semantic command workflows.

Envelope commands mutate the project-document draft, not relational
shadow tables. This layer keeps the policy contracts that cross command
modules: editor-only writes, draft/version ETag protection, no-op writes
without draft churn, and read models derived from document tables.
Segment widths are normalized per layer, project materials must exist
before segments reference them, and assembly names are compared after
trimming/case-folding. Those invariants stay in the document operation
helpers so browser and MCP callers share one mutation boundary.
"""

from __future__ import annotations

import json
from typing import Any, Literal
from uuid import UUID

from psycopg import Connection
from starlette import status

from database import transaction
from features.envelope import drift, ops
from features.envelope.commands.registry import apply_command as dispatch_envelope_command
from features.envelope.hbjson_import import parse_or_422
from features.envelope.import_models import ImportConstructionsPreviewResponse
from features.envelope.import_planning import build_import_plan
from features.envelope.models import (
    AssemblyThermalResponse,
    EnvelopeCommand,
    EnvelopeReadResponse,
    PhppPreflightItem,
    PhppPreflightResponse,
    ProjectMaterialDriftReport,
)
from features.envelope.phpp_export import phpp_preflight
from features.envelope.selectors import build_envelope_read_parts
from features.envelope.thermal import calculate_assembly_thermal
from features.project_document.audit import log_document_action
from features.project_document.document import ProjectDocumentV1
from features.project_document.models import ProjectDocumentSource
from features.project_document.service import (
    document_etag,
    get_current_document_view,
    get_saved_document,
)
from features.project_document.write_spine import apply_document_write
from features.projects.access import ProjectAccess, require_editor_user
from features.shared.errors import api_error


def get_envelope_read_model(
    version_id: UUID,
    access: ProjectAccess,
    source: ProjectDocumentSource,
) -> EnvelopeReadResponse:
    """Return a derived envelope read model without mutating the document body.

    Viewer/locked routes can ask for the saved version while editors use
    the current draft view. The response carries the ETags that write
    callers need, but assemblies/materials remain projections of
    `tables.assemblies[]` and `tables.project_materials[]`.
    """
    if source == "version":
        body = get_saved_document(version_id, access)
        assemblies, project_materials = build_envelope_read_parts(body)
        return EnvelopeReadResponse(
            project_id=access.project_id,
            version_id=version_id,
            source="version",
            version_etag=document_etag(body),
            draft_etag=None,
            assemblies=assemblies,
            project_materials=project_materials,
        )

    view = get_current_document_view(version_id, access)
    assemblies, project_materials = build_envelope_read_parts(view.body)
    return EnvelopeReadResponse(
        project_id=access.project_id,
        version_id=version_id,
        source=view.source,
        version_etag=view.version_etag,
        draft_etag=view.draft_etag,
        assemblies=assemblies,
        project_materials=project_materials,
    )


def get_assembly_thermal_model(
    version_id: UUID,
    access: ProjectAccess,
    assembly_id: str,
    source: ProjectDocumentSource,
) -> AssemblyThermalResponse:
    """Calculate the preview-only thermal overlay for one assembly.

    Thermal values are derived at read time from the requested draft or
    saved body and are never stored back into the project document. This
    keeps incomplete assemblies visible while still surfacing the same
    issue flags HBJSON export uses for blocking validation.
    """
    if source == "version":
        body = get_saved_document(version_id, access)
        response_source: ProjectDocumentSource = "version"
    else:
        view = get_current_document_view(version_id, access)
        body = view.body
        response_source = view.source

    assembly = ops.find_assembly(body.tables.assemblies, assembly_id)
    result = calculate_assembly_thermal(
        assembly,
        {material.id: material for material in body.tables.project_materials},
    )
    return AssemblyThermalResponse(
        project_id=access.project_id,
        version_id=version_id,
        source=response_source,
        assembly_id=assembly_id,
        input_hash=result.input_hash,
        status=result.status,
        r_parallel_path_m2k_w=result.r_parallel_path_m2k_w,
        r_isothermal_planes_m2k_w=result.r_isothermal_planes_m2k_w,
        r_effective_m2k_w=result.r_effective_m2k_w,
        u_effective_w_m2k=result.u_effective_w_m2k,
        warnings=result.warnings,
    )


def get_project_material_drift_report(
    version_id: UUID,
    access: ProjectAccess,
    source: ProjectDocumentSource,
) -> ProjectMaterialDriftReport:
    """Compare catalog-origin project materials against current catalog rows.

    Project materials are copied into the document at assignment time, so
    catalog changes never mutate a project automatically. This report is
    the explicit review surface for source-missing, source-deactivated,
    and locally overridden catalog fields.
    """
    if source == "version":
        body = get_saved_document(version_id, access)
        response_source: ProjectDocumentSource = "version"
        version_etag = document_etag(body)
        draft_etag: str | None = None
    else:
        view = get_current_document_view(version_id, access)
        body = view.body
        response_source = view.source
        version_etag = view.version_etag
        draft_etag = view.draft_etag

    if drift.catalog_material_record_ids(body.tables.project_materials):
        with transaction() as conn:
            catalog_rows = drift.load_catalog_material_rows(conn, body.tables.project_materials)
    else:
        catalog_rows = {}
    return ProjectMaterialDriftReport(
        project_id=access.project_id,
        version_id=version_id,
        source=response_source,
        version_etag=version_etag,
        draft_etag=draft_etag,
        materials=[
            drift.project_material_drift_item(material, catalog_rows)
            for material in body.tables.project_materials
            if material.catalog_origin is not None
        ],
    )


def get_phpp_export_preflight(version_id: UUID, access: ProjectAccess) -> PhppPreflightResponse:
    """Project each saved assembly's PHPP export eligibility for the modal (PRD §9).

    Export targets the saved version (like HBJSON), so this reads the committed
    body and reshapes the pure ``phpp_preflight`` plans into the wire model.
    """
    body = get_saved_document(version_id, access)
    return PhppPreflightResponse(
        assemblies=[
            PhppPreflightItem(
                id=plan.assembly_id,
                name=plan.assembly_name,
                exportable=plan.exportable,
                reason=plan.reason,
            )
            for plan in phpp_preflight(body)
        ]
    )


def apply_envelope_command(
    version_id: UUID,
    access: ProjectAccess,
    command: EnvelopeCommand,
    if_match: str | None,
    if_match_version: str | None,
    updated_via: Literal["browser", "mcp"] = "browser",
) -> EnvelopeReadResponse:
    """Apply one editor-authorized semantic command to the active draft.

    The draft ETag protects in-flight edits, while the saved-version ETag
    protects the baseline when no draft exists yet. Commands that leave
    the body unchanged return the current read model without writing a new
    draft row, and successful writes tag their audit path with
    `updated_via` so browser and MCP edits remain distinguishable.
    """
    user = require_editor_user(access)

    def mutate(conn: Connection[Any], base_body: ProjectDocumentV1) -> tuple[ProjectDocumentV1, dict[str, object]]:
        return dispatch_envelope_command(conn, base_body, command), {"command_kind": command.kind}

    def on_persisted(conn: Connection[Any], details: dict[str, object] | None) -> None:
        log_document_action(conn, "envelope_command", access, version_id, user.id, None, extra_details=details)

    result = apply_document_write(
        access,
        version_id,
        user.id,
        if_match=if_match,
        if_match_version=if_match_version,
        mutate=mutate,
        draft_etag_mismatch_message="The draft changed before this envelope command was applied.",
        updated_via=updated_via,
        on_persisted=on_persisted,
    )
    assemblies, project_materials = build_envelope_read_parts(result.body)
    return EnvelopeReadResponse(
        project_id=access.project_id,
        version_id=version_id,
        source=result.source,
        version_etag=result.version_etag,
        draft_etag=result.draft_etag,
        assemblies=assemblies,
        project_materials=project_materials,
    )


# Construction libraries are tiny (the example file is a few KB); this cap is a
# DoS guard, matching the catalog import's body limit.
MAX_IMPORT_FILE_BYTES = 8 * 1024 * 1024


def preview_envelope_hbjson_import(
    version_id: UUID,
    access: ProjectAccess,
    file_bytes: bytes,
) -> ImportConstructionsPreviewResponse:
    """Dry-run an HBJSON construction import against the current draft.

    Parse + match + plan with no mutation (PRD §6 step 1). The returned
    ETags are what the caller echoes back on the apply command so the import
    lands on the same baseline it previewed.
    """
    require_editor_user(access)
    if len(file_bytes) > MAX_IMPORT_FILE_BYTES:
        raise api_error(
            status.HTTP_413_CONTENT_TOO_LARGE,
            "import_file_too_large",
            "The construction library file is too large.",
            {"max_bytes": MAX_IMPORT_FILE_BYTES},
        )
    view = get_current_document_view(version_id, access)
    body = view.body

    library = parse_or_422(_load_json(file_bytes), current_schema_version=body.schema_version)
    with transaction() as conn:
        plan = build_import_plan(conn, body, library, resolutions=[])

    return ImportConstructionsPreviewResponse(
        project_id=access.project_id,
        version_id=version_id,
        source=view.source,
        version_etag=view.version_etag,
        draft_etag=view.draft_etag,
        schema_version=plan.schema_version,
        constructions=plan.constructions,
        materials=plan.materials,
        counts=plan.counts,
        warnings=plan.warnings,
    )


def _load_json(file_bytes: bytes) -> object:
    try:
        return json.loads(file_bytes)
    except (json.JSONDecodeError, UnicodeDecodeError) as error:
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "import_invalid_json",
            "The uploaded file is not valid JSON.",
        ) from error

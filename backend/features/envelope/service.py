"""Envelope read and semantic command workflows."""

from __future__ import annotations

from typing import Any, Literal
from uuid import UUID

from psycopg import Connection
from starlette import status

from database import transaction
from features.envelope import drift, ops
from features.envelope.commands.registry import apply_command as dispatch_envelope_command
from features.envelope.models import (
    AssemblyThermalResponse,
    EnvelopeCommand,
    EnvelopeReadResponse,
    ProjectMaterialDriftReport,
)
from features.envelope.selectors import build_envelope_read_parts
from features.envelope.thermal import calculate_assembly_thermal
from features.project_document import repository
from features.project_document.audit import log_document_action
from features.project_document.document import ProjectDocumentV1
from features.project_document.models import ProjectDocumentSource
from features.project_document.service import (
    document_etag,
    get_current_document_view,
    get_saved_document,
    next_draft_etag,
    validate_document,
)
from features.projects.access import ProjectAccess, require_editor_user
from features.shared.errors import api_error


def get_envelope_read_model(
    version_id: UUID,
    access: ProjectAccess,
    source: ProjectDocumentSource,
) -> EnvelopeReadResponse:
    """Load the envelope slice from the saved version or user's draft."""
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
    """Load and calculate one assembly thermal overlay from draft or saved body."""
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
    """Compare project-owned material copies against their current catalog rows."""
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


def apply_envelope_command(
    version_id: UUID,
    access: ProjectAccess,
    command: EnvelopeCommand,
    if_match: str | None,
    if_match_version: str | None,
    updated_via: Literal["browser", "mcp"] = "browser",
) -> EnvelopeReadResponse:
    """Apply one semantic Assembly Builder command to the editor draft."""
    user = require_editor_user(access)

    with transaction() as conn:
        base_body, base_version_etag, version_etag, draft = _load_command_context(
            conn,
            access.project_id,
            version_id,
            user.id,
            if_match,
            if_match_version,
        )
        next_body = dispatch_envelope_command(conn, base_body, command)

        if next_body == base_body:
            source: ProjectDocumentSource = "draft" if draft is not None else "version"
            assemblies, project_materials = build_envelope_read_parts(base_body)
            return EnvelopeReadResponse(
                project_id=access.project_id,
                version_id=version_id,
                source=source,
                version_etag=version_etag,
                draft_etag=draft["draft_etag"] if draft is not None else None,
                assemblies=assemblies,
                project_materials=project_materials,
            )

        draft_etag = repository.upsert_draft(
            conn,
            version_id,
            user.id,
            next_body,
            base_version_etag,
            next_draft_etag(next_body),
            updated_via=updated_via,
        )
        log_document_action(
            conn,
            "envelope_command",
            access,
            version_id,
            user.id,
            None,
            extra_details={"command_kind": command.kind},
        )

    assemblies, project_materials = build_envelope_read_parts(next_body)
    return EnvelopeReadResponse(
        project_id=access.project_id,
        version_id=version_id,
        source="draft",
        version_etag=version_etag,
        draft_etag=draft_etag,
        assemblies=assemblies,
        project_materials=project_materials,
    )


def _load_command_context(
    conn: Connection[Any],
    project_id: UUID,
    version_id: UUID,
    user_id: UUID,
    if_match: str | None,
    if_match_version: str | None,
) -> tuple[ProjectDocumentV1, str, str, dict[str, Any] | None]:
    version = repository.get_project_version_for_update(conn, project_id, version_id)
    if version is None:
        raise api_error(status.HTTP_404_NOT_FOUND, "project_version_not_found", "Project version not found.")
    if version["locked"]:
        raise api_error(status.HTTP_409_CONFLICT, "version_locked", "Locked versions cannot be edited.")

    version_body = validate_document(version["body"])
    version_etag = document_etag(version_body)
    draft = repository.get_draft_for_update(conn, version_id, user_id)

    if draft is None:
        if if_match_version != version_etag:
            raise api_error(
                status.HTTP_409_CONFLICT,
                "version_etag_mismatch",
                "The saved version changed before this envelope command was applied.",
                {"expected": version_etag},
            )
        return version_body, version_etag, version_etag, None

    if if_match != draft["draft_etag"]:
        raise api_error(
            status.HTTP_409_CONFLICT,
            "draft_etag_mismatch",
            "The draft changed before this envelope command was applied.",
            {"expected": draft["draft_etag"]},
        )
    return validate_document(draft["body"]), str(draft["base_version_etag"]), version_etag, draft

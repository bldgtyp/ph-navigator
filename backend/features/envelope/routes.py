"""Assembly Builder read and command routes."""

from __future__ import annotations

import json
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, File, Header, Query, UploadFile

from features.access.capabilities import ENVELOPE_EXPORT_HBJSON, ENVELOPE_EXPORT_PHPP
from features.envelope.hbjson_export import export_hbjson_constructions
from features.envelope.import_models import ImportConstructionsPreviewResponse
from features.envelope.models import (
    AssemblyThermalResponse,
    EnvelopeCommandRequest,
    EnvelopeReadResponse,
    PhppPreflightResponse,
    ProjectMaterialDriftReport,
)
from features.envelope.phpp_export import build_phpp_zip
from features.envelope.phpp_types import UnitSystem
from features.envelope.service import (
    MAX_IMPORT_FILE_BYTES,
    apply_envelope_command,
    get_assembly_thermal_model,
    get_envelope_read_model,
    get_phpp_export_preflight,
    get_project_material_drift_report,
    preview_envelope_hbjson_import,
)
from features.project_document.models import ProjectDocumentSource
from features.project_document.service import get_saved_document
from features.projects.access import (
    ProjectAccess,
    require_capability,
    require_project_edit_access,
    require_project_view_access,
)
from features.shared.responses import json_download_response, zip_download_response

router = APIRouter(
    prefix="/api/v1/projects/{project_id}/versions/{version_id}",
    tags=["envelope"],
)

ProjectViewAccess = Annotated[ProjectAccess, Depends(require_project_view_access)]
ProjectEditAccess = Annotated[ProjectAccess, Depends(require_project_edit_access)]


@router.get("/envelope", response_model=EnvelopeReadResponse)
def get_envelope(
    version_id: UUID,
    access: ProjectViewAccess,
    source: Annotated[ProjectDocumentSource, Query()] = "draft",
) -> EnvelopeReadResponse:
    return get_envelope_read_model(version_id, access, source)


@router.get("/envelope/assemblies/{assembly_id}/thermal", response_model=AssemblyThermalResponse)
def get_assembly_thermal(
    version_id: UUID,
    assembly_id: str,
    access: ProjectViewAccess,
    source: Annotated[ProjectDocumentSource, Query()] = "draft",
) -> AssemblyThermalResponse:
    return get_assembly_thermal_model(version_id, access, assembly_id, source)


@router.get("/envelope/material-catalog-drift", response_model=ProjectMaterialDriftReport)
def get_material_catalog_drift(
    version_id: UUID,
    access: ProjectViewAccess,
    source: Annotated[ProjectDocumentSource, Query()] = "draft",
) -> ProjectMaterialDriftReport:
    return get_project_material_drift_report(version_id, access, source)


@router.get("/envelope/export/hbjson")
def export_envelope_hbjson(
    version_id: UUID,
    access: ProjectViewAccess,
):
    require_capability(access, ENVELOPE_EXPORT_HBJSON)
    body = get_saved_document(version_id, access)
    payload = export_hbjson_constructions(body)
    return json_download_response(
        json.dumps(payload, indent=2),
        f"envelope-constructions-{version_id}.hbjson",
    )


@router.get("/envelope/export/phpp/preflight", response_model=PhppPreflightResponse)
def preflight_envelope_phpp(
    version_id: UUID,
    access: ProjectViewAccess,
) -> PhppPreflightResponse:
    require_capability(access, ENVELOPE_EXPORT_PHPP)
    return get_phpp_export_preflight(version_id, access)


@router.get("/envelope/export/phpp")
def export_envelope_phpp(
    version_id: UUID,
    access: ProjectViewAccess,
    units: Annotated[UnitSystem, Query()] = "SI",
):
    require_capability(access, ENVELOPE_EXPORT_PHPP)
    body = get_saved_document(version_id, access)
    data = build_phpp_zip(body, units=units)
    return zip_download_response(data, f"phpp-u-values-{units}-{version_id}.zip")


@router.post("/envelope/import/hbjson/preview", response_model=ImportConstructionsPreviewResponse)
def preview_envelope_import_hbjson(
    version_id: UUID,
    access: ProjectEditAccess,
    file: Annotated[UploadFile, File()],
) -> ImportConstructionsPreviewResponse:
    # Read one byte past the cap so the service can reject oversize uploads
    # without pulling an unbounded file into memory.
    return preview_envelope_hbjson_import(version_id, access, file.file.read(MAX_IMPORT_FILE_BYTES + 1))


@router.post("/draft/envelope/commands", response_model=EnvelopeReadResponse)
def post_envelope_command(
    version_id: UUID,
    payload: EnvelopeCommandRequest,
    access: ProjectEditAccess,
    if_match: Annotated[str | None, Header()] = None,
    if_match_version: Annotated[str | None, Header()] = None,
) -> EnvelopeReadResponse:
    return apply_envelope_command(
        version_id,
        access,
        payload.command,
        if_match=if_match,
        if_match_version=if_match_version,
    )

"""Assembly Builder read and command routes."""

from __future__ import annotations

import json
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, File, Header, Query, UploadFile
from starlette import status

from features.access.capabilities import (
    ENVELOPE_EXPORT_ASSEMBLY_PDF,
    ENVELOPE_EXPORT_HBJSON,
    ENVELOPE_EXPORT_PHPP,
)
from features.envelope.assembly_pdf import render_assembly_report_pdf
from features.envelope.assembly_report import build_assembly_report
from features.envelope.condensation import AssemblyCondensationResponse
from features.envelope.hbjson_export import export_hbjson_constructions
from features.envelope.import_models import ImportConstructionsPreviewResponse
from features.envelope.models import (
    AssemblyThermalResponse,
    EnvelopeCommandRequest,
    EnvelopeReadResponse,
    PhppPreflightResponse,
    ProjectMaterialDriftReport,
    ThermalStandardsResponse,
)
from features.envelope.phpp_export import build_phpp_zip
from features.envelope.phpp_types import UnitSystem
from features.envelope.service import (
    MAX_IMPORT_FILE_BYTES,
    apply_envelope_command,
    get_assembly_condensation_model,
    get_assembly_thermal_model,
    get_envelope_read_model,
    get_phpp_export_preflight,
    get_project_material_drift_report,
    get_thermal_standards_model,
    preview_envelope_hbjson_import,
)
from features.project_document.models import ProjectDocumentSource
from features.project_document.service import get_saved_document, get_saved_document_with_version
from features.projects.access import (
    ProjectAccess,
    require_capability,
    require_project_edit_access,
    require_project_view_access,
)
from features.shared.errors import api_error
from features.shared.responses import (
    download_filename_part,
    json_download_response,
    pdf_download_response,
    zip_download_response,
)

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


@router.get("/envelope/assemblies/{assembly_id}/condensation", response_model=AssemblyCondensationResponse)
def get_assembly_condensation(
    version_id: UUID,
    assembly_id: str,
    access: ProjectViewAccess,
    source: Annotated[ProjectDocumentSource, Query()] = "draft",
) -> AssemblyCondensationResponse:
    return get_assembly_condensation_model(version_id, access, assembly_id, source)


@router.get("/envelope/thermal-standards", response_model=ThermalStandardsResponse)
def get_thermal_standards(
    version_id: UUID,
    access: ProjectViewAccess,
    source: Annotated[ProjectDocumentSource, Query()] = "draft",
) -> ThermalStandardsResponse:
    return get_thermal_standards_model(version_id, access, source)


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


@router.get("/envelope/export/assemblies.pdf")
def export_assemblies_pdf(
    version_id: UUID,
    access: ProjectViewAccess,
    units: Annotated[UnitSystem, Query()] = "SI",
):
    require_capability(access, ENVELOPE_EXPORT_ASSEMBLY_PDF)
    body, version = get_saved_document_with_version(version_id, access)
    if not body.tables.assemblies:
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "no_assemblies",
            "The saved Version has no Assemblies to export.",
        )
    report = build_assembly_report(
        body.tables.assemblies,
        body.tables.project_materials,
        project_bt_number=access.project.bt_number,
        project_name=access.project.display_name,
        version_name=version.name,
        units=units,
    )
    return pdf_download_response(
        render_assembly_report_pdf(report),
        _assembly_pdf_filename(access.project.bt_number, units, version.name),
    )


def _assembly_pdf_filename(bt_number: str, units: UnitSystem, version_name: str) -> str:
    bt_slug = download_filename_part(bt_number, "project")
    version_slug = download_filename_part(version_name, "version")
    return f"{bt_slug}-assemblies-{units}-{version_slug}.pdf"


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

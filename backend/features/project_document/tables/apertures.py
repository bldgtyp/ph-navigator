"""Apertures table contract for the project document registry."""

from __future__ import annotations

from typing import cast
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from features.project_document.document import (
    ApertureInstallTypeRow,
    ApertureTypeEntry,
    ManufacturerFilters,
    ProjectDocumentV1,
    ProjectFrame,
    ProjectGlazing,
)
from features.project_document.models import ProjectDocumentSource
from features.project_document.tables.aperture_install_types import install_type_name, install_type_psi_w_mk
from features.project_document.tables.contracts import TableContract
from features.project_document.validation import validate_outgoing_document

APERTURES_TABLE_NAME = "apertures"


class AperturesSliceReplaceRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    apertures: list[ApertureTypeEntry]


class ApertureInstallTypeSummary(BaseModel):
    """Install-type library row projected for the builder UI.

    Everything the element cards / Installs modal need in the slice fetch
    (aperture-psi-install phases 04–05) without a second request; the full
    editable table lives on the `aperture_install_types` DataTable slice.
    """

    model_config = ConfigDict(extra="forbid")

    id: str
    name: str | None
    psi_w_mk: float | None
    source: str | None
    has_pdf: bool


def install_type_summary(row: ApertureInstallTypeRow) -> ApertureInstallTypeSummary:
    source = row.custom_values.get("source")
    return ApertureInstallTypeSummary(
        id=row.id,
        name=install_type_name(row),
        psi_w_mk=install_type_psi_w_mk(row),
        source=source if isinstance(source, str) else None,
        has_pdf=bool(row.pdf_report_asset_ids),
    )


class AperturesSliceResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    project_id: UUID
    version_id: UUID
    source: ProjectDocumentSource
    version_etag: str
    draft_etag: str | None
    apertures: list[ApertureTypeEntry]
    project_glazings: list[ProjectGlazing]
    project_frames: list[ProjectFrame]
    # aperture-psi-install: the install-type library summarized for
    # effective-Ψ display + assignment pickers.
    aperture_install_types: list[ApertureInstallTypeSummary] = Field(default_factory=list)
    # Phase 11: enabled-list for the manufacturer-filter modal +
    # picker filtering. ``null`` means "all manufacturers enabled".
    manufacturer_filters: ManufacturerFilters | None = None


def apply_apertures_replace(body: ProjectDocumentV1, payload: BaseModel) -> ProjectDocumentV1:
    request = cast(AperturesSliceReplaceRequest, payload)
    if body.tables.apertures == request.apertures:
        return body
    next_tables = body.tables.model_copy(update={"apertures": request.apertures})
    next_body = body.model_copy(update={"tables": next_tables})
    return validate_outgoing_document(next_body.model_dump(mode="json"))


def apertures_response(
    project_id: UUID,
    version_id: UUID,
    source: ProjectDocumentSource,
    version_etag: str,
    draft_etag: str | None,
    body: ProjectDocumentV1,
) -> AperturesSliceResponse:
    return AperturesSliceResponse(
        project_id=project_id,
        version_id=version_id,
        source=source,
        version_etag=version_etag,
        draft_etag=draft_etag,
        apertures=body.tables.apertures,
        project_glazings=body.tables.project_glazings,
        project_frames=body.tables.project_frames,
        aperture_install_types=[install_type_summary(row) for row in body.tables.aperture_install_types.rows],
        manufacturer_filters=body.tables.manufacturer_filters,
    )


def extract_aperture_rows(body: ProjectDocumentV1) -> list[object]:
    return [entry.model_dump(mode="json") for entry in body.tables.apertures]


apertures_contract = TableContract(
    name=APERTURES_TABLE_NAME,
    schema_slug="aperture-type",
    schema_model=ApertureTypeEntry,
    replace_request_model=AperturesSliceReplaceRequest,
    build_response=apertures_response,
    apply_replace=apply_apertures_replace,
    extract_rows=extract_aperture_rows,
    extract_diff_value=extract_aperture_rows,
    table_path=(APERTURES_TABLE_NAME,),
    field_registry=None,
)

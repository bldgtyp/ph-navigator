"""Apertures table contract for the project document registry.

Mirrors `tables/window_types.py` — Phase 01 ships both contracts
side-by-side. The Aperture Builder (Phase 02+) reads / writes the new
`tables.apertures[]` slice exclusively; the legacy Windows tracer-bullet
keeps using `tables.window_types[]` until Phase 02 cuts the route over.
"""

from __future__ import annotations

from typing import cast
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from features.project_document.document import (
    ApertureTypeEntry,
    ManufacturerFilters,
    ProjectDocumentV1,
)
from features.project_document.models import ProjectDocumentSource
from features.project_document.tables.contracts import TableContract
from features.project_document.validation import validate_document

APERTURES_TABLE_NAME = "apertures"


class AperturesSliceReplaceRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    apertures: list[ApertureTypeEntry]


class AperturesSliceResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    project_id: UUID
    version_id: UUID
    source: ProjectDocumentSource
    version_etag: str
    draft_etag: str | None
    apertures: list[ApertureTypeEntry]
    # Phase 11: enabled-list for the manufacturer-filter modal +
    # picker filtering. ``null`` means "all manufacturers enabled".
    manufacturer_filters: ManufacturerFilters | None = None


def apply_apertures_replace(body: ProjectDocumentV1, payload: BaseModel) -> ProjectDocumentV1:
    request = cast(AperturesSliceReplaceRequest, payload)
    if body.tables.apertures == request.apertures:
        return body
    next_tables = body.tables.model_copy(update={"apertures": request.apertures})
    next_body = body.model_copy(update={"tables": next_tables})
    return validate_document(next_body.model_dump(mode="json"))


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

"""Project-document draft API routes."""

from __future__ import annotations

import json
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Query, Request, Response

from features.access.capabilities import DOCUMENT_EXPORT
from features.project_document.aperture_commands.models import ApertureCommand
from features.project_document.aperture_commands.service import (
    apply_aperture_command_to_draft,
)
from features.project_document.document import ProjectDocumentV1
from features.project_document.models import (
    DiscardDraftResponse,
    ProjectDiffResponse,
    ProjectDocumentReadSafeEnvelope,
    ProjectDraftSummary,
    SaveAsDraftRequest,
    SaveDraftResponse,
    VersionPatchRequest,
)
from features.project_document.schema_mutations import FieldSchemaMutation
from features.project_document.service import (
    apply_schema_mutation_to_draft,
    discard_draft,
    get_draft_summary_or_read_safe,
    get_draft_table_slice,
    get_project_diff,
    get_raw_saved_document,
    get_saved_document_or_read_safe,
    get_saved_table_slice,
    patch_version,
    preview_table_replace,
    replace_table_slice,
    save_draft,
    save_draft_as,
    table_download_body,
)
from features.project_document.tables import RegisteredTableResponse
from features.project_document.tables.apertures import AperturesSliceResponse
from features.project_document.tables.contracts import TableReplacePreviewResponse
from features.projects.access import (
    ProjectAccess,
    require_capability,
    require_project_edit_access,
    require_project_view_access,
)
from features.projects.models import ProjectDetail
from features.shared.responses import json_download_response

router = APIRouter(
    prefix="/api/v1/projects/{project_id}/versions/{version_id}",
    tags=["project-document"],
)

ProjectViewAccess = Annotated[ProjectAccess, Depends(require_project_view_access)]
ProjectEditAccess = Annotated[ProjectAccess, Depends(require_project_edit_access)]


@router.get("/document", response_model=ProjectDocumentV1 | ProjectDocumentReadSafeEnvelope)
def get_document(
    version_id: UUID,
    access: ProjectViewAccess,
    request: Request,
) -> ProjectDocumentV1 | ProjectDocumentReadSafeEnvelope:
    return get_saved_document_or_read_safe(version_id, access, request_id=request_id(request))


@router.get("/document/tables/{table_name}", response_model=RegisteredTableResponse)
def get_saved_table(
    version_id: UUID,
    table_name: str,
    access: ProjectViewAccess,
) -> Any:
    return get_saved_table_slice(version_id, table_name, access)


@router.get("/draft/tables/{table_name}", response_model=RegisteredTableResponse)
def get_draft_table(
    version_id: UUID,
    table_name: str,
    access: ProjectEditAccess,
) -> Any:
    return get_draft_table_slice(version_id, table_name, access)


@router.get("/draft", response_model=ProjectDraftSummary | ProjectDocumentReadSafeEnvelope)
def get_draft_status(
    version_id: UUID,
    access: ProjectEditAccess,
    request: Request,
) -> ProjectDraftSummary | ProjectDocumentReadSafeEnvelope:
    return get_draft_summary_or_read_safe(version_id, access, request_id=request_id(request))


@router.put("/draft/tables/{table_name}", response_model=RegisteredTableResponse)
def put_draft_table(
    version_id: UUID,
    table_name: str,
    payload: dict[str, Any],
    access: ProjectEditAccess,
    if_match: Annotated[str | None, Header()] = None,
    if_match_version: Annotated[str | None, Header()] = None,
) -> Any:
    return replace_table_slice(
        version_id,
        table_name,
        payload,
        access,
        if_match=if_match,
        if_match_version=if_match_version,
    )


# Dry-run sibling of the PUT replace: report the dependent-link cascade a
# proposed replace would trigger (e.g. deleting a heat-pump row that other rows
# link to) without persisting. Generic — driven by the contract's
# `dependent_links`; tables with none always return an empty `affected` list.
@router.post("/draft/tables/{table_name}:preview-replace", response_model=TableReplacePreviewResponse)
def preview_draft_table_replace(
    version_id: UUID,
    table_name: str,
    payload: dict[str, Any],
    access: ProjectEditAccess,
    if_match: Annotated[str | None, Header()] = None,
    if_match_version: Annotated[str | None, Header()] = None,
) -> TableReplacePreviewResponse:
    return preview_table_replace(
        version_id,
        table_name,
        payload,
        access,
        if_match=if_match,
        if_match_version=if_match_version,
    )


# Plan-15 P2.2 — typed schema-mutation endpoint. The `:mutate` URL
# suffix keeps this distinct from the existing whole-table replace
# PUT so the two write surfaces stay legible in the OpenAPI spec.
# FastAPI handles the discriminated `FieldSchemaMutation` body via
# Pydantic v2's discriminator support.
@router.post(
    "/draft/tables/{table_name}/custom-fields:mutate",
    response_model=RegisteredTableResponse,
)
def post_schema_mutation(
    version_id: UUID,
    table_name: str,
    payload: FieldSchemaMutation,
    access: ProjectEditAccess,
    request: Request,
    if_match: Annotated[str | None, Header()] = None,
    if_match_version: Annotated[str | None, Header()] = None,
) -> Any:
    # REST surfaces only the updated table envelope; the audit
    # payload is consumed inside `apply_schema_mutation_to_draft`.
    response, _ = apply_schema_mutation_to_draft(
        version_id,
        table_name,
        payload,
        access,
        if_match=if_match,
        if_match_version=if_match_version,
        request=request,
    )
    return response


@router.post("/apertures/command", response_model=AperturesSliceResponse)
def post_aperture_command(
    version_id: UUID,
    payload: ApertureCommand,
    access: ProjectEditAccess,
    request: Request,
    if_match: Annotated[str | None, Header()] = None,
    if_match_version: Annotated[str | None, Header()] = None,
) -> AperturesSliceResponse:
    response, _ = apply_aperture_command_to_draft(
        version_id,
        payload,
        access,
        if_match=if_match,
        if_match_version=if_match_version,
        request=request,
    )
    return response


@router.delete("/draft", response_model=DiscardDraftResponse)
def delete_draft(
    version_id: UUID,
    access: ProjectEditAccess,
) -> DiscardDraftResponse:
    return discard_draft(version_id, access)


@router.post("/draft/save", response_model=SaveDraftResponse)
def post_draft_save(
    version_id: UUID,
    access: ProjectEditAccess,
    request: Request,
    if_match: Annotated[str | None, Header()] = None,
) -> SaveDraftResponse:
    return save_draft(version_id, access, if_match=if_match, request=request)


@router.post("/draft/save-as", response_model=SaveDraftResponse)
def post_draft_save_as(
    version_id: UUID,
    payload: SaveAsDraftRequest,
    access: ProjectEditAccess,
    request: Request,
) -> SaveDraftResponse:
    return save_draft_as(version_id, payload, access, request=request)


@router.patch("", response_model=ProjectDetail)
def patch_project_version(
    version_id: UUID,
    payload: VersionPatchRequest,
    access: ProjectEditAccess,
    request: Request,
) -> ProjectDetail:
    return patch_version(version_id, payload, access, request=request)


@router.get("/download")
def download_document(
    version_id: UUID,
    access: ProjectViewAccess,
) -> Response:
    require_capability(access, DOCUMENT_EXPORT)
    document = get_raw_saved_document(version_id, access)
    return json_download_response(json.dumps(document, separators=(",", ":")), f"project-{version_id}.json")


@router.get("/download/tables/{table_name}")
def download_table(
    version_id: UUID,
    table_name: str,
    access: ProjectViewAccess,
) -> Response:
    require_capability(access, DOCUMENT_EXPORT)
    content = table_download_body(version_id, table_name, access)
    return json_download_response(json.dumps(content, indent=2), f"{table_name}-{version_id}.json")


def request_id(request: Request) -> str:
    return str(getattr(request.state, "request_id", ""))


diff_router = APIRouter(prefix="/api/v1/projects/{project_id}", tags=["project-document"])


@diff_router.get("/diff", response_model=ProjectDiffResponse)
def get_diff(
    access: ProjectViewAccess,
    from_version_id: Annotated[UUID, Query(alias="from")],
    to: str,
) -> ProjectDiffResponse:
    return get_project_diff(from_version_id, to, access)

"""Window Types table contract for the project document registry."""

from __future__ import annotations

from typing import cast
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from features.project_document.document import (
    ProjectDocumentV1,
    WindowTypeEntry,
)
from features.project_document.models import ProjectDocumentSource
from features.project_document.tables.contracts import TableContract
from features.project_document.validation import validate_document

WINDOW_TYPES_TABLE_NAME = "window_types"


class WindowTypesSliceReplaceRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    window_types: list[WindowTypeEntry]


class WindowTypesSliceResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    project_id: UUID
    version_id: UUID
    source: ProjectDocumentSource
    version_etag: str
    draft_etag: str | None
    window_types: list[WindowTypeEntry]


def apply_window_types_replace(body: ProjectDocumentV1, payload: BaseModel) -> ProjectDocumentV1:
    request = cast(WindowTypesSliceReplaceRequest, payload)
    if body.tables.window_types == request.window_types:
        return body
    next_tables = body.tables.model_copy(update={"window_types": request.window_types})
    next_body = body.model_copy(update={"tables": next_tables})
    return validate_document(next_body.model_dump(mode="json"))


def window_types_response(
    project_id: UUID,
    version_id: UUID,
    source: ProjectDocumentSource,
    version_etag: str,
    draft_etag: str | None,
    body: ProjectDocumentV1,
) -> WindowTypesSliceResponse:
    return WindowTypesSliceResponse(
        project_id=project_id,
        version_id=version_id,
        source=source,
        version_etag=version_etag,
        draft_etag=draft_etag,
        window_types=body.tables.window_types,
    )


def extract_window_type_rows(body: ProjectDocumentV1) -> list[object]:
    return [entry.model_dump(mode="json") for entry in body.tables.window_types]


window_types_contract = TableContract(
    name=WINDOW_TYPES_TABLE_NAME,
    schema_slug="window-type",
    schema_model=WindowTypeEntry,
    replace_request_model=WindowTypesSliceReplaceRequest,
    build_response=window_types_response,
    apply_replace=apply_window_types_replace,
    extract_rows=extract_window_type_rows,
    extract_diff_value=extract_window_type_rows,
    table_path=(WINDOW_TYPES_TABLE_NAME,),
    custom_fields=None,
)

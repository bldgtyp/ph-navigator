"""Shared contract type for project-document table handlers."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from uuid import UUID

from pydantic import BaseModel, ValidationError
from starlette import status

from features.project_document.document import ProjectDocumentV1
from features.project_document.models import ProjectDocumentSource
from features.shared.errors import api_error


@dataclass(frozen=True)
class TableContract:
    """Per-table behavior used by generic document/draft/table routes."""

    name: str
    schema_slug: str
    schema_model: type[BaseModel]
    replace_request_model: type[BaseModel]
    build_response: Callable[[UUID, UUID, ProjectDocumentSource, str, str | None, ProjectDocumentV1], BaseModel]
    apply_replace: Callable[[ProjectDocumentV1, BaseModel], ProjectDocumentV1]
    extract_rows: Callable[[ProjectDocumentV1], list[object]]
    extract_diff_value: Callable[[ProjectDocumentV1], object]

    def parse_replace_payload(self, raw_payload: object) -> BaseModel:
        try:
            return self.replace_request_model.model_validate(raw_payload)
        except ValidationError as exc:
            raise api_error(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                "validation_error",
                "Table payload failed validation.",
                {"errors": [str(error["msg"]) for error in exc.errors()]},
            ) from exc

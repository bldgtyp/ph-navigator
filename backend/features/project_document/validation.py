"""Shared document validation and ETag helpers."""

from __future__ import annotations

import hashlib
import json
from typing import TypeAlias, cast
from uuid import uuid4

from pydantic import ValidationError

from features.project_document.document import ProjectDocumentV1
from features.shared.errors import api_error

JsonValue: TypeAlias = None | bool | int | float | str | list["JsonValue"] | dict[str, "JsonValue"]


def document_etag(body: ProjectDocumentV1) -> str:
    payload = json.dumps(body.model_dump(mode="json"), sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def next_draft_etag(body: ProjectDocumentV1) -> str:
    payload = f"{document_etag(body)}:{uuid4()}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def body_size_bytes(body: ProjectDocumentV1) -> int:
    return len(body.model_dump_json().encode("utf-8"))


def validate_document(raw_body: object) -> ProjectDocumentV1:
    document, errors = validate_document_with_errors(raw_body)
    if document is not None:
        return document
    raise api_error(
        422,
        "invalid_project_document",
        "Project document failed validation.",
        {"errors": errors},
    )


def validate_document_with_errors(raw_body: object) -> tuple[ProjectDocumentV1 | None, list[str]]:
    try:
        return ProjectDocumentV1.model_validate(raw_body), []
    except ValidationError as exc:
        return None, [str(error["msg"]) for error in exc.errors()]


def raw_json_value(raw_body: object) -> JsonValue:
    return cast(JsonValue, raw_body)

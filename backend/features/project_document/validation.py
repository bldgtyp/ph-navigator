"""Shared document validation and ETag helpers."""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from typing import Any, TypeAlias, cast
from uuid import uuid4

from pydantic import ValidationError
from starlette import status

from config import settings
from features.project_document.document import ProjectDocumentV1
from features.project_document.migrations import (
    ProjectDocumentMigrationError,
    UpgradeResult,
    upgrade_project_document,
)
from features.project_document.write_metrics import measure_outgoing_validation
from features.shared.errors import api_error

JsonValue: TypeAlias = None | bool | int | float | str | list["JsonValue"] | dict[str, "JsonValue"]


@dataclass(frozen=True)
class SerializedProjectDocument:
    json_value: dict[str, Any]
    json_text: str
    json_bytes: bytes
    etag: str
    size_bytes: int


def serialize_document(body: ProjectDocumentV1) -> SerializedProjectDocument:
    json_value = body.model_dump(mode="json")
    json_text = json.dumps(json_value, sort_keys=True, separators=(",", ":"))
    json_bytes = json_text.encode("utf-8")
    return SerializedProjectDocument(
        json_value=json_value,
        json_text=json_text,
        json_bytes=json_bytes,
        etag=hashlib.sha256(json_bytes).hexdigest(),
        size_bytes=len(json_bytes),
    )


def document_etag(body: ProjectDocumentV1, serialized: SerializedProjectDocument | None = None) -> str:
    return (serialized or serialize_document(body)).etag


def next_draft_etag(body: ProjectDocumentV1) -> str:
    payload = f"{document_etag(body)}:{uuid4()}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def next_draft_etag_from_etag(etag: str) -> str:
    payload = f"{etag}:{uuid4()}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def body_size_bytes(body: ProjectDocumentV1, serialized: SerializedProjectDocument | None = None) -> int:
    if serialized is not None:
        return serialized.size_bytes
    return serialize_document(body).size_bytes


def enforce_document_body_size(
    body: ProjectDocumentV1,
    serialized: SerializedProjectDocument | None = None,
) -> SerializedProjectDocument:
    serialized_body = serialized or serialize_document(body)
    limit = settings.project_document_max_body_bytes
    if serialized_body.size_bytes > limit:
        raise api_error(
            status.HTTP_413_CONTENT_TOO_LARGE,
            "project_document_too_large",
            "Project document body exceeds the configured size limit.",
            {"size_bytes": serialized_body.size_bytes, "limit_bytes": limit},
        )
    return serialized_body


def validate_document(raw_body: object) -> ProjectDocumentV1:
    result, errors = upgrade_document_with_errors(raw_body)
    if result is not None:
        return result.document
    raise api_error(
        422,
        "invalid_project_document",
        "Project document failed validation.",
        {"errors": errors},
    )


def validate_outgoing_document(raw_body: object) -> ProjectDocumentV1:
    """Validate a mutation result while attributing its full-document cost."""
    with measure_outgoing_validation():
        return validate_document(raw_body)


def validate_document_with_errors(raw_body: object) -> tuple[ProjectDocumentV1 | None, list[str]]:
    result, errors = upgrade_document_with_errors(raw_body)
    return (result.document if result is not None else None), errors


def upgrade_document_with_errors(raw_body: object) -> tuple[UpgradeResult | None, list[str]]:
    try:
        return upgrade_project_document(raw_body), []
    except ProjectDocumentMigrationError as exc:
        return None, [str(exc)]
    except ValidationError as exc:
        return None, [str(error["msg"]) for error in exc.errors()]


def raw_json_value(raw_body: object) -> JsonValue:
    return cast(JsonValue, raw_body)

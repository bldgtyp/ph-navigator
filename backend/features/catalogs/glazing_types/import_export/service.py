"""Public entry points for the glazing-types catalog import pipeline."""

from __future__ import annotations

from typing import Any

from fastapi import Request
from psycopg import sql
from psycopg.errors import UniqueViolation
from pydantic import BaseModel, ConfigDict
from starlette import status

from database import connection, transaction
from features.auth.models import UserPublic
from features.catalogs._shared import log_catalog_action, new_catalog_record_id
from features.catalogs.glazing_types import repository
from features.catalogs.glazing_types.import_export.pipeline import (
    EnvelopeError,
    PreviewCounts,
    PreviewReport,
    PreviewRowSummary,
    PreviewWarning,
    build_preview,
)
from features.catalogs.glazing_types.import_export.tokens import (
    ConsumeResult,
    TokenConsumeOutcome,
    consume_token,
    mint_token,
)
from features.catalogs.glazing_types.import_export.upgrade import (
    SchemaVersionTooNewError,
)
from features.shared.errors import api_error

CATALOG_TABLE = "glazing_types"


class PreviewCountsResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    new: int
    matched: int
    errored: int
    warnings: int


class PreviewWarningResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reason: str
    count: int
    row_indices: list[int]


class PreviewRowResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    index: int
    classification: str
    id: str | None
    name: str | None
    manufacturer: str | None


class PreviewResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    token: str
    schema_version: int
    counts: PreviewCountsResponse
    warnings: list[PreviewWarningResponse]
    errors: list[PreviewWarningResponse]
    rows_preview: list[PreviewRowResponse]


class CommitRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    token: str


class CommitResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    inserted: int
    inserted_ids: list[str]
    skipped_conflict_ids: list[str] = []


def preview_import(body: dict[str, Any], user: UserPublic) -> PreviewResponse:
    with connection() as conn:
        existing_rows = repository.list_glazing_types(conn, include_inactive=True)
    existing_ids: dict[str, bool] = {str(row["id"]): bool(row["is_active"]) for row in existing_rows}

    try:
        report = build_preview(body, existing_ids)
    except EnvelopeError as exc:
        raise api_error(
            status.HTTP_400_BAD_REQUEST,
            "catalog_import_bad_envelope",
            str(exc),
        ) from exc
    except SchemaVersionTooNewError as exc:
        raise api_error(
            status.HTTP_400_BAD_REQUEST,
            "catalog_import_schema_too_new",
            str(exc),
        ) from exc

    token = mint_token(report.write_set, user_id=str(user.id))
    return PreviewResponse(
        token=token,
        schema_version=report.schema_version,
        counts=_counts_to_response(report.counts),
        warnings=[_warning_to_response(warning) for warning in report.warnings],
        errors=[_warning_to_response(error) for error in report.errors],
        rows_preview=[_row_to_response(row) for row in report.rows_preview],
    )


def commit_import(token: str, user: UserPublic, request: Request) -> CommitResponse:
    result: ConsumeResult = consume_token(token, user_id=str(user.id))
    if result.outcome == TokenConsumeOutcome.MISSING:
        raise api_error(
            status.HTTP_410_GONE,
            "catalog_import_token_missing",
            "Import preview has expired or was already committed; please re-upload.",
        )
    if result.outcome == TokenConsumeOutcome.WRONG_USER:
        raise api_error(
            status.HTTP_403_FORBIDDEN,
            "catalog_import_token_forbidden",
            "Import token does not belong to the current user.",
        )

    assert result.write_set is not None
    rows_to_insert = result.write_set.rows_to_insert
    inserted_ids: list[str] = []
    skipped_conflict_ids: list[str] = []

    with transaction() as conn:
        for index, payload in enumerate(rows_to_insert):
            record_id = _id_for_insert(payload)
            savepoint = sql.Identifier(f"import_row_{index}")
            conn.execute(sql.SQL("SAVEPOINT {}").format(savepoint))
            try:
                repository.insert_glazing_type(
                    conn,
                    record_id=record_id,
                    name=_required_str(payload, "name"),
                    manufacturer=_optional_str(payload, "manufacturer"),
                    brand=_optional_str(payload, "brand"),
                    suffix=_optional_str(payload, "suffix"),
                    u_value_w_m2k=_optional_float(payload, "u_value_w_m2k"),
                    g_value=_optional_float(payload, "g_value"),
                    color=_optional_str(payload, "color"),
                    source=_optional_str(payload, "source"),
                    datasheet_url=_optional_str(payload, "datasheet_url"),
                    comments=_optional_str(payload, "comments"),
                    user_id=user.id,
                )
            except UniqueViolation:
                conn.execute(sql.SQL("ROLLBACK TO SAVEPOINT {}").format(savepoint))
                skipped_conflict_ids.append(record_id)
                continue
            conn.execute(sql.SQL("RELEASE SAVEPOINT {}").format(savepoint))
            log_catalog_action(
                conn,
                "catalog_record_create",
                user,
                request,
                catalog_table=CATALOG_TABLE,
                record_id=record_id,
            )
            inserted_ids.append(record_id)

    return CommitResponse(
        inserted=len(inserted_ids),
        inserted_ids=inserted_ids,
        skipped_conflict_ids=skipped_conflict_ids,
    )


def _id_for_insert(payload: dict[str, object]) -> str:
    candidate = payload.get("id")
    if isinstance(candidate, str) and candidate:
        return candidate
    return new_catalog_record_id()


def _required_str(payload: dict[str, object], key: str) -> str:
    value = payload.get(key)
    if not isinstance(value, str) or not value:
        raise api_error(
            status.HTTP_400_BAD_REQUEST,
            "catalog_import_field_required",
            f"{key} is required and was not coerced to a value; fix the file and re-upload.",
        )
    return value


def _optional_str(payload: dict[str, object], key: str) -> str | None:
    value = payload.get(key)
    if value is None:
        return None
    if isinstance(value, str):
        return value
    return None


def _optional_float(payload: dict[str, object], key: str) -> float | None:
    value = payload.get(key)
    if value is None:
        return None
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return float(value)
    return None


def _counts_to_response(counts: PreviewCounts) -> PreviewCountsResponse:
    return PreviewCountsResponse(
        new=counts.new,
        matched=counts.matched,
        errored=counts.errored,
        warnings=counts.warnings,
    )


def _warning_to_response(warning: PreviewWarning) -> PreviewWarningResponse:
    return PreviewWarningResponse(
        reason=warning.reason,
        count=warning.count,
        row_indices=list(warning.row_indices),
    )


def _row_to_response(row: PreviewRowSummary) -> PreviewRowResponse:
    return PreviewRowResponse(
        index=row.index,
        classification=row.classification,
        id=row.id,
        name=row.name,
        manufacturer=row.manufacturer,
    )


__all__ = [
    "CommitRequest",
    "CommitResponse",
    "PreviewResponse",
    "PreviewReport",
    "commit_import",
    "preview_import",
]

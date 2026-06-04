"""Public entry points for the catalog import pipeline.

These functions are the contract a browser, MCP endpoint, or CLI
caller all use. They wrap the pure pipeline in DB access and audit
logging.
"""

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
from features.catalogs.materials import repository
from features.catalogs.materials.import_export.pipeline import (
    EnvelopeError,
    PreviewCounts,
    PreviewReport,
    PreviewRowSummary,
    PreviewWarning,
    build_preview,
)
from features.catalogs.materials.import_export.tokens import (
    ConsumeResult,
    TokenConsumeOutcome,
    consume_token,
    mint_token,
)
from features.catalogs.materials.import_export.upgrade import (
    SchemaVersionTooNewError,
)
from features.shared.errors import api_error

CATALOG_TABLE = "materials"


# Response models — these are what the routes return.


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
    category: str | None


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
    # ids whose insert hit a unique-PK collision (e.g. another writer
    # landed the same file-supplied id between preview and commit).
    # Those rows are skipped per-row via SAVEPOINT so the rest of the
    # batch still lands; the user sees how many slipped.
    skipped_conflict_ids: list[str] = []


def preview_import(body: dict[str, Any], user: UserPublic) -> PreviewResponse:
    """Build a dry-run report and mint a one-shot token for commit.

    Raises HTTPException with a domain-specific code on bad envelope
    or too-new schema. Per-row issues never raise — they land in the
    report's `errors` / `warnings` lists.
    """
    with connection() as conn:
        existing_rows = repository.list_materials(conn, include_inactive=True)
    # id → is_active. Inactive matches stay classified as `matched`
    # (and skipped), but pipeline surfaces a `matched_inactive_skip`
    # warning so the user knows their re-import didn't land.
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
    """Replay the cached write set in a single DB transaction."""
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

    assert result.write_set is not None  # outcome OK ⇒ write_set populated
    rows_to_insert = result.write_set.rows_to_insert
    inserted_ids: list[str] = []
    skipped_conflict_ids: list[str] = []

    with transaction() as conn:
        for index, payload in enumerate(rows_to_insert):
            record_id = _id_for_insert(payload)
            # Per-row SAVEPOINT so a unique-PK collision (e.g. a
            # concurrent writer landed the same file-supplied id
            # between preview and commit) doesn't roll back the
            # whole batch. Other errors still propagate and the
            # outer transaction rolls back atomically.
            savepoint = sql.Identifier(f"import_row_{index}")
            conn.execute(sql.SQL("SAVEPOINT {}").format(savepoint))
            try:
                repository.insert_material(
                    conn,
                    record_id=record_id,
                    name=_required_str(payload, "name"),
                    category=_required_str(payload, "category"),
                    density_kg_m3=_optional_float(payload, "density_kg_m3"),
                    specific_heat_j_kgk=_optional_float(payload, "specific_heat_j_kgk"),
                    conductivity_w_mk=_optional_float(payload, "conductivity_w_mk"),
                    emissivity=_optional_float(payload, "emissivity"),
                    color=_optional_str(payload, "color"),
                    source=_optional_str(payload, "source"),
                    url=_optional_str(payload, "url"),
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
    """Use the file-supplied id if present and well-formed; else mint."""
    candidate = payload.get("id")
    if isinstance(candidate, str) and candidate:
        return candidate
    return new_catalog_record_id()


def _required_str(payload: dict[str, object], key: str) -> str:
    # Coerce step guarantees `name` is a non-empty string; `category`
    # may be None if the file value was unknown. The catalog DB CHECK
    # rejects a NULL category, so we surface a clean error if that
    # ever reaches commit.
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
        category=row.category,
    )


# Re-export PreviewReport so tests can import the orchestrator output
# alongside the response models without reaching into pipeline.py.
__all__ = [
    "CommitRequest",
    "CommitResponse",
    "PreviewResponse",
    "PreviewReport",
    "commit_import",
    "preview_import",
]

"""Public entry points for the frame-types catalog import pipeline."""

from __future__ import annotations

from typing import Any

from fastapi import Request
from psycopg import sql
from psycopg.errors import UniqueViolation
from pydantic import BaseModel, ConfigDict
from starlette import status

from database import connection, transaction
from features.auth.models import UserPublic
from features.catalogs import _options_repository as options_repository
from features.catalogs._option_seeds import FRAME_TYPE_SINGLE_SELECT_FIELDS
from features.catalogs._shared import log_catalog_action, new_catalog_record_id
from features.catalogs.frame_types import repository
from features.catalogs.frame_types.import_export.pipeline import (
    EnvelopeError,
    PreviewCounts,
    PreviewReport,
    PreviewRowSummary,
    PreviewWarning,
    build_preview,
)
from features.catalogs.frame_types.import_export.tokens import (
    ConsumeResult,
    TokenConsumeOutcome,
    consume_token,
    mint_token,
)
from features.catalogs.frame_types.import_export.upgrade import (
    SchemaVersionTooNewError,
)
from features.shared.errors import api_error

# ASYMMETRY (D-4): the import path *auto-adds* unknown single-select values to
# the option store (see `_auto_add_new_options`), whereas create/patch/duplicate
# *reject* them (`service._validate_single_selects`). Intentional — import is a
# frictionless batch/cleanup operation; interactive UI writes stay strict.
CATALOG_TABLE = "frame_types"


class PreviewCountsResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    new: int
    matched: int
    errored: int
    warnings: int
    dropped: int = 0


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
        existing_rows = repository.list_frame_types(conn, include_inactive=True)
        known_options = _read_known_options(conn)
    existing_ids: dict[str, bool] = {str(row["id"]): bool(row["is_active"]) for row in existing_rows}

    try:
        report = build_preview(body, existing_ids, known_options)
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
        # Auto-add (D-4): grow the option store with the new single-select labels
        # this import introduced, in the same transaction as the inserts (so they
        # roll back together if the whole commit aborts). A row skipped on an
        # id-conflict may leave its option unused — harmless; options don't
        # require a backing row.
        _auto_add_new_options(conn, result.write_set.new_options)
        for index, payload in enumerate(rows_to_insert):
            record_id = _id_for_insert(payload)
            savepoint = sql.Identifier(f"import_row_{index}")
            conn.execute(sql.SQL("SAVEPOINT {}").format(savepoint))
            try:
                repository.insert_frame_type(
                    conn,
                    record_id=record_id,
                    # `name` is the computed value from coerce (may be "" for an
                    # all-null row, same as the create path).
                    name=_optional_str(payload, "name") or "",
                    manufacturer=_optional_str(payload, "manufacturer"),
                    brand=_optional_str(payload, "brand"),
                    use=_optional_str(payload, "use"),
                    operation=_optional_str(payload, "operation"),
                    location=_optional_str(payload, "location"),
                    mull_type=_optional_str(payload, "mull_type"),
                    prefix=_optional_str(payload, "prefix"),
                    suffix=_optional_str(payload, "suffix"),
                    material=_optional_str(payload, "material"),
                    width_mm=_optional_float(payload, "width_mm"),
                    u_value_w_m2k=_optional_float(payload, "u_value_w_m2k"),
                    psi_g_w_mk=_optional_float(payload, "psi_g_w_mk"),
                    psi_install_w_mk=_optional_float(payload, "psi_install_w_mk"),
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


def _read_known_options(conn: Any) -> dict[str, set[str]]:
    """Snapshot the current option labels per single-select field — fed to the
    preview so it can flag (and the commit can auto-add) unknown values."""
    known: dict[str, set[str]] = {field: set() for field in FRAME_TYPE_SINGLE_SELECT_FIELDS}
    for row in options_repository.list_all_for_table(conn, catalog_table=CATALOG_TABLE):
        bucket = known.get(str(row["field_key"]))
        if bucket is not None:
            bucket.add(str(row["label"]))
    return known


def _auto_add_new_options(conn: Any, new_options: dict[str, list[str]]) -> None:
    """Grow each single-select field's option store with the labels this import
    introduced (D-4 auto-add). Delegates the case-insensitive append to the
    shared repository helper; non-single-select keys are ignored."""
    for field_key, labels in new_options.items():
        if field_key not in FRAME_TYPE_SINGLE_SELECT_FIELDS:
            continue
        options_repository.append_options(conn, catalog_table=CATALOG_TABLE, field_key=field_key, new_labels=labels)


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
        dropped=counts.dropped,
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

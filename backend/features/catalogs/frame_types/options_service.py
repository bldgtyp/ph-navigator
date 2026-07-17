"""Single-select option-store service for the Window-Frame catalog.

Wraps the shared ``_options_repository`` with the frame-types policy: only the
six promoted fields are editable, edits validate against the
``project_document`` option-list rules, and deleting an in-use option requires a
replacement label so its rows can fold into a survivor (the merge / ``OP-TO-FIX``
cleanup path, D-4).

``seed_frame_type_options`` is the reusable canonical-reset used by tests; the
same data ships in migration ``20260623_0038`` for fresh databases.
"""

from __future__ import annotations

from typing import Any

from fastapi import Request
from psycopg import Connection
from starlette import status

from database import connection, transaction
from features.auth.models import UserPublic
from features.catalogs import _options_repository as options_repository
from features.catalogs import option_jobs_service
from features.catalogs._option_seeds import FRAME_TYPE_OPTION_SEEDS, FRAME_TYPE_SINGLE_SELECT_FIELDS
from features.catalogs._shared import (
    CatalogFieldOptionsResponse,
    EditCatalogOptionsRequest,
    log_catalog_action,
)
from features.catalogs.frame_types import repository as frame_repository
from features.catalogs.frame_types.models import CatalogFrameTypeOptionsResponse
from features.project_document.options import validate_option_list
from features.project_document.rows import SingleSelectOption
from features.shared.errors import api_error

CATALOG_TABLE = "frame_types"


def _to_option(row: dict[str, Any]) -> SingleSelectOption:
    return SingleSelectOption(
        id=row["option_id"],
        label=row["label"],
        color=row["color"],
        order=row["order"],
    )


def list_frame_type_options() -> CatalogFrameTypeOptionsResponse:
    """Return all six fields' option lists (one fetch for the grid). Fields with
    no stored options still appear, with an empty list."""

    with connection() as conn:
        rows = options_repository.list_all_for_table(conn, catalog_table=CATALOG_TABLE)
    fields: dict[str, list[SingleSelectOption]] = {field: [] for field in FRAME_TYPE_SINGLE_SELECT_FIELDS}
    for row in rows:
        fields.setdefault(row["field_key"], []).append(_to_option(row))
    return CatalogFrameTypeOptionsResponse(fields=fields)


def edit_frame_type_options(
    payload: EditCatalogOptionsRequest, user: UserPublic, request: Request
) -> CatalogFieldOptionsResponse:
    """Full-replace one field's option list, cascading renames/merges to rows.

    Steps (one transaction): validate the field is editable and the list is
    well-formed; rewrite row cells for any in-place rename (kept id, changed
    label); for each deleted option still in use, fold its rows into the
    supplied replacement (else reject ``catalog_option_in_use``); then write the
    new option set.
    """

    field_key = payload.field_key
    if field_key not in FRAME_TYPE_SINGLE_SELECT_FIELDS:
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "catalog_field_key_unknown",
            f"{field_key!r} is not an editable single-select field.",
        )
    validate_option_list(payload.options)

    incoming_label_by_id = {option.id: option.label for option in payload.options}
    incoming_labels = set(incoming_label_by_id.values())
    merge_replacements: dict[str, str] = {}

    with transaction() as conn:
        option_jobs_service.begin_option_edit(conn, CATALOG_TABLE)
        stored_label_by_id = {
            row["option_id"]: row["label"]
            for row in options_repository.list_options(conn, catalog_table=CATALOG_TABLE, field_key=field_key)
        }

        # Walk the stored options once: a kept option whose label changed
        # rewrites its rows in place; a removed option still in use folds its
        # rows into the supplied replacement (else reject).
        rows_rewritten = False
        for option_id, old_label in stored_label_by_id.items():
            new_label = incoming_label_by_id.get(option_id)
            if new_label is not None:
                if new_label != old_label:
                    rewritten = options_repository.rename_label(
                        conn,
                        catalog_table=CATALOG_TABLE,
                        field_key=field_key,
                        old_label=old_label,
                        new_label=new_label,
                        user_id=user.id,
                    )
                    rows_rewritten = rows_rewritten or rewritten > 0
                continue
            in_use = options_repository.count_rows_using_label(
                conn, catalog_table=CATALOG_TABLE, field_key=field_key, label=old_label
            )
            if not in_use:
                continue
            replacement = payload.replacements.get(old_label)
            if not replacement:
                raise api_error(
                    status.HTTP_409_CONFLICT,
                    "catalog_option_in_use",
                    f"Option {old_label!r} is used by {in_use} row(s); supply a replacement to merge.",
                    {"label": old_label, "in_use": in_use},
                )
            if replacement not in incoming_labels:
                raise api_error(
                    status.HTTP_422_UNPROCESSABLE_CONTENT,
                    "catalog_option_replacement_unknown",
                    f"Replacement {replacement!r} is not in the new option list.",
                )
            options_repository.rename_label(
                conn,
                catalog_table=CATALOG_TABLE,
                field_key=field_key,
                old_label=old_label,
                new_label=replacement,
                user_id=user.id,
            )
            merge_replacements[old_label] = replacement
            rows_rewritten = True

        options_repository.replace_options(
            conn, catalog_table=CATALOG_TABLE, field_key=field_key, options=payload.options
        )
        if rows_rewritten:
            # A rename/merge changed a field cell that feeds the derived name —
            # recompute affected rows' names so they stay consistent (Phase 3).
            frame_repository.recompute_names(conn)
        log_catalog_action(
            conn,
            "catalog_options_edit",
            user,
            request,
            catalog_table=CATALOG_TABLE,
            record_id=field_key,
            changed_fields=[field_key],
        )
        result = options_repository.list_options(conn, catalog_table=CATALOG_TABLE, field_key=field_key)
        cascade_operations = option_jobs_service.operations_from_option_edit(
            field_key=field_key,
            stored_label_by_id=stored_label_by_id,
            incoming_label_by_id=incoming_label_by_id,
            replacements=merge_replacements,
        )
        cascade_job = (
            option_jobs_service.create_job_in_transaction(
                conn,
                catalog_table=CATALOG_TABLE,
                field_key=field_key,
                operations=cascade_operations,
                created_by=user.id,
            )
            if cascade_operations
            else None
        )

    return CatalogFieldOptionsResponse(
        field_key=field_key,
        options=[_to_option(row) for row in result],
        cascade_job=cascade_job,
    )


def seed_frame_type_options(conn: Connection[Any]) -> None:
    """Reset the frame-type option lists to the canonical Phase 0 sets — a thin
    wrapper over the generic ``options_repository.seed_options``.

    Tests call this to restore a known baseline; migration ``20260623_0038``
    ships the same data for fresh databases.
    """

    options_repository.seed_options(conn, catalog_table=CATALOG_TABLE, option_seeds=FRAME_TYPE_OPTION_SEEDS)

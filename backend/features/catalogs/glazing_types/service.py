"""Workflow rules for the Window-Glazing catalog."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from fastapi import Request
from psycopg import Connection
from starlette import status

from database import connection, transaction
from features.auth.models import UserPublic
from features.catalogs import _options_repository as options_repository
from features.catalogs._option_seeds import GLAZING_TYPE_SINGLE_SELECT_FIELDS
from features.catalogs._shared import (
    CatalogManufacturerEntry,
    CatalogManufacturerListResponse,
    log_catalog_action,
    new_catalog_record_id,
    next_copy_suffix,
)
from features.catalogs.glazing_types import repository
from features.catalogs.glazing_types.models import (
    CatalogGlazingTypeCreateRequest,
    CatalogGlazingTypeListItem,
    CatalogGlazingTypeListResponse,
    CatalogGlazingTypePublic,
    CatalogGlazingTypeUpdateRequest,
)
from features.shared.errors import api_error

CATALOG_TABLE = "glazing_types"


def _validate_single_selects(conn: Connection[Any], values: Mapping[str, object]) -> None:
    """Reject any single-select field (``manufacturer``, ``brand``) whose
    non-null value is not a known option label (read live from the catalog
    option store, Phase 1).

    null / empty is always allowed — the fields are nullable and a null part
    simply drops from the composed name (Phase 3). New labels enter **only**
    through the explicit option-add path (``PUT …/options``), never by silently
    accepting an arbitrary string on a row write: the client adds the option
    first, then writes the row. Comparison is exact-label because the store
    enforces case-insensitive label uniqueness, so stored labels are canonical.
    """
    present = {
        field: values[field] for field in GLAZING_TYPE_SINGLE_SELECT_FIELDS if values.get(field) not in (None, "")
    }
    if not present:
        return
    known_by_field: dict[str, set[str]] = {}
    for row in options_repository.list_all_for_table(conn, catalog_table=CATALOG_TABLE):
        known_by_field.setdefault(row["field_key"], set()).add(row["label"])
    for field, value in present.items():
        if value not in known_by_field.get(field, set()):
            raise api_error(
                status.HTTP_422_UNPROCESSABLE_CONTENT,
                "catalog_option_unknown",
                f"{field!r} value {value!r} is not a known option; add it via the field's options first.",
                {"field": field, "value": value},
            )


def _to_public(row: dict[str, Any]) -> CatalogGlazingTypePublic:
    return CatalogGlazingTypePublic.model_validate(row)


def _to_list_item(row: dict[str, Any]) -> CatalogGlazingTypeListItem:
    return CatalogGlazingTypeListItem.model_validate(row)


def list_glazing_types(
    *,
    include_inactive: bool = False,
    manufacturers: list[str] | None = None,
) -> CatalogGlazingTypeListResponse:
    with connection() as conn:
        rows = repository.list_glazing_types(conn, include_inactive=include_inactive, manufacturers=manufacturers)
    return CatalogGlazingTypeListResponse(items=[_to_list_item(row) for row in rows])


def list_glazing_manufacturers() -> CatalogManufacturerListResponse:
    """Phase 11 roster: distinct manufacturers + per-name product count."""

    with connection() as conn:
        rows = repository.list_manufacturers(conn)
    return CatalogManufacturerListResponse(
        items=[CatalogManufacturerEntry.model_validate(row) for row in rows],
    )


def get_glazing_type(record_id: str) -> CatalogGlazingTypePublic:
    with connection() as conn:
        row = repository.get_glazing_type(conn, record_id)
    if row is None:
        raise api_error(status.HTTP_404_NOT_FOUND, "catalog_glazing_type_not_found", "Catalog glazing type not found.")
    return _to_public(row)


def create_glazing_type(
    payload: CatalogGlazingTypeCreateRequest, user: UserPublic, request: Request
) -> CatalogGlazingTypePublic:
    record_id = new_catalog_record_id()
    with transaction() as conn:
        _validate_single_selects(conn, payload.model_dump())
        repository.insert_glazing_type(
            conn,
            record_id=record_id,
            name=payload.name,
            manufacturer=payload.manufacturer,
            brand=payload.brand,
            suffix=payload.suffix,
            u_value_w_m2k=payload.u_value_w_m2k,
            g_value=payload.g_value,
            color=payload.color,
            source=payload.source,
            datasheet_url=payload.datasheet_url,
            comments=payload.comments,
            user_id=user.id,
        )
        row = repository.get_glazing_type(conn, record_id)
        log_catalog_action(
            conn,
            "catalog_record_create",
            user,
            request,
            catalog_table=CATALOG_TABLE,
            record_id=record_id,
        )
    if row is None:
        raise RuntimeError("Catalog glazing type insert did not return a row.")
    return _to_public(row)


def update_glazing_type(
    record_id: str,
    payload: CatalogGlazingTypeUpdateRequest,
    user: UserPublic,
    request: Request,
) -> CatalogGlazingTypePublic:
    values = payload.model_dump(exclude_unset=True)
    with transaction() as conn:
        if not values:
            row = repository.get_glazing_type(conn, record_id)
            if row is None:
                raise api_error(
                    status.HTTP_404_NOT_FOUND,
                    "catalog_glazing_type_not_found",
                    "Catalog glazing type not found.",
                )
            return _to_public(row)
        _validate_single_selects(conn, values)
        ok = repository.update_glazing_type(conn, record_id, values, user.id)
        if not ok:
            raise api_error(
                status.HTTP_404_NOT_FOUND,
                "catalog_glazing_type_not_found",
                "Catalog glazing type not found.",
            )
        row = repository.get_glazing_type(conn, record_id)
        if row is not None:
            log_catalog_action(
                conn,
                "catalog_record_update",
                user,
                request,
                catalog_table=CATALOG_TABLE,
                record_id=record_id,
                changed_fields=list(values.keys()),
            )
    if row is None:
        raise RuntimeError("Catalog glazing type disappeared after update.")
    return _to_public(row)


def duplicate_glazing_type(record_id: str, user: UserPublic, request: Request) -> CatalogGlazingTypePublic:
    """Insert a copy of ``record_id`` with a ``(copy)`` suffix on ``name``."""
    new_record_id = new_catalog_record_id()
    with transaction() as conn:
        source = repository.get_glazing_type(conn, record_id)
        if source is None or not source["is_active"]:
            raise api_error(
                status.HTTP_404_NOT_FOUND,
                "catalog_glazing_type_not_found",
                "Catalog glazing type not found.",
            )
        siblings = repository.list_sibling_names(conn, exclude_id=record_id)
        new_name = next_copy_suffix(source["name"], siblings)
        # No _validate_single_selects here: the source row's labels are already
        # valid (they passed validation on the original write), so a copy cannot
        # introduce an unknown option.
        repository.insert_glazing_type(
            conn,
            record_id=new_record_id,
            name=new_name,
            manufacturer=source["manufacturer"],
            brand=source["brand"],
            suffix=source["suffix"],
            u_value_w_m2k=source["u_value_w_m2k"],
            g_value=source["g_value"],
            color=source["color"],
            source=source["source"],
            datasheet_url=source["datasheet_url"],
            comments=source["comments"],
            user_id=user.id,
        )
        row = repository.get_glazing_type(conn, new_record_id)
        log_catalog_action(
            conn,
            "catalog_record_create",
            user,
            request,
            catalog_table=CATALOG_TABLE,
            record_id=new_record_id,
        )
    if row is None:
        raise RuntimeError("Catalog glazing type disappeared after duplicate.")
    return _to_public(row)


def deactivate_glazing_type(record_id: str, user: UserPublic, request: Request) -> None:
    with transaction() as conn:
        ok = repository.soft_delete_glazing_type(conn, record_id, user.id)
        if ok:
            log_catalog_action(
                conn,
                "catalog_record_delete",
                user,
                request,
                catalog_table=CATALOG_TABLE,
                record_id=record_id,
            )
    if not ok:
        raise api_error(
            status.HTTP_404_NOT_FOUND,
            "catalog_glazing_type_not_found",
            "Catalog glazing type not found or already deactivated.",
        )


def reactivate_glazing_type(record_id: str, user: UserPublic, request: Request) -> CatalogGlazingTypePublic:
    with transaction() as conn:
        ok = repository.reactivate_glazing_type(conn, record_id, user.id)
        if not ok:
            raise api_error(
                status.HTTP_404_NOT_FOUND,
                "catalog_glazing_type_not_found",
                "Catalog glazing type not found or already active.",
            )
        row = repository.get_glazing_type(conn, record_id)
        assert row is not None, "Catalog glazing type disappeared after successful reactivate."
        log_catalog_action(
            conn,
            "catalog_record_reactivate",
            user,
            request,
            catalog_table=CATALOG_TABLE,
            record_id=record_id,
        )
    return _to_public(row)

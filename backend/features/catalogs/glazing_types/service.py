"""Workflow rules for the Window-Glazing catalog."""

from __future__ import annotations

from datetime import date
from typing import Any

from fastapi import Request
from starlette import status

from database import connection, transaction
from features.auth.models import UserPublic
from features.catalogs._shared import (
    log_catalog_action,
    new_catalog_record_id,
    new_catalog_version_id,
)
from features.catalogs.glazing_types import repository
from features.catalogs.glazing_types.models import (
    CATALOG_VERSION_ID_PREFIX,
    CatalogGlazingTypeCreateRequest,
    CatalogGlazingTypeListItem,
    CatalogGlazingTypeListResponse,
    CatalogGlazingTypePublic,
    CatalogGlazingTypeUpdateRequest,
)
from features.shared.errors import api_error

CATALOG_TABLE = "glazing_types"


def _to_public(row: dict[str, Any]) -> CatalogGlazingTypePublic:
    return CatalogGlazingTypePublic.model_validate(row)


def _to_list_item(row: dict[str, Any]) -> CatalogGlazingTypeListItem:
    return CatalogGlazingTypeListItem.model_validate(row)


def list_glazing_types(*, include_inactive: bool = False) -> CatalogGlazingTypeListResponse:
    with connection() as conn:
        rows = repository.list_glazing_types(conn, include_inactive=include_inactive)
    return CatalogGlazingTypeListResponse(items=[_to_list_item(row) for row in rows])


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
    version_id = new_catalog_version_id(CATALOG_VERSION_ID_PREFIX)
    version_date = payload.version_date or date.today()
    with transaction() as conn:
        repository.insert_glazing_type(
            conn,
            record_id=record_id,
            version_id=version_id,
            name=payload.name,
            manufacturer=payload.manufacturer,
            brand=payload.brand,
            version_label=payload.version_label,
            version_date=version_date,
            u_value_w_m2k=payload.u_value_w_m2k,
            g_value=payload.g_value,
            color=payload.color,
            notes=payload.notes,
            source_provenance=payload.source_provenance,
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
            version_id=version_id,
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
                version_id=row["current_version_id"],
                changed_fields=list(values.keys()),
            )
    if row is None:
        raise RuntimeError("Catalog glazing type disappeared after update.")
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
            version_id=row["current_version_id"],
        )
    return _to_public(row)

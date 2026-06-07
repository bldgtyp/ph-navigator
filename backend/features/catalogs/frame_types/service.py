"""Workflow rules for the Window-Frame catalog."""

from __future__ import annotations

from typing import Any

from fastapi import Request
from starlette import status

from database import connection, transaction
from features.auth.models import UserPublic
from features.catalogs._shared import (
    CatalogManufacturerEntry,
    CatalogManufacturerListResponse,
    log_catalog_action,
    new_catalog_record_id,
    next_copy_suffix,
)
from features.catalogs.frame_types import repository
from features.catalogs.frame_types.models import (
    CatalogFrameTypeCreateRequest,
    CatalogFrameTypeListItem,
    CatalogFrameTypeListResponse,
    CatalogFrameTypePublic,
    CatalogFrameTypeUpdateRequest,
)
from features.shared.errors import api_error

CATALOG_TABLE = "frame_types"


def _to_public(row: dict[str, Any]) -> CatalogFrameTypePublic:
    return CatalogFrameTypePublic.model_validate(row)


def _to_list_item(row: dict[str, Any]) -> CatalogFrameTypeListItem:
    return CatalogFrameTypeListItem.model_validate(row)


def list_frame_types(
    *,
    include_inactive: bool = False,
    location: str | None = None,
    operation: str | None = None,
    use: str | None = None,
    manufacturers: list[str] | None = None,
) -> CatalogFrameTypeListResponse:
    with connection() as conn:
        rows = repository.list_frame_types(
            conn,
            include_inactive=include_inactive,
            location=location,
            operation=operation,
            use=use,
            manufacturers=manufacturers,
        )
    return CatalogFrameTypeListResponse(items=[_to_list_item(row) for row in rows])


def list_frame_manufacturers() -> CatalogManufacturerListResponse:
    """Phase 11 roster: distinct manufacturers + per-name product count."""

    with connection() as conn:
        rows = repository.list_manufacturers(conn)
    return CatalogManufacturerListResponse(
        items=[CatalogManufacturerEntry.model_validate(row) for row in rows],
    )


def get_frame_type(record_id: str) -> CatalogFrameTypePublic:
    with connection() as conn:
        row = repository.get_frame_type(conn, record_id)
    if row is None:
        raise api_error(status.HTTP_404_NOT_FOUND, "catalog_frame_type_not_found", "Catalog frame type not found.")
    return _to_public(row)


def create_frame_type(
    payload: CatalogFrameTypeCreateRequest, user: UserPublic, request: Request
) -> CatalogFrameTypePublic:
    record_id = new_catalog_record_id()
    with transaction() as conn:
        repository.insert_frame_type(
            conn,
            record_id=record_id,
            name=payload.name,
            manufacturer=payload.manufacturer,
            brand=payload.brand,
            use=payload.use,
            operation=payload.operation,
            location=payload.location,
            mull_type=payload.mull_type,
            prefix=payload.prefix,
            suffix=payload.suffix,
            material=payload.material,
            width_mm=payload.width_mm,
            u_value_w_m2k=payload.u_value_w_m2k,
            psi_g_w_mk=payload.psi_g_w_mk,
            psi_install_w_mk=payload.psi_install_w_mk,
            color=payload.color,
            source=payload.source,
            datasheet_url=payload.datasheet_url,
            comments=payload.comments,
            user_id=user.id,
        )
        row = repository.get_frame_type(conn, record_id)
        log_catalog_action(
            conn,
            "catalog_record_create",
            user,
            request,
            catalog_table=CATALOG_TABLE,
            record_id=record_id,
        )
    if row is None:
        raise RuntimeError("Catalog frame type insert did not return a row.")
    return _to_public(row)


def update_frame_type(
    record_id: str,
    payload: CatalogFrameTypeUpdateRequest,
    user: UserPublic,
    request: Request,
) -> CatalogFrameTypePublic:
    values = payload.model_dump(exclude_unset=True)
    with transaction() as conn:
        if not values:
            row = repository.get_frame_type(conn, record_id)
            if row is None:
                raise api_error(
                    status.HTTP_404_NOT_FOUND,
                    "catalog_frame_type_not_found",
                    "Catalog frame type not found.",
                )
            return _to_public(row)
        ok = repository.update_frame_type(conn, record_id, values, user.id)
        if not ok:
            raise api_error(
                status.HTTP_404_NOT_FOUND,
                "catalog_frame_type_not_found",
                "Catalog frame type not found.",
            )
        row = repository.get_frame_type(conn, record_id)
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
        raise RuntimeError("Catalog frame type disappeared after update.")
    return _to_public(row)


def duplicate_frame_type(record_id: str, user: UserPublic, request: Request) -> CatalogFrameTypePublic:
    """Insert a copy of ``record_id`` with a ``(copy)`` suffix on ``name``."""
    new_record_id = new_catalog_record_id()
    with transaction() as conn:
        src = repository.get_frame_type(conn, record_id)
        if src is None or not src["is_active"]:
            raise api_error(
                status.HTTP_404_NOT_FOUND,
                "catalog_frame_type_not_found",
                "Catalog frame type not found.",
            )
        siblings = repository.list_sibling_names(conn, exclude_id=record_id)
        new_name = next_copy_suffix(src["name"], siblings)
        repository.insert_frame_type(
            conn,
            record_id=new_record_id,
            name=new_name,
            manufacturer=src["manufacturer"],
            brand=src["brand"],
            use=src["use"],
            operation=src["operation"],
            location=src["location"],
            mull_type=src["mull_type"],
            prefix=src["prefix"],
            suffix=src["suffix"],
            material=src["material"],
            width_mm=src["width_mm"],
            u_value_w_m2k=src["u_value_w_m2k"],
            psi_g_w_mk=src["psi_g_w_mk"],
            psi_install_w_mk=src["psi_install_w_mk"],
            color=src["color"],
            source=src["source"],
            datasheet_url=src["datasheet_url"],
            comments=src["comments"],
            user_id=user.id,
        )
        row = repository.get_frame_type(conn, new_record_id)
        log_catalog_action(
            conn,
            "catalog_record_create",
            user,
            request,
            catalog_table=CATALOG_TABLE,
            record_id=new_record_id,
        )
    if row is None:
        raise RuntimeError("Catalog frame type disappeared after duplicate.")
    return _to_public(row)


def deactivate_frame_type(record_id: str, user: UserPublic, request: Request) -> None:
    with transaction() as conn:
        ok = repository.soft_delete_frame_type(conn, record_id, user.id)
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
            "catalog_frame_type_not_found",
            "Catalog frame type not found or already deactivated.",
        )


def reactivate_frame_type(record_id: str, user: UserPublic, request: Request) -> CatalogFrameTypePublic:
    with transaction() as conn:
        ok = repository.reactivate_frame_type(conn, record_id, user.id)
        if not ok:
            raise api_error(
                status.HTTP_404_NOT_FOUND,
                "catalog_frame_type_not_found",
                "Catalog frame type not found or already active.",
            )
        row = repository.get_frame_type(conn, record_id)
        assert row is not None, "Catalog frame type disappeared after successful reactivate."
        log_catalog_action(
            conn,
            "catalog_record_reactivate",
            user,
            request,
            catalog_table=CATALOG_TABLE,
            record_id=record_id,
        )
    return _to_public(row)

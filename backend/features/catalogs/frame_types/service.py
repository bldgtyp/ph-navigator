"""Workflow rules for the Window-Frame catalog."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from fastapi import Request
from psycopg import Connection
from starlette import status

from database import connection, transaction
from features.auth.models import UserPublic
from features.catalogs import _options_repository as options_repository
from features.catalogs._option_seeds import FRAME_TYPE_SINGLE_SELECT_FIELDS
from features.catalogs._shared import (
    CatalogManufacturerEntry,
    CatalogManufacturerListResponse,
    log_catalog_action,
    new_catalog_record_id,
)
from features.catalogs.frame_types import repository
from features.catalogs.frame_types._name import _NAME_PART_ORDER, compose_frame_name
from features.catalogs.frame_types.models import (
    CatalogFrameTypeCreateRequest,
    CatalogFrameTypeListItem,
    CatalogFrameTypeListResponse,
    CatalogFrameTypePublic,
    CatalogFrameTypeUpdateRequest,
)
from features.shared.errors import api_error

CATALOG_TABLE = "frame_types"


def _validate_single_selects(conn: Connection[Any], values: Mapping[str, object]) -> None:
    """Reject any of the six single-select fields whose non-null value is not a
    known option label (read live from the catalog option store, Phase 1).

    null / empty is always allowed — the fields are nullable and a null part
    simply drops from the composed name (Phase 3). New labels enter **only**
    through the explicit option-add path (``PUT …/options``), never by silently
    accepting an arbitrary string on a row write: the client adds the option
    first, then writes the row. Comparison is exact-label because the store
    enforces case-insensitive label uniqueness, so stored labels are canonical.
    """
    present = {field: values[field] for field in FRAME_TYPE_SINGLE_SELECT_FIELDS if values.get(field) not in (None, "")}
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
    field_values = payload.model_dump()
    with transaction() as conn:
        _validate_single_selects(conn, field_values)
        repository.insert_frame_type(
            conn,
            record_id=record_id,
            name=compose_frame_name(field_values),
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
        _validate_single_selects(conn, values)
        if any(part in values for part in _NAME_PART_ORDER):
            # A name-part changed — recompute the derived name from the merged
            # row. Fetching here is also the load-bearing existence check for a
            # name-part patch (validation above only checked option labels, not
            # that the row exists / is active).
            current = repository.get_frame_type(conn, record_id)
            if current is None or not current["is_active"]:
                raise api_error(
                    status.HTTP_404_NOT_FOUND,
                    "catalog_frame_type_not_found",
                    "Catalog frame type not found.",
                )
            values["name"] = compose_frame_name({**current, **values})
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
    """Insert a copy of ``record_id``.

    With ``name`` now derived from the parts (D-3), a copy has identical parts
    and therefore an identical name — duplicates are distinguished by id, not by
    a ``(copy)`` suffix (the active-name index is non-unique). The user renames
    by editing a part afterwards.
    """
    new_record_id = new_catalog_record_id()
    with transaction() as conn:
        src = repository.get_frame_type(conn, record_id)
        if src is None or not src["is_active"]:
            raise api_error(
                status.HTTP_404_NOT_FOUND,
                "catalog_frame_type_not_found",
                "Catalog frame type not found.",
            )
        # No _validate_single_selects here: the source row's labels are already
        # valid (they passed validation on the original write), so a copy cannot
        # introduce an unknown option.
        repository.insert_frame_type(
            conn,
            record_id=new_record_id,
            name=compose_frame_name(src),
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

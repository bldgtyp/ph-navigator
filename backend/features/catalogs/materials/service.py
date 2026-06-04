"""Workflow rules for the Materials catalog."""

from __future__ import annotations

from typing import Any

from fastapi import Request
from starlette import status

from database import connection, transaction
from features.auth.models import UserPublic
from features.catalogs._shared import (
    log_catalog_action,
    new_catalog_record_id,
    next_copy_suffix,
)
from features.catalogs.materials import repository
from features.catalogs.materials.models import (
    CatalogMaterialCreateRequest,
    CatalogMaterialListItem,
    CatalogMaterialListResponse,
    CatalogMaterialPublic,
    CatalogMaterialUpdateRequest,
)
from features.shared.errors import api_error

CATALOG_TABLE = "materials"


def _to_public(row: dict[str, Any]) -> CatalogMaterialPublic:
    return CatalogMaterialPublic.model_validate(row)


def _to_list_item(row: dict[str, Any]) -> CatalogMaterialListItem:
    return CatalogMaterialListItem.model_validate(row)


def list_materials(*, include_inactive: bool = False) -> CatalogMaterialListResponse:
    with connection() as conn:
        rows = repository.list_materials(conn, include_inactive=include_inactive)
    return CatalogMaterialListResponse(items=[_to_list_item(row) for row in rows])


def get_material(material_id: str) -> CatalogMaterialPublic:
    with connection() as conn:
        row = repository.get_material(conn, material_id)
    if row is None:
        raise api_error(status.HTTP_404_NOT_FOUND, "catalog_material_not_found", "Catalog material not found.")
    return _to_public(row)


def create_material(payload: CatalogMaterialCreateRequest, user: UserPublic, request: Request) -> CatalogMaterialPublic:
    record_id = new_catalog_record_id()
    with transaction() as conn:
        repository.insert_material(
            conn,
            record_id=record_id,
            name=payload.name,
            category=payload.category,
            density_kg_m3=payload.density_kg_m3,
            specific_heat_j_kgk=payload.specific_heat_j_kgk,
            conductivity_w_mk=payload.conductivity_w_mk,
            emissivity=payload.emissivity,
            color=payload.color,
            source=payload.source,
            url=payload.url,
            comments=payload.comments,
            user_id=user.id,
        )
        row = repository.get_material(conn, record_id)
        log_catalog_action(
            conn,
            "catalog_record_create",
            user,
            request,
            catalog_table=CATALOG_TABLE,
            record_id=record_id,
        )
    if row is None:
        raise RuntimeError("Catalog material insert did not return a row.")
    return _to_public(row)


def update_material(
    material_id: str,
    payload: CatalogMaterialUpdateRequest,
    user: UserPublic,
    request: Request,
) -> CatalogMaterialPublic:
    values = payload.model_dump(exclude_unset=True)
    with transaction() as conn:
        if not values:
            row = repository.get_material(conn, material_id)
            if row is None:
                raise api_error(
                    status.HTTP_404_NOT_FOUND,
                    "catalog_material_not_found",
                    "Catalog material not found.",
                )
            return _to_public(row)
        ok = repository.update_material(conn, material_id, values, user.id)
        if not ok:
            raise api_error(
                status.HTTP_404_NOT_FOUND,
                "catalog_material_not_found",
                "Catalog material not found.",
            )
        row = repository.get_material(conn, material_id)
        if row is not None:
            log_catalog_action(
                conn,
                "catalog_record_update",
                user,
                request,
                catalog_table=CATALOG_TABLE,
                record_id=material_id,
                changed_fields=list(values.keys()),
            )
    if row is None:
        raise RuntimeError("Catalog material disappeared after update.")
    return _to_public(row)


def duplicate_material(material_id: str, user: UserPublic, request: Request) -> CatalogMaterialPublic:
    """Insert a copy of ``material_id`` with a ``(copy)`` suffix on ``name``.

    The new record gets a fresh internal id, the next free
    ``next_copy_suffix`` name across active sibling rows, and copies
    every other catalog field verbatim from the source. ``created_*`` /
    ``updated_*`` are minted by the insert path. Audited as a regular
    ``catalog_record_create``: the row is a new record from the
    catalog's perspective.
    """
    new_record_id = new_catalog_record_id()
    with transaction() as conn:
        source = repository.get_material(conn, material_id)
        if source is None or not source["is_active"]:
            raise api_error(
                status.HTTP_404_NOT_FOUND,
                "catalog_material_not_found",
                "Catalog material not found.",
            )
        siblings = repository.list_sibling_names(conn, exclude_id=material_id)
        new_name = next_copy_suffix(source["name"], siblings)
        repository.insert_material(
            conn,
            record_id=new_record_id,
            name=new_name,
            category=source["category"],
            density_kg_m3=source["density_kg_m3"],
            specific_heat_j_kgk=source["specific_heat_j_kgk"],
            conductivity_w_mk=source["conductivity_w_mk"],
            emissivity=source["emissivity"],
            color=source["color"],
            source=source["source"],
            url=source["url"],
            comments=source["comments"],
            user_id=user.id,
        )
        row = repository.get_material(conn, new_record_id)
        log_catalog_action(
            conn,
            "catalog_record_create",
            user,
            request,
            catalog_table=CATALOG_TABLE,
            record_id=new_record_id,
        )
    if row is None:
        raise RuntimeError("Catalog material disappeared after duplicate.")
    return _to_public(row)


def deactivate_material(material_id: str, user: UserPublic, request: Request) -> None:
    with transaction() as conn:
        ok = repository.soft_delete_material(conn, material_id, user.id)
        if ok:
            log_catalog_action(
                conn,
                "catalog_record_delete",
                user,
                request,
                catalog_table=CATALOG_TABLE,
                record_id=material_id,
            )
    if not ok:
        raise api_error(
            status.HTTP_404_NOT_FOUND,
            "catalog_material_not_found",
            "Catalog material not found or already deactivated.",
        )


def reactivate_material(material_id: str, user: UserPublic, request: Request) -> CatalogMaterialPublic:
    with transaction() as conn:
        ok = repository.reactivate_material(conn, material_id, user.id)
        if not ok:
            raise api_error(
                status.HTTP_404_NOT_FOUND,
                "catalog_material_not_found",
                "Catalog material not found or already active.",
            )
        row = repository.get_material(conn, material_id)
        assert row is not None, "Catalog material disappeared after successful reactivate."
        log_catalog_action(
            conn,
            "catalog_record_reactivate",
            user,
            request,
            catalog_table=CATALOG_TABLE,
            record_id=material_id,
        )
    return _to_public(row)

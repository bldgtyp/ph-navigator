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
    """List catalog material rows for the catalog editor.

    Read-only ``connection()`` scope. Default excludes soft-deleted rows
    so the editor's "active" view is the cheap path; ``include_inactive``
    is only used by the deleted/restore screen. No pagination today —
    full table read; track in the materials-catalog PRD if the catalog
    grows past a few thousand rows.
    """
    with connection() as conn:
        rows = repository.list_materials(conn, include_inactive=include_inactive)
    return CatalogMaterialListResponse(items=[_to_list_item(row) for row in rows])


def get_material(material_id: str) -> CatalogMaterialPublic:
    """Fetch a catalog material row by its rec-id.

    Read-only ``connection()`` scope. Returns the row regardless of
    ``is_active`` so the deleted-record screen can still hydrate
    details; the active-only filter is enforced by ``list_materials``.
    Raises ``api_error(404, "catalog_material_not_found")``.
    """
    with connection() as conn:
        row = repository.get_material(conn, material_id)
    if row is None:
        raise api_error(status.HTTP_404_NOT_FOUND, "catalog_material_not_found", "Catalog material not found.")
    return _to_public(row)


def create_material(payload: CatalogMaterialCreateRequest, user: UserPublic, request: Request) -> CatalogMaterialPublic:
    """Insert a new catalog material with audit logging.

    Single transaction so the insert and the ``catalog_record_create``
    audit row land together. ``record_id`` is minted by
    ``new_catalog_record_id()`` (``rec`` + 14-char base62 matching the
    AirTable seed format). No explicit conflict handling — the
    repository raises ``UniqueViolation`` if the rec-id collides, which
    the caller surfaces as a 500; collisions are statistically
    impossible at catalog scale.
    """
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
    """Patch a catalog material; no-op when no fields actually changed.

    Single transaction. ``model_dump(exclude_unset=True)`` distinguishes
    "field omitted" from "field set to null"; an empty diff returns the
    current row without writing an audit entry. The audit log records
    only the changed-field names, not their values. Raises
    ``api_error(404, "catalog_material_not_found")`` when the row is
    missing.
    """
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
    """Soft-delete a catalog material; idempotent at the API surface only via 404.

    Single transaction. ``soft_delete_material`` returns False if the
    row is missing OR already inactive; either case surfaces as
    ``api_error(404, "catalog_material_not_found")``. The audit entry
    only writes on a successful state transition, so re-deactivating a
    deactivated row neither writes nor mutates.
    """
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
    """Restore a soft-deleted catalog material.

    Single transaction. Mirrors ``deactivate_material``: returns 404 if
    the row is missing or already active, audits only on real state
    transition. The post-flip ``get_material`` is asserted non-None
    because the row was just observed inside the same transaction.
    """
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

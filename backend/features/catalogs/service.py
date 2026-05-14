"""Workflow rules for the Materials catalog."""

from __future__ import annotations

import secrets
from datetime import date
from typing import Any

from fastapi import Request
from starlette import status

from database import connection, transaction
from features.auth.models import UserPublic
from features.catalogs import repository
from features.catalogs.audit import log_catalog_action
from features.catalogs.models import (
    CATALOG_RECORD_ID_PREFIX,
    CATALOG_VERSION_ID_PREFIX,
    CatalogMaterialCreateRequest,
    CatalogMaterialListResponse,
    CatalogMaterialPublic,
    CatalogMaterialUpdateRequest,
)
from features.shared.errors import api_error

CATALOG_TABLE = "materials"


def _new_id(prefix: str) -> str:
    return f"{prefix}{secrets.token_urlsafe(12)}"


def _to_public(row: dict[str, Any]) -> CatalogMaterialPublic:
    return CatalogMaterialPublic.model_validate(row)


def list_materials(*, include_inactive: bool = False) -> CatalogMaterialListResponse:
    with connection() as conn:
        rows = repository.list_materials(conn, include_inactive=include_inactive)
    return CatalogMaterialListResponse(items=[_to_public(row) for row in rows])


def get_material(material_id: str) -> CatalogMaterialPublic:
    with connection() as conn:
        row = repository.get_material(conn, material_id)
    if row is None:
        raise api_error(status.HTTP_404_NOT_FOUND, "catalog_material_not_found", "Catalog material not found.")
    return _to_public(row)


def create_material(payload: CatalogMaterialCreateRequest, user: UserPublic, request: Request) -> CatalogMaterialPublic:
    record_id = _new_id(CATALOG_RECORD_ID_PREFIX)
    version_id = _new_id(CATALOG_VERSION_ID_PREFIX)
    version_date = payload.version_date or date.today()
    with transaction() as conn:
        repository.insert_material(
            conn,
            record_id=record_id,
            version_id=version_id,
            name=payload.name,
            category=payload.category,
            version_label=payload.version_label,
            version_date=version_date,
            conductivity_w_mk=payload.conductivity_w_mk,
            density_kg_m3=payload.density_kg_m3,
            specific_heat_j_kgk=payload.specific_heat_j_kgk,
            emissivity=payload.emissivity,
            argb_color=payload.argb_color,
            notes=payload.notes,
            source_provenance=payload.source_provenance,
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
            version_id=version_id,
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
                version_id=row["current_version_id"],
                changed_fields=list(values.keys()),
            )
    if row is None:
        raise RuntimeError("Catalog material disappeared after update.")
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
        log_catalog_action(
            conn,
            "catalog_record_reactivate",
            user,
            request,
            catalog_table=CATALOG_TABLE,
            record_id=material_id,
            version_id=row["current_version_id"] if row else None,
        )
    if row is None:
        raise RuntimeError("Catalog material disappeared after reactivate.")
    return _to_public(row)

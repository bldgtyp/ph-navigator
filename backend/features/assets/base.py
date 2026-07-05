"""Shared asset service protocols and IDs."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any, Protocol
from uuid import UUID

from psycopg import Connection
from starlette import status

from features.project_location import repository as location_repository
from features.shared.errors import api_error

ASSET_LOCATOR_SCHEME = "phn-asset"


def asset_locator(asset_id: str) -> str:
    """Stable, non-expiring reference to a project asset for external payloads.

    Downstream consumers (e.g. the Grasshopper export / PHX) resolve
    ``phn-asset:<id>`` to a signed download only when they need the bytes — so
    payloads never embed short-lived signed URLs. Defined here, in the assets
    domain, so every wire boundary that references an asset agrees on the scheme.
    """
    return f"{ASSET_LOCATOR_SCHEME}:{asset_id}"


def generated_asset_id() -> str:
    return f"asset_{datetime.now(tz=UTC).strftime('%Y%m%d%H%M%S%f')}"


def generated_job_id() -> str:
    return f"job_{datetime.now(tz=UTC).strftime('%Y%m%d%H%M%S%f')}"


class AssetStorage(Protocol):
    def generate_signed_put_url(
        self,
        object_key: str,
        content_type: str,
        size_bytes: int,
        expires_in_seconds: int = 600,
    ) -> str: ...

    def generate_signed_get_url(
        self,
        object_key: str,
        expires_in_seconds: int,
        response_content_disposition: str | None = None,
    ) -> str: ...

    def head_object(self, object_key: str) -> dict[str, object]: ...

    def get_object_prefix(self, object_key: str, byte_range: tuple[int, int]) -> bytes: ...

    def get_object(self, object_key: str) -> bytes: ...

    def put_object(self, object_key: str, body: bytes, content_type: str) -> str: ...

    def copy_object(self, source_key: str, dest_key: str) -> None: ...

    def delete_object(self, object_key: str) -> None: ...


class AssetThumbnailer(Protocol):
    def render_for_asset(self, project_id: UUID, asset_id: str) -> None: ...


def asset_not_found():
    return api_error(status.HTTP_404_NOT_FOUND, "asset_not_found", "Asset not found.")


def location_asset_ids_for_project(conn: Connection[Any], project_id: UUID) -> set[str]:
    asset_id = location_repository.get_epw_asset_id(conn, project_id)
    return {asset_id} if asset_id is not None else set()

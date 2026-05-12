"""Workflow rules for project lifecycle status items."""

from __future__ import annotations

from datetime import date
from uuid import UUID

from starlette import status

from database import connection, transaction
from features.project_status import repository
from features.project_status.constants import DEFAULT_TEMPLATE
from features.project_status.models import (
    StatusItemCreateRequest,
    StatusItemListResponse,
    StatusItemPublic,
    StatusItemUpdateRequest,
)
from features.projects.access import ProjectAccess
from features.shared.errors import api_error


def status_item_public(row: dict[str, object]) -> StatusItemPublic:
    return StatusItemPublic.model_validate(row)


def list_project_status_items(access: ProjectAccess) -> StatusItemListResponse:
    """Return the shared project lifecycle list for editors or public viewers."""
    with connection() as conn:
        rows = repository.list_status_items(conn, access.project_id)
    return StatusItemListResponse(items=[status_item_public(row) for row in rows])


def create_status_item(payload: StatusItemCreateRequest, access: ProjectAccess) -> StatusItemPublic:
    """Create a direct-write lifecycle item outside the versioned project document."""
    user = require_editor_user(access)
    completion_date = payload.completion_date
    if payload.state == "done" and completion_date is None:
        completion_date = date.today()
    payload = payload.model_copy(update={"completion_date": completion_date})

    with transaction() as conn:
        order_index = payload.order_index
        if order_index is None:
            order_index = repository.next_order_index(conn, access.project_id)
        row = repository.insert_status_item(conn, access.project_id, payload, order_index, user.id)
    return status_item_public(row)


def update_status_item(
    item_id: UUID,
    payload: StatusItemUpdateRequest,
    access: ProjectAccess,
) -> StatusItemPublic:
    """Patch one lifecycle item, including the state/date transition policy."""
    user = require_editor_user(access)
    with transaction() as conn:
        current = repository.get_status_item(conn, access.project_id, item_id)
        if current is None:
            raise api_error(status.HTTP_404_NOT_FOUND, "status_item_not_found", "Status item not found.")

        values = payload.model_dump(exclude_unset=True)
        if "state" in payload.model_fields_set:
            next_state = values["state"]
            if (
                next_state == "done"
                and current["state"] != "done"
                and "completion_date" not in payload.model_fields_set
                and current["completion_date"] is None
            ):
                values["completion_date"] = date.today()

        if not values:
            return status_item_public(current)

        updated = repository.update_status_item(conn, access.project_id, item_id, values, user.id)
        if updated is None:
            raise api_error(status.HTTP_404_NOT_FOUND, "status_item_not_found", "Status item not found.")
    return status_item_public(updated)


def delete_status_item(item_id: UUID, access: ProjectAccess) -> None:
    """Soft-delete a status item so admin recovery remains possible."""
    user = require_editor_user(access)
    with transaction() as conn:
        deleted = repository.soft_delete_status_item(conn, access.project_id, item_id, user.id)
    if not deleted:
        raise api_error(status.HTTP_404_NOT_FOUND, "status_item_not_found", "Status item not found.")


def apply_default_template(access: ProjectAccess) -> StatusItemListResponse:
    """Apply the cert-agnostic BLDGTYP lifecycle template once to an empty status list."""
    user = require_editor_user(access)
    with transaction() as conn:
        if repository.count_status_items(conn, access.project_id) > 0:
            raise api_error(
                status.HTTP_409_CONFLICT,
                "status_template_not_empty",
                "Default status template can only be applied to an empty project status list.",
            )
        for index, title in enumerate(DEFAULT_TEMPLATE, start=1):
            repository.insert_status_item(
                conn,
                access.project_id,
                StatusItemCreateRequest(title=title),
                float(index),
                user.id,
            )
        rows = repository.list_status_items(conn, access.project_id)
    return StatusItemListResponse(items=[status_item_public(row) for row in rows])


def require_editor_user(access: ProjectAccess):
    if access.user is None:
        raise api_error(status.HTTP_401_UNAUTHORIZED, "not_authenticated", "Sign-in required.")
    return access.user

"""Shared primitives for the bookshelf catalogs (Materials, Frame, Glazing).

Each catalog has its own typed value columns and Pydantic model surface, but
they share three concerns:

- ID format. Record IDs follow the AirTable shape (``rec`` + 14 base62 chars)
  so V1 / AirTable imports drop in as a literal ``INSERT ... id = rec_id``
  with no remapping table. Versions are V2-native and table-prefixed because
  AirTable has no version concept.
- Validators. Trim-required and trim-optional helpers used across every
  catalog's Pydantic request models.
- Audit. Catalog writes land in ``user_action_log`` per US-OPS-1 and
  data-model.md §7.3.

Repository note: the two SQL helpers in this module are the shared repository
surface for catalog tables whose concrete repositories only differ by table
name. Feature-specific catalog repositories remain the preferred home for
table-specific SQL.
"""

from __future__ import annotations

import re
import secrets
import string
from collections.abc import Iterable
from typing import Any, Final
from uuid import UUID

from fastapi import Request
from psycopg import Connection, sql
from pydantic import BaseModel, ConfigDict, Field

from features.auth import repository as auth_repository
from features.auth.models import UserPublic
from features.auth.service import client_ip, user_agent
from features.catalogs.option_jobs_models import CatalogOptionJob
from features.project_document.rows import SingleSelectOption


class CatalogManufacturerEntry(BaseModel):
    """One row in a catalog's manufacturer roster: name + product count.

    Used by the Phase 11 manufacturer-filter modal to render the per-
    column checkbox lists. The roster is computed live from the catalog
    table rather than snapshotted in the project document.
    """

    model_config = ConfigDict(extra="forbid")

    manufacturer: str
    product_count: int


class CatalogManufacturerListResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[CatalogManufacturerEntry]


# --------------------------------------------------------------------------- #
# Single-select option store (catalog_field_options) — see _options_repository.
# These two DTOs are catalog-generic (no frame/glazing/materials specifics), so
# every catalog's options service/routes imports them from here. The per-catalog
# "all fields at once" aggregate (e.g. CatalogFrameTypeOptionsResponse) stays in
# that catalog's own models module.
# --------------------------------------------------------------------------- #


class CatalogFieldOptionsResponse(BaseModel):
    """One field's option list — the PUT-edit response."""

    model_config = ConfigDict(extra="forbid")

    field_key: str
    options: list[SingleSelectOption]
    cascade_job: CatalogOptionJob | None = None


class EditCatalogOptionsRequest(BaseModel):
    """Full-replacement edit of one field's option list.

    ``replacements`` maps a *deleted* option's label to the surviving label its
    in-use rows should fold into (the merge / cleanup path). A deleted label
    that is still referenced by an active row and has no replacement is rejected
    (cascade guard).
    """

    model_config = ConfigDict(extra="forbid")

    field_key: str
    options: list[SingleSelectOption]
    replacements: dict[str, str] = Field(default_factory=dict)


_COPY_SUFFIX_RE: Final = re.compile(r"^(.*?)\s*\(copy(?:\s+(\d+))?\)$")


def next_copy_suffix(base_name: str, sibling_names: Iterable[str]) -> str:
    """Resolve the next free ``<root> (copy)`` / ``<root> (copy N)`` name.

    Matches AirTable's duplicate-row UX: duplicating ``Foo`` produces
    ``Foo (copy)``; duplicating ``Foo`` again produces ``Foo (copy 2)``;
    duplicating ``Foo (copy)`` also produces ``Foo (copy 2)`` (the
    source's own suffix is stripped before resolving) so the chain stays
    flat rather than recursing into ``Foo (copy) (copy)``.

    ``sibling_names`` is the set of names already in the same scope —
    typically the table's active rows excluding the source.
    """
    match = _COPY_SUFFIX_RE.match(base_name)
    root = match.group(1) if match else base_name
    siblings = set(sibling_names)
    candidate = f"{root} (copy)"
    if candidate not in siblings:
        return candidate
    n = 2
    while True:
        candidate = f"{root} (copy {n})"
        if candidate not in siblings:
            return candidate
        n += 1


CATALOG_SCHEMA_VERSION: Final[int] = 1

# AirTable record IDs are ``rec`` + 14 alphanumeric chars (base62). Matching
# the shape exactly lets V1 / AirTable imports drop in unmodified.
CATALOG_RECORD_ID_PREFIX: Final[str] = "rec"
_CATALOG_RECORD_ID_BODY_LENGTH: Final[int] = 14
_RECORD_ID_ALPHABET: Final[str] = string.ascii_letters + string.digits


def new_catalog_record_id() -> str:
    """Generate a fresh catalog record id in AirTable's ``rec`` + 14-char shape."""
    body = "".join(secrets.choice(_RECORD_ID_ALPHABET) for _ in range(_CATALOG_RECORD_ID_BODY_LENGTH))
    return f"{CATALOG_RECORD_ID_PREFIX}{body}"


def strip_required(value: object) -> object:
    if isinstance(value, str):
        return value.strip()
    return value


def strip_optional(value: object) -> object:
    if isinstance(value, str):
        stripped = value.strip()
        return stripped or None
    return value


def soft_delete_catalog_record(
    conn: Connection[Any],
    *,
    table: str,
    record_id: str,
    user_id: UUID,
) -> bool:
    """Soft-delete the catalog identity row. False when already inactive or missing."""
    row = conn.execute(
        sql.SQL(
            """
            UPDATE {table}
            SET deleted_at = now(),
                updated_at = now(),
                updated_by = %(user_id)s
            WHERE id = %(id)s AND deleted_at IS NULL
            RETURNING id
            """
        ).format(table=sql.Identifier(table)),
        {"id": record_id, "user_id": user_id},
    ).fetchone()
    return row is not None


def reactivate_catalog_record(
    conn: Connection[Any],
    *,
    table: str,
    record_id: str,
    user_id: UUID,
) -> bool:
    """Restore a soft-deleted catalog identity row. False when not currently inactive."""
    row = conn.execute(
        sql.SQL(
            """
            UPDATE {table}
            SET deleted_at = NULL,
                updated_at = now(),
                updated_by = %(user_id)s
            WHERE id = %(id)s AND deleted_at IS NOT NULL
            RETURNING id
            """
        ).format(table=sql.Identifier(table)),
        {"id": record_id, "user_id": user_id},
    ).fetchone()
    return row is not None


def log_catalog_action(
    conn: Connection[Any],
    action: str,
    user: UserPublic,
    request: Request,
    *,
    catalog_table: str,
    record_id: str,
    version_id: str | None = None,
    changed_fields: list[str] | None = None,
) -> None:
    """Record a catalog write to ``user_action_log``.

    The audit trail keeps "who changed what when" across BLDGTYP projects
    without needing to diff catalog version rows.
    """
    details: dict[str, Any] = {
        "catalog_table": catalog_table,
        "record_id": record_id,
    }
    if version_id is not None:
        details["version_id"] = version_id
    if changed_fields is not None:
        details["changed_fields"] = sorted(changed_fields)
    auth_repository.log_action(
        conn,
        action=action,
        user_id=user.id,
        email=user.email,
        session_id=None,
        ip_address=client_ip(request),
        user_agent=user_agent(request),
        details=details,
    )

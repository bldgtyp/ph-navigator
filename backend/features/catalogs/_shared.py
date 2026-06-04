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

from features.auth import repository as auth_repository
from features.auth.models import UserPublic
from features.auth.service import client_ip, user_agent

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


def new_catalog_version_id(prefix: str) -> str:
    """Generate a fresh catalog version id.

    Version ids are V2-native and table-prefixed (``matv_``, ``framev_``,
    ``glazingv_``) so they remain self-documenting; AirTable has no version
    concept so there is no import-compat constraint on versions.
    """
    return f"{prefix}{secrets.token_urlsafe(12)}"


def strip_required(value: object) -> object:
    if isinstance(value, str):
        return value.strip()
    return value


def strip_optional(value: object) -> object:
    if isinstance(value, str):
        stripped = value.strip()
        return stripped or None
    return value


def reject_clearing_version_date(model: Any) -> None:
    """Shared `version_date` PATCH guard.

    The DB column is NOT NULL. Omitting the field on PATCH keeps the value;
    passing an explicit ``null`` would emit ``SET version_date = NULL`` and
    trip the constraint as a 500. Each catalog's UpdateRequest calls this
    from a ``@model_validator(mode="after")`` to fail closed at 422 instead.
    """
    if "version_date" in model.model_fields_set and model.version_date is None:
        raise ValueError("version_date cannot be set to null; omit the field to leave it unchanged")


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

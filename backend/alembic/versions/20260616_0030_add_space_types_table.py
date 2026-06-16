"""add space types table

Revision ID: 20260616_0030
Revises: 20260616_0029
Create Date: 2026-06-16 16:30:00.000000
"""

from __future__ import annotations

import copy
import hashlib
import json
from collections.abc import MutableMapping, Sequence
from typing import cast

import sqlalchemy as sa

from alembic import op

revision: str = "20260616_0030"
down_revision: str | None = "20260616_0029"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

DRAFT_ETAG_SALT = "20260616_0030_add_space_types_table"
OLD_SCHEMA_VERSION = 5
NEW_SCHEMA_VERSION = 6
SPACE_TYPES_TABLE: dict[str, object] = {
    "field_defs": [
        {
            "field_key": "record_id",
            "display_name": "Tag",
            "field_type": "short_text",
            "config": {},
            "description": "Project-specific space type tag.",
            "default": None,
            "origin": "built_in",
            "created_at": "2026-05-26T00:00:00Z",
            "created_by": None,
        },
        {
            "field_key": "name",
            "display_name": "Name",
            "field_type": "short_text",
            "config": {},
            "description": None,
            "default": None,
            "origin": "built_in",
            "created_at": "2026-05-26T00:00:00Z",
            "created_by": None,
        },
    ],
    "rows": [],
}


def upgrade() -> None:
    conn = op.get_bind()
    version_etags = _convert_project_versions(conn, direction="add")
    _convert_project_version_drafts(conn, version_etags, direction="add")


def downgrade() -> None:
    conn = op.get_bind()
    version_etags = _convert_project_versions(conn, direction="remove")
    _convert_project_version_drafts(conn, version_etags, direction="remove")


def _convert_project_versions(conn: sa.Connection, *, direction: str) -> dict[str, str]:
    rows = conn.execute(sa.text("SELECT id, body FROM project_versions")).mappings()
    version_etags: dict[str, str] = {}
    for row in rows:
        body = copy.deepcopy(row["body"])
        changed = _convert_body(body, direction=direction)
        version_etag = _document_etag(body)
        version_etags[str(row["id"])] = version_etag
        schema_version = NEW_SCHEMA_VERSION if direction == "add" else OLD_SCHEMA_VERSION
        if changed:
            conn.execute(
                sa.text(
                    """
                    UPDATE project_versions
                    SET body = CAST(:body AS jsonb),
                        schema_version = :schema_version,
                        body_size_bytes = :body_size_bytes
                    WHERE id = :id
                    """
                ),
                {
                    "id": row["id"],
                    "body": _json_body(body),
                    "schema_version": schema_version,
                    "body_size_bytes": _body_size_bytes(body),
                },
            )
    return version_etags


def _convert_project_version_drafts(conn: sa.Connection, version_etags: dict[str, str], *, direction: str) -> None:
    rows = conn.execute(
        sa.text("SELECT version_id, user_id, body, base_version_etag, draft_etag FROM project_version_drafts")
    ).mappings()
    for row in rows:
        body = copy.deepcopy(row["body"])
        changed = _convert_body(body, direction=direction)
        base_version_etag = version_etags.get(str(row["version_id"]), row["base_version_etag"])
        draft_etag = _draft_etag(body) if changed else row["draft_etag"]
        schema_version = NEW_SCHEMA_VERSION if direction == "add" else OLD_SCHEMA_VERSION
        if changed or base_version_etag != row["base_version_etag"]:
            conn.execute(
                sa.text(
                    """
                    UPDATE project_version_drafts
                    SET body = CAST(:body AS jsonb),
                        schema_version = :schema_version,
                        base_version_etag = :base_version_etag,
                        draft_etag = :draft_etag
                    WHERE version_id = :version_id
                      AND user_id = :user_id
                    """
                ),
                {
                    "version_id": row["version_id"],
                    "user_id": row["user_id"],
                    "body": _json_body(body),
                    "schema_version": schema_version,
                    "base_version_etag": base_version_etag,
                    "draft_etag": draft_etag,
                },
            )


def _convert_body(body: object, *, direction: str) -> bool:
    body_mapping = _as_mapping(body)
    if body_mapping is None:
        return False
    tables = _as_mapping(body_mapping.get("tables"))
    if tables is None:
        return False

    changed = False
    if direction == "add":
        if body_mapping.get("schema_version") != NEW_SCHEMA_VERSION:
            body_mapping["schema_version"] = NEW_SCHEMA_VERSION
            changed = True
        if "space_types" not in tables:
            tables["space_types"] = copy.deepcopy(SPACE_TYPES_TABLE)
            changed = True
        return changed
    if direction == "remove":
        if body_mapping.get("schema_version") != OLD_SCHEMA_VERSION:
            body_mapping["schema_version"] = OLD_SCHEMA_VERSION
            changed = True
        if "space_types" in tables:
            del tables["space_types"]
            changed = True
        return changed
    raise ValueError(f"Unsupported space-types migration direction: {direction}")


def _as_mapping(value: object) -> MutableMapping[str, object] | None:
    if not isinstance(value, MutableMapping):
        return None
    return cast(MutableMapping[str, object], value)


def _document_etag(body: object) -> str:
    payload = json.dumps(body, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _draft_etag(body: object) -> str:
    payload = f"{_document_etag(body)}:{DRAFT_ETAG_SALT}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _json_body(body: object) -> str:
    return json.dumps(body, separators=(",", ":"))


def _body_size_bytes(body: object) -> int:
    return len(_json_body(body).encode("utf-8"))

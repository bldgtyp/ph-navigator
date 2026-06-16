"""add rooms space type link

Revision ID: 20260616_0031
Revises: 20260616_0030
Create Date: 2026-06-16 17:10:00.000000
"""

from __future__ import annotations

import copy
import hashlib
import json
from collections.abc import MutableMapping, Sequence
from typing import cast

import sqlalchemy as sa

from alembic import op

revision: str = "20260616_0031"
down_revision: str | None = "20260616_0030"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

DRAFT_ETAG_SALT = "20260616_0031_add_rooms_space_type_link"
OLD_SCHEMA_VERSION = 6
NEW_SCHEMA_VERSION = 7
ROOM_SPACE_TYPE_FIELD_KEY = "space_type_id"
ROOM_SPACE_TYPE_INSERT_AFTER_FIELD_KEY = "building_zone"
ROOM_SPACE_TYPE_FIELD_DEF: dict[str, object] = {
    "field_key": ROOM_SPACE_TYPE_FIELD_KEY,
    "display_name": "Space Type",
    "field_type": "linked_record",
    "config": {"target_table_path": ["space_types"], "max_links": 1},
    "description": "Project-local Space-Type linked to this Room.",
    "default": None,
    "origin": "built_in",
    "created_at": "2026-05-26T00:00:00Z",
    "created_by": None,
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
    rooms = _as_mapping(tables.get("rooms"))
    if rooms is None:
        return False
    field_defs = rooms.get("field_defs")
    if not isinstance(field_defs, list):
        return False
    field_defs = cast(list[object], field_defs)

    changed = False
    if direction == "add":
        if body_mapping.get("schema_version") != NEW_SCHEMA_VERSION:
            body_mapping["schema_version"] = NEW_SCHEMA_VERSION
            changed = True
        if not any(_field_key(field) == ROOM_SPACE_TYPE_FIELD_KEY for field in field_defs):
            field_defs.insert(_field_insert_index(field_defs), copy.deepcopy(ROOM_SPACE_TYPE_FIELD_DEF))
            changed = True
        return changed
    if direction == "remove":
        if body_mapping.get("schema_version") != OLD_SCHEMA_VERSION:
            body_mapping["schema_version"] = OLD_SCHEMA_VERSION
            changed = True
        filtered = [field for field in field_defs if _field_key(field) != ROOM_SPACE_TYPE_FIELD_KEY]
        if len(filtered) != len(field_defs):
            rooms["field_defs"] = filtered
            changed = True
        rows = rooms.get("rows")
        if isinstance(rows, list):
            for row in rows:
                row_mapping = _as_mapping(row)
                if row_mapping is None:
                    continue
                custom_links = _as_mapping(row_mapping.get("custom_links"))
                if custom_links is not None and ROOM_SPACE_TYPE_FIELD_KEY in custom_links:
                    del custom_links[ROOM_SPACE_TYPE_FIELD_KEY]
                    changed = True
        return changed
    raise ValueError(f"Unsupported Rooms Space Type migration direction: {direction}")


def _field_key(field: object) -> str | None:
    field_mapping = _as_mapping(field)
    if field_mapping is None:
        return None
    value = field_mapping.get("field_key")
    return value if isinstance(value, str) else None


def _field_insert_index(field_defs: list[object]) -> int:
    for index, field in enumerate(field_defs):
        if _field_key(field) == ROOM_SPACE_TYPE_INSERT_AFTER_FIELD_KEY:
            return index + 1
    return len(field_defs)


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

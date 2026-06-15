"""convert heat pump indoor capacities to kw

Revision ID: 20260615_0027
Revises: 20260614_0026
Create Date: 2026-06-15 17:05:00.000000
"""

from __future__ import annotations

import copy
import hashlib
import json
from collections.abc import MutableMapping, Sequence
from typing import TypeGuard, cast

import sqlalchemy as sa

from alembic import op

revision: str = "20260615_0027"
down_revision: str | None = "20260614_0026"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

BTU_H_PER_KW = 3412.141633
BTU_H_MAGNITUDE_THRESHOLD = 100.0
CAPACITY_FIELDS = ("cooling_btuh", "heating_btuh_47f")
DRAFT_ETAG_SALT = "20260615_0027_heat_pump_indoor_capacity_kw"


def upgrade() -> None:
    conn = op.get_bind()
    version_etags = _convert_project_versions(conn, direction="to_kw")
    _convert_project_version_drafts(conn, version_etags, direction="to_kw")


def downgrade() -> None:
    conn = op.get_bind()
    version_etags = _convert_project_versions(conn, direction="to_btuh")
    _convert_project_version_drafts(conn, version_etags, direction="to_btuh")


def _convert_project_versions(conn: sa.Connection, *, direction: str) -> dict[str, str]:
    rows = conn.execute(sa.text("SELECT id, body FROM project_versions")).mappings()
    version_etags: dict[str, str] = {}
    for row in rows:
        body = copy.deepcopy(row["body"])
        changed = _convert_body(body, direction=direction)
        version_etag = _document_etag(body)
        version_etags[str(row["id"])] = version_etag
        if changed:
            conn.execute(
                sa.text(
                    """
                    UPDATE project_versions
                    SET body = CAST(:body AS jsonb),
                        body_size_bytes = :body_size_bytes
                    WHERE id = :id
                    """
                ),
                {
                    "id": row["id"],
                    "body": _json_body(body),
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
        if changed or base_version_etag != row["base_version_etag"]:
            conn.execute(
                sa.text(
                    """
                    UPDATE project_version_drafts
                    SET body = CAST(:body AS jsonb),
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
                    "base_version_etag": base_version_etag,
                    "draft_etag": draft_etag,
                },
            )


def _convert_body(body: object, *, direction: str) -> bool:
    indoor_rows = _indoor_equip_rows(body)
    if indoor_rows is None:
        return False

    changed = False
    for row in indoor_rows:
        row_mapping = _as_mapping(row)
        if row_mapping is None:
            continue
        for field in CAPACITY_FIELDS:
            value = row_mapping.get(field)
            if not _is_number(value):
                continue
            next_value = _convert_capacity(float(value), direction=direction)
            if next_value != value:
                row_mapping[field] = next_value
                changed = True
    return changed


def _indoor_equip_rows(body: object) -> list[object] | None:
    body_mapping = _as_mapping(body)
    if body_mapping is None:
        return None
    tables = _as_mapping(body_mapping.get("tables"))
    if tables is None:
        return None
    equipment = _as_mapping(tables.get("equipment"))
    if equipment is None:
        return None
    heat_pumps = _as_mapping(equipment.get("heat_pumps"))
    if heat_pumps is None:
        return None
    indoor_equip = heat_pumps.get("indoor_equip")
    if not isinstance(indoor_equip, list):
        return None
    return cast(list[object], indoor_equip)


def _as_mapping(value: object) -> MutableMapping[str, object] | None:
    if not isinstance(value, MutableMapping):
        return None
    return cast(MutableMapping[str, object], value)


def _convert_capacity(value: float, *, direction: str) -> float:
    if direction == "to_kw":
        if value < BTU_H_MAGNITUDE_THRESHOLD:
            return value
        return round(value / BTU_H_PER_KW, 4)
    if direction == "to_btuh":
        if value <= 0 or value >= BTU_H_MAGNITUDE_THRESHOLD:
            return value
        return round(value * BTU_H_PER_KW, 2)
    raise ValueError(f"Unsupported heat-pump capacity migration direction: {direction}")


def _is_number(value: object) -> TypeGuard[int | float]:
    return isinstance(value, int | float) and not isinstance(value, bool)


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

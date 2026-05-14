"""catalog materials rec ids

Rebadge ``catalog_materials.id`` from the TB-07 ``mat_<token>`` shape to the
AirTable ``rec`` + 14-char base62 shape so all three v1 catalogs share one
record-id format. Version ids stay V2-native (``matv_<token>``).

Revision ID: 20260514_0008
Revises: 20260514_0007
Create Date: 2026-05-14 14:00:00.000000
"""

from __future__ import annotations

import secrets
import string
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260514_0008"
down_revision: str | None = "20260514_0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_RECORD_ID_PREFIX = "rec"
_RECORD_ID_BODY_LENGTH = 14
_RECORD_ID_ALPHABET = string.ascii_letters + string.digits

# Default Postgres FK name for `catalog_material_versions.record_id` -> `catalog_materials.id`
# from migration 20260514_0007 (created via SQLAlchemy `ForeignKeyConstraint` without an
# explicit name, so Postgres generated `<table>_<column>_fkey`).
_VERSIONS_RECORD_FK = "catalog_material_versions_record_id_fkey"


def _new_record_id() -> str:
    body = "".join(secrets.choice(_RECORD_ID_ALPHABET) for _ in range(_RECORD_ID_BODY_LENGTH))
    return f"{_RECORD_ID_PREFIX}{body}"


def upgrade() -> None:
    connection = op.get_bind()
    rows = connection.execute(sa.text("SELECT id FROM catalog_materials")).fetchall()
    if not rows:
        return

    # Drop the FK so we can rewrite the parent PK and the dependent FK values
    # in lockstep. The other FK (catalog_materials.current_version_id ->
    # catalog_material_versions.id) targets the versions PK which is NOT
    # changing in this migration, so it can stay in place.
    op.drop_constraint(_VERSIONS_RECORD_FK, "catalog_material_versions", type_="foreignkey")

    for (old_id,) in rows:
        new_id = _new_record_id()
        connection.execute(
            sa.text("UPDATE catalog_materials SET id = :new_id WHERE id = :old_id"),
            {"new_id": new_id, "old_id": old_id},
        )
        connection.execute(
            sa.text("UPDATE catalog_material_versions SET record_id = :new_id WHERE record_id = :old_id"),
            {"new_id": new_id, "old_id": old_id},
        )

    op.create_foreign_key(
        _VERSIONS_RECORD_FK,
        "catalog_material_versions",
        "catalog_materials",
        ["record_id"],
        ["id"],
        ondelete="CASCADE",
    )


def downgrade() -> None:
    # No-op: regenerating the prior `mat_<token>` ids would not recover the
    # original opaque values (they are not stored). Existing rows keep their
    # ``rec``-format ids on downgrade.
    pass

"""audit fks set null and result asset index

Aligns the implicit-RESTRICT audit foreign keys created in 0011
(`project_assets.created_by`, `project_assets.deleted_by`,
`project_jobs.created_by`) with the explicit `ON DELETE SET NULL`
policy already used by `projects.deleted_by` (migration 0013) and the
audit FKs in 0003, 0004, 0007, 0009. The intent is "audit columns
never block a user-delete".

To make `ON DELETE SET NULL` actually fire when a user is hard-deleted,
the two `created_by` columns must also be made nullable: 0011 declared
both as `nullable=False`. `projects.created_by` (0003) is already
nullable to support the same SET NULL policy. The column drop is
mechanical and only affects future writes — existing rows always have
a non-null creator.

Also adds the missing index on `project_jobs.result_asset_id` so that
FK cascade lookups and "which job produced this asset?" queries do not
seq-scan `project_jobs`.

Revision ID: 20260609_0020
Revises: 20260607_0019
Create Date: 2026-06-09 14:00:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260609_0020"
down_revision: str | None = "20260607_0019"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


# (table, column, constraint_name). Constraint names follow the Postgres
# default `{table}_{column}_fkey` because 0011 declared them inline
# inside `create_table` without explicit names.
_AUDIT_FKS: tuple[tuple[str, str, str], ...] = (
    ("project_assets", "created_by", "project_assets_created_by_fkey"),
    ("project_assets", "deleted_by", "project_assets_deleted_by_fkey"),
    ("project_jobs", "created_by", "project_jobs_created_by_fkey"),
)

# Subset of `_AUDIT_FKS` whose underlying column was declared `nullable=False`
# in 0011. SET NULL cannot fire against a NOT NULL column, so relax those
# specific columns. `project_assets.deleted_by` is already nullable.
_AUDIT_COLUMNS_NEEDING_NULLABLE: tuple[tuple[str, str], ...] = (
    ("project_assets", "created_by"),
    ("project_jobs", "created_by"),
)


def upgrade() -> None:
    for table, column in _AUDIT_COLUMNS_NEEDING_NULLABLE:
        op.alter_column(table, column, existing_type=sa.Uuid(), nullable=True)

    for table, column, name in _AUDIT_FKS:
        op.drop_constraint(name, table, type_="foreignkey")
        op.create_foreign_key(
            name,
            table,
            "users",
            [column],
            ["id"],
            ondelete="SET NULL",
        )

    op.create_index(
        "ix_project_jobs_result_asset",
        "project_jobs",
        ["result_asset_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_project_jobs_result_asset", table_name="project_jobs")

    for table, column, name in _AUDIT_FKS:
        op.drop_constraint(name, table, type_="foreignkey")
        op.create_foreign_key(
            name,
            table,
            "users",
            [column],
            ["id"],
        )

    for table, column in _AUDIT_COLUMNS_NEEDING_NULLABLE:
        op.alter_column(table, column, existing_type=sa.Uuid(), nullable=False)

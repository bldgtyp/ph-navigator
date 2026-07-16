"""user_sidebar_views: per-user project-sidebar view-state

Backs the Apertures/Envelope sidebar-organization feature (sort mode, manual
order, groups, collapse) with a per-user × per-project × per-sidebar row. Mirrors
`user_table_views` exactly, keyed by `view_key` (the sidebar identity, e.g.
`apertures` / `assemblies`) instead of `table_key`. Payload is opaque JSONB owned
by the frontend sidebar contract; the backend only bounds size + schema version.

Revision ID: 20260716_0006
Revises: 20260705_0005
Create Date: 2026-07-16 09:00:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "20260716_0006"
down_revision: str | None = "20260705_0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE public.user_sidebar_views (
            user_id uuid NOT NULL,
            project_id uuid NOT NULL,
            view_key text NOT NULL,
            view_state_schema_version integer DEFAULT 1 NOT NULL,
            view_state jsonb NOT NULL,
            view_state_size_bytes integer NOT NULL,
            updated_at timestamp with time zone DEFAULT now() NOT NULL,
            CONSTRAINT ck_user_sidebar_views_schema_version_supported CHECK ((view_state_schema_version = 1)),
            CONSTRAINT ck_user_sidebar_views_size_bounded CHECK ((view_state_size_bytes <= 65536)),
            CONSTRAINT ck_user_sidebar_views_view_key_syntax CHECK ((view_key ~ '^[a-z][a-z0-9_]*$'::text))
        )
        """
    )
    op.execute(
        """
        ALTER TABLE ONLY public.user_sidebar_views
            ADD CONSTRAINT pk_user_sidebar_views PRIMARY KEY (user_id, project_id, view_key)
        """
    )
    op.execute(
        """
        ALTER TABLE ONLY public.user_sidebar_views
            ADD CONSTRAINT fk_user_sidebar_views_project
            FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE
        """
    )
    op.execute(
        """
        ALTER TABLE ONLY public.user_sidebar_views
            ADD CONSTRAINT fk_user_sidebar_views_user
            FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS public.user_sidebar_views")

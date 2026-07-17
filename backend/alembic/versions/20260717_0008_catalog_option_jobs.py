"""catalog option cascade jobs

Revision ID: 20260717_0008
Revises: 20260716_0007
Create Date: 2026-07-17 13:00:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "20260717_0008"
down_revision: str | None = "20260716_0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE public.catalog_option_jobs (
            id text PRIMARY KEY,
            catalog_table text NOT NULL,
            field_key text NOT NULL,
            status text DEFAULT 'pending' NOT NULL,
            progress integer DEFAULT 0 NOT NULL,
            created_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
            operations jsonb NOT NULL,
            total_projects integer DEFAULT 0 NOT NULL,
            processed_projects integer DEFAULT 0 NOT NULL,
            current_project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
            result jsonb DEFAULT '{}'::jsonb NOT NULL,
            error text,
            created_at timestamptz DEFAULT now() NOT NULL,
            started_at timestamptz,
            heartbeat_at timestamptz,
            finished_at timestamptz,
            CONSTRAINT ck_catalog_option_jobs_table
                CHECK (catalog_table IN ('frame_types', 'glazing_types')),
            CONSTRAINT ck_catalog_option_jobs_status
                CHECK (status IN ('pending', 'running', 'completed', 'failed')),
            CONSTRAINT ck_catalog_option_jobs_progress CHECK (progress BETWEEN 0 AND 100),
            CONSTRAINT ck_catalog_option_jobs_project_counts
                CHECK (total_projects >= 0 AND processed_projects >= 0)
        )
        """
    )
    op.execute(
        """
        CREATE UNIQUE INDEX uq_catalog_option_jobs_active_table
        ON public.catalog_option_jobs (catalog_table)
        WHERE status IN ('pending', 'running')
        """
    )
    op.execute(
        """
        CREATE TABLE public.catalog_option_job_projects (
            job_id text NOT NULL REFERENCES public.catalog_option_jobs(id) ON DELETE CASCADE,
            project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
            project_name text NOT NULL,
            status text DEFAULT 'pending' NOT NULL,
            refs_rewritten integer DEFAULT 0 NOT NULL,
            filters_rewritten integer DEFAULT 0 NOT NULL,
            drafts_rewritten integer DEFAULT 0 NOT NULL,
            version_created boolean DEFAULT false NOT NULL,
            error text,
            started_at timestamptz,
            finished_at timestamptz,
            PRIMARY KEY (job_id, project_id),
            CONSTRAINT ck_catalog_option_job_projects_status
                CHECK (status IN ('pending', 'running', 'completed', 'failed'))
        )
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS public.catalog_option_job_projects")
    op.execute("DROP TABLE IF EXISTS public.catalog_option_jobs")

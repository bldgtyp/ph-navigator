"""Persistence for global catalog option cascade jobs."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from psycopg import Connection
from psycopg.types.json import Jsonb

from features.catalogs.option_jobs_models import (
    CatalogOptionCascadeTotals,
    CatalogOptionJobStatus,
    CatalogOptionOperation,
    CatalogOptionProjectResult,
    CatalogOptionTable,
)

JOB_COLUMNS = """
    id, catalog_table, field_key, status, progress, created_by, operations,
    total_projects, processed_projects, current_project_id,
    result, error, created_at, started_at, heartbeat_at, finished_at
"""


def _with_project_results(conn: Connection[Any], row: dict[str, Any]) -> dict[str, Any]:
    results = conn.execute(
        """
        SELECT project_id, project_name, status, refs_rewritten,
               filters_rewritten, drafts_rewritten, version_created, error
        FROM catalog_option_job_projects
        WHERE job_id = %(job_id)s
        ORDER BY project_name, project_id
        """,
        {"job_id": row["id"]},
    ).fetchall()
    return {**row, "project_results": [dict(result) for result in results]}


def try_insert_job(
    conn: Connection[Any],
    *,
    job_id: str,
    catalog_table: CatalogOptionTable,
    field_key: str,
    created_by: UUID,
    operations: list[CatalogOptionOperation],
) -> dict[str, Any] | None:
    """Create a job only when its catalog has no unresolved predecessor."""

    row = conn.execute(
        f"""
        INSERT INTO catalog_option_jobs (
            id, catalog_table, field_key, created_by, operations, result
        )
        VALUES (
            %(id)s, %(catalog_table)s, %(field_key)s, %(created_by)s,
            %(operations)s, %(result)s
        )
        ON CONFLICT (catalog_table) WHERE status IN ('pending', 'running') DO NOTHING
        RETURNING {JOB_COLUMNS}
        """,
        {
            "id": job_id,
            "catalog_table": catalog_table,
            "field_key": field_key,
            "created_by": created_by,
            "operations": Jsonb([operation.model_dump(mode="json") for operation in operations]),
            "result": Jsonb(CatalogOptionCascadeTotals().model_dump(mode="json")),
        },
    ).fetchone()
    return _with_project_results(conn, dict(row)) if row else None


def get_job(conn: Connection[Any], job_id: str) -> dict[str, Any] | None:
    row = conn.execute(
        f"SELECT {JOB_COLUMNS} FROM catalog_option_jobs WHERE id = %(job_id)s",
        {"job_id": job_id},
    ).fetchone()
    return _with_project_results(conn, dict(row)) if row else None


def get_active_job(conn: Connection[Any], catalog_table: CatalogOptionTable) -> dict[str, Any] | None:
    row = conn.execute(
        f"""
        SELECT {JOB_COLUMNS}
        FROM catalog_option_jobs
        WHERE catalog_table = %(catalog_table)s
          AND status IN ('pending', 'running')
        ORDER BY created_at DESC
        LIMIT 1
        """,
        {"catalog_table": catalog_table},
    ).fetchone()
    return _with_project_results(conn, dict(row)) if row else None


def get_unresolved_job(conn: Connection[Any], catalog_table: CatalogOptionTable) -> dict[str, Any] | None:
    """A failed cascade remains exclusive until it is retried or explicitly resolved."""

    row = conn.execute(
        f"""
        SELECT {JOB_COLUMNS}
        FROM catalog_option_jobs
        WHERE catalog_table = %(catalog_table)s
          AND status IN ('pending', 'running', 'failed')
        ORDER BY created_at DESC
        LIMIT 1
        """,
        {"catalog_table": catalog_table},
    ).fetchone()
    return _with_project_results(conn, dict(row)) if row else None


def lock_catalog_option_edits(conn: Connection[Any], catalog_table: CatalogOptionTable) -> None:
    """Serialize one catalog's option writes around the no-active-job check."""

    conn.execute(
        "SELECT pg_advisory_xact_lock(hashtextextended(%(catalog_table)s, 0))",
        {"catalog_table": catalog_table},
    )


def claim_job(conn: Connection[Any], job_id: str) -> dict[str, Any] | None:
    """Atomically claim a job, recovering only an expired running lease."""

    row = conn.execute(
        f"""
        UPDATE catalog_option_jobs AS job
        SET status = 'running', current_project_id = NULL, error = NULL,
            started_at = COALESCE(job.started_at, now()), heartbeat_at = now(), finished_at = NULL
        WHERE job.id = %(job_id)s
          AND (
              job.status IN ('pending', 'failed')
              OR (job.status = 'running' AND job.heartbeat_at < now() - INTERVAL '5 minutes')
          )
          AND NOT EXISTS (
              SELECT 1
              FROM catalog_option_jobs AS other
              WHERE other.catalog_table = job.catalog_table
                AND other.id <> job.id
                AND other.status IN ('pending', 'running')
          )
        RETURNING {JOB_COLUMNS}
        """,
        {"job_id": job_id},
    ).fetchone()
    return _with_project_results(conn, dict(row)) if row else None


def reset_expired_project_claims(conn: Connection[Any], job_id: str) -> None:
    """Return work orphaned by an expired worker lease to the retry queue."""

    conn.execute(
        """
        UPDATE catalog_option_job_projects
        SET status = 'pending', started_at = NULL, finished_at = NULL, error = NULL
        WHERE job_id = %(job_id)s AND status = 'running'
        """,
        {"job_id": job_id},
    )


def recover_expired_job(conn: Connection[Any], job_id: str) -> dict[str, Any] | None:
    """Surface a dead in-process worker as retryable rather than blocking edits forever."""

    row = conn.execute(
        f"""
        UPDATE catalog_option_jobs
        SET status = 'failed', current_project_id = NULL, finished_at = now(),
            error = COALESCE(error, 'Catalog cascade worker lease expired; retry the job.')
        WHERE id = %(job_id)s
          AND status = 'running'
          AND heartbeat_at < now() - INTERVAL '5 minutes'
        RETURNING {JOB_COLUMNS}
        """,
        {"job_id": job_id},
    ).fetchone()
    return _with_project_results(conn, dict(row)) if row else None


def register_projects(conn: Connection[Any], job_id: str, projects: list[dict[str, Any]]) -> None:
    if projects:
        conn.execute(
            """
            INSERT INTO catalog_option_job_projects (job_id, project_id, project_name)
            SELECT %(job_id)s, projects.id, projects.name
            FROM jsonb_to_recordset(%(projects)s::jsonb) AS projects(id uuid, name text)
            ON CONFLICT (job_id, project_id) DO UPDATE
            SET project_name = EXCLUDED.project_name,
                status = CASE
                    WHEN catalog_option_job_projects.status = 'failed' THEN 'pending'
                    ELSE catalog_option_job_projects.status
                END,
                error = CASE
                    WHEN catalog_option_job_projects.status = 'failed' THEN NULL
                    ELSE catalog_option_job_projects.error
                END
            """,
            {
                "job_id": job_id,
                "projects": Jsonb([{"id": str(project["id"]), "name": project["name"]} for project in projects]),
            },
        )
    counts = project_counts(conn, job_id)
    conn.execute(
        """
        UPDATE catalog_option_jobs
        SET total_projects = %(total)s,
            processed_projects = %(processed)s,
            progress = %(progress)s
        WHERE id = %(job_id)s
        """,
        {"job_id": job_id, **counts},
    )


def claim_project(conn: Connection[Any], job_id: str, project_id: UUID) -> bool:
    row = conn.execute(
        """
        UPDATE catalog_option_job_projects
        SET status = 'running', started_at = now(), finished_at = NULL, error = NULL
        WHERE job_id = %(job_id)s AND project_id = %(project_id)s AND status = 'pending'
        RETURNING project_id
        """,
        {"job_id": job_id, "project_id": project_id},
    ).fetchone()
    if row is None:
        return False
    conn.execute(
        "UPDATE catalog_option_jobs SET current_project_id = %(project_id)s WHERE id = %(job_id)s",
        {"job_id": job_id, "project_id": project_id},
    )
    return True


def save_project_result(
    conn: Connection[Any],
    *,
    job_id: str,
    project_result: CatalogOptionProjectResult,
    totals: CatalogOptionCascadeTotals,
) -> None:
    conn.execute(
        """
        UPDATE catalog_option_job_projects
        SET status = %(status)s,
            refs_rewritten = %(refs_rewritten)s,
            filters_rewritten = %(filters_rewritten)s,
            drafts_rewritten = %(drafts_rewritten)s,
            version_created = %(version_created)s,
            error = %(error)s,
            finished_at = now()
        WHERE job_id = %(job_id)s AND project_id = %(project_id)s
        """,
        {"job_id": job_id, **project_result.model_dump(mode="python")},
    )
    conn.execute(
        """
        UPDATE catalog_option_jobs
        SET processed_projects = processed_projects + 1,
            progress = CASE
                WHEN total_projects = 0 THEN 100
                ELSE round((processed_projects + 1) * 100.0 / total_projects)::integer
            END,
            current_project_id = NULL,
            heartbeat_at = now(),
            result = %(result)s
        WHERE id = %(job_id)s
        """,
        {"job_id": job_id, "result": Jsonb(totals.model_dump(mode="json"))},
    )


def project_counts(conn: Connection[Any], job_id: str) -> dict[str, int]:
    row = conn.execute(
        """
        SELECT count(*) AS total,
               count(*) FILTER (WHERE status IN ('completed', 'failed')) AS processed
        FROM catalog_option_job_projects
        WHERE job_id = %(job_id)s
        """,
        {"job_id": job_id},
    ).fetchone()
    total = int(row["total"] if row else 0)
    processed = int(row["processed"] if row else 0)
    return {
        "total": total,
        "processed": processed,
        "progress": 100 if total == 0 else round(processed * 100 / total),
    }


def finish_job(
    conn: Connection[Any],
    *,
    job_id: str,
    status: CatalogOptionJobStatus,
    totals: CatalogOptionCascadeTotals,
    error: str | None = None,
) -> dict[str, Any]:
    row = conn.execute(
        f"""
        UPDATE catalog_option_jobs
        SET status = %(status)s, progress = 100, current_project_id = NULL,
            result = %(result)s, error = %(error)s, finished_at = now()
        WHERE id = %(job_id)s
        RETURNING {JOB_COLUMNS}
        """,
        {
            "job_id": job_id,
            "status": status,
            "result": Jsonb(totals.model_dump(mode="json")),
            "error": error,
        },
    ).fetchone()
    if row is None:
        raise LookupError("catalog_option_job_not_found")
    return _with_project_results(conn, dict(row))


def list_active_project_bodies(conn: Connection[Any]) -> list[dict[str, Any]]:
    """Return current project bodies plus drafts of each current active version.

    A catalog relabel is forward-only: historical saved versions and drafts
    attached to historical versions remain an accurate record of their point in
    time.  Only the active working surface participates in the cascade.
    """

    rows = conn.execute(
        """
        SELECT p.id, p.name, p.active_version_id, v.body
        FROM projects p
        JOIN project_versions v ON v.id = p.active_version_id
        WHERE p.deleted_at IS NULL
          AND NOT EXISTS (
              SELECT 1 FROM project_version_drafts d WHERE d.version_id = p.active_version_id
          )
        UNION ALL
        SELECT p.id, p.name, p.active_version_id, d.body
        FROM projects p
        JOIN project_version_drafts d ON d.version_id = p.active_version_id
        WHERE p.deleted_at IS NULL AND p.active_version_id IS NOT NULL
        ORDER BY id
        """
    ).fetchall()
    return [dict(row) for row in rows]


def get_project_for_update(conn: Connection[Any], project_id: UUID) -> dict[str, Any] | None:
    row = conn.execute(
        """
        SELECT id, name, active_version_id
        FROM projects
        WHERE id = %(project_id)s AND deleted_at IS NULL
        FOR UPDATE
        """,
        {"project_id": project_id},
    ).fetchone()
    return dict(row) if row else None


def list_active_version_drafts_for_update(
    conn: Connection[Any], project_id: UUID, active_version_id: UUID
) -> list[dict[str, Any]]:
    rows = conn.execute(
        """
        SELECT d.version_id, d.user_id, d.body, d.schema_version, d.draft_etag
        FROM project_version_drafts d
        WHERE d.version_id = %(active_version_id)s
          AND EXISTS (
              SELECT 1
              FROM projects p
              WHERE p.id = %(project_id)s AND p.active_version_id = d.version_id
          )
        ORDER BY d.user_id
        FOR UPDATE OF d
        """,
        {"project_id": project_id, "active_version_id": active_version_id},
    ).fetchall()
    return [dict(row) for row in rows]


def unique_version_name(conn: Connection[Any], project_id: UUID, base_name: str) -> str:
    names = {
        str(row["name"])
        for row in conn.execute(
            "SELECT name FROM project_versions WHERE project_id = %(project_id)s",
            {"project_id": project_id},
        ).fetchall()
    }
    if base_name not in names:
        return base_name
    suffix = 2
    while f"{base_name} ({suffix})" in names:
        suffix += 1
    return f"{base_name} ({suffix})"

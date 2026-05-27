"""Raw-SQL project repository functions."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from psycopg import Connection, sql
from psycopg.types.json import Jsonb

from features.project_document.document import ProjectDocumentV1
from features.projects.models import CreateProjectRequest, UpdateProjectRequest

PROJECT_COLUMNS = """
    id, name, bt_number, client, cert_programs, phius_number,
    phius_dropbox_url, active_version_id, last_saved_at,
    created_at, updated_at
"""

PROJECT_LIFECYCLE_COLUMNS = f"""
    {PROJECT_COLUMNS}, owner_id, deleted_at, deleted_by, hard_delete_after
"""


def list_projects_for_owner(conn: Connection[Any], owner_id: UUID) -> list[dict[str, Any]]:
    rows = conn.execute(
        """
        SELECT id, name, bt_number, client, cert_programs, phius_number,
               phius_dropbox_url, active_version_id, last_saved_at,
               created_at, updated_at
        FROM projects
        WHERE owner_id = %(owner_id)s
          AND deleted_at IS NULL
        ORDER BY bt_number DESC
        """,
        {"owner_id": owner_id},
    ).fetchall()
    return list(rows)


def get_project_by_id(conn: Connection[Any], project_id: UUID) -> dict[str, Any] | None:
    return conn.execute(
        """
        SELECT id, name, bt_number, client, cert_programs, phius_number,
               phius_dropbox_url, active_version_id, last_saved_at,
               created_at, updated_at
        FROM projects
        WHERE id = %(project_id)s
          AND deleted_at IS NULL
        """,
        {"project_id": project_id},
    ).fetchone()


def get_project_by_id_including_deleted(conn: Connection[Any], project_id: UUID) -> dict[str, Any] | None:
    return conn.execute(
        f"""
        SELECT {PROJECT_LIFECYCLE_COLUMNS}
        FROM projects
        WHERE id = %(project_id)s
        """,
        {"project_id": project_id},
    ).fetchone()


def get_project_detail_by_id(conn: Connection[Any], project_id: UUID) -> dict[str, Any] | None:
    return conn.execute(
        """
        SELECT projects.id, projects.name, projects.bt_number, projects.client,
               projects.cert_programs, projects.phius_number, projects.phius_dropbox_url,
               projects.active_version_id, projects.last_saved_at,
               projects.created_at, projects.updated_at,
               users.display_name AS owner_display_name
        FROM projects
        JOIN users ON users.id = projects.owner_id
        WHERE projects.id = %(project_id)s
          AND projects.deleted_at IS NULL
        """,
        {"project_id": project_id},
    ).fetchone()


def list_deleted_projects_for_owner(conn: Connection[Any], owner_id: UUID) -> list[dict[str, Any]]:
    rows = conn.execute(
        f"""
        SELECT {PROJECT_LIFECYCLE_COLUMNS}
        FROM projects
        WHERE owner_id = %(owner_id)s
          AND deleted_at IS NOT NULL
        ORDER BY deleted_at DESC, bt_number DESC
        """,
        {"owner_id": owner_id},
    ).fetchall()
    return list(rows)


def get_project_by_bt_number(conn: Connection[Any], bt_number: str) -> dict[str, Any] | None:
    return conn.execute(
        """
        SELECT id, name
        FROM projects
        WHERE bt_number = %(bt_number)s
        """,
        {"bt_number": bt_number},
    ).fetchone()


def count_project_children(conn: Connection[Any], project_id: UUID) -> dict[str, int]:
    row = conn.execute(
        """
        SELECT
            (SELECT count(*) FROM project_versions WHERE project_id = %(project_id)s) AS versions,
            (
                SELECT count(*)
                FROM project_version_drafts drafts
                JOIN project_versions versions ON versions.id = drafts.version_id
                WHERE versions.project_id = %(project_id)s
            ) AS drafts,
            (SELECT count(*) FROM project_status_items WHERE project_id = %(project_id)s) AS status_items,
            (SELECT count(*) FROM project_assets WHERE project_id = %(project_id)s) AS assets,
            (SELECT count(*) FROM project_jobs WHERE project_id = %(project_id)s) AS jobs,
            (SELECT count(*) FROM mcp_tokens WHERE project_id = %(project_id)s) AS mcp_tokens,
            (SELECT count(*) FROM user_table_views WHERE project_id = %(project_id)s) AS table_views
        """,
        {"project_id": project_id},
    ).fetchone()
    if row is None:
        return {
            "versions": 0,
            "drafts": 0,
            "status_items": 0,
            "assets": 0,
            "jobs": 0,
            "mcp_tokens": 0,
            "table_views": 0,
        }
    return {key: int(row[key] or 0) for key in row.keys()}


def list_project_storage_manifest(conn: Connection[Any], project_id: UUID) -> dict[str, Any]:
    assets = conn.execute(
        """
        SELECT id, object_key, metadata
        FROM project_assets
        WHERE project_id = %(project_id)s
        ORDER BY created_at ASC
        """,
        {"project_id": project_id},
    ).fetchall()
    jobs = conn.execute(
        """
        SELECT id, result_asset_id
        FROM project_jobs
        WHERE project_id = %(project_id)s
        ORDER BY created_at ASC
        """,
        {"project_id": project_id},
    ).fetchall()
    versions = conn.execute(
        """
        SELECT id
        FROM project_versions
        WHERE project_id = %(project_id)s
        ORDER BY created_at ASC
        """,
        {"project_id": project_id},
    ).fetchall()
    object_keys: list[str] = []
    for asset in assets:
        object_key = asset["object_key"]
        if isinstance(object_key, str):
            object_keys.append(object_key)
        metadata = asset["metadata"] if isinstance(asset["metadata"], dict) else {}
        thumbnail_key = metadata.get("thumbnail_object_key")
        if isinstance(thumbnail_key, str):
            object_keys.append(thumbnail_key)
    return {
        "asset_ids": [str(row["id"]) for row in assets],
        "object_keys": object_keys,
        "job_ids": [str(row["id"]) for row in jobs],
        "result_asset_ids": [str(row["result_asset_id"]) for row in jobs if row["result_asset_id"] is not None],
        "version_ids": [str(row["id"]) for row in versions],
    }


def soft_delete_project(conn: Connection[Any], project_id: UUID, deleted_by: UUID | None) -> dict[str, Any] | None:
    return conn.execute(
        f"""
        UPDATE projects
        SET deleted_at = COALESCE(deleted_at, now()),
            deleted_by = COALESCE(deleted_by, %(deleted_by)s),
            hard_delete_after = COALESCE(hard_delete_after, now() + interval '90 days'),
            updated_at = now()
        WHERE id = %(project_id)s
        RETURNING {PROJECT_LIFECYCLE_COLUMNS}
        """,
        {"project_id": project_id, "deleted_by": deleted_by},
    ).fetchone()


def restore_project(conn: Connection[Any], project_id: UUID) -> dict[str, Any] | None:
    return conn.execute(
        f"""
        UPDATE projects
        SET deleted_at = NULL,
            deleted_by = NULL,
            hard_delete_after = NULL,
            updated_at = now()
        WHERE id = %(project_id)s
          AND deleted_at IS NOT NULL
          AND (hard_delete_after IS NULL OR hard_delete_after > now())
        RETURNING {PROJECT_COLUMNS}
        """,
        {"project_id": project_id},
    ).fetchone()


def hard_delete_project_rows(conn: Connection[Any], project_id: UUID) -> bool:
    conn.execute("DELETE FROM project_jobs WHERE project_id = %(project_id)s", {"project_id": project_id})
    conn.execute("DELETE FROM project_assets WHERE project_id = %(project_id)s", {"project_id": project_id})
    conn.execute("DELETE FROM mcp_tokens WHERE project_id = %(project_id)s", {"project_id": project_id})
    conn.execute("DELETE FROM user_table_views WHERE project_id = %(project_id)s", {"project_id": project_id})
    conn.execute("DELETE FROM project_status_items WHERE project_id = %(project_id)s", {"project_id": project_id})
    conn.execute(
        """
        DELETE FROM project_version_drafts
        WHERE version_id IN (
            SELECT id
            FROM project_versions
            WHERE project_id = %(project_id)s
        )
        """,
        {"project_id": project_id},
    )
    conn.execute("UPDATE projects SET active_version_id = NULL WHERE id = %(project_id)s", {"project_id": project_id})
    conn.execute("DELETE FROM project_versions WHERE project_id = %(project_id)s", {"project_id": project_id})
    row = conn.execute(
        "DELETE FROM projects WHERE id = %(project_id)s RETURNING id",
        {"project_id": project_id},
    ).fetchone()
    return row is not None


def list_versions_for_project(conn: Connection[Any], project_id: UUID) -> list[dict[str, Any]]:
    rows = conn.execute(
        """
        SELECT id, project_id, name, kind, locked, schema_version,
               body_size_bytes, created_at, updated_at
        FROM project_versions
        WHERE project_id = %(project_id)s
        ORDER BY created_at DESC
        """,
        {"project_id": project_id},
    ).fetchall()
    return list(rows)


def insert_project_with_initial_version(
    conn: Connection[Any],
    payload: CreateProjectRequest,
    owner_id: UUID,
    body: ProjectDocumentV1,
    body_size_bytes: int,
) -> dict[str, Any]:
    project = conn.execute(
        """
        INSERT INTO projects (
            name, bt_number, client, cert_programs, phius_number,
            phius_dropbox_url, owner_id
        )
        VALUES (
            %(name)s, %(bt_number)s, %(client)s, %(cert_programs)s,
            %(phius_number)s, %(phius_dropbox_url)s, %(owner_id)s
        )
        RETURNING id, name, bt_number, client, cert_programs, phius_number,
                  phius_dropbox_url, active_version_id, last_saved_at,
                  created_at, updated_at
        """,
        {
            "name": payload.name,
            "bt_number": payload.bt_number,
            "client": payload.client,
            "cert_programs": payload.cert_programs,
            "phius_number": payload.phius_number,
            "phius_dropbox_url": payload.phius_dropbox_url,
            "owner_id": owner_id,
        },
    ).fetchone()
    if project is None:
        raise RuntimeError("Project insert did not return a row.")

    version = conn.execute(
        """
        INSERT INTO project_versions (
            project_id, name, kind, locked, body, schema_version,
            body_size_bytes, created_by, updated_by
        )
        VALUES (
            %(project_id)s, 'Working', 'working', false, %(body)s,
            %(schema_version)s, %(body_size_bytes)s, %(user_id)s, %(user_id)s
        )
        RETURNING id
        """,
        {
            "project_id": project["id"],
            "body": Jsonb(body.model_dump(mode="json")),
            "schema_version": body.schema_version,
            "body_size_bytes": body_size_bytes,
            "user_id": owner_id,
        },
    ).fetchone()
    if version is None:
        raise RuntimeError("Initial project version insert did not return a row.")

    updated_project = conn.execute(
        """
        UPDATE projects
        SET active_version_id = %(active_version_id)s,
            last_saved_at = now(),
            updated_at = now()
        WHERE id = %(project_id)s
        RETURNING id, name, bt_number, client, cert_programs, phius_number,
                  phius_dropbox_url, active_version_id, last_saved_at,
                  created_at, updated_at
        """,
        {"project_id": project["id"], "active_version_id": version["id"]},
    ).fetchone()
    if updated_project is None:
        raise RuntimeError("Project active-version update did not return a row.")
    return updated_project


def update_project_metadata(
    conn: Connection[Any],
    project_id: UUID,
    payload: UpdateProjectRequest,
    changed_fields: set[str],
) -> dict[str, Any] | None:
    values = payload.model_dump(exclude_unset=True)
    params = {"project_id": project_id, **{field: values[field] for field in changed_fields}}
    assignments = sql.SQL(", ").join(
        sql.SQL("{} = {}").format(sql.Identifier(field), sql.Placeholder(field)) for field in sorted(changed_fields)
    )
    return conn.execute(
        sql.SQL(
            """
            UPDATE projects
            SET {assignments},
                updated_at = now()
            WHERE id = %(project_id)s
              AND deleted_at IS NULL
            RETURNING id, name, bt_number, client, cert_programs, phius_number,
                      phius_dropbox_url, active_version_id, last_saved_at,
                      created_at, updated_at,
                      (
                          SELECT users.display_name
                          FROM users
                          WHERE users.id = projects.owner_id
                      ) AS owner_display_name
            """
        ).format(assignments=assignments),
        params,
    ).fetchone()

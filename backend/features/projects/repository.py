"""Raw-SQL project repository functions."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from psycopg import Connection, sql
from psycopg.types.json import Jsonb

from features.project_document.document import ProjectDocumentV1
from features.projects.models import CreateProjectRequest, UpdateProjectRequest


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


def get_project_by_bt_number(conn: Connection[Any], bt_number: str) -> dict[str, Any] | None:
    return conn.execute(
        """
        SELECT id, name
        FROM projects
        WHERE bt_number = %(bt_number)s
        """,
        {"bt_number": bt_number},
    ).fetchone()


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

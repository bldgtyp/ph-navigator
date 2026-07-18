"""Create a repeatable local browser fixture for agent UI checks."""

from __future__ import annotations

import argparse
from dataclasses import dataclass
from typing import Any, cast
from urllib.parse import quote
from uuid import UUID

from psycopg import Connection
from psycopg.types.json import Jsonb

from database import transaction
from features.access import repository as access_repository
from features.auth import repository as auth_repository
from features.auth.passwords import verify_password
from features.auth.service import create_or_update_user
from features.project_document import repository as document_repository
from features.project_document.document import ProjectDocumentV1, RoomRow, RoomsTableEnvelope
from features.project_document.templates import empty_project_document
from features.project_document.validation import body_size_bytes, document_etag, next_draft_etag, validate_document
from features.projects.models import CreateProjectRequest
from features.projects.repository import insert_project_with_initial_version
from scripts._seed_paths import assert_local_dev_database

DEFAULT_EMAIL = "codex@example.com"
DEFAULT_DISPLAY_NAME = "Codex Agent"
DEFAULT_PASSWORD = "password"
DEFAULT_BT_NUMBER = "AGENT-BROWSER"
DEFAULT_PROJECT_NAME = "Agent Browser Fixture"
DEFAULT_FRONTEND_URL = "http://localhost:5173"

# Global capabilities the browser fixture user needs so agent sweeps (catalog
# editing, /admin/users states) work hermetically — no hand-run
# manage_user_access step, and grants survive a DB reset via re-seed.
FIXTURE_GLOBAL_CAPABILITIES = ("catalog.edit", "admin.users.manage")


@dataclass(frozen=True)
class AgentBrowserFixture:
    email: str
    password: str
    project_id: UUID
    version_id: UUID
    bt_number: str
    route: str
    sign_in_route: str
    draft_etag: str


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed the local Codex browser-test project and dirty draft.")
    parser.add_argument("--email", default=DEFAULT_EMAIL)
    parser.add_argument("--display-name", default=DEFAULT_DISPLAY_NAME)
    parser.add_argument("--password", default=DEFAULT_PASSWORD)
    parser.add_argument("--bt-number", default=DEFAULT_BT_NUMBER)
    parser.add_argument("--project-name", default=DEFAULT_PROJECT_NAME)
    parser.add_argument("--frontend-url", default=DEFAULT_FRONTEND_URL)
    args = parser.parse_args()

    fixture = seed_agent_browser_fixture(
        email=args.email,
        display_name=args.display_name,
        password=args.password,
        bt_number=args.bt_number,
        project_name=args.project_name,
        frontend_url=args.frontend_url.rstrip("/"),
    )

    print("Seeded local agent browser fixture:")
    print(f"  login: {fixture.email} / {fixture.password}")
    print(f"  project: {fixture.bt_number} ({fixture.project_id})")
    print(f"  version: {fixture.version_id}")
    print(f"  dirty draft etag: {fixture.draft_etag}")
    print(f"  sign-in route: {fixture.sign_in_route}")
    print(f"  direct route: {fixture.route}")


def seed_agent_browser_fixture(
    *,
    email: str = DEFAULT_EMAIL,
    display_name: str = DEFAULT_DISPLAY_NAME,
    password: str = DEFAULT_PASSWORD,
    bt_number: str = DEFAULT_BT_NUMBER,
    project_name: str = DEFAULT_PROJECT_NAME,
    frontend_url: str = DEFAULT_FRONTEND_URL,
) -> AgentBrowserFixture:
    """Seed or repair a local Codex-owned project with a visible dirty draft."""

    assert_local_dev_database()

    user = create_or_update_user(email=email, display_name=display_name, password=password)
    payload = CreateProjectRequest(
        name=project_name,
        bt_number=bt_number,
        client="Codex",
        cert_programs=["phi"],
        phius_number=None,
        phius_dropbox_url=None,
    )
    saved_body = empty_project_document(payload)
    draft_body = _dirty_rooms_draft(saved_body)
    base_version_etag = document_etag(saved_body)

    with transaction() as conn:
        _ensure_fixture_grants(conn, user.id)
        project = _upsert_fixture_project(conn, payload, user.id, saved_body)
        version_id = project["active_version_id"]
        draft_etag = document_repository.upsert_draft(
            conn,
            version_id,
            user.id,
            draft_body,
            base_version_etag,
            next_draft_etag(draft_body),
            updated_via="browser",
        )

    path = f"/projects/{project['id']}/apertures"
    route = f"{frontend_url}{path}"
    return AgentBrowserFixture(
        email=email,
        password=password,
        project_id=project["id"],
        version_id=version_id,
        bt_number=bt_number,
        route=route,
        sign_in_route=f"{frontend_url}/sign-in?next={quote(path, safe='')}",
        draft_etag=draft_etag,
    )


def ensure_agent_browser_fixture(
    *,
    email: str = DEFAULT_EMAIL,
    display_name: str = DEFAULT_DISPLAY_NAME,
    password: str = DEFAULT_PASSWORD,
    bt_number: str = DEFAULT_BT_NUMBER,
    project_name: str = DEFAULT_PROJECT_NAME,
    frontend_url: str = DEFAULT_FRONTEND_URL,
) -> tuple[AgentBrowserFixture, bool]:
    """Reuse a healthy fixture, repairing it only when required."""

    assert_local_dev_database()
    existing = _ready_fixture(
        email=email,
        password=password,
        bt_number=bt_number,
        frontend_url=frontend_url,
    )
    if existing is not None:
        return existing, False
    return (
        seed_agent_browser_fixture(
            email=email,
            display_name=display_name,
            password=password,
            bt_number=bt_number,
            project_name=project_name,
            frontend_url=frontend_url,
        ),
        True,
    )


def _ready_fixture(
    *,
    email: str,
    password: str,
    bt_number: str,
    frontend_url: str,
) -> AgentBrowserFixture | None:
    with transaction() as conn:
        user = auth_repository.get_user_by_email(conn, email)
        if user is None or not user["is_active"]:
            return None
        password_hash = user.get("password_hash")
        if not isinstance(password_hash, str) or not verify_password(password, password_hash):
            return None
        _ensure_fixture_grants(conn, user["id"])

        project = conn.execute(
            """
            SELECT p.id, p.active_version_id
            FROM projects AS p
            JOIN project_versions AS v ON v.id = p.active_version_id
            WHERE p.bt_number = %(bt_number)s
              AND p.owner_id = %(user_id)s
              AND p.deleted_at IS NULL
              AND v.kind = 'working'
              AND v.locked = false
            """,
            {"bt_number": bt_number, "user_id": user["id"]},
        ).fetchone()
        if project is None or project["active_version_id"] is None:
            return None

        draft = document_repository.get_draft(conn, project["active_version_id"], user["id"])
        if draft is None or not _has_seeded_dirty_room(draft["body"]):
            return None

    path = f"/projects/{project['id']}/apertures"
    normalized_frontend_url = frontend_url.rstrip("/")
    return AgentBrowserFixture(
        email=email,
        password=password,
        project_id=project["id"],
        version_id=project["active_version_id"],
        bt_number=bt_number,
        route=f"{normalized_frontend_url}{path}",
        sign_in_route=f"{normalized_frontend_url}/sign-in?next={quote(path, safe='')}",
        draft_etag=str(draft["draft_etag"]),
    )


def _ensure_fixture_grants(conn: Connection[Any], user_id: UUID) -> None:
    for capability in FIXTURE_GLOBAL_CAPABILITIES:
        access_repository.ensure_global_grant(conn, user_id=user_id, capability=capability, granted_by=None)


def _has_seeded_dirty_room(body: object) -> bool:
    if not isinstance(body, dict):
        return False
    body_dict = cast(dict[str, Any], body)
    tables = body_dict.get("tables")
    if not isinstance(tables, dict):
        return False
    rooms = tables.get("rooms")
    if not isinstance(rooms, dict):
        return False
    rows = rooms.get("rows")
    return isinstance(rows, list) and any(isinstance(row, dict) and row.get("id") == "rm_agent_browser" for row in rows)


def _dirty_rooms_draft(saved_body: ProjectDocumentV1) -> ProjectDocumentV1:
    rooms = RoomsTableEnvelope(
        field_defs=list(saved_body.tables.rooms.field_defs),
        rows=[
            RoomRow(
                id="rm_agent_browser",
                floor_level=None,
                building_zone=None,
                icfa_factor=1.0,
                catalog_origin=None,
                notes="Seeded dirty draft for local browser verification.",
                custom_values={
                    "number": "101",
                    "name": "Agent Browser Room",
                    "num_people": 1,
                    "num_bedrooms": 0,
                },
            )
        ],
    )
    return validate_document(
        saved_body.model_copy(update={"tables": saved_body.tables.model_copy(update={"rooms": rooms})}).model_dump(
            mode="json"
        )
    )


def _upsert_fixture_project(
    conn: Connection[Any],
    payload: CreateProjectRequest,
    user_id: UUID,
    saved_body: ProjectDocumentV1,
) -> dict[str, Any]:
    existing = conn.execute(
        """
        SELECT id, active_version_id
        FROM projects
        WHERE bt_number = %(bt_number)s
        """,
        {"bt_number": payload.bt_number},
    ).fetchone()
    if existing is None:
        return insert_project_with_initial_version(conn, payload, user_id, saved_body, body_size_bytes(saved_body))

    project = conn.execute(
        """
        UPDATE projects
        SET name = %(name)s,
            client = %(client)s,
            cert_programs = %(cert_programs)s,
            phius_number = %(phius_number)s,
            phius_dropbox_url = %(phius_dropbox_url)s,
            owner_id = %(owner_id)s,
            deleted_at = NULL,
            deleted_by = NULL,
            hard_delete_after = NULL,
            updated_at = now()
        WHERE id = %(project_id)s
        RETURNING id, name, bt_number, client, cert_programs, phius_number,
                  phius_dropbox_url, active_version_id, last_saved_at,
                  created_at, updated_at
        """,
        {
            "project_id": existing["id"],
            "name": payload.name,
            "client": payload.client,
            "cert_programs": payload.cert_programs,
            "phius_number": payload.phius_number,
            "phius_dropbox_url": payload.phius_dropbox_url,
            "owner_id": user_id,
        },
    ).fetchone()
    if project is None:
        raise RuntimeError("Fixture project update did not return a row.")

    version_id = project["active_version_id"]
    if version_id is None:
        return _insert_missing_working_version(conn, project["id"], user_id, saved_body)

    _reset_working_version(conn, project["id"], version_id, user_id, saved_body)
    return project


def _insert_missing_working_version(
    conn: Connection[Any],
    project_id: UUID,
    user_id: UUID,
    saved_body: ProjectDocumentV1,
) -> dict[str, Any]:
    version = conn.execute(
        """
        SELECT id
        FROM project_versions
        WHERE project_id = %(project_id)s
          AND name = 'Working'
        ORDER BY created_at ASC
        LIMIT 1
        """,
        {"project_id": project_id},
    ).fetchone()
    if version is not None:
        _reset_working_version(conn, project_id, version["id"], user_id, saved_body)
    else:
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
                "project_id": project_id,
                "body": Jsonb(saved_body.model_dump(mode="json")),
                "schema_version": saved_body.schema_version,
                "body_size_bytes": body_size_bytes(saved_body),
                "user_id": user_id,
            },
        ).fetchone()
    if version is None:
        raise RuntimeError("Fixture working version insert did not return a row.")
    project = conn.execute(
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
        {"project_id": project_id, "active_version_id": version["id"]},
    ).fetchone()
    if project is None:
        raise RuntimeError("Fixture project active-version repair did not return a row.")
    return project


def _reset_working_version(
    conn: Connection[Any],
    project_id: UUID,
    version_id: UUID,
    user_id: UUID,
    saved_body: ProjectDocumentV1,
) -> None:
    row = conn.execute(
        """
        UPDATE project_versions
        SET name = 'Working',
            kind = 'working',
            locked = false,
            body = %(body)s,
            schema_version = %(schema_version)s,
            body_size_bytes = %(body_size_bytes)s,
            updated_by = %(user_id)s,
            updated_at = now()
        WHERE project_id = %(project_id)s
          AND id = %(version_id)s
        RETURNING id
        """,
        {
            "project_id": project_id,
            "version_id": version_id,
            "user_id": user_id,
            "body": Jsonb(saved_body.model_dump(mode="json")),
            "schema_version": saved_body.schema_version,
            "body_size_bytes": body_size_bytes(saved_body),
        },
    ).fetchone()
    if row is None:
        raise RuntimeError("Fixture active version update did not return a row.")


if __name__ == "__main__":
    main()

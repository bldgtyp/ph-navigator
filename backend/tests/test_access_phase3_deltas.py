"""Phase-3 backend beta deltas — the observable access changes.

Locks the three deltas the capability model introduces over today's behavior:
metadata redaction for `client` viewers, export-route gating, and the catalog
write grant. See planning/archive/dated/2026-06-27/access-capability-model/PLAN.md §Phase 3.
"""

from __future__ import annotations

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from database import transaction
from features.access import repository as access_repository
from features.access.capabilities import ADMIN_USERS_MANAGE, CATALOG_EDIT
from features.auth import repository as auth_repository
from features.auth.models import UserPublic
from features.auth.service import create_or_update_user
from main import app

ORIGIN = "http://localhost:5173"


@pytest.fixture()
def clean_tables() -> Iterator[None]:
    statement = """
        TRUNCATE catalog_materials, user_action_log, sessions,
                 project_version_drafts, project_versions, project_location, projects, users
        RESTART IDENTITY CASCADE
    """
    with transaction() as conn:
        conn.execute(statement)
    yield
    with transaction() as conn:
        conn.execute(statement)


def _sign_in(email: str = "ed@example.com") -> tuple[TestClient, UserPublic]:
    user = create_or_update_user(email=email, display_name="Ed May", password="password")
    client = TestClient(app)
    resp = client.post(
        "/api/v1/auth/login",
        headers={"Origin": ORIGIN},
        json={"email": email, "password": "password"},
    )
    assert resp.status_code == 200
    return client, user


def _create_project(client: TestClient) -> dict[str, object]:
    resp = client.post(
        "/api/v1/projects",
        headers={"Origin": ORIGIN},
        json={
            "name": "West Stockbridge House",
            "bt_number": "2426",
            "client": "May",
            "cert_programs": ["phius"],
            "phius_number": "PH-123",
            "phius_dropbox_url": "https://dropbox.example/internal",
        },
    )
    assert resp.status_code == 201
    return resp.json()


# --- metadata redaction (ledger §4.9) --------------------------------------


def test_anonymous_viewer_gets_redacted_project_metadata(clean_tables: None) -> None:
    editor, _ = _sign_in()
    project = _create_project(editor)

    anon = TestClient(app)
    detail = anon.get(f"/api/v1/projects/{project['id']}")
    assert detail.status_code == 200
    body = detail.json()
    assert body["access_mode"] == "viewer"
    # Redacted from a `client` viewer …
    assert body["client"] is None
    assert body["phius_dropbox_url"] is None
    # … but the public fields remain.
    assert body["phius_number"] == "PH-123"
    assert body["name"] == "West Stockbridge House"
    assert body["bt_number"] == "2426"


def test_editor_sees_full_project_metadata(clean_tables: None) -> None:
    editor, _ = _sign_in()
    project = _create_project(editor)

    detail = editor.get(f"/api/v1/projects/{project['id']}")
    body = detail.json()
    assert body["access_mode"] == "editor"
    assert body["client"] == "May"
    assert body["phius_dropbox_url"] == "https://dropbox.example/internal"


# --- export gating (CP-4 / CP-7) -------------------------------------------


def test_anonymous_cannot_reach_bulk_exports(clean_tables: None) -> None:
    """Coverage guard: every project bulk-export/download route rejects an
    anonymous `client` (401) while not blocking the editor. A new export route
    that forgets its `require_capability` gate fails this test."""
    editor, _ = _sign_in()
    project = _create_project(editor)
    pid, vid = project["id"], project["active_version_id"]
    base = f"/api/v1/projects/{pid}/versions/{vid}"

    get_routes = [
        f"{base}/apertures/hbjson",
        f"{base}/envelope/export/hbjson",
        f"{base}/envelope/export/phpp",
        f"{base}/envelope/export/phpp/preflight",
        f"{base}/download",
        f"{base}/download/tables/rooms",
    ]
    anon = TestClient(app)
    for url in get_routes:
        assert anon.get(url).status_code == 401, url
        assert editor.get(url).status_code != 401, url

    # POST carries an Origin header so the CSRF guard passes and the request
    # reaches the capability gate (the thing under test).
    phius = f"/api/v1/projects/{pid}/equipment/heat-pumps/export-phius"
    assert anon.post(phius, headers={"Origin": ORIGIN}).status_code == 401
    assert editor.post(phius, headers={"Origin": ORIGIN}).status_code != 401


# --- catalog write grant (D7) ----------------------------------------------


def _material_payload() -> dict[str, object]:
    return {"name": "XPS Insulation", "category": "insulation", "conductivity_w_mk": 0.033}


def test_member_without_catalog_edit_is_forbidden(clean_tables: None) -> None:
    member, _ = _sign_in()
    resp = member.post("/api/v1/catalogs/materials", headers={"Origin": ORIGIN}, json=_material_payload())
    assert resp.status_code == 403


def test_member_with_catalog_edit_grant_can_write(clean_tables: None) -> None:
    member, user = _sign_in()
    with transaction() as conn:
        access_repository.insert_grant(
            conn,
            user_id=user.id,
            capability=CATALOG_EDIT,
            scope_type="global",
            scope_id=None,
            granted_by=None,
        )
    resp = member.post("/api/v1/catalogs/materials", headers={"Origin": ORIGIN}, json=_material_payload())
    assert resp.status_code == 201


def test_admin_preset_can_write_catalog(clean_tables: None) -> None:
    member, user = _sign_in()
    with transaction() as conn:
        access_repository.insert_grant(
            conn,
            user_id=user.id,
            capability=ADMIN_USERS_MANAGE,
            scope_type="global",
            scope_id=None,
            granted_by=None,
        )
    resp = member.post("/api/v1/catalogs/materials", headers={"Origin": ORIGIN}, json=_material_payload())
    assert resp.status_code == 201


def test_staff_member_can_write_catalog(clean_tables: None) -> None:
    member, user = _sign_in()
    with transaction() as conn:
        auth_repository.set_user_is_staff(conn, user.id, True)
    resp = member.post("/api/v1/catalogs/materials", headers={"Origin": ORIGIN}, json=_material_payload())
    assert resp.status_code == 201

"""Project public-alias behaviour.

`public_alias` is a user-settable public-facing title. Display resolution is
`display_name = public_alias ?? name` (server-computed, shown to everyone), and
once an alias is set the internal `name` is itself redacted to the alias for
`client` (anonymous) viewers — so the real name never reaches them, including
via API/MCP client tokens. With no alias set, the real name flows through
(opt-in privacy). See planning/features/project-public-alias/PRD.md.
"""

from __future__ import annotations

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from database import transaction
from features.auth.service import create_or_update_user
from main import app

ORIGIN = "http://localhost:5173"


@pytest.fixture()
def clean_tables() -> Iterator[None]:
    statement = """
        TRUNCATE user_action_log, sessions, project_version_drafts,
                 project_versions, project_location, projects, users
        RESTART IDENTITY CASCADE
    """
    with transaction() as conn:
        conn.execute(statement)
    yield
    with transaction() as conn:
        conn.execute(statement)


def _sign_in() -> TestClient:
    create_or_update_user(email="ed@example.com", display_name="Ed May", password="password")
    client = TestClient(app)
    resp = client.post(
        "/api/v1/auth/login",
        headers={"Origin": ORIGIN},
        json={"email": "ed@example.com", "password": "password"},
    )
    assert resp.status_code == 200
    return client


def _create_project(client: TestClient) -> dict[str, object]:
    resp = client.post(
        "/api/v1/projects",
        headers={"Origin": ORIGIN},
        json={"name": "Ayers Home", "bt_number": "2613", "cert_programs": ["phius"]},
    )
    assert resp.status_code == 201
    return resp.json()


def _set_alias(client: TestClient, project_id: str, alias: str | None) -> dict[str, object]:
    resp = client.patch(
        f"/api/v1/projects/{project_id}",
        headers={"Origin": ORIGIN},
        json={"public_alias": alias},
    )
    assert resp.status_code == 200
    return resp.json()


def test_new_project_has_null_alias_and_display_name_falls_back_to_name(clean_tables: None) -> None:
    editor = _sign_in()
    project = _create_project(editor)
    assert project["public_alias"] is None
    assert project["name"] == "Ayers Home"
    assert project["display_name"] == "Ayers Home"


def test_editor_keeps_real_name_but_display_name_uses_alias(clean_tables: None) -> None:
    editor = _sign_in()
    project = _create_project(editor)
    updated = _set_alias(editor, str(project["id"]), "Manhattan Townhouse")
    # The editor still sees the internal name they know the project by …
    assert updated["name"] == "Ayers Home"
    assert updated["public_alias"] == "Manhattan Townhouse"
    # … but every title site renders the alias via display_name.
    assert updated["display_name"] == "Manhattan Townhouse"


def test_anonymous_viewer_with_alias_never_receives_the_real_name(clean_tables: None) -> None:
    editor = _sign_in()
    project = _create_project(editor)
    _set_alias(editor, str(project["id"]), "Manhattan Townhouse")

    anon = TestClient(app)
    detail = anon.get(f"/api/v1/projects/{project['id']}")
    assert detail.status_code == 200
    body = detail.json()
    assert body["access_mode"] == "viewer"
    # The real name is redacted to the alias — server-side, so no field leaks it.
    assert body["name"] == "Manhattan Townhouse"
    assert body["public_alias"] == "Manhattan Townhouse"
    assert body["display_name"] == "Manhattan Townhouse"
    assert "Ayers" not in detail.text


def test_anonymous_viewer_without_alias_sees_the_real_name(clean_tables: None) -> None:
    editor = _sign_in()
    project = _create_project(editor)

    anon = TestClient(app)
    body = anon.get(f"/api/v1/projects/{project['id']}").json()
    assert body["access_mode"] == "viewer"
    # Opt-in privacy: with no alias set, the real name still shows publicly.
    assert body["name"] == "Ayers Home"
    assert body["public_alias"] is None
    assert body["display_name"] == "Ayers Home"


def test_clearing_the_alias_restores_the_name_as_display_name(clean_tables: None) -> None:
    editor = _sign_in()
    project = _create_project(editor)
    _set_alias(editor, str(project["id"]), "Manhattan Townhouse")

    # A blank string clears the alias (stripped to NULL).
    cleared = _set_alias(editor, str(project["id"]), "  ")
    assert cleared["public_alias"] is None
    assert cleared["display_name"] == "Ayers Home"

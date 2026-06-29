"""Phase 04 HTTP/authorization tests for admin user management.

Covers deny-by-default authorization (anonymous 401, normal user 403, admin
allowed), the CSRF header guard on admin mutations, the full lifecycle through
the routes, and the public invite/reset completion endpoints.
"""

from __future__ import annotations

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from database import transaction
from features.access import repository as access_repository
from features.access.capabilities import ADMIN_USERS_MANAGE, CATALOG_EDIT
from features.auth.models import UserPublic
from features.auth.service import create_or_update_user
from main import app

ORIGIN = "http://localhost:5173"

_TRUNCATE = (
    "TRUNCATE account_tokens, mcp_tokens, user_grants, user_action_log, "
    "sessions, projects, users RESTART IDENTITY CASCADE"
)


@pytest.fixture()
def clean_admin_tables() -> Iterator[None]:
    with transaction() as conn:
        conn.execute(_TRUNCATE)
    yield
    with transaction() as conn:
        conn.execute(_TRUNCATE)


def _make_user(email: str, *, admin: bool) -> UserPublic:
    user = create_or_update_user(email=email, display_name=email.split("@")[0], password="password")
    if admin:
        with transaction() as conn:
            access_repository.ensure_global_grant(conn, user_id=user.id, capability=ADMIN_USERS_MANAGE, granted_by=None)
    return user


def _client(*, csrf: bool = True) -> TestClient:
    headers = {"Origin": ORIGIN}
    if csrf:
        headers["X-PHN-CSRF"] = "1"
    return TestClient(app, headers=headers)


def _login(client: TestClient, email: str, password: str = "password") -> None:
    response = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200


# --- Authorization ---------------------------------------------------------


def test_anonymous_gets_401(clean_admin_tables: None) -> None:
    response = _client().get("/api/v1/admin/users")
    assert response.status_code == 401


def test_normal_user_gets_403(clean_admin_tables: None) -> None:
    _make_user("normal@example.com", admin=False)
    client = _client()
    _login(client, "normal@example.com")
    response = client.get("/api/v1/admin/users")
    assert response.status_code == 403


def test_admin_can_list_users(clean_admin_tables: None) -> None:
    _make_user("admin@example.com", admin=True)
    client = _client()
    _login(client, "admin@example.com")
    response = client.get("/api/v1/admin/users")
    assert response.status_code == 200
    emails = {row["email"] for row in response.json()}
    assert "admin@example.com" in emails


def test_session_exposes_admin_capability(clean_admin_tables: None) -> None:
    _make_user("admin@example.com", admin=True)
    client = _client()
    _login(client, "admin@example.com")
    session = client.get("/api/v1/auth/session").json()
    assert ADMIN_USERS_MANAGE in session["capabilities"]
    assert CATALOG_EDIT in session["capabilities"]


def test_admin_mutation_requires_csrf_header(clean_admin_tables: None) -> None:
    _make_user("admin@example.com", admin=True)
    client = _client(csrf=False)
    _login(client, "admin@example.com")  # login is not under /admin, so it succeeds
    response = client.post(
        "/api/v1/admin/users/invite",
        json={"email": "john@example.com", "display_name": "John", "role": "user"},
    )
    assert response.status_code == 403
    assert response.json()["error_code"] == "csrf_header_missing"


# --- Lifecycle through the routes ------------------------------------------


def test_invite_then_complete_then_sign_in(clean_admin_tables: None) -> None:
    _make_user("admin@example.com", admin=True)
    admin_client = _client()
    _login(admin_client, "admin@example.com")

    invite = admin_client.post(
        "/api/v1/admin/users/invite",
        json={"email": "john@example.com", "display_name": "John", "role": "user"},
    )
    assert invite.status_code == 201
    body = invite.json()
    assert body["user"]["status"] == "invited"
    link = body["link"]["link"]
    token = link.split("#token=")[1]

    complete = _client().post("/api/v1/auth/invite/complete", json={"token": token, "password": "john-strong-pw"})
    assert complete.status_code == 204

    signin = _client().post("/api/v1/auth/login", json={"email": "john@example.com", "password": "john-strong-pw"})
    assert signin.status_code == 200


def test_reset_link_only_in_create_response_not_in_list(clean_admin_tables: None) -> None:
    _make_user("admin@example.com", admin=True)
    target = _make_user("john@example.com", admin=False)
    client = _client()
    _login(client, "admin@example.com")

    reset = client.post(f"/api/v1/admin/users/{target.id}/reset-link")
    assert reset.status_code == 201
    assert "#token=" in reset.json()["link"]

    # The list never carries a raw link/token.
    listing = client.get("/api/v1/admin/users").text
    assert "#token=" not in listing


def test_deactivate_and_reactivate(clean_admin_tables: None) -> None:
    _make_user("admin@example.com", admin=True)
    target = _make_user("john@example.com", admin=False)
    client = _client()
    _login(client, "admin@example.com")

    deactivated = client.post(f"/api/v1/admin/users/{target.id}/deactivate")
    assert deactivated.status_code == 200
    assert deactivated.json()["status"] == "inactive"

    reactivated = client.post(f"/api/v1/admin/users/{target.id}/reactivate")
    assert reactivated.status_code == 200
    assert reactivated.json()["user"]["status"] == "active"
    assert "#token=" in reactivated.json()["link"]["link"]


def test_grant_and_last_admin_demote_guard(clean_admin_tables: None) -> None:
    admin = _make_user("admin@example.com", admin=True)
    client = _client()
    _login(client, "admin@example.com")

    # Demoting the only admin is rejected.
    demote_self = client.patch(f"/api/v1/admin/users/{admin.id}/admin", json={"make_admin": False})
    assert demote_self.status_code == 409
    assert demote_self.json()["error_code"] == "last_admin"

    # Promote a second user, then the first can be demoted.
    other = _make_user("john@example.com", admin=False)
    promote = client.patch(f"/api/v1/admin/users/{other.id}/admin", json={"make_admin": True})
    assert promote.status_code == 200
    assert promote.json()["role"] == "admin"


def test_audit_route_returns_entries_without_secrets(clean_admin_tables: None) -> None:
    _make_user("admin@example.com", admin=True)
    target = _make_user("john@example.com", admin=False)
    client = _client()
    _login(client, "admin@example.com")
    client.post(f"/api/v1/admin/users/{target.id}/reset-link")

    audit = client.get(f"/api/v1/admin/users/{target.id}/audit")
    assert audit.status_code == 200
    rows = audit.json()
    assert any(r["action"] == "admin_reset_link_generated" for r in rows)
    assert all("token" not in str(r["details"]).lower() for r in rows)


# --- Completion validation -------------------------------------------------


def test_completion_rejects_invalid_token(clean_admin_tables: None) -> None:
    response = _client().post(
        "/api/v1/auth/reset/complete", json={"token": "not-a-real-token", "password": "some-strong-pw"}
    )
    assert response.status_code == 400
    assert response.json()["error_code"] == "invalid_token"


def test_completion_rejects_short_password(clean_admin_tables: None) -> None:
    response = _client().post("/api/v1/auth/invite/complete", json={"token": "abc", "password": "short"})
    assert response.status_code == 422

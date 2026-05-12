"""Auth/session contract tests for TB-01."""

from __future__ import annotations

import sys
from collections.abc import Iterator
from concurrent.futures import ThreadPoolExecutor
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from config import settings
from database import connection, transaction
from features.auth.passwords import hash_password, verify_password
from features.auth.service import create_or_update_user
from main import app
from scripts import seed_user

ORIGIN = "http://localhost:5173"


@pytest.fixture()
def clean_auth_tables() -> Iterator[None]:
    with transaction() as conn:
        conn.execute("TRUNCATE user_action_log, sessions, users RESTART IDENTITY CASCADE")
    yield
    with transaction() as conn:
        conn.execute("TRUNCATE user_action_log, sessions, users RESTART IDENTITY CASCADE")


def test_argon2_password_hash_verifies() -> None:
    password_hash = hash_password("correct horse battery staple")
    assert password_hash.startswith("$argon2")
    assert verify_password("correct horse battery staple", password_hash)
    assert not verify_password("wrong", password_hash)


def test_login_session_and_logout_flow(clean_auth_tables: None) -> None:
    create_or_update_user(email="ed@example.com", display_name="Ed May", password="password")
    client = TestClient(app)

    login = client.post(
        "/api/v1/auth/login",
        headers={"Origin": ORIGIN, "X-Request-ID": "test-login"},
        json={"email": "ed@example.com", "password": "password"},
    )

    assert login.status_code == 200
    assert login.headers["X-Request-ID"] == "test-login"
    assert "phn_session=" in login.headers["set-cookie"]
    assert "HttpOnly" in login.headers["set-cookie"]
    assert login.json()["user"]["email"] == "ed@example.com"

    session = client.get("/api/v1/auth/session")
    assert session.status_code == 200
    assert session.json()["user"]["display_name"] == "Ed May"

    logout = client.post("/api/v1/auth/logout", headers={"Origin": ORIGIN})
    assert logout.status_code == 204

    after_logout = client.get("/api/v1/auth/session")
    assert after_logout.status_code == 401
    assert after_logout.json()["error_code"] == "not_authenticated"


def test_single_active_session_invalidates_previous_session(clean_auth_tables: None) -> None:
    create_or_update_user(email="ed@example.com", display_name="Ed May", password="password")
    first = TestClient(app)
    second = TestClient(app)

    first_login = first.post(
        "/api/v1/auth/login",
        headers={"Origin": ORIGIN},
        json={"email": "ed@example.com", "password": "password"},
    )
    assert first_login.status_code == 200

    second_login = second.post(
        "/api/v1/auth/login",
        headers={"Origin": ORIGIN},
        json={"email": "ed@example.com", "password": "password"},
    )
    assert second_login.status_code == 200

    displaced = first.get("/api/v1/auth/session")
    assert displaced.status_code == 401
    assert displaced.json()["error_code"] == "session_invalidated"
    assert displaced.json()["details"]["reason"] == "superseded_by_new_login"

    still_active = second.get("/api/v1/auth/session")
    assert still_active.status_code == 200

    with connection() as conn:
        row = conn.execute("SELECT count(*) AS n FROM sessions WHERE invalidated_at IS NULL").fetchone()
    assert row is not None
    assert row["n"] == 1


def test_parallel_login_attempts_do_not_escape_single_active_session(clean_auth_tables: None) -> None:
    create_or_update_user(email="ed@example.com", display_name="Ed May", password="password")
    clients = [TestClient(app), TestClient(app)]

    def login(client: TestClient) -> int:
        response = client.post(
            "/api/v1/auth/login",
            headers={"Origin": ORIGIN},
            json={"email": "ed@example.com", "password": "password"},
        )
        return response.status_code

    with ThreadPoolExecutor(max_workers=2) as executor:
        statuses = list(executor.map(login, clients))

    assert statuses == [200, 200]
    with connection() as conn:
        row = conn.execute("SELECT count(*) AS n FROM sessions WHERE invalidated_at IS NULL").fetchone()
    assert row is not None
    assert row["n"] == 1


def test_expired_session_is_invalidated(clean_auth_tables: None) -> None:
    create_or_update_user(email="ed@example.com", display_name="Ed May", password="password")
    client = TestClient(app)
    login = client.post(
        "/api/v1/auth/login",
        headers={"Origin": ORIGIN},
        json={"email": "ed@example.com", "password": "password"},
    )
    assert login.status_code == 200

    with transaction() as conn:
        conn.execute("UPDATE sessions SET expires_at = now() - interval '1 minute'")

    response = client.get("/api/v1/auth/session")
    assert response.status_code == 401
    assert response.json()["error_code"] == "session_expired"

    with connection() as conn:
        row = conn.execute("SELECT invalidation_reason FROM sessions WHERE invalidated_at IS NOT NULL").fetchone()
    assert row is not None
    assert row["invalidation_reason"] == "expired"


def test_failed_login_is_generic_and_logged(clean_auth_tables: None) -> None:
    create_or_update_user(email="ed@example.com", display_name="Ed May", password="password")
    client = TestClient(app)

    response = client.post(
        "/api/v1/auth/login",
        headers={"Origin": ORIGIN},
        json={"email": "ed@example.com", "password": "wrong"},
    )

    assert response.status_code == 401
    assert response.json()["error_code"] == "invalid_credentials"
    assert response.json()["message"] == "Email or password is incorrect."

    with connection() as conn:
        row = conn.execute("SELECT action, email FROM user_action_log ORDER BY created_at DESC LIMIT 1").fetchone()
    assert row == {"action": "login_failed", "email": "ed@example.com"}


def test_unknown_email_login_is_generic_and_logged(clean_auth_tables: None) -> None:
    client = TestClient(app)

    response = client.post(
        "/api/v1/auth/login",
        headers={"Origin": ORIGIN},
        json={"email": "missing@example.com", "password": "wrong"},
    )

    assert response.status_code == 401
    assert response.json()["error_code"] == "invalid_credentials"
    assert response.json()["message"] == "Email or password is incorrect."

    with connection() as conn:
        row = conn.execute("SELECT action, email FROM user_action_log ORDER BY created_at DESC LIMIT 1").fetchone()
    assert row == {"action": "login_failed", "email": "missing@example.com"}


def test_mutating_api_requires_allowed_origin(clean_auth_tables: None) -> None:
    client = TestClient(app)

    response = client.post(
        "/api/v1/auth/login",
        headers={"Origin": "https://example.test"},
        json={"email": "ed@example.com", "password": "password"},
    )

    assert response.status_code == 403
    assert response.json()["error_code"] == "origin_not_allowed"


def test_seed_user_refuses_non_local_environments(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "environment", "production")
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "seed_user",
            "--email",
            "ed@example.com",
            "--display-name",
            "Ed May",
            "--password",
            "password",
        ],
    )

    with pytest.raises(SystemExit, match="Refusing to seed/reset"):
        seed_user.main()


def test_seed_user_allows_staging_with_explicit_flag(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: dict[str, str] = {}

    def fake_create_or_update_user(email: str, display_name: str, password: str) -> object:
        calls.update({"email": email, "display_name": display_name, "password": password})
        return SimpleNamespace(email=email, id="user-id")

    monkeypatch.setattr(settings, "environment", "staging")
    monkeypatch.setattr(seed_user, "create_or_update_user", fake_create_or_update_user)
    monkeypatch.setattr(seed_user.getpass, "getpass", lambda _: "prompted-password")
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "seed_user",
            "--email",
            "ed@example.com",
            "--display-name",
            "Ed May",
            "--allow-staging",
        ],
    )

    seed_user.main()

    assert calls == {
        "email": "ed@example.com",
        "display_name": "Ed May",
        "password": "prompted-password",
    }

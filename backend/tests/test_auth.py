"""Auth/session contract tests for TB-01."""

from __future__ import annotations

import sys
from collections.abc import Iterator
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import Response
from fastapi.testclient import TestClient

from config import settings
from database import connection, transaction
from features.auth.passwords import hash_password, verify_password
from features.auth.service import create_or_update_user, now_utc, session_expires_at, set_session_cookie
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
    assert "SameSite=lax" in login.headers["set-cookie"]
    assert login.json()["user"]["email"] == "ed@example.com"
    assert login.json()["user"]["units_preference"] == "SI"

    session = client.get("/api/v1/auth/session")
    assert session.status_code == 200
    assert session.json()["user"]["display_name"] == "Ed May"
    assert session.json()["user"]["units_preference"] == "SI"

    logout = client.post("/api/v1/auth/logout", headers={"Origin": ORIGIN})
    assert logout.status_code == 204

    after_logout = client.get("/api/v1/auth/session")
    assert after_logout.status_code == 401
    assert after_logout.json()["error_code"] == "not_authenticated"


def test_units_preference_can_be_updated_and_is_logged(clean_auth_tables: None) -> None:
    create_or_update_user(email="ed@example.com", display_name="Ed May", password="password")
    client = TestClient(app)
    login = client.post(
        "/api/v1/auth/login",
        headers={"Origin": ORIGIN},
        json={"email": "ed@example.com", "password": "password"},
    )
    assert login.status_code == 200

    update = client.patch(
        "/api/v1/auth/preferences",
        headers={"Origin": ORIGIN},
        json={"units_preference": "IP"},
    )

    assert update.status_code == 200
    assert update.json()["user"]["units_preference"] == "IP"

    session = client.get("/api/v1/auth/session")
    assert session.status_code == 200
    assert session.json()["user"]["units_preference"] == "IP"

    with connection() as conn:
        user = conn.execute("SELECT units_preference FROM users WHERE email = 'ed@example.com'").fetchone()
        log = conn.execute(
            """
            SELECT action, details
            FROM user_action_log
            WHERE action = 'auth.units_preference.updated'
            ORDER BY created_at DESC
            LIMIT 1
            """
        ).fetchone()
    assert user == {"units_preference": "IP"}
    assert log is not None
    assert log["action"] == "auth.units_preference.updated"
    assert log["details"] == {"before": "SI", "after": "IP"}


def test_units_preference_rejects_invalid_values(clean_auth_tables: None) -> None:
    create_or_update_user(email="ed@example.com", display_name="Ed May", password="password")
    client = TestClient(app)
    login = client.post(
        "/api/v1/auth/login",
        headers={"Origin": ORIGIN},
        json={"email": "ed@example.com", "password": "password"},
    )
    assert login.status_code == 200

    response = client.patch(
        "/api/v1/auth/preferences",
        headers={"Origin": ORIGIN},
        json={"units_preference": "METRIC"},
    )

    assert response.status_code == 422
    with connection() as conn:
        user = conn.execute("SELECT units_preference FROM users WHERE email = 'ed@example.com'").fetchone()
    assert user == {"units_preference": "SI"}


def test_units_preference_requires_authentication(clean_auth_tables: None) -> None:
    client = TestClient(app)

    response = client.patch(
        "/api/v1/auth/preferences",
        headers={"Origin": ORIGIN},
        json={"units_preference": "IP"},
    )

    assert response.status_code == 401
    assert response.json()["error_code"] == "not_authenticated"


def test_session_cookie_samesite_is_configurable(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "session_cookie_samesite", "none")
    monkeypatch.setattr(settings, "environment", "staging")

    response = Response()
    set_session_cookie(response, uuid4(), session_expires_at(now_utc()))

    assert "SameSite=none" in response.headers["set-cookie"]
    assert "Secure" in response.headers["set-cookie"]


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


def test_stale_cookie_after_supersession_is_session_invalidated(clean_auth_tables: None) -> None:
    create_or_update_user(email="ed@example.com", display_name="Ed May", password="password")
    client_a = TestClient(app)
    client_b = TestClient(app)

    login_a = client_a.post(
        "/api/v1/auth/login",
        headers={"Origin": ORIGIN},
        json={"email": "ed@example.com", "password": "password"},
    )
    assert login_a.status_code == 200

    login_b = client_b.post(
        "/api/v1/auth/login",
        headers={"Origin": ORIGIN},
        json={"email": "ed@example.com", "password": "password"},
    )
    assert login_b.status_code == 200

    stale = client_a.get("/api/v1/auth/session")
    assert stale.status_code == 401
    body = stale.json()
    assert body["error_code"] == "session_invalidated"
    assert body["details"]["reason"] == "superseded_by_new_login"


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


def _read_last_seen_at() -> datetime:
    with connection() as conn:
        row = conn.execute("SELECT last_seen_at FROM sessions LIMIT 1").fetchone()
    assert row is not None
    value = row["last_seen_at"]
    assert isinstance(value, datetime)
    return value


def test_touch_session_throttle_skips_write_within_window(
    clean_auth_tables: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "session_touch_throttle_seconds", 60)
    create_or_update_user(email="ed@example.com", display_name="Ed May", password="password")
    client = TestClient(app)
    login = client.post(
        "/api/v1/auth/login",
        headers={"Origin": ORIGIN},
        json={"email": "ed@example.com", "password": "password"},
    )
    assert login.status_code == 200

    original_last_seen = _read_last_seen_at()
    assert client.get("/api/v1/auth/session").status_code == 200
    assert _read_last_seen_at() == original_last_seen

    with transaction() as conn:
        conn.execute("UPDATE sessions SET last_seen_at = now() - interval '90 seconds'")

    assert client.get("/api/v1/auth/session").status_code == 200
    after = _read_last_seen_at()
    assert after > original_last_seen


def test_cookie_expires_at_slides_on_every_response(clean_auth_tables: None) -> None:
    create_or_update_user(email="ed@example.com", display_name="Ed May", password="password")
    client = TestClient(app)
    login = client.post(
        "/api/v1/auth/login",
        headers={"Origin": ORIGIN},
        json={"email": "ed@example.com", "password": "password"},
    )
    assert login.status_code == 200
    first = login.json()["expires_at"]

    second_response = client.get("/api/v1/auth/session")
    assert second_response.status_code == 200
    second = second_response.json()["expires_at"]
    assert second >= first


def test_touch_session_throttle_zero_writes_every_request(
    clean_auth_tables: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "session_touch_throttle_seconds", 0)
    create_or_update_user(email="ed@example.com", display_name="Ed May", password="password")
    client = TestClient(app)
    login = client.post(
        "/api/v1/auth/login",
        headers={"Origin": ORIGIN},
        json={"email": "ed@example.com", "password": "password"},
    )
    assert login.status_code == 200

    assert client.get("/api/v1/auth/session").status_code == 200
    first = _read_last_seen_at()
    assert client.get("/api/v1/auth/session").status_code == 200
    second = _read_last_seen_at()
    assert second > first


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

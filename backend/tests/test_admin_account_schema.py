"""Phase 02 schema/bootstrap tests for admin user management.

Covers the durable primitives: invited (password-less) users, the hashed
single-use ``account_tokens`` table + issuing service, the per-user MCP token
revocation helper, and the audited first-admin bootstrap command.
"""

from __future__ import annotations

import sys
from collections.abc import Iterator
from typing import Any
from uuid import UUID, uuid4

import pytest
from fastapi import Request
from psycopg import Connection

from config import settings
from database import connection, transaction
from features.auth import repository
from features.auth.account_token_service import issue_account_token, token_expires_at
from features.auth.account_tokens import build_account_link, generate_raw_token, hash_token
from features.auth.passwords import hash_password
from features.auth.service import authenticate, create_or_update_user, now_utc
from features.mcp import repository as mcp_repository
from scripts import bootstrap_admin


@pytest.fixture()
def clean_admin_tables() -> Iterator[None]:
    statement = (
        "TRUNCATE account_tokens, mcp_tokens, user_grants, user_action_log, "
        "sessions, projects, users RESTART IDENTITY CASCADE"
    )
    with transaction() as conn:
        conn.execute(statement)
    yield
    with transaction() as conn:
        conn.execute(statement)


def _fake_request() -> Request:
    scope = {
        "type": "http",
        "headers": [(b"user-agent", b"pytest")],
        "client": ("203.0.113.7", 12345),
    }
    return Request(scope)


# --- Invited users cannot authenticate -------------------------------------


def test_invited_user_without_password_cannot_authenticate(clean_admin_tables: None) -> None:
    with transaction() as conn:
        repository.upsert_invited_user(conn, email="john@example.com", display_name="John Mitchell")

    with pytest.raises(Exception) as excinfo:
        authenticate("john@example.com", "anything", _fake_request())
    # Generic invalid-credentials error, identical to unknown-user/wrong-password.
    assert getattr(excinfo.value, "status_code", None) == 401


def test_set_user_password_makes_user_authenticatable(clean_admin_tables: None) -> None:
    with transaction() as conn:
        user = repository.upsert_invited_user(conn, email="john@example.com", display_name="John")
        repository.set_user_password(conn, user["id"], hash_password("correct horse"))

    public, session_id, _expires = authenticate("john@example.com", "correct horse", _fake_request())
    assert public.email == "john@example.com"
    assert isinstance(session_id, UUID)


# --- Account tokens: hashed, single-use, revoke-and-replace ----------------


def test_account_token_stores_only_hash(clean_admin_tables: None) -> None:
    raw = generate_raw_token()
    with transaction() as conn:
        user = repository.upsert_invited_user(conn, email="john@example.com", display_name="John")
        repository.insert_account_token(
            conn,
            user_id=user["id"],
            token_type="invite",
            token_hash=hash_token(raw),
            expires_at=token_expires_at("invite", now_utc()),
            created_by=None,
            request_ip=None,
            request_user_agent=None,
        )

    with connection() as conn:
        rows = conn.execute("SELECT token_hash FROM account_tokens").fetchall()
    stored = [r["token_hash"] for r in rows]
    assert stored == [hash_token(raw)]
    assert raw not in stored  # the raw token is never persisted


def test_issue_account_token_revokes_prior_active_token(clean_admin_tables: None) -> None:
    now = now_utc()
    with transaction() as conn:
        user = repository.upsert_invited_user(conn, email="john@example.com", display_name="John")
        _first, link_one = issue_account_token(conn, user_id=user["id"], token_type="invite", created_by=None, now=now)
        _second, link_two = issue_account_token(conn, user_id=user["id"], token_type="invite", created_by=None, now=now)

    assert link_one != link_two
    assert link_two.startswith(settings.frontend_base_url.rstrip("/") + "/invite#token=")
    with connection() as conn:
        active = conn.execute(
            "SELECT count(*) AS n FROM account_tokens WHERE consumed_at IS NULL AND revoked_at IS NULL"
        ).fetchone()
    assert active is not None
    assert active["n"] == 1  # revoke-and-replace: only the newest survives


def test_consume_account_token_is_single_use(clean_admin_tables: None) -> None:
    raw = generate_raw_token()
    with transaction() as conn:
        user = repository.upsert_invited_user(conn, email="john@example.com", display_name="John")
        token = repository.insert_account_token(
            conn,
            user_id=user["id"],
            token_type="password_reset",
            token_hash=hash_token(raw),
            expires_at=token_expires_at("password_reset", now_utc()),
            created_by=None,
            request_ip=None,
            request_user_agent=None,
        )
        repository.consume_account_token(conn, token["id"])

    with connection() as conn:
        fetched = repository.get_account_token_by_hash_for_update(conn, hash_token(raw))
    assert fetched is not None
    assert fetched["consumed_at"] is not None


def test_build_account_link_uses_fragment() -> None:
    raw = generate_raw_token()
    link = build_account_link("password_reset", raw)
    assert f"#token={raw}" in link
    assert "?token=" not in link  # token rides the fragment, not the query string


# --- MCP token revocation is per-user --------------------------------------


def _seed_project(conn: Connection[Any], owner_id: UUID) -> UUID:
    row = conn.execute(
        """
        INSERT INTO projects (name, bt_number, owner_id)
        VALUES ('T', %(bt)s, %(owner)s)
        RETURNING id
        """,
        {"bt": f"BT-{uuid4().hex[:6]}", "owner": owner_id},
    ).fetchone()
    assert row is not None
    return row["id"]


def _seed_mcp_token(conn: Connection[Any], project_id: UUID, issued_by: UUID, token_hash: str) -> None:
    conn.execute(
        """
        INSERT INTO mcp_tokens (project_id, issued_by_user_id, label, token_hash, token_prefix, scopes)
        VALUES (%(p)s, %(u)s, 'l', %(h)s, 'phn_', ARRAY['project:read'])
        """,
        {"p": project_id, "u": issued_by, "h": token_hash},
    )


def test_revoke_tokens_for_user_only_targets_that_user(clean_admin_tables: None) -> None:
    with transaction() as conn:
        alice = repository.upsert_invited_user(conn, email="alice@example.com", display_name="Alice")["id"]
        bob = repository.upsert_invited_user(conn, email="bob@example.com", display_name="Bob")["id"]
        project_id = _seed_project(conn, alice)
        _seed_mcp_token(conn, project_id, alice, "hash-alice")
        _seed_mcp_token(conn, project_id, bob, "hash-bob")

        revoked = mcp_repository.revoke_tokens_for_user(conn, alice)

    assert len(revoked) == 1
    with connection() as conn:
        rows = conn.execute("SELECT issued_by_user_id, revoked_at FROM mcp_tokens ORDER BY token_hash").fetchall()
    by_user = {r["issued_by_user_id"]: r["revoked_at"] for r in rows}
    assert by_user[alice] is not None
    assert by_user[bob] is None


# --- Bootstrap command ------------------------------------------------------


def _run_bootstrap(monkeypatch: pytest.MonkeyPatch, *args: str) -> None:
    monkeypatch.setattr(sys, "argv", ["bootstrap_admin", *args])
    bootstrap_admin.main()


def test_bootstrap_creates_invited_admin_with_grant(
    clean_admin_tables: None, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    _run_bootstrap(monkeypatch, "--email", "ed@example.com", "--display-name", "Ed May")
    out = capsys.readouterr().out

    assert "invite link" in out.lower()
    with connection() as conn:
        user = repository.get_user_by_email(conn, "ed@example.com")
        assert user is not None
        assert user["password_hash"] is None  # no reusable password set
        caps = conn.execute(
            "SELECT capability FROM user_grants WHERE user_id = %(u)s AND revoked_at IS NULL",
            {"u": user["id"]},
        ).fetchall()
        actions = conn.execute(
            "SELECT action FROM user_action_log WHERE target_user_id = %(u)s ORDER BY action",
            {"u": user["id"]},
        ).fetchall()
    assert {c["capability"] for c in caps} == {"admin.users.manage"}
    assert {a["action"] for a in actions} == {"admin_capability_granted", "admin_user_invited"}


def test_bootstrap_existing_password_user_issues_reset(
    clean_admin_tables: None, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    create_or_update_user(email="ed@example.com", display_name="Ed May", password="password")

    _run_bootstrap(monkeypatch, "--email", "ed@example.com", "--display-name", "Ed May")
    out = capsys.readouterr().out

    assert "password_reset link" in out.lower()
    with connection() as conn:
        user = repository.get_user_by_email(conn, "ed@example.com")
        assert user is not None
        assert user["password_hash"] is not None  # existing password untouched
        active = conn.execute(
            "SELECT token_type FROM account_tokens WHERE user_id = %(u)s AND revoked_at IS NULL",
            {"u": user["id"]},
        ).fetchall()
    assert {t["token_type"] for t in active} == {"password_reset"}


def test_bootstrap_refuses_production_without_confirmation(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "environment", "production")
    monkeypatch.setattr(sys, "argv", ["bootstrap_admin", "--email", "ed@example.com", "--display-name", "Ed"])
    with pytest.raises(SystemExit):
        bootstrap_admin.main()

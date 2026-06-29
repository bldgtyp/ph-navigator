"""Phase 03 service tests for admin user management.

Exercises the workflow rules (invite, reset link, deactivate/reactivate, Admin
grant/revoke, last-admin protection, audit) and the public invite/reset
completion path — all below the HTTP layer.
"""

from __future__ import annotations

from collections.abc import Iterator
from typing import Any
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException, Request

from database import connection, transaction
from features.access import repository as access_repository
from features.access.capabilities import ADMIN_USERS_MANAGE
from features.admin import service
from features.auth.account_completion import complete_invite, complete_reset
from features.auth.models import UserPublic
from features.auth.service import authenticate, create_or_update_user

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


def _make_admin(email: str = "admin@example.com") -> UserPublic:
    user = create_or_update_user(email=email, display_name="Admin", password="password")
    with transaction() as conn:
        access_repository.insert_grant(
            conn,
            user_id=user.id,
            capability=ADMIN_USERS_MANAGE,
            scope_type="global",
            scope_id=None,
            granted_by=None,
        )
    return user


def _raw_token(link: str) -> str:
    return link.split("#token=")[1]


def _fake_request() -> Request:
    return Request({"type": "http", "headers": [(b"user-agent", b"pytest")], "client": ("203.0.113.7", 1)})


def _error_code(exc: HTTPException) -> str:
    detail = exc.detail
    assert isinstance(detail, dict)
    return str(detail["error_code"])


def _audit_actions(target_user_id: UUID) -> set[str]:
    with connection() as conn:
        rows = conn.execute(
            "SELECT action FROM user_action_log WHERE target_user_id = %(u)s",
            {"u": target_user_id},
        ).fetchall()
    return {r["action"] for r in rows}


# --- Invite ----------------------------------------------------------------


def test_invite_creates_invited_user_with_link_and_audit(clean_admin_tables: None) -> None:
    actor = _make_admin()
    row, link = service.invite_user(
        actor,
        email="john@example.com",
        display_name="John",
        make_admin=False,
        ip_address="203.0.113.7",
        user_agent="pytest",
    )

    assert row.status == "invited"
    assert row.role == "user"
    assert link.token_type == "invite"
    assert "#token=" in link.link
    assert "admin_user_invited" in _audit_actions(row.id)


def test_invite_as_admin_grants_capability(clean_admin_tables: None) -> None:
    actor = _make_admin()
    row, _link = service.invite_user(
        actor, email="jane@example.com", display_name="Jane", make_admin=True, ip_address=None, user_agent=None
    )
    assert row.role == "admin"
    assert _audit_actions(row.id) >= {"admin_user_invited", "admin_capability_granted"}


def test_invited_user_completes_invite_and_can_sign_in(clean_admin_tables: None) -> None:
    actor = _make_admin()
    row, link = service.invite_user(
        actor, email="john@example.com", display_name="John", make_admin=False, ip_address=None, user_agent=None
    )

    user = complete_invite(raw_token=_raw_token(link.link), password="john-strong-pw", ip_address=None, user_agent=None)
    assert user.email == "john@example.com"

    signed_in, _session, _expires = authenticate("john@example.com", "john-strong-pw", _fake_request())
    assert signed_in.id == row.id
    assert "account_invite_completed" in _audit_actions(row.id)


# --- Reset link + completion -----------------------------------------------


def test_generate_reset_link_for_active_user(clean_admin_tables: None) -> None:
    actor = _make_admin()
    target = create_or_update_user(email="john@example.com", display_name="John", password="old-password")

    link = service.generate_reset_link(actor, target_user_id=target.id, ip_address=None, user_agent=None)
    assert link.token_type == "password_reset"

    complete_reset(raw_token=_raw_token(link.link), password="brand-new-pw", ip_address=None, user_agent=None)
    signed_in, _s, _e = authenticate("john@example.com", "brand-new-pw", _fake_request())
    assert signed_in.id == target.id
    assert "admin_reset_link_generated" in _audit_actions(target.id)


def test_update_user_name_changes_row_and_audits(clean_admin_tables: None) -> None:
    actor = _make_admin()
    target = create_or_update_user(email="john@example.com", display_name="John", password="pw")

    row = service.update_user_name(
        actor,
        target_user_id=target.id,
        display_name="  John Mitchell  ",
        ip_address=None,
        user_agent=None,
    )

    assert row.display_name == "John Mitchell"
    assert "admin_user_name_changed" in _audit_actions(target.id)


def test_update_user_email_changes_login_email_and_audits(clean_admin_tables: None) -> None:
    actor = _make_admin()
    target = create_or_update_user(email="john@example.com", display_name="John", password="pw")

    row = service.update_user_email(
        actor,
        target_user_id=target.id,
        email="  John.Mitchell@Example.COM  ",
        ip_address=None,
        user_agent=None,
    )

    assert row.email == "john.mitchell@example.com"
    assert "admin_user_email_changed" in _audit_actions(target.id)
    signed_in, _s, _e = authenticate("john.mitchell@example.com", "pw", _fake_request())
    assert signed_in.id == target.id


def test_update_user_email_rejects_duplicate_email(clean_admin_tables: None) -> None:
    actor = _make_admin()
    target = create_or_update_user(email="john@example.com", display_name="John", password="pw")
    create_or_update_user(email="jane@example.com", display_name="Jane", password="pw")

    with pytest.raises(HTTPException) as excinfo:
        service.update_user_email(
            actor,
            target_user_id=target.id,
            email="JANE@example.com",
            ip_address=None,
            user_agent=None,
        )
    assert excinfo.value.status_code == 409
    assert _error_code(excinfo.value) == "email_taken"


def test_reset_completion_invalidates_existing_sessions(clean_admin_tables: None) -> None:
    actor = _make_admin()
    target = create_or_update_user(email="john@example.com", display_name="John", password="old-password")
    _user, session_id, _expires = authenticate("john@example.com", "old-password", _fake_request())

    link = service.generate_reset_link(actor, target_user_id=target.id, ip_address=None, user_agent=None)
    complete_reset(raw_token=_raw_token(link.link), password="brand-new-pw", ip_address=None, user_agent=None)

    with connection() as conn:
        session = conn.execute("SELECT invalidated_at FROM sessions WHERE id = %(s)s", {"s": session_id}).fetchone()
    assert session is not None
    assert session["invalidated_at"] is not None


def test_reset_link_rejected_for_inactive_user(clean_admin_tables: None) -> None:
    actor = _make_admin()
    target = create_or_update_user(email="john@example.com", display_name="John", password="pw")
    service.deactivate_user(actor, target_user_id=target.id, ip_address=None, user_agent=None)

    with pytest.raises(HTTPException) as excinfo:
        service.generate_reset_link(actor, target_user_id=target.id, ip_address=None, user_agent=None)
    assert excinfo.value.status_code == 409


def test_completion_rejects_reused_token(clean_admin_tables: None) -> None:
    actor = _make_admin()
    target = create_or_update_user(email="john@example.com", display_name="John", password="pw")
    link = service.generate_reset_link(actor, target_user_id=target.id, ip_address=None, user_agent=None)
    raw = _raw_token(link.link)

    complete_reset(raw_token=raw, password="first-new-pw", ip_address=None, user_agent=None)
    with pytest.raises(HTTPException) as excinfo:
        complete_reset(raw_token=raw, password="second-new-pw", ip_address=None, user_agent=None)
    assert excinfo.value.status_code == 400


def test_completion_rejects_wrong_token_type(clean_admin_tables: None) -> None:
    actor = _make_admin()
    row, link = service.invite_user(
        actor, email="john@example.com", display_name="John", make_admin=False, ip_address=None, user_agent=None
    )
    # An invite token cannot be redeemed through the reset endpoint.
    with pytest.raises(HTTPException) as excinfo:
        complete_reset(raw_token=_raw_token(link.link), password="x-strong-pw", ip_address=None, user_agent=None)
    assert excinfo.value.status_code == 400
    assert row.status == "invited"


# --- Deactivate / reactivate -----------------------------------------------


def _seed_mcp_token(conn: Any, project_id: UUID, issued_by: UUID) -> None:
    conn.execute(
        """
        INSERT INTO mcp_tokens (project_id, issued_by_user_id, label, token_hash, token_prefix, scopes)
        VALUES (%(p)s, %(u)s, 'l', %(h)s, 'phn_', ARRAY['project:read'])
        """,
        {"p": project_id, "u": issued_by, "h": f"h-{uuid4().hex}"},
    )


def test_deactivate_revokes_sessions_and_mcp_tokens(clean_admin_tables: None) -> None:
    actor = _make_admin()
    target = create_or_update_user(email="john@example.com", display_name="John", password="pw")
    _u, session_id, _e = authenticate("john@example.com", "pw", _fake_request())
    with transaction() as conn:
        project = conn.execute(
            "INSERT INTO projects (name, bt_number, owner_id) VALUES ('T','BT-1',%(o)s) RETURNING id",
            {"o": target.id},
        ).fetchone()
        assert project is not None
        _seed_mcp_token(conn, project["id"], target.id)

    row = service.deactivate_user(actor, target_user_id=target.id, ip_address=None, user_agent=None)
    assert row.status == "inactive"

    with connection() as conn:
        session = conn.execute("SELECT invalidated_at FROM sessions WHERE id=%(s)s", {"s": session_id}).fetchone()
        token = conn.execute(
            "SELECT revoked_at FROM mcp_tokens WHERE issued_by_user_id=%(u)s", {"u": target.id}
        ).fetchone()
    assert session is not None and session["invalidated_at"] is not None
    assert token is not None and token["revoked_at"] is not None
    assert "admin_user_deactivated" in _audit_actions(target.id)


def test_deactivated_user_cannot_sign_in(clean_admin_tables: None) -> None:
    actor = _make_admin()
    target = create_or_update_user(email="john@example.com", display_name="John", password="pw")
    service.deactivate_user(actor, target_user_id=target.id, ip_address=None, user_agent=None)

    with pytest.raises(HTTPException) as excinfo:
        authenticate("john@example.com", "pw", _fake_request())
    assert excinfo.value.status_code == 401


def test_reactivate_issues_fresh_link(clean_admin_tables: None) -> None:
    actor = _make_admin()
    target = create_or_update_user(email="john@example.com", display_name="John", password="pw")
    service.deactivate_user(actor, target_user_id=target.id, ip_address=None, user_agent=None)

    row, link = service.reactivate_user(actor, target_user_id=target.id, ip_address=None, user_agent=None)
    assert row.status == "active"
    assert link.token_type == "password_reset"  # had a password before deactivation
    assert "admin_user_reactivated" in _audit_actions(target.id)


# --- Admin grant/revoke + last-admin protection ----------------------------


def test_set_admin_grants_and_revokes(clean_admin_tables: None) -> None:
    actor = _make_admin()  # keeps a second admin so the target is never the last
    target = create_or_update_user(email="john@example.com", display_name="John", password="pw")

    granted = service.set_admin(actor, target_user_id=target.id, make_admin=True, ip_address=None, user_agent=None)
    assert granted.role == "admin"

    revoked = service.set_admin(actor, target_user_id=target.id, make_admin=False, ip_address=None, user_agent=None)
    assert revoked.role == "user"
    assert _audit_actions(target.id) >= {"admin_capability_granted", "admin_capability_revoked"}


def test_cannot_deactivate_last_admin(clean_admin_tables: None) -> None:
    admin = _make_admin("solo@example.com")  # the only admin
    with pytest.raises(HTTPException) as excinfo:
        service.deactivate_user(admin, target_user_id=admin.id, ip_address=None, user_agent=None)
    assert excinfo.value.status_code == 409
    assert _error_code(excinfo.value) == "last_admin"


def test_cannot_demote_last_admin(clean_admin_tables: None) -> None:
    admin = _make_admin("solo@example.com")
    with pytest.raises(HTTPException) as excinfo:
        service.set_admin(admin, target_user_id=admin.id, make_admin=False, ip_address=None, user_agent=None)
    assert excinfo.value.status_code == 409
    assert _error_code(excinfo.value) == "last_admin"


def test_can_demote_when_a_second_admin_exists(clean_admin_tables: None) -> None:
    first = _make_admin("first@example.com")
    second = _make_admin("second@example.com")

    row = service.set_admin(first, target_user_id=second.id, make_admin=False, ip_address=None, user_agent=None)
    assert row.role == "user"

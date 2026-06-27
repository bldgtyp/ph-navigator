"""Phase-1 schema-foundation tests for the access capability model.

Covers the additive migration (``users.is_staff``, ``projects.team_id``) and
the ``user_grants`` repository, including the active-grant uniqueness invariant
and the global-scope CHECK constraint.
"""

from __future__ import annotations

from collections.abc import Iterator
from typing import Any
from uuid import UUID, uuid4

import pytest
from psycopg import Connection
from psycopg.errors import CheckViolation, UniqueViolation

from database import connection, transaction
from features.access import repository as access_repository
from features.access.models import UserGrant
from features.auth import repository as auth_repository
from features.auth.service import create_or_update_user

CATALOG_EDIT = "catalog.edit"


@pytest.fixture()
def clean_access_tables() -> Iterator[None]:
    # TRUNCATE ... CASCADE reaches user_grants via its ON DELETE CASCADE FK to users.
    statement = "TRUNCATE user_action_log, sessions, users RESTART IDENTITY CASCADE"
    with transaction() as conn:
        conn.execute(statement)
    yield
    with transaction() as conn:
        conn.execute(statement)


def _make_user(email: str = "ed@example.com") -> UUID:
    return create_or_update_user(email=email, display_name="Ed May", password="password").id


def _grant_global(conn: Connection[Any], user_id: UUID, capability: str = CATALOG_EDIT) -> dict[str, Any]:
    """Insert the common active global grant used as setup across these tests."""
    return access_repository.insert_grant(
        conn,
        user_id=user_id,
        capability=capability,
        scope_type="global",
        scope_id=None,
        granted_by=user_id,
    )


# --- migration shape -------------------------------------------------------


def test_new_user_defaults_to_not_staff(clean_access_tables: None) -> None:
    user_id = _make_user()
    with connection() as conn:
        row = conn.execute("SELECT is_staff FROM users WHERE id = %s", (user_id,)).fetchone()
    assert row is not None
    assert row["is_staff"] is False


def test_set_user_is_staff_toggles_flag(clean_access_tables: None) -> None:
    user_id = _make_user()
    with transaction() as conn:
        enabled = auth_repository.set_user_is_staff(conn, user_id, True)
        disabled = auth_repository.set_user_is_staff(conn, user_id, False)
    assert enabled["is_staff"] is True
    assert disabled["is_staff"] is False


def test_projects_team_id_is_nullable_with_no_default() -> None:
    with connection() as conn:
        row = conn.execute(
            """
            SELECT is_nullable, column_default
            FROM information_schema.columns
            WHERE table_name = 'projects' AND column_name = 'team_id'
            """
        ).fetchone()
    assert row is not None
    assert row["is_nullable"] == "YES"
    assert row["column_default"] is None


# --- user_grants repository ------------------------------------------------


def test_insert_and_list_active_grant(clean_access_tables: None) -> None:
    user_id = _make_user()
    with transaction() as conn:
        _grant_global(conn, user_id)
        grants = access_repository.list_active_grants_for_user(conn, user_id)

    assert len(grants) == 1
    grant = UserGrant.model_validate(grants[0])
    assert grant.capability == CATALOG_EDIT
    assert grant.scope_type == "global"
    assert grant.scope_id is None
    assert grant.granted_by == user_id
    assert grant.revoked_at is None


def test_duplicate_active_global_grant_is_rejected(clean_access_tables: None) -> None:
    user_id = _make_user()

    def grant() -> None:
        with transaction() as conn:
            _grant_global(conn, user_id)

    grant()
    with pytest.raises(UniqueViolation):
        grant()


def test_revoke_allows_regrant(clean_access_tables: None) -> None:
    user_id = _make_user()
    with transaction() as conn:
        _grant_global(conn, user_id)
        revoked = access_repository.revoke_grant(
            conn,
            user_id=user_id,
            capability=CATALOG_EDIT,
            scope_type="global",
            scope_id=None,
        )
        # Re-granting after revoke is allowed: the partial unique index only
        # covers active (revoked_at IS NULL) rows.
        _grant_global(conn, user_id)
        active = access_repository.list_active_grants_for_user(conn, user_id)

    assert revoked == 1
    assert len(active) == 1


def test_revoke_without_active_grant_returns_zero(clean_access_tables: None) -> None:
    user_id = _make_user()
    with transaction() as conn:
        revoked = access_repository.revoke_grant(
            conn,
            user_id=user_id,
            capability=CATALOG_EDIT,
            scope_type="global",
            scope_id=None,
        )
    assert revoked == 0


def test_project_scoped_grant_coexists_with_global(clean_access_tables: None) -> None:
    user_id = _make_user()
    project_id = uuid4()  # scope_id has no FK; a bare uuid is enough for this test
    with transaction() as conn:
        _grant_global(conn, user_id)
        access_repository.insert_grant(
            conn,
            user_id=user_id,
            capability=CATALOG_EDIT,
            scope_type="project",
            scope_id=project_id,
            granted_by=user_id,
        )
        grants = access_repository.list_active_grants_for_user(conn, user_id)

    validated = [UserGrant.model_validate(g) for g in grants]
    scopes = {(g.scope_type, g.scope_id) for g in validated}
    assert scopes == {("global", None), ("project", project_id)}


# --- CHECK constraint: global iff unscoped ---------------------------------


def test_global_grant_with_scope_id_is_rejected(clean_access_tables: None) -> None:
    user_id = _make_user()
    with pytest.raises(CheckViolation), transaction() as conn:
        access_repository.insert_grant(
            conn,
            user_id=user_id,
            capability=CATALOG_EDIT,
            scope_type="global",
            scope_id=uuid4(),
            granted_by=user_id,
        )


def test_project_grant_without_scope_id_is_rejected(clean_access_tables: None) -> None:
    user_id = _make_user()
    with pytest.raises(CheckViolation), transaction() as conn:
        access_repository.insert_grant(
            conn,
            user_id=user_id,
            capability=CATALOG_EDIT,
            scope_type="project",
            scope_id=None,
            granted_by=user_id,
        )

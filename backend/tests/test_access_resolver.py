"""Unit tests for the capability resolver and the project-access seam gate.

Pure (no DB): they pin that the beta bundles reproduce today's binary
allow/deny and that `require_capability` preserves the 401-viewer / 403-user
error contract. DB-backed resolver inputs (grants, is_staff) are covered in
`test_access_user_grants.py`.
"""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

import pytest
from fastapi import HTTPException

from features.access.capabilities import (
    ADMIN_USERS_MANAGE,
    CATALOG_EDIT,
    CLIENT_CAPS,
    MEMBER_CAPS,
    PROJECT_EDIT,
    PROJECT_VIEW,
    capabilities_for,
)
from features.access.principals import UserPrincipal, ViewerPrincipal
from features.auth.models import UserPublic
from features.projects.access import ProjectAccess, require_capability
from features.projects.models import ProjectSummary


def _user() -> UserPublic:
    return UserPublic(id=uuid4(), email="ed@example.com", display_name="Ed May", units_preference="SI")


def _project() -> ProjectSummary:
    now = datetime(2026, 6, 27, tzinfo=UTC)
    return ProjectSummary(
        id=uuid4(),
        name="P",
        public_alias=None,
        bt_number="0000",
        client=None,
        cert_programs=[],
        phius_number=None,
        phius_dropbox_url=None,
        active_version_id=None,
        last_saved_at=None,
        created_at=now,
        updated_at=now,
    )


def _access(principal: ViewerPrincipal | UserPrincipal) -> ProjectAccess:
    return ProjectAccess(project_id=uuid4(), mode="view", principal=principal, project=_project())


# --- capabilities_for: beta bundles reproduce today's binary ---------------


def test_anonymous_viewer_gets_client_caps() -> None:
    caps = capabilities_for(ViewerPrincipal())
    assert caps == CLIENT_CAPS
    assert PROJECT_VIEW in caps
    assert PROJECT_EDIT not in caps


def test_signed_in_user_gets_member_caps() -> None:
    caps = capabilities_for(UserPrincipal(user=_user()))
    assert caps == MEMBER_CAPS
    assert PROJECT_EDIT in caps
    assert CATALOG_EDIT in caps


def test_staff_user_retains_member_catalog_edit() -> None:
    caps = capabilities_for(UserPrincipal(user=_user(), is_staff=True))
    assert MEMBER_CAPS <= caps
    assert CATALOG_EDIT in caps


def test_admin_preset_retains_member_catalog_edit() -> None:
    caps = capabilities_for(UserPrincipal(user=_user(), granted_capabilities=frozenset({ADMIN_USERS_MANAGE})))
    assert ADMIN_USERS_MANAGE in caps
    assert CATALOG_EDIT in caps


def test_granted_capability_is_honored() -> None:
    caps = capabilities_for(UserPrincipal(user=_user(), granted_capabilities=frozenset({CATALOG_EDIT})))
    assert CATALOG_EDIT in caps


def test_unknown_viewer_audience_resolves_to_no_caps() -> None:
    # certifier has no bundle yet (Phase 5); it must fail closed, not open.
    assert capabilities_for(ViewerPrincipal(audience="certifier")) == frozenset()


# --- require_capability: error contract ------------------------------------


def test_require_capability_passes_when_held() -> None:
    require_capability(_access(UserPrincipal(user=_user())), PROJECT_EDIT)  # no raise


def test_require_capability_401_for_anonymous_viewer() -> None:
    with pytest.raises(HTTPException) as exc:
        require_capability(_access(ViewerPrincipal()), PROJECT_EDIT)
    assert exc.value.status_code == 401


def test_require_capability_403_for_user_missing_capability() -> None:
    with pytest.raises(HTTPException) as exc:
        require_capability(_access(UserPrincipal(user=_user())), ADMIN_USERS_MANAGE)
    assert exc.value.status_code == 403


def test_is_editor_derived_from_capabilities() -> None:
    assert _access(UserPrincipal(user=_user())).is_editor is True
    assert _access(ViewerPrincipal()).is_editor is False

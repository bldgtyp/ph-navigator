"""Resolve a signed-in user's capabilities outside a project context.

The project seam (`features/projects/access.py`) resolves capabilities for a
project request. Some surfaces gate on a capability that isn't project-scoped —
e.g. catalog writes (`catalog.edit`), which are a global library concern. This
module builds a `UserPrincipal` and resolves its global capability set so those
gates reuse the same bundles + grant rules as the project seam.
"""

from __future__ import annotations

from typing import Any

from psycopg import Connection
from starlette import status

from database import connection
from features.access import repository
from features.access.capabilities import capabilities_for
from features.access.principals import UserPrincipal
from features.auth import repository as auth_repository
from features.auth.models import UserPublic
from features.shared.errors import api_error


def build_user_principal(conn: Connection[Any], user: UserPublic) -> UserPrincipal:
    """Build a `UserPrincipal` with the resolver inputs (is_staff + global grants).

    Two small indexed point-lookups. With no users or traffic yet that cost is
    irrelevant; folding `is_staff` into the session JOIN and/or caching the
    principal per request are deferred optimizations.
    """
    return UserPrincipal(
        user=user,
        is_staff=auth_repository.get_user_is_staff(conn, user.id),
        granted_capabilities=repository.active_global_capabilities_for_user(conn, user.id),
    )


def global_capabilities_for_user(user: UserPublic) -> frozenset[str]:
    """Resolve a signed-in user's capabilities independent of any project."""
    with connection() as conn:
        return capabilities_for(build_user_principal(conn, user))


def require_user_capability(user: UserPublic, capability: str) -> None:
    """Raise 403 unless the signed-in user holds ``capability``.

    For non-project surfaces (catalog writes). Project routes instead use
    `features.projects.access.require_capability`, which checks a capability
    already resolved onto a `ProjectAccess` (and 401s anonymous viewers); this
    resolves the user's global capabilities fresh and has no anonymous case.
    """
    if capability not in global_capabilities_for_user(user):
        raise api_error(
            status.HTTP_403_FORBIDDEN,
            "forbidden",
            "You do not have permission to perform this action.",
        )

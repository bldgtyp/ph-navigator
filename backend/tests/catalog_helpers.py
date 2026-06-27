"""Shared helpers for catalog API tests.

Catalog writes require the grantable `catalog.edit` capability (decision D7),
held by bldgtyp `staff` or a granted member. Ed is staff, so catalog tests sign
in as a staff user; `create_catalog_admin` creates that user and sets the flag.
"""

from __future__ import annotations

from database import transaction
from features.auth import repository as auth_repository
from features.auth.models import UserPublic
from features.auth.service import create_or_update_user


def create_catalog_admin(email: str = "ed@example.com", display_name: str = "Ed May") -> UserPublic:
    """Create (or reset) a user with catalog-admin rights (`is_staff`)."""
    user = create_or_update_user(email=email, display_name=display_name, password="password")
    with transaction() as conn:
        auth_repository.set_user_is_staff(conn, user.id, True)
    return user

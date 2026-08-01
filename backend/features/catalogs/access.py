"""Catalog write authorization.

Catalog reads are open to any signed-in member (catalogs are auth-only, CP-8);
catalog *writes* require the resolved `catalog.edit` capability. That capability
is currently part of `MEMBER_CAPS`, so every signed-in member holds it.
`CatalogEditor` is the dependency the write routes use in place of
`CurrentUser`; it has the same shape (so route bodies keep unpacking
`user, _ = auth`) but fails closed with 403 if a future bundle change removes
the capability.
"""

from __future__ import annotations

from datetime import datetime
from typing import Annotated

from fastapi import Depends

from features.access.capabilities import CATALOG_EDIT
from features.access.user_capabilities import require_user_capability
from features.auth.models import UserPublic
from features.auth.routes import CurrentUser


def require_catalog_editor(auth: CurrentUser) -> tuple[UserPublic, datetime]:
    user, _expires_at = auth
    require_user_capability(user, CATALOG_EDIT)
    return auth


CatalogEditor = Annotated[tuple[UserPublic, datetime], Depends(require_catalog_editor)]

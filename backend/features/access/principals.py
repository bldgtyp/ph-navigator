"""Access principals — who is making a request.

A principal is resolved once at the seam and then mapped to a capability set
(`capabilities.capabilities_for`). Beta resolves only two of them:

- `ViewerPrincipal` — an anonymous, read-only request (`audience="client"`).
  The `certifier` audience exists for the future share mechanism (Phase 5) but
  is not issued yet (and resolves to no capabilities until then).
- `UserPrincipal` — a signed-in user, carrying the `is_staff` flag and the
  user's active grant capabilities so the resolver can honor them.

`TokenPrincipal` (MCP/API bearer tokens acting as their issuer) is intentionally
absent: MCP today authorizes through its own path, and folding it into this seam
is Phase 5 work.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

from features.auth.models import UserPublic

ViewerAudience = Literal["client", "certifier"]


@dataclass(frozen=True)
class ViewerPrincipal:
    """An anonymous, read-only request scoped to a single project by link."""

    audience: ViewerAudience = "client"


@dataclass(frozen=True)
class UserPrincipal:
    """A signed-in user, with the inputs the resolver needs to bundle caps."""

    user: UserPublic
    is_staff: bool = False
    granted_capabilities: frozenset[str] = field(default_factory=frozenset)


Principal = ViewerPrincipal | UserPrincipal

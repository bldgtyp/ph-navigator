"""Catalog-only bearer policy; browser sessions never grant desktop access."""

from fastapi import Request
from starlette import status

from database import connection
from features.auth import repository as auth_repository
from features.auth.service import now_utc
from features.catalogs.materials.service import list_materials
from features.desktop.models import DesktopMaterials, DesktopSession
from features.mcp.service import authenticate_plaintext_token, require_token_scope
from features.shared.errors import api_error


def require_desktop_token(request: Request) -> DesktopSession:
    """Require an active issuer and user-scoped catalog grant on every read."""
    scheme, _, value = request.headers.get("Authorization", "").partition(" ")
    bearer = value.strip() if scheme.lower() == "bearer" else ""
    token = authenticate_plaintext_token(bearer) if bearer else None
    invalid_message = "Bearer token is invalid, expired, or revoked."
    if token is None:
        raise api_error(status.HTTP_401_UNAUTHORIZED, "invalid_token", invalid_message)
    with connection() as conn:
        user = auth_repository.get_user_by_id(conn, token.issued_by_user_id)
    if user is None or not user["is_active"]:
        raise api_error(status.HTTP_401_UNAUTHORIZED, "invalid_token", invalid_message)
    try:
        require_token_scope(token, None, "catalog:read")
    except PermissionError:
        raise api_error(
            status.HTTP_403_FORBIDDEN,
            "forbidden",
            "A user-scoped token with catalog:read is required.",
        ) from None
    return DesktopSession(
        token_label=token.label,
        scopes=token.scopes,
        expires_at=token.expires_at,
        user_email=user["email"],
    )


def get_materials() -> DesktopMaterials:
    """Expose only the existing active-list projection, with stable library identity."""
    return DesktopMaterials(server_time=now_utc(), rows=list_materials(include_inactive=False).items)

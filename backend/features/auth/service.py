"""Auth/session workflow rules."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

from fastapi import Request, Response
from starlette import status

from config import settings
from database import connection, transaction
from features.auth import repository
from features.auth.models import UserPublic
from features.auth.passwords import hash_password, verify_password
from features.shared.errors import api_error

GENERIC_LOGIN_ERROR = "Email or password is incorrect."
DUMMY_PASSWORD_HASH = (
    "$argon2id$v=19$m=65536,t=3,p=4$FUyOba6xeqONvsEcgfV1zQ$Y6Znw5ZZKF/XhK4xrPvXCLkcEwxAzYXt+Njjj/2LpLo"
)


def now_utc() -> datetime:
    return datetime.now(UTC)


def session_expires_at(now: datetime | None = None) -> datetime:
    return (now or now_utc()) + timedelta(minutes=settings.session_lifetime_minutes)


def client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


def user_agent(request: Request) -> str | None:
    return request.headers.get("User-Agent")


def public_user(row: dict[str, object]) -> UserPublic:
    user_id = row["id"]
    if not isinstance(user_id, UUID):
        user_id = UUID(str(user_id))
    return UserPublic(id=user_id, email=str(row["email"]), display_name=str(row["display_name"]))


def set_session_cookie(response: Response, session_id: UUID, expires_at: datetime) -> None:
    response.set_cookie(
        key=settings.session_cookie_name,
        value=str(session_id),
        expires=expires_at,
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite="lax",
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(
        key=settings.session_cookie_name,
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite="lax",
        path="/",
    )


def create_or_update_user(email: str, display_name: str, password: str) -> UserPublic:
    password_hash = hash_password(password)
    with transaction() as conn:
        user = repository.upsert_user(conn, email=email, display_name=display_name, password_hash=password_hash)
    return public_user(user)


def authenticate(email: str, password: str, request: Request) -> tuple[UserPublic, UUID, datetime]:
    ip_address = client_ip(request)
    agent = user_agent(request)
    now = now_utc()

    with connection() as conn:
        user_row = repository.get_user_by_email(conn, email)
    password_hash = str(user_row["password_hash"]) if user_row else DUMMY_PASSWORD_HASH
    password_valid = verify_password(password, password_hash)
    user_is_active = bool(user_row and user_row["is_active"])

    if user_row is None or not user_is_active or not password_valid:
        with transaction() as conn:
            repository.log_action(
                conn,
                action="login_failed",
                user_id=user_row["id"] if user_row else None,
                email=email,
                session_id=None,
                ip_address=ip_address,
                user_agent=agent,
            )
        raise api_error(status.HTTP_401_UNAUTHORIZED, "invalid_credentials", GENERIC_LOGIN_ERROR)

    result: tuple[UserPublic, UUID, datetime] | None = None
    with transaction() as conn:
        current_user_row = repository.get_user_by_email_for_update(conn, email)
        if (
            current_user_row is None
            or not current_user_row["is_active"]
            or current_user_row["password_hash"] != user_row["password_hash"]
        ):
            repository.log_action(
                conn,
                action="login_failed",
                user_id=current_user_row["id"] if current_user_row else user_row["id"],
                email=email,
                session_id=None,
                ip_address=ip_address,
                user_agent=agent,
            )
            result = None
        else:
            user_row = current_user_row
            user_id = user_row["id"]
            superseded = repository.invalidate_active_sessions(
                conn,
                user_id=user_id,
                reason="superseded_by_new_login",
                invalidated_at=now,
            )
            for old_session in superseded:
                repository.log_action(
                    conn,
                    action="session_invalidated_by_new_login",
                    user_id=user_id,
                    email=user_row["email"],
                    session_id=old_session["id"],
                    ip_address=ip_address,
                    user_agent=agent,
                )

            session_id = uuid4()
            expires_at = session_expires_at(now)
            repository.create_session(
                conn,
                session_id=session_id,
                user_id=user_id,
                expires_at=expires_at,
                ip_address=ip_address,
                user_agent=agent,
            )
            repository.log_action(
                conn,
                action="login",
                user_id=user_id,
                email=user_row["email"],
                session_id=session_id,
                ip_address=ip_address,
                user_agent=agent,
            )
            result = (public_user(user_row), session_id, expires_at)

    if result is None:
        raise api_error(status.HTTP_401_UNAUTHORIZED, "invalid_credentials", GENERIC_LOGIN_ERROR)
    return result


def current_user_from_request(request: Request) -> tuple[UserPublic, datetime]:
    raw_session_id = request.cookies.get(settings.session_cookie_name)
    if not raw_session_id:
        raise api_error(status.HTTP_401_UNAUTHORIZED, "not_authenticated", "Sign-in required.")

    try:
        session_id = UUID(raw_session_id)
    except ValueError as exc:
        raise api_error(status.HTTP_401_UNAUTHORIZED, "invalid_session", "Sign-in required.") from exc

    now = now_utc()
    session_expired = False
    result: tuple[UserPublic, datetime] | None = None
    with transaction() as conn:
        session = repository.get_session_for_update(conn, session_id)
        if session is None:
            raise api_error(status.HTTP_401_UNAUTHORIZED, "invalid_session", "Sign-in required.")

        if session["invalidated_at"] is not None:
            reason = str(session["invalidation_reason"] or "invalidated")
            raise api_error(
                status.HTTP_401_UNAUTHORIZED,
                "session_invalidated",
                "Your session is no longer active.",
                {"reason": reason},
            )

        if session["expires_at"] <= now:
            repository.invalidate_session(conn, session_id, reason="expired", invalidated_at=now)
            session_expired = True
        else:
            user = repository.get_user_by_id(conn, session["user_id"])
            if user is None or not user["is_active"]:
                raise api_error(status.HTTP_401_UNAUTHORIZED, "invalid_session", "Sign-in required.")

            expires_at = session_expires_at(now)
            repository.touch_session(conn, session_id, expires_at)
            result = (public_user(user), expires_at)

    if session_expired:
        raise api_error(
            status.HTTP_401_UNAUTHORIZED,
            "session_expired",
            "Your session expired after inactivity.",
        )

    if result is None:
        raise api_error(status.HTTP_401_UNAUTHORIZED, "invalid_session", "Sign-in required.")
    return result


def sign_out(request: Request) -> None:
    raw_session_id = request.cookies.get(settings.session_cookie_name)
    if not raw_session_id:
        return

    try:
        session_id = UUID(raw_session_id)
    except ValueError:
        return

    now = now_utc()
    with transaction() as conn:
        session = repository.get_session_for_update(conn, session_id)
        if session is None:
            return
        repository.invalidate_session(conn, session_id, reason="signed_out", invalidated_at=now)
        user = repository.get_user_by_id(conn, session["user_id"])
        repository.log_action(
            conn,
            action="sign_out",
            user_id=session["user_id"],
            email=str(user["email"]) if user else None,
            session_id=session_id,
            ip_address=client_ip(request),
            user_agent=user_agent(request),
        )

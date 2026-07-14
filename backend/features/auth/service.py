"""Auth/session workflow rules."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import structlog
from fastapi import Request
from starlette import status

from config import settings
from database import connection, transaction
from features.auth import repository
from features.auth.cookies import queue_session_cookie_clear, queue_session_cookie_refresh
from features.auth.models import AuthSessionResponse, UnitSystem, UserPublic
from features.auth.passwords import hash_password, verify_password
from features.shared.errors import api_error
from features.shared.http import client_ip

GENERIC_LOGIN_ERROR = "Email or password is incorrect."
DUMMY_PASSWORD_HASH = (
    "$argon2id$v=19$m=65536,t=3,p=4$FUyOba6xeqONvsEcgfV1zQ$Y6Znw5ZZKF/XhK4xrPvXCLkcEwxAzYXt+Njjj/2LpLo"
)


def now_utc() -> datetime:
    return datetime.now(UTC)


def has_usable_password(user_row: dict[str, object] | None) -> bool:
    """True when a user row has a set, usable password.

    An *invited*/pending user has ``NULL`` ``password_hash`` and
    ``password_set_at`` and must not be able to sign in. This single predicate
    keeps the invited-vs-active distinction from drifting between the login path
    and the bootstrap command.
    """
    return bool(user_row and user_row["password_hash"] and user_row["password_set_at"])


def session_expires_at(now: datetime | None = None) -> datetime:
    return (now or now_utc()) + timedelta(minutes=settings.session_lifetime_minutes)


def user_agent(request: Request) -> str | None:
    return request.headers.get("User-Agent")


def public_user(row: dict[str, object]) -> UserPublic:
    user_id = row["id"]
    if not isinstance(user_id, UUID):
        user_id = UUID(str(user_id))
    units_preference = row.get("units_preference", "SI")
    return UserPublic(
        id=user_id,
        email=str(row["email"]),
        display_name=str(row["display_name"]),
        units_preference="IP" if units_preference == "IP" else "SI",
    )


def create_or_update_user(email: str, display_name: str, password: str) -> UserPublic:
    password_hash = hash_password(password)
    with transaction() as conn:
        user = repository.upsert_user(conn, email=email, display_name=display_name, password_hash=password_hash)
    return public_user(user)


def authenticate(email: str, password: str, request: Request) -> tuple[UserPublic, UUID, datetime]:
    """Verify credentials and start a new session for ``email``.

    Runs in three transaction scopes so that constant-time password
    verification happens outside any write transaction: a read-only
    ``connection()`` fetches the candidate user row, then a first
    ``transaction()`` records the ``login_failed`` audit on any failure,
    and a second ``transaction()`` re-fetches the row ``FOR UPDATE``,
    invalidates every active session for the user (single-active-session
    rule), creates the new session, and writes the ``login`` audit. All
    failures raise ``api_error(401, "invalid_credentials")`` with the
    generic message so the response is identical for unknown email,
    inactive user, and wrong password.
    """
    ip_address = client_ip(request)
    agent = user_agent(request)
    now = now_utc()

    with connection() as conn:
        user_row = repository.get_user_by_email(conn, email)
    # An invited/pending user has no usable password yet. Verify against the
    # dummy hash to keep the timing constant, then force the result invalid so
    # they cannot sign in.
    can_authenticate = has_usable_password(user_row)
    password_hash = str(user_row["password_hash"]) if (can_authenticate and user_row) else DUMMY_PASSWORD_HASH
    password_valid = verify_password(password, password_hash) and can_authenticate
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
            repository.insert_session(
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
    structlog.contextvars.bind_contextvars(user_id=str(result[0].id))
    return result


def current_user_from_request(request: Request) -> tuple[UserPublic, datetime]:
    """Resolve the session cookie to the current user, touching the session.

    Single transaction that joins the session and user rows, rejects
    invalidated or expired sessions, and (subject to the
    ``session_touch_throttle_seconds`` rate limit) extends the session's
    ``last_seen_at`` + ``expires_at`` in place. Raises
    ``api_error(401, ...)`` with one of ``not_authenticated``,
    ``invalid_session``, ``session_invalidated``, or ``session_expired``
    depending on which gate fails; the route layer turns these into the
    standard 401 envelope.
    """
    raw_session_id = request.cookies.get(settings.session_cookie_name)
    if not raw_session_id:
        raise api_error(status.HTTP_401_UNAUTHORIZED, "not_authenticated", "Sign-in required.")

    try:
        session_id = UUID(raw_session_id)
    except ValueError as exc:
        queue_session_cookie_clear(request)
        raise api_error(status.HTTP_401_UNAUTHORIZED, "invalid_session", "Sign-in required.") from exc

    now = now_utc()
    session_expired = False
    result: tuple[UserPublic, datetime] | None = None
    with transaction() as conn:
        row = repository.get_session_with_user(conn, session_id)
        if row is None:
            queue_session_cookie_clear(request)
            raise api_error(status.HTTP_401_UNAUTHORIZED, "invalid_session", "Sign-in required.")

        if row["session_invalidated_at"] is not None:
            queue_session_cookie_clear(request)
            reason = str(row["session_invalidation_reason"] or "invalidated")
            raise api_error(
                status.HTTP_401_UNAUTHORIZED,
                "session_invalidated",
                "Your session is no longer active.",
                {"reason": reason},
            )

        if row["session_expires_at"] <= now:
            repository.invalidate_session(conn, session_id, reason="expired", invalidated_at=now)
            session_expired = True
        else:
            if not row["user_is_active"]:
                queue_session_cookie_clear(request)
                raise api_error(status.HTTP_401_UNAUTHORIZED, "invalid_session", "Sign-in required.")

            expires_at = session_expires_at(now)
            throttle = settings.session_touch_throttle_seconds
            last_seen_at = row["session_last_seen_at"]
            if throttle <= 0 or (now - last_seen_at).total_seconds() >= throttle:
                repository.touch_session(conn, session_id, expires_at)
            user = public_user(
                {
                    "id": row["user_id"],
                    "email": row["user_email"],
                    "display_name": row["user_display_name"],
                    "units_preference": row["user_units_preference"],
                }
            )
            result = (user, expires_at)

    if session_expired:
        queue_session_cookie_clear(request)
        raise api_error(
            status.HTTP_401_UNAUTHORIZED,
            "session_expired",
            "Your session expired after inactivity.",
        )

    if result is None:
        queue_session_cookie_clear(request)
        raise api_error(status.HTTP_401_UNAUTHORIZED, "invalid_session", "Sign-in required.")
    queue_session_cookie_refresh(request, session_id, result[1])
    structlog.contextvars.bind_contextvars(user_id=str(result[0].id))
    return result


def update_units_preference(
    user: UserPublic,
    expires_at: datetime,
    units_preference: UnitSystem,
    request: Request,
) -> AuthSessionResponse:
    with transaction() as conn:
        current = repository.get_user_by_id(conn, user.id)
        if current is None or not current["is_active"]:
            raise api_error(status.HTTP_401_UNAUTHORIZED, "invalid_session", "Sign-in required.")
        before = str(current["units_preference"])
        updated = repository.update_user_units_preference(conn, user.id, units_preference)
        repository.log_action(
            conn,
            action="auth.units_preference.updated",
            user_id=user.id,
            email=str(updated["email"]),
            session_id=None,
            ip_address=client_ip(request),
            user_agent=user_agent(request),
            details={"before": before, "after": units_preference},
        )
    return AuthSessionResponse(user=public_user(updated), expires_at=expires_at)


def sign_out(request: Request) -> None:
    """Invalidate the session referenced by the request cookie.

    No-op when the cookie is missing or malformed so the endpoint is
    safe to call from any client state. When a session row is found, a
    single transaction marks it ``signed_out`` and writes a ``sign_out``
    audit entry. Never raises; clearing the client cookie is the route's
    job.
    """
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
        structlog.contextvars.bind_contextvars(user_id=str(session["user_id"]))
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

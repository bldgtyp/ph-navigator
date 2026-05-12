"""Password hashing for PHN editor accounts."""

from __future__ import annotations

from argon2 import PasswordHasher
from argon2.exceptions import Argon2Error, VerifyMismatchError

from config import settings


def _password_hasher() -> PasswordHasher:
    return PasswordHasher(
        time_cost=settings.password_argon2_time_cost,
        memory_cost=settings.password_argon2_memory_cost,
        parallelism=settings.password_argon2_parallelism,
    )


def hash_password(password: str) -> str:
    return _password_hasher().hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return _password_hasher().verify(password_hash, password)
    except (VerifyMismatchError, Argon2Error):
        return False

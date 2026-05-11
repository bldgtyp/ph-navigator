"""Raw psycopg connection helpers.

PHN-V2 uses raw parameterized SQL in repository modules. Pydantic models
own validation and typed app boundaries; there is no SQLAlchemy ORM layer.
Alembic still uses SQLAlchemy internally for migrations, but app code
should get database access through this module.
"""
from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any

from psycopg import Connection
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from config import settings

_pool: ConnectionPool[Connection[Any]] | None = None


def get_pool() -> ConnectionPool[Connection[Any]]:
    """Return the process-wide psycopg connection pool."""
    global _pool
    if _pool is None:
        _pool = ConnectionPool(
            conninfo=settings.database_url,
            kwargs={"row_factory": dict_row},
            open=True,
        )
    return _pool


@contextmanager
def connection() -> Iterator[Connection[Any]]:
    """Yield a pooled connection for repository read operations."""
    with get_pool().connection() as conn:
        yield conn


@contextmanager
def transaction() -> Iterator[Connection[Any]]:
    """Yield a pooled connection wrapped in a database transaction."""
    with get_pool().connection() as conn:
        with conn.transaction():
            yield conn


def close_pool() -> None:
    """Close the process-wide pool; primarily for test teardown."""
    global _pool
    if _pool is not None:
        _pool.close()
        _pool = None

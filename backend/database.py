"""Raw psycopg connection helpers.

PHN-V2 uses raw parameterized SQL in repository modules. Pydantic models
own validation and typed app boundaries; there is no SQLAlchemy ORM layer.
Alembic still uses SQLAlchemy internally for migrations, but app code
should get database access through this module.
"""

from __future__ import annotations

import threading
from collections.abc import Callable, Iterator
from contextlib import contextmanager
from time import perf_counter
from typing import Any, cast

import structlog
from psycopg import Connection
from psycopg.cursor import Cursor
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from config import settings

_pool: ConnectionPool[Connection[Any]] | None = None
_pool_lock = threading.Lock()
log = structlog.get_logger(__name__)

Execute = Callable[..., Cursor[Any]]


def get_pool() -> ConnectionPool[Connection[Any]]:
    """Return the process-wide psycopg connection pool.

    The first call may be made concurrently from multiple threads or
    async tasks; the lock guarantees only one `ConnectionPool` is
    constructed for the process. The double-check avoids paying the
    lock cost on every steady-state call.
    """
    global _pool
    if _pool is None:
        with _pool_lock:
            if _pool is None:
                _pool = ConnectionPool(
                    conninfo=settings.database_url,
                    kwargs={"row_factory": dict_row},
                    min_size=settings.database_pool_min_size,
                    max_size=settings.database_pool_max_size,
                    timeout=settings.database_pool_timeout_seconds,
                    check=ConnectionPool.check_connection,
                    open=False,
                )
    return _pool


def open_pool() -> None:
    """Open and warm the process-wide pool."""
    pool = get_pool()
    if pool.closed:
        pool.open()
        pool.wait()


def pool_stats() -> dict[str, int]:
    """Return psycopg pool stats as plain ints for logs/API responses."""
    return {key: int(value) for key, value in get_pool().get_stats().items()}


@contextmanager
def connection() -> Iterator[Connection[Any]]:
    """Yield a pooled connection for repository read operations."""
    open_pool()
    with get_pool().connection() as conn:
        original_execute = _install_execute_timer(conn, op="connection")
        try:
            yield conn
        except Exception:
            conn.rollback()
            raise
        else:
            conn.commit()
        finally:
            cast(Any, conn).execute = original_execute


@contextmanager
def transaction() -> Iterator[Connection[Any]]:
    """Yield a pooled connection wrapped in a database transaction."""
    open_pool()
    with get_pool().connection() as conn:
        original_execute = _install_execute_timer(conn, op="transaction")
        try:
            with conn.transaction():
                yield conn
        finally:
            cast(Any, conn).execute = original_execute


def close_pool() -> None:
    """Close the process-wide pool; primarily for test teardown."""
    global _pool
    with _pool_lock:
        if _pool is not None:
            _pool.close()
            _pool = None


def check_connection() -> bool:
    """Return True when the configured database accepts a simple query."""
    with connection() as conn:
        row = conn.execute("SELECT 1 AS ok").fetchone()
    return bool(row and row["ok"] == 1)


def _install_execute_timer(conn: Connection[Any], *, op: str) -> Execute:
    original_execute = conn.execute

    def timed_execute(*args: Any, **kwargs: Any) -> Cursor[Any]:
        start = perf_counter()
        try:
            return original_execute(*args, **kwargs)
        finally:
            duration_ms = round((perf_counter() - start) * 1000, 2)
            if duration_ms >= settings.slow_query_ms:
                log.warning("db.slow_query", duration_ms=duration_ms, op=op)

    cast(Any, conn).execute = timed_execute
    return original_execute

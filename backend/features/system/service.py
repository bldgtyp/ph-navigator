"""System health/readiness service helpers."""

from __future__ import annotations

from time import perf_counter

import structlog

from database import check_connection, pool_stats

log = structlog.get_logger(__name__)


def readiness() -> dict[str, object]:
    start = perf_counter()
    ok = check_connection()
    duration_ms = round((perf_counter() - start) * 1000, 2)
    stats = pool_stats()
    log.info("system.ready", db_ok=ok, db_ms=duration_ms, **stats)
    return {"status": "ok" if ok else "unavailable", "db": ok, "db_ms": duration_ms, "pool": stats}

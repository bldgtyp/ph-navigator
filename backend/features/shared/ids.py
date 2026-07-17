"""Small shared ID generators for timestamp-ordered workflow records."""

from __future__ import annotations

from datetime import UTC, datetime


def timestamp_id(prefix: str) -> str:
    return f"{prefix}_{datetime.now(tz=UTC).strftime('%Y%m%d%H%M%S%f')}"

"""Raw-SQL persistence for applied licensed dataset audit rows."""

from __future__ import annotations

from typing import Any

from psycopg import Connection


def lock_dataset(conn: Connection[Any], slug: str) -> None:
    """Serialize target mutation and audit recording for one dataset slug."""
    conn.execute(
        "SELECT pg_advisory_xact_lock(hashtextextended(%(slug)s, 0))",
        {"slug": slug},
    )


def latest_applied(conn: Connection[Any], slug: str) -> dict[str, Any] | None:
    return conn.execute(
        """
        SELECT slug, version, sha256, applied_at, applied_by
        FROM applied_datasets
        WHERE slug = %(slug)s
        ORDER BY applied_at DESC, version DESC
        LIMIT 1
        """,
        {"slug": slug},
    ).fetchone()


def record_applied(
    conn: Connection[Any],
    *,
    slug: str,
    version: str,
    sha256: str,
    applied_by: str,
) -> bool:
    """Insert or refresh an audit row; refuse checksum drift under one version."""
    row = conn.execute(
        """
        INSERT INTO applied_datasets (slug, version, sha256, applied_by)
        VALUES (%(slug)s, %(version)s, %(sha256)s, %(applied_by)s)
        ON CONFLICT (slug, version) DO UPDATE
        SET applied_at = now(),
            applied_by = EXCLUDED.applied_by
        WHERE applied_datasets.sha256 = EXCLUDED.sha256
        RETURNING slug
        """,
        {
            "slug": slug,
            "version": version,
            "sha256": sha256,
            "applied_by": applied_by,
        },
    ).fetchone()
    return row is not None

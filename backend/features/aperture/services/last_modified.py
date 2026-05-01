# -*- Python Version: 3.11 -*-
"""Aggregate ``last_modified`` for an aperture's full type definition.

The HB Room Builder Rhino plugin needs a single per-aperture
"has this type been touched?" timestamp. The "type definition"
spans six tables (per plan §4):

* the aperture row itself
* its child element rows
* each element's glazing child row
* each element's four frame child rows (top / right / bottom / left)
* the referenced glazing-type catalog row
* the referenced frame-type catalog row

Each of those rows carries its own DB-clock ``last_modified`` stamp
(``server_default=func.now()`` + ``onupdate=func.now()``), so the
aggregate is a deterministic max() over them at read time. Catalog
edits propagate through the walk without coupling catalog write
paths to aperture write paths.

The serialized wire format is committed to ISO-8601 UTC with a
trailing ``Z`` (e.g. ``"2026-04-28T14:32:00Z"``). The Rhino plugin
does literal string equality between stored and freshly-fetched
values, so anything that yields ``"+00:00"`` would silently flag
every block as stale on first sync.
"""

from __future__ import annotations

from datetime import datetime, timezone

from db_entities.aperture.aperture import Aperture
from features.aperture.schemas.aperture import FrameSide


def _ensure_aware(dt: datetime) -> datetime:
    """Defensively attach UTC tzinfo if absent.

    On SQLite (the test backend) ``DateTime(timezone=True)`` columns
    return naive datetimes — the tz info is dropped on read because
    SQLite has no native ``timestamptz``. On Postgres (production)
    the value is already aware. We always assume any naive datetime
    represents UTC, consistent with how ``func.now()`` writes are
    stored under ``timestamptz``.

    Without this normalization, ``.astimezone(timezone.utc)`` on the
    returned aggregate raises ``ValueError`` on the test path while
    production stays green — exactly the kind of "passes locally,
    breaks in CI" trap we neutralize at the helper.
    """
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


def compute_aperture_effective_last_modified(aperture: Aperture) -> datetime:
    """Return max() ``last_modified`` across the aperture's type definition.

    Walks the aperture row, every loaded element, each element's
    glazing + glazing-type and four frames + frame-types. Any None
    children (an unassigned glazing or frame side) are skipped.

    The returned datetime is always tz-aware (UTC). Callers should
    serialize with ``.isoformat().replace("+00:00", "Z")``.
    """
    candidates: list[datetime] = [aperture.last_modified]

    for element in aperture.elements:
        candidates.append(element.last_modified)

        if element.glazing is not None:
            candidates.append(element.glazing.last_modified)
            if element.glazing.glazing_type is not None:
                candidates.append(element.glazing.glazing_type.last_modified)

        for side in FrameSide:
            frame = getattr(element, f"frame_{side.value}")
            if frame is None:
                continue
            candidates.append(frame.last_modified)
            if frame.frame_type is not None:
                candidates.append(frame.frame_type.last_modified)

    # Filter out any None stamps defensively (e.g. partially-migrated
    # dev DBs) before normalizing tz info — see _ensure_aware.
    return max(_ensure_aware(c) for c in candidates if c is not None)


def format_last_modified(dt: datetime) -> str:
    """Format an aware datetime as the committed UTC-with-``Z`` wire format.

    The Rhino plugin compares the stored value on each block against
    a fresh API value byte-for-byte, so the format MUST be stable —
    ``"+00:00"`` and ``"Z"`` are both valid ISO-8601 but not byte-equal.
    """
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")

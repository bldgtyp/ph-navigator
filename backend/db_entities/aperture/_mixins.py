# -*- Python Version: 3.11 -*-
"""Shared SQLAlchemy mixins for the aperture domain."""

from datetime import datetime

from sqlalchemy import DateTime, func
from sqlalchemy.orm import Mapped, mapped_column


class LastModifiedMixin:
    """Adds a DB-clock ``last_modified`` column to a mapped class.

    The aperture catalog endpoint aggregates ``last_modified`` across
    six related tables (parent aperture + elements + glazing/frame
    children + glazing-type/frame-type catalog rows) into a single
    per-aperture wire field. ``func.now()`` is used for both the
    server default and ``onupdate`` so timestamps are monotonic per
    row across multi-pod app deployments — the DB clock is the only
    source of truth.
    """

    last_modified: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

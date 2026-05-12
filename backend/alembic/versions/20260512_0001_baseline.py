"""baseline

Revision ID: 20260512_0001
Revises:
Create Date: 2026-05-12 10:30:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

revision: str = "20260512_0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Baseline migration; no app tables exist before TB-01."""


def downgrade() -> None:
    """Return to the pre-baseline empty schema."""

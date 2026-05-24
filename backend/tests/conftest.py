"""Shared pytest fixtures for the backend test suite.

Backend test fixtures `TRUNCATE` every table in the database they're
pointed at. To make sure pytest can never wipe the developer's local
dev rows, this conftest pins `DATABASE_URL` to the dedicated
`ph_navigator_v2_test` database before any backend module imports
`config.settings`. The `Settings` instance reads env at import time, so
the override must happen at the very top of this file — before the
first `from database ...` / `from config ...` import below.

A session-scoped safety-net fixture asserts the final URL still points
at a `*_test` database. If a future refactor breaks the override, the
suite refuses to start instead of silently nuking dev data.

See `docs/plans/2026-05-24/plan-10-separate-test-database.md`.
"""

from __future__ import annotations

import os

# Default to the local test DB. Honor any pre-set `DATABASE_URL` so CI /
# the Makefile can point at a different *_test database, but never let
# the safety net below pass through to a non-`*_test` target.
os.environ.setdefault(
    "DATABASE_URL",
    "postgresql://phn:phn_local_only@localhost:5433/ph_navigator_v2_test",
)

from collections.abc import Iterator  # noqa: E402

import pytest  # noqa: E402

from config import settings  # noqa: E402
from database import transaction  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def _refuse_to_truncate_dev_db() -> None:
    """Abort the test session if pytest isn't pointed at a *_test database."""
    if not settings.database_url.endswith("_test"):
        raise RuntimeError(
            f"Refusing to run tests against {settings.database_url}. "
            "Backend tests TRUNCATE every table — they must run against "
            "a *_test database (default: ph_navigator_v2_test)."
        )


@pytest.fixture()
def clean_document_tables() -> Iterator[None]:
    """Truncate project-document and auth state before and after a test.

    Reused by `test_project_document.py` and `test_project_document_window_types.py`
    so cross-table contract tests don't need to import the fixture across files
    (which trips ruff F811).
    """
    _truncate()
    yield
    _truncate()


def _truncate() -> None:
    with transaction() as conn:
        conn.execute(
            """
            TRUNCATE user_action_log, sessions, project_status_items,
                     project_version_drafts, project_versions, projects, users
            RESTART IDENTITY CASCADE
            """
        )

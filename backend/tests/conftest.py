"""Shared pytest fixtures for the backend test suite.

Backend test fixtures `TRUNCATE` every table in the database they're
pointed at. To make sure pytest can never wipe the developer's local
dev rows, this conftest pins `DATABASE_URL` to the dedicated
`ph_navigator_v2_test` database before any backend module imports
`config.settings`. The `Settings` instance reads env at import time, so
the override must happen at the very top of this file — before the
first `from database ...` / `from config ...` import below.

Under `pytest-xdist`, each worker (`gw0`, `gw1`, ...) is routed to its
own database (`ph_navigator_v2_test_gw0`, `..._gw1`, ...) so workers
don't TRUNCATE each other's rows mid-run. The active test database is
created + migrated lazily on first use; it persists between sessions
(idempotent migrations make this cheap). This keeps direct
`uv run pytest ...` invocations aligned with the Makefile test recipes.

A session-scoped safety-net fixture asserts the final URL still points
at a `*_test` or `*_test_gw<N>` database. If a future refactor breaks
the override, the suite refuses to start instead of silently nuking
dev data.

See `docs/plans/2026-05-24/plan-10-separate-test-database.md` and
`planning/code-reviews/2026-06-08/backend-test-suite-speedup.md`.
"""

from __future__ import annotations

import os
import re
from urllib.parse import urlparse, urlunparse


def _route_database_url_for_worker() -> None:
    """Suffix DATABASE_URL with the xdist worker id, if any.

    Runs at import time so `config.settings` (read once on first import)
    sees the worker-scoped URL.
    """
    os.environ.setdefault(
        "DATABASE_URL",
        "postgresql://phn:phn_local_only@localhost:5433/ph_navigator_v2_test",
    )
    worker = os.environ.get("PYTEST_XDIST_WORKER")
    if not worker or worker == "master":
        return
    parsed = urlparse(os.environ["DATABASE_URL"])
    new_path = f"{parsed.path}_{worker}"
    os.environ["DATABASE_URL"] = urlunparse(parsed._replace(path=new_path))


_route_database_url_for_worker()


def _bootstrap_test_database() -> None:
    """Create + migrate the active test DB if missing or stale."""
    import psycopg  # noqa: E402 — defer until after env routing
    from psycopg import sql

    parsed = urlparse(os.environ["DATABASE_URL"])
    target_db = parsed.path.lstrip("/")
    admin_url = urlunparse(parsed._replace(path="/postgres"))
    if not re.fullmatch(r"[A-Za-z0-9_]+_test(?:_gw\d+)?", target_db):
        raise RuntimeError(f"Refusing to bootstrap database with unexpected name {target_db!r}.")

    with psycopg.connect(admin_url, autocommit=True) as conn:
        existing = conn.execute("SELECT 1 FROM pg_database WHERE datname = %s", (target_db,)).fetchone()
        if existing is None:
            # Postgres rejects a parameterized database name in DDL, so we have
            # to interpolate the identifier. The name is validated above and
            # then quoted as an identifier here.
            conn.execute(sql.SQL("CREATE DATABASE {} OWNER phn").format(sql.Identifier(target_db)))

    # Run migrations against the (possibly fresh) test DB. Import lazily
    # because alembic transitively imports `config`, which freezes settings
    # against the current DATABASE_URL.
    from alembic.config import Config

    from alembic import command

    cfg = Config("alembic.ini")
    command.upgrade(cfg, "head")


_bootstrap_test_database()


from collections.abc import Iterator  # noqa: E402

import pytest  # noqa: E402

from config import settings  # noqa: E402
from database import transaction  # noqa: E402

_TEST_DB_PATTERN = re.compile(r"_test(?:_gw\d+)?$")


@pytest.fixture(scope="session", autouse=True)
def _refuse_to_truncate_dev_db() -> None:
    """Abort the test session if pytest isn't pointed at a *_test database."""
    parsed = urlparse(settings.database_url)
    db_name = parsed.path.lstrip("/")
    if not _TEST_DB_PATTERN.search(db_name):
        raise RuntimeError(
            f"Refusing to run tests against {settings.database_url}. "
            "Backend tests TRUNCATE every table — they must run against "
            "a *_test (or *_test_gw<N>) database."
        )


@pytest.fixture()
def clean_document_tables() -> Iterator[None]:
    """Truncate project-document and auth state before and after a test.

    Shared across the project-document test modules so cross-table contract
    tests don't need to import the fixture across files (which trips ruff
    F811).
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


_CATALOG_TRUNCATE = """
TRUNCATE catalog_materials, catalog_frame_types,
         catalog_glazing_types,
         user_action_log, sessions, project_status_items,
         project_version_drafts, project_versions, projects, users
RESTART IDENTITY CASCADE
"""


@pytest.fixture()
def clean_catalog_tables() -> Iterator[None]:
    """Truncate catalog + auth/project state before and after a test.

    Shared by the materials/frame/glazing catalog test modules so they
    don't each redeclare the same fixture and TRUNCATE statement.
    """
    _truncate_catalogs()
    yield
    _truncate_catalogs()


def _truncate_catalogs() -> None:
    with transaction() as conn:
        conn.execute(_CATALOG_TRUNCATE)

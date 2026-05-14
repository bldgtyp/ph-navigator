"""Shared pytest fixtures for the backend test suite."""

from __future__ import annotations

from collections.abc import Iterator

import pytest

from database import transaction


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

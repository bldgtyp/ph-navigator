"""Safety guards for operator-only dataset scripts."""

from __future__ import annotations

import pytest

from config import settings
from scripts.datasets_apply import _guard_environment


def test_apply_refuses_nonlocal_database_without_override(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "environment", "production")
    monkeypatch.setattr(settings, "database_url", "postgresql://example.invalid/phn")
    monkeypatch.setattr(settings, "phn_datasets_allow_production", False)

    with pytest.raises(SystemExit, match="non-local database"):
        _guard_environment()


def test_apply_accepts_deliberate_production_override(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "environment", "production")
    monkeypatch.setattr(settings, "database_url", "postgresql://example.invalid/phn")
    monkeypatch.setattr(settings, "phn_datasets_allow_production", True)
    monkeypatch.setattr(settings, "phn_datasets_applied_by", "github-actions")

    _guard_environment()


def test_production_override_requires_explicit_audit_identity(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "environment", "production")
    monkeypatch.setattr(settings, "database_url", "postgresql://example.invalid/phn")
    monkeypatch.setattr(settings, "phn_datasets_allow_production", True)
    monkeypatch.setattr(settings, "phn_datasets_applied_by", "local-cli")

    with pytest.raises(SystemExit, match="PHN_DATASETS_APPLIED_BY"):
        _guard_environment()

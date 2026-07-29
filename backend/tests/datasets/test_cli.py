"""Safety guards for operator-only dataset scripts."""

from __future__ import annotations

import json

import pytest

from config import settings
from scripts.datasets_apply import _RESULT_PREFIX, _guard_environment, _report, _report_no_pending
from scripts.seed_surface_films import main as retired_surface_film_seed


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


def test_legacy_surface_film_publisher_points_to_pipeline() -> None:
    with pytest.raises(SystemExit, match="ph-navigator-data"):
        retired_surface_film_seed()


def test_apply_report_emits_a_sanitized_machine_record(capsys: pytest.CaptureFixture[str]) -> None:
    _report(
        "synthetic-seed",
        "2",
        "a" * 64,
        matched=3,
        updated=1,
        unchanged=2,
        unmatched=0,
    )

    machine_line = capsys.readouterr().out.splitlines()[-1]
    assert machine_line.startswith(_RESULT_PREFIX)
    assert json.loads(machine_line.removeprefix(_RESULT_PREFIX)) == {
        "status": "applied",
        "slug": "synthetic-seed",
        "version": "2",
        "sha256": "a" * 64,
        "matched": 3,
        "updated": 1,
        "unchanged": 2,
        "unmatched": 0,
    }


def test_no_pending_report_emits_a_machine_record(capsys: pytest.CaptureFixture[str]) -> None:
    _report_no_pending()

    assert capsys.readouterr().out.splitlines()[-1] == (_RESULT_PREFIX + '{"datasets":[],"status":"no_pending"}')

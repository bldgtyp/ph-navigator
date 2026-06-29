from __future__ import annotations

import pytest

from features.projects.models import CreateProjectRequest
from scripts import seed_perf_stress_fixture as perf_fixture


def test_stress_project_document_can_build_250_row_fixture() -> None:
    payload = CreateProjectRequest(
        name="Frontend Perf Stress Fixture",
        bt_number="PERF-STRESS",
        client="Codex",
        cert_programs=["phi"],
        phius_number=None,
        phius_dropbox_url=None,
    )

    document = perf_fixture._stress_project_document(payload, table_rows=250, equipment_rows=250)

    assert len(document.tables.rooms.rows) == 250
    assert len(document.tables.space_types.rows) == 250
    assert len(document.tables.thermal_bridges.rows) == 250
    assert len(document.tables.equipment.pumps.rows) == 250
    assert len(document.tables.equipment.fans.rows) == 250
    assert len(document.tables.equipment.ervs.rows) == 250
    assert len(document.tables.equipment.hot_water_heaters.rows) == 250
    assert len(document.tables.equipment.hot_water_tanks.rows) == 250
    assert len(document.tables.equipment.electric_heaters.rows) == 250
    assert len(document.tables.equipment.appliances.rows) == 250
    assert document.tables.assemblies
    assert document.tables.apertures


def test_production_fixture_guard_requires_production_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(perf_fixture.settings, "environment", "development")

    with pytest.raises(SystemExit, match="ENVIRONMENT=production"):
        perf_fixture._assert_production_fixture_allowed(confirm_production=True)


def test_production_fixture_guard_requires_confirmation(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(perf_fixture.settings, "environment", "production")

    with pytest.raises(SystemExit, match="--confirm-production"):
        perf_fixture._assert_production_fixture_allowed(confirm_production=False)

    perf_fixture._assert_production_fixture_allowed(confirm_production=True)


def test_production_fixture_guard_restricts_account_and_project(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(perf_fixture.settings, "environment", "production")

    with pytest.raises(SystemExit, match="codex@testing.com"):
        perf_fixture._assert_production_fixture_allowed(confirm_production=True, email="other@example.com")

    with pytest.raises(SystemExit, match="PERF-STRESS"):
        perf_fixture._assert_production_fixture_allowed(confirm_production=True, bt_number="OTHER")

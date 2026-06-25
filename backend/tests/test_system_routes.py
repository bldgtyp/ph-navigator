"""System health/readiness route tests."""

from __future__ import annotations

from fastapi.testclient import TestClient

from main import app


def test_ready_checks_database_and_reports_pool_stats() -> None:
    response = TestClient(app).get("/api/v1/ready")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["db"] is True
    assert isinstance(payload["db_ms"], float)
    assert isinstance(payload["pool"], dict)

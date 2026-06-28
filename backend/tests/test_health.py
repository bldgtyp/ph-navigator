"""System-route contract tests for the TB-00 boot tracer."""

from __future__ import annotations

from fastapi.testclient import TestClient

from main import app


def test_health_returns_ok() -> None:
    client = TestClient(app)
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["service"] == "ph-navigator"
    assert payload["phase"] == "tb-00"
    assert payload["api_version"] == "v1"


def test_unversioned_health_route_does_not_exist() -> None:
    client = TestClient(app)
    response = client.get("/api/health")
    assert response.status_code == 404


def test_version_returns_version_metadata() -> None:
    client = TestClient(app)
    response = client.get("/api/v1/version")
    assert response.status_code == 200
    payload = response.json()
    assert payload["service"] == "ph-navigator"
    assert payload["app_version"] == "0.1.0"
    assert payload["api_version"] == "v1"
    assert payload["environment"] == "development"

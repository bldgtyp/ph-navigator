"""Smoke test — the scaffold must answer /api/health.

Real test coverage lands during feature work. This test confirms the
FastAPI app is wireable from a fresh clone after `make setup`.
"""
from __future__ import annotations

from fastapi.testclient import TestClient

from main import app


def test_health_returns_ok() -> None:
    client = TestClient(app)
    response = client.get("/api/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["service"] == "ph-navigator-v2"

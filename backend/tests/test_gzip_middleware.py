"""Smoke tests for `GZipMiddleware` registration on the FastAPI app."""

from __future__ import annotations

from fastapi.testclient import TestClient

from main import app


def test_large_response_compressed_when_accept_encoding_gzip() -> None:
    # OpenAPI schema is large (>1 KB) and unauthenticated — ideal for testing
    # the gzip threshold without needing fixtures.
    client = TestClient(app)
    response = client.get(
        "/api/v1/openapi.json",
        headers={"Accept-Encoding": "gzip"},
    )
    assert response.status_code == 200
    assert response.headers.get("content-encoding") == "gzip"


def test_response_not_compressed_when_identity_requested() -> None:
    client = TestClient(app)
    response = client.get(
        "/api/v1/openapi.json",
        headers={"Accept-Encoding": "identity"},
    )
    assert response.status_code == 200
    assert "content-encoding" not in response.headers


def test_small_response_not_compressed() -> None:
    # /api/v1/health returns a small JSON body (<1 KB); gzip should be skipped
    # even when the client advertises support.
    client = TestClient(app)
    response = client.get(
        "/api/v1/health",
        headers={"Accept-Encoding": "gzip"},
    )
    assert response.status_code == 200
    assert "content-encoding" not in response.headers

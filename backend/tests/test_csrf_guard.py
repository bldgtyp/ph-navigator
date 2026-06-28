"""Tests for the defense-in-depth CSRF / Origin guard on mutating API writes.

The guard lives in `features/shared/middleware.py` and runs before routing, so
these tests exercise it against the `/api/v1/admin/` path prefix even though the
admin routes themselves are added in a later phase. Two independent gates apply
to mutating `/api/` requests:

1. a global trusted-`Origin` allow-list (all routes); and
2. an app-only custom header (`X-PHN-CSRF`) on the admin surface.
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from config import settings
from main import app

ORIGIN = "http://localhost:5173"
ADMIN_PATH = "/api/v1/admin/users/invite"


def test_admin_mutation_without_csrf_header_is_rejected() -> None:
    client = TestClient(app)

    response = client.post(ADMIN_PATH, headers={"Origin": ORIGIN}, json={})

    assert response.status_code == 403
    assert response.json()["error_code"] == "csrf_header_missing"


def test_admin_mutation_with_csrf_header_passes_the_guard() -> None:
    client = TestClient(app)

    response = client.post(
        ADMIN_PATH,
        headers={"Origin": ORIGIN, settings.csrf_header_name: "1"},
        json={},
    )

    # The route does not exist yet, so a clean pass through the guard surfaces as
    # a 404 (or auth error) — never a CSRF/Origin 403.
    assert response.status_code != 403
    assert response.json().get("error_code") != "csrf_header_missing"


def test_admin_mutation_from_untrusted_origin_is_rejected_before_csrf_check() -> None:
    client = TestClient(app)

    response = client.post(ADMIN_PATH, headers={"Origin": "https://evil.test"}, json={})

    assert response.status_code == 403
    assert response.json()["error_code"] == "origin_not_allowed"


def test_non_admin_mutation_does_not_require_csrf_header() -> None:
    client = TestClient(app)

    # Logout is a non-admin mutating route; the Origin guard still applies but the
    # custom-header requirement is scoped to the admin surface only.
    response = client.post("/api/v1/auth/logout", headers={"Origin": ORIGIN})

    assert response.status_code == 204


def test_safe_admin_method_skips_the_csrf_header_requirement() -> None:
    client = TestClient(app)

    # GET is not a mutating method, so the guard never demands the header; an
    # unknown route falls through to a 404 rather than a CSRF 403.
    response = client.get(ADMIN_PATH, headers={"Origin": ORIGIN})

    assert response.status_code != 403

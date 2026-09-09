"""Desktop bearer, device-grant, and reversible scope migration contracts."""

from collections.abc import Iterator
from datetime import UTC, datetime

import psycopg
import pytest
from alembic.config import Config
from fastapi.testclient import TestClient

from alembic import command
from config import settings
from database import connection, transaction
from features.auth.service import create_or_update_user
from features.mcp.models import ALL_MCP_SCOPES, READ_ONLY_SCOPES
from features.mcp.rate_limit import reset_device_rate_limiters
from main import app
from tests.catalog_helpers import create_catalog_admin

ORIGIN = "http://localhost:5173"
EMAIL = "desktop@example.com"
BASE = "/api/v1/desktop"
ENDPOINTS = (f"{BASE}/session", f"{BASE}/catalogs/materials")


@pytest.fixture(autouse=True)
def desktop_state(clean_catalog_tables: None, monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    monkeypatch.setattr(settings, "agent_device_rate_limit_enabled", False)
    reset_device_rate_limiters()
    yield
    reset_device_rate_limiters()


def signed_in_client() -> TestClient:
    create_or_update_user(email=EMAIL, display_name="Desktop tester", password="password")
    client = TestClient(app)
    response = client.post(
        "/api/v1/auth/login",
        headers={"Origin": ORIGIN},
        json={"email": EMAIL, "password": "password"},
    )
    assert response.status_code == 200, response.text
    return client


def issue_token(client: TestClient, scopes: list[str] | None = None, project_id: str | None = None) -> dict:
    route = f"/api/v1/projects/{project_id}/mcp-tokens" if project_id else "/api/v1/agent-tokens"
    response = client.post(
        route,
        headers={"Origin": ORIGIN},
        json={"label": "PH-Navigator for SketchUp", "scopes": scopes or ["catalog:read"]},
    )
    assert response.status_code == 201, response.text
    return response.json()


def bearer(issued: dict) -> dict[str, str]:
    return {"Authorization": f"Bearer {issued['token']}"}


def start_device(client: TestClient, scopes: list[str]) -> dict:
    response = client.post(
        "/api/v1/agent-tokens/device",
        json={"label": "PH-Navigator for SketchUp", "scopes": scopes},
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_session_and_active_material_projection() -> None:
    client = signed_in_client()
    issued = issue_token(client)
    # Catalog read is available to a normal member; catalog writes use a separate admin.
    create_catalog_admin(email="catalog-admin@example.com", display_name="Catalog admin")
    admin = TestClient(app)
    assert (
        admin.post(
            "/api/v1/auth/login",
            headers={"Origin": ORIGIN},
            json={"email": "catalog-admin@example.com", "password": "password"},
        ).status_code
        == 200
    )
    for name in ("Active synthetic material", "Inactive synthetic material"):
        created = admin.post(
            "/api/v1/catalogs/materials",
            headers={"Origin": ORIGIN},
            json={"name": name, "category": "insulation", "conductivity_w_mk": 0.04},
        )
        assert created.status_code == 201, created.text
        if name.startswith("Inactive"):
            assert (
                admin.delete(
                    f"/api/v1/catalogs/materials/{created.json()['id']}",
                    headers={"Origin": ORIGIN},
                ).status_code
                == 204
            )

    unsigned = TestClient(app)
    session = unsigned.get(ENDPOINTS[0], headers=bearer(issued))
    assert session.status_code == 200, session.text
    assert session.json() == {
        "token_label": "PH-Navigator for SketchUp",
        "scopes": ["catalog:read"],
        "expires_at": issued["token_record"]["expires_at"],
        "user_email": EMAIL,
    }
    before = datetime.now(UTC)
    catalog = unsigned.get(ENDPOINTS[1], headers=bearer(issued))
    assert catalog.status_code == 200, catalog.text
    body = catalog.json()
    assert set(body) == {"kind", "library_id", "server_time", "rows"}
    assert body["kind"] == "materials"
    assert body["library_id"] == "ph-navigator-web:materials"
    assert before <= datetime.fromisoformat(body["server_time"]) <= datetime.now(UTC)
    assert body["rows"] == client.get("/api/v1/catalogs/materials").json()["items"]
    assert [row["name"] for row in body["rows"]] == ["Active synthetic material"]
    assert "created_by" not in body["rows"][0]
    assert unsigned.get(f"{ENDPOINTS[1]}?include_inactive=true", headers=bearer(issued)).json()["rows"] == body["rows"]
    with connection() as conn:
        row = conn.execute(
            "SELECT last_used_at FROM mcp_tokens WHERE id = %s", (issued["token_record"]["id"],)
        ).fetchone()
    assert row is not None and row["last_used_at"] is not None
    # A desktop credential does not authenticate the existing browser catalog route.
    assert unsigned.get("/api/v1/catalogs/materials", headers=bearer(issued)).status_code == 401


@pytest.mark.parametrize("endpoint", ENDPOINTS)
@pytest.mark.parametrize("header", [None, "Basic abc", "Bearer", "Bearer ", "Bearer invalid", "Bearer a b"])
def test_missing_or_malformed_bearer(endpoint: str, header: str | None) -> None:
    # Even a signed-in browser must supply the desktop credential.
    client = signed_in_client()
    response = client.get(endpoint, headers={"Authorization": header} if header else {})
    assert response.status_code == 401
    assert response.json()["error_code"] == "invalid_token"
    assert response.json()["message"] == "Bearer token is invalid, expired, or revoked."


@pytest.mark.parametrize("endpoint", ENDPOINTS)
@pytest.mark.parametrize("state", ["expired", "revoked", "inactive_user"])
def test_unusable_token(endpoint: str, state: str) -> None:
    client = signed_in_client()
    issued = issue_token(client)
    with transaction() as conn:
        if state == "expired":
            conn.execute(
                "UPDATE mcp_tokens SET expires_at = now() - interval '1 second' WHERE id = %s",
                (issued["token_record"]["id"],),
            )
        elif state == "revoked":
            conn.execute("UPDATE mcp_tokens SET revoked_at = now() WHERE id = %s", (issued["token_record"]["id"],))
        else:
            conn.execute("UPDATE users SET deleted_at = now() WHERE email = %s", (EMAIL,))
    response = TestClient(app).get(endpoint, headers=bearer(issued))
    assert response.status_code == 401
    assert response.json()["error_code"] == "invalid_token"


@pytest.mark.parametrize("endpoint", ENDPOINTS)
@pytest.mark.parametrize("project_scoped", [False, True])
def test_wrong_scope_or_project_token(endpoint: str, project_scoped: bool) -> None:
    client = signed_in_client()
    project_id = None
    scopes = ["project:read"]
    if project_scoped:
        project = client.post(
            "/api/v1/projects",
            headers={"Origin": ORIGIN},
            json={"name": "Synthetic desktop test", "bt_number": "9001", "client": "Test", "cert_programs": []},
        )
        assert project.status_code == 201, project.text
        project_id = project.json()["id"]
        scopes.append("catalog:read")
    issued = issue_token(client, scopes, project_id)
    response = TestClient(app).get(endpoint, headers=bearer(issued))
    assert response.status_code == 403
    assert response.json()["error_code"] == "forbidden"


def test_catalog_only_device_flow_and_single_redemption() -> None:
    unsigned = TestClient(app)
    started = start_device(unsigned, ["catalog:read"])
    approver = signed_in_client()
    route = f"/api/v1/agent-tokens/device/{started['user_code']}"
    assert approver.get(route).json()["scopes"] == ["catalog:read"]
    approved = approver.post(route, headers={"Origin": ORIGIN}, json={"decision": "approve"})
    assert approved.status_code == 200, approved.text
    redeemed = unsigned.post("/api/v1/agent-tokens/device/poll", json={"device_code": started["device_code"]})
    assert redeemed.status_code == 200, redeemed.text
    issued = redeemed.json()
    assert issued["status"] == "approved"
    assert issued["token_record"]["project_id"] is None
    assert issued["token_record"]["scopes"] == ["catalog:read"]
    response = unsigned.get(ENDPOINTS[1], headers=bearer(issued))
    assert response.status_code == 200, response.text
    assert response.json()["rows"] == []
    assert unsigned.post("/api/v1/agent-tokens/device/poll", json={"device_code": started["device_code"]}).json() == {
        "status": "expired"
    }


def test_scope_validation_preserves_project_grant_requirement() -> None:
    assert READ_ONLY_SCOPES == ("project:read",)
    assert "catalog:read" in ALL_MCP_SCOPES
    client = TestClient(app)
    for scopes in (["asset:read"], ["project:write"], ["catalog:read", "project:write"], ["unknown"]):
        response = client.post("/api/v1/agent-tokens/device", json={"label": "Invalid grant", "scopes": scopes})
        assert response.status_code == 422


def test_desktop_uses_device_poll_rate_budget(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "agent_device_rate_limit_enabled", True)
    monkeypatch.setattr(settings, "agent_device_poll_per_ip_per_minute", 1)
    unsigned = TestClient(app)
    assert unsigned.get(ENDPOINTS[0]).status_code == 401
    response = unsigned.get(ENDPOINTS[1])
    assert response.status_code == 429
    assert response.json()["error_code"] == "rate_limited"


def test_catalog_scope_migration_round_trip() -> None:
    """Exercise real DDL on the worker's dedicated test DB and always restore head."""
    client = signed_in_client()
    old_token = issue_token(client, ["project:read"])
    old_device = start_device(client, ["project:read"])
    new_token = issue_token(client)
    new_device = start_device(client, ["catalog:read"])
    with connection() as conn:
        original = conn.execute("SELECT * FROM mcp_tokens WHERE id = %s", (old_token["token_record"]["id"],)).fetchone()
        original_device = conn.execute(
            "SELECT * FROM mcp_device_authorizations WHERE user_code = %s", (old_device["user_code"],)
        ).fetchone()
    cfg = Config("alembic.ini")
    try:
        command.downgrade(cfg, "20260801_0013")
        with connection() as conn:
            assert (
                conn.execute("SELECT * FROM mcp_tokens WHERE id = %s", (old_token["token_record"]["id"],)).fetchone()
                == original
            )
            assert (
                conn.execute(
                    "SELECT * FROM mcp_device_authorizations WHERE user_code = %s", (old_device["user_code"],)
                ).fetchone()
                == original_device
            )
            assert (
                conn.execute("SELECT id FROM mcp_tokens WHERE id = %s", (new_token["token_record"]["id"],)).fetchone()
                is None
            )
            assert (
                conn.execute(
                    "SELECT id FROM mcp_device_authorizations WHERE user_code = %s", (new_device["user_code"],)
                ).fetchone()
                is None
            )
        for table in ("mcp_tokens", "mcp_device_authorizations"):
            with pytest.raises(psycopg.errors.CheckViolation):
                with transaction() as conn:
                    conn.execute(f"UPDATE {table} SET scopes = ARRAY['catalog:read']")
    finally:
        command.upgrade(cfg, "head")
    # Both restored constraints accept the new scope again.
    issue_token(client)
    start_device(client, ["catalog:read"])
    with connection() as conn:
        assert (
            conn.execute("SELECT * FROM mcp_tokens WHERE id = %s", (old_token["token_record"]["id"],)).fetchone()
            == original
        )
        assert (
            conn.execute(
                "SELECT * FROM mcp_device_authorizations WHERE user_code = %s", (old_device["user_code"],)
            ).fetchone()
            == original_device
        )

"""Window-Frame catalog contract tests."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from database import connection
from features.auth.service import create_or_update_user
from main import app

ORIGIN = "http://localhost:5173"


def signed_in_client() -> TestClient:
    create_or_update_user(email="ed@example.com", display_name="Ed May", password="password")
    client = TestClient(app)
    response = client.post(
        "/api/v1/auth/login",
        headers={"Origin": ORIGIN},
        json={"email": "ed@example.com", "password": "password"},
    )
    assert response.status_code == 200
    return client


def _payload(name: str = "Skyline SR-3") -> dict[str, object]:
    return {
        "name": name,
        "manufacturer": "Skyline",
        "brand": "Ridge",
        "use": "Window",
        "operation": "Casement",
        "location": "Head",
        "mull_type": None,
        "prefix": None,
        "suffix": "TS",
        "material": "Aluminum",
        "width_mm": 100.0,
        "u_value_w_m2k": 0.85,
        "psi_g_w_mk": 0.040,
        "psi_install_w_mk": 0.030,
        "color": "#282828",
        "source": "Manufacturer datasheet 2024-Q2",
        "comments": "Triple-seal aluminum-clad timber",
    }


def test_create_returns_flat_row(clean_catalog_tables: None) -> None:
    client = signed_in_client()
    response = client.post(
        "/api/v1/catalogs/frame-types",
        headers={"Origin": ORIGIN},
        json=_payload(),
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["name"] == "Skyline SR-3"
    assert body["manufacturer"] == "Skyline"
    assert body["brand"] == "Ridge"
    assert body["use"] == "Window"
    assert body["operation"] == "Casement"
    assert body["location"] == "Head"
    assert body["material"] == "Aluminum"
    assert body["width_mm"] == pytest.approx(100.0)
    assert body["u_value_w_m2k"] == pytest.approx(0.85)
    assert body["psi_g_w_mk"] == pytest.approx(0.040)
    assert body["psi_install_w_mk"] == pytest.approx(0.030)
    assert body["source"] == "Manufacturer datasheet 2024-Q2"
    assert body["comments"] == "Triple-seal aluminum-clad timber"
    assert body["is_active"] is True
    assert body["id"].startswith("rec")
    assert len(body["id"]) == 17
    # Version layer is gone; no version_* fields on the response.
    assert "current_version_id" not in body
    assert "catalog_schema_version" not in body
    assert "version_label" not in body
    assert "version_date" not in body


def test_list_filters_inactive_by_default(clean_catalog_tables: None) -> None:
    client = signed_in_client()
    created = client.post("/api/v1/catalogs/frame-types", headers={"Origin": ORIGIN}, json=_payload("A")).json()
    client.post("/api/v1/catalogs/frame-types", headers={"Origin": ORIGIN}, json=_payload("B")).json()

    active = client.get("/api/v1/catalogs/frame-types").json()
    assert {item["name"] for item in active["items"]} == {"A", "B"}

    assert client.delete(f"/api/v1/catalogs/frame-types/{created['id']}", headers={"Origin": ORIGIN}).status_code == 204
    assert {item["name"] for item in client.get("/api/v1/catalogs/frame-types").json()["items"]} == {"B"}
    listed_inactive = client.get("/api/v1/catalogs/frame-types", params={"include_inactive": "true"}).json()
    assert {item["name"] for item in listed_inactive["items"]} == {"A", "B"}
    deactivated = next(item for item in listed_inactive["items"] if item["name"] == "A")
    assert deactivated["is_active"] is False


def test_edit_in_place_does_not_touch_project_versions(clean_catalog_tables: None) -> None:
    client = signed_in_client()
    assert (
        client.post(
            "/api/v1/projects",
            headers={"Origin": ORIGIN},
            json={
                "name": "Frame Side-Effect Test",
                "bt_number": "0010",
                "client": None,
                "cert_programs": [],
                "phius_number": None,
                "phius_dropbox_url": None,
            },
        ).status_code
        == 201
    )

    with connection() as conn:
        before = conn.execute("SELECT id, body::text AS body_text, updated_at FROM project_versions").fetchall()

    created = client.post("/api/v1/catalogs/frame-types", headers={"Origin": ORIGIN}, json=_payload()).json()
    patched = client.patch(
        f"/api/v1/catalogs/frame-types/{created['id']}",
        headers={"Origin": ORIGIN},
        json={"u_value_w_m2k": 0.78, "comments": "Reformulated 2026"},
    )
    assert patched.status_code == 200
    assert patched.json()["u_value_w_m2k"] == pytest.approx(0.78)
    assert patched.json()["comments"] == "Reformulated 2026"

    with connection() as conn:
        after = conn.execute("SELECT id, body::text AS body_text, updated_at FROM project_versions").fetchall()
    assert after == before


def test_validation_rejects_invalid_values(clean_catalog_tables: None) -> None:
    client = signed_in_client()
    blank = client.post(
        "/api/v1/catalogs/frame-types",
        headers={"Origin": ORIGIN},
        json={**_payload(), "name": "   "},
    )
    assert blank.status_code == 422

    negative_u = client.post(
        "/api/v1/catalogs/frame-types",
        headers={"Origin": ORIGIN},
        json={**_payload(), "u_value_w_m2k": -0.1},
    )
    assert negative_u.status_code == 422

    negative_psi = client.post(
        "/api/v1/catalogs/frame-types",
        headers={"Origin": ORIGIN},
        json={**_payload(), "psi_g_w_mk": -0.01},
    )
    assert negative_psi.status_code == 422


def test_unauthenticated_read_and_write_rejected(clean_catalog_tables: None) -> None:
    client = signed_in_client()
    client.post("/api/v1/catalogs/frame-types", headers={"Origin": ORIGIN}, json=_payload())

    anon = TestClient(app)
    assert anon.get("/api/v1/catalogs/frame-types").status_code == 401
    assert (
        anon.post("/api/v1/catalogs/frame-types", headers={"Origin": ORIGIN}, json=_payload("Anon")).status_code == 401
    )


def test_deactivate_is_idempotent_and_reactivate_restores(clean_catalog_tables: None) -> None:
    client = signed_in_client()
    created = client.post("/api/v1/catalogs/frame-types", headers={"Origin": ORIGIN}, json=_payload()).json()

    assert client.delete(f"/api/v1/catalogs/frame-types/{created['id']}", headers={"Origin": ORIGIN}).status_code == 204
    assert client.delete(f"/api/v1/catalogs/frame-types/{created['id']}", headers={"Origin": ORIGIN}).status_code == 404

    reactivated = client.post(
        f"/api/v1/catalogs/frame-types/{created['id']}/reactivate",
        headers={"Origin": ORIGIN},
    )
    assert reactivated.status_code == 200
    assert reactivated.json()["is_active"] is True


def test_duplicate_copies_fields_with_copy_suffix(clean_catalog_tables: None) -> None:
    client = signed_in_client()
    created = client.post("/api/v1/catalogs/frame-types", headers={"Origin": ORIGIN}, json=_payload("Source")).json()

    response = client.post(
        f"/api/v1/catalogs/frame-types/{created['id']}/duplicate",
        headers={"Origin": ORIGIN},
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["name"] == "Source (copy)"
    assert body["id"] != created["id"]
    assert body["manufacturer"] == created["manufacturer"]
    assert body["use"] == created["use"]
    assert body["material"] == created["material"]
    assert body["u_value_w_m2k"] == pytest.approx(created["u_value_w_m2k"])

    again = client.post(
        f"/api/v1/catalogs/frame-types/{created['id']}/duplicate",
        headers={"Origin": ORIGIN},
    ).json()
    assert again["name"] == "Source (copy 2)"


def test_catalog_writes_emit_user_action_log_entries(clean_catalog_tables: None) -> None:
    client = signed_in_client()
    created = client.post("/api/v1/catalogs/frame-types", headers={"Origin": ORIGIN}, json=_payload()).json()
    record_id = created["id"]

    assert (
        client.patch(
            f"/api/v1/catalogs/frame-types/{record_id}",
            headers={"Origin": ORIGIN},
            json={"u_value_w_m2k": 0.78},
        ).status_code
        == 200
    )
    assert client.delete(f"/api/v1/catalogs/frame-types/{record_id}", headers={"Origin": ORIGIN}).status_code == 204
    assert (
        client.post(f"/api/v1/catalogs/frame-types/{record_id}/reactivate", headers={"Origin": ORIGIN}).status_code
        == 200
    )

    with connection() as conn:
        rows = conn.execute(
            """
            SELECT action, details::text AS details_text
            FROM user_action_log
            WHERE action LIKE 'catalog_%%'
            ORDER BY created_at ASC, id ASC
            """
        ).fetchall()
    actions = [row["action"] for row in rows]
    assert actions == [
        "catalog_record_create",
        "catalog_record_update",
        "catalog_record_delete",
        "catalog_record_reactivate",
    ]
    for row in rows:
        assert '"catalog_table": "frame_types"' in row["details_text"]
        assert record_id in row["details_text"]


def test_list_filters_by_location_operation_use_and_manufacturer(clean_catalog_tables: None) -> None:
    """Phase 06 filter query params on ``GET /catalogs/frame-types``."""

    client = signed_in_client()

    def _create(name: str, *, location: str, operation: str, use: str, manufacturer: str) -> None:
        body = _payload(name)
        body.update({"location": location, "operation": operation, "use": use, "manufacturer": manufacturer})
        assert client.post("/api/v1/catalogs/frame-types", headers={"Origin": ORIGIN}, json=body).status_code == 201

    _create("Head A", location="Head", operation="Casement", use="Window", manufacturer="Skyline")
    _create("Sill B", location="Sill", operation="Fixed", use="Window", manufacturer="Skyline")
    _create("Jamb C", location="Jamb", operation="Casement", use="Door", manufacturer="Other")

    def names_for(params: list[tuple[str, str | int | float | None]]) -> set[str]:
        return {item["name"] for item in client.get("/api/v1/catalogs/frame-types", params=params).json()["items"]}

    assert names_for([("location", "head")]) == {"Head A"}  # case-insensitive
    assert names_for([("operation", "Casement")]) == {"Head A", "Jamb C"}
    assert names_for([("use", "Door")]) == {"Jamb C"}
    assert names_for([("manufacturers", "Skyline")]) == {"Head A", "Sill B"}
    assert names_for([("manufacturers", "Skyline"), ("manufacturers", "Other")]) == {
        "Head A",
        "Sill B",
        "Jamb C",
    }
    # Combined filters AND together.
    assert names_for([("location", "Jamb"), ("operation", "Casement")]) == {"Jamb C"}

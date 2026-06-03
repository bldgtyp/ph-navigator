"""Window-Frame catalog contract tests for TB-08.a."""

from __future__ import annotations

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from database import connection, transaction
from features.auth.service import create_or_update_user
from main import app

ORIGIN = "http://localhost:5173"


@pytest.fixture()
def clean_catalog_tables() -> Iterator[None]:
    with transaction() as conn:
        conn.execute(
            """
            TRUNCATE catalog_material_versions, catalog_materials,
                     catalog_frame_type_versions, catalog_frame_types,
                     catalog_glazing_type_versions, catalog_glazing_types,
                     user_action_log, sessions, project_status_items,
                     project_version_drafts, project_versions, projects, users
            RESTART IDENTITY CASCADE
            """
        )
    yield
    with transaction() as conn:
        conn.execute(
            """
            TRUNCATE catalog_material_versions, catalog_materials,
                     catalog_frame_type_versions, catalog_frame_types,
                     catalog_glazing_type_versions, catalog_glazing_types,
                     user_action_log, sessions, project_status_items,
                     project_version_drafts, project_versions, projects, users
            RESTART IDENTITY CASCADE
            """
        )


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
        "version_label": "2024 spec",
        "version_date": "2024-06-01",
        "width_mm": 100.0,
        "u_value_w_m2k": 0.85,
        "psi_g_w_mk": 0.040,
        "psi_install_w_mk": 0.030,
        "color": "#282828",
        "notes": "Triple-seal aluminum-clad timber",
        "source_provenance": "Manufacturer datasheet 2024-Q2",
    }


def test_create_returns_bookshelf_metadata(clean_catalog_tables: None) -> None:
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
    assert body["width_mm"] == pytest.approx(100.0)
    assert body["u_value_w_m2k"] == pytest.approx(0.85)
    assert body["psi_g_w_mk"] == pytest.approx(0.040)
    assert body["psi_install_w_mk"] == pytest.approx(0.030)
    assert body["is_active"] is True
    # Record id uses the AirTable `rec` + 14-char shape so V1 / AirTable imports
    # drop in unmodified; version id stays V2-native with the `framev_` prefix.
    assert body["id"].startswith("rec")
    assert len(body["id"]) == 17
    assert body["current_version_id"].startswith("framev_")
    assert body["catalog_schema_version"] == 1


def test_list_filters_inactive_by_default(clean_catalog_tables: None) -> None:
    client = signed_in_client()
    created = client.post("/api/v1/catalogs/frame-types", headers={"Origin": ORIGIN}, json=_payload("A")).json()
    client.post("/api/v1/catalogs/frame-types", headers={"Origin": ORIGIN}, json=_payload("B")).json()

    active = client.get("/api/v1/catalogs/frame-types").json()
    assert {item["name"] for item in active["items"]} == {"A", "B"}

    assert client.delete(f"/api/v1/catalogs/frame-types/{created['id']}", headers={"Origin": ORIGIN}).status_code == 204
    assert {item["name"] for item in client.get("/api/v1/catalogs/frame-types").json()["items"]} == {"B"}
    assert {
        item["name"]
        for item in client.get("/api/v1/catalogs/frame-types", params={"include_inactive": "true"}).json()["items"]
    } == {"A", "B"}


def test_edit_in_place_does_not_touch_project_versions(clean_catalog_tables: None) -> None:
    """Catalog edits never silently mutate project documents (bookshelf model)."""
    client = signed_in_client()
    assert (
        client.post(
            "/api/v1/projects",
            headers={"Origin": ORIGIN},
            json={
                "name": "Frame Side-Effect Test",
                "bt_number": "0008",
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
        json={"u_value_w_m2k": 0.78, "notes": "Reformulated 2026"},
    )
    assert patched.status_code == 200
    assert patched.json()["u_value_w_m2k"] == pytest.approx(0.78)
    # In-place edit keeps the same current_version_id (data-model.md §7.3).
    assert patched.json()["current_version_id"] == created["current_version_id"]

    with connection() as conn:
        after = conn.execute("SELECT id, body::text AS body_text, updated_at FROM project_versions").fetchall()
    assert after == before


def test_validation_rejects_blank_name_and_negative_values(clean_catalog_tables: None) -> None:
    client = signed_in_client()
    blank = client.post(
        "/api/v1/catalogs/frame-types",
        headers={"Origin": ORIGIN},
        json={**_payload(), "name": "   "},
    )
    assert blank.status_code == 422

    negative = client.post(
        "/api/v1/catalogs/frame-types",
        headers={"Origin": ORIGIN},
        json={**_payload(), "u_value_w_m2k": -0.1},
    )
    assert negative.status_code == 422

    negative_width = client.post(
        "/api/v1/catalogs/frame-types",
        headers={"Origin": ORIGIN},
        json={**_payload(), "width_mm": -1.0},
    )
    assert negative_width.status_code == 422


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


def test_catalog_writes_emit_user_action_log_entries(clean_catalog_tables: None) -> None:
    client = signed_in_client()
    created = client.post("/api/v1/catalogs/frame-types", headers={"Origin": ORIGIN}, json=_payload()).json()
    record_id = created["id"]
    version_id = created["current_version_id"]

    assert (
        client.patch(
            f"/api/v1/catalogs/frame-types/{record_id}",
            headers={"Origin": ORIGIN},
            json={"u_value_w_m2k": 0.80},
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
    for action in ("catalog_record_create", "catalog_record_update", "catalog_record_reactivate"):
        row = next(r for r in rows if r["action"] == action)
        assert version_id in row["details_text"]


def test_patch_rejects_null_version_date(clean_catalog_tables: None) -> None:
    client = signed_in_client()
    created = client.post("/api/v1/catalogs/frame-types", headers={"Origin": ORIGIN}, json=_payload()).json()
    response = client.patch(
        f"/api/v1/catalogs/frame-types/{created['id']}",
        headers={"Origin": ORIGIN},
        json={"version_date": None},
    )
    assert response.status_code == 422

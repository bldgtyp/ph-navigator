"""Materials catalog contract tests."""

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


def _xps_payload(name: str = "XPS") -> dict[str, object]:
    return {
        "name": name,
        "category": "insulation",
        "density_kg_m3": 35.0,
        "specific_heat_j_kgk": 1500.0,
        "conductivity_w_mk": 0.034,
        "emissivity": 0.9,
        "color": "#dce6f0",
        "source": "Manufacturer datasheet 2024-Q2",
        "url": "https://example.com/xps-datasheet.pdf",
        "comments": "Type IV per ASTM C578",
    }


def test_create_returns_flat_record(clean_catalog_tables: None) -> None:
    client = signed_in_client()
    response = client.post(
        "/api/v1/catalogs/materials",
        headers={"Origin": ORIGIN},
        json=_xps_payload(),
    )
    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "XPS"
    assert body["category"] == "insulation"
    assert body["conductivity_w_mk"] == pytest.approx(0.034)
    assert body["url"] == "https://example.com/xps-datasheet.pdf"
    assert body["comments"] == "Type IV per ASTM C578"
    assert body["is_active"] is True
    # Record ids keep the AirTable `rec` + 14-char shape across all v1 catalogs.
    assert body["id"].startswith("rec")
    assert len(body["id"]) == 17
    # Flat schema: no per-version metadata fields on the response.
    assert "current_version_id" not in body
    assert "version_label" not in body
    assert "catalog_schema_version" not in body


def test_create_rejects_unknown_category(clean_catalog_tables: None) -> None:
    """Category is constrained to the twelve fixed option ids."""
    client = signed_in_client()
    bad = client.post(
        "/api/v1/catalogs/materials",
        headers={"Origin": ORIGIN},
        json={**_xps_payload(), "category": "not_a_real_category"},
    )
    assert bad.status_code == 422


def test_list_filters_inactive_by_default_and_active_filter_is_explicit(
    clean_catalog_tables: None,
) -> None:
    client = signed_in_client()
    created = client.post("/api/v1/catalogs/materials", headers={"Origin": ORIGIN}, json=_xps_payload("XPS")).json()
    client.post("/api/v1/catalogs/materials", headers={"Origin": ORIGIN}, json=_xps_payload("Mineral Wool")).json()

    listed = client.get("/api/v1/catalogs/materials").json()
    assert {item["name"] for item in listed["items"]} == {"XPS", "Mineral Wool"}

    deactivate = client.delete(f"/api/v1/catalogs/materials/{created['id']}", headers={"Origin": ORIGIN})
    assert deactivate.status_code == 204

    listed_after = client.get("/api/v1/catalogs/materials").json()
    assert {item["name"] for item in listed_after["items"]} == {"Mineral Wool"}

    listed_inactive = client.get("/api/v1/catalogs/materials", params={"include_inactive": "true"}).json()
    assert {item["name"] for item in listed_inactive["items"]} == {"XPS", "Mineral Wool"}
    xps = next(item for item in listed_inactive["items"] if item["name"] == "XPS")
    assert xps["is_active"] is False


def test_edit_in_place_does_not_touch_project_versions(clean_catalog_tables: None) -> None:
    """A catalog edit must not mutate any project document.

    The bookshelf model copies values at pick time; later catalog edits live
    only on the catalog row and surface through refresh-from-catalog.
    """
    client = signed_in_client()
    project_response = client.post(
        "/api/v1/projects",
        headers={"Origin": ORIGIN},
        json={
            "name": "Catalog Side-Effect Test",
            "bt_number": "0007",
            "client": None,
            "cert_programs": [],
            "phius_number": None,
            "phius_dropbox_url": None,
        },
    )
    assert project_response.status_code == 201

    with connection() as conn:
        before = conn.execute("SELECT id, body::text AS body_text, updated_at FROM project_versions").fetchall()
    assert len(before) >= 1

    created = client.post("/api/v1/catalogs/materials", headers={"Origin": ORIGIN}, json=_xps_payload()).json()

    patched = client.patch(
        f"/api/v1/catalogs/materials/{created['id']}",
        headers={"Origin": ORIGIN},
        json={"conductivity_w_mk": 0.030, "comments": "Reformulated 2026"},
    )
    assert patched.status_code == 200
    assert patched.json()["conductivity_w_mk"] == pytest.approx(0.030)
    assert patched.json()["comments"] == "Reformulated 2026"

    with connection() as conn:
        after = conn.execute("SELECT id, body::text AS body_text, updated_at FROM project_versions").fetchall()
    assert after == before


def test_validation_rejects_blank_name_and_negative_conductivity(
    clean_catalog_tables: None,
) -> None:
    client = signed_in_client()
    blank = client.post(
        "/api/v1/catalogs/materials",
        headers={"Origin": ORIGIN},
        json={**_xps_payload(), "name": "   "},
    )
    assert blank.status_code == 422

    negative = client.post(
        "/api/v1/catalogs/materials",
        headers={"Origin": ORIGIN},
        json={**_xps_payload(), "conductivity_w_mk": -0.1},
    )
    assert negative.status_code == 422

    bad_emissivity = client.post(
        "/api/v1/catalogs/materials",
        headers={"Origin": ORIGIN},
        json={**_xps_payload(), "emissivity": 1.5},
    )
    assert bad_emissivity.status_code == 422


def test_unauthenticated_read_and_write_rejected(clean_catalog_tables: None) -> None:
    client = signed_in_client()
    client.post("/api/v1/catalogs/materials", headers={"Origin": ORIGIN}, json=_xps_payload())

    anon = TestClient(app)
    assert anon.get("/api/v1/catalogs/materials").status_code == 401
    assert (
        anon.post("/api/v1/catalogs/materials", headers={"Origin": ORIGIN}, json=_xps_payload("Anon")).status_code
        == 401
    )


def test_deactivate_is_idempotent_and_reactivate_restores(clean_catalog_tables: None) -> None:
    client = signed_in_client()
    created = client.post("/api/v1/catalogs/materials", headers={"Origin": ORIGIN}, json=_xps_payload()).json()

    first = client.delete(f"/api/v1/catalogs/materials/{created['id']}", headers={"Origin": ORIGIN})
    assert first.status_code == 204
    second = client.delete(f"/api/v1/catalogs/materials/{created['id']}", headers={"Origin": ORIGIN})
    assert second.status_code == 404  # already inactive

    reactivated = client.post(
        f"/api/v1/catalogs/materials/{created['id']}/reactivate",
        headers={"Origin": ORIGIN},
    )
    assert reactivated.status_code == 200
    assert reactivated.json()["is_active"] is True


def test_catalog_writes_emit_user_action_log_entries(clean_catalog_tables: None) -> None:
    """Per US-OPS-1 / data-model.md §7.3, catalog edits must be audit-logged."""
    client = signed_in_client()
    created = client.post("/api/v1/catalogs/materials", headers={"Origin": ORIGIN}, json=_xps_payload()).json()
    record_id = created["id"]

    patched = client.patch(
        f"/api/v1/catalogs/materials/{record_id}",
        headers={"Origin": ORIGIN},
        json={"conductivity_w_mk": 0.030},
    )
    assert patched.status_code == 200

    assert client.delete(f"/api/v1/catalogs/materials/{record_id}", headers={"Origin": ORIGIN}).status_code == 204

    reactivated = client.post(f"/api/v1/catalogs/materials/{record_id}/reactivate", headers={"Origin": ORIGIN})
    assert reactivated.status_code == 200

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
        details = row["details_text"]
        assert '"catalog_table": "materials"' in details
        assert record_id in details
    update_row = next(row for row in rows if row["action"] == "catalog_record_update")
    assert '"conductivity_w_mk"' in update_row["details_text"]

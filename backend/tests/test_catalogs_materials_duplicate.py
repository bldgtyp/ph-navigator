"""Integration tests for the materials Duplicate endpoint (Phase 3a)."""

from __future__ import annotations

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from database import transaction
from features.auth.service import create_or_update_user
from main import app

ORIGIN = "http://localhost:5173"

_TRUNCATE = """
TRUNCATE catalog_materials,
         catalog_frame_type_versions, catalog_frame_types,
         catalog_glazing_type_versions, catalog_glazing_types,
         user_action_log, sessions, project_status_items,
         project_version_drafts, project_versions, projects, users
RESTART IDENTITY CASCADE
"""


@pytest.fixture()
def clean_catalog_tables() -> Iterator[None]:
    with transaction() as conn:
        conn.execute(_TRUNCATE)
    yield
    with transaction() as conn:
        conn.execute(_TRUNCATE)


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


def _create(client: TestClient, payload: dict[str, object]) -> dict[str, object]:
    response = client.post(
        "/api/v1/catalogs/materials",
        headers={"Origin": ORIGIN},
        json=payload,
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_duplicate_creates_record_with_copy_suffix(clean_catalog_tables: None) -> None:
    client = signed_in_client()
    source = _create(client, _xps_payload())
    response = client.post(
        f"/api/v1/catalogs/materials/{source['id']}/duplicate",
        headers={"Origin": ORIGIN},
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["id"] != source["id"]
    assert body["id"].startswith("rec")
    assert body["name"] == "XPS (copy)"
    assert body["category"] == source["category"]
    assert body["conductivity_w_mk"] == pytest.approx(source["conductivity_w_mk"])
    assert body["url"] == source["url"]
    assert body["comments"] == source["comments"]
    assert body["is_active"] is True


def test_duplicate_returns_404_when_source_missing(clean_catalog_tables: None) -> None:
    client = signed_in_client()
    response = client.post(
        "/api/v1/catalogs/materials/recDoesNotExist123/duplicate",
        headers={"Origin": ORIGIN},
    )
    assert response.status_code == 404
    assert response.json()["error_code"] == "catalog_material_not_found"


def test_duplicate_returns_404_for_soft_deleted_source(clean_catalog_tables: None) -> None:
    client = signed_in_client()
    source = _create(client, _xps_payload())
    delete = client.delete(
        f"/api/v1/catalogs/materials/{source['id']}",
        headers={"Origin": ORIGIN},
    )
    assert delete.status_code == 204
    response = client.post(
        f"/api/v1/catalogs/materials/{source['id']}/duplicate",
        headers={"Origin": ORIGIN},
    )
    # Soft-deleted rows are not visible to `get_material`, so duplicate
    # treats them as missing.
    assert response.status_code == 404


def test_duplicate_advances_suffix_when_copy_exists(clean_catalog_tables: None) -> None:
    client = signed_in_client()
    source = _create(client, _xps_payload())
    first = client.post(
        f"/api/v1/catalogs/materials/{source['id']}/duplicate",
        headers={"Origin": ORIGIN},
    )
    assert first.status_code == 201
    assert first.json()["name"] == "XPS (copy)"
    second = client.post(
        f"/api/v1/catalogs/materials/{source['id']}/duplicate",
        headers={"Origin": ORIGIN},
    )
    assert second.status_code == 201
    assert second.json()["name"] == "XPS (copy 2)"


def test_duplicate_logs_create_audit_row(clean_catalog_tables: None) -> None:
    client = signed_in_client()
    source = _create(client, _xps_payload())
    duplicate = client.post(
        f"/api/v1/catalogs/materials/{source['id']}/duplicate",
        headers={"Origin": ORIGIN},
    )
    assert duplicate.status_code == 201
    new_id = duplicate.json()["id"]
    with transaction() as conn:
        rows = conn.execute(
            "SELECT action, details FROM user_action_log "
            "WHERE action = 'catalog_record_create' "
            "AND details->>'record_id' = %(id)s",
            {"id": new_id},
        ).fetchall()
    assert len(rows) == 1
    assert rows[0]["details"]["catalog_table"] == "materials"

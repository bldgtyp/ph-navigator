"""Phase 11 catalog manufacturer-roster contract tests.

Verifies the two new endpoints return distinct manufacturer names with
their product counts, sorted case-insensitively, skipping rows with a
null / blank manufacturer.
"""

from __future__ import annotations

from fastapi.testclient import TestClient

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


def _frame(name: str, manufacturer: str | None) -> dict[str, object]:
    return {
        "name": name,
        "manufacturer": manufacturer,
        "brand": None,
        "use": None,
        "operation": None,
        "location": None,
        "mull_type": None,
        "prefix": None,
        "suffix": None,
        "material": None,
        "width_mm": 80.0,
        "u_value_w_m2k": 1.0,
        "psi_g_w_mk": 0.04,
        "psi_install_w_mk": 0.03,
        "color": None,
        "source": None,
        "comments": None,
    }


def _glazing(name: str, manufacturer: str | None) -> dict[str, object]:
    return {
        "name": name,
        "manufacturer": manufacturer,
        "brand": None,
        "suffix": None,
        "u_value_w_m2k": 0.8,
        "g_value": 0.5,
        "color": None,
        "source": None,
        "comments": None,
    }


def test_frame_manufacturers_roster_groups_and_counts(clean_catalog_tables: None) -> None:
    client = signed_in_client()
    for payload in (
        _frame("A1", "Alpen"),
        _frame("A2", "Alpen"),
        _frame("S1", "Schüco"),
        _frame("S2", "schüco"),  # distinct casing — distinct row
        _frame("N1", None),  # null manufacturer — skipped
        _frame("B1", ""),  # blank — skipped
    ):
        assert client.post("/api/v1/catalogs/frame-types", headers={"Origin": ORIGIN}, json=payload).status_code == 201

    response = client.get("/api/v1/catalogs/frame-types/manufacturers")
    assert response.status_code == 200, response.text
    items = response.json()["items"]
    # Sorted case-insensitively. Different-cased "Schüco"/"schüco" stay as
    # two rows because the SQL GROUP BY is case-sensitive — the frontend
    # normalises by casefold when checking in-use against the enabled list.
    names = [item["manufacturer"] for item in items]
    assert names == sorted(names, key=str.lower)
    counts = {item["manufacturer"]: item["product_count"] for item in items}
    assert counts["Alpen"] == 2
    assert counts["Schüco"] == 1
    assert counts["schüco"] == 1
    assert "" not in counts
    assert None not in counts


def test_glazing_manufacturers_roster(clean_catalog_tables: None) -> None:
    client = signed_in_client()
    for payload in (
        _glazing("Quad", "Alpen"),
        _glazing("DG", "Alpen"),
        _glazing("Triple", "Internorm"),
        _glazing("NoMan", None),
    ):
        assert (
            client.post("/api/v1/catalogs/glazing-types", headers={"Origin": ORIGIN}, json=payload).status_code == 201
        )

    response = client.get("/api/v1/catalogs/glazing-types/manufacturers")
    assert response.status_code == 200, response.text
    items = response.json()["items"]
    counts = {item["manufacturer"]: item["product_count"] for item in items}
    assert counts == {"Alpen": 2, "Internorm": 1}


def test_manufacturer_roster_excludes_inactive_rows(clean_catalog_tables: None) -> None:
    client = signed_in_client()
    created = client.post("/api/v1/catalogs/frame-types", headers={"Origin": ORIGIN}, json=_frame("A1", "Alpen")).json()
    client.post("/api/v1/catalogs/frame-types", headers={"Origin": ORIGIN}, json=_frame("A2", "Alpen"))
    # Deactivate one of two Alpen rows: count should drop to 1.
    assert client.delete(f"/api/v1/catalogs/frame-types/{created['id']}", headers={"Origin": ORIGIN}).status_code == 204
    response = client.get("/api/v1/catalogs/frame-types/manufacturers")
    counts = {item["manufacturer"]: item["product_count"] for item in response.json()["items"]}
    assert counts == {"Alpen": 1}


def test_manufacturer_roster_requires_auth() -> None:
    client = TestClient(app)
    assert client.get("/api/v1/catalogs/frame-types/manufacturers").status_code == 401
    assert client.get("/api/v1/catalogs/glazing-types/manufacturers").status_code == 401

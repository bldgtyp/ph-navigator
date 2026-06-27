"""Window-Frame catalog contract tests."""

from __future__ import annotations

import json
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from database import connection, transaction
from features.catalogs.frame_types.options_service import seed_frame_type_options
from features.catalogs.frame_types.service import compose_frame_name
from main import app
from scripts._seed_paths import FRAME_SEED_PATH
from tests.catalog_helpers import create_catalog_admin

ORIGIN = "http://localhost:5173"


@pytest.fixture(autouse=True)
def _reset_frame_options() -> Iterator[None]:
    """Keep the frame-type option store at its canonical baseline around each
    test. Frame writes are now strictly validated against this store (Phase 2),
    so every test in this module needs the seeded options present, and the one
    option-mutating test must not leak into the others."""
    _seed_canonical_options()
    yield
    _seed_canonical_options()


def _seed_canonical_options() -> None:
    with transaction() as conn:
        seed_frame_type_options(conn)


def signed_in_client() -> TestClient:
    create_catalog_admin()
    client = TestClient(app)
    response = client.post(
        "/api/v1/auth/login",
        headers={"Origin": ORIGIN},
        json={"email": "ed@example.com", "password": "password"},
    )
    assert response.status_code == 200
    return client


# Derived-name prefix for a default `_payload` row (everything before `suffix`).
_NAME_PREFIX = "Alpen | Tyrol | Window | Casement | Head"


def _expected_name(suffix: str = "TS") -> str:
    """The server-derived `name` for a `_payload(suffix)` row (Phase 3). `name`
    is composed from the parts, so the free-text `suffix` is the discriminator
    tests vary to get distinct rows."""
    return f"{_NAME_PREFIX} | {suffix}"


def _payload(suffix: str = "TS") -> dict[str, object]:
    return {
        # `name` is server-derived (Phase 3) — clients must not send it. The
        # six single-selects are canonical labels (strictly validated, Phase 2);
        # `suffix` is free text and the per-row discriminator.
        "manufacturer": "Alpen",
        "brand": "Tyrol",
        "use": "Window",
        "operation": "Casement",
        "location": "Head",
        "mull_type": None,
        "prefix": None,
        "suffix": suffix,
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
    assert body["name"] == _expected_name()  # server-derived from the parts
    assert body["manufacturer"] == "Alpen"
    assert body["brand"] == "Tyrol"
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
    assert {item["name"] for item in active["items"]} == {_expected_name("A"), _expected_name("B")}

    assert client.delete(f"/api/v1/catalogs/frame-types/{created['id']}", headers={"Origin": ORIGIN}).status_code == 204
    assert {item["name"] for item in client.get("/api/v1/catalogs/frame-types").json()["items"]} == {
        _expected_name("B")
    }
    listed_inactive = client.get("/api/v1/catalogs/frame-types", params={"include_inactive": "true"}).json()
    assert {item["name"] for item in listed_inactive["items"]} == {_expected_name("A"), _expected_name("B")}
    deactivated = next(item for item in listed_inactive["items"] if item["name"] == _expected_name("A"))
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
    # `name` is server-derived (Phase 3) — sending one is rejected as an extra field.
    inbound_name = client.post(
        "/api/v1/catalogs/frame-types",
        headers={"Origin": ORIGIN},
        json={**_payload(), "name": "Client supplied"},
    )
    assert inbound_name.status_code == 422

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


def test_duplicate_copies_fields_with_same_derived_name(clean_catalog_tables: None) -> None:
    client = signed_in_client()
    created = client.post("/api/v1/catalogs/frame-types", headers={"Origin": ORIGIN}, json=_payload("Source")).json()

    response = client.post(
        f"/api/v1/catalogs/frame-types/{created['id']}/duplicate",
        headers={"Origin": ORIGIN},
    )
    assert response.status_code == 201, response.text
    body = response.json()
    # `name` is derived from the parts, so a copy of identical parts has an
    # identical name — duplicates are distinguished by id, not a `(copy)` suffix.
    assert body["name"] == created["name"] == _expected_name("Source")
    assert body["id"] != created["id"]
    assert body["manufacturer"] == created["manufacturer"]
    assert body["use"] == created["use"]
    assert body["material"] == created["material"]
    assert body["u_value_w_m2k"] == pytest.approx(created["u_value_w_m2k"])


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

    # `name` is derived, so rows are tagged for identification via the free-text
    # `suffix` discriminator.
    def _create(tag: str, *, location: str, operation: str, use: str, manufacturer: str) -> None:
        body = _payload(tag)
        body.update({"location": location, "operation": operation, "use": use, "manufacturer": manufacturer})
        assert client.post("/api/v1/catalogs/frame-types", headers={"Origin": ORIGIN}, json=body).status_code == 201

    _create("Head A", location="Head", operation="Casement", use="Window", manufacturer="Alpen")
    _create("Sill B", location="Sill", operation="Fixed", use="Window", manufacturer="Alpen")
    _create("Jamb C", location="Jamb", operation="Casement", use="Door", manufacturer="Zola")

    def tags_for(params: list[tuple[str, str | int | float | None]]) -> set[str]:
        return {item["suffix"] for item in client.get("/api/v1/catalogs/frame-types", params=params).json()["items"]}

    assert tags_for([("location", "head")]) == {"Head A"}  # case-insensitive
    assert tags_for([("operation", "Casement")]) == {"Head A", "Jamb C"}
    assert tags_for([("use", "Door")]) == {"Jamb C"}
    assert tags_for([("manufacturers", "Alpen")]) == {"Head A", "Sill B"}
    assert tags_for([("manufacturers", "Alpen"), ("manufacturers", "Zola")]) == {
        "Head A",
        "Sill B",
        "Jamb C",
    }
    # Combined filters AND together.
    assert tags_for([("location", "Jamb"), ("operation", "Casement")]) == {"Jamb C"}


# --------------------------------------------------------------------------- #
# Phase 2 — strict single-select write validation.
# --------------------------------------------------------------------------- #


def test_create_rejects_unknown_single_select_value(clean_catalog_tables: None) -> None:
    client = signed_in_client()
    response = client.post(
        "/api/v1/catalogs/frame-types",
        headers={"Origin": ORIGIN},
        json={**_payload(), "operation": "tilt turn"},  # not a seeded option
    )
    assert response.status_code == 422
    assert response.json()["error_code"] == "catalog_option_unknown"


def test_create_accepts_awning_and_hopper_operation_options(clean_catalog_tables: None) -> None:
    client = signed_in_client()

    awning = client.post(
        "/api/v1/catalogs/frame-types",
        headers={"Origin": ORIGIN},
        json={**_payload("Awning frame"), "operation": "Awning"},
    )
    hopper = client.post(
        "/api/v1/catalogs/frame-types",
        headers={"Origin": ORIGIN},
        json={**_payload("Hopper frame"), "operation": "Hopper"},
    )

    assert awning.status_code == 201, awning.text
    assert awning.json()["operation"] == "Awning"
    assert hopper.status_code == 201, hopper.text
    assert hopper.json()["operation"] == "Hopper"


def test_patch_rejects_unknown_single_select_value(clean_catalog_tables: None) -> None:
    client = signed_in_client()
    created = client.post("/api/v1/catalogs/frame-types", headers={"Origin": ORIGIN}, json=_payload()).json()

    response = client.patch(
        f"/api/v1/catalogs/frame-types/{created['id']}",
        headers={"Origin": ORIGIN},
        json={"location": "nowhere"},
    )
    assert response.status_code == 422
    assert response.json()["error_code"] == "catalog_option_unknown"
    # The rejected patch left the row untouched.
    row = client.get(f"/api/v1/catalogs/frame-types/{created['id']}").json()
    assert row["location"] == "Head"


def test_null_single_select_is_allowed(clean_catalog_tables: None) -> None:
    client = signed_in_client()
    created = client.post(
        "/api/v1/catalogs/frame-types",
        headers={"Origin": ORIGIN},
        json={**_payload(), "mull_type": None},
    )
    assert created.status_code == 201
    patched = client.patch(
        f"/api/v1/catalogs/frame-types/{created.json()['id']}",
        headers={"Origin": ORIGIN},
        json={"mull_type": None},
    )
    assert patched.status_code == 200


def test_add_option_then_create_row_using_it(clean_catalog_tables: None) -> None:
    client = signed_in_client()
    options = client.get("/api/v1/catalogs/frame-types/options").json()["fields"]["brand"]
    options.append({"id": "opt_vanguard01", "label": "Vanguard", "color": "#3b82f6", "order": float(len(options))})
    assert (
        client.put(
            "/api/v1/catalogs/frame-types/options",
            headers={"Origin": ORIGIN},
            json={"field_key": "brand", "options": options, "replacements": {}},
        ).status_code
        == 200
    )

    response = client.post(
        "/api/v1/catalogs/frame-types",
        headers={"Origin": ORIGIN},
        json={**_payload("Vanguard frame"), "brand": "Vanguard"},
    )
    assert response.status_code == 201, response.text
    assert response.json()["brand"] == "Vanguard"


# --------------------------------------------------------------------------- #
# Phase 3 — derived (read-only) name.
# --------------------------------------------------------------------------- #


def test_name_is_recomputed_when_a_part_changes_on_patch(clean_catalog_tables: None) -> None:
    client = signed_in_client()
    created = client.post("/api/v1/catalogs/frame-types", headers={"Origin": ORIGIN}, json=_payload("X")).json()
    assert created["name"] == _expected_name("X")

    patched = client.patch(
        f"/api/v1/catalogs/frame-types/{created['id']}",
        headers={"Origin": ORIGIN},
        json={"operation": "Fixed"},  # a name-part
    )
    assert patched.status_code == 200
    assert patched.json()["name"] == "Alpen | Tyrol | Window | Fixed | Head | X"


def test_patch_of_non_name_part_leaves_name_unchanged(clean_catalog_tables: None) -> None:
    client = signed_in_client()
    created = client.post("/api/v1/catalogs/frame-types", headers={"Origin": ORIGIN}, json=_payload("X")).json()

    patched = client.patch(
        f"/api/v1/catalogs/frame-types/{created['id']}",
        headers={"Origin": ORIGIN},
        json={"u_value_w_m2k": 0.5},  # not a name-part
    )
    assert patched.status_code == 200
    assert patched.json()["name"] == _expected_name("X")


def test_option_rename_recomputes_dependent_row_names(clean_catalog_tables: None) -> None:
    client = signed_in_client()
    created = client.post(
        "/api/v1/catalogs/frame-types",
        headers={"Origin": ORIGIN},
        json={**_payload("X"), "operation": "Casement"},
    ).json()
    assert created["name"] == "Alpen | Tyrol | Window | Casement | Head | X"

    # Rename the `Casement` operation option in place.
    options = client.get("/api/v1/catalogs/frame-types/options").json()["fields"]["operation"]
    for option in options:
        if option["label"] == "Casement":
            option["label"] = "Casement-X"
    assert (
        client.put(
            "/api/v1/catalogs/frame-types/options",
            headers={"Origin": ORIGIN},
            json={"field_key": "operation", "options": options, "replacements": {}},
        ).status_code
        == 200
    )

    # The row's cell *and* its derived name follow the rename.
    row = client.get(f"/api/v1/catalogs/frame-types/{created['id']}").json()
    assert row["operation"] == "Casement-X"
    assert row["name"] == "Alpen | Tyrol | Window | Casement-X | Head | X"


def test_compose_frame_name_reproduces_every_seed_row_name() -> None:
    """Lossless-derivation proof (research §2): the composer reproduces the
    stored ``name`` of every row in the committed seed — so the backfill is a
    no-op diff on clean data and the derivation never loses information."""
    payload = json.loads(FRAME_SEED_PATH.read_text())
    mismatches = [row["name"] for row in payload["rows"] if compose_frame_name(row) != row["name"]]
    assert mismatches == []

"""Window-Glazing catalog contract tests."""

from __future__ import annotations

import json
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from database import connection, transaction
from features.auth.service import create_or_update_user
from features.catalogs.glazing_types._name import compose_glazing_name
from features.catalogs.glazing_types.options_service import seed_glazing_type_options
from main import app
from scripts._seed_paths import GLAZING_SEED_PATH

ORIGIN = "http://localhost:5173"


@pytest.fixture(autouse=True)
def _reset_glazing_options() -> Iterator[None]:
    """Keep the canonical glazing option lists present for write-validation.

    ``catalog_field_options`` survives the ``clean_catalog_tables`` CASCADE
    truncate, so reseeding here guarantees the canonical ``manufacturer`` /
    ``brand`` labels exist (Phase 2 rejects a row whose value isn't an option).
    """
    _seed_canonical_options()
    yield
    _seed_canonical_options()


def _seed_canonical_options() -> None:
    with transaction() as conn:
        seed_glazing_type_options(conn)


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


def _payload(suffix: str = "T") -> dict[str, object]:
    # `name` is server-derived (Phase 3) — clients must not send it. manufacturer
    # + brand are canonical option labels (strictly validated, Phase 2); `suffix`
    # is free text and the per-row discriminator.
    return {
        "manufacturer": "Kawneer",
        "brand": "GL-1",
        "suffix": suffix,
        "u_value_w_m2k": 0.7,
        "g_value": 0.50,
        "color": "#b4dceb",
        "source": "Manufacturer datasheet 2024-Q2",
        "comments": "Argon-filled, two LowE coatings",
    }


def _expected_name(suffix: str = "T") -> str:
    """The server-derived `name` for a `_payload(suffix)` row (Phase 3): the
    composed `manufacturer | brand | suffix`, with `suffix` the discriminator."""
    return compose_glazing_name(_payload(suffix))


def test_create_returns_flat_row(clean_catalog_tables: None) -> None:
    client = signed_in_client()
    response = client.post(
        "/api/v1/catalogs/glazing-types",
        headers={"Origin": ORIGIN},
        json=_payload(),
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["name"] == _expected_name()  # server-derived from the parts
    assert body["manufacturer"] == "Kawneer"
    assert body["suffix"] == "T"
    assert body["u_value_w_m2k"] == pytest.approx(0.7)
    assert body["g_value"] == pytest.approx(0.50)
    assert body["source"] == "Manufacturer datasheet 2024-Q2"
    assert body["comments"] == "Argon-filled, two LowE coatings"
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
    created = client.post("/api/v1/catalogs/glazing-types", headers={"Origin": ORIGIN}, json=_payload("A")).json()
    client.post("/api/v1/catalogs/glazing-types", headers={"Origin": ORIGIN}, json=_payload("B")).json()

    active = client.get("/api/v1/catalogs/glazing-types").json()
    assert {item["name"] for item in active["items"]} == {_expected_name("A"), _expected_name("B")}

    assert (
        client.delete(f"/api/v1/catalogs/glazing-types/{created['id']}", headers={"Origin": ORIGIN}).status_code == 204
    )
    assert {item["name"] for item in client.get("/api/v1/catalogs/glazing-types").json()["items"]} == {
        _expected_name("B")
    }
    listed_inactive = client.get("/api/v1/catalogs/glazing-types", params={"include_inactive": "true"}).json()
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
                "name": "Glazing Side-Effect Test",
                "bt_number": "0009",
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

    created = client.post("/api/v1/catalogs/glazing-types", headers={"Origin": ORIGIN}, json=_payload()).json()
    patched = client.patch(
        f"/api/v1/catalogs/glazing-types/{created['id']}",
        headers={"Origin": ORIGIN},
        json={"u_value_w_m2k": 0.65},
    )
    assert patched.status_code == 200
    assert patched.json()["u_value_w_m2k"] == pytest.approx(0.65)

    with connection() as conn:
        after = conn.execute("SELECT id, body::text AS body_text, updated_at FROM project_versions").fetchall()
    assert after == before


def test_validation_rejects_invalid_values(clean_catalog_tables: None) -> None:
    client = signed_in_client()
    # `name` is server-derived (Phase 3) — sending one is rejected as an extra field.
    inbound_name = client.post(
        "/api/v1/catalogs/glazing-types",
        headers={"Origin": ORIGIN},
        json={**_payload(), "name": "Client supplied"},
    )
    assert inbound_name.status_code == 422

    negative_u = client.post(
        "/api/v1/catalogs/glazing-types",
        headers={"Origin": ORIGIN},
        json={**_payload(), "u_value_w_m2k": -0.1},
    )
    assert negative_u.status_code == 422

    bad_g = client.post(
        "/api/v1/catalogs/glazing-types",
        headers={"Origin": ORIGIN},
        json={**_payload(), "g_value": 1.2},
    )
    assert bad_g.status_code == 422


def test_create_rejects_unknown_manufacturer(clean_catalog_tables: None) -> None:
    client = signed_in_client()
    response = client.post(
        "/api/v1/catalogs/glazing-types",
        headers={"Origin": ORIGIN},
        json={**_payload(), "manufacturer": "NotASeededMaker"},
    )
    assert response.status_code == 422
    assert response.json()["error_code"] == "catalog_option_unknown"


def test_create_rejects_unknown_brand(clean_catalog_tables: None) -> None:
    client = signed_in_client()
    response = client.post(
        "/api/v1/catalogs/glazing-types",
        headers={"Origin": ORIGIN},
        json={**_payload(), "brand": "NoSuchGlass"},
    )
    assert response.status_code == 422
    assert response.json()["error_code"] == "catalog_option_unknown"


def test_patch_rejects_unknown_option(clean_catalog_tables: None) -> None:
    client = signed_in_client()
    created = client.post("/api/v1/catalogs/glazing-types", headers={"Origin": ORIGIN}, json=_payload()).json()
    response = client.patch(
        f"/api/v1/catalogs/glazing-types/{created['id']}",
        headers={"Origin": ORIGIN},
        json={"brand": "NoSuchGlass"},
    )
    assert response.status_code == 422
    assert response.json()["error_code"] == "catalog_option_unknown"


def test_null_manufacturer_and_brand_allowed(clean_catalog_tables: None) -> None:
    client = signed_in_client()
    response = client.post(
        "/api/v1/catalogs/glazing-types",
        headers={"Origin": ORIGIN},
        json={**_payload(), "manufacturer": None, "brand": None},
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["manufacturer"] is None
    assert body["brand"] is None


def test_add_option_then_use_it_succeeds(clean_catalog_tables: None) -> None:
    client = signed_in_client()
    # Add a new brand option via the options route; a row may then use it.
    options = client.get("/api/v1/catalogs/glazing-types/options").json()["fields"]["brand"]
    options.append(
        {"id": "opt_newglass01", "label": "Custom Make-Up 9/12/9", "color": "#3b82f6", "order": float(len(options))}
    )
    assert (
        client.put(
            "/api/v1/catalogs/glazing-types/options",
            headers={"Origin": ORIGIN},
            json={"field_key": "brand", "options": options, "replacements": {}},
        ).status_code
        == 200
    )
    response = client.post(
        "/api/v1/catalogs/glazing-types",
        headers={"Origin": ORIGIN},
        json={**_payload(), "brand": "Custom Make-Up 9/12/9"},
    )
    assert response.status_code == 201, response.text
    assert response.json()["brand"] == "Custom Make-Up 9/12/9"


def test_unauthenticated_read_and_write_rejected(clean_catalog_tables: None) -> None:
    client = signed_in_client()
    client.post("/api/v1/catalogs/glazing-types", headers={"Origin": ORIGIN}, json=_payload())

    anon = TestClient(app)
    assert anon.get("/api/v1/catalogs/glazing-types").status_code == 401
    assert (
        anon.post("/api/v1/catalogs/glazing-types", headers={"Origin": ORIGIN}, json=_payload("Anon")).status_code
        == 401
    )


def test_deactivate_is_idempotent_and_reactivate_restores(clean_catalog_tables: None) -> None:
    client = signed_in_client()
    created = client.post("/api/v1/catalogs/glazing-types", headers={"Origin": ORIGIN}, json=_payload()).json()

    assert (
        client.delete(f"/api/v1/catalogs/glazing-types/{created['id']}", headers={"Origin": ORIGIN}).status_code == 204
    )
    assert (
        client.delete(f"/api/v1/catalogs/glazing-types/{created['id']}", headers={"Origin": ORIGIN}).status_code == 404
    )

    reactivated = client.post(
        f"/api/v1/catalogs/glazing-types/{created['id']}/reactivate",
        headers={"Origin": ORIGIN},
    )
    assert reactivated.status_code == 200
    assert reactivated.json()["is_active"] is True


def test_duplicate_copies_fields_with_same_derived_name(clean_catalog_tables: None) -> None:
    client = signed_in_client()
    created = client.post("/api/v1/catalogs/glazing-types", headers={"Origin": ORIGIN}, json=_payload("Source")).json()

    response = client.post(
        f"/api/v1/catalogs/glazing-types/{created['id']}/duplicate",
        headers={"Origin": ORIGIN},
    )
    assert response.status_code == 201, response.text
    body = response.json()
    # `name` is derived from the parts, so a copy of identical parts has an
    # identical name — duplicates are distinguished by id, not a `(copy)` suffix.
    assert body["name"] == created["name"] == _expected_name("Source")
    assert body["id"] != created["id"]
    assert body["manufacturer"] == created["manufacturer"]
    assert body["u_value_w_m2k"] == pytest.approx(created["u_value_w_m2k"])


def test_catalog_writes_emit_user_action_log_entries(clean_catalog_tables: None) -> None:
    client = signed_in_client()
    created = client.post("/api/v1/catalogs/glazing-types", headers={"Origin": ORIGIN}, json=_payload()).json()
    record_id = created["id"]

    assert (
        client.patch(
            f"/api/v1/catalogs/glazing-types/{record_id}",
            headers={"Origin": ORIGIN},
            json={"u_value_w_m2k": 0.65},
        ).status_code
        == 200
    )
    assert client.delete(f"/api/v1/catalogs/glazing-types/{record_id}", headers={"Origin": ORIGIN}).status_code == 204
    assert (
        client.post(f"/api/v1/catalogs/glazing-types/{record_id}/reactivate", headers={"Origin": ORIGIN}).status_code
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
        assert '"catalog_table": "glazing_types"' in row["details_text"]
        assert record_id in row["details_text"]


# --------------------------------------------------------------------------- #
# Phase 3 — derived (read-only) name.
# --------------------------------------------------------------------------- #


def test_name_is_recomputed_when_a_part_changes_on_patch(clean_catalog_tables: None) -> None:
    client = signed_in_client()
    created = client.post("/api/v1/catalogs/glazing-types", headers={"Origin": ORIGIN}, json=_payload("X")).json()
    assert created["name"] == _expected_name("X")

    patched = client.patch(
        f"/api/v1/catalogs/glazing-types/{created['id']}",
        headers={"Origin": ORIGIN},
        json={"brand": "GL-2"},  # a name-part
    )
    assert patched.status_code == 200
    assert patched.json()["name"] == "Kawneer | GL-2 | X"


def test_patch_of_non_name_part_leaves_name_unchanged(clean_catalog_tables: None) -> None:
    client = signed_in_client()
    created = client.post("/api/v1/catalogs/glazing-types", headers={"Origin": ORIGIN}, json=_payload("X")).json()

    patched = client.patch(
        f"/api/v1/catalogs/glazing-types/{created['id']}",
        headers={"Origin": ORIGIN},
        json={"u_value_w_m2k": 0.5},  # not a name-part
    )
    assert patched.status_code == 200
    assert patched.json()["name"] == _expected_name("X")


def test_option_rename_recomputes_dependent_row_names(clean_catalog_tables: None) -> None:
    client = signed_in_client()
    created = client.post(
        "/api/v1/catalogs/glazing-types",
        headers={"Origin": ORIGIN},
        json={**_payload("X"), "manufacturer": "Intus"},
    ).json()
    assert created["name"] == "Intus | GL-1 | X"

    # Rename the `Intus` manufacturer option in place.
    options = client.get("/api/v1/catalogs/glazing-types/options").json()["fields"]["manufacturer"]
    for option in options:
        if option["label"] == "Intus":
            option["label"] = "Intus Inc"
    assert (
        client.put(
            "/api/v1/catalogs/glazing-types/options",
            headers={"Origin": ORIGIN},
            json={"field_key": "manufacturer", "options": options, "replacements": {}},
        ).status_code
        == 200
    )

    # The row's cell *and* its derived name follow the rename.
    row = client.get(f"/api/v1/catalogs/glazing-types/{created['id']}").json()
    assert row["manufacturer"] == "Intus Inc"
    assert row["name"] == "Intus Inc | GL-1 | X"


def test_compose_glazing_name_reproduces_every_seed_row_name() -> None:
    """Lossless-derivation proof (research §2): the composer reproduces the
    stored ``name`` of every row in the committed (cleaned) seed — so the
    backfill is a no-op diff on clean data and the derivation never loses
    information."""
    payload = json.loads(GLAZING_SEED_PATH.read_text())
    mismatches = [row["name"] for row in payload["rows"] if compose_glazing_name(row) != row["name"]]
    assert mismatches == []

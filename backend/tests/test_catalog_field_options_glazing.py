"""Glazing single-select option-store contract tests (Phase 1).

The mirror of ``test_catalog_field_options.py`` for the glazing-types
``GET/PUT …/options`` routes: seeded canonical sets, add/rename, the
case-insensitive uniqueness guard, and the delete/merge cascade onto catalog
rows. The store itself is generic (D-7); these cover the glazing wiring +
policy (only ``manufacturer`` / ``brand`` are editable).
"""

from __future__ import annotations

from collections.abc import Iterator
from typing import Any

import pytest

from database import transaction
from features.catalogs.glazing_types.options_service import seed_glazing_type_options
from tests.test_catalogs_glazing_types import ORIGIN, _payload, signed_in_client

# Phase 0 canonical cardinalities (GLAZING_TYPE_OPTION_SEEDS).
_EXPECTED_COUNTS = {
    "manufacturer": 13,
    "brand": 39,
}


@pytest.fixture(autouse=True)
def _reset_glazing_options() -> Iterator[None]:
    """Restore the canonical glazing-type option lists before and after each test.

    ``catalog_field_options`` has no FK to the row tables, so it survives the
    ``clean_catalog_tables`` CASCADE truncate — this fixture is what isolates
    option mutations between tests.
    """
    _seed_canonical()
    yield
    _seed_canonical()


def _seed_canonical() -> None:
    # seed_glazing_type_options -> replace_options already DELETEs each field, so
    # a full reset to canonical needs no separate truncate here.
    with transaction() as conn:
        seed_glazing_type_options(conn)


def _opt(label: str, order: float, *, option_id: str | None = None, color: str = "#3b82f6") -> dict[str, Any]:
    return {
        "id": option_id or f"opt_{label.lower().replace(' ', '_').replace('/', '_')}",
        "label": label,
        "color": color,
        "order": order,
    }


def _get_field_options(client: Any, field_key: str) -> list[dict[str, Any]]:
    body = client.get("/api/v1/catalogs/glazing-types/options").json()
    return body["fields"][field_key]


def _put(client: Any, field_key: str, options: list[dict[str, Any]], replacements: dict[str, str] | None = None) -> Any:
    return client.put(
        "/api/v1/catalogs/glazing-types/options",
        headers={"Origin": ORIGIN},
        json={"field_key": field_key, "options": options, "replacements": replacements or {}},
    )


def _create_glazing(client: Any, name: str, **overrides: Any) -> dict[str, Any]:
    body = {**_payload(name), **overrides}
    response = client.post("/api/v1/catalogs/glazing-types", headers={"Origin": ORIGIN}, json=body)
    assert response.status_code == 201, response.text
    return response.json()


def test_list_returns_seeded_canonical_sets(clean_catalog_tables: None) -> None:
    client = signed_in_client()
    fields = client.get("/api/v1/catalogs/glazing-types/options").json()["fields"]
    assert {key: len(value) for key, value in fields.items()} == _EXPECTED_COUNTS
    assert [option["label"] for option in fields["manufacturer"]][:3] == ["Alpen", "Internorm", "Intus"]


def test_add_option_appears_in_list(clean_catalog_tables: None) -> None:
    client = signed_in_client()
    options = _get_field_options(client, "brand")
    options.append(_opt("New Make-Up 5/12/5", float(len(options)), option_id="opt_newbrand01"))
    assert _put(client, "brand", options).status_code == 200

    labels = [option["label"] for option in _get_field_options(client, "brand")]
    assert "New Make-Up 5/12/5" in labels


def test_case_insensitive_duplicate_label_rejected(clean_catalog_tables: None) -> None:
    client = signed_in_client()
    options = _get_field_options(client, "manufacturer")
    options.append(_opt("intus", float(len(options)), option_id="opt_intus_dupe"))  # "Intus" already exists
    response = _put(client, "manufacturer", options)
    assert response.status_code == 422
    assert response.json()["error_code"] == "custom_field_option_list_invalid"


def test_delete_unused_option_succeeds(clean_catalog_tables: None) -> None:
    client = signed_in_client()
    options = _get_field_options(client, "brand")
    removed = options.pop()  # nothing references it
    assert _put(client, "brand", options).status_code == 200
    assert removed["label"] not in [option["label"] for option in _get_field_options(client, "brand")]


def test_delete_in_use_option_without_replacement_is_rejected(clean_catalog_tables: None) -> None:
    client = signed_in_client()
    _create_glazing(client, "Uses GL-1", manufacturer="Kawneer", brand="GL-1")
    options = [option for option in _get_field_options(client, "brand") if option["label"] != "GL-1"]
    response = _put(client, "brand", options)
    assert response.status_code == 409
    assert response.json()["error_code"] == "catalog_option_in_use"


def test_merge_rewrites_rows_to_replacement(clean_catalog_tables: None) -> None:
    client = signed_in_client()
    created = _create_glazing(client, "Uses GL-1", manufacturer="Kawneer", brand="GL-1")
    options = [option for option in _get_field_options(client, "brand") if option["label"] != "GL-1"]
    assert _put(client, "brand", options, replacements={"GL-1": "GL-2"}).status_code == 200

    row = client.get(f"/api/v1/catalogs/glazing-types/{created['id']}").json()
    assert row["brand"] == "GL-2"
    assert "GL-1" not in [option["label"] for option in _get_field_options(client, "brand")]


def test_in_place_rename_rewrites_rows(clean_catalog_tables: None) -> None:
    client = signed_in_client()
    created = _create_glazing(client, "Intus glazing", manufacturer="Intus", brand="LOUVER")
    options = _get_field_options(client, "manufacturer")
    for option in options:
        if option["label"] == "Intus":
            option["label"] = "Intus Inc"  # same id, new label
    assert _put(client, "manufacturer", options).status_code == 200

    row = client.get(f"/api/v1/catalogs/glazing-types/{created['id']}").json()
    assert row["manufacturer"] == "Intus Inc"


def test_unknown_field_key_is_rejected(clean_catalog_tables: None) -> None:
    client = signed_in_client()
    response = _put(client, "suffix", [_opt("T", 0.0)])  # `suffix` is free text, not a single-select
    assert response.status_code == 422
    assert response.json()["error_code"] == "catalog_field_key_unknown"

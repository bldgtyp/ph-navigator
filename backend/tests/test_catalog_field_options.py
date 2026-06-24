"""Catalog single-select option-store contract tests (Phase 1).

Covers the ``catalog_field_options`` store via the frame-types
``GET/PUT …/options`` routes plus the generic repository: seeded canonical
sets, add/rename/reorder, the case-insensitive uniqueness guard, and the
delete/merge cascade onto catalog rows.
"""

from __future__ import annotations

from collections.abc import Iterator
from typing import Any

import pytest

from database import transaction
from features.catalogs import _options_repository as options_repository
from features.catalogs.frame_types.options_service import seed_frame_type_options
from features.project_document.rows import SingleSelectOption
from tests.test_catalogs_frame_types import ORIGIN, _payload, signed_in_client

# Phase 0 canonical cardinalities (FRAME_TYPE_OPTION_SEEDS).
_EXPECTED_COUNTS = {
    "use": 6,
    "operation": 7,
    "location": 6,
    "mull_type": 3,
    "manufacturer": 13,
    "brand": 23,
}


@pytest.fixture(autouse=True)
def _reset_frame_options() -> Iterator[None]:
    """Restore the canonical frame-type option lists before and after each test.

    ``catalog_field_options`` has no FK to the row tables, so it survives the
    ``clean_catalog_tables`` CASCADE truncate — this fixture is what isolates
    option mutations between tests.
    """
    _seed_canonical()
    yield
    _seed_canonical()


def _seed_canonical() -> None:
    # seed_frame_type_options -> replace_options already DELETEs each field, so a
    # full reset to canonical needs no separate truncate here.
    with transaction() as conn:
        seed_frame_type_options(conn)


def _opt(label: str, order: float, *, option_id: str | None = None, color: str = "#3b82f6") -> dict[str, Any]:
    return {
        "id": option_id or f"opt_{label.lower().replace(' ', '_').replace('&', 'and')}",
        "label": label,
        "color": color,
        "order": order,
    }


def _get_field_options(client: Any, field_key: str) -> list[dict[str, Any]]:
    body = client.get("/api/v1/catalogs/frame-types/options").json()
    return body["fields"][field_key]


def _put(client: Any, field_key: str, options: list[dict[str, Any]], replacements: dict[str, str] | None = None) -> Any:
    return client.put(
        "/api/v1/catalogs/frame-types/options",
        headers={"Origin": ORIGIN},
        json={"field_key": field_key, "options": options, "replacements": replacements or {}},
    )


def _create_frame(client: Any, name: str, **overrides: Any) -> dict[str, Any]:
    body = {**_payload(name), **overrides}
    response = client.post("/api/v1/catalogs/frame-types", headers={"Origin": ORIGIN}, json=body)
    assert response.status_code == 201, response.text
    return response.json()


def test_list_returns_seeded_canonical_sets(clean_catalog_tables: None) -> None:
    client = signed_in_client()
    fields = client.get("/api/v1/catalogs/frame-types/options").json()["fields"]
    assert {key: len(value) for key, value in fields.items()} == _EXPECTED_COUNTS
    assert [option["label"] for option in fields["mull_type"]] == ["OP-to-OP", "OP-to-FX", "FX-to-FX"]


def test_add_option_appears_in_list(clean_catalog_tables: None) -> None:
    client = signed_in_client()
    options = _get_field_options(client, "brand")
    options.append(_opt("Vanguard", float(len(options)), option_id="opt_vanguard01"))
    assert _put(client, "brand", options).status_code == 200

    labels = [option["label"] for option in _get_field_options(client, "brand")]
    assert "Vanguard" in labels


def test_case_insensitive_duplicate_label_rejected(clean_catalog_tables: None) -> None:
    client = signed_in_client()
    options = _get_field_options(client, "use")
    options.append(_opt("door", float(len(options)), option_id="opt_door_dupe"))  # "Door" already exists
    response = _put(client, "use", options)
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
    _create_frame(client, "Uses Tyrol", brand="Tyrol")
    options = [option for option in _get_field_options(client, "brand") if option["label"] != "Tyrol"]
    response = _put(client, "brand", options)
    assert response.status_code == 409
    assert response.json()["error_code"] == "catalog_option_in_use"


def test_merge_rewrites_rows_to_replacement(clean_catalog_tables: None) -> None:
    client = signed_in_client()
    created = _create_frame(client, "Uses Tyrol", brand="Tyrol")
    options = [option for option in _get_field_options(client, "brand") if option["label"] != "Tyrol"]
    assert _put(client, "brand", options, replacements={"Tyrol": "Zenith"}).status_code == 200

    row = client.get(f"/api/v1/catalogs/frame-types/{created['id']}").json()
    assert row["brand"] == "Zenith"
    assert "Tyrol" not in [option["label"] for option in _get_field_options(client, "brand")]


def test_in_place_rename_rewrites_rows(clean_catalog_tables: None) -> None:
    client = signed_in_client()
    created = _create_frame(client, "Casement frame", operation="Casement")
    options = _get_field_options(client, "operation")
    for option in options:
        if option["label"] == "Casement":
            option["label"] = "Casement-X"  # same id, new label
    assert _put(client, "operation", options).status_code == 200

    row = client.get(f"/api/v1/catalogs/frame-types/{created['id']}").json()
    assert row["operation"] == "Casement-X"


def test_merge_replacement_not_in_new_list_is_rejected(clean_catalog_tables: None) -> None:
    client = signed_in_client()
    _create_frame(client, "Uses Tyrol", brand="Tyrol")
    options = [option for option in _get_field_options(client, "brand") if option["label"] != "Tyrol"]
    response = _put(client, "brand", options, replacements={"Tyrol": "Nonexistent"})
    assert response.status_code == 422
    assert response.json()["error_code"] == "catalog_option_replacement_unknown"


def test_unknown_field_key_is_rejected(clean_catalog_tables: None) -> None:
    client = signed_in_client()
    response = _put(client, "material", [_opt("Aluminum", 0.0)])  # `material` is free text, not a single-select
    assert response.status_code == 422
    assert response.json()["error_code"] == "catalog_field_key_unknown"


def test_append_options_dedupes_case_insensitively(clean_catalog_tables: None) -> None:
    """`append_options` (the import auto-add path) must not insert a label that
    collides case-insensitively with an existing one or another in the batch —
    that would violate the case-insensitive unique index."""
    with transaction() as conn:
        added = options_repository.append_options(
            conn,
            catalog_table="frame_types",
            field_key="brand",
            new_labels=["NewCo", "newco", "  NEWCO  ", "Tyrol"],  # 3 case-dups + 1 already seeded
        )
        labels = [
            row["label"]
            for row in options_repository.list_options(conn, catalog_table="frame_types", field_key="brand")
        ]
    assert added == ["NewCo"]
    assert labels.count("NewCo") == 1
    assert "newco" not in labels


def test_store_is_field_key_generic(clean_catalog_tables: None) -> None:
    """The repository works for any catalog_table (D-7) — glazing isn't wired
    through routes yet, but the store must not assume frame-types."""
    with transaction() as conn:
        options_repository.replace_options(
            conn,
            catalog_table="glazing_types",
            field_key="manufacturer",
            options=[SingleSelectOption(id="opt_glz1", label="ExampleGlass", color="#10b981", order=0.0)],
        )
        stored = options_repository.list_options(conn, catalog_table="glazing_types", field_key="manufacturer")
        conn.execute("DELETE FROM catalog_field_options WHERE catalog_table = 'glazing_types'")
    assert [row["label"] for row in stored] == ["ExampleGlass"]

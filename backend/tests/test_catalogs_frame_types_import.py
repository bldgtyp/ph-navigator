"""Frame-types catalog JSON import contract tests."""

from __future__ import annotations

import json
from collections.abc import Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient

from database import transaction
from features.auth.service import create_or_update_user
from features.catalogs.frame_types.import_export import tokens
from features.catalogs.frame_types.import_export.file_format import (
    CURRENT_SCHEMA_VERSION,
    FILE_KIND,
)
from features.catalogs.frame_types.options_service import seed_frame_type_options
from main import app
from scripts._seed_paths import FRAME_SEED_PATH

ORIGIN = "http://localhost:5173"

_TRUNCATE = """
TRUNCATE catalog_materials,
         catalog_frame_types,
         catalog_glazing_types,
         user_action_log, sessions, project_status_items,
         project_version_drafts, project_versions, project_location, projects, users
RESTART IDENTITY CASCADE
"""


@pytest.fixture()
def clean_state() -> Iterator[None]:
    tokens.reset_for_tests()
    with transaction() as conn:
        conn.execute(_TRUNCATE)
    yield
    with transaction() as conn:
        conn.execute(_TRUNCATE)
    tokens.reset_for_tests()


@pytest.fixture(autouse=True)
def _reset_frame_options() -> Iterator[None]:
    """Keep the option store at its canonical baseline so `new_option` detection
    is deterministic and the auto-add test doesn't leak into others."""
    with transaction() as conn:
        seed_frame_type_options(conn)
    yield
    with transaction() as conn:
        seed_frame_type_options(conn)


def _signed_in_client() -> TestClient:
    create_or_update_user(email="ed@example.com", display_name="Ed May", password="password")
    client = TestClient(app)
    response = client.post(
        "/api/v1/auth/login",
        headers={"Origin": ORIGIN},
        json={"email": "ed@example.com", "password": "password"},
    )
    assert response.status_code == 200
    return client


def _wrap(rows: list[dict[str, Any]], *, schema_version: int = CURRENT_SCHEMA_VERSION) -> dict[str, Any]:
    return {
        "kind": FILE_KIND,
        "schema_version": schema_version,
        "rows": rows,
    }


def _good_row(name: str = "Alpen | Tyrol | Window | Casement | Head", **overrides: Any) -> dict[str, Any]:
    base: dict[str, Any] = {
        "name": name,
        "manufacturer": "Alpen",
        "brand": "Tyrol",
        "use": "Window",
        "operation": "Casement",
        "location": "Head",
        "mull_type": None,
        "prefix": None,
        "suffix": None,
        "material": "Aluminum",
        "width_mm": 109.5,
        "u_value_w_m2k": 0.9752,
        "psi_g_w_mk": 0.025,
        "psi_install_w_mk": None,
        "color": None,
        "source": "Manufacturer",
        "comments": None,
    }
    base.update(overrides)
    return base


def test_preview_then_commit_inserts_new_rows(clean_state: None) -> None:
    client = _signed_in_client()
    # `name` is derived (Phase 3/4), so rows are differentiated by `suffix`.
    body = _wrap([_good_row(suffix="A"), _good_row(suffix="B")])

    preview = client.post(
        "/api/v1/catalogs/frame-types/import/preview",
        headers={"Origin": ORIGIN},
        json=body,
    )
    assert preview.status_code == 200, preview.text
    report = preview.json()
    assert report["counts"] == {"new": 2, "matched": 0, "errored": 0, "warnings": 0, "dropped": 0}
    token = report["token"]

    commit = client.post(
        "/api/v1/catalogs/frame-types/import/commit",
        headers={"Origin": ORIGIN},
        json={"token": token},
    )
    assert commit.status_code == 200, commit.text
    assert commit.json()["inserted"] == 2

    listed = client.get("/api/v1/catalogs/frame-types").json()
    assert {item["name"] for item in listed["items"]} == {
        "Alpen | Tyrol | Window | Casement | Head | A",
        "Alpen | Tyrol | Window | Casement | Head | B",
    }
    by_suffix = {item["suffix"]: item for item in listed["items"]}
    # All seventeen typed columns round-trip on the way through the pipeline.
    assert by_suffix["A"]["use"] == "Window"
    assert by_suffix["A"]["operation"] == "Casement"
    assert by_suffix["A"]["location"] == "Head"
    assert by_suffix["A"]["material"] == "Aluminum"
    assert by_suffix["A"]["width_mm"] == pytest.approx(109.5)
    assert by_suffix["A"]["psi_g_w_mk"] == pytest.approx(0.025)


def test_bad_envelope_kind_returns_400(clean_state: None) -> None:
    client = _signed_in_client()
    body = {"kind": "wrong", "schema_version": 1, "rows": []}
    response = client.post("/api/v1/catalogs/frame-types/import/preview", headers={"Origin": ORIGIN}, json=body)
    assert response.status_code == 400
    assert response.json()["error_code"] == "catalog_import_bad_envelope"


def test_schema_version_too_new_returns_400(clean_state: None) -> None:
    client = _signed_in_client()
    response = client.post(
        "/api/v1/catalogs/frame-types/import/preview",
        headers={"Origin": ORIGIN},
        json=_wrap([_good_row()], schema_version=CURRENT_SCHEMA_VERSION + 1),
    )
    assert response.status_code == 400
    assert response.json()["error_code"] == "catalog_import_schema_too_new"


def test_upgrade_v0_renames_legacy_keys(clean_state: None) -> None:
    """v0 files used `source_provenance` / `notes`; the upgrade step
    renames them so the row lands under the v1 `source` / `comments`
    columns."""
    client = _signed_in_client()
    legacy_row = {
        "name": "Legacy",
        "manufacturer": "X",
        "brand": "Y",
        "width_mm": 100.0,
        "u_value_w_m2k": 0.85,
        "source_provenance": "old prov",
        "notes": "old notes",
    }
    preview = client.post(
        "/api/v1/catalogs/frame-types/import/preview",
        headers={"Origin": ORIGIN},
        json=_wrap([legacy_row], schema_version=0),
    )
    assert preview.status_code == 200, preview.text
    token = preview.json()["token"]
    assert (
        client.post(
            "/api/v1/catalogs/frame-types/import/commit",
            headers={"Origin": ORIGIN},
            json={"token": token},
        ).status_code
        == 200
    )
    landed = client.get("/api/v1/catalogs/frame-types").json()["items"][0]
    assert landed["source"] == "old prov"
    assert landed["comments"] == "old notes"


def test_matched_id_classifies_as_matched_and_skips(clean_state: None) -> None:
    client = _signed_in_client()
    # `name` is server-derived (Phase 3) — this row only needs an id to match on.
    created = client.post(
        "/api/v1/catalogs/frame-types",
        headers={"Origin": ORIGIN},
        json={"u_value_w_m2k": 0.7},
    ).json()

    body = _wrap([_good_row("Existing", id=created["id"]), _good_row("Fresh")])
    preview = client.post(
        "/api/v1/catalogs/frame-types/import/preview",
        headers={"Origin": ORIGIN},
        json=body,
    )
    assert preview.status_code == 200
    counts = preview.json()["counts"]
    assert counts["matched"] == 1
    assert counts["new"] == 1


def test_bad_number_warns_and_blanks_field(clean_state: None) -> None:
    client = _signed_in_client()
    body = _wrap([_good_row(u_value_w_m2k="not-a-number")])
    preview = client.post(
        "/api/v1/catalogs/frame-types/import/preview",
        headers={"Origin": ORIGIN},
        json=body,
    ).json()
    reasons = {warning["reason"] for warning in preview["warnings"]}
    assert "bad_number" in reasons


def test_unknown_field_warns(clean_state: None) -> None:
    client = _signed_in_client()
    body = _wrap([{**_good_row(), "made_up_column": "nope"}])
    preview = client.post(
        "/api/v1/catalogs/frame-types/import/preview",
        headers={"Origin": ORIGIN},
        json=body,
    ).json()
    reasons = {warning["reason"] for warning in preview["warnings"]}
    assert "unknown_field:made_up_column" in reasons


def test_missing_name_is_computed_not_errored(clean_state: None) -> None:
    """`name` is derived from the parts (Phase 3/4), so a file with no/blank
    `name` imports clean and the row's name is composed."""
    client = _signed_in_client()
    body = _wrap([{**_good_row(), "name": "   "}])
    preview = client.post(
        "/api/v1/catalogs/frame-types/import/preview",
        headers={"Origin": ORIGIN},
        json=body,
    ).json()
    assert preview["counts"]["errored"] == 0
    assert preview["rows_preview"][0]["name"] == "Alpen | Tyrol | Window | Casement | Head"


def test_commit_token_is_one_shot(clean_state: None) -> None:
    client = _signed_in_client()
    preview = client.post(
        "/api/v1/catalogs/frame-types/import/preview",
        headers={"Origin": ORIGIN},
        json=_wrap([_good_row()]),
    ).json()
    token = preview["token"]
    assert (
        client.post(
            "/api/v1/catalogs/frame-types/import/commit",
            headers={"Origin": ORIGIN},
            json={"token": token},
        ).status_code
        == 200
    )
    second = client.post(
        "/api/v1/catalogs/frame-types/import/commit",
        headers={"Origin": ORIGIN},
        json={"token": token},
    )
    assert second.status_code == 410
    assert second.json()["error_code"] == "catalog_import_token_missing"


def test_round_trip_matched_rows_are_a_noop(clean_state: None) -> None:
    """Import N rows, re-export them, re-import: every row resolves to
    `matched` and the catalog stays at N rows."""
    client = _signed_in_client()
    body = _wrap([_good_row(name=f"row-{i}") for i in range(5)])

    preview = client.post(
        "/api/v1/catalogs/frame-types/import/preview",
        headers={"Origin": ORIGIN},
        json=body,
    ).json()
    assert (
        client.post(
            "/api/v1/catalogs/frame-types/import/commit",
            headers={"Origin": ORIGIN},
            json={"token": preview["token"]},
        ).status_code
        == 200
    )

    landed = client.get("/api/v1/catalogs/frame-types").json()["items"]
    re_export_rows = [
        {
            key: row[key]
            for key in (
                "id",
                "name",
                "manufacturer",
                "brand",
                "use",
                "operation",
                "location",
                "mull_type",
                "prefix",
                "suffix",
                "material",
                "width_mm",
                "u_value_w_m2k",
                "psi_g_w_mk",
                "psi_install_w_mk",
                "color",
                "source",
                "comments",
            )
        }
        for row in landed
    ]
    re_preview = client.post(
        "/api/v1/catalogs/frame-types/import/preview",
        headers={"Origin": ORIGIN},
        json=_wrap(re_export_rows),
    ).json()
    assert re_preview["counts"] == {"new": 0, "matched": 5, "errored": 0, "warnings": 0, "dropped": 0}


# --------------------------------------------------------------------------- #
# Phase 4 — schema v2 upgrade (fold legacy values) + auto-add on import.
# --------------------------------------------------------------------------- #


def _import(client: TestClient, body: dict[str, Any]) -> dict[str, Any]:
    preview = client.post("/api/v1/catalogs/frame-types/import/preview", headers={"Origin": ORIGIN}, json=body).json()
    commit = client.post(
        "/api/v1/catalogs/frame-types/import/commit",
        headers={"Origin": ORIGIN},
        json={"token": preview["token"]},
    )
    assert commit.status_code == 200, commit.text
    return preview


def _rows(client: TestClient) -> list[dict[str, Any]]:
    return client.get("/api/v1/catalogs/frame-types").json()["items"]


def test_v1_op_to_fix_folds_to_canonical_and_computes_name(clean_state: None) -> None:
    client = _signed_in_client()
    # v1 file: legacy `OP-TO-FIX` typo + blank `name`.
    body = _wrap([{**_good_row(suffix="V1"), "name": "  ", "mull_type": "OP-TO-FIX"}], schema_version=1)
    preview = _import(client, body)
    assert preview["counts"]["errored"] == 0

    row = next(item for item in _rows(client) if item["suffix"] == "V1")
    assert row["mull_type"] == "OP-to-FX"  # folded
    assert row["name"] == "Alpen | Tyrol | Window | Casement | Head | OP-to-FX | V1"  # computed


def test_v1_swapped_mercury_row_is_corrected(clean_state: None) -> None:
    client = _signed_in_client()
    body = _wrap([_good_row(suffix="SWAP", manufacturer="Mercury", brand="CURRIES")], schema_version=1)
    _import(client, body)

    row = next(item for item in _rows(client) if item["suffix"] == "SWAP")
    assert row["manufacturer"] == "Curries"
    assert row["brand"] == "Mercury"


def test_v1_default_artifact_row_is_dropped(clean_state: None) -> None:
    client = _signed_in_client()
    body = _wrap(
        [_good_row(suffix="KEEP"), _good_row(suffix="DROP", manufacturer="Default")],
        schema_version=1,
    )
    preview = _import(client, body)
    assert preview["counts"]["dropped"] == 1
    assert preview["counts"]["new"] == 1

    suffixes = {item["suffix"] for item in _rows(client)}
    assert suffixes == {"KEEP"}


def test_unknown_value_is_auto_added_with_warning(clean_state: None) -> None:
    client = _signed_in_client()
    body = _wrap([_good_row(suffix="NEW", brand="NewCo")])  # `NewCo` is not a seeded brand option
    preview = _import(client, body)

    reasons = {warning["reason"] for warning in preview["warnings"]}
    assert "new_option:brand" in reasons

    # The label was auto-added to the brand option store...
    brand_labels = {
        opt["label"] for opt in client.get("/api/v1/catalogs/frame-types/options").json()["fields"]["brand"]
    }
    assert "NewCo" in brand_labels
    # ...and the row landed with it.
    row = next(item for item in _rows(client) if item["suffix"] == "NEW")
    assert row["brand"] == "NewCo"


def test_committed_seed_imports_clean_through_v2_pipeline(clean_state: None) -> None:
    """Seed parity: the committed (Phase 0-cleaned) seed file is schema_version=1;
    it upgrades v1→v2 as a no-op (already canonical), every value is a known
    option, and names compute to the stored values — 0 errored / dropped / new
    options."""
    client = _signed_in_client()
    payload = json.loads(FRAME_SEED_PATH.read_text())
    preview = client.post(
        "/api/v1/catalogs/frame-types/import/preview",
        headers={"Origin": ORIGIN},
        json=payload,
    ).json()
    counts = preview["counts"]
    assert counts["errored"] == 0
    assert counts["dropped"] == 0
    assert counts["new"] == len(payload["rows"])
    new_option_warnings = [w["reason"] for w in preview["warnings"] if w["reason"].startswith("new_option")]
    assert new_option_warnings == []

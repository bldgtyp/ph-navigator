"""Materials catalog JSON import contract tests.

Covers the nine scenarios in `phase-02-backend-import-pipeline.md`:
envelope reject, newer-version reject, round-trip, empty-DB seed, the
coercion paths, required-field error, upgrade chain, token lifecycle,
and atomicity.
"""

from __future__ import annotations

from collections.abc import Iterator
from typing import Any
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from database import transaction
from features.catalogs.materials.import_export import tokens
from features.catalogs.materials.import_export.file_format import (
    CURRENT_SCHEMA_VERSION,
    FILE_KIND,
)
from main import app
from tests.catalog_helpers import create_catalog_admin

ORIGIN = "http://localhost:5173"

_TRUNCATE = """
TRUNCATE catalog_materials, catalog_frame_types,
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


def _signed_in_client(
    email: str = "ed@example.com",
    name: str = "Ed May",
    *,
    raise_server_exceptions: bool = True,
) -> TestClient:
    create_catalog_admin(email=email, display_name=name)
    client = TestClient(app, raise_server_exceptions=raise_server_exceptions)
    response = client.post(
        "/api/v1/auth/login",
        headers={"Origin": ORIGIN},
        json={"email": email, "password": "password"},
    )
    assert response.status_code == 200
    return client


def _wrap(rows: list[dict[str, Any]], *, schema_version: int = CURRENT_SCHEMA_VERSION) -> dict[str, Any]:
    return {
        "kind": FILE_KIND,
        "schema_version": schema_version,
        "rows": rows,
    }


def _good_row(name: str = "XPS", **overrides: Any) -> dict[str, Any]:
    base: dict[str, Any] = {
        "name": name,
        "category": "insulation",
        "density_kg_m3": 35.0,
        "specific_heat_j_kgk": 1500.0,
        "conductivity_w_mk": 0.034,
        "emissivity": 0.9,
        "color": "#dce6f0",
        "source": "Manufacturer datasheet 2024-Q2",
        "url": "https://example.com/xps.pdf",
        "comments": "Type IV per ASTM C578",
    }
    base.update(overrides)
    return base


def _create_row(client: TestClient, **overrides: Any) -> dict[str, Any]:
    response = client.post(
        "/api/v1/catalogs/materials",
        headers={"Origin": ORIGIN},
        json=_good_row(**overrides),
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert isinstance(body, dict)
    return body


# 1 — Envelope check ---------------------------------------------------


def test_preview_rejects_bad_kind(clean_state: None) -> None:
    client = _signed_in_client()
    bad = {"kind": "ph-navigator.something.else", "schema_version": 1, "rows": []}
    response = client.post("/api/v1/catalogs/materials/import/preview", headers={"Origin": ORIGIN}, json=bad)
    assert response.status_code == 400
    body = response.json()
    assert body["error_code"] == "catalog_import_bad_envelope"


def test_preview_rejects_missing_kind(clean_state: None) -> None:
    client = _signed_in_client()
    response = client.post(
        "/api/v1/catalogs/materials/import/preview",
        headers={"Origin": ORIGIN},
        json={"schema_version": 1, "rows": []},
    )
    assert response.status_code == 400


# 2 — Schema version newer than current --------------------------------


def test_preview_rejects_schema_too_new(clean_state: None) -> None:
    client = _signed_in_client()
    body = _wrap([_good_row()], schema_version=CURRENT_SCHEMA_VERSION + 5)
    response = client.post("/api/v1/catalogs/materials/import/preview", headers={"Origin": ORIGIN}, json=body)
    assert response.status_code == 400
    assert response.json()["error_code"] == "catalog_import_schema_too_new"


# 3 — Round-trip -------------------------------------------------------


def test_round_trip_existing_rows_are_skipped(clean_state: None) -> None:
    client = _signed_in_client()
    created = [
        _create_row(client, name="XPS"),
        _create_row(client, name="Mineral Wool"),
        _create_row(client, name="Cellulose"),
    ]

    file_rows: list[dict[str, Any]] = []
    for row in created:
        file_rows.append(
            {
                "id": row["id"],
                **{
                    k: row[k]
                    for k in (
                        "name",
                        "category",
                        "density_kg_m3",
                        "specific_heat_j_kgk",
                        "conductivity_w_mk",
                        "emissivity",
                        "color",
                        "source",
                        "url",
                        "comments",
                    )
                },
            }
        )

    preview = client.post(
        "/api/v1/catalogs/materials/import/preview",
        headers={"Origin": ORIGIN},
        json=_wrap(file_rows),
    ).json()
    assert preview["counts"]["new"] == 0
    assert preview["counts"]["matched"] == 3
    assert preview["counts"]["errored"] == 0

    commit = client.post(
        "/api/v1/catalogs/materials/import/commit",
        headers={"Origin": ORIGIN},
        json={"token": preview["token"]},
    )
    assert commit.status_code == 200
    assert commit.json() == {
        "inserted": 0,
        "inserted_ids": [],
        "skipped_conflict_ids": [],
    }


# 4 — Empty-DB seed ----------------------------------------------------


def test_empty_db_seed_inserts_all_rows(clean_state: None) -> None:
    client = _signed_in_client()
    file_rows = [_good_row(name=f"Mat {idx}", conductivity_w_mk=0.030 + idx * 0.001) for idx in range(5)]

    preview = client.post(
        "/api/v1/catalogs/materials/import/preview",
        headers={"Origin": ORIGIN},
        json=_wrap(file_rows),
    ).json()
    assert preview["counts"]["new"] == 5
    assert preview["counts"]["matched"] == 0
    assert preview["counts"]["errored"] == 0

    commit = client.post(
        "/api/v1/catalogs/materials/import/commit",
        headers={"Origin": ORIGIN},
        json={"token": preview["token"]},
    ).json()
    assert commit["inserted"] == 5
    for record_id in commit["inserted_ids"]:
        assert record_id.startswith("rec")
        assert len(record_id) == 17

    listed = client.get("/api/v1/catalogs/materials").json()
    assert {item["name"] for item in listed["items"]} == {f"Mat {idx}" for idx in range(5)}


# 5 — Coercion paths ---------------------------------------------------


def test_preview_collects_every_coercion_warning(clean_state: None) -> None:
    client = _signed_in_client()
    file_rows: list[dict[str, Any]] = [
        _good_row(name="Unknown category", category="not-a-category"),
        _good_row(name="Bad number", conductivity_w_mk="not-a-number"),
        _good_row(name="Emissivity out of range", emissivity=1.5),
        _good_row(name="Bad color", color="not-a-color"),
        # Extra unknown key on an otherwise-good row.
        {**_good_row(name="Unknown field"), "fictional_field": 42},
    ]
    preview = client.post(
        "/api/v1/catalogs/materials/import/preview",
        headers={"Origin": ORIGIN},
        json=_wrap(file_rows),
    ).json()
    reasons = {entry["reason"] for entry in preview["warnings"]}
    assert "unknown_category" in reasons
    assert "bad_number" in reasons
    assert "emissivity_range" in reasons
    assert "bad_color" in reasons
    assert any(reason.startswith("unknown_field:") for reason in reasons)

    # Unknown-category row is excluded (DB needs a known category).
    # The other four still import; their offending field lands blank.
    assert preview["counts"]["errored"] == 1
    error_reasons = {entry["reason"] for entry in preview["errors"]}
    assert error_reasons == {"missing_category"}

    by_index = {row["index"]: row for row in preview["rows_preview"]}
    assert by_index[1]["classification"] == "new"  # bad_number row still imports
    assert by_index[2]["classification"] == "new"  # emissivity_range row imports
    assert by_index[3]["classification"] == "new"  # bad_color row imports
    assert by_index[4]["classification"] == "new"  # unknown_field row imports


def test_argb_legacy_color_is_converted_not_warned(clean_state: None) -> None:
    client = _signed_in_client()
    preview = client.post(
        "/api/v1/catalogs/materials/import/preview",
        headers={"Origin": ORIGIN},
        json=_wrap([_good_row(name="ARGB Row", color="255,220,230,240")]),
    ).json()
    assert preview["counts"]["new"] == 1
    assert preview["counts"]["warnings"] == 0


# 6 — Required-field error ---------------------------------------------


def test_missing_name_errors_only_the_offending_row(clean_state: None) -> None:
    client = _signed_in_client()
    file_rows = [
        _good_row(name="Good"),
        _good_row(name="   "),  # whitespace-only ⇒ missing_name
        _good_row(name="Also Good"),
    ]
    preview = client.post(
        "/api/v1/catalogs/materials/import/preview",
        headers={"Origin": ORIGIN},
        json=_wrap(file_rows),
    ).json()
    assert preview["counts"]["new"] == 2
    assert preview["counts"]["errored"] == 1
    error_reasons = {entry["reason"] for entry in preview["errors"]}
    assert "missing_name" in error_reasons


# 7 — Upgrade chain ----------------------------------------------------


def test_v0_file_upgrades_to_v1_field_names(clean_state: None) -> None:
    """`source_provenance` → `source`, `notes` → `comments`."""
    client = _signed_in_client()
    file_rows = [
        {
            "name": "Legacy Row",
            "category": "insulation",
            "source_provenance": "Old DB",
            "notes": "Legacy comment",
        }
    ]
    preview = client.post(
        "/api/v1/catalogs/materials/import/preview",
        headers={"Origin": ORIGIN},
        json=_wrap(file_rows, schema_version=0),
    ).json()
    assert preview["counts"]["new"] == 1

    commit = client.post(
        "/api/v1/catalogs/materials/import/commit",
        headers={"Origin": ORIGIN},
        json={"token": preview["token"]},
    ).json()
    inserted_id = commit["inserted_ids"][0]

    row = client.get(f"/api/v1/catalogs/materials/{inserted_id}").json()
    assert row["source"] == "Old DB"
    assert row["comments"] == "Legacy comment"


# 8 — Token lifecycle --------------------------------------------------


def test_commit_with_unknown_token_returns_410(clean_state: None) -> None:
    client = _signed_in_client()
    response = client.post(
        "/api/v1/catalogs/materials/import/commit",
        headers={"Origin": ORIGIN},
        json={"token": "never-minted-token"},
    )
    assert response.status_code == 410
    assert response.json()["error_code"] == "catalog_import_token_missing"


def test_commit_twice_returns_410_on_second_call(clean_state: None) -> None:
    client = _signed_in_client()
    preview = client.post(
        "/api/v1/catalogs/materials/import/preview",
        headers={"Origin": ORIGIN},
        json=_wrap([_good_row()]),
    ).json()
    first = client.post(
        "/api/v1/catalogs/materials/import/commit",
        headers={"Origin": ORIGIN},
        json={"token": preview["token"]},
    )
    assert first.status_code == 200
    second = client.post(
        "/api/v1/catalogs/materials/import/commit",
        headers={"Origin": ORIGIN},
        json={"token": preview["token"]},
    )
    assert second.status_code == 410


def test_commit_with_other_users_token_returns_403(clean_state: None) -> None:
    minter = _signed_in_client(email="minter@example.com", name="Minter")
    preview = minter.post(
        "/api/v1/catalogs/materials/import/preview",
        headers={"Origin": ORIGIN},
        json=_wrap([_good_row()]),
    ).json()
    token = preview["token"]

    other = _signed_in_client(email="other@example.com", name="Other")
    response = other.post(
        "/api/v1/catalogs/materials/import/commit",
        headers={"Origin": ORIGIN},
        json={"token": token},
    )
    assert response.status_code == 403
    assert response.json()["error_code"] == "catalog_import_token_forbidden"


# 9 — Atomicity --------------------------------------------------------


def test_db_failure_mid_batch_leaves_catalog_unchanged(clean_state: None) -> None:
    client = _signed_in_client(raise_server_exceptions=False)
    file_rows = [_good_row(name=f"Row {idx}") for idx in range(3)]
    preview = client.post(
        "/api/v1/catalogs/materials/import/preview",
        headers={"Origin": ORIGIN},
        json=_wrap(file_rows),
    ).json()

    call_count = {"n": 0}
    real_insert = __import__("features.catalogs.materials.repository", fromlist=["insert_material"]).insert_material

    def flaky_insert(*args: object, **kwargs: object) -> None:
        call_count["n"] += 1
        if call_count["n"] == 2:
            raise RuntimeError("simulated DB failure")
        return real_insert(*args, **kwargs)  # type: ignore[arg-type]

    with patch(
        "features.catalogs.materials.import_export.service.repository.insert_material",
        side_effect=flaky_insert,
    ):
        response = client.post(
            "/api/v1/catalogs/materials/import/commit",
            headers={"Origin": ORIGIN},
            json={"token": preview["token"]},
        )
    assert response.status_code == 500

    listed = client.get("/api/v1/catalogs/materials").json()
    assert listed["items"] == []


# Review-pass fixes --------------------------------------------------


def test_negative_schema_version_returns_400_not_500(clean_state: None) -> None:
    """Phase 2 /simplify finding: negative schema_version used to crash
    the upgrade chain with a RuntimeError (500). Now caught at envelope."""
    client = _signed_in_client()
    body = _wrap([_good_row()], schema_version=-1)
    response = client.post(
        "/api/v1/catalogs/materials/import/preview",
        headers={"Origin": ORIGIN},
        json=body,
    )
    assert response.status_code == 400
    assert response.json()["error_code"] == "catalog_import_bad_envelope"


def test_argb_zero_alpha_becomes_null_not_black(clean_state: None) -> None:
    """ARGB (0,0,0,0) is a 'no color' sentinel in legacy exports; we
    must not collapse it to opaque #000000."""
    client = _signed_in_client()
    preview = client.post(
        "/api/v1/catalogs/materials/import/preview",
        headers={"Origin": ORIGIN},
        json=_wrap([_good_row(name="Transparent", color="0,0,0,0")]),
    ).json()
    assert preview["counts"]["new"] == 1
    assert preview["counts"]["warnings"] == 0

    commit = client.post(
        "/api/v1/catalogs/materials/import/commit",
        headers={"Origin": ORIGIN},
        json={"token": preview["token"]},
    ).json()
    inserted_id = commit["inserted_ids"][0]
    row = client.get(f"/api/v1/catalogs/materials/{inserted_id}").json()
    assert row["color"] is None


def test_oversize_text_field_blanks_with_warning(clean_state: None) -> None:
    """An oversize comments value used to round-trip through coerce
    untouched; now it blanks + warns so subsequent PATCH calls don't
    422-reject the row on edit."""
    client = _signed_in_client()
    overlong = "x" * 5000  # > 4000-char comments cap
    preview = client.post(
        "/api/v1/catalogs/materials/import/preview",
        headers={"Origin": ORIGIN},
        json=_wrap([_good_row(name="Oversize Comment", comments=overlong)]),
    ).json()
    assert preview["counts"]["new"] == 1
    reasons = {entry["reason"] for entry in preview["warnings"]}
    assert "field_too_long:comments" in reasons

    commit = client.post(
        "/api/v1/catalogs/materials/import/commit",
        headers={"Origin": ORIGIN},
        json={"token": preview["token"]},
    ).json()
    row = client.get(f"/api/v1/catalogs/materials/{commit['inserted_ids'][0]}").json()
    assert row["comments"] is None


def test_oversize_name_errors_the_row(clean_state: None) -> None:
    """A name longer than 200 chars blanks-then-errors so the bad row
    is excluded from the write set."""
    client = _signed_in_client()
    overlong = "n" * 201
    preview = client.post(
        "/api/v1/catalogs/materials/import/preview",
        headers={"Origin": ORIGIN},
        json=_wrap([_good_row(name=overlong)]),
    ).json()
    assert preview["counts"]["new"] == 0
    assert preview["counts"]["errored"] == 1
    error_reasons = {entry["reason"] for entry in preview["errors"]}
    assert "missing_name" in error_reasons
    warning_reasons = {entry["reason"] for entry in preview["warnings"]}
    assert "field_too_long:name" in warning_reasons


def test_inactive_match_surfaces_matched_inactive_skip_warning(clean_state: None) -> None:
    """Re-importing a file row whose id is in the DB but soft-deleted
    used to silently skip the row with no signal; now the user sees
    a `matched_inactive_skip` warning."""
    client = _signed_in_client()
    created = _create_row(client, name="Will Deactivate")
    deactivated = client.delete(
        f"/api/v1/catalogs/materials/{created['id']}",
        headers={"Origin": ORIGIN},
    )
    assert deactivated.status_code == 204

    file_row = {
        "id": created["id"],
        **{
            k: created[k]
            for k in (
                "name",
                "category",
                "density_kg_m3",
                "specific_heat_j_kgk",
                "conductivity_w_mk",
                "emissivity",
                "color",
                "source",
                "url",
                "comments",
            )
        },
    }
    preview = client.post(
        "/api/v1/catalogs/materials/import/preview",
        headers={"Origin": ORIGIN},
        json=_wrap([file_row]),
    ).json()
    assert preview["counts"]["matched"] == 1
    assert preview["counts"]["new"] == 0
    reasons = {entry["reason"] for entry in preview["warnings"]}
    assert "matched_inactive_skip" in reasons


def test_commit_skips_pk_conflict_and_continues_batch(clean_state: None) -> None:
    """Preview→commit race: another writer inserts a row with the same
    id between preview and commit. The conflicting row is skipped via
    SAVEPOINT; the rest of the batch still lands."""
    client = _signed_in_client()
    racing_id = "rec" + "Z" * 14

    # Preview a 3-row batch — one row carries the soon-to-conflict id.
    file_rows = [
        _good_row(name="Row 1"),
        {"id": racing_id, **_good_row(name="Race Row")},
        _good_row(name="Row 3"),
    ]
    preview = client.post(
        "/api/v1/catalogs/materials/import/preview",
        headers={"Origin": ORIGIN},
        json=_wrap(file_rows),
    ).json()
    assert preview["counts"]["new"] == 3

    # Simulate a concurrent writer landing the same id between
    # preview and commit.
    racing = client.post(
        "/api/v1/catalogs/materials",
        headers={"Origin": ORIGIN},
        json={**_good_row(name="Pre-Existing Race"), "name": "Pre-Existing Race"},
    )
    assert racing.status_code == 201
    # Patch the racing row's id manually via SQL (the public API
    # doesn't expose a way to set id, but we need the same id here).
    with transaction() as conn:
        conn.execute(
            "UPDATE catalog_materials SET id = %s WHERE id = %s",
            (racing_id, racing.json()["id"]),
        )

    commit = client.post(
        "/api/v1/catalogs/materials/import/commit",
        headers={"Origin": ORIGIN},
        json={"token": preview["token"]},
    ).json()
    # Row 1 + Row 3 land; the racing row is skipped on PK conflict.
    assert commit["inserted"] == 2
    assert commit["skipped_conflict_ids"] == [racing_id]


def test_oversize_body_returns_413_without_buffering(clean_state: None) -> None:
    """Body-size cap is enforced while streaming; clients sending a
    > 8 MB body get 413 before the body is parsed."""
    client = _signed_in_client()
    big_filler = "x" * (9 * 1024 * 1024)  # 9 MB > 8 MB cap
    response = client.post(
        "/api/v1/catalogs/materials/import/preview",
        headers={"Origin": ORIGIN, "Content-Type": "application/json"},
        content=big_filler.encode("utf-8"),
    )
    assert response.status_code == 413
    assert response.json()["error_code"] == "catalog_import_too_large"


def test_label_to_id_map_matches_canonical_ids() -> None:
    """Module-level assertion in coerce.py guarantees the hand-maintained
    label map covers every canonical category id. Re-check here so a
    drift surfaces in tests too."""
    from features.catalogs.materials.import_export import coerce as coerce_module
    from features.catalogs.materials.models import MATERIAL_CATEGORY_IDS

    assert set(coerce_module._CATEGORY_LABEL_TO_ID.values()) == set(MATERIAL_CATEGORY_IDS)

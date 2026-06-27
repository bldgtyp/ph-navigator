"""Model Viewer Phase 1 contract tests: HBJSON file management (US-VIEW-1).

File bytes ride the generic asset flow (upload-intent → PUT → complete);
these tests cover the hbjson-files link step, list shape, rename/notes,
soft delete + restore, the two-layer content-hash dedup, and role gating.
"""

from __future__ import annotations

import hashlib
import json
from typing import Any
from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from honeybee.model import Model

from database import connection, transaction
from features.assets import repository as assets_repository
from features.assets.routes import get_asset_service
from features.assets.service import AssetService
from main import app
from tests.test_assets_service import FakeR2Client, NoopThumbnailer
from tests.test_project_document import ORIGIN, create_project, signed_in_client

# Valid (empty) honeybee models: since Phase 2, linking schedules the
# extraction job — junk bodies would flip rows to 'failed' mid-test.
HBJSON_BODY = json.dumps(Model("phase-1-fixture").to_dict()).encode()
HBJSON_BODY_2 = json.dumps(Model("phase-1-fixture-2").to_dict()).encode()


@pytest.fixture()
def fake_r2() -> Any:
    fake = FakeR2Client()
    app.dependency_overrides[get_asset_service] = lambda: AssetService(fake, NoopThumbnailer())
    yield fake
    app.dependency_overrides.pop(get_asset_service, None)


def _files_url(project_id: object, suffix: str = "") -> str:
    return f"/api/v1/projects/{project_id}/hbjson-files{suffix}"


def _upload_hbjson_asset(
    client: TestClient,
    fake_r2: FakeR2Client,
    project_id: object,
    body: bytes,
    filename: str = "model.hbjson",
) -> dict[str, Any]:
    """Run the generic asset flow and return the intent response body."""
    intent = client.post(
        f"/api/v1/projects/{project_id}/assets/upload-intent",
        headers={"Origin": ORIGIN},
        json={
            "asset_kind": "hbjson",
            "original_filename": filename,
            "content_type": "application/json",
            "size_bytes": len(body),
            "content_hash_sha256": hashlib.sha256(body).hexdigest(),
        },
    )
    assert intent.status_code == 200
    intent_body = intent.json()
    if intent_body["duplicate_of"] is not None:
        return intent_body
    asset = intent_body["asset"]
    fake_r2.put_object(asset["object_key"], body, asset["content_type"])
    complete = client.post(
        f"/api/v1/projects/{project_id}/assets/{asset['id']}/complete-upload",
        headers={"Origin": ORIGIN},
    )
    assert complete.status_code == 200
    return intent_body


def _link_file(client: TestClient, project_id: object, asset_id: str, **payload: object) -> Any:
    return client.post(
        _files_url(project_id),
        headers={"Origin": ORIGIN},
        json={"asset_id": asset_id, **payload},
    )


def test_upload_link_round_trip_and_list_shape(clean_document_tables: None, fake_r2: FakeR2Client) -> None:
    client = signed_in_client()
    project = create_project(client)
    asset = _upload_hbjson_asset(client, fake_r2, project["id"], HBJSON_BODY)["asset"]

    created = _link_file(client, project["id"], asset["id"])
    assert created.status_code == 201
    file_row = created.json()
    assert file_row["display_name"] == "model"  # filename minus extension
    assert file_row["extraction_status"] == "pending"
    assert file_row["notes"] is None

    listed = client.get(_files_url(project["id"]))
    assert listed.status_code == 200
    items = listed.json()["items"]
    assert len(items) == 1
    assert items[0]["id"] == file_row["id"]
    assert items[0]["size_bytes"] == len(HBJSON_BODY)
    assert items[0]["original_filename"] == "model.hbjson"
    assert items[0]["uploaded_by_display_name"] == "Ed May"
    # The link response said 'pending'; the background job has run by the
    # time the list is read (TestClient executes background tasks inline).
    assert items[0]["extraction_status"] == "success"
    assert items[0]["extraction_error"] is None


def test_list_orders_newest_first(clean_document_tables: None, fake_r2: FakeR2Client) -> None:
    client = signed_in_client()
    project = create_project(client)
    first = _upload_hbjson_asset(client, fake_r2, project["id"], HBJSON_BODY, "round-1.hbjson")["asset"]
    second = _upload_hbjson_asset(client, fake_r2, project["id"], HBJSON_BODY_2, "round-2.hbjson")["asset"]
    assert _link_file(client, project["id"], first["id"]).status_code == 201
    assert _link_file(client, project["id"], second["id"]).status_code == 201

    listed = client.get(_files_url(project["id"]))
    assert [item["display_name"] for item in listed.json()["items"]] == ["round-2", "round-1"]


def test_rename_and_notes_validation(clean_document_tables: None, fake_r2: FakeR2Client) -> None:
    client = signed_in_client()
    project = create_project(client)
    asset = _upload_hbjson_asset(client, fake_r2, project["id"], HBJSON_BODY)["asset"]
    file_id = _link_file(client, project["id"], asset["id"]).json()["id"]

    renamed = client.patch(
        _files_url(project["id"], f"/{file_id}"),
        headers={"Origin": ORIGIN},
        json={"display_name": "  Round 2 model  "},
    )
    assert renamed.status_code == 200
    assert renamed.json()["display_name"] == "Round 2 model"

    blank = client.patch(
        _files_url(project["id"], f"/{file_id}"),
        headers={"Origin": ORIGIN},
        json={"display_name": "   "},
    )
    assert blank.status_code == 422

    too_long = client.patch(
        _files_url(project["id"], f"/{file_id}"),
        headers={"Origin": ORIGIN},
        json={"notes": "x" * 1001},
    )
    assert too_long.status_code == 422

    noted = client.patch(
        _files_url(project["id"], f"/{file_id}"),
        headers={"Origin": ORIGIN},
        json={"notes": "after slab redesign"},
    )
    assert noted.status_code == 200
    assert noted.json()["notes"] == "after slab redesign"
    assert noted.json()["display_name"] == "Round 2 model"

    cleared = client.patch(
        _files_url(project["id"], f"/{file_id}"),
        headers={"Origin": ORIGIN},
        json={"notes": None},
    )
    assert cleared.status_code == 200
    assert cleared.json()["notes"] is None


def test_soft_delete_excludes_from_list(clean_document_tables: None, fake_r2: FakeR2Client) -> None:
    client = signed_in_client()
    project = create_project(client)
    asset = _upload_hbjson_asset(client, fake_r2, project["id"], HBJSON_BODY)["asset"]
    file_id = _link_file(client, project["id"], asset["id"]).json()["id"]

    deleted = client.delete(_files_url(project["id"], f"/{file_id}"), headers={"Origin": ORIGIN})
    assert deleted.status_code == 204
    assert client.get(_files_url(project["id"])).json()["items"] == []

    with connection() as conn:
        row = conn.execute(
            "SELECT deleted_at IS NOT NULL AS deleted FROM project_hbjson_files WHERE id = %(id)s",
            {"id": file_id},
        ).fetchone()
    assert row == {"deleted": True}

    again = client.delete(_files_url(project["id"], f"/{file_id}"), headers={"Origin": ORIGIN})
    assert again.status_code == 404
    assert again.json()["error_code"] == "hbjson_file_not_found"


def test_duplicate_link_returns_409_naming_existing_file(clean_document_tables: None, fake_r2: FakeR2Client) -> None:
    client = signed_in_client()
    project = create_project(client)
    asset = _upload_hbjson_asset(client, fake_r2, project["id"], HBJSON_BODY)["asset"]
    existing = _link_file(client, project["id"], asset["id"], display_name="Round 1 model").json()

    # Re-uploading the same bytes hands back the same asset (asset-layer
    # hash dedup) — the link step must still reject with the friendly 409.
    duplicate_intent = _upload_hbjson_asset(client, fake_r2, project["id"], HBJSON_BODY)
    assert duplicate_intent["duplicate_of"] == asset["id"]

    rejected = _link_file(client, project["id"], asset["id"])
    assert rejected.status_code == 409
    assert rejected.json()["error_code"] == "hbjson_duplicate_file"
    assert rejected.json()["details"] == {"id": existing["id"], "display_name": "Round 1 model"}

    # The linked file's asset must survive the rejection.
    still_there = client.get(f"/api/v1/projects/{project['id']}/assets/{asset['id']}")
    assert still_there.status_code == 200
    assert still_there.json()["deleted_at"] is None


def test_unique_index_backstop_maps_to_409_and_discards_orphan(
    clean_document_tables: None, fake_r2: FakeR2Client, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Bypass the dedup SELECT once to prove the partial unique index backstop."""
    import features.model_viewer.repository as mv_repository

    client = signed_in_client()
    project = create_project(client)
    asset = _upload_hbjson_asset(client, fake_r2, project["id"], HBJSON_BODY)["asset"]
    existing = _link_file(client, project["id"], asset["id"], display_name="Round 1 model").json()

    # A second, distinct asset with the same content hash (as if two
    # upload intents raced past the asset-layer dedup).
    content_hash = hashlib.sha256(HBJSON_BODY).hexdigest()
    with transaction() as conn:
        user_row = conn.execute("SELECT id FROM users LIMIT 1").fetchone()
        assert user_row is not None
        orphan = assets_repository.insert_pending_asset(
            conn,
            asset_id="asset_test_duplicate_race",
            project_id=UUID(str(project["id"])),
            asset_kind="hbjson",
            object_key=f"projects/{project['id']}/assets/asset_test_duplicate_race/model.hbjson",
            original_filename="model.hbjson",
            display_name="model.hbjson",
            content_type="application/json",
            size_bytes=len(HBJSON_BODY),
            content_hash_sha256=content_hash,
            created_by=user_row["id"],
        )
        orphan_id = str(orphan["id"])
        assets_repository.mark_asset_uploaded(conn, UUID(str(project["id"])), orphan_id, r2_etag="race")

    original_finder = mv_repository.find_active_file_by_content_hash
    calls = {"n": 0}

    def skip_first_lookup(conn: Any, project_id: UUID, content_hash_sha256: str) -> Any:
        calls["n"] += 1
        if calls["n"] == 1:
            return None
        return original_finder(conn, project_id, content_hash_sha256)

    monkeypatch.setattr(mv_repository, "find_active_file_by_content_hash", skip_first_lookup)

    rejected = _link_file(client, project["id"], orphan_id)
    assert rejected.status_code == 409
    assert rejected.json()["error_code"] == "hbjson_duplicate_file"
    assert rejected.json()["details"] == {"id": existing["id"], "display_name": "Round 1 model"}

    # The racing duplicate's asset is orphaned and discarded for R2 GC.
    orphan_after = client.get(f"/api/v1/projects/{project['id']}/assets/{orphan_id}")
    assert orphan_after.status_code == 404


def test_relink_after_soft_delete_restores_row(clean_document_tables: None, fake_r2: FakeR2Client) -> None:
    client = signed_in_client()
    project = create_project(client)
    asset = _upload_hbjson_asset(client, fake_r2, project["id"], HBJSON_BODY)["asset"]
    first = _link_file(client, project["id"], asset["id"], notes="round 1").json()

    deleted = client.delete(_files_url(project["id"], f"/{first['id']}"), headers={"Origin": ORIGIN})
    assert deleted.status_code == 204

    # Re-upload of the same bytes: asset layer returns the original asset,
    # link restores the soft-deleted row with fresh metadata.
    duplicate_intent = _upload_hbjson_asset(client, fake_r2, project["id"], HBJSON_BODY)
    assert duplicate_intent["duplicate_of"] == asset["id"]
    relinked = _link_file(client, project["id"], asset["id"], display_name="Round 2 model")
    assert relinked.status_code == 201
    assert relinked.json()["id"] == first["id"]
    assert relinked.json()["display_name"] == "Round 2 model"
    assert relinked.json()["notes"] is None

    items = client.get(_files_url(project["id"])).json()["items"]
    assert [item["id"] for item in items] == [first["id"]]


def test_viewer_can_read_but_not_mutate(clean_document_tables: None, fake_r2: FakeR2Client) -> None:
    editor = signed_in_client()
    project = create_project(editor)
    asset = _upload_hbjson_asset(editor, fake_r2, project["id"], HBJSON_BODY)["asset"]
    file_id = _link_file(editor, project["id"], asset["id"]).json()["id"]

    viewer = TestClient(app)
    listed = viewer.get(_files_url(project["id"]))
    assert listed.status_code == 200
    assert len(listed.json()["items"]) == 1

    for response in (
        viewer.post(_files_url(project["id"]), headers={"Origin": ORIGIN}, json={"asset_id": asset["id"]}),
        viewer.patch(
            _files_url(project["id"], f"/{file_id}"),
            headers={"Origin": ORIGIN},
            json={"display_name": "nope"},
        ),
        viewer.delete(_files_url(project["id"], f"/{file_id}"), headers={"Origin": ORIGIN}),
    ):
        assert response.status_code == 401
        assert response.json()["error_code"] == "not_authenticated"


def test_model_download_requires_export_capability(clean_document_tables: None, fake_r2: FakeR2Client) -> None:
    """The model `.hbjson` download is editor-only (`model.export`, certifier+
    later). An anonymous `client` viewer is blocked; the editor download must
    still resolve without tripping the asset layer's anonymous reference gate
    (HBJSON assets are never document-referenced)."""
    editor = signed_in_client()
    project = create_project(editor)
    asset = _upload_hbjson_asset(editor, fake_r2, project["id"], HBJSON_BODY)["asset"]
    file_id = _link_file(editor, project["id"], asset["id"]).json()["id"]

    viewer = TestClient(app)
    blocked = viewer.get(_files_url(project["id"], f"/{file_id}/download"), follow_redirects=False)
    assert blocked.status_code == 401

    download = editor.get(_files_url(project["id"], f"/{file_id}/download"), follow_redirects=False)
    assert download.status_code == 307
    assert download.headers["location"].startswith("https://fake-r2.test/")


def test_hbjson_larger_than_magic_prefix_completes_upload(clean_document_tables: None, fake_r2: FakeR2Client) -> None:
    """Real HBJSONs exceed the 8 KB magic-check prefix; the JSON sniff must
    not try to parse a truncated document (regression: e2e fixture upload
    failed `complete-upload` with `hbjson_parse_failed`)."""
    client = signed_in_client()
    project = create_project(client)
    big_body = json.dumps({"type": "Model", "rooms": [{"identifier": f"r{i}"} for i in range(2000)]}).encode()
    assert len(big_body) > 8192

    asset = _upload_hbjson_asset(client, fake_r2, project["id"], big_body, "big-model.hbjson")["asset"]
    linked = _link_file(client, project["id"], asset["id"])
    assert linked.status_code == 201

    junk = b"\x00not json" + b"x" * 9000
    intent = client.post(
        f"/api/v1/projects/{project['id']}/assets/upload-intent",
        headers={"Origin": ORIGIN},
        json={
            "asset_kind": "hbjson",
            "original_filename": "junk.hbjson",
            "content_type": "application/json",
            "size_bytes": len(junk),
            "content_hash_sha256": hashlib.sha256(junk).hexdigest(),
        },
    )
    junk_asset = intent.json()["asset"]
    fake_r2.put_object(junk_asset["object_key"], junk, junk_asset["content_type"])
    complete = client.post(
        f"/api/v1/projects/{project['id']}/assets/{junk_asset['id']}/complete-upload",
        headers={"Origin": ORIGIN},
    )
    assert complete.status_code == 422
    assert complete.json()["error_code"] == "asset_mime_not_allowed"


def test_upload_intent_rejects_bad_extension_and_oversize(clean_document_tables: None, fake_r2: FakeR2Client) -> None:
    client = signed_in_client()
    project = create_project(client)

    bad_extension = client.post(
        f"/api/v1/projects/{project['id']}/assets/upload-intent",
        headers={"Origin": ORIGIN},
        json={
            "asset_kind": "hbjson",
            "original_filename": "model.txt",
            "content_type": "application/json",
            "size_bytes": 100,
            "content_hash_sha256": hashlib.sha256(b"x").hexdigest(),
        },
    )
    assert bad_extension.status_code == 422
    assert bad_extension.json()["error_code"] == "asset_mime_not_allowed"

    oversize = client.post(
        f"/api/v1/projects/{project['id']}/assets/upload-intent",
        headers={"Origin": ORIGIN},
        json={
            "asset_kind": "hbjson",
            "original_filename": "model.hbjson",
            "content_type": "application/json",
            "size_bytes": 101 * 1024 * 1024,
            "content_hash_sha256": hashlib.sha256(b"x").hexdigest(),
        },
    )
    assert oversize.status_code == 413
    assert oversize.json()["error_code"] == "asset_size_exceeded"

    # The D-17 boundary itself (100 MB exactly) is allowed.
    at_cap = client.post(
        f"/api/v1/projects/{project['id']}/assets/upload-intent",
        headers={"Origin": ORIGIN},
        json={
            "asset_kind": "hbjson",
            "original_filename": "model.hbjson",
            "content_type": "application/json",
            "size_bytes": 100 * 1024 * 1024,
            "content_hash_sha256": hashlib.sha256(b"y").hexdigest(),
        },
    )
    assert at_cap.status_code == 200

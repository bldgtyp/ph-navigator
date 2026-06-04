"""Assembly Builder evidence attachment tests."""

from __future__ import annotations

import hashlib
from collections.abc import Iterator
from typing import Literal

import pytest

from database import transaction
from features.project_document.validation import document_etag
from tests.envelope.test_envelope_document_contracts import (
    ORIGIN,
    create_project,
    envelope_body,
    envelope_url,
    signed_in_client,
    write_saved_body,
)
from tests.test_assets_service import (
    FakeR2Client,
    _asset_url,
    _clear_fake_asset_service,
    _install_fake_asset_service,
)


@pytest.fixture()
def clean_envelope_asset_tables() -> Iterator[None]:
    _truncate()
    yield
    _truncate()


def _truncate() -> None:
    with transaction() as conn:
        conn.execute(
            """
            TRUNCATE project_assets, project_jobs, catalog_materials,
                     user_action_log, sessions, project_status_items,
                     project_version_drafts, project_versions, projects, users
            RESTART IDENTITY CASCADE
            """
        )


def _upload_asset(
    client,
    fake_r2: FakeR2Client,
    project_id: object,
    *,
    asset_kind: Literal["datasheet", "site_photo"],
    body: bytes,
    filename: str,
    content_type: str,
) -> str:
    intent = client.post(
        f"/api/v1/projects/{project_id}/assets/upload-intent",
        headers={"Origin": ORIGIN},
        json={
            "asset_kind": asset_kind,
            "original_filename": filename,
            "display_name": filename,
            "content_type": content_type,
            "size_bytes": len(body),
            "content_hash_sha256": hashlib.sha256(body).hexdigest(),
        },
    )
    assert intent.status_code == 200
    asset = intent.json()["asset"]
    fake_r2.put_object(asset["object_key"], body, content_type)
    complete = client.post(_asset_url(project_id, asset["id"], "/complete-upload"), headers={"Origin": ORIGIN})
    assert complete.status_code == 200
    return str(asset["id"])


def _create_project_with_bt(client, bt_number: str) -> dict[str, object]:
    response = client.post(
        "/api/v1/projects",
        headers={"Origin": ORIGIN},
        json={
            "name": f"Project {bt_number}",
            "bt_number": bt_number,
            "client": "May",
            "cert_programs": ["phi"],
            "phius_number": None,
            "phius_dropbox_url": None,
        },
    )
    assert response.status_code == 201
    return response.json()


def test_assembly_datasheet_and_site_photo_attach_detach_preserve_use_site_notes(
    clean_envelope_asset_tables: None,
) -> None:
    fake_r2 = FakeR2Client()
    _install_fake_asset_service(fake_r2)
    try:
        client = signed_in_client()
        project = create_project(client)
        project_id = project["id"]
        version_id = project["active_version_id"]
        saved_body = envelope_body()
        write_saved_body(version_id, saved_body)

        datasheet_id = _upload_asset(
            client,
            fake_r2,
            project_id,
            asset_kind="datasheet",
            body=b"%PDF-1.4\n% wood fiber datasheet\n",
            filename="wood-fiber.pdf",
            content_type="application/pdf",
        )
        attach_datasheet = client.post(
            _asset_url(project_id, datasheet_id, "/attach"),
            headers={"Origin": ORIGIN},
            json={
                "version_id": version_id,
                "table_key": "project_materials",
                "row_id": "pmat_insul",
                "field_key": "datasheet_asset_ids",
                "if_match_version": document_etag(saved_body),
            },
        )
        assert attach_datasheet.status_code == 200
        assert datasheet_id in attach_datasheet.json()["asset_ids"]

        photo_id = _upload_asset(
            client,
            fake_r2,
            project_id,
            asset_kind="site_photo",
            body=b"\x89PNG\r\n\x1a\nfake site photo",
            filename="install.png",
            content_type="image/png",
        )
        attach_photo = client.post(
            _asset_url(project_id, photo_id, "/attach"),
            headers={"Origin": ORIGIN},
            json={
                "version_id": version_id,
                "table_key": "assembly_segments",
                "row_id": "seg_insul",
                "field_key": "photo_asset_ids",
                "if_match": attach_datasheet.json()["draft_etag"],
            },
        )
        assert attach_photo.status_code == 200
        assert photo_id in attach_photo.json()["asset_ids"]

        detach_photo = client.post(
            _asset_url(project_id, photo_id, "/detach"),
            headers={"Origin": ORIGIN},
            json={
                "version_id": version_id,
                "table_key": "assembly_segments",
                "row_id": "seg_insul",
                "field_key": "photo_asset_ids",
                "if_match": attach_photo.json()["draft_etag"],
            },
        )
        assert detach_photo.status_code == 200
        assert photo_id not in detach_photo.json()["asset_ids"]

        draft = client.get(envelope_url(project_id, version_id, source="draft"))
        assert draft.status_code == 200
        draft_json = draft.json()
        material = next(item for item in draft_json["project_materials"] if item["id"] == "pmat_insul")
        segment = draft_json["assemblies"][0]["layers"][0]["segments"][0]
        assert datasheet_id in material["datasheet_asset_ids"]
        assert photo_id not in segment["photo_asset_ids"]
        assert segment["use_site_notes"] == "Use over exterior sheathing."
    finally:
        _clear_fake_asset_service()


def test_project_material_datasheet_over_cap_is_rejected(clean_envelope_asset_tables: None) -> None:
    fake_r2 = FakeR2Client()
    _install_fake_asset_service(fake_r2)
    try:
        client = signed_in_client()
        project = create_project(client)
        project_id = project["id"]
        version_id = project["active_version_id"]
        saved_body = envelope_body()
        raw = saved_body.model_dump(mode="json")
        raw["tables"]["project_materials"][0]["datasheet_asset_ids"] = [f"asset_existing_{index}" for index in range(5)]
        saved_body = saved_body.model_validate(raw)
        write_saved_body(version_id, saved_body)
        datasheet_id = _upload_asset(
            client,
            fake_r2,
            project_id,
            asset_kind="datasheet",
            body=b"%PDF-1.4\n% extra datasheet\n",
            filename="extra.pdf",
            content_type="application/pdf",
        )

        response = client.post(
            _asset_url(project_id, datasheet_id, "/attach"),
            headers={"Origin": ORIGIN},
            json={
                "version_id": version_id,
                "table_key": "project_materials",
                "row_id": "pmat_insul",
                "field_key": "datasheet_asset_ids",
                "if_match_version": document_etag(saved_body),
            },
        )

        assert response.status_code == 422
        assert response.json()["error_code"] == "asset_count_exceeded"
    finally:
        _clear_fake_asset_service()


def test_cross_project_envelope_asset_reference_is_rejected(clean_envelope_asset_tables: None) -> None:
    fake_r2 = FakeR2Client()
    _install_fake_asset_service(fake_r2)
    try:
        client = signed_in_client()
        source_project = _create_project_with_bt(client, "2426-A")
        target_project = _create_project_with_bt(client, "2426-B")
        target_version_id = target_project["active_version_id"]
        saved_body = envelope_body()
        write_saved_body(target_version_id, saved_body)
        datasheet_id = _upload_asset(
            client,
            fake_r2,
            source_project["id"],
            asset_kind="datasheet",
            body=b"%PDF-1.4\n% other project datasheet\n",
            filename="other-project.pdf",
            content_type="application/pdf",
        )

        response = client.post(
            _asset_url(target_project["id"], datasheet_id, "/attach"),
            headers={"Origin": ORIGIN},
            json={
                "version_id": target_version_id,
                "table_key": "project_materials",
                "row_id": "pmat_insul",
                "field_key": "datasheet_asset_ids",
                "if_match_version": document_etag(saved_body),
            },
        )

        assert response.status_code == 422
        assert response.json()["error_code"] == "asset_cross_project_reference"
    finally:
        _clear_fake_asset_service()

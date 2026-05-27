"""Asset service tests with fake object storage."""

from __future__ import annotations

import hashlib
from typing import Any
from uuid import UUID

from fastapi.testclient import TestClient

from features.assets.routes import get_asset_service
from features.assets.service import AssetService
from features.project_document.tables.pumps import PUMPS_BUILT_IN_FIELD_DEFS
from main import app
from tests.test_project_document import ORIGIN, create_project, signed_in_client


class FakeR2Client:
    bucket = "test-assets"

    def __init__(self) -> None:
        self.objects: dict[str, tuple[bytes, str]] = {}

    def generate_signed_put_url(
        self,
        object_key: str,
        content_type: str,
        size_bytes: int,
        expires_in_seconds: int = 600,
    ) -> str:
        return f"https://fake-r2.test/{object_key}?method=put"

    def generate_signed_get_url(
        self,
        object_key: str,
        expires_in_seconds: int,
        response_content_disposition: str | None = None,
    ) -> str:
        disposition = "&disposition=attachment" if response_content_disposition else ""
        return f"https://fake-r2.test/{object_key}?method=get{disposition}"

    def head_object(self, object_key: str) -> dict[str, object]:
        body, _content_type = self.objects[object_key]
        return {"ContentLength": len(body), "ETag": hashlib.md5(body, usedforsecurity=False).hexdigest()}

    def get_object_prefix(self, object_key: str, byte_range: tuple[int, int]) -> bytes:
        start, end = byte_range
        body, _content_type = self.objects[object_key]
        return body[start : end + 1]

    def get_object(self, object_key: str) -> bytes:
        body, _content_type = self.objects[object_key]
        return body

    def put_object(self, object_key: str, body: bytes, content_type: str) -> str:
        self.objects[object_key] = (body, content_type)
        return hashlib.md5(body, usedforsecurity=False).hexdigest()

    def copy_object(self, source_key: str, dest_key: str) -> None:
        self.objects[dest_key] = self.objects[source_key]

    def delete_object(self, object_key: str) -> None:
        self.objects.pop(object_key, None)


class NoopThumbnailer:
    def render_for_asset(self, project_id: UUID, asset_id: str) -> None:
        return None


def _install_fake_asset_service(fake_r2: FakeR2Client) -> None:
    app.dependency_overrides[get_asset_service] = lambda: AssetService(fake_r2, NoopThumbnailer())


def _clear_fake_asset_service() -> None:
    app.dependency_overrides.pop(get_asset_service, None)


def _draft_pumps_url(project_id: object, version_id: object) -> str:
    return f"/api/v1/projects/{project_id}/versions/{version_id}/draft/tables/pumps"


def _asset_url(project_id: object, asset_id: str, suffix: str = "") -> str:
    return f"/api/v1/projects/{project_id}/assets/{asset_id}{suffix}"


def _upload_intent_payload(body: bytes, *, content_type: str = "application/pdf") -> dict[str, object]:
    return {
        "asset_kind": "datasheet",
        "original_filename": "pump-datasheet.pdf",
        "display_name": "Pump datasheet",
        "content_type": content_type,
        "size_bytes": len(body),
        "content_hash_sha256": hashlib.sha256(body).hexdigest(),
    }


def _pump_payload() -> dict[str, Any]:
    return {
        "pumps": [
            {
                "id": "pmp_1",
                "device_type": "opt_circ",
                "phase": 1,
                "notes": None,
                "link": "https://example.com/pump.pdf",
                "datasheet_asset_ids": [],
                "custom_values": {
                    "use": "DHW recirc",
                    "record_id": "P-1",
                    "manufacturer": "Taco",
                    "model": "0015e3",
                    "volts": 120,
                    "wattage": 45,
                    "flow_gpm": 4,
                    "runtime_khr_yr": 2.5,
                },
            }
        ],
        "field_defs": [field.model_dump(mode="json") for field in PUMPS_BUILT_IN_FIELD_DEFS],
        "single_select_options": {
            "pumps.device_type": [{"id": "opt_circ", "label": "Circulator", "color": "#3b82f6", "order": 0}]
        },
    }


def _create_project_with_pump(client: TestClient) -> tuple[dict[str, object], dict[str, object]]:
    project = create_project(client)
    initial = client.get(_draft_pumps_url(project["id"], project["active_version_id"])).json()
    response = client.put(
        _draft_pumps_url(project["id"], project["active_version_id"]),
        headers={"Origin": ORIGIN, "If-Match-Version": initial["version_etag"]},
        json=_pump_payload(),
    )
    assert response.status_code == 200
    return project, response.json()


def test_datasheet_upload_complete_url_attach_and_detach_with_fake_storage(clean_document_tables: None) -> None:
    fake_r2 = FakeR2Client()
    _install_fake_asset_service(fake_r2)
    try:
        client = signed_in_client()
        project, pumps_slice = _create_project_with_pump(client)
        project_id = project["id"]
        version_id = project["active_version_id"]
        pdf_bytes = b"%PDF-1.4\n% fake pump datasheet\n"

        intent = client.post(
            f"/api/v1/projects/{project_id}/assets/upload-intent",
            headers={"Origin": ORIGIN},
            json=_upload_intent_payload(pdf_bytes),
        )
        assert intent.status_code == 200
        intent_body = intent.json()
        assert intent_body["upload_url"].startswith("https://fake-r2.test/")
        asset = intent_body["asset"]
        asset_id = asset["id"]
        fake_r2.put_object(asset["object_key"], pdf_bytes, asset["content_type"])

        complete = client.post(
            _asset_url(project_id, asset_id, "/complete-upload"),
            headers={"Origin": ORIGIN},
        )
        assert complete.status_code == 200
        assert complete.json()["upload_status"] == "uploaded"

        urls = client.get(_asset_url(project_id, asset_id, "/url"))
        assert urls.status_code == 200
        assert urls.json()["preview_url"].startswith("https://fake-r2.test/")
        assert urls.json()["download_url"].startswith("https://fake-r2.test/")
        assert "disposition=attachment" not in urls.json()["preview_url"]
        assert "disposition=attachment" in urls.json()["download_url"]
        assert urls.json()["thumbnail_status"] == "pending"

        attach = client.post(
            _asset_url(project_id, asset_id, "/attach"),
            headers={"Origin": ORIGIN},
            json={
                "version_id": version_id,
                "table_key": "equipment_pumps",
                "row_id": "pmp_1",
                "field_key": "datasheet_asset_ids",
                "if_match": pumps_slice["draft_etag"],
                "if_match_version": pumps_slice["version_etag"],
            },
        )
        assert attach.status_code == 200
        assert attach.json()["asset_ids"] == [asset_id]

        attached_slice = client.get(_draft_pumps_url(project_id, version_id)).json()
        assert attached_slice["pumps"][0]["datasheet_asset_ids"] == [asset_id]

        detach = client.post(
            _asset_url(project_id, asset_id, "/detach"),
            headers={"Origin": ORIGIN},
            json={
                "version_id": version_id,
                "table_key": "equipment_pumps",
                "row_id": "pmp_1",
                "field_key": "datasheet_asset_ids",
                "if_match": attach.json()["draft_etag"],
                "if_match_version": attach.json()["version_etag"],
            },
        )
        assert detach.status_code == 200
        assert detach.json()["asset_ids"] == []

        detached_slice = client.get(_draft_pumps_url(project_id, version_id)).json()
        assert detached_slice["pumps"][0]["datasheet_asset_ids"] == []
    finally:
        _clear_fake_asset_service()


def test_complete_upload_marks_magic_mismatch_failed(clean_document_tables: None) -> None:
    fake_r2 = FakeR2Client()
    _install_fake_asset_service(fake_r2)
    try:
        client = signed_in_client()
        project = create_project(client)
        project_id = project["id"]
        not_pdf = b"not a pdf"
        intent = client.post(
            f"/api/v1/projects/{project_id}/assets/upload-intent",
            headers={"Origin": ORIGIN},
            json=_upload_intent_payload(not_pdf),
        )
        assert intent.status_code == 200
        asset = intent.json()["asset"]
        fake_r2.put_object(asset["object_key"], not_pdf, asset["content_type"])

        complete = client.post(
            _asset_url(project_id, asset["id"], "/complete-upload"),
            headers={"Origin": ORIGIN},
        )

        assert complete.status_code == 422
        assert complete.json()["error_code"] == "asset_mime_not_allowed"
        failed = client.get(_asset_url(project_id, asset["id"]))
        assert failed.status_code == 200
        assert failed.json()["upload_status"] == "failed"
        assert failed.json()["metadata"]["failure_reason"] == "pdf_magic_mismatch"
    finally:
        _clear_fake_asset_service()


def test_duplicate_upload_intent_returns_existing_asset_without_new_put(clean_document_tables: None) -> None:
    fake_r2 = FakeR2Client()
    _install_fake_asset_service(fake_r2)
    try:
        client = signed_in_client()
        project = create_project(client)
        project_id = project["id"]
        pdf_bytes = b"%PDF-1.4\n% duplicate pump datasheet\n"
        payload = _upload_intent_payload(pdf_bytes)

        first = client.post(
            f"/api/v1/projects/{project_id}/assets/upload-intent",
            headers={"Origin": ORIGIN},
            json=payload,
        )
        assert first.status_code == 200
        first_body = first.json()
        fake_r2.put_object(
            first_body["asset"]["object_key"],
            pdf_bytes,
            first_body["asset"]["content_type"],
        )
        complete = client.post(
            _asset_url(project_id, first_body["asset"]["id"], "/complete-upload"),
            headers={"Origin": ORIGIN},
        )
        assert complete.status_code == 200

        duplicate = client.post(
            f"/api/v1/projects/{project_id}/assets/upload-intent",
            headers={"Origin": ORIGIN},
            json=payload,
        )

        assert duplicate.status_code == 200
        duplicate_body = duplicate.json()
        assert duplicate_body["asset"]["id"] == first_body["asset"]["id"]
        assert duplicate_body["duplicate_of"] == first_body["asset"]["id"]
        assert duplicate_body["upload_url"] is None
    finally:
        _clear_fake_asset_service()

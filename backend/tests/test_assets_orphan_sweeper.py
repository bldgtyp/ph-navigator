"""Orphan-sweeper dry-run coverage.

``AssetService.sweep_orphaned_assets`` moves unreferenced/expired assets
to the ``_orphaned`` prefix. The dry-run must report only true orphans
and protect any asset referenced by a *saved version* or an *active
draft* (``_referenced_asset_ids_for_project`` unions both). This test
plants one asset in each protected lane plus one genuine orphan and
asserts only the orphan is planned for a move.
"""

from __future__ import annotations

import hashlib
from typing import Any, cast
from uuid import UUID

from fastapi.testclient import TestClient

from features.assets.routes import get_asset_service
from features.assets.service import AssetService
from features.project_document.tables.pumps import PUMPS_BUILT_IN_FIELD_DEFS
from main import app
from tests.test_assets_service import FakeR2Client, NoopThumbnailer
from tests.test_project_document import ORIGIN, create_project, signed_in_client

PDF_MAGIC = b"%PDF-1.4\n"


def _draft_pumps_url(project_id: object, version_id: object) -> str:
    return f"/api/v1/projects/{project_id}/versions/{version_id}/draft/tables/pumps"


def _upload_pdf(client: TestClient, project_id: object, fake_r2: FakeR2Client, body: bytes, filename: str) -> str:
    intent = client.post(
        f"/api/v1/projects/{project_id}/assets/upload-intent",
        headers={"Origin": ORIGIN},
        json={
            "asset_kind": "datasheet",
            "original_filename": filename,
            "display_name": filename,
            "content_type": "application/pdf",
            "size_bytes": len(body),
            "content_hash_sha256": hashlib.sha256(body).hexdigest(),
        },
    )
    assert intent.status_code == 200, intent.text
    asset = intent.json()["asset"]
    fake_r2.put_object(asset["object_key"], body, asset["content_type"])
    complete = client.post(
        f"/api/v1/projects/{project_id}/assets/{asset['id']}/complete-upload",
        headers={"Origin": ORIGIN},
    )
    assert complete.status_code == 200, complete.text
    return str(asset["id"])


def _pump_row(datasheet_asset_ids: list[str]) -> dict[str, Any]:
    return {
        "id": "pmp_1",
        "device_type": "opt_circ",
        "phase": 1,
        "notes": None,
        "link": None,
        "datasheet_asset_ids": datasheet_asset_ids,
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


def _put_pumps(client: TestClient, project_id: object, version_id: object, datasheet_asset_ids: list[str]) -> str:
    initial = client.get(_draft_pumps_url(project_id, version_id)).json()
    put = client.put(
        _draft_pumps_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match-Version": initial["version_etag"]},
        json={
            "pumps": [_pump_row(datasheet_asset_ids)],
            "field_defs": [field.model_dump(mode="json") for field in PUMPS_BUILT_IN_FIELD_DEFS],
            "single_select_options": {
                "pumps.device_type": [{"id": "opt_circ", "label": "Circulator", "color": "#3b82f6", "order": 0}]
            },
        },
    )
    assert put.status_code == 200, put.text
    return str(initial["version_etag"])


def _save(client: TestClient, project_id: object, version_id: object, version_etag: str) -> None:
    save = client.post(
        f"/api/v1/projects/{project_id}/versions/{version_id}/draft/save",
        headers={"Origin": ORIGIN, "If-Match": version_etag},
    )
    assert save.status_code == 200, save.text


def test_sweep_dry_run_protects_saved_and_draft_references(clean_document_tables: None) -> None:
    fake_r2 = FakeR2Client()
    service = AssetService(fake_r2, NoopThumbnailer())
    app.dependency_overrides[get_asset_service] = lambda: service
    try:
        client = signed_in_client()
        project = create_project(client)
        project_id = project["id"]
        version_id = project["active_version_id"]

        asset_saved = _upload_pdf(client, project_id, fake_r2, PDF_MAGIC + b"saved", "saved.pdf")
        asset_draft = _upload_pdf(client, project_id, fake_r2, PDF_MAGIC + b"draft", "draft.pdf")
        asset_orphan = _upload_pdf(client, project_id, fake_r2, PDF_MAGIC + b"orphan", "orphan.pdf")

        # Saved version references asset_saved.
        version_etag = _put_pumps(client, project_id, version_id, [asset_saved])
        _save(client, project_id, version_id, version_etag)
        # A new, unsaved draft additionally references asset_draft.
        _put_pumps(client, project_id, version_id, [asset_saved, asset_draft])

        report = cast(dict[str, Any], service.sweep_orphaned_assets(UUID(str(project_id)), dry_run=True))

        assert report["dry_run"] is True
        assert report["errors"] == []
        moved_ids = {entry["asset_id"] for entry in report["moved"]}
        assert moved_ids == {asset_orphan}
        orphan_entry = next(entry for entry in report["moved"] if entry["asset_id"] == asset_orphan)
        assert orphan_entry["reason"] == "unreferenced_upload"
        # The original object is untouched in dry-run mode.
        assert fake_r2.objects, "dry-run must not move objects"
    finally:
        app.dependency_overrides.pop(get_asset_service, None)

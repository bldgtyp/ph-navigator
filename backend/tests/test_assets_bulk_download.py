"""Bulk-download zip/manifest coverage for the asset service.

``AssetService.start_bulk_download`` runs the bundle build synchronously
and returns a ``completed`` (or ``failed``) job. These tests drive the
real route against fake object storage and inspect the resulting zip:
asset ordering, ``MANIFEST.csv`` contents, the ``{table}/{row.name}``
filename pattern with collision de-duplication, the filter surface, and
the ``asset_bulk_download_failed`` payload.

Bulk download reads from the *saved* version (``get_saved_document``),
not the draft, so each test attaches assets to a Pumps draft and then
saves it before requesting the bundle.
"""

from __future__ import annotations

import hashlib
import io
import zipfile
from typing import Any
from uuid import UUID

from fastapi.testclient import TestClient

from features.assets.storage_r2 import asset_object_key
from features.project_document.tables.pumps import PUMPS_BUILT_IN_FIELD_DEFS
from tests.test_assets_service import (
    FakeR2Client,
    _asset_url,
    _clear_fake_asset_service,
    _draft_pumps_url,
    _install_fake_asset_service,
)
from tests.test_project_document import ORIGIN, create_project, signed_in_client

PDF_MAGIC = b"%PDF-1.4\n"


def _intent_payload(body: bytes, filename: str) -> dict[str, object]:
    return {
        "asset_kind": "datasheet",
        "original_filename": filename,
        "display_name": filename,
        "content_type": "application/pdf",
        "size_bytes": len(body),
        "content_hash_sha256": hashlib.sha256(body).hexdigest(),
    }


def _upload_pdf(client: TestClient, project_id: object, fake_r2: FakeR2Client, body: bytes, filename: str) -> str:
    """Upload one PDF through the real intent/complete path and return its id."""
    intent = client.post(
        f"/api/v1/projects/{project_id}/assets/upload-intent",
        headers={"Origin": ORIGIN},
        json=_intent_payload(body, filename),
    )
    assert intent.status_code == 200, intent.text
    asset = intent.json()["asset"]
    fake_r2.put_object(asset["object_key"], body, asset["content_type"])
    complete = client.post(_asset_url(project_id, asset["id"], "/complete-upload"), headers={"Origin": ORIGIN})
    assert complete.status_code == 200, complete.text
    return str(asset["id"])


def _pump_rows_payload(rows: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "pumps": rows,
        "field_defs": [field.model_dump(mode="json") for field in PUMPS_BUILT_IN_FIELD_DEFS],
        "single_select_options": {
            "pumps.device_type": [{"id": "opt_circ", "label": "Circulator", "color": "#3b82f6", "order": 0}],
            "pumps.inside_outside": [{"id": "opt_pump_inside", "label": "Inside", "color": "#0ea5e9", "order": 0}],
            "pumps.status": [],
        },
    }


def _pump_row(row_id: str, record_id: str, datasheet_asset_ids: list[str]) -> dict[str, Any]:
    return {
        "id": row_id,
        "device_type": "opt_circ",
        "phase": 1,
        "notes": None,
        "link": None,
        "datasheet_asset_ids": datasheet_asset_ids,
        "custom_values": {
            "quantity": 1,
            "inside_outside": "opt_pump_inside",
            "use": "DHW recirc",
            "record_id": record_id,
            "manufacturer": "Taco",
            "model": "0015e3",
            "volts": 120,
            "wattage": 45,
            "flow_gpm": 15.141647136,
            "runtime_khr_yr": 2.5,
            "annual_energy_kwh": 113,
            "internal_heat_gains_utilization_factor": 0.5,
        },
    }


def _save_pumps_version(client: TestClient, project_id: object, version_id: object, rows: list[dict[str, Any]]) -> None:
    """Write the pump rows into the active draft and save it into the version."""
    initial = client.get(_draft_pumps_url(project_id, version_id)).json()
    put = client.put(
        _draft_pumps_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match-Version": initial["version_etag"]},
        json=_pump_rows_payload(rows),
    )
    assert put.status_code == 200, put.text
    save = client.post(
        f"/api/v1/projects/{project_id}/versions/{version_id}/draft/save",
        headers={"Origin": ORIGIN, "If-Match": initial["version_etag"]},
    )
    assert save.status_code == 200, save.text


def _bulk_download(client: TestClient, project_id: object, body: dict[str, object]) -> dict[str, Any]:
    response = client.post(
        f"/api/v1/projects/{project_id}/assets/bulk-download",
        headers={"Origin": ORIGIN},
        json=body,
    )
    assert response.status_code == 202, response.text
    return response.json()


def _open_bundle(fake_r2: FakeR2Client, project_id: object, result_asset_id: str) -> zipfile.ZipFile:
    object_key = asset_object_key(UUID(str(project_id)), result_asset_id, "zip")
    zip_bytes, _content_type = fake_r2.objects[object_key]
    return zipfile.ZipFile(io.BytesIO(zip_bytes))


def test_bulk_download_preserves_order_and_writes_manifest(clean_document_tables: None) -> None:
    fake_r2 = FakeR2Client()
    _install_fake_asset_service(fake_r2)
    try:
        client = signed_in_client()
        project = create_project(client)
        project_id = project["id"]
        version_id = project["active_version_id"]

        # Two assets on pump P-1 share a filename (collision -> de-dupe);
        # a third lands on pump P-2 with a distinct filename.
        asset_a = _upload_pdf(client, project_id, fake_r2, PDF_MAGIC + b"alpha", "datasheet.pdf")
        asset_b = _upload_pdf(client, project_id, fake_r2, PDF_MAGIC + b"bravo", "datasheet.pdf")
        asset_c = _upload_pdf(client, project_id, fake_r2, PDF_MAGIC + b"charlie", "spec.pdf")
        _save_pumps_version(
            client,
            project_id,
            version_id,
            [
                _pump_row("pmp_1", "P-1", [asset_a, asset_b]),
                _pump_row("pmp_2", "P-2", [asset_c]),
            ],
        )

        job = _bulk_download(client, project_id, {})
        assert job["status"] == "completed", job
        assert job["error_code"] is None
        result_asset_id = job["result_asset_id"]
        assert result_asset_id

        bundle = _open_bundle(fake_r2, project_id, result_asset_id)
        names = bundle.namelist()
        assert "MANIFEST.csv" in names

        file_names = [name for name in names if name != "MANIFEST.csv"]
        # Reference order is field-config -> rows -> in-cell index, so the
        # two P-1 datasheets come before the P-2 datasheet, and the second
        # P-1 datasheet is de-duplicated against the first.
        assert file_names == [
            "pumps/pmp_1__datasheet.pdf",
            "pumps/pmp_1__datasheet (2).pdf",
            "pumps/pmp_2__spec.pdf",
        ]
        assert bundle.read("pumps/pmp_1__datasheet.pdf") == PDF_MAGIC + b"alpha"
        assert bundle.read("pumps/pmp_1__datasheet (2).pdf") == PDF_MAGIC + b"bravo"

        manifest = bundle.read("MANIFEST.csv").decode()
        manifest_lines = manifest.splitlines()
        assert manifest_lines[0] == (
            "table_key,row_id,row_name,field_key,asset_id,index,original_filename,content_type,size_bytes,zip_path"
        )
        assert manifest_lines[1].startswith(f"pumps,pmp_1,pmp_1,datasheet_asset_ids,{asset_a},0,")
        assert manifest_lines[1].endswith("pumps/pmp_1__datasheet.pdf")
        assert manifest_lines[3].startswith(f"pumps,pmp_2,pmp_2,datasheet_asset_ids,{asset_c},0,")
        assert len(manifest_lines) == 4  # header + three references
    finally:
        _clear_fake_asset_service()


def test_bulk_download_filter_by_asset_ids(clean_document_tables: None) -> None:
    fake_r2 = FakeR2Client()
    _install_fake_asset_service(fake_r2)
    try:
        client = signed_in_client()
        project = create_project(client)
        project_id = project["id"]
        version_id = project["active_version_id"]

        asset_a = _upload_pdf(client, project_id, fake_r2, PDF_MAGIC + b"alpha", "a.pdf")
        asset_b = _upload_pdf(client, project_id, fake_r2, PDF_MAGIC + b"bravo", "b.pdf")
        _save_pumps_version(client, project_id, version_id, [_pump_row("pmp_1", "P-1", [asset_a, asset_b])])

        job = _bulk_download(client, project_id, {"filter": {"asset_ids": [asset_b]}})
        assert job["status"] == "completed", job

        bundle = _open_bundle(fake_r2, project_id, job["result_asset_id"])
        file_names = [name for name in bundle.namelist() if name != "MANIFEST.csv"]
        assert file_names == ["pumps/pmp_1__b.pdf"]
    finally:
        _clear_fake_asset_service()


def test_bulk_download_can_omit_manifest(clean_document_tables: None) -> None:
    fake_r2 = FakeR2Client()
    _install_fake_asset_service(fake_r2)
    try:
        client = signed_in_client()
        project = create_project(client)
        project_id = project["id"]
        version_id = project["active_version_id"]

        asset_a = _upload_pdf(client, project_id, fake_r2, PDF_MAGIC + b"alpha", "a.pdf")
        _save_pumps_version(client, project_id, version_id, [_pump_row("pmp_1", "P-1", [asset_a])])

        job = _bulk_download(client, project_id, {"include_manifest_csv": False})
        assert job["status"] == "completed", job
        bundle = _open_bundle(fake_r2, project_id, job["result_asset_id"])
        assert "MANIFEST.csv" not in bundle.namelist()
    finally:
        _clear_fake_asset_service()


def test_bulk_download_with_no_matching_assets_fails(clean_document_tables: None) -> None:
    fake_r2 = FakeR2Client()
    _install_fake_asset_service(fake_r2)
    try:
        client = signed_in_client()
        project = create_project(client)
        project_id = project["id"]
        version_id = project["active_version_id"]

        asset_a = _upload_pdf(client, project_id, fake_r2, PDF_MAGIC + b"alpha", "a.pdf")
        _save_pumps_version(client, project_id, version_id, [_pump_row("pmp_1", "P-1", [asset_a])])

        # Filter to a thermal-bridge field that has no references in the saved body.
        job = _bulk_download(client, project_id, {"filter": {"table_key": "thermal_bridges"}})
        assert job["status"] == "failed", job
        assert job["error_code"] == "asset_bulk_download_failed"
        assert job["result_asset_id"] is None
        assert "No matching assets" in job["error_details"]["message"]
    finally:
        _clear_fake_asset_service()

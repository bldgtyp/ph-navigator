"""Locked-version read-only proof for attachment mutations.

PH-Navigator's data model is immutable-by-discipline: once a version is
locked it must not change. Attach and detach run through
``load_draft_context``, which rejects a locked version before any draft
logic. This test locks the active version and confirms both attachment
mutations are refused with ``version_locked``, keeping the locked
document's attachment cells read-only.
"""

from __future__ import annotations

import hashlib
from typing import Any

from fastapi.testclient import TestClient

from features.project_document.tables.pumps import PUMPS_BUILT_IN_FIELD_DEFS
from tests.test_assets_service import FakeR2Client, _asset_url, _clear_fake_asset_service, _install_fake_asset_service
from tests.test_project_document import ORIGIN, create_project, signed_in_client, version_url

PDF_MAGIC = b"%PDF-1.4\n"


def _draft_pumps_url(project_id: object, version_id: object) -> str:
    return f"/api/v1/projects/{project_id}/versions/{version_id}/draft/tables/pumps"


def _upload_pdf(client: TestClient, project_id: object, fake_r2: FakeR2Client) -> str:
    body = PDF_MAGIC + b"datasheet"
    intent = client.post(
        f"/api/v1/projects/{project_id}/assets/upload-intent",
        headers={"Origin": ORIGIN},
        json={
            "asset_kind": "datasheet",
            "original_filename": "datasheet.pdf",
            "display_name": "datasheet.pdf",
            "content_type": "application/pdf",
            "size_bytes": len(body),
            "content_hash_sha256": hashlib.sha256(body).hexdigest(),
        },
    )
    assert intent.status_code == 200, intent.text
    asset = intent.json()["asset"]
    fake_r2.put_object(asset["object_key"], body, asset["content_type"])
    complete = client.post(_asset_url(project_id, asset["id"], "/complete-upload"), headers={"Origin": ORIGIN})
    assert complete.status_code == 200, complete.text
    return str(asset["id"])


def _seed_pump_row(client: TestClient, project_id: object, version_id: object, datasheet_asset_ids: list[str]) -> str:
    initial = client.get(_draft_pumps_url(project_id, version_id)).json()
    row: dict[str, Any] = {
        "id": "pmp_1",
        "device_type": "opt_circ",
        "phase": 1,
        "notes": None,
        "link": None,
        "datasheet_asset_ids": datasheet_asset_ids,
        "custom_values": {
            "quantity": 1,
            "inside_outside": "opt_pump_inside",
            "use": "DHW recirc",
            "record_id": "P-1",
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
    put = client.put(
        _draft_pumps_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match-Version": initial["version_etag"]},
        json={
            "pumps": [row],
            "field_defs": [field.model_dump(mode="json") for field in PUMPS_BUILT_IN_FIELD_DEFS],
            "single_select_options": {
                "pumps.device_type": [{"id": "opt_circ", "label": "Circulator", "color": "#3b82f6", "order": 0}],
                "pumps.inside_outside": [{"id": "opt_pump_inside", "label": "Inside", "color": "#0ea5e9", "order": 0}],
                "pumps.status": [],
            },
        },
    )
    assert put.status_code == 200, put.text
    return str(put.json()["draft_etag"])


def test_locked_version_rejects_attach_and_detach(clean_document_tables: None) -> None:
    fake_r2 = FakeR2Client()
    _install_fake_asset_service(fake_r2)
    try:
        client = signed_in_client()
        project = create_project(client)
        project_id = project["id"]
        version_id = project["active_version_id"]

        attach_asset = _upload_pdf(client, project_id, fake_r2)
        detach_asset = _upload_pdf(client, project_id, fake_r2)
        # Seed a row that already holds ``detach_asset`` so detach has a target.
        draft_etag = _seed_pump_row(client, project_id, version_id, [detach_asset])

        # Lock the active version.
        locked = client.patch(version_url(project_id, version_id), headers={"Origin": ORIGIN}, json={"locked": True})
        assert locked.status_code == 200, locked.text

        common = {
            "version_id": version_id,
            "table_key": "pumps",
            "row_id": "pmp_1",
            "field_key": "datasheet_asset_ids",
            "if_match": draft_etag,
        }

        attach = client.post(
            _asset_url(project_id, attach_asset, "/attach"),
            headers={"Origin": ORIGIN},
            json=common,
        )
        assert attach.status_code == 409, attach.text
        assert attach.json()["error_code"] == "version_locked"

        detach = client.post(
            _asset_url(project_id, detach_asset, "/detach"),
            headers={"Origin": ORIGIN},
            json=common,
        )
        assert detach.status_code == 409, detach.text
        assert detach.json()["error_code"] == "version_locked"
    finally:
        _clear_fake_asset_service()

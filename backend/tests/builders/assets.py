"""Test builders for project asset rows."""

from __future__ import annotations

import hashlib
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from database import transaction
from features.heat_pumps.models import HeatPumpOutdoorEquipRow
from features.project_document.rows import ThermalBridgeRow


def _thermal_bridge_attachment_row(asset_ids: list[str]) -> dict[str, Any]:
    return ThermalBridgeRow(id="tb_1", datasheet_asset_ids=asset_ids).model_dump(mode="json")


def _heat_pump_outdoor_equip_attachment_row(asset_ids: list[str]) -> dict[str, Any]:
    return HeatPumpOutdoorEquipRow(
        id="hpoe_01HX0000000000000000000001",
        tag="OE-1",
        datasheet_asset_ids=asset_ids,
    ).model_dump(mode="json")


@dataclass(frozen=True)
class AttachmentTableTestCase:
    table_name: str
    table_key: str
    rows_attr: str
    row_factory: Callable[[list[str]], dict[str, Any]]

    def row(self, asset_ids: list[str]) -> dict[str, Any]:
        return self.row_factory(asset_ids)


THERMAL_BRIDGES_ATTACHMENT_CASE = AttachmentTableTestCase(
    table_name="thermal_bridges",
    table_key="thermal_bridges",
    rows_attr="thermal_bridges",
    row_factory=_thermal_bridge_attachment_row,
)
HEAT_PUMP_OUTDOOR_EQUIP_ATTACHMENT_CASE = AttachmentTableTestCase(
    table_name="heat_pumps_outdoor_equip",
    table_key="heat_pump_outdoor_equip",
    rows_attr="outdoor_equip",
    row_factory=_heat_pump_outdoor_equip_attachment_row,
)
ENVELOPE_ATTACHMENT_TEST_CASES = (
    THERMAL_BRIDGES_ATTACHMENT_CASE,
    HEAT_PUMP_OUTDOOR_EQUIP_ATTACHMENT_CASE,
)


def insert_project_asset(
    *,
    project_id: object,
    asset_id: str,
    asset_kind: str = "datasheet",
    content_type: str = "application/pdf",
    original_filename: str = "datasheet.pdf",
    size_bytes: int = 32,
    upload_status: str = "uploaded",
) -> None:
    with transaction() as conn:
        user = conn.execute("SELECT id FROM users ORDER BY id LIMIT 1").fetchone()
        assert user is not None
        params: dict[str, Any] = {
            "asset_id": asset_id,
            "project_id": project_id,
            "asset_kind": asset_kind,
            "object_key": f"projects/{project_id}/{asset_id}",
            "original_filename": original_filename,
            "display_name": original_filename,
            "content_type": content_type,
            "size_bytes": size_bytes,
            "content_hash_sha256": hashlib.sha256(asset_id.encode("utf-8")).hexdigest(),
            "upload_status": upload_status,
            "created_by": user["id"],
        }
        conn.execute(
            """
            INSERT INTO project_assets (
                id, project_id, asset_kind, object_key, original_filename, display_name,
                content_type, size_bytes, content_hash_sha256, r2_etag, upload_status,
                created_by, uploaded_at, metadata
            )
            VALUES (
                %(asset_id)s, %(project_id)s, %(asset_kind)s, %(object_key)s,
                %(original_filename)s, %(display_name)s, %(content_type)s,
                %(size_bytes)s, %(content_hash_sha256)s, 'etag', %(upload_status)s,
                %(created_by)s,
                CASE WHEN %(upload_status)s = 'uploaded' THEN now() ELSE NULL END,
                '{"thumbnail_status": "pending"}'::jsonb
            )
            """,
            params,
        )

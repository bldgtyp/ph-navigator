"""Attachment registry tests for PHN-defined document fields."""

from __future__ import annotations

from typing import Any

from features.assets.registry import (
    asset_matches_field,
    asset_referenced_by_document,
    get_attachment_field,
    list_asset_references,
)
from features.project_document.document import ProjectDocumentV1


def _document_with_pump_datasheets() -> ProjectDocumentV1:
    return ProjectDocumentV1.model_validate(
        {
            "schema_version": 2,
            "project": {"name": "p", "bt_number": "1", "cert_programs": []},
            "tables": {
                "equipment": {
                    "pumps": [
                        {
                            "id": "pmp_1",
                            "device_type": "opt_circ",
                            "use": "DHW recirc",
                            "tag": "P-1",
                            "manufacturer": "Taco",
                            "model": "0015e3",
                            "volts": 120,
                            "phase": 1,
                            "horse_power": None,
                            "wattage": 45,
                            "flow_gpm": 4,
                            "runtime_khr_yr": 2.5,
                            "notes": None,
                            "link": "https://example.com/pump.pdf",
                            "datasheet_asset_ids": ["asset_pdf_1", "asset_img_1"],
                        }
                    ]
                }
            },
            "single_select_options": {
                "rooms.floor_level": [],
                "rooms.building_zone": [],
                "pumps.device_type": [{"id": "opt_circ", "label": "Circulator", "color": "#3b82f6", "order": 0}],
            },
        }
    )


def test_equipment_pumps_datasheet_field_is_registered() -> None:
    field = get_attachment_field("equipment_pumps", "datasheet_asset_ids")

    assert field is not None
    assert field.key == "equipment_pumps.datasheet_asset_ids"
    assert field.asset_kinds == frozenset({"datasheet"})
    assert field.allowed_content_types == frozenset({"application/pdf", "image/png", "image/jpeg", "image/webp"})
    assert field.max_count == 5
    assert field.max_file_size_mb == 25


def test_equipment_pumps_datasheet_field_matches_allowed_assets() -> None:
    field = get_attachment_field("equipment_pumps", "datasheet_asset_ids")
    assert field is not None

    valid_cases: list[dict[str, Any]] = [
        {
            "asset_kind": "datasheet",
            "content_type": "application/pdf",
            "original_filename": "pump.pdf",
            "size_bytes": 512,
        },
        {
            "asset_kind": "datasheet",
            "content_type": "image/png",
            "original_filename": "pump.png",
            "size_bytes": 512,
        },
    ]
    for case in valid_cases:
        assert asset_matches_field(field, **case)

    assert not asset_matches_field(
        field,
        asset_kind="site_photo",
        content_type="image/png",
        original_filename="site.png",
        size_bytes=512,
    )
    assert not asset_matches_field(
        field,
        asset_kind="datasheet",
        content_type="text/plain",
        original_filename="pump.txt",
        size_bytes=512,
    )
    assert not asset_matches_field(
        field,
        asset_kind="datasheet",
        content_type="application/pdf",
        original_filename="pump.pdf",
        size_bytes=26 * 1024 * 1024,
    )


def test_equipment_pump_datasheet_references_are_discoverable() -> None:
    body = _document_with_pump_datasheets()

    references = list_asset_references(
        body,
        table_key="equipment_pumps",
        column_key="datasheet_asset_ids",
        kind="datasheet",
    )

    assert references == [
        {
            "table_key": "equipment_pumps",
            "field_key": "datasheet_asset_ids",
            "row_id": "pmp_1",
            "row_name": "pmp_1",
            "asset_id": "asset_pdf_1",
            "index": 0,
        },
        {
            "table_key": "equipment_pumps",
            "field_key": "datasheet_asset_ids",
            "row_id": "pmp_1",
            "row_name": "pmp_1",
            "asset_id": "asset_img_1",
            "index": 1,
        },
    ]
    assert asset_referenced_by_document(body, "asset_pdf_1")
    assert not asset_referenced_by_document(body, "asset_missing")


def test_equipment_pump_datasheet_references_filter_by_asset_id() -> None:
    body = _document_with_pump_datasheets()

    references = list_asset_references(body, asset_ids={"asset_img_1"})

    assert len(references) == 1
    assert references[0]["table_key"] == "equipment_pumps"
    assert references[0]["field_key"] == "datasheet_asset_ids"
    assert references[0]["asset_id"] == "asset_img_1"
    assert references[0]["index"] == 1

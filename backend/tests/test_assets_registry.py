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
from features.project_document.envelope_models import AssemblySegment, ProjectFrame, ProjectGlazing, ProjectMaterial
from features.project_document.rows import PumpRow, ThermalBridgeRow
from tests.envelope.test_envelope_document_contracts import base_document


def _document_with_pump_datasheets() -> ProjectDocumentV1:
    raw = base_document().model_dump(mode="json")
    raw["tables"]["equipment"]["pumps"]["rows"] = [
        {
            "id": "pmp_1",
            "device_type": "opt_circ",
            "phase": 1,
            "notes": None,
            "link": "https://example.com/pump.pdf",
            "datasheet_asset_ids": ["asset_pdf_1", "asset_img_1"],
            "photo_asset_ids": ["asset_photo_1"],
            "custom_values": {
                "use": "DHW recirc",
                "record_id": "P-1",
                "manufacturer": "Taco",
                "model": "0015e3",
                "volts": 120,
                "wattage": 45,
                "flow_gpm": 15.141647136,
                "runtime_khr_yr": 2.5,
            },
        }
    ]
    raw["single_select_options"]["pumps.device_type"] = [
        {"id": "opt_circ", "label": "Circulator", "color": "#3b82f6", "order": 0}
    ]
    return ProjectDocumentV1.model_validate(raw)


def _document_with_ventilator_datasheets() -> ProjectDocumentV1:
    raw = base_document().model_dump(mode="json")
    raw["tables"]["equipment"]["ervs"]["rows"] = [
        {
            "id": "vent_1",
            "inside_outside": "opt_vent_inside",
            "url": "https://example.com/erv.pdf",
            "notes": None,
            "datasheet_asset_ids": ["asset_pdf_1"],
            "custom_values": {
                "record_id": "ERV-1",
                "name": "Apartment ERV",
                "airflow_rate_m3h": 425.0,
                "model": "Q350",
                "manufacturer": "Zehnder",
                "heat_recovery_percent": 84,
                "moisture_recovery_percent": 70,
                "electrical_efficiency_wh_m3": 0.42,
                "filter_merv_rating": 13,
            },
        }
    ]
    raw["single_select_options"]["ventilators.inside_outside"] = [
        {"id": "opt_vent_inside", "label": "Inside", "color": "#3b82f6", "order": 0}
    ]
    return ProjectDocumentV1.model_validate(raw)


def test_pumps_datasheet_field_is_registered() -> None:
    field = get_attachment_field("pumps", "datasheet_asset_ids")

    assert field is not None
    assert field.key == "pumps.datasheet_asset_ids"
    assert field.asset_kinds == frozenset({"datasheet"})
    assert field.allowed_content_types == frozenset({"application/pdf", "image/png", "image/jpeg", "image/webp"})
    assert field.max_count == 5
    assert field.max_file_size_mb == 25


def test_ventilators_datasheet_field_is_registered() -> None:
    field = get_attachment_field("ventilators", "datasheet_asset_ids")

    assert field is not None
    assert field.key == "ventilators.datasheet_asset_ids"
    assert field.asset_kinds == frozenset({"datasheet"})


def test_project_aperture_product_datasheet_fields_are_registered() -> None:
    glazing = get_attachment_field("project_glazings", "datasheet_asset_ids")
    frame = get_attachment_field("project_frames", "datasheet_asset_ids")

    assert glazing is not None
    assert glazing.key == "project_glazings.datasheet_asset_ids"
    assert glazing.asset_kinds == frozenset({"datasheet"})
    assert frame is not None
    assert frame.key == "project_frames.datasheet_asset_ids"
    assert frame.asset_kinds == frozenset({"datasheet"})


def test_site_photo_fields_are_registered_for_documentation_scope() -> None:
    table_keys = {
        "project_glazings",
        "project_frames",
        "assembly_segments",
        "ventilators",
        "pumps",
        "fans",
        "hot_water_heaters",
        "hot_water_tanks",
        "electric_heaters",
        "appliances",
        "thermal_bridges",
        "heat_pump_outdoor_equip",
        "heat_pump_indoor_equip",
        "heat_pump_outdoor_units",
        "heat_pump_indoor_units",
    }

    for table_key in table_keys:
        field = get_attachment_field(table_key, "photo_asset_ids")
        assert field is not None, table_key
        assert field.key == f"{table_key}.photo_asset_ids"
        assert field.asset_kinds == frozenset({"site_photo"})
        assert field.allowed_content_types == frozenset(
            {"image/png", "image/jpeg", "image/webp", "image/heic", "image/heif"}
        )
        assert field.allowed_extensions == frozenset({".heic", ".heif"})
        assert field.max_count == 10
        assert field.max_file_size_mb == 25


def test_pumps_datasheet_field_matches_allowed_assets() -> None:
    field = get_attachment_field("pumps", "datasheet_asset_ids")
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


def test_pumps_site_photo_field_matches_allowed_assets() -> None:
    field = get_attachment_field("pumps", "photo_asset_ids")
    assert field is not None

    assert asset_matches_field(
        field,
        asset_kind="site_photo",
        content_type="image/jpeg",
        original_filename="installed-pump.jpg",
        size_bytes=512,
    )
    assert asset_matches_field(
        field,
        asset_kind="site_photo",
        content_type="image/heic",
        original_filename="installed-pump.heic",
        size_bytes=512,
    )
    assert asset_matches_field(
        field,
        asset_kind="site_photo",
        content_type="application/octet-stream",
        original_filename="installed-pump.heif",
        size_bytes=512,
    )
    assert not asset_matches_field(
        field,
        asset_kind="datasheet",
        content_type="image/jpeg",
        original_filename="pump.jpg",
        size_bytes=512,
    )
    assert not asset_matches_field(
        field,
        asset_kind="site_photo",
        content_type="application/pdf",
        original_filename="pump.pdf",
        size_bytes=512,
    )
    assert not asset_matches_field(
        field,
        asset_kind="site_photo",
        content_type="text/plain",
        original_filename="installed-pump.heic",
        size_bytes=512,
    )
    assert not asset_matches_field(
        field,
        asset_kind="site_photo",
        content_type="image/jpeg",
        original_filename="installed-pump.jpg",
        size_bytes=26 * 1024 * 1024,
    )


def test_equipment_pump_datasheet_references_are_discoverable() -> None:
    body = _document_with_pump_datasheets()

    references = list_asset_references(
        body,
        table_key="pumps",
        column_key="datasheet_asset_ids",
        kind="datasheet",
    )

    assert references == [
        {
            "table_key": "pumps",
            "field_key": "datasheet_asset_ids",
            "row_id": "pmp_1",
            "row_name": "pmp_1",
            "asset_id": "asset_pdf_1",
            "index": 0,
        },
        {
            "table_key": "pumps",
            "field_key": "datasheet_asset_ids",
            "row_id": "pmp_1",
            "row_name": "pmp_1",
            "asset_id": "asset_img_1",
            "index": 1,
        },
    ]
    assert asset_referenced_by_document(body, "asset_pdf_1")
    assert not asset_referenced_by_document(body, "asset_missing")


def test_equipment_pump_site_photo_references_are_discoverable() -> None:
    body = _document_with_pump_datasheets()

    references = list_asset_references(
        body,
        table_key="pumps",
        column_key="photo_asset_ids",
        kind="site_photo",
    )

    assert references == [
        {
            "table_key": "pumps",
            "field_key": "photo_asset_ids",
            "row_id": "pmp_1",
            "row_name": "pmp_1",
            "asset_id": "asset_photo_1",
            "index": 0,
        }
    ]
    assert asset_referenced_by_document(body, "asset_photo_1")


def test_project_aperture_product_datasheet_references_are_discoverable() -> None:
    raw = base_document().model_dump(mode="json")
    raw["tables"]["project_glazings"] = [
        {
            "id": "pglz_a",
            "name": "Triple pane",
            "manufacturer": "Glass Co",
            "brand": None,
            "suffix": None,
            "u_value_w_m2k": 0.7,
            "g_value": 0.5,
            "color": None,
            "source": None,
            "comments": None,
            "specification_status": "needed",
            "datasheet_asset_ids": ["asset_glazing_pdf"],
            "catalog_origin": None,
        }
    ]
    raw["tables"]["project_frames"] = [
        {
            "id": "pfrm_a",
            "name": "Wood frame",
            "manufacturer": "Frame Co",
            "brand": None,
            "use": None,
            "operation": None,
            "location": None,
            "mull_type": None,
            "prefix": None,
            "suffix": None,
            "material": None,
            "width_mm": 90.0,
            "u_value_w_m2k": 1.1,
            "psi_g_w_mk": 0.04,
            "psi_install_w_mk": 0.02,
            "color": None,
            "source": None,
            "comments": None,
            "specification_status": "needed",
            "datasheet_asset_ids": ["asset_frame_pdf"],
            "catalog_origin": None,
        }
    ]
    body = ProjectDocumentV1.model_validate(raw)

    references = list_asset_references(body, kind="datasheet")

    assert {
        (ref["table_key"], ref["field_key"], ref["row_id"], ref["asset_id"])
        for ref in references
        if ref["table_key"] in {"project_glazings", "project_frames"}
    } == {
        ("project_glazings", "datasheet_asset_ids", "pglz_a", "asset_glazing_pdf"),
        ("project_frames", "datasheet_asset_ids", "pfrm_a", "asset_frame_pdf"),
    }
    assert asset_referenced_by_document(body, "asset_glazing_pdf")
    assert asset_referenced_by_document(body, "asset_frame_pdf")


def test_equipment_pump_datasheet_references_filter_by_asset_id() -> None:
    body = _document_with_pump_datasheets()

    references = list_asset_references(body, asset_ids={"asset_img_1"})

    assert len(references) == 1
    assert references[0]["table_key"] == "pumps"
    assert references[0]["field_key"] == "datasheet_asset_ids"
    assert references[0]["asset_id"] == "asset_img_1"
    assert references[0]["index"] == 1


def test_equipment_ventilator_datasheet_references_are_discoverable() -> None:
    body = _document_with_ventilator_datasheets()

    references = list_asset_references(
        body,
        table_key="ventilators",
        column_key="datasheet_asset_ids",
        kind="datasheet",
    )

    assert references == [
        {
            "table_key": "ventilators",
            "field_key": "datasheet_asset_ids",
            "row_id": "vent_1",
            "row_name": "vent_1",
            "asset_id": "asset_pdf_1",
            "index": 0,
        }
    ]


def test_documentation_evidence_fields_default_on_representative_rows() -> None:
    pump = PumpRow(id="pmp_defaults")
    bridge = ThermalBridgeRow(id="tb_defaults")
    segment = AssemblySegment(id="seg_defaults", order=0, width_mm=100)
    material = ProjectMaterial(id="pmat_defaults", name="Cellulose", category="Insulation")
    glazing = ProjectGlazing(id="pglz_defaults", name="Triple pane")
    frame = ProjectFrame(id="pfrm_defaults", name="Wood frame")

    assert pump.photo_asset_ids == []
    assert pump.datasheet_not_required is False
    assert pump.photo_not_required is False
    assert bridge.datasheet_asset_ids == []
    assert bridge.photo_asset_ids == []
    assert segment.photo_asset_ids == []
    assert segment.photo_not_required is False
    assert material.datasheet_asset_ids == []
    assert material.datasheet_not_required is False
    assert glazing.photo_asset_ids == []
    assert glazing.datasheet_not_required is False
    assert glazing.photo_not_required is False
    assert frame.photo_asset_ids == []
    assert frame.datasheet_not_required is False
    assert frame.photo_not_required is False

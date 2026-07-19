from __future__ import annotations

from uuid import UUID

from fastapi.testclient import TestClient

from features.heat_pumps.models import HeatPumpOutdoorEquipRow, HeatPumpOutdoorEquipTableEnvelope
from features.project_document.document import (
    Assembly,
    AssemblyLayer,
    AssemblySegment,
    EmptyEquipmentTables,
    ProjectDocumentTables,
    ProjectMaterial,
    PumpRow,
    PumpsTableEnvelope,
)
from features.project_document.documentation_summary import project_documentation_summary
from features.project_document.models import ProjectDocumentView
from features.project_document.rows import SingleSelectOption
from features.project_document.tables._status_field import STATUS_OPTION_NA, STATUS_OPTION_NEEDED
from features.project_document.templates import empty_project_document
from features.projects.models import CreateProjectRequest
from main import app
from tests.test_project_document import create_project, create_rooms_draft, signed_in_client

_PROJECT_ID = UUID("00000000-0000-0000-0000-000000000001")
_VERSION_ID = UUID("00000000-0000-0000-0000-000000000002")
_ULID = "01ARZ3NDEKTSV4RRFFQ69G5FAV"


def _view(
    tables: ProjectDocumentTables,
    *,
    single_select_options: dict[str, list[SingleSelectOption]] | None = None,
) -> ProjectDocumentView:
    body = empty_project_document(
        CreateProjectRequest(name="Documentation summary", bt_number="doc-summary", cert_programs=[])
    ).model_copy(update={"tables": tables})
    if single_select_options is not None:
        body = body.model_copy(update={"single_select_options": single_select_options})
    return ProjectDocumentView.model_construct(
        project_id=_PROJECT_ID,
        version_id=_VERSION_ID,
        source="draft",
        version_etag="version-etag",
        draft_etag="draft-etag",
        body=body,
    )


def test_documentation_summary_counts_derived_axes_and_na_rows() -> None:
    base = empty_project_document(
        CreateProjectRequest(name="Documentation summary", bt_number="doc-summary", cert_programs=[])
    )
    equipment = base.tables.equipment.model_copy(
        update={
            "pumps": PumpsTableEnvelope(
                rows=[
                    PumpRow(
                        id="pmp_1",
                        datasheet_not_required=True,
                        datasheet_status="na",
                        photo_asset_ids=["asset_photo_1"],
                        photo_status="complete",
                        custom_values={"name": "Pump 1", "status": STATUS_OPTION_NEEDED},
                    ),
                    PumpRow(
                        id="pmp_2",
                        custom_values={"name": "Pump 2", "status": STATUS_OPTION_NA},
                    ),
                ]
            )
        }
    )
    summary = project_documentation_summary(_view(base.tables.model_copy(update={"equipment": equipment})))

    equipment_section = next(section for section in summary.sections if section.key == "equipment")
    pumps = next(group for group in equipment_section.groups if group.key == "pumps")
    assert pumps.counts.model_dump() == {
        "spec_done": 1,
        "spec_total": 2,
        "ds_done": 2,
        "ds_total": 2,
        "photo_done": 2,
        "photo_total": 2,
    }
    assert pumps.records[1].datasheet_not_required is True
    assert pumps.records[1].photo_not_required is True
    assert pumps.records[1].datasheet_status == "na"
    assert pumps.records[1].photo_status == "na"


def test_documentation_summary_counts_manual_needed_with_attachments_as_incomplete() -> None:
    base = empty_project_document(
        CreateProjectRequest(name="Documentation summary", bt_number="doc-summary", cert_programs=[])
    )
    equipment = base.tables.equipment.model_copy(
        update={
            "pumps": PumpsTableEnvelope(
                rows=[
                    PumpRow(
                        id="pmp_1",
                        datasheet_asset_ids=["asset_ds_1"],
                        photo_asset_ids=["asset_photo_1"],
                        datasheet_status="needed",
                        photo_status="needed",
                        custom_values={"name": "Pump 1", "status": STATUS_OPTION_NEEDED},
                    )
                ]
            )
        }
    )

    summary = project_documentation_summary(_view(base.tables.model_copy(update={"equipment": equipment})))

    equipment_section = next(section for section in summary.sections if section.key == "equipment")
    pumps = next(group for group in equipment_section.groups if group.key == "pumps")
    assert pumps.counts.ds_done == 0
    assert pumps.counts.photo_done == 0
    record = pumps.records[0]
    assert record.datasheet_asset_ids == ["asset_ds_1"]
    assert record.photo_asset_ids == ["asset_photo_1"]
    assert record.datasheet_status == "needed"
    assert record.photo_status == "needed"


def test_documentation_summary_groups_envelope_materials_per_assembly() -> None:
    material = ProjectMaterial(
        id="pmat_cellulose",
        name="Dense-pack cellulose",
        category="Insulation",
        specification_status="complete",
        datasheet_asset_ids=["asset_ds_1"],
        datasheet_status="complete",
    )
    assembly = Assembly(
        id="asm_wall_c3",
        name="WALL-C3",
        type="wall",
        orientation="first_layer_outside",
        layers=[
            AssemblyLayer(
                id="lyr_1",
                order=0,
                thickness_mm=140,
                segments=[
                    AssemblySegment(
                        id="seg_1",
                        order=0,
                        width_mm=400,
                        project_material_id=material.id,
                        photo_asset_ids=["asset_photo_1"],
                        photo_status="complete",
                    ),
                    AssemblySegment(
                        id="seg_2",
                        order=1,
                        width_mm=400,
                        project_material_id=material.id,
                        photo_asset_ids=["asset_photo_1", "asset_photo_2"],
                        photo_status="complete",
                    ),
                ],
            )
        ],
    )
    tables = ProjectDocumentTables(assemblies=[assembly], project_materials=[material])
    summary = project_documentation_summary(_view(tables))

    envelope = next(section for section in summary.sections if section.key == "envelope")
    assert envelope.counts.model_dump() == {
        "spec_done": 1,
        "spec_total": 1,
        "ds_done": 1,
        "ds_total": 1,
        "photo_done": 1,
        "photo_total": 1,
    }
    group = envelope.groups[0]
    assert group.key == "asm_wall_c3"
    assert len(group.records) == 1
    record = group.records[0]
    assert record.record_id == "asm_wall_c3:pmat_cellulose"
    assert record.segment_ids == ["seg_1", "seg_2"]
    assert record.photo_asset_ids == ["asset_photo_1", "asset_photo_2"]
    assert record.material_id == "pmat_cellulose"


def test_documentation_summary_keeps_heat_pump_leaf_grouping_and_option_sublabel() -> None:
    base = empty_project_document(
        CreateProjectRequest(name="Documentation summary", bt_number="doc-summary", cert_programs=[])
    )
    heat_pumps = base.tables.equipment.heat_pumps.model_copy(
        update={
            "outdoor_equip": HeatPumpOutdoorEquipTableEnvelope(
                rows=[
                    HeatPumpOutdoorEquipRow(
                        id=f"hpoe_{_ULID}",
                        tag="HP-O-1",
                        manufacturer="opt_mitsu",
                        model_number="MXZ-SM48",
                        datasheet_asset_ids=["asset_ds_1"],
                        datasheet_status="complete",
                        photo_not_required=True,
                        photo_status="na",
                        custom_values={"name": "Outdoor heat pump", "status": STATUS_OPTION_NEEDED},
                    )
                ]
            )
        }
    )
    equipment = EmptyEquipmentTables(heat_pumps=heat_pumps)
    summary = project_documentation_summary(
        _view(
            base.tables.model_copy(update={"equipment": equipment}),
            single_select_options={
                "heat_pumps.manufacturer": [
                    SingleSelectOption(id="opt_mitsu", label="Mitsubishi", color="#2563EB", order=0)
                ]
            },
        )
    )

    equipment_section = next(section for section in summary.sections if section.key == "equipment")
    heat_pump_group = next(group for group in equipment_section.groups if group.key == "heat-pumps-outdoor-equipment")
    assert heat_pump_group.title == "Heat Pumps - Outdoor Equipment"
    assert heat_pump_group.counts.photo_done == 1
    record = heat_pump_group.records[0]
    assert record.field_table_key == "heat_pump_outdoor_equip"
    assert record.display_name == "Outdoor heat pump"
    assert record.sub_label == "Mitsubishi · MXZ-SM48"


def test_documentation_summary_routes_match_status_summary_access(clean_document_tables: None) -> None:
    editor = signed_in_client()
    project = create_project(editor)
    project_id = project["id"]
    version_id = project["active_version_id"]
    create_rooms_draft(editor, project_id, version_id)

    draft = editor.get(f"/api/v1/projects/{project_id}/versions/{version_id}/draft/documentation-summary")
    assert draft.status_code == 200
    assert draft.json()["source"] == "draft"

    viewer = TestClient(app)
    saved = viewer.get(f"/api/v1/projects/{project_id}/versions/{version_id}/document/documentation-summary")
    draft_as_viewer = viewer.get(f"/api/v1/projects/{project_id}/versions/{version_id}/draft/documentation-summary")

    assert saved.status_code == 200
    assert saved.json()["source"] == "version"
    assert draft_as_viewer.status_code in {401, 403}

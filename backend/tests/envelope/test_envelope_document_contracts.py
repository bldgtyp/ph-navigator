"""Assembly Builder backend document-contract tests."""

from __future__ import annotations

from typing import Any, cast

import pytest
from fastapi.testclient import TestClient
from psycopg.types.json import Jsonb
from pydantic import ValidationError

from database import transaction
from features.project_document.document import ProjectDocumentV1, ProjectMaterial
from features.project_document.tables import get_table_contract
from features.project_document.validation import body_size_bytes, document_etag
from features.projects.models import CreateProjectRequest
from features.projects.service import empty_project_document
from main import app
from tests.builders.assets import insert_project_asset
from tests.test_project_document import ORIGIN, create_project, signed_in_client


def project_material(**overrides: Any) -> dict[str, Any]:
    base: dict[str, Any] = {
        "id": "pmat_insul",
        "name": "Wood fiber board",
        "category": "insulation",
        "density_kg_m3": 160.0,
        "specific_heat_j_kgk": 2100.0,
        "conductivity_w_mk": 0.038,
        "emissivity": 0.9,
        "color": "#dce6c8",
        "source": None,
        "url": None,
        "comments": None,
        "specification_status": "missing",
        "datasheet_asset_ids": ["asset_01HXABCDEF0123456789ABCD"],
        "datasheet_not_required": False,
        "catalog_origin": None,
    }
    base.update(overrides)
    return base


def assembly(**overrides: Any) -> dict[str, Any]:
    base: dict[str, Any] = {
        "id": "asm_wall_c3",
        "name": "WALL-C3",
        "type": "wall",
        "orientation": "first_layer_outside",
        "layers": [
            {
                "id": "lyr_sheathing",
                "order": 0,
                "thickness_mm": 50.0,
                "segments": [
                    {
                        "id": "seg_insul",
                        "order": 0,
                        "width_mm": 812.8,
                        "is_continuous_insulation": False,
                        "steel_stud_spacing_mm": None,
                        "project_material_id": "pmat_insul",
                        "photo_asset_ids": ["asset_01HXPHOTO00123456789ABCD"],
                        "photo_not_required": False,
                        "use_site_notes": "Use over exterior sheathing.",
                    }
                ],
            },
            {
                "id": "lyr_service_cavity",
                "order": 1,
                "thickness_mm": 38.0,
                "segments": [
                    {
                        "id": "seg_null",
                        "order": 0,
                        "width_mm": 812.8,
                        "is_continuous_insulation": False,
                        "steel_stud_spacing_mm": 406.4,
                        "project_material_id": None,
                        "photo_asset_ids": [],
                        "photo_not_required": False,
                        "use_site_notes": None,
                    }
                ],
            },
        ],
    }
    base.update(overrides)
    return base


def base_document() -> ProjectDocumentV1:
    return empty_project_document(
        CreateProjectRequest(
            name="West Stockbridge House",
            bt_number="2426",
            cert_programs=["phi"],
            phius_number=None,
            phius_dropbox_url=None,
        )
    )


def envelope_body() -> ProjectDocumentV1:
    body = base_document()
    raw = body.model_dump(mode="json")
    raw["tables"]["project_materials"] = [
        project_material(),
        project_material(
            id="pmat_duplicate_name",
            name="Wood fiber board",
            conductivity_w_mk=None,
            datasheet_asset_ids=[],
        ),
    ]
    raw["tables"]["assemblies"] = [
        assembly(),
        assembly(
            id="asm_roof_r1",
            name="ROOF-R1",
            type="roof",
            layers=[
                {
                    "id": "lyr_roof_insul",
                    "order": 0,
                    "thickness_mm": 200.0,
                    "segments": [
                        {
                            "id": "seg_roof_insul",
                            "order": 0,
                            "width_mm": 1000.0,
                            "is_continuous_insulation": True,
                            "steel_stud_spacing_mm": None,
                            "project_material_id": "pmat_duplicate_name",
                            "photo_asset_ids": [],
                            "photo_not_required": False,
                            "use_site_notes": None,
                        }
                    ],
                }
            ],
        ),
    ]
    return ProjectDocumentV1.model_validate(raw)


def write_saved_body(version_id: object, body: ProjectDocumentV1) -> None:
    with transaction() as conn:
        conn.execute(
            """
            UPDATE project_versions
            SET body = %(body)s,
                body_size_bytes = %(body_size_bytes)s,
                schema_version = %(schema_version)s
            WHERE id = %(version_id)s
            """,
            {
                "body": Jsonb(body.model_dump(mode="json")),
                "body_size_bytes": body_size_bytes(body),
                "schema_version": body.schema_version,
                "version_id": version_id,
            },
        )


def envelope_url(project_id: object, version_id: object, source: str = "draft") -> str:
    return f"/api/v1/projects/{project_id}/versions/{version_id}/envelope?source={source}"


def draft_project_materials_url(project_id: object, version_id: object) -> str:
    return f"/api/v1/projects/{project_id}/versions/{version_id}/draft/tables/project_materials"


def test_document_validates_envelope_shape_and_references() -> None:
    raw = base_document().model_dump(mode="json")
    raw["tables"]["project_materials"] = [project_material()]
    raw["tables"]["assemblies"] = [assembly()]
    assert ProjectDocumentV1.model_validate(raw).tables.assemblies[0].layers[0].segments[0].use_site_notes

    duplicate_name = dict(raw)
    duplicate_name["tables"] = {
        **raw["tables"],
        "assemblies": [assembly(), assembly(id="asm_wall_c4", name=" wall-c3 ")],
    }
    with pytest.raises(ValidationError, match="Duplicate assembly name"):
        ProjectDocumentV1.model_validate(duplicate_name)

    broken_reference = dict(raw)
    broken_reference["tables"] = {
        **raw["tables"],
        "project_materials": [project_material()],
        "assemblies": [assembly()],
    }
    broken_reference["tables"]["assemblies"][0]["layers"][0]["segments"][0]["project_material_id"] = "pmat_missing"
    with pytest.raises(ValidationError, match="Unknown project_material_id"):
        ProjectDocumentV1.model_validate(broken_reference)

    wrong_origin = project_material(
        catalog_origin={
            "catalog_table": "frame_types",
            "catalog_record_id": "rec0123456789ABCD",
            "synced_at": "2026-05-26T21:44:00Z",
        }
    )
    with pytest.raises(ValidationError, match="catalog_table must be 'materials'"):
        ProjectDocumentV1.model_validate(
            {**raw, "tables": {**raw["tables"], "project_materials": [wrong_origin], "assemblies": []}}
        )


def test_envelope_table_contracts_are_registered_with_unit_metadata() -> None:
    materials = get_table_contract("project_materials")
    segments = get_table_contract("assembly_segments")

    assert materials.schema_slug == "project-material"
    assert materials.unit_fields == {
        "conductivity_w_mk": "conductivity",
        "density_kg_m3": "density",
        "specific_heat_j_kgk": "specific_heat",
    }
    assert materials.field_registry is None
    assert segments.schema_slug == "assembly-segment"
    assert segments.unit_fields == {
        "width_mm": "length",
        "steel_stud_spacing_mm": "length",
    }
    assert segments.field_registry is None


def test_envelope_read_endpoint_returns_saved_and_draft_sources(clean_document_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]
    saved_body = envelope_body()
    write_saved_body(version_id, saved_body)
    insert_project_asset(project_id=project_id, asset_id="asset_01HXABCDEF0123456789ABCD")
    insert_project_asset(
        project_id=project_id,
        asset_id="asset_01HXPHOTO00123456789ABCD",
        asset_kind="site_photo",
        content_type="image/jpeg",
        original_filename="assembly-photo.jpg",
    )

    saved = client.get(envelope_url(project_id, version_id, source="version"))
    assert saved.status_code == 200
    saved_json = saved.json()
    assert saved_json["source"] == "version"
    assert saved_json["draft_etag"] is None
    assert saved_json["assemblies"][0]["status"]["flags"] == ["missing_material"]
    assert saved_json["project_materials"][0]["use_sites"][0]["use_site_notes"] == "Use over exterior sheathing."

    initial = client.get(draft_project_materials_url(project_id, version_id))
    assert initial.status_code == 200
    draft_materials = saved_body.tables.project_materials + [
        ProjectMaterial.model_validate(project_material(id="pmat_extra", name="Extra"))
    ]
    replacement_rows = [material.model_dump(mode="json") for material in draft_materials]
    replacement_rows[-1]["specification_status"] = "needed"
    updated = client.put(
        draft_project_materials_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match-Version": initial.json()["version_etag"]},
        json={"rows": replacement_rows},
    )
    assert updated.status_code == 200
    assert updated.json()["rows"][-1]["specification_status"] == "missing"

    draft = client.get(envelope_url(project_id, version_id, source="draft"))
    assert draft.status_code == 200
    draft_json = draft.json()
    assert draft_json["source"] == "draft"
    assert draft_json["draft_etag"]
    assert len(draft_json["project_materials"]) == 3
    assert draft_json["version_etag"] == document_etag(saved_body)


def test_assembly_segments_table_is_flattened_view_not_document_source(clean_document_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]
    saved_body = envelope_body()
    write_saved_body(version_id, saved_body)

    response = client.get(f"/api/v1/projects/{project_id}/versions/{version_id}/document/tables/assembly_segments")

    assert response.status_code == 200
    rows = response.json()["rows"]
    assert rows[0]["assembly_id"] == "asm_wall_c3"
    assert rows[0]["layer_id"] == "lyr_sheathing"
    assert rows[0]["project_material_name"] == "Wood fiber board"
    assert "assemblies" in saved_body.model_dump(mode="json")["tables"]


def test_assembly_segments_replace_preserves_omitted_notes_and_skips_noop() -> None:
    contract = get_table_contract("assembly_segments")
    body = envelope_body()
    segment = body.tables.assemblies[0].layers[0].segments[0]

    photos_only = contract.parse_replace_payload(
        {
            "rows": [
                {
                    "id": segment.id,
                    "photo_asset_ids": ["asset_new"],
                    "photo_status": "complete",
                    "photo_not_required": True,
                }
            ]
        }
    )
    updated = contract.apply_replace(body, photos_only)

    updated_segment = updated.tables.assemblies[0].layers[0].segments[0]
    assert updated_segment.photo_asset_ids == ["asset_new"]
    assert updated_segment.photo_status == "complete"
    assert updated_segment.photo_not_required is True
    assert updated_segment.use_site_notes == "Use over exterior sheathing."
    extracted_rows = contract.extract_rows(updated)
    assert isinstance(extracted_rows, list)
    first_row = cast("dict[str, Any]", extracted_rows[0])
    assert first_row["photo_status"] == "complete"
    assert first_row["photo_not_required"] is True

    unchanged = contract.parse_replace_payload(
        {
            "rows": [
                {
                    "id": updated_segment.id,
                    "photo_asset_ids": ["asset_new"],
                    "photo_status": updated_segment.photo_status,
                    "photo_not_required": updated_segment.photo_not_required,
                    "use_site_notes": updated_segment.use_site_notes,
                }
            ]
        }
    )
    assert contract.apply_replace(updated, unchanged) is updated


def test_envelope_schema_endpoints_expose_row_shapes() -> None:
    client = TestClient(app)

    material = client.get("/api/v1/schemas/project-material/v1.json")
    segment = client.get("/api/v1/schemas/assembly-segment/v1.json")

    assert material.status_code == 200
    assert "conductivity_w_mk" in material.json()["properties"]
    assert segment.status_code == 200
    assert "assembly_id" in segment.json()["properties"]

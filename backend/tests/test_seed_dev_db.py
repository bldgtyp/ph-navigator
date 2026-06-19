"""Smoke tests for local-dev project seed assembly."""

from __future__ import annotations

from features.projects.models import CreateProjectRequest
from scripts.seed_dev_db import _starter_project_document


def test_starter_project_document_seeds_two_envelope_assemblies() -> None:
    body = _starter_project_document(
        CreateProjectRequest(
            name="PHN V2 Starter Project",
            bt_number="DEV-0001",
            client="BLDGTYP",
            cert_programs=["phius"],
            phius_number=None,
            phius_dropbox_url=None,
        )
    )

    assert [assembly.name for assembly in body.tables.assemblies] == [
        "WALL-2X4-STUD",
        "WALL-HOMOGENEOUS-CONCRETE",
    ]
    assert len(body.tables.project_materials) == 6

    material_ids = {material.id for material in body.tables.project_materials}
    referenced_material_ids = {
        segment.project_material_id
        for assembly in body.tables.assemblies
        for layer in assembly.layers
        for segment in layer.segments
    }
    assert referenced_material_ids <= material_ids


def test_starter_project_document_seeds_default_aperture() -> None:
    body = _starter_project_document(
        CreateProjectRequest(
            name="PHN V2 Starter Project",
            bt_number="DEV-0001",
            client="BLDGTYP",
            cert_programs=["phius"],
            phius_number=None,
            phius_dropbox_url=None,
        )
    )

    assert len(body.tables.apertures) == 1
    aperture = body.tables.apertures[0]
    assert aperture.id == "apt_seed_1000x1000"
    assert aperture.name == "Seed Aperture 1000 x 1000"
    assert aperture.row_heights_mm == [1000.0]
    assert aperture.column_widths_mm == [1000.0]

    [element] = aperture.elements
    assert element.row_span == (0, 0)
    assert element.column_span == (0, 0)
    assert element.glazing is not None
    assert element.glazing.name == "PHN-Default-Glazing"

    frame_names = {
        frame.name
        for frame in (element.frames.top, element.frames.right, element.frames.bottom, element.frames.left)
        if frame is not None
    }
    assert frame_names == {"PHN-Default-Frame"}


def test_starter_project_document_seeds_electric_heater_datasheet_field() -> None:
    body = _starter_project_document(
        CreateProjectRequest(
            name="PHN V2 Starter Project",
            bt_number="DEV-0001",
            client="BLDGTYP",
            cert_programs=["phius"],
            phius_number=None,
            phius_dropbox_url=None,
        )
    )

    electric_heaters = body.tables.equipment.electric_heaters

    assert any(field.field_key == "datasheet_asset_ids" for field in electric_heaters.field_defs)
    assert electric_heaters.rows
    assert all(row.datasheet_asset_ids == [] for row in electric_heaters.rows)

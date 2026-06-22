"""Smoke tests for local-dev project seed assembly + the climate source pins."""

from __future__ import annotations

from typing import cast
from uuid import UUID

from database import transaction
from features.climate.service import seed_dataset
from features.projects.models import CreateProjectRequest
from scripts.seed_dev_db import _pin_nearest_phi_source, _starter_project_document
from tests.test_climate_dataset_roster import _station
from tests.test_climate_datasets import clean_climate_tables
from tests.test_mcp import clean_mcp_tables, create_project, signed_in_client

# Re-exported so the climate-table / mcp-table fixtures resolve in this module.
__all__ = ["clean_climate_tables", "clean_mcp_tables"]


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


def test_pin_nearest_phi_source_attaches_closest_station(clean_mcp_tables: None, clean_climate_tables: None) -> None:
    """The PHI seed pin attaches the nearest PHI station as a project source."""
    phi = seed_dataset(
        "phi",
        "10.6",
        [
            _station(station_id="PHI-NEAR", miles_north=8.0, region="NY", provider="phi"),
            _station(station_id="PHI-FAR", miles_north=120.0, region="NY", provider="phi"),
        ],
        label="PHI 10.6",
    )
    client = signed_in_client()
    project_id = UUID(cast(str, create_project(client)["id"]))

    with transaction() as conn:
        location = _pin_nearest_phi_source(conn, project_id, phi, {"latitude": 40.0, "longitude": -75.0})
        assert location is not None
        assert location["name"] == "PHI-NEAR"  # nearest of the two, not the 120 mi station
        rows = conn.execute(
            "SELECT kind, ref, label FROM project_climate_source WHERE project_id = %(pid)s",
            {"pid": project_id},
        ).fetchall()

    phi_sources = [row for row in rows if row["kind"] == "phi"]
    assert len(phi_sources) == 1
    assert phi_sources[0]["ref"] == str(location["id"])
    assert "(PHI 10.6)" in phi_sources[0]["label"]

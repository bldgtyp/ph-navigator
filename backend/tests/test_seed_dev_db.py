"""Smoke tests for local-dev project seed assembly + the climate source pins."""

from __future__ import annotations

from typing import cast
from uuid import UUID

from database import transaction
from features.climate.service import seed_dataset
from features.project_document.apertures.lookup import frame_by_id, glazing_by_id
from features.project_document.document import ProjectDocumentV1
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
    glazing = glazing_by_id(body.tables, element.glazing_id)
    assert glazing is not None
    assert glazing.name == "PHN-Default-Glass"

    frame_names = {
        frame.name
        for frame in (
            frame_by_id(body.tables, element.frames.top),
            frame_by_id(body.tables, element.frames.right),
            frame_by_id(body.tables, element.frames.bottom),
            frame_by_id(body.tables, element.frames.left),
        )
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


def _starter_body() -> ProjectDocumentV1:
    return _starter_project_document(
        CreateProjectRequest(
            name="PHN V2 Starter Project",
            bt_number="DEV-0001",
            client="BLDGTYP",
            cert_programs=["phius"],
            phius_number=None,
            phius_dropbox_url=None,
        )
    )


def test_starter_project_document_seeds_status_options_and_values() -> None:
    from features.project_document.tables._status_field import (
        STATUS_OPTION_IDS,
        STATUS_TABLE_NAMES,
        status_option_key,
    )

    body = _starter_body()

    # Every in-scope table seeds its namespaced status option list with the
    # canonical four options.
    for table_name in STATUS_TABLE_NAMES:
        options = body.single_select_options[status_option_key(table_name)]
        assert [option.id for option in options] == list(STATUS_OPTION_IDS)

    # Seeded rows collectively exercise all four status values.
    seeded_status_values = {
        row.custom_values.get("status")
        for rows in (
            body.tables.thermal_bridges.rows,
            body.tables.equipment.pumps.rows,
            body.tables.equipment.fans.rows,
            body.tables.equipment.hot_water_heaters.rows,
            body.tables.equipment.hot_water_tanks.rows,
            body.tables.equipment.electric_heaters.rows,
            body.tables.equipment.appliances.rows,
            body.tables.equipment.heat_pumps.outdoor_equip.rows,
            body.tables.equipment.heat_pumps.indoor_equip.rows,
        )
        for row in rows
    }
    assert set(STATUS_OPTION_IDS) <= seeded_status_values


def test_status_table_names_match_registered_contracts() -> None:
    """The STATUS_TABLE_NAMES source-of-truth list must stay in sync with the
    table contracts that actually carry the built-in status FieldDef."""
    from features.project_document.tables._status_field import STATUS_FIELD_KEY, STATUS_TABLE_NAMES
    from features.project_document.tables.registry import iter_table_contracts

    tables_with_status = {
        contract.name
        for contract in iter_table_contracts()
        if contract.field_registry is not None and STATUS_FIELD_KEY in contract.field_registry.field_keys
    }
    assert tables_with_status == set(STATUS_TABLE_NAMES)

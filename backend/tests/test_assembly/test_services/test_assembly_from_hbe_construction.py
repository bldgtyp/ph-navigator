# -*- Python Version: 3.11 -*-

import json

import pytest
from honeybee_energy.construction.opaque import OpaqueConstruction
from honeybee_energy.material.opaque import EnergyMaterial, EnergyMaterialNoMass
from sqlalchemy.orm import Session

from db_entities.app import Project
from features.app.services import ProjectNotFoundException
from features.assembly.services.assembly import get_assembly_by_id
from features.assembly.services.assembly_from_hbjson import (
    create_assembly_from_hb_construction,
    get_multiple_hb_constructions_from_hbjson,
)
from features.assembly.services.material import MaterialNotFoundException


def test_create_assembly_from_hb_construction(session: Session, create_test_project):
    create_test_project(db=session, username="user1", project_name="Project 1")
    hbe_construction = OpaqueConstruction(
        identifier="Test Construction",
        materials=[
            EnergyMaterial(
                identifier="Test Material",
                thickness=1.0,
                conductivity=1.0,
                density=999,
                specific_heat=999,
            )
        ],
    )
    assembly = create_assembly_from_hb_construction(session, "1234", hbe_construction)

    assert assembly.name == "Test Construction"
    assert assembly.project_id == 1  # Assuming the project ID is 1 for the test project
    assert len(assembly.layers) == 1
    assert len(assembly.layers[0].segments) == 1
    assert assembly.layers[0].segments[0].material.name == "Test Material"
    assert assembly.layers[0].thickness_mm == 1000
    assert assembly.layers[0].segments[0].material.conductivity_w_mk == 1.0
    assert assembly.layers[0].segments[0].material.density_kg_m3 == 999
    assert assembly.layers[0].segments[0].material.specific_heat_j_kgk == 999


def test_create_assembly_from_hb_construction_with_missing_project(session: Session):
    hbe_construction = OpaqueConstruction(
        identifier="Test Construction",
        materials=[
            EnergyMaterial(
                identifier="Test Material",
                thickness=1.0,
                conductivity=1.0,
                density=999,
                specific_heat=999,
            )
        ],
    )

    with pytest.raises(ProjectNotFoundException, match="Project 4567 not found."):
        create_assembly_from_hb_construction(session, "4567", hbe_construction)


def test_create_assembly_from_hb_construction_with_non_existing_material(session: Session, create_test_project):
    create_test_project(db=session, username="user1", project_name="Project 1")
    hbe_construction = OpaqueConstruction(
        identifier="Test Construction",
        materials=[
            EnergyMaterial(
                identifier="Invalid Material",  # This material is not in the database
                thickness=1.0,
                conductivity=1.0,
                density=999,
                specific_heat=999,
            )
        ],
    )

    with pytest.raises(MaterialNotFoundException):
        create_assembly_from_hb_construction(session, "1234", hbe_construction)


def test_create_assembly_with_existing_id(session: Session, create_test_project):
    project: Project = create_test_project(db=session, username="user1", project_name="Project 1")
    existing_assembly = get_assembly_by_id(session, 1)
    assert existing_assembly.name == "Test Assembly"

    hbe_construction = OpaqueConstruction(
        identifier="Test Assembly",
        materials=[
            EnergyMaterial(
                identifier="Test Material",  # This material is already in the database
                thickness=1.0,
                conductivity=1.0,
                density=999,
                specific_heat=999,
            )
        ],
    )

    assert hbe_construction.identifier == "Test Assembly"
    assert hbe_construction.display_name == "Test Assembly"

    assembly = create_assembly_from_hb_construction(session, project.bt_number, hbe_construction)
    assert assembly.name == "Test Assembly"
    assert assembly.project_id == project.id
    assert len(assembly.layers) == 1
    assert len(assembly.layers[0].segments) == 1
    assert assembly.layers[0].segments[0].material.name == "Test Material"
    assert assembly.layers[0].thickness_mm == 1000
    assert assembly.layers[0].segments[0].material.conductivity_w_mk == 1.0
    assert assembly.layers[0].segments[0].material.density_kg_m3 == 999
    assert assembly.layers[0].segments[0].material.specific_heat_j_kgk == 999


def test_create_assembly_from_hb_construction_with_EnergyMaterialNoMass_material(session: Session, create_test_project):
    project: Project = create_test_project(db=session, username="user1", project_name="Project 1")
    existing_assembly = get_assembly_by_id(session, 1)
    assert existing_assembly.name == "Test Assembly"

    mat_energy = EnergyMaterial(
        identifier="Test Material",
        thickness=1.0,
        conductivity=1.0,
        density=999,
        specific_heat=999,
    )
    mat_no_mass = EnergyMaterialNoMass(
        identifier="New EnergyMaterialNoMass",
        r_value=1.0,
    )
    assert isinstance(mat_energy, EnergyMaterial)
    assert not isinstance(mat_no_mass, EnergyMaterial)

    hbe_construction = OpaqueConstruction(
        identifier="New Assembly",
        materials=[mat_energy, mat_no_mass],
    )

    assert hbe_construction.identifier == "New Assembly"
    assert hbe_construction.display_name == "New Assembly"

    assembly = create_assembly_from_hb_construction(session, project.bt_number, hbe_construction)

    assert assembly.name == "New Assembly"
    assert assembly.project_id == project.id
    assert len(assembly.layers) == 1  # NoMass Gets ignored
    assert len(assembly.layers[0].segments) == 1
    assert assembly.layers[0].segments[0].material.name == "Test Material"
    assert assembly.layers[0].thickness_mm == 1000
    assert assembly.layers[0].segments[0].material.conductivity_w_mk == 1.0
    assert assembly.layers[0].segments[0].material.density_kg_m3 == 999
    assert assembly.layers[0].segments[0].material.specific_heat_j_kgk == 999


def test_get_single_hb_construction_from_hbjson():
    hbe_construction = OpaqueConstruction(
        identifier="Test Construction",
        materials=[
            EnergyMaterial(
                identifier="Test Material",
                thickness=1.0,
                conductivity=1.0,
                density=999,
                specific_heat=999,
            )
        ],
    )

    hb_constructions = get_multiple_hb_constructions_from_hbjson(hbe_construction.to_dict())

    assert len(hb_constructions) == 1
    assert hb_constructions[0].identifier == "Test Construction"
    assert len(hb_constructions[0].materials) == 1
    assert hb_constructions[0].materials[0].identifier == "Test Material"


def test_get_multiple_hb_constructions_from_hbjson():
    hbe_construction_1 = OpaqueConstruction(
        identifier="Test Construction",
        materials=[
            EnergyMaterial(
                identifier="Test Material",
                thickness=1.0,
                conductivity=1.0,
                density=999,
                specific_heat=999,
            )
        ],
    )
    hbe_construction_2 = OpaqueConstruction(
        identifier="Another Construction",
        materials=[
            EnergyMaterial(
                identifier="Another Material",
                thickness=2.0,
                conductivity=2.0,
                density=888,
                specific_heat=888,
            )
        ],
    )
    hbe_constructions = {
        hbe_construction_1.identifier: hbe_construction_1.to_dict(),
        hbe_construction_2.identifier: hbe_construction_2.to_dict(),
    }
    hbe_constructions_json = json.dumps(hbe_constructions)

    # --- Rebuild the hb_constructions from the JSON
    rebuilt_hb_constructions = get_multiple_hb_constructions_from_hbjson(json.loads(hbe_constructions_json))

    assert len(rebuilt_hb_constructions) == 2
    assert rebuilt_hb_constructions[0].identifier == "Test Construction"
    assert len(rebuilt_hb_constructions[0].materials) == 1
    assert rebuilt_hb_constructions[0].materials[0].identifier == "Test Material"
    assert rebuilt_hb_constructions[1].identifier == "Another Construction"
    assert len(rebuilt_hb_constructions[1].materials) == 1
    assert rebuilt_hb_constructions[1].materials[0].identifier == "Another Material"

# -*- Python Version: 3.11 (Render.com) -*

from sqlalchemy.orm import Session

from db_entities.app import Project
from features.assembly.services.assembly import create_new_default_assembly_on_project, get_assembly_by_id
from features.assembly.services.assembly_to_hbe_construction import convert_assemblies_to_hbe_constructions
from features.assembly.services.segment import update_segment_steel_stud_spacing


def test_convert_one_simple_assembly_to_hbe_constructions(session: Session, create_test_project):
    create_test_project(db=session, username="user1", project_name="Project 1")
    assembly = get_assembly_by_id(db=session, assembly_id=1)
    hbe_constructions = convert_assemblies_to_hbe_constructions([assembly])

    assert len(hbe_constructions) == 1
    hbe_construction = hbe_constructions[0]
    assert hbe_construction.identifier == assembly.name

    assert len(hbe_construction.materials) == 1
    hbe_material = hbe_construction.materials[0]
    assert hbe_material.identifier == assembly.layers[0].segments[0].material.name
    assert hbe_material.conductivity == assembly.layers[0].segments[0].material.conductivity_w_mk
    assert hbe_material.thickness == assembly.layers[0].thickness_mm / 1000

    # TODO:
    # assert hbe_material.density == assembly.layers[0].segments[0].material.density_kg_m3
    # assert hbe_material.specific_heat == assembly.layers[0].segments[0].material.specific_heat_j_kgk


def test_convert_multiple_simple_assemblies_to_hbe_constructions(session: Session, create_test_project):
    project: Project = create_test_project(db=session, username="user1", project_name="Project 1")

    # Add two more assemblies to the default starting assembly
    assembly2 = create_new_default_assembly_on_project(session, "1234")
    assembly3 = create_new_default_assembly_on_project(session, "1234")

    hbe_constructions = convert_assemblies_to_hbe_constructions(project.assemblies)

    assert len(hbe_constructions) == 3


def test_convert_steel_stud_assembly_to_hbe_construction(session: Session, create_test_project):
    project: Project = create_test_project(db=session, username="user1", project_name="Project 1")

    new_assembly = create_new_default_assembly_on_project(session, "1234")
    update_segment_steel_stud_spacing(session, new_assembly.layers[0].segments[0].id, 400)

    hbe_constructions = convert_assemblies_to_hbe_constructions([new_assembly])

    assert len(hbe_constructions) == 1


# TODO:
# test steel stud assemblies
# test wood stud assemblies

# -*- Python Version: 3.11 (Render.com) -*

from sqlalchemy.orm import Session

from features.assembly.services.assembly import get_assembly_by_id
from features.assembly.services.assembly_to_hbe_construction import convert_assemblies_to_hbe_constructions


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

# TODO:
# test multiple assemblies
# test steel stud assemblies
# test wood stud assemblies
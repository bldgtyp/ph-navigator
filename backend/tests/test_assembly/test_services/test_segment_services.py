import pytest
from sqlalchemy.orm import Session

from db_entities.assembly.segment import SpecificationStatus
from features.assembly.services.assembly import create_new_assembly_in_db
from features.assembly.services.layer import create_new_layer_in_db
from features.assembly.services.material import create_new_material
from features.assembly.services.segment import (
    LastSegmentInLayerException,
    SegmentNotFoundException,
    create_new_segment,
    delete_segment,
    get_segment_by_id,
    update_segment_is_continuous_insulation,
    update_segment_material,
    update_segment_notes,
    update_segment_specification_status,
    update_segment_steel_stud_spacing,
    update_segment_width,
)


def test_create_new_segment_in_db(session: Session, create_test_project):
    # Create a mock Project / Assembly / Layer / Material
    project = create_test_project(
        db=session, username="user1", project_name="Project 1"
    )
    assembly = create_new_assembly_in_db(
        db=session, name="A New Assembly", project_id=project.id
    )
    layer = create_new_layer_in_db(
        db=session, thickness_mm=50.0, assembly_id=assembly.id, order=1
    )
    material = create_new_material(
        db=session,
        id="a_new_material",
        name="A New Material",
        category="A New Category",
    )

    # Add them to the session
    session.add(assembly)
    session.add(layer)
    session.add(material)
    session.commit()

    # Call the function to create a new segment
    new_segment = create_new_segment(
        layer_id=layer.id, material_id=material.id, width_mm=125.0, order=1, db=session
    )

    # Assert that the segment is in the database
    db_segment = get_segment_by_id(session, new_segment.id)
    assert db_segment is not None
    assert db_segment.layer_id == layer.id
    assert db_segment.material_id == material.id
    assert db_segment.width_mm == 125.0
    assert db_segment.order == 1


def test_get_non_existent_segment_by_id_raises_Exception(session: Session):
    # Attempt to get a non-existent segment
    with pytest.raises(SegmentNotFoundException):
        get_segment_by_id(session, 99999)


def test_update_segment_material(session: Session, create_test_project):
    project = create_test_project(
        db=session, username="user1", project_name="Project 1"
    )
    existing_segment = get_segment_by_id(session, 1)
    new_material = create_new_material(
        db=session, id="new_material", name="New Material", category="New Category"
    )
    session.add(new_material)
    session.commit()

    # Update the segment's material
    update_segment_material(
        segment_id=existing_segment.id, material_id=new_material.id, db=session
    )

    # Fetch the updated segment
    updated_segment = get_segment_by_id(session, existing_segment.id)
    assert updated_segment.material_id == new_material.id


def test_update_segment_width(session: Session, create_test_project):
    project = create_test_project(
        db=session, username="user1", project_name="Project 1"
    )
    existing_segment = get_segment_by_id(session, 1)

    # Update the segment's width
    new_width_mm = 150.0
    update_segment_width(
        segment_id=existing_segment.id, width_mm=new_width_mm, db=session
    )
    session.commit()

    # Fetch the updated segment
    updated_segment = get_segment_by_id(session, existing_segment.id)
    assert updated_segment.width_mm == new_width_mm


def test_update_segment_steel_stud_spacing(session: Session, create_test_project):
    project = create_test_project(
        db=session, username="user1", project_name="Project 1"
    )
    existing_segment = get_segment_by_id(session, 1)

    # --- Try with a numeric value
    # Update the segment's steel stud spacing
    new_spacing_mm = 600.0
    update_segment_steel_stud_spacing(
        segment_id=existing_segment.id, steel_stud_spacing_mm=new_spacing_mm, db=session
    )

    # Fetch the updated segment
    updated_segment = get_segment_by_id(session, existing_segment.id)
    assert updated_segment.steel_stud_spacing_mm == new_spacing_mm

    # --- Try with None
    new_spacing_mm = None
    update_segment_steel_stud_spacing(
        segment_id=existing_segment.id, steel_stud_spacing_mm=new_spacing_mm, db=session
    )
    # Fetch the updated segment
    updated_segment = get_segment_by_id(session, existing_segment.id)
    assert updated_segment.steel_stud_spacing_mm is None


def test_update_segment_is_continuous_insulation(session: Session, create_test_project):
    project = create_test_project(
        db=session, username="user1", project_name="Project 1"
    )
    existing_segment = get_segment_by_id(session, 1)

    # --- Try with True
    # Update the segment's is_continuous_insulation
    update_segment_is_continuous_insulation(
        segment_id=existing_segment.id, is_continuous_insulation=True, db=session
    )

    # Fetch the updated segment
    updated_segment = get_segment_by_id(session, existing_segment.id)
    assert updated_segment.is_continuous_insulation is True

    # --- Try with False
    update_segment_is_continuous_insulation(
        segment_id=existing_segment.id, is_continuous_insulation=False, db=session
    )
    # Fetch the updated segment
    updated_segment = get_segment_by_id(session, existing_segment.id)
    assert updated_segment.is_continuous_insulation is False


def test_update_segment_specification_status(session: Session, create_test_project):
    project = create_test_project(
        db=session, username="user1", project_name="Project 1"
    )
    existing_segment = get_segment_by_id(session, 1)

    # --- Try with COMPLET
    new_status = SpecificationStatus.COMPLETE.value
    updated_segment = update_segment_specification_status(
        segment_id=existing_segment.id, specification_status=new_status, db=session
    )
    assert updated_segment.specification_status == SpecificationStatus.COMPLETE.value

    # --- Try with MISSING
    new_status = SpecificationStatus.MISSING.value
    updated_segment = update_segment_specification_status(
        segment_id=existing_segment.id, specification_status=new_status, db=session
    )
    assert updated_segment.specification_status == SpecificationStatus.MISSING.value

    # -- Try with QUESTION
    new_status = SpecificationStatus.QUESTION.value
    updated_segment = update_segment_specification_status(
        segment_id=existing_segment.id, specification_status=new_status, db=session
    )
    assert updated_segment.specification_status == SpecificationStatus.QUESTION.value

    # -- Try with NA
    new_status = SpecificationStatus.NA.value
    updated_segment = update_segment_specification_status(
        segment_id=existing_segment.id, specification_status=new_status, db=session
    )
    assert updated_segment.specification_status == SpecificationStatus.NA.value


def test_update_segment_specification_status_invalid(
    session: Session, create_test_project
):
    project = create_test_project(
        db=session, username="user1", project_name="Project 1"
    )
    existing_segment = get_segment_by_id(session, 1)
    assert existing_segment.specification_status == SpecificationStatus.NA.value

    # -- Invalid status should raise a ValueError
    with pytest.raises(ValueError):
        update_segment_specification_status(
            segment_id=existing_segment.id,
            specification_status="INVALID_STATUS",
            db=session,
        )
    # Status should not change
    assert existing_segment.specification_status == SpecificationStatus.NA.value


def test_update_segment_notes(session: Session, create_test_project):
    project = create_test_project(
        db=session, username="user1", project_name="Project 1"
    )
    existing_segment = get_segment_by_id(session, 1)

    # --- Try with a note
    new_notes = "This is a test note."
    updated_segment = update_segment_notes(
        segment_id=existing_segment.id, notes=new_notes, db=session
    )
    assert updated_segment.notes == new_notes

    # --- Try with None
    updated_segment = update_segment_notes(
        segment_id=existing_segment.id, notes=None, db=session
    )
    assert updated_segment.notes is None


def test_delete_segment(session: Session, create_test_project):
    project = create_test_project(
        db=session, username="user1", project_name="Project 1"
    )

    # Add a new segment so we can delete it later
    new_segment = create_new_segment(
        layer_id=1, material_id="test_material", width_mm=125.0, order=1, db=session
    )
    session.add(new_segment)
    session.commit()
    session.refresh(new_segment)

    # Assert that the segment is created and added
    db_segment = get_segment_by_id(session, new_segment.id)
    assert db_segment is not None
    assert db_segment.layer_id == 1
    assert db_segment.material_id == "test_material"
    assert db_segment.width_mm == 125.0
    assert db_segment.order == 1
    assert db_segment.id == new_segment.id

    # Delete the segment
    deleted_segment = delete_segment(db=session, segment_id=new_segment.id)

    # Assert that the segment is deleted
    with pytest.raises(SegmentNotFoundException):
        get_segment_by_id(session, deleted_segment.id)


def test_delete_last_layer_raises_LastSegmentInLayerException(
    session: Session, create_test_project
):
    project = create_test_project(
        db=session, username="user1", project_name="Project 1"
    )

    # Attempt to delete the last segment in a layer
    with pytest.raises(LastSegmentInLayerException):
        delete_segment(
            db=session, segment_id=1
        )  # Assuming segment with ID 1 is the last in its layer

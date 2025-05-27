import pytest
from sqlalchemy.orm import Session

from features.assembly.services.assembly import get_assembly_by_id
from features.assembly.services.layer import (
    LastLayerAssemblyException,
    LayerNotFoundException,
    create_new_layer,
    delete_layer,
    get_layer_by_id,
    update_layer_thickness,
)
from features.assembly.services.material import get_default_material
from features.assembly.services.segment import SegmentNotFoundException, create_new_segment, get_segment_by_id


def test_create_new_layer(session: Session, create_test_project):
    create_test_project(db=session, username="user1", project_name="Project 1")
    new_layer = create_new_layer(db=session, assembly_id=1, thickness_mm=150.0, order=2)

    # Get the newly created layer back out
    existing_layer = get_layer_by_id(session, new_layer.id)
    assert existing_layer.id == 2
    assert existing_layer.assembly_id == 1
    assert existing_layer.thickness_mm == 150.0
    assert existing_layer.order == 2


def test_get_valid_layer_by_id(session: Session, create_test_project):
    create_test_project(db=session, username="user1", project_name="Project 1")

    # Fetch an existing layer
    existing_layer = get_layer_by_id(session, 1)
    assert existing_layer.id == 1
    assert existing_layer.thickness_mm == 50.0
    assert existing_layer.assembly_id == 1


def test_get_invalid_layer_by_id(session: Session, create_test_project):
    create_test_project(db=session, username="user1", project_name="Project 1")

    # Attempt to fetch a non-existing layer
    with pytest.raises(LayerNotFoundException):
        get_layer_by_id(session, 999)


def test_update_layer_thickness(session: Session, create_test_project):
    create_test_project(db=session, username="user1", project_name="Project 1")

    # Test before the update
    fetched_layer = get_layer_by_id(session, 1)
    assert fetched_layer.thickness_mm == 50.0

    # Update the thickness of an existing layer
    updated_layer = update_layer_thickness(session, 1, 75.0)
    assert updated_layer.id == 1
    assert updated_layer.thickness_mm == 75.0

    # Verify the change by fetching the layer again
    fetched_layer = get_layer_by_id(session, 1)
    assert fetched_layer.thickness_mm == 75.0


def test_delete_layer_with_no_segments(session: Session, create_test_project):
    create_test_project(db=session, username="user1", project_name="Project 1")
    new_layer = create_new_layer(db=session, assembly_id=1, thickness_mm=150.0, order=2)
    existing_assembly = get_assembly_by_id(session, 1)
    assert len(existing_assembly.layers) == 2

    # Delete the second layer
    delete_layer(session, new_layer.id)
    assert len(existing_assembly.layers) == 1

    # Verify the layer is deleted
    with pytest.raises(LayerNotFoundException):
        get_layer_by_id(session, new_layer.id)

    # Verify that the assembly still exists
    assembly = get_assembly_by_id(session, 1)
    assert assembly is not None


def test_delete_layer_with_segments(session: Session, create_test_project):
    create_test_project(db=session, username="user1", project_name="Project 1")
    new_layer = create_new_layer(db=session, assembly_id=1, thickness_mm=150.0, order=2)

    # Add segments to the layer
    mat = get_default_material(session)
    seg_1 = create_new_segment(session, new_layer.id, mat.id, 100.0, 0)
    seg_2 = create_new_segment(session, new_layer.id, mat.id, 200.0, 1)

    existing_assembly = get_assembly_by_id(session, 1)
    assert len(existing_assembly.layers) == 2
    assert len(new_layer.segments) == 2

    # Delete the layer with segments
    delete_layer(session, new_layer.id)

    # Verify the layer is deleted
    with pytest.raises(LayerNotFoundException):
        get_layer_by_id(session, new_layer.id)

    # Verify that the assembly still exists
    assembly = get_assembly_by_id(session, 1)
    assert assembly is not None
    assert len(assembly.layers) == 1

    # Verify that the segments are also deleted
    with pytest.raises(SegmentNotFoundException):
        get_segment_by_id(session, seg_1.id)

    with pytest.raises(SegmentNotFoundException):
        get_segment_by_id(session, seg_2.id)


def test_delete_last_layer_raises_exception(session: Session, create_test_project):
    create_test_project(db=session, username="user1", project_name="Project 1")

    assert len(get_assembly_by_id(session, 1).layers) == 1

    # Attempt to delete the last layer in the assembly
    with pytest.raises(LastLayerAssemblyException):
        delete_layer(session, 1)

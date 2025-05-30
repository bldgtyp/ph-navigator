# -*- Python Version: 3.11 -*-

from copy import copy

import pytest
from sqlalchemy.orm import Session

from features.assembly.services.assembly import (
    AssemblyNotFoundException,
    append_default_layer_to_assembly,
    append_layer_to_assembly,
    create_new_default_assembly_on_project,
    create_new_empty_assembly_on_project,
    delete_assembly,
    get_assembly_by_id,
    insert_default_layer_into_assembly,
    insert_layer_into_assembly,
    update_assembly_name,
)
from features.assembly.services.layer import (
    LastLayerAssemblyException,
    LayerNotFoundException,
    create_new_layer,
    delete_layer,
    get_layer_by_id,
    update_layer_thickness,
)


def test_get_existing_assembly_by_id(session, create_test_project):
    create_test_project(db=session, username="user1", project_name="Project 1")

    # Fetch an existing assembly
    assembly = get_assembly_by_id(session, 1)
    assert assembly.id == 1
    assert assembly.name == "Test Assembly"
    assert assembly.project_id == 1


def test_get_non_existing_assembly_by_id(session, create_test_project):
    create_test_project(db=session, username="user1", project_name="Project 1")

    # Attempt to fetch a non-existing assembly
    with pytest.raises(AssemblyNotFoundException):
        get_assembly_by_id(session, 999)


def test_create_new_empty_assembly(session, create_test_project):
    project = create_test_project(db=session, username="user1", project_name="Project 1")
    assert len(project.assemblies) == 1  # Initial assembly created by default

    # Create a new assembly
    new_assembly = create_new_empty_assembly_on_project(session, "New Assembly", 1)

    # Check if the assembly is created correctly
    assert len(project.assemblies) == 2
    assert new_assembly.id == 2
    assert new_assembly.name == "New Assembly"
    assert len(new_assembly.layers) == 0  # No layers initially


def test_create_new_default_assembly(session, create_test_project):
    project = create_test_project(db=session, username="user1", project_name="Project 1")
    assert len(project.assemblies) == 1  # Initial assembly created by default

    # Create a new default assembly
    new_assembly = create_new_default_assembly_on_project(session, "1234")

    # Check if the assembly is created correctly
    assert len(project.assemblies) == 2
    assert new_assembly.id == 2
    assert new_assembly.name == "Unnamed Assembly"
    assert len(new_assembly.layers) == 1


def test_insert_new_layer_into_assembly(session: Session, create_test_project):
    create_test_project(db=session, username="user1", project_name="Project 1")
    assembly = get_assembly_by_id(session, 1)
    assert len(assembly.layers) == 1  # Initial layer created by default
    assert assembly.layers[0].order == 0  # Initial layer order is 0

    # Build up the Assembly with 3 new layers
    layer_1 = create_new_layer(thickness_mm=100.0, order=1)
    assembly, layer_1 = insert_layer_into_assembly(session, assembly.id, layer_1)
    assert assembly.layers[1].order == 1

    layer_2 = create_new_layer(thickness_mm=100.0, order=2)
    assembly, layer_2 = insert_layer_into_assembly(session, assembly.id, layer_2)
    assert assembly.layers[2].order == 2

    layer_3 = create_new_layer(thickness_mm=100.0, order=3)
    assembly, layer_3 = insert_layer_into_assembly(session, assembly.id, layer_3)
    assert assembly.layers[3].order == 3

    assert len(assembly.layers) == 4  # Initial layer + 3 new layers

    layer_to_insert = create_new_layer(thickness_mm=100.0, order=2)
    assembly, layer_to_insert = insert_layer_into_assembly(session, assembly.id, layer_to_insert)

    # Verify the order of layers after insertion
    assert len(assembly.layers) == 5
    assert assembly.layers[0].order == 0

    assert assembly.layers[1].order == 1
    assert assembly.layers[1].id == layer_1.id

    assert assembly.layers[2].order == 2
    assert assembly.layers[2].id == layer_to_insert.id  # <-- This is the newly inserted layer

    # Layers should be shifted
    assert assembly.layers[3].order == 3
    assert assembly.layers[3].id == layer_2.id

    assert assembly.layers[4].order == 4
    assert assembly.layers[4].id == layer_3.id


def test_append_new_layer_to_assembly(session: Session, create_test_project):
    create_test_project(db=session, username="user1", project_name="Project 1")
    assembly = get_assembly_by_id(session, 1)

    # Check the initial state of the assembly Layers
    assert len(assembly.layers) == 1
    assert assembly.layers[0].id == 1
    assert assembly.layers[0].assembly_id == assembly.id
    assert assembly.layers[0].thickness_mm == 50.0
    assert assembly.layers[0].order == 0

    new_layer = create_new_layer(thickness_mm=150.0)

    # Verify the new layer is created correctly
    assert new_layer.id is None
    assert new_layer.assembly_id is None
    assert new_layer.thickness_mm == 150.0
    assert new_layer.order == 0

    # Append the new layer to the assembly
    assembly, new_layer = append_layer_to_assembly(session, assembly.id, new_layer)
    assert len(assembly.layers) == 2

    # Ensure the first layer didn't change
    assert assembly.layers[0].id == 1
    assert assembly.layers[0].assembly_id == assembly.id
    assert assembly.layers[0].thickness_mm == 50.0
    assert assembly.layers[0].order == 0

    # Check the new layer was added at the end
    assert assembly.layers[1].id == 2
    assert assembly.layers[1].assembly_id == assembly.id
    assert assembly.layers[1].thickness_mm == 150.0
    assert assembly.layers[1].order == 1


def test_insert_default_layer_into_assembly(session, create_test_project):
    create_test_project(db=session, username="user1", project_name="Project 1")
    assembly = get_assembly_by_id(session, 1)
    assert len(assembly.layers) == 1  # Initial layer created by default
    assert assembly.layers[0].order == 0  # Initial layer order is 0

    # Build up the Assembly with 3 new layers
    layer_1 = create_new_layer(thickness_mm=100.0, order=1)
    assembly, layer_1 = insert_layer_into_assembly(session, assembly.id, layer_1)
    assert assembly.layers[1].order == 1

    layer_2 = create_new_layer(thickness_mm=100.0, order=2)
    assembly, layer_2 = insert_layer_into_assembly(session, assembly.id, layer_2)
    assert assembly.layers[2].order == 2

    layer_3 = create_new_layer(thickness_mm=100.0, order=3)
    assembly, layer_3 = insert_layer_into_assembly(session, assembly.id, layer_3)
    assert assembly.layers[3].order == 3

    assert len(assembly.layers) == 4  # Initial layer + 3 new layers

    assembly, layer_to_insert = insert_default_layer_into_assembly(session, assembly.id, 2)

    # Verify the order of layers after insertion
    assert len(assembly.layers) == 5
    assert assembly.layers[0].order == 0

    assert assembly.layers[1].order == 1
    assert assembly.layers[1].id == layer_1.id

    assert assembly.layers[2].order == 2
    assert assembly.layers[2].id == layer_to_insert.id  # <-- This is the newly inserted layer

    # Layers should be shifted
    assert assembly.layers[3].order == 3
    assert assembly.layers[3].id == layer_2.id

    assert assembly.layers[4].order == 4
    assert assembly.layers[4].id == layer_3.id


def test_append_default_layer_to_assembly(session, create_test_project):
    create_test_project(db=session, username="user1", project_name="Project 1")
    assembly = get_assembly_by_id(session, 1)

    # Check the initial state of the assembly Layers
    assert len(assembly.layers) == 1
    assert assembly.layers[0].id == 1
    assert assembly.layers[0].assembly_id == assembly.id
    assert assembly.layers[0].thickness_mm == 50.0
    assert assembly.layers[0].order == 0

    # Append a new default layer to the assembly
    assembly, new_layer = append_default_layer_to_assembly(session, assembly.id)
    assert len(assembly.layers) == 2

    # Ensure the first layer didn't change
    assert assembly.layers[0].id == 1
    assert assembly.layers[0].assembly_id == assembly.id
    assert assembly.layers[0].thickness_mm == 50.0
    assert assembly.layers[0].order == 0

    # Check the new default layer was added at the end
    assert assembly.layers[1].id == 2
    assert assembly.layers[1].assembly_id == assembly.id
    assert assembly.layers[1].thickness_mm == 50.0
    assert assembly.layers[1].order == 1


def test_delete_last_layer_raises_exception(session, create_test_project):
    create_test_project(db=session, username="user1", project_name="Project 1")
    assembly = get_assembly_by_id(session, 1)
    assert len(assembly.layers) == 1  # Initial layer created by default
    assert assembly.layers[0].order == 0  # Initial layer order is 0

    # Attempt to delete the last layer
    with pytest.raises(LastLayerAssemblyException):
        delete_layer(session, assembly.layers[0].id)

    # Verify the layer still exists
    assert len(assembly.layers) == 1
    assert assembly.layers[0].id == 1


def test_delete_second_layer(session, create_test_project):
    create_test_project(db=session, username="user1", project_name="Project 1")
    assembly = get_assembly_by_id(session, 1)
    assert len(assembly.layers) == 1  # Initial layer created by default
    assert assembly.layers[0].order == 0  # Initial layer order is 0

    # Add a second layer
    layer_1 = create_new_layer(thickness_mm=100.0, order=1)
    assembly, layer_1 = insert_layer_into_assembly(session, assembly.id, layer_1)
    assert assembly.layers[1].order == 1

    delete_layer(session, layer_1.id)

    # Verify the layer is deleted
    with pytest.raises(LayerNotFoundException):
        get_layer_by_id(session, layer_1.id)


def test_delete_middle_layer(session, create_test_project):
    create_test_project(db=session, username="user1", project_name="Project 1")
    assembly = get_assembly_by_id(session, 1)
    assert len(assembly.layers) == 1  # Initial layer created by default
    assert assembly.layers[0].order == 0  # Initial layer order is 0

    # Add a second layer
    layer_1 = create_new_layer(thickness_mm=100.0)
    assembly, layer_1 = append_layer_to_assembly(session, assembly.id, layer_1)
    assert assembly.layers[1].order == 1

    # Add a third layer
    layer_2 = create_new_layer(thickness_mm=100.0)
    assembly, layer_2 = append_layer_to_assembly(session, assembly.id, layer_2)
    assert assembly.layers[2].order == 2

    # Add a fourth layer
    layer_3 = create_new_layer(thickness_mm=100.0)
    assembly, layer_3 = append_layer_to_assembly(session, assembly.id, layer_3)
    assert assembly.layers[3].order == 3

    delete_layer(session, layer_1.id)

    # Verify the layer is deleted
    with pytest.raises(LayerNotFoundException):
        get_layer_by_id(session, layer_1.id)

    # Verify the order of remaining layers
    assert len(assembly.layers) == 3
    # First layer remains unchanged
    assert assembly.layers[0].order == 0
    assert assembly.layers[0].id == 1

    # Update Layer 2
    assert assembly.layers[1].order == 1
    assert assembly.layers[1].id == layer_2.id

    # Updated Layer 3
    assert assembly.layers[2].order == 2
    assert assembly.layers[2].id == layer_3.id


def test_update_assembly_name(session, create_test_project):
    create_test_project(db=session, username="user1", project_name="Project 1")
    assembly = get_assembly_by_id(session, 1)

    # Check initial name
    assert assembly.name == "Test Assembly"

    # Update the assembly name
    updated_assembly = update_assembly_name(session, assembly.id, "Updated Assembly Name")

    # Verify the name is updated
    assert updated_assembly.name == "Updated Assembly Name"

    # Fetch the assembly again to ensure the name is persisted
    fetched_assembly = get_assembly_by_id(session, assembly.id)
    assert fetched_assembly.name == "Updated Assembly Name"


def test_delete_assembly(session, create_test_project):
    create_test_project(db=session, username="user1", project_name="Project 1")
    assembly = get_assembly_by_id(session, 1)

    # Check initial state
    assert assembly.id == 1
    assert assembly.name == "Test Assembly"

    # Delete the assembly
    delete_assembly(session, assembly.id)

    # Verify the assembly is deleted
    with pytest.raises(AssemblyNotFoundException):
        get_assembly_by_id(session, assembly.id)

    # Verify the layer is also deleted
    with pytest.raises(LayerNotFoundException):
        get_layer_by_id(session, 1)

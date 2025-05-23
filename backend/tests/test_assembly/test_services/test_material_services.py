import pytest
from sqlalchemy.orm import Session

from db_entities.assembly import Material
from features.assembly.services.material import (
    MaterialNotFoundException,
    add_materials_to_db,
    create_new_material_in_db,
    get_material_by_id,
    update_material_in_db,
)


def test_add_new_material_to_db(session: Session):
    new_material = create_new_material_in_db(
        session,
        id="test_material_id",
        name="test_material",
        category="test_category",
    )

    assert new_material.id == "test_material_id"
    assert new_material.name == "test_material"
    assert new_material.category == "test_category"


def test_update_existing_material_in_db(session: Session):
    # Add a material to the session
    material = create_new_material_in_db(
        session,
        id="test_material_id",
        name="test_material",
        category="test_category",
    )

    # Update the material
    updated_material = update_material_in_db(
        session,
        id=material.id,
        name="updated_test_material",
        category="updated_test_category",
    )

    assert updated_material.id == "test_material_id"
    assert updated_material.name == "updated_test_material"
    assert updated_material.category == "updated_test_category"


def test_get_existing_material_by_id(session: Session):
    # Add a material to the session
    material = create_new_material_in_db(
        session,
        id="test_material_id",
        name="test_material",
        category="test_category",
    )

    # Fetch the material by ID
    fetched_material = get_material_by_id("test_material_id", session)

    assert fetched_material.id == material.id
    assert fetched_material.name == material.name
    assert fetched_material.category == material.category


def test_get_non_existing_material_by_id_raises_MaterialNotFoundException(
    session: Session,
):
    with pytest.raises(MaterialNotFoundException):
        get_material_by_id("non_existing_material_id", session)


def test_update_non_existing_material_raises_MaterialNotFoundException(
    session: Session,
):
    with pytest.raises(MaterialNotFoundException):
        update_material_in_db(
            session,
            id="non_existing_material_id",
            name="updated_test_material",
            category="updated_test_category",
        )


def test_add_list_of_new_materials_to_db_adds_them(session: Session):
    materials = [
        Material(
            id="material_1",
            name="Material 1",
            category="Category 1",
        ),
        Material(
            id="material_2",
            name="Material 2",
            category="Category 2",
        ),
    ]

    add_materials_to_db(session, materials)

    # Verify that the materials were added
    added_material_1 = get_material_by_id("material_1", session)
    assert added_material_1.name == "Material 1"
    assert added_material_1.category == "Category 1"

    added_material_2 = get_material_by_id("material_2", session)
    assert added_material_2.name == "Material 2"
    assert added_material_2.category == "Category 2"


def test_add_list_of_existing_materials_to_db_updates_them(session: Session):
    # Add a material to the session
    create_new_material_in_db(
        session,
        id="material_1",
        name="Material 1",
        category="Category 1",
    )

    # Verify
    existing_material = get_material_by_id("material_1", session)
    assert existing_material.name == "Material 1"
    assert existing_material.category == "Category 1"

    materials = [
        Material(
            id="material_1",
            name="Material 1",
            category="Updated Category 1",
        ),
        Material(
            id="material_2",
            name="Material 2",
            category="Category 2",
        ),
    ]

    add_materials_to_db(session, materials)

    # Verify that the existing material was updated
    updated_material_1 = get_material_by_id("material_1", session)
    assert updated_material_1.name == "Material 1"
    assert updated_material_1.category == "Updated Category 1"

    # Verify that the new material was added
    added_material_2 = get_material_by_id("material_2", session)
    assert added_material_2.name == "Material 2"
    assert added_material_2.category == "Category 2"

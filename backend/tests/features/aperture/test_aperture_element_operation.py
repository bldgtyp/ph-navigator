# -*- Python Version: 3.11 -*-
"""Tests for aperture element operation (swing/slide/fixed) functionality."""

import pytest
from db_entities.aperture import Aperture
from features.aperture.services.aperture import (
    duplicate_aperture,
    update_aperture_element_operation,
)
from sqlalchemy.orm import Session


def test_update_element_operation_to_swing(
    test_db: Session, sample_aperture_with_elements: Aperture
):
    """Test updating an element operation to swing with a direction."""
    element = sample_aperture_with_elements.elements[0]

    operation = {"type": "swing", "directions": ["left"]}
    updated_aperture = update_aperture_element_operation(test_db, element.id, operation)

    updated_element = updated_aperture.elements[0]
    assert updated_element.operation is not None
    assert updated_element.operation["type"] == "swing"
    assert updated_element.operation["directions"] == ["left"]


def test_update_element_operation_to_slide(
    test_db: Session, sample_aperture_with_elements: Aperture
):
    """Test updating an element operation to slide with a direction."""
    element = sample_aperture_with_elements.elements[0]

    operation = {"type": "slide", "directions": ["right"]}
    updated_aperture = update_aperture_element_operation(test_db, element.id, operation)

    updated_element = updated_aperture.elements[0]
    assert updated_element.operation is not None
    assert updated_element.operation["type"] == "slide"
    assert updated_element.operation["directions"] == ["right"]


def test_update_element_operation_multiple_directions(
    test_db: Session, sample_aperture_with_elements: Aperture
):
    """Test updating an element operation with multiple directions (tilt-turn)."""
    element = sample_aperture_with_elements.elements[0]

    operation = {"type": "swing", "directions": ["left", "up"]}
    updated_aperture = update_aperture_element_operation(test_db, element.id, operation)

    updated_element = updated_aperture.elements[0]
    assert updated_element.operation is not None
    assert updated_element.operation["type"] == "swing"
    assert set(updated_element.operation["directions"]) == {"left", "up"}


def test_update_element_operation_to_fixed(
    test_db: Session, sample_aperture_with_elements: Aperture
):
    """Test updating an element operation back to fixed (null)."""
    element = sample_aperture_with_elements.elements[0]

    # First set to swing
    operation = {"type": "swing", "directions": ["left"]}
    update_aperture_element_operation(test_db, element.id, operation)

    # Then set back to fixed
    updated_aperture = update_aperture_element_operation(test_db, element.id, None)

    updated_element = updated_aperture.elements[0]
    assert updated_element.operation is None


def test_element_operation_persists_after_refresh(
    test_db: Session, sample_aperture_with_elements: Aperture
):
    """Test that element operation persists after database refresh."""
    element = sample_aperture_with_elements.elements[0]

    operation = {"type": "swing", "directions": ["left"]}
    update_aperture_element_operation(test_db, element.id, operation)

    # Refresh the aperture from database
    test_db.refresh(sample_aperture_with_elements)

    refreshed_element = sample_aperture_with_elements.elements[0]
    assert refreshed_element.operation is not None
    assert refreshed_element.operation["type"] == "swing"
    assert refreshed_element.operation["directions"] == ["left"]


def test_duplicate_aperture_copies_operation(
    test_db: Session, sample_aperture_with_elements: Aperture
):
    """Test that duplicating an aperture copies element operations."""
    element = sample_aperture_with_elements.elements[0]

    # Set operation on source element
    operation = {"type": "swing", "directions": ["left", "up"]}
    update_aperture_element_operation(test_db, element.id, operation)
    test_db.refresh(sample_aperture_with_elements)

    # Duplicate the aperture
    duplicated_aperture = duplicate_aperture(test_db, sample_aperture_with_elements.id)

    # Verify operation was copied
    duplicated_element = duplicated_aperture.elements[0]
    assert duplicated_element.operation is not None
    assert duplicated_element.operation["type"] == "swing"
    assert set(duplicated_element.operation["directions"]) == {"left", "up"}


def test_duplicate_aperture_operation_independence(
    test_db: Session, sample_aperture_with_elements: Aperture
):
    """Test that duplicated aperture operation is independent from original."""
    element = sample_aperture_with_elements.elements[0]

    # Set operation on source element
    operation = {"type": "swing", "directions": ["left"]}
    update_aperture_element_operation(test_db, element.id, operation)
    test_db.refresh(sample_aperture_with_elements)

    # Duplicate the aperture
    duplicated_aperture = duplicate_aperture(test_db, sample_aperture_with_elements.id)

    # Modify the duplicate's operation
    duplicated_element = duplicated_aperture.elements[0]
    update_aperture_element_operation(
        test_db, duplicated_element.id, {"type": "slide", "directions": ["right"]}
    )

    # Verify original is unchanged
    test_db.refresh(sample_aperture_with_elements)
    original_element = sample_aperture_with_elements.elements[0]
    assert original_element.operation["type"] == "swing"
    assert original_element.operation["directions"] == ["left"]

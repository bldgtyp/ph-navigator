# -*- Python Version: 3.11 -*-
"""Tests for aperture duplication functionality."""

import pytest
from db_entities.aperture import Aperture
from features.aperture.services.aperture import duplicate_aperture
from features.aperture.services.aperture_element import (
    duplicate_aperture_element,
    duplicate_aperture_element_frame,
    duplicate_aperture_element_glazing,
)
from sqlalchemy.orm import Session


def test_duplicate_aperture_element_frame(
    test_db: Session, sample_aperture_with_elements: Aperture
):
    """Test duplicating a single frame element."""
    # Get a frame from the sample aperture
    source_element = sample_aperture_with_elements.elements[0]
    source_frame = source_element.frame_top

    # Duplicate the frame
    duplicated_frame = duplicate_aperture_element_frame(test_db, source_frame)

    # Verify properties were copied
    assert duplicated_frame.name == source_frame.name
    assert duplicated_frame.frame_type_id == source_frame.frame_type_id

    # Verify it's a new object with different ID
    assert duplicated_frame.id != source_frame.id


def test_duplicate_aperture_element_glazing(
    test_db: Session, sample_aperture_with_elements: Aperture
):
    """Test duplicating a single glazing element."""
    # Get glazing from the sample aperture
    source_element = sample_aperture_with_elements.elements[0]
    source_glazing = source_element.glazing

    # Duplicate the glazing
    duplicated_glazing = duplicate_aperture_element_glazing(test_db, source_glazing)

    # Verify properties were copied
    assert duplicated_glazing.name == source_glazing.name
    assert duplicated_glazing.glazing_type_id == source_glazing.glazing_type_id

    # Verify it's a new object with different ID
    assert duplicated_glazing.id != source_glazing.id


def test_duplicate_aperture_element(
    test_db: Session, sample_aperture_with_elements: Aperture
):
    """Test duplicating a complete aperture element with all frames and glazing."""
    source_element = sample_aperture_with_elements.elements[0]

    # Duplicate the element
    duplicated_element = duplicate_aperture_element(
        test_db, source_element, sample_aperture_with_elements.id
    )

    # Verify element properties were copied
    assert duplicated_element.name == source_element.name
    assert duplicated_element.row_number == source_element.row_number
    assert duplicated_element.column_number == source_element.column_number
    assert duplicated_element.row_span == source_element.row_span
    assert duplicated_element.col_span == source_element.col_span
    assert duplicated_element.aperture_id == sample_aperture_with_elements.id

    # Verify it's a new element
    assert duplicated_element.id != source_element.id

    # Verify frames were duplicated
    assert duplicated_element.frame_top.id != source_element.frame_top.id
    assert duplicated_element.frame_right.id != source_element.frame_right.id
    assert duplicated_element.frame_bottom.id != source_element.frame_bottom.id
    assert duplicated_element.frame_left.id != source_element.frame_left.id

    # Verify frame properties match
    assert (
        duplicated_element.frame_top.frame_type_id
        == source_element.frame_top.frame_type_id
    )

    # Verify glazing was duplicated
    assert duplicated_element.glazing.id != source_element.glazing.id
    assert (
        duplicated_element.glazing.glazing_type_id
        == source_element.glazing.glazing_type_id
    )


def test_duplicate_aperture_simple(
    test_db: Session, sample_aperture_with_elements: Aperture
):
    """Test duplicating a simple aperture with one element."""
    source_aperture = sample_aperture_with_elements

    # Duplicate the aperture
    duplicated_aperture = duplicate_aperture(test_db, source_aperture.id)

    # Verify aperture properties
    assert duplicated_aperture.name == f"{source_aperture.name} (Copy)"
    assert duplicated_aperture.project_id == source_aperture.project_id
    assert duplicated_aperture.row_heights_mm == source_aperture.row_heights_mm
    assert duplicated_aperture.column_widths_mm == source_aperture.column_widths_mm

    # Verify it's a new aperture
    assert duplicated_aperture.id != source_aperture.id

    # Verify elements were duplicated
    assert len(duplicated_aperture.elements) == len(source_aperture.elements)

    # Verify element independence
    for dup_elem, src_elem in zip(
        duplicated_aperture.elements, source_aperture.elements
    ):
        assert dup_elem.id != src_elem.id
        assert dup_elem.name == src_elem.name


def test_duplicate_aperture_not_found(test_db: Session):
    """Test that duplicating a non-existent aperture raises ValueError."""
    with pytest.raises(ValueError, match="not found"):
        duplicate_aperture(test_db, 99999)


def test_duplicate_aperture_independence(
    test_db: Session, sample_aperture_with_elements: Aperture
):
    """Test that duplicated aperture is independent from the original."""
    source_aperture = sample_aperture_with_elements
    original_name = source_aperture.name

    # Duplicate the aperture
    duplicated_aperture = duplicate_aperture(test_db, source_aperture.id)

    # Modify the source aperture
    source_aperture.name = "Modified Original"
    test_db.commit()

    # Verify duplicated aperture is unchanged
    test_db.refresh(duplicated_aperture)
    assert duplicated_aperture.name == f"{original_name} (Copy)"

    # Modify the duplicated aperture
    duplicated_aperture.row_heights_mm = [2000.0]
    test_db.commit()

    # Verify original is unchanged
    test_db.refresh(source_aperture)
    assert source_aperture.row_heights_mm != [2000.0]

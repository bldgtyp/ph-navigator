# -*- Python Version: 3.11 -*-
"""Fixtures for aperture tests."""

from typing import Generator

import pytest
from db_entities.aperture.aperture import Aperture
from db_entities.aperture.aperture_element import ApertureElement
from db_entities.aperture.aperture_frame import ApertureElementFrame
from db_entities.aperture.aperture_glazing import ApertureElementGlazing
from db_entities.aperture.frame_type import ApertureFrameType
from db_entities.aperture.glazing_type import ApertureGlazingType
from db_entities.app.project import Project
from db_entities.app.user import User
from features.auth.services import get_password_hash
from sqlalchemy.orm import Session


@pytest.fixture(scope="function")
def test_db(session: Session) -> Generator[Session, None, None]:
    """Alias for the session fixture to match test expectations."""
    yield session


@pytest.fixture(scope="function")
def sample_aperture_with_elements(test_db: Session) -> Aperture:
    """Create a sample aperture with elements, frames, and glazing for testing."""
    # Create a test user
    user = User(
        username="test_aperture_user",
        email="aperture_test@example.com",
        hashed_password=get_password_hash("test123"),
    )
    test_db.add(user)
    test_db.flush()

    # Create a test project
    project = Project(
        name="Test Aperture Project",
        bt_number="AP001",
        owner_id=user.id,
    )
    test_db.add(project)
    test_db.flush()

    # Create frame type
    frame_type = ApertureFrameType(
        id="test_frame_type",
        name="Test Frame Type",
        width_mm=100.0,
        u_value_w_m2k=1.0,
        psi_g_w_mk=0.04,
    )
    test_db.add(frame_type)
    test_db.flush()

    # Create glazing type
    glazing_type = ApertureGlazingType(
        id="test_glazing_type",
        name="Test Glazing Type",
        u_value_w_m2k=1.0,
        g_value=0.5,
    )
    test_db.add(glazing_type)
    test_db.flush()

    # Create aperture
    aperture = Aperture(
        name="Test Aperture",
        project_id=project.id,
        row_heights_mm=[1000.0],
        column_widths_mm=[1000.0],
    )
    test_db.add(aperture)
    test_db.flush()

    # Create frames for the element
    frame_top = ApertureElementFrame(
        name="Top Frame",
        frame_type_id=frame_type.id,
    )
    frame_right = ApertureElementFrame(
        name="Right Frame",
        frame_type_id=frame_type.id,
    )
    frame_bottom = ApertureElementFrame(
        name="Bottom Frame",
        frame_type_id=frame_type.id,
    )
    frame_left = ApertureElementFrame(
        name="Left Frame",
        frame_type_id=frame_type.id,
    )
    test_db.add_all([frame_top, frame_right, frame_bottom, frame_left])
    test_db.flush()

    # Create glazing
    glazing = ApertureElementGlazing(
        name="Test Glazing",
        glazing_type_id=glazing_type.id,
    )
    test_db.add(glazing)
    test_db.flush()

    # Create aperture element
    element = ApertureElement(
        name="Test Element",
        aperture_id=aperture.id,
        row_number=1,
        column_number=1,
        row_span=1,
        col_span=1,
        frame_top_id=frame_top.id,
        frame_right_id=frame_right.id,
        frame_bottom_id=frame_bottom.id,
        frame_left_id=frame_left.id,
        glazing_id=glazing.id,
    )
    test_db.add(element)
    test_db.commit()

    # Refresh to load relationships
    test_db.refresh(aperture)

    return aperture

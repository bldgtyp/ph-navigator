# -*- Python Version: 3.11 -*-
"""Tests for bulk aperture element assignment updates."""

from sqlalchemy.orm import Session

from db_entities.aperture.frame_type import ApertureFrameType
from db_entities.aperture.glazing_type import ApertureGlazingType
from db_entities.aperture.aperture import Aperture
from features.aperture.services.aperture import update_aperture_element_assignments


def test_update_element_assignments(test_db: Session, sample_aperture_with_elements: Aperture):
    element = sample_aperture_with_elements.elements[0]

    new_frame_type = ApertureFrameType(
        id="test_frame_type_new",
        name="Test Frame Type New",
        width_mm=120.0,
        u_value_w_m2k=0.9,
        psi_g_w_mk=0.03,
    )
    new_glazing_type = ApertureGlazingType(
        id="test_glazing_type_new",
        name="Test Glazing Type New",
        u_value_w_m2k=0.8,
        g_value=0.45,
    )
    test_db.add_all([new_frame_type, new_glazing_type])
    test_db.commit()

    updated_aperture = update_aperture_element_assignments(
        test_db,
        element.id,
        {"type": "swing", "directions": ["left"]},
        new_glazing_type.id,
        {
            "top": new_frame_type.id,
            "right": new_frame_type.id,
            "bottom": new_frame_type.id,
            "left": new_frame_type.id,
        },
    )

    updated_element = updated_aperture.elements[0]
    assert updated_element.operation is not None
    assert updated_element.operation["type"] == "swing"
    assert updated_element.operation["directions"] == ["left"]
    assert updated_element.glazing.glazing_type.id == new_glazing_type.id
    assert updated_element.frame_top.frame_type_id == new_frame_type.id
    assert updated_element.frame_right.frame_type_id == new_frame_type.id
    assert updated_element.frame_bottom.frame_type_id == new_frame_type.id
    assert updated_element.frame_left.frame_type_id == new_frame_type.id

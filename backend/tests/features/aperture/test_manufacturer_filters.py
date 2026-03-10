# -*- Python Version: 3.11 -*-

from db_entities.aperture.aperture import Aperture
from db_entities.aperture.aperture_element import ApertureElement
from db_entities.aperture.aperture_frame import ApertureElementFrame
from db_entities.aperture.aperture_glazing import ApertureElementGlazing
from db_entities.aperture.frame_type import ApertureFrameType
from db_entities.aperture.glazing_type import ApertureGlazingType
from db_entities.app.project import Project
from db_entities.app.user import User
from fastapi.testclient import TestClient
from features.auth.services import get_password_hash
from sqlalchemy.orm import Session


def seed_project_with_used_types(session: Session) -> Project:
    user = User(
        username="filter_test_user",
        email="filter_test@example.com",
        hashed_password=get_password_hash("test123"),
    )
    session.add(user)
    session.flush()

    project = Project(
        name="Filter Test Project",
        bt_number="MF001",
        owner_id=user.id,
    )
    session.add(project)
    session.flush()

    frame_used = ApertureFrameType(
        id="frame_used",
        name="Alpen Frame",
        width_mm=100.0,
        u_value_w_m2k=1.0,
        psi_g_w_mk=0.04,
        manufacturer="Alpen",
    )
    frame_other = ApertureFrameType(
        id="frame_other",
        name="Internorm Frame",
        width_mm=100.0,
        u_value_w_m2k=1.0,
        psi_g_w_mk=0.04,
        manufacturer="Internorm",
    )
    session.add_all([frame_used, frame_other])
    session.flush()

    glazing_used = ApertureGlazingType(
        id="glazing_used",
        name="Guardian Glazing",
        u_value_w_m2k=1.0,
        g_value=0.5,
        manufacturer="Guardian",
    )
    glazing_other = ApertureGlazingType(
        id="glazing_other",
        name="Pilkington Glazing",
        u_value_w_m2k=1.0,
        g_value=0.5,
        manufacturer="Pilkington",
    )
    session.add_all([glazing_used, glazing_other])
    session.flush()

    aperture = Aperture(
        name="Test Aperture",
        project_id=project.id,
        row_heights_mm=[1000.0],
        column_widths_mm=[1000.0],
    )
    session.add(aperture)
    session.flush()

    frame_top = ApertureElementFrame(name="Top Frame", frame_type_id=frame_used.id)
    frame_right = ApertureElementFrame(name="Right Frame", frame_type_id=frame_used.id)
    frame_bottom = ApertureElementFrame(
        name="Bottom Frame", frame_type_id=frame_used.id
    )
    frame_left = ApertureElementFrame(name="Left Frame", frame_type_id=frame_used.id)
    session.add_all([frame_top, frame_right, frame_bottom, frame_left])
    session.flush()

    glazing = ApertureElementGlazing(
        name="Test Glazing", glazing_type_id=glazing_used.id
    )
    session.add(glazing)
    session.flush()

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
    session.add(element)
    session.commit()

    return project


def test_get_manufacturer_filters_includes_used_and_available(
    client: TestClient, session: Session
) -> None:
    project = seed_project_with_used_types(session)

    response = client.get(f"/aperture/manufacturer-filters/{project.bt_number}")

    assert response.status_code == 200
    payload = response.json()

    assert set(payload["available_frame_manufacturers"]) == {"Alpen", "Internorm"}
    assert set(payload["available_glazing_manufacturers"]) == {"Guardian", "Pilkington"}

    assert "Alpen" in payload["enabled_frame_manufacturers"]
    assert "Guardian" in payload["enabled_glazing_manufacturers"]

    assert payload["used_frame_manufacturers"] == ["Alpen"]
    assert payload["used_glazing_manufacturers"] == ["Guardian"]


def test_patch_manufacturer_filters_keeps_used_enabled(
    client: TestClient, session: Session
) -> None:
    project = seed_project_with_used_types(session)

    response = client.patch(
        f"/aperture/manufacturer-filters/{project.bt_number}",
        json={
            "enabled_frame_manufacturers": ["Internorm"],
            "enabled_glazing_manufacturers": [],
        },
    )

    assert response.status_code == 200
    payload = response.json()

    assert set(payload["enabled_frame_manufacturers"]) == {"Alpen", "Internorm"}
    assert payload["enabled_glazing_manufacturers"] == ["Guardian"]

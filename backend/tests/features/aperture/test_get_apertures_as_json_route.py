# -*- Python Version: 3.11 -*-
"""Route tests for get-apertures-as-json."""

import json

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
from main import app
from sqlalchemy.orm import Session


def _create_project(db: Session, bt_number: str) -> Project:
    user = User(
        username=f"user_{bt_number}",
        email=f"{bt_number}@example.com",
        hashed_password=get_password_hash("test123"),
    )
    db.add(user)
    db.flush()

    project = Project(
        name=f"Project {bt_number}",
        bt_number=bt_number,
        owner_id=user.id,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


def _create_aperture_with_element(
    db: Session,
    project: Project,
    name: str,
    frame_type: ApertureFrameType,
    glazing_type: ApertureGlazingType,
) -> Aperture:
    aperture = Aperture(
        name=name,
        project_id=project.id,
        row_heights_mm=[1000.0],
        column_widths_mm=[1200.0],
    )
    db.add(aperture)
    db.flush()

    frame_top = ApertureElementFrame(name=f"{name} Top", frame_type_id=frame_type.id)
    frame_right = ApertureElementFrame(
        name=f"{name} Right", frame_type_id=frame_type.id
    )
    frame_bottom = ApertureElementFrame(
        name=f"{name} Bottom", frame_type_id=frame_type.id
    )
    frame_left = ApertureElementFrame(name=f"{name} Left", frame_type_id=frame_type.id)
    db.add_all([frame_top, frame_right, frame_bottom, frame_left])
    db.flush()

    glazing = ApertureElementGlazing(
        name=f"{name} Glazing", glazing_type_id=glazing_type.id
    )
    db.add(glazing)
    db.flush()

    element = ApertureElement(
        name=f"{name} Element",
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
    db.add(element)
    db.commit()
    db.refresh(aperture)
    return aperture


def test_get_apertures_as_json_route_returns_json_string(
    client: TestClient,
    test_db: Session,
    sample_aperture_with_elements: Aperture,
):
    response = client.get("/aperture/get-apertures-as-json/AP001")

    assert response.status_code == 200
    payload = response.json()
    assert "apertures" in payload
    assert isinstance(payload["apertures"], str)

    apertures = json.loads(payload["apertures"])
    assert "Test Aperture" in apertures

    aperture_data = apertures["Test Aperture"]
    assert aperture_data["name"] == "Test Aperture"
    assert "elements" in aperture_data
    assert len(aperture_data["elements"]) == 1

    element = aperture_data["elements"][0]
    assert "glazing" in element
    assert "frames" in element
    assert set(element["frames"].keys()) == {"top", "right", "bottom", "left"}
    assert element["glazing"]["glazing_type"] is not None


def test_get_apertures_as_json_route_empty_project(
    client: TestClient, test_db: Session
):
    project = _create_project(test_db, "NO_APERTURES")

    response = client.get(f"/aperture/get-apertures-as-json/{project.bt_number}")

    assert response.status_code == 200
    apertures = json.loads(response.json()["apertures"])
    assert apertures == {}


def test_get_apertures_as_json_route_multiple_apertures(
    client: TestClient,
    test_db: Session,
    sample_aperture_with_elements: Aperture,
):
    project = sample_aperture_with_elements.project
    frame_type = test_db.query(ApertureFrameType).first()
    glazing_type = test_db.query(ApertureGlazingType).first()
    assert frame_type is not None
    assert glazing_type is not None

    _create_aperture_with_element(
        test_db,
        project,
        name="Second Aperture",
        frame_type=frame_type,
        glazing_type=glazing_type,
    )

    response = client.get(f"/aperture/get-apertures-as-json/{project.bt_number}")

    assert response.status_code == 200
    apertures = json.loads(response.json()["apertures"])
    assert set(apertures.keys()) == {"Test Aperture", "Second Aperture"}


def test_get_apertures_as_json_route_offset_param_is_accepted(
    client: TestClient,
    test_db: Session,
    sample_aperture_with_elements: Aperture,
):
    response_default = client.get("/aperture/get-apertures-as-json/AP001")
    response_offset = client.get("/aperture/get-apertures-as-json/AP001?offset=5")

    assert response_default.status_code == 200
    assert response_offset.status_code == 200
    assert response_default.json() == response_offset.json()


def test_get_apertures_as_json_route_unknown_project_returns_500(test_db: Session):
    error_client = TestClient(app, raise_server_exceptions=False)
    response = error_client.get("/aperture/get-apertures-as-json/UNKNOWN_BT")

    assert response.status_code == 500

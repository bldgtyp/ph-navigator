# -*- Python Version: 3.11 -*-
"""Route tests for get-window-constructions-as-hbjson."""

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
    """Create an aperture with one element at position (0, 0)."""
    aperture = Aperture(
        name=name,
        project_id=project.id,
        row_heights_mm=[1000.0],
        column_widths_mm=[1200.0],
    )
    db.add(aperture)
    db.flush()

    frame_top = ApertureElementFrame(name=f"{name} Top", frame_type_id=frame_type.id)
    frame_right = ApertureElementFrame(name=f"{name} Right", frame_type_id=frame_type.id)
    frame_bottom = ApertureElementFrame(name=f"{name} Bottom", frame_type_id=frame_type.id)
    frame_left = ApertureElementFrame(name=f"{name} Left", frame_type_id=frame_type.id)
    db.add_all([frame_top, frame_right, frame_bottom, frame_left])
    db.flush()

    glazing = ApertureElementGlazing(name=f"{name} Glazing", glazing_type_id=glazing_type.id)
    db.add(glazing)
    db.flush()

    element = ApertureElement(
        name=f"{name} Element",
        aperture_id=aperture.id,
        row_number=0,
        column_number=0,
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


def _create_test_project_with_aperture(db: Session, bt_number: str = "HBJ001") -> Aperture:
    """Create a project with a valid aperture for window construction tests."""
    project = _create_project(db, bt_number)

    frame_type = ApertureFrameType(
        id=f"ft_{bt_number}",
        name="Test Frame",
        width_mm=100.0,
        u_value_w_m2k=1.0,
        psi_g_w_mk=0.04,
    )
    db.add(frame_type)
    db.flush()

    glazing_type = ApertureGlazingType(
        id=f"gt_{bt_number}",
        name="Test Glazing",
        u_value_w_m2k=0.7,
        g_value=0.4,
    )
    db.add(glazing_type)
    db.flush()

    return _create_aperture_with_element(db, project, "Test Aperture", frame_type, glazing_type)


def test_get_window_constructions_as_hbjson_returns_200(client: TestClient, test_db: Session):
    _create_test_project_with_aperture(test_db, "HBJ001")

    response = client.get("/aperture/get-window-constructions-as-hbjson/HBJ001")

    assert response.status_code == 200
    payload = response.json()
    assert "hb_constructions" in payload


def test_hbjson_contains_window_construction_type(client: TestClient, test_db: Session):
    _create_test_project_with_aperture(test_db, "HBJ002")

    response = client.get("/aperture/get-window-constructions-as-hbjson/HBJ002")
    constructions = json.loads(response.json()["hb_constructions"])

    assert len(constructions) > 0
    for _key, value in constructions.items():
        assert value["type"] == "WindowConstruction"
        assert len(value["materials"]) == 1
        assert value["materials"][0]["type"] == "EnergyWindowMaterialSimpleGlazSys"


def test_hbjson_identifier_format(client: TestClient, test_db: Session):
    _create_test_project_with_aperture(test_db, "HBJ003")

    response = client.get("/aperture/get-window-constructions-as-hbjson/HBJ003")
    constructions = json.loads(response.json()["hb_constructions"])

    assert "Test Aperture_C0_R0" in constructions


def test_hbjson_material_has_correct_shgc(client: TestClient, test_db: Session):
    _create_test_project_with_aperture(test_db, "HBJ004")

    response = client.get("/aperture/get-window-constructions-as-hbjson/HBJ004")
    constructions = json.loads(response.json()["hb_constructions"])

    construction = list(constructions.values())[0]
    material = construction["materials"][0]
    assert material["shgc"] == 0.4


def test_hbjson_empty_project_returns_empty(client: TestClient, test_db: Session):
    _create_project(test_db, "HBJ_EMPTY")

    response = client.get("/aperture/get-window-constructions-as-hbjson/HBJ_EMPTY")

    assert response.status_code == 200
    constructions = json.loads(response.json()["hb_constructions"])
    assert constructions == {}


def test_hbjson_unknown_project_returns_404(client: TestClient, test_db: Session):
    response = client.get("/aperture/get-window-constructions-as-hbjson/UNKNOWN_BT")

    assert response.status_code == 404


def test_hbjson_multiple_apertures(client: TestClient, test_db: Session):
    project = _create_project(test_db, "HBJ005")

    frame_type = ApertureFrameType(
        id="ft_hbj005", name="Frame", width_mm=100.0, u_value_w_m2k=1.0, psi_g_w_mk=0.04
    )
    test_db.add(frame_type)
    test_db.flush()

    glazing_type = ApertureGlazingType(
        id="gt_hbj005", name="Glazing", u_value_w_m2k=0.7, g_value=0.4
    )
    test_db.add(glazing_type)
    test_db.flush()

    _create_aperture_with_element(test_db, project, "Window A", frame_type, glazing_type)
    _create_aperture_with_element(test_db, project, "Window B", frame_type, glazing_type)

    response = client.get("/aperture/get-window-constructions-as-hbjson/HBJ005")
    constructions = json.loads(response.json()["hb_constructions"])

    assert "Window A_C0_R0" in constructions
    assert "Window B_C0_R0" in constructions

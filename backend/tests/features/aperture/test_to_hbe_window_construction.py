# -*- Python Version: 3.11 -*-
"""Unit tests for aperture → HB-Energy WindowConstruction conversion."""

from db_entities.aperture.aperture import Aperture
from db_entities.aperture.aperture_element import ApertureElement
from db_entities.aperture.aperture_frame import ApertureElementFrame
from db_entities.aperture.aperture_glazing import ApertureElementGlazing
from db_entities.aperture.frame_type import ApertureFrameType
from db_entities.aperture.glazing_type import ApertureGlazingType
from db_entities.app.project import Project
from db_entities.app.user import User
from features.aperture.services.to_hbe_window_construction import (
    _element_identifier,
    convert_aperture_element_to_hbe_window_construction,
    convert_apertures_to_hbe_window_constructions,
)
from features.auth.services import get_password_hash
from sqlalchemy.orm import Session


def _make_frame_type(db: Session, id: str, width_mm: float = 100.0) -> ApertureFrameType:
    ft = ApertureFrameType(
        id=id,
        name=f"Frame {id}",
        width_mm=width_mm,
        u_value_w_m2k=1.0,
        psi_g_w_mk=0.04,
    )
    db.add(ft)
    db.flush()
    return ft


def _make_glazing_type(
    db: Session, id: str, u_value: float = 1.0, g_value: float = 0.5
) -> ApertureGlazingType:
    gt = ApertureGlazingType(
        id=id,
        name=f"Glazing {id}",
        u_value_w_m2k=u_value,
        g_value=g_value,
    )
    db.add(gt)
    db.flush()
    return gt


def _make_aperture_with_element(
    db: Session,
    project: Project,
    name: str,
    frame_type: ApertureFrameType,
    glazing_type: ApertureGlazingType,
    row_number: int = 0,
    column_number: int = 0,
) -> Aperture:
    aperture = Aperture(
        name=name,
        project_id=project.id,
        row_heights_mm=[1000.0],
        column_widths_mm=[1000.0],
    )
    db.add(aperture)
    db.flush()

    frames = []
    for side in ("Top", "Right", "Bottom", "Left"):
        f = ApertureElementFrame(name=f"{name} {side}", frame_type_id=frame_type.id)
        frames.append(f)
    db.add_all(frames)
    db.flush()

    glazing = ApertureElementGlazing(name=f"{name} Glazing", glazing_type_id=glazing_type.id)
    db.add(glazing)
    db.flush()

    element = ApertureElement(
        name=f"{name} Element",
        aperture_id=aperture.id,
        row_number=row_number,
        column_number=column_number,
        row_span=1,
        col_span=1,
        frame_top_id=frames[0].id,
        frame_right_id=frames[1].id,
        frame_bottom_id=frames[2].id,
        frame_left_id=frames[3].id,
        glazing_id=glazing.id,
    )
    db.add(element)
    db.commit()
    db.refresh(aperture)
    return aperture


def _make_project(db: Session, bt_number: str) -> Project:
    user = User(
        username=f"user_{bt_number}",
        email=f"{bt_number}@example.com",
        hashed_password=get_password_hash("test123"),
    )
    db.add(user)
    db.flush()

    project = Project(name=f"Project {bt_number}", bt_number=bt_number, owner_id=user.id)
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


# --- _element_identifier ---


def test_element_identifier_format():
    class FakeElement:
        column_number = 2
        row_number = 3

    assert _element_identifier("MyWindow", FakeElement()) == "MyWindow_C2_R3"


def test_element_identifier_zero_indexed():
    class FakeElement:
        column_number = 0
        row_number = 0

    assert _element_identifier("Win", FakeElement()) == "Win_C0_R0"


# --- convert_aperture_element_to_hbe_window_construction ---


def test_convert_element_returns_window_construction(test_db: Session):
    project = _make_project(test_db, "CONV01")
    ft = _make_frame_type(test_db, "conv_frame_01")
    gt = _make_glazing_type(test_db, "conv_glaz_01", u_value=0.7, g_value=0.4)
    aperture = _make_aperture_with_element(test_db, project, "TestWin", ft, gt)

    element = aperture.elements[0]
    result = convert_aperture_element_to_hbe_window_construction("TestWin", element, 0.85)

    assert result is not None
    assert result.identifier == "TestWin_C0_R0"
    assert len(result.materials) == 1

    mat = result.materials[0]
    assert mat.identifier == "TestWin_C0_R0_GlazSys"
    assert mat.u_factor == 0.85
    assert mat.shgc == 0.4


def test_convert_element_missing_glazing_returns_none(test_db: Session):
    project = _make_project(test_db, "CONV02")

    aperture = Aperture(
        name="NoGlazing",
        project_id=project.id,
        row_heights_mm=[1000.0],
        column_widths_mm=[1000.0],
    )
    test_db.add(aperture)
    test_db.flush()

    element = ApertureElement(
        name="Bare Element",
        aperture_id=aperture.id,
        row_number=0,
        column_number=0,
        row_span=1,
        col_span=1,
        glazing_id=None,
    )
    test_db.add(element)
    test_db.commit()
    test_db.refresh(element)

    result = convert_aperture_element_to_hbe_window_construction("NoGlazing", element, 1.0)
    assert result is None


def test_convert_element_to_dict_format(test_db: Session):
    project = _make_project(test_db, "CONV03")
    ft = _make_frame_type(test_db, "conv_frame_03")
    gt = _make_glazing_type(test_db, "conv_glaz_03", g_value=0.35)
    aperture = _make_aperture_with_element(test_db, project, "DictTest", ft, gt)

    element = aperture.elements[0]
    result = convert_aperture_element_to_hbe_window_construction("DictTest", element, 1.2)
    assert result is not None

    d = result.to_dict()
    assert d["type"] == "WindowConstruction"
    assert d["identifier"] == "DictTest_C0_R0"
    assert d["materials"][0]["type"] == "EnergyWindowMaterialSimpleGlazSys"


# --- convert_apertures_to_hbe_window_constructions ---


def test_convert_single_aperture(test_db: Session):
    project = _make_project(test_db, "BULK01")
    ft = _make_frame_type(test_db, "bulk_frame_01")
    gt = _make_glazing_type(test_db, "bulk_glaz_01")
    aperture = _make_aperture_with_element(test_db, project, "BulkWin", ft, gt)

    constructions = convert_apertures_to_hbe_window_constructions([aperture])

    assert len(constructions) == 1
    assert constructions[0].identifier == "BulkWin_C0_R0"


def test_convert_empty_apertures_returns_empty():
    constructions = convert_apertures_to_hbe_window_constructions([])
    assert constructions == []


def test_convert_multiple_apertures(test_db: Session):
    project = _make_project(test_db, "BULK02")
    ft = _make_frame_type(test_db, "bulk_frame_02")
    gt = _make_glazing_type(test_db, "bulk_glaz_02")

    a1 = _make_aperture_with_element(test_db, project, "WinA", ft, gt)
    a2 = _make_aperture_with_element(test_db, project, "WinB", ft, gt)

    constructions = convert_apertures_to_hbe_window_constructions([a1, a2])

    identifiers = {c.identifier for c in constructions}
    assert "WinA_C0_R0" in identifiers
    assert "WinB_C0_R0" in identifiers

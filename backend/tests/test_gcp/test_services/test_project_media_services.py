# -*- Python Version: 3.11 -*-

import pytest
from sqlalchemy.orm import Session

from db_entities.app.project import Project
from db_entities.assembly.material_datasheet import MaterialDatasheet
from db_entities.assembly.material_photo import MaterialPhoto
from features.gcp.services.project_media import (
    ProjectNotFoundException,
    get_all_segment_ids_for_project,
    get_project_by_bt_number,
    get_project_datasheets,
    get_project_site_photos,
)


def test_get_project_by_bt_number(session: Session, create_test_project):
    """Test getting a project by its bt_number."""
    project: Project = create_test_project(db=session, username="user1", project_name="Project 1")

    result = get_project_by_bt_number(session, project.bt_number)
    assert result.id == project.id
    assert result.bt_number == project.bt_number


def test_get_project_by_bt_number_not_found(session: Session, create_test_project):
    """Test that ProjectNotFoundException is raised for non-existent bt_number."""
    with pytest.raises(ProjectNotFoundException) as exc_info:
        get_project_by_bt_number(session, "nonexistent")
    assert "not found" in exc_info.value.message.lower()


def test_get_all_segment_ids_for_project(session: Session, create_test_project):
    """Test getting all segment IDs for a project."""
    project: Project = create_test_project(db=session, username="user1", project_name="Project 1")

    segment_ids = get_all_segment_ids_for_project(session, project.bt_number)

    # The test fixture creates 1 assembly with 1 layer with 1 segment
    assert len(segment_ids) == 1
    assert segment_ids[0] == project.assemblies[0].layers[0].segments[0].id


def test_get_project_site_photos_empty(session: Session, create_test_project):
    """Test getting site photos for a project with no photos."""
    project: Project = create_test_project(db=session, username="user1", project_name="Project 1")

    result = get_project_site_photos(session, project.bt_number)

    assert result == {}


def test_get_project_site_photos_with_data(session: Session, create_test_project):
    """Test getting site photos for a project with photos."""
    project: Project = create_test_project(db=session, username="user1", project_name="Project 1")
    segment = project.assemblies[0].layers[0].segments[0]

    # Add photos
    photo1 = MaterialPhoto(
        segment_id=segment.id,
        full_size_url="https://storage.example.com/full1.jpg",
        thumbnail_url="https://storage.example.com/thumb1.jpg",
        content_hash="hash1",
    )
    photo2 = MaterialPhoto(
        segment_id=segment.id,
        full_size_url="https://storage.example.com/full2.jpg",
        thumbnail_url="https://storage.example.com/thumb2.jpg",
        content_hash="hash2",
    )
    session.add(photo1)
    session.add(photo2)
    session.commit()

    result = get_project_site_photos(session, project.bt_number)

    assert segment.id in result
    assert len(result[segment.id]) == 2


def test_get_project_datasheets_empty(session: Session, create_test_project):
    """Test getting datasheets for a project with no datasheets."""
    project: Project = create_test_project(db=session, username="user1", project_name="Project 1")

    result = get_project_datasheets(session, project.bt_number)

    assert result == {}


def test_get_project_datasheets_with_data(session: Session, create_test_project):
    """Test getting datasheets for a project with datasheets."""
    project: Project = create_test_project(db=session, username="user1", project_name="Project 1")
    segment = project.assemblies[0].layers[0].segments[0]

    # Add datasheets
    datasheet1 = MaterialDatasheet(
        segment_id=segment.id,
        full_size_url="https://storage.example.com/full_ds1.pdf",
        thumbnail_url="https://storage.example.com/thumb_ds1.jpg",
        content_hash="hash_ds1",
    )
    session.add(datasheet1)
    session.commit()

    result = get_project_datasheets(session, project.bt_number)

    assert segment.id in result
    assert len(result[segment.id]) == 1

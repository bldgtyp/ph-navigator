# -*- Python Version: 3.11 -*-

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from db_entities.app.project import Project
from db_entities.assembly.material_datasheet import MaterialDatasheet
from db_entities.assembly.material_photo import MaterialPhoto


def test_get_project_media_urls_empty_project(client: TestClient, session: Session, create_test_project):
    """Test fetching media URLs for a project with no photos or datasheets."""
    project: Project = create_test_project(db=session, username="user1", project_name="Project 1")

    response = client.get(f"/gcp/get-project-media-urls/{project.bt_number}")
    assert response.status_code == 200

    data = response.json()
    assert "site_photos" in data
    assert "datasheets" in data
    assert data["site_photos"] == {}
    assert data["datasheets"] == {}


def test_get_project_media_urls_with_photos(client: TestClient, session: Session, create_test_project):
    """Test fetching media URLs for a project with site photos."""
    project: Project = create_test_project(db=session, username="user1", project_name="Project 1")
    segment = project.assemblies[0].layers[0].segments[0]

    # Add site photos to the segment
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

    response = client.get(f"/gcp/get-project-media-urls/{project.bt_number}")
    assert response.status_code == 200

    data = response.json()
    assert str(segment.id) in data["site_photos"]
    assert len(data["site_photos"][str(segment.id)]) == 2
    assert data["site_photos"][str(segment.id)][0]["thumbnail_url"] == "https://storage.example.com/thumb1.jpg"


def test_get_project_media_urls_with_datasheets(client: TestClient, session: Session, create_test_project):
    """Test fetching media URLs for a project with datasheets."""
    project: Project = create_test_project(db=session, username="user1", project_name="Project 1")
    segment = project.assemblies[0].layers[0].segments[0]

    # Add datasheets to the segment
    datasheet1 = MaterialDatasheet(
        segment_id=segment.id,
        full_size_url="https://storage.example.com/full_ds1.pdf",
        thumbnail_url="https://storage.example.com/thumb_ds1.jpg",
        content_hash="hash_ds1",
    )
    session.add(datasheet1)
    session.commit()

    response = client.get(f"/gcp/get-project-media-urls/{project.bt_number}")
    assert response.status_code == 200

    data = response.json()
    assert str(segment.id) in data["datasheets"]
    assert len(data["datasheets"][str(segment.id)]) == 1
    assert data["datasheets"][str(segment.id)][0]["thumbnail_url"] == "https://storage.example.com/thumb_ds1.jpg"


def test_get_project_media_urls_with_mixed_media(client: TestClient, session: Session, create_test_project):
    """Test fetching media URLs for a project with both photos and datasheets."""
    project: Project = create_test_project(db=session, username="user1", project_name="Project 1")
    segment = project.assemblies[0].layers[0].segments[0]

    # Add site photo
    photo = MaterialPhoto(
        segment_id=segment.id,
        full_size_url="https://storage.example.com/full_photo.jpg",
        thumbnail_url="https://storage.example.com/thumb_photo.jpg",
        content_hash="hash_photo",
    )
    # Add datasheet
    datasheet = MaterialDatasheet(
        segment_id=segment.id,
        full_size_url="https://storage.example.com/full_ds.pdf",
        thumbnail_url="https://storage.example.com/thumb_ds.jpg",
        content_hash="hash_ds",
    )
    session.add(photo)
    session.add(datasheet)
    session.commit()

    response = client.get(f"/gcp/get-project-media-urls/{project.bt_number}")
    assert response.status_code == 200

    data = response.json()

    # Verify site photos
    assert str(segment.id) in data["site_photos"]
    assert len(data["site_photos"][str(segment.id)]) == 1

    # Verify datasheets
    assert str(segment.id) in data["datasheets"]
    assert len(data["datasheets"][str(segment.id)]) == 1


def test_get_project_media_urls_project_not_found(client: TestClient, session: Session, create_test_project):
    """Test fetching media URLs for a non-existent project."""
    # Don't create a project, just try to fetch with a fake bt_number
    response = client.get("/gcp/get-project-media-urls/nonexistent_project")
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()

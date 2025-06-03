# -*- Python Version: 3.11 -*-

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from db_entities.app import Project
from db_entities.assembly.segment import SpecificationStatus
from features.assembly.services.material import create_new_material


def test_create_new_segment_route(client: TestClient, session: Session, create_test_project):
    project: Project = create_test_project(db=session, username="user1", project_name="Project 1")
    assert len(project.assemblies) == 1
    assert len(project.assemblies[0].layers) == 1
    assert len(project.assemblies[0].layers[0].segments) == 1

    response = client.post(
        f"/assembly/create-new-segment-on-layer/{project.assemblies[0].layers[0].id}",
        json={
            "material_id": project.assemblies[0].layers[0].segments[0].material_id,
            "width_mm": 100,
            "order": project.assemblies[0].layers[0].segments[0].order + 1,
        },
    )
    assert response.status_code == 201


def test_update_segment_material_route(client: TestClient, session: Session, create_test_project):
    project: Project = create_test_project(db=session, username="user1", project_name="Project 1")
    assert len(project.assemblies) == 1
    assert len(project.assemblies[0].layers) == 1
    assert len(project.assemblies[0].layers[0].segments) == 1

    segment = project.assemblies[0].layers[0].segments[0]

    # Create a new material to update the segment
    new_mat = create_new_material(
        db=session,
        id="a_new_material",
        name="New Material",
        category="Test Category",
        argb_color="#FF5733",
        conductivity_w_mk=0.5,
        emissivity=0.8,
        density_kg_m3=800,
        specific_heat_j_kgk=1000,
    )

    response = client.patch(
        f"/assembly/update-segment-material/{segment.id}",
        json={"material_id": new_mat.id},
    )
    assert response.status_code == 200

    # Check if the segment's material was updated
    session.refresh(segment)
    assert segment.material_id == new_mat.id


def test_update_segment_width_route(client: TestClient, session: Session, create_test_project):
    project: Project = create_test_project(db=session, username="user1", project_name="Project 1")
    assert len(project.assemblies) == 1
    assert len(project.assemblies[0].layers) == 1
    assert len(project.assemblies[0].layers[0].segments) == 1
    assert project.assemblies[0].layers[0].segments[0].width_mm == 100.0

    segment = project.assemblies[0].layers[0].segments[0]
    new_width = 150.0

    response = client.patch(
        f"/assembly/update-segment-width/{segment.id}",
        json={"width_mm": new_width},
    )
    assert response.status_code == 200

    # Check if the segment's width was updated
    session.refresh(segment)
    assert segment.width_mm == new_width


def test_update_segment_steel_stud_spacing_route(client: TestClient, session: Session, create_test_project):
    project: Project = create_test_project(db=session, username="user1", project_name="Project 1")
    assert len(project.assemblies) == 1
    assert len(project.assemblies[0].layers) == 1
    assert len(project.assemblies[0].layers[0].segments) == 1
    assert project.assemblies[0].layers[0].segments[0].steel_stud_spacing_mm == None

    segment = project.assemblies[0].layers[0].segments[0]
    new_spacing = 300.0

    response = client.patch(
        f"/assembly/update-segment-steel-stud-spacing/{segment.id}",
        json={"steel_stud_spacing_mm": new_spacing},
    )
    assert response.status_code == 200

    # Check if the segment's steel stud spacing was updated
    session.refresh(segment)
    assert segment.steel_stud_spacing_mm == new_spacing


def test_update_segment_continuous_insulation_route(client: TestClient, session: Session, create_test_project):
    project: Project = create_test_project(db=session, username="user1", project_name="Project 1")
    assert len(project.assemblies) == 1
    assert len(project.assemblies[0].layers) == 1
    assert len(project.assemblies[0].layers[0].segments) == 1
    assert project.assemblies[0].layers[0].segments[0].is_continuous_insulation == False

    segment = project.assemblies[0].layers[0].segments[0]

    response = client.patch(
        f"/assembly/update-segment-is-continuous-insulation/{segment.id}",
        json={"is_continuous_insulation": True},
    )
    assert response.status_code == 200

    # Check if the segment's continuous insulation status was updated
    session.refresh(segment)
    assert segment.is_continuous_insulation == True


def test_update_segment_specification_status_route(client: TestClient, session: Session, create_test_project):
    project: Project = create_test_project(db=session, username="user1", project_name="Project 1")
    assert len(project.assemblies) == 1
    assert len(project.assemblies[0].layers) == 1
    assert len(project.assemblies[0].layers[0].segments) == 1
    assert project.assemblies[0].layers[0].segments[0].specification_status == SpecificationStatus.NA

    segment = project.assemblies[0].layers[0].segments[0]

    # -----------------------------------------------------------------------------------
    # -- complete
    response = client.patch(
        f"/assembly/update-segment-specification-status/{segment.id}",
        json={"specification_status": "complete"},
    )
    assert response.status_code == 200

    # Check if the segment's specification status was updated
    session.refresh(segment)
    assert segment.specification_status == SpecificationStatus.COMPLETE

    # -----------------------------------------------------------------------------------
    # -- missing
    response = client.patch(
        f"/assembly/update-segment-specification-status/{segment.id}",
        json={"specification_status": "missing"},
    )
    assert response.status_code == 200

    # Check if the segment's specification status was updated
    session.refresh(segment)
    assert segment.specification_status == SpecificationStatus.MISSING

    # -----------------------------------------------------------------------------------
    # -- question
    response = client.patch(
        f"/assembly/update-segment-specification-status/{segment.id}",
        json={"specification_status": "question"},
    )
    assert response.status_code == 200

    # Check if the segment's specification status was updated
    session.refresh(segment)
    assert segment.specification_status == SpecificationStatus.QUESTION

    # -----------------------------------------------------------------------------------
    # -- NA
    response = client.patch(
        f"/assembly/update-segment-specification-status/{segment.id}",
        json={"specification_status": "na"},
    )
    assert response.status_code == 200

    # Check if the segment's specification status was updated
    session.refresh(segment)
    assert segment.specification_status == SpecificationStatus.NA


def test_update_segment_notes_route(client: TestClient, session: Session, create_test_project):
    project: Project = create_test_project(db=session, username="user1", project_name="Project 1")
    assert len(project.assemblies) == 1
    assert len(project.assemblies[0].layers) == 1
    assert len(project.assemblies[0].layers[0].segments) == 1
    assert project.assemblies[0].layers[0].segments[0].notes is None

    segment = project.assemblies[0].layers[0].segments[0]
    new_notes = "This is a test note."

    response = client.patch(
        f"/assembly/update-segment-notes/{segment.id}",
        json={"notes": new_notes},
    )
    assert response.status_code == 200

    # Check if the segment's notes were updated
    session.refresh(segment)
    assert segment.notes == new_notes


def test_delete_last_segment_raises_exception_route(client: TestClient, session: Session, create_test_project):
    project: Project = create_test_project(db=session, username="user1", project_name="Project 1")
    assert len(project.assemblies) == 1
    assert len(project.assemblies[0].layers) == 1
    assert len(project.assemblies[0].layers[0].segments) == 1

    segment_id_to_delete = project.assemblies[0].layers[0].segments[0].id
    response = client.delete(f"/assembly/delete-segment/{segment_id_to_delete}")

    assert response.status_code == 400
    assert (
        response.json()["detail"]
        == f"Cannot pop Segment {segment_id_to_delete} as it is the last segment in Layer {project.assemblies[0].layers[0].id}."
    )


def test_delete_segment_route(client: TestClient, session: Session, create_test_project):
    project: Project = create_test_project(db=session, username="user1", project_name="Project 1")
    assert len(project.assemblies) == 1
    assert len(project.assemblies[0].layers) == 1
    assert len(project.assemblies[0].layers[0].segments) == 1

    # Add a second segment to ensure we can delete the first one
    response = client.post(
        f"/assembly/create-new-segment-on-layer/{project.assemblies[0].layers[0].id}",
        json={
            "material_id": project.assemblies[0].layers[0].segments[0].material_id,
            "width_mm": 100,
            "order": project.assemblies[0].layers[0].segments[0].order + 1,
        },
    )
    assert response.status_code == 201

    session.refresh(project)  # Refresh the Project to get the updated assemblies

    assert len(project.assemblies[0].layers[0].segments) == 2
    segment_id_to_delete = project.assemblies[0].layers[0].segments[0].id
    response = client.delete(f"/assembly/delete-segment/{segment_id_to_delete}")
    assert response.status_code == 204
    assert response.content == b""

    # Verify the segment was deleted
    session.refresh(project)
    assert len(project.assemblies[0].layers[0].segments) == 1

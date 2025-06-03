# -*- Python Version: 3.11 -*-

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from db_entities.app import Project


def test_create_new_assembly_on_project_route(client: TestClient, session: Session, create_test_project):
    project: Project = create_test_project(db=session, username="user1", project_name="Project 1")
    assert len(project.assemblies) == 1

    response = client.post(f"/assembly/create-new-assembly-on-project/{project.bt_number}")
    assert response.status_code == 201

    session.refresh(project)  # Refresh the Project to get the updated assemblies

    assert len(project.assemblies) == 2
    assert project.assemblies[1].name == "Unnamed Assembly"


def test_add_single_assembly_from_hbjson_construction(client: TestClient, session: Session, create_test_project):
    project: Project = create_test_project(db=session, username="user1", project_name="Project 1")
    assert len(project.assemblies) == 1

    response = client.post(
        f"/assembly/add-assemblies-from-hbjson-constructions/{project.bt_number}",
        files={"file": ("single_construction.json", open("tests/test_data/single_construction.json", "rb"))},
    )

    assert response.status_code == 201

    session.refresh(project)  # Refresh the Project to get the updated assemblies
    assert len(project.assemblies) == 2
    assert "New Assembly 1" in {a.name for a in project.assemblies}


def test_add_multiple_assemblies_from_hbjson_construction(client: TestClient, session: Session, create_test_project):
    project: Project = create_test_project(db=session, username="user1", project_name="Project 1")
    assert len(project.assemblies) == 1

    response = client.post(
        f"/assembly/add-assemblies-from-hbjson-constructions/{project.bt_number}",
        files={"file": ("two_constructions.json", open("tests/test_data/two_constructions.json", "rb"))},
    )

    assert response.status_code == 201

    session.refresh(project)  # Refresh the Project to get the updated assemblies
    assert len(project.assemblies) == 3
    assert "New Assembly 1" in {a.name for a in project.assemblies}
    assert "New Assembly 2" in {a.name for a in project.assemblies}


def test_get_project_assemblies_route(client: TestClient, session: Session, create_test_project):
    project: Project = create_test_project(db=session, username="user1", project_name="Project 1")

    response = client.get(f"/assembly/get-assemblies/{project.bt_number}")
    assert response.status_code == 200
    assert isinstance(response.json(), list)
    assert len(response.json()) == 1  # Assuming one assembly is created by default


def test_update_assembly_name_route(client: TestClient, session: Session, create_test_project):
    project: Project = create_test_project(db=session, username="user1", project_name="Project 1")
    assert project.assemblies[0].name == "Test Assembly"

    # Create a new assembly first
    response = client.patch(
        f"/assembly/update-assembly-name/{project.assemblies[0].id}", json={"new_name": "Updated Assembly Name"}
    )

    session.refresh(project)  # Refresh the Project to get the updated name

    assert response.status_code == 200
    assert project.assemblies[0].name == "Updated Assembly Name"


def test_delete_assembly_route(client: TestClient, session: Session, create_test_project):
    project: Project = create_test_project(db=session, username="user1", project_name="Project 1")

    assert len(project.assemblies) == 1

    response = client.delete(f"/assembly/delete-assembly/{project.assemblies[0].id}")

    assert response.status_code == 204

    session.refresh(project)  # Refresh the Project to get the updated assemblies

    assert len(project.assemblies) == 0
